import { toast } from '../systems/toast.js'
import { ViewCanvasBase } from "./view-canvas-base.js";
import { createWasiPreview1Imports } from "../util/wasi.js";
import { parseCSVLines } from "../util/csv.js";
import { createWriteInput } from "../util/fs.js";
import { ViewFiles } from "./view-files.js";
import { ViewSqlTable } from "./view-sql-table.js";
import "./code-editor.js";

const DEFAULT_GRAPH_NAME = "default";



function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const NG = {
  MAX_NODES: 1024,
  MAX_INPUTS: 32,
  MAX_OUTPUTS: 32,
  MAX_ARGS: 32,
  NODE_GOAL: 1,
  NODE_CODE: 2,
  NODE_CALL: 3,
  NODE_VALUE: 4,
};

const NG_VALUE = {
  EMPTY: 0,
  I64: 1,
};

const NG_IMPORT_ARG = {
  GRAPH_ID: 0,
};

const NG_IMPORT_BOUNDARY_PORT_STRIDE = NG.MAX_OUTPUTS + 1;

function encodeImportBoundaryPortId(nodeId, portId) {
  const a = Number(nodeId || 0);
  const b = Number(portId || 0);
  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(b) || b <= 0) return 0;
  return a * NG_IMPORT_BOUNDARY_PORT_STRIDE + b;
}

const ABI = {
  I32: 4,
  INPUT_PORT_SIZE: 12,
  OUTPUT_PORT_SIZE: 4,
  VALUE_SLOT_SIZE: 12,
  NODE_HEADER_SIZE: 32,
};
ABI.NODE_SIZE =
  ABI.NODE_HEADER_SIZE +
  NG.MAX_INPUTS * ABI.INPUT_PORT_SIZE +
  NG.MAX_OUTPUTS * ABI.OUTPUT_PORT_SIZE +
  NG.MAX_ARGS * ABI.VALUE_SLOT_SIZE;

const INFO = {
  GENERATION: 8,
  NODES: 24 + ABI.I32,
};

const NODE = {
  ID: 0,
  KIND: 4,
  EXEC_STATE: 8,
  INPUT_COUNT: 20,
  OUTPUT_COUNT: 24,
};

const MIN_SCALE = 0.2;
const MAX_SCALE = 3.0;
const AUTO_ARRANGE_MIN_HORIZONTAL_SPACING_PX = 128;
const AUTO_ARRANGE_MIN_VERTICAL_SPACING_PX = 64;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || "shader compile failed");
  }
  return shader;
}

function createProgram(gl, vert, frag) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || "program link failed");
  }
  return program;
}

function buildGlyphMap(meta) {
  const map = new Map();
  if (!meta || !meta.glyphs || !meta.atlas) return map;
  const aw = Number(meta.atlas.width) || 1;
  const ah = Number(meta.atlas.height) || 1;
  const em = Number(meta.atlas.size) || 1;
  const yOriginTop = meta.atlas.yOrigin === "top";

  for (const g of meta.glyphs) {
    const code = g.unicode;
    const advancePx = Number(g.advance || 0) * em;
    if (!g.planeBounds || !g.atlasBounds) {
      map.set(code, { empty: true, advancePx });
      continue;
    }

    const ab = g.atlasBounds;
    const pb = g.planeBounds;
    const left = Number(ab.left);
    const right = Number(ab.right);
    const srcBottom = Number(ab.bottom);
    const srcTop = Number(ab.top);

    const bottom = yOriginTop ? ah - srcBottom : srcBottom;
    const top = yOriginTop ? ah - srcTop : srcTop;
    const widthPx = right - left;
    const heightPx = top - bottom;

    map.set(code, {
      empty: false,
      uv: [left / aw, bottom / ah, widthPx / aw, heightPx / ah],
      widthPx,
      heightPx,
      offsetXPx: (Number(pb.left) + Number(pb.right)) * 0.5 * em,
      baselineOffsetYPx: -((Number(pb.bottom) + Number(pb.top)) * 0.5 * em),
      advancePx,
    });
  }

  return map;
}

class ViewNodeGraph2 extends ViewCanvasBase {
  static get viewMeta() {
    return { displayName: "Node Graph 2", category: "Canvas" };
  }

  static get observedAttributes() {
    return ["graph-name"];
  }

  static get keybindings() {
    return [
      { id: "create-node", eventName: "node:create", description: "Create new node", defaultKeys: "a" },
      { id: "delete-node", eventName: "node:delete", description: "Delete selected nodes", defaultKeys: "<BS>" },
      { id: "edit-node", eventName: "node:edit", description: "Edit selected node", defaultKeys: "e" },
      { id: "run-graph", eventName: "node:run", description: "Run node graph", defaultKeys: "<C-CR>" },
    ];
  }

  constructor() {
    super();

    // this.gl is initialized in initCtx() via ViewCanvasBase constructor
    this.assets = null;
    this.api = null;
    this.memory = null;
    this.dv = null;
    this.nodeLayout = new Map();

    this.lastGeneration = -1;
    this.lastSizeKey = "";

    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.isPanning = false;
    this.isNodeDragging = false;
    this.nodeDragStartWorld = { x: 0, y: 0 };
    this.nodeDragItems = [];

    this.textAtlas = null;
    this.skinTexture = null;
    this.portTextures = null;
    this.portLabels = new Map();
    this.nodeNames = new Map();
    this.lastGraph = null;
    this.lastPosById = new Map();
    this.hoverPick = null;
    this.selectedNodeIds = new Set();
    this.boxSelection = null;
    this.connectionDrag = null;

    this.td = new TextDecoder();
    this.te = new TextEncoder();
    this.sourceByNode = new Map();
    this.codePathByNode = new Map();
    this.codeReadOnlyByNode = new Map();
    this.codeStatusByNode = new Map();
    this.graphIdByNode = new Map();
    this.graphNameByNode = new Map();
    this.importDefaultsByNode = new Map();
    this.valueByNode = new Map();
    this.RUN_EVENT = {
      1: "run_started",
      2: "node_started",
      3: "node_succeeded",
      4: "node_failed",
      5: "run_finished",
    };
    this.ioToastOffset = 0;
    this.goalRunQueue = [];
    this._raf = 0;
    this._pendingInitialFit = true;
    this._hasSeenInitialResize = false;
    this.currentGraphId = 0;
    this.graphSnapshotById = new Map();
    this.graphName = DEFAULT_GRAPH_NAME;
    this.autoFitOnLoad = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name !== "graph-name" || oldValue === newValue) return;
    this.setGraphName(newValue, { reload: false });
  }

  handleKeybinding(eventName, context) {
    switch (eventName) {
      case "file:save":
      case "node:save":
        this.showSaveGraphPopup();
        return true;
      case "node:create":
        this.showAddNodePopup();
        return true;
      case "node:delete":
        this.deleteSelectedNodes();
        return true;
      case "node:edit":
        this.showEditNodePopup();
        return true;
      case "node:run":
        this.runGraph();
        return true;
      default:
        return super.handleKeybinding(eventName, context);
    }
  }

  initCtx() {
    this.ctx = null;
    this.gl = this.canvas.getContext("webgl2", { alpha: false, antialias: true });
  }

  createHeaderControlsElement() {
    const controls = document.createElement("div");
    controls.innerHTML = `
      <button data-action="run" class="success" aria-label="Run" title="Run"><i aria-hidden="true">play_arrow</i></button>
      <button data-action="add" aria-label="Add Node" title="Add Node"><i aria-hidden="true">add</i></button>
      <button data-action="save" class="accent" aria-label="Save" title="Save"><i aria-hidden="true">save</i></button>
      <button data-action="load" aria-label="Load" title="Load"><i aria-hidden="true">folder_open</i></button>
      <button data-action="reset" aria-label="Reset" title="Reset"><i aria-hidden="true">replay</i></button>
      <button data-action="clear" aria-label="Clear" title="Clear"><i aria-hidden="true">clear_all</i></button>
      <button data-action="edit" aria-label="Edit" title="Edit"><i aria-hidden="true">edit</i></button>
      <button data-action="delete" aria-label="Delete Selected" title="Delete Selected"><i aria-hidden="true">delete</i></button>
      <button data-action="zoom-in" aria-label="Zoom In" title="Zoom In"><i aria-hidden="true">zoom_in</i></button>
      <button data-action="zoom-out" aria-label="Zoom Out" title="Zoom Out"><i aria-hidden="true">zoom_out</i></button>
      <button data-action="zoom-fit" aria-label="Fit View" title="Fit View"><i aria-hidden="true">fit_screen</i></button>
      <button data-action="auto-arrange" aria-label="Auto Arrange" title="Auto Arrange"><i aria-hidden="true">account_tree</i></button>
    `;
    return controls;
  }

  setupUI() {
    this.canvas.style.touchAction = "none";
  }

  async connectedCallback() {
    super.connectedCallback();

    this.graphName = String(this.getAttribute("graph-name") || this.graphName || DEFAULT_GRAPH_NAME).trim() || DEFAULT_GRAPH_NAME;

    // Re-acquire context after canvas is attached to DOM.
    if (!this.gl) {
      this.initCtx();
    }

    const runBtn = this.queryHeaderControl('[data-action="run"]');
    if (runBtn) runBtn.onclick = () => this.runGraph();

    const addBtn = this.queryHeaderControl('[data-action="add"]');
    if (addBtn) addBtn.onclick = () => this.showAddNodePopup();

    const saveBtn = this.queryHeaderControl('[data-action="save"]');
    if (saveBtn) saveBtn.onclick = () => this.showSaveGraphPopup();

    const loadBtn = this.queryHeaderControl('[data-action="load"]');
    if (loadBtn) loadBtn.onclick = () => this.showLoadGraphPopup();

    const resetBtn = this.queryHeaderControl('[data-action="reset"]');
    if (resetBtn) resetBtn.onclick = async () => this.resetGraph();

    const clearBtn = this.queryHeaderControl('[data-action="clear"]');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (this.api?.ng_exec_clear_all) {
          this.api.ng_exec_clear_all();
          this._clearRuntimeIo();
          this.requestRenderIfGenerationChanged(true);
        }
      };
    }

    const editBtn = this.queryHeaderControl('[data-action="edit"]');
    if (editBtn) editBtn.onclick = () => this.showEditNodePopup();

    const deleteBtn = this.queryHeaderControl('[data-action="delete"]');
    if (deleteBtn) deleteBtn.onclick = () => this.deleteSelectedNodes();

    this._syncSelectionActionButtons();

    const zoomInBtn = this.queryHeaderControl('[data-action="zoom-in"]');
    if (zoomInBtn) zoomInBtn.onclick = () => this.zoomIn();

    const zoomOutBtn = this.queryHeaderControl('[data-action="zoom-out"]');
    if (zoomOutBtn) zoomOutBtn.onclick = () => this.zoomOut();

    const zoomFitBtn = this.queryHeaderControl('[data-action="zoom-fit"]');
    if (zoomFitBtn) zoomFitBtn.onclick = () => this.fitToContent();

    const autoArrangeBtn = this.queryHeaderControl('[data-action="auto-arrange"]');
    if (autoArrangeBtn) autoArrangeBtn.onclick = () => autoArrangeNodeGraphView(this);

    if (!this.gl) {
      this.textContent = "WebGL2 not supported";
      return;
    }

    this._initPrograms();
    this.setAssets(getNodeGraphRenderAssets());
    await this.bootRuntime();
    this._startWatch();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    if (this.pluginHandle) {
      window.pluginManager.unload(this.pluginHandle);
      this.pluginHandle = null;
    }
  }

  setAssets(assets) {
    this.assets = assets;
    if (this.gl) {
      Promise.all([
        this._loadNineSliceTextureFromAssets(),
        this._loadTextAtlasFromAssets(),
        this._loadPortTexturesFromAssets(),
      ])
        .then(() => {
          this._refreshAllNodeFrames();
          this.requestRenderIfGenerationChanged(true);
          this._queueInitialFit();
        })
        .catch(() => {
          toast.error("Failed to load Node Graph 2 render assets.");
        });
    }
  }

  setNodeLayoutMap(map) {
    this.nodeLayout = map;
    this.requestRenderIfGenerationChanged(true);
  }

  setGraphName(name, { reload = false } = {}) {
    const nextName = String(name || DEFAULT_GRAPH_NAME).trim() || DEFAULT_GRAPH_NAME;
    const changed = nextName !== this.graphName;
    this.graphName = nextName;
    if (reload && this.api) {
      this.resetGraph();
      return;
    }
    if (changed) {
      this.requestRenderIfGenerationChanged(true);
    }
  }

  _measureTextWidth(text, scale = 1) {
    const value = String(text || "");
    if (!value) return 0;

    const atlasSize = Math.max(1, this.textAtlas?.atlasSize || this.assets?.text?.fontPx || 14);
    const glyphs = this.textAtlas?.glyphs;
    if (!glyphs) {
      return value.length * atlasSize * 0.58 * scale;
    }

    let widthPx = 0;
    for (const ch of value) {
      const g = glyphs.get(ch.codePointAt(0));
      if (!g) {
        widthPx += atlasSize * 0.3 * scale;
        continue;
      }
      widthPx += g.advancePx * scale;
    }
    return widthPx;
  }

  _getNodeTitleLabel(node) {
    const kindLabel = node.kind === NG.NODE_CODE
      ? "code"
      : node.kind === NG.NODE_GOAL
        ? "goal"
        : node.kind === NG.NODE_VALUE
          ? "value"
          : node.kind === NG.NODE_CALL
            ? (this._getGraphNameForNode(node.id) || "import")
            : "node";
    const customName = String(this.nodeNames.get(node.id) || "").trim();
    return customName ? `${customName} (#${node.id})` : `${kindLabel} #${node.id}`;
  }

  _getNodeStateLabel(node) {
    return `state ${node.execState}`;
  }

  _measureNodeSize(node) {
    const nodeCfg = this.assets?.node || {};
    const layout = this.assets?.layout || {};
    const ports = this.assets?.ports || {};
    const text = this.assets?.text || {};

    const minWidth = Number(nodeCfg.width || 146);
    const maxWidth = Number.isFinite(Number(nodeCfg.maxWidth)) && Number(nodeCfg.maxWidth) > 0
      ? Number(nodeCfg.maxWidth)
      : Infinity;
    const minHeight = Number(nodeCfg.minHeight || nodeCfg.height || 62);
    const padX = Number(layout.nodePaddingX || 10);
    const nodePaddingY = Number(layout.nodePaddingY || 8);
    const rowStartY = Number(ports.rowStartY || ((layout.nodeHeaderHeight || 28) + 2));
    const spacingY = Number(ports.spacingY || 18);
    const iconSizePx = Number(ports.iconSizePx || 12);
    const labelOffset = Number(ports.labelOffsetX || 10);
    const inputInsetX = Number(ports.inputInsetX || 0);
    const outputInsetX = Number(ports.outputInsetX || 0);
    const titlePx = Number(text.fontPx || 14);
    const portPx = Number(ports.labelFontPx || 11);
    const atlasSize = Math.max(1, this.textAtlas?.atlasSize || titlePx);
    const titleScale = titlePx / atlasSize;
    const portScale = portPx / atlasSize;
    const iconHalf = iconSizePx * 0.5;

    const titleWidth = this._measureTextWidth(this._getNodeTitleLabel(node), titleScale);
    const stateWidth = this._measureTextWidth(this._getNodeStateLabel(node), portScale);
    const headerGap = 12;
    const headerWidth = padX * 2 + titleWidth + stateWidth + headerGap;

    let leftLabelWidth = 0;
    for (let i = 0; i < (node.inputCount || 0); i++) {
      const inputId = node.inputs?.[i]?.inputId ?? i + 1;
      const label = this._getPortLabel(node.id, "input", inputId, i);
      leftLabelWidth = Math.max(leftLabelWidth, this._measureTextWidth(label, portScale));
    }

    let rightLabelWidth = 0;
    for (let i = 0; i < (node.outputCount || 0); i++) {
      const outputId = node.outputs?.[i]?.outputId ?? i + 1;
      const label = node.kind === NG.NODE_VALUE
        ? (this._getStoredNodeValue(node.id, outputId) || "value")
        : this._getPortLabel(node.id, "output", outputId, i);
      rightLabelWidth = Math.max(rightLabelWidth, this._measureTextWidth(label, portScale));
    }

    const bodyWidth =
      inputInsetX + iconHalf + labelOffset + leftLabelWidth +
      padX * 2 +
      rightLabelWidth + labelOffset + iconHalf + outputInsetX;

    const width = Math.max(minWidth, Math.min(maxWidth, Math.ceil(Math.max(headerWidth, bodyWidth))));

    const rowCount = Math.max(node.inputCount || 0, node.outputCount || 0);
    if (rowCount <= 0) return { width, height: minHeight };

    const lastPortCenterY = rowStartY + (rowCount - 1) * spacingY;
    const requiredHeight = lastPortCenterY + iconSizePx * 0.5 + nodePaddingY;
    return { width, height: Math.max(minHeight, Math.ceil(requiredHeight)) };
  }

  _updateNodeFrame(nodeId, node, index = 0) {
    if (!Number.isFinite(Number(nodeId)) || !node) return null;
    const existing = this.nodeLayout.get(nodeId);
    const layout = this.assets.layout;
    const col = index % layout.gridColumns;
    const row = Math.floor(index / layout.gridColumns);
    const size = this._measureNodeSize(node);
    const frame = {
      x: existing?.x ?? (layout.gridOriginX + col * layout.gridStepX),
      y: existing?.y ?? (layout.gridOriginY + row * layout.gridStepY),
      width: size.width,
      height: size.height,
    };
    this.nodeLayout.set(nodeId, frame);
    return frame;
  }

  _refreshNodeFrame(nodeId) {
    const numericId = Number(nodeId);
    if (!Number.isFinite(numericId) || numericId <= 0) return null;
    const snapshot = this.getGraphSnapshot();
    const index = snapshot.nodes.findIndex((node) => node.id === numericId);
    if (index < 0) return null;
    return this._updateNodeFrame(numericId, snapshot.nodes[index], index);
  }

  _refreshAllNodeFrames(nodes = null) {
    const list = Array.isArray(nodes) ? nodes : this.getGraphSnapshot().nodes;
    list.forEach((node, index) => {
      this._updateNodeFrame(node.id, node, index);
    });
  }

  setPortLabelMap(map) {
    this.portLabels = map || new Map();
    this.requestRenderIfGenerationChanged(true);
  }

  getGraphSnapshot() {
    if (!this.api || !this.memory) return { nodes: [], edges: [] };
    if (!this._ensureDataView()) return { nodes: [], edges: [] };
    return this._readGraph();
  }

  getSelectedNodeIds() {
    return Array.from(this.selectedNodeIds || []);
  }

  attachRuntime({ api, memory }) {
    this.api = api;
    this.memory = memory;
    this.dv = new DataView(memory.buffer);
    this.requestRenderIfGenerationChanged(true);
  }

  async bootRuntime() {
    this.pluginHandle = await window.pluginManager.load({
      name: "ng",
      importObject: {
        wasi_snapshot_preview1: createWasiPreview1Imports(() => this.memory),
        env: {
          ng_on_node_changed: (_nodeId, _changeMask) => {
            this.requestRenderIfGenerationChanged(true);
          },
          ng_on_goal_reached: (goalNodeId, payloadPtr, payloadLen) => {
            const raw = this.readUtf8(payloadPtr, payloadLen).trim();
            const msg = raw || `Goal #${goalNodeId} reached.`;
            const short = msg.length > 240 ? `${msg.slice(0, 239)}…` : msg;
            toast.info(short);
          },
          ng_on_run_event: (_nodeId, eventKind, _errorCode) => {
            const eventName = this.RUN_EVENT[eventKind] || `event_${eventKind}`;
            if (eventName === "run_started") {
              this.ioToastOffset = this._getRuntimeIoLength();
            }

            if (eventName === "node_succeeded" || (eventName === "run_finished" && !_errorCode)) {
              this._emitRuntimePrintToasts();
            }

            // Only toast on failures; keep callback fast.
            if (eventName === "node_failed") {
              const msg = this._readRuntimeIoMessage(240);
              toast.error(
                msg
                  ? `Node #${_nodeId} failed (code ${_errorCode}): ${msg}`
                  : `Node #${_nodeId} failed (code ${_errorCode}).`
              );
            } else if (eventName === "run_finished" && _errorCode) {
              const msg = this._readRuntimeIoMessage(240);
              toast.error(
                msg
                  ? `Run failed (code ${_errorCode}): ${msg}`
                  : `Run failed (code ${_errorCode}).`
              );
              this.goalRunQueue = [];
            } else if (eventName === "run_finished") {
              this._clearRuntimeIo();
              if (this.goalRunQueue.length > 0) {
                const nextGoalId = this.goalRunQueue.shift();
                const err = this._startRun(nextGoalId);
                if (err !== 0) {
                  toast.error(`Failed to run goal #${nextGoalId} (code ${err}).`);
                  this.goalRunQueue = [];
                }
              }
            }
            if (eventName === "run_finished") {
              this.requestRenderIfGenerationChanged(true);
            }
          },
          ng_host_resolve: (nodeId, resolveKind, reqPtr, reqLen, outPtr, outCap, outLenPtr) => {
            if (!this.memory) return 7;
            let payload = "";
            if (resolveKind === 1) {
              payload = this.sourceByNode.get(nodeId) || "";
            } else if (resolveKind === 2) {
              const req = this.readUtf8(reqPtr, reqLen);
              const p0 = req.indexOf("|");
              const p1 = p0 >= 0 ? req.indexOf("|", p0 + 1) : -1;
              const service = p0 >= 0 ? req.slice(0, p0) : "";
              const method = p1 >= 0 ? req.slice(p0 + 1, p1) : "";
              const raw = p1 >= 0 ? req.slice(p1 + 1) : "{}";
              payload = this._resolveHostSync(service, method, raw);
            } else if (resolveKind === 3) {
              let outputId = 1;
              if (reqPtr > 0 && reqLen >= 4 && this.memory) {
                outputId = new DataView(this.memory.buffer).getUint32(reqPtr, true);
              }
              payload = this._getStoredNodeValue(nodeId, outputId);
            } else if (resolveKind === 4) {
              let graphId = 0;
              if (reqPtr > 0 && reqLen >= 4 && this.memory) {
                graphId = new DataView(this.memory.buffer).getUint32(reqPtr, true);
              }
              const graph = this.graphSnapshotById instanceof Map ? this.graphSnapshotById.get(Number(graphId || 0)) : null;
              payload = JSON.stringify(graph?.nodes || []);
            } else {
              return 7;
            }

            const bytes = this.te.encode(payload);
            if (bytes.length > outCap) return 4;
            new Uint8Array(this.memory.buffer, outPtr, bytes.length).set(bytes);
            new DataView(this.memory.buffer).setInt32(outLenPtr, bytes.length, true);
            return 0;
          },
          ng_host_request: (nodeId, requestId, servicePtr, serviceLen, methodPtr, methodLen, payloadPtr, payloadLen) => {
            if (!this.memory) return 7;
            const service = this.readUtf8(servicePtr, serviceLen);
            const method = this.readUtf8(methodPtr, methodLen);
            const payload = this.readUtf8(payloadPtr, payloadLen);
            this._handleHostAwaitRequest(nodeId, requestId, service, method, payload);
            return 0;
          },
        },
      },
    });

    this.attachRuntime({ api: this.pluginHandle.exports, memory: this.pluginHandle.memory });
    await this.resetGraph();
  }

  _resolveHostSync(service, method, raw) {
    if (service !== "http") {
      return JSON.stringify({ ok: false, error: `unsupported service: ${service}` });
    }

    let url = "";
    let reqMethod = String(method || "GET").toUpperCase();
    let reqHeaders = null;
    let reqBody = null;
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      url = String(parsed.url || "");
      reqMethod = String(parsed.method || reqMethod || "GET").toUpperCase();
      reqHeaders = parsed.headers && typeof parsed.headers === "object" ? parsed.headers : null;
      reqBody = typeof parsed.body === "string" ? parsed.body : null;
    } catch {
      url = "";
    }

    try {
      const xhr = new XMLHttpRequest();
      xhr.open(reqMethod || "GET", url, false);
      if (reqHeaders) {
        for (const [key, value] of Object.entries(reqHeaders)) {
          if (value === undefined || value === null) continue;
          xhr.setRequestHeader(String(key), String(value));
        }
      }
      xhr.send(reqBody);
      return JSON.stringify({
        ok: xhr.status >= 200 && xhr.status < 300,
        method: reqMethod,
        url,
        status: xhr.status,
        statusText: xhr.statusText,
        body: xhr.responseText,
      });
    } catch (error) {
      return JSON.stringify({ ok: false, method: reqMethod, url, error: String(error?.message || error) });
    }
  }

  async _handleHostAwaitRequest(_nodeId, requestId, service, method, payloadJson) {
    if (!this.api || !this.memory || typeof this.api.ng_run_response !== "function") return;
    let response = new Uint8Array();
    let responseFn = this.api.ng_run_response;
    try {
      const result = await window.pluginManager.call(service, method, payloadJson || "");
      response = result?.output instanceof Uint8Array
        ? result.output
        : new Uint8Array(result?.output || []);
      if (Number(result?.returnCode || 0) !== 0 && typeof this.api.ng_run_response_error === "function") {
        responseFn = this.api.ng_run_response_error;
      }
    } catch (error) {
      response = this.te.encode(String(error?.message || error));
      if (typeof this.api.ng_run_response_error === "function") {
        responseFn = this.api.ng_run_response_error;
      }
    }

    const ptr = this.api.ng_get_io_ptr();
    const len = Math.min(response.length, 65535);
    new Uint8Array(this.memory.buffer, ptr, len).set(response.subarray(0, len));
    responseFn.call(this.api, requestId, ptr, len);
    this.requestRenderIfGenerationChanged(true);
  }

  readUtf8(ptr, len) {
    if (!this.memory || ptr <= 0 || len <= 0) return "";
    return this.td.decode(new Uint8Array(this.memory.buffer, ptr, len));
  }

  _readRuntimeIoMessage(maxLen = 240) {
    if (!this.api || !this.memory) return "";
    if (typeof this.api.ng_get_io_ptr !== "function" || typeof this.api.ng_get_io_len !== "function") return "";
    const ptr = Number(this.api.ng_get_io_ptr());
    const len = Number(this.api.ng_get_io_len());
    if (!Number.isFinite(ptr) || !Number.isFinite(len) || ptr <= 0 || len <= 0) return "";
    const clipped = Math.min(len, 8192);
    let text = this.td.decode(new Uint8Array(this.memory.buffer, ptr, clipped));
    text = String(text || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length > maxLen) text = text.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
    return text;
  }

  _emitRuntimePrintToasts() {
    if (!this.api || !this.memory) return;
    if (typeof this.api.ng_get_io_ptr !== "function" || typeof this.api.ng_get_io_len !== "function") return;
    const ptr = Number(this.api.ng_get_io_ptr());
    const len = Number(this.api.ng_get_io_len());
    if (!Number.isFinite(ptr) || !Number.isFinite(len) || ptr <= 0 || len <= 0) return;

    const start = Math.max(0, Math.min(this.ioToastOffset, len));
    if (len <= start) return;

    const text = this.td.decode(new Uint8Array(this.memory.buffer, ptr + start, len - start));
    this.ioToastOffset = len;

    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const short = line.length > 220 ? `${line.slice(0, 219)}…` : line;
      toast.info(short);
    }
  }

  _getRuntimeIoLength() {
    if (!this.api || typeof this.api.ng_get_io_len !== "function") return 0;
    const len = Number(this.api.ng_get_io_len());
    if (!Number.isFinite(len) || len < 0) return 0;
    return len;
  }

  _clearRuntimeIo() {
    if (this.api && typeof this.api.ng_io_clear === "function") {
      this.api.ng_io_clear();
      this.ioToastOffset = 0;
      return;
    }
    this.ioToastOffset = this._getRuntimeIoLength();
  }

  _getSelectedGoalNodeIds() {
    const selectedIds = new Set(this.getSelectedNodeIds().map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0));
    if (!selectedIds.size) return [];
    const snapshot = this.getGraphSnapshot();
    return snapshot.nodes
      .filter((node) => node.kind === NG.NODE_GOAL && selectedIds.has(node.id))
      .map((node) => node.id);
  }

  _startRun(goalNodeId = 0) {
    if (!this.api) return 1;
    if (typeof this.api.ng_run_start === "function") {
      return this.api.ng_run_start(goalNodeId);
    }
    if (goalNodeId !== 0 && typeof this.api.ng_run_goal === "function") {
      return this.api.ng_run_goal(goalNodeId);
    }
    if (typeof this.api.ng_run_all_goals === "function") {
      return this.api.ng_run_all_goals();
    }
    return 1;
  }

  _startWatch() {
    const tick = () => {
      this.requestRenderIfGenerationChanged();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _queueInitialFit() {
    this._pendingInitialFit = true;
    this._hasAutoFitted = false;
    this._maybeRunInitialFit();
  }

  _maybeRunInitialFit() {
    if (!this._pendingInitialFit || !this._hasSeenInitialResize) return false;
    if (!this.canvas || this.canvas.width <= 0 || this.canvas.height <= 0) return false;
    if (!this.api || !this.memory || !this.assets) return false;
    const graph = this.lastGraph || this.getGraphSnapshot();
    if (!graph?.nodes?.length) return false;
    const fitted = this.fitToContent();
    if (!fitted) return false;
    this._pendingInitialFit = false;
    this._hasAutoFitted = true;
    return true;
  }

  _onResized(width, height) {
    super._onResized(width, height);
    if (width > 0 && height > 0) {
      this._hasSeenInitialResize = true;
      this._maybeRunInitialFit();
    }
  }

  async resetGraph() {
    if (!this.api) return;
    const initErr = this.api.ng_init();
    if (initErr !== 0) {
      toast.error(`Failed to initialize graph runtime (code ${initErr}).`);
      return;
    }
    const err = await this.loadGraphByName(this.graphName || DEFAULT_GRAPH_NAME, { quietCodeIssues: true, setCurrentGraph: false });
    if (err !== 0) {
      toast.error(`Failed to load graph "${this.graphName || DEFAULT_GRAPH_NAME}" (code ${err}).`);
    }
  }

  async runGraph() {
    if (!this.api) return;
    const hydrated = await this._hydrateCodeNodesForRun();
    if (!hydrated) return;
    const snapshot = this.getGraphSnapshot();
    await this._primeImportGraphCache(snapshot.nodes);
    const selectedGoals = this._getSelectedGoalNodeIds();
    this.goalRunQueue = [];

    try {
      if (selectedGoals.length > 0) {
        const [firstGoal, ...restGoals] = selectedGoals;
        this.goalRunQueue = restGoals;
        const err = this._startRun(firstGoal);
        if (err !== 0) {
          this.goalRunQueue = [];
          toast.error(`Failed to run goal #${firstGoal} (code ${err}).`);
        }
      } else {
        const err = this._startRun(0);
        if (err !== 0) {
          toast.error(`Failed to run goals (code ${err}).`);
        }
      }
      this.requestRenderIfGenerationChanged(true);
    } catch (error) {
      toast.error(`Failed to run graph: ${String(error?.message || error)}`);
    }
  }

  deleteSelectedNodes() {
    if (!this.api || typeof this.api.ng_node_delete !== "function") return;

    const selectedIds = this.getSelectedNodeIds()
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (!selectedIds.length) {
      return;
    }

    let deletedCount = 0;
    let failedCount = 0;
    let selectionChanged = false;

    for (const nodeId of selectedIds) {
      const err = this.api.ng_node_delete(nodeId);
      if (err !== 0) {
        failedCount += 1;
        toast.error(`Failed to delete node #${nodeId} (code ${err}).`);
        continue;
      }

      deletedCount += 1;
      if (this.selectedNodeIds.delete(nodeId)) {
        selectionChanged = true;
      }
      this.nodeLayout.delete(nodeId);
      this.nodeNames.delete(nodeId);
      if (this.portLabels instanceof Map) this.portLabels.delete(nodeId);
      if (this.codePathByNode instanceof Map) this.codePathByNode.delete(nodeId);
      if (this.codeReadOnlyByNode instanceof Map) this.codeReadOnlyByNode.delete(nodeId);
      if (this.codeStatusByNode instanceof Map) this.codeStatusByNode.delete(nodeId);
      if (this.graphIdByNode instanceof Map) this.graphIdByNode.delete(nodeId);
      if (this.graphNameByNode instanceof Map) this.graphNameByNode.delete(nodeId);
      if (this.importDefaultsByNode instanceof Map) this.importDefaultsByNode.delete(nodeId);
      if (this.sourceByNode instanceof Map) this.sourceByNode.delete(nodeId);
      if (this.valueByNode instanceof Map) this.valueByNode.delete(nodeId);
    }

    if (selectionChanged) {
      this._emitSelectionChanged();
    }

    if (deletedCount > 0 && failedCount === 0) {
      toast.success(`Deleted ${deletedCount} node${deletedCount === 1 ? "" : "s"}.`);
    } else if (deletedCount > 0) {
      toast.warning(`Deleted ${deletedCount} node${deletedCount === 1 ? "" : "s"}; ${failedCount} failed.`);
    }

    this.requestRenderIfGenerationChanged(true);
  }

  _kindToFormValue(kind) {
    if (kind === NG.NODE_VALUE) return "value";
    if (kind === NG.NODE_GOAL) return "goal";
    if (kind === NG.NODE_CALL) return "import";
    return "code";
  }

  _kindFromFormValue(value, fallback = NG.NODE_CODE) {
    if (value === "value") return NG.NODE_VALUE;
    if (value === "goal") return NG.NODE_GOAL;
    if (value === "import") return NG.NODE_CALL;
    if (value === "code") return NG.NODE_CODE;
    return fallback;
  }

  _renderNodeTypeOptions(selectedKind, templates = [], selectedTemplateName = "") {
    const selected = selectedTemplateName
      ? `template:${selectedTemplateName}`
      : this._kindToFormValue(selectedKind);
    const templateOptions = Array.isArray(templates) && templates.length
      ? templates.map((entry) => {
        const templateName = String(entry?.name || "").trim();
        if (!templateName) return "";
        const value = `template:${templateName}`;
        const kindLabel = this._getNodeKindLabel(Number(entry?.kind || NG.NODE_CODE));
        return `<option value="${escapeAttribute(value)}" ${selected === value ? "selected" : ""}>${escapeAttribute(templateName)} (${escapeAttribute(kindLabel)})</option>`;
      }).join("")
      : `<option value="template-empty" disabled>empty</option>`;
    return `
      <optgroup label="Base">
        <option value="value" ${selected === "value" ? "selected" : ""}>value</option>
        <option value="code" ${selected === "code" ? "selected" : ""}>code</option>
        <option value="goal" ${selected === "goal" ? "selected" : ""}>goal</option>
        <option value="import" ${selected === "import" ? "selected" : ""}>import</option>
      </optgroup>
      <optgroup label="Presets">
        ${templateOptions}
      </optgroup>
    `;
  }

  _createNodeDraft(kind = NG.NODE_CODE) {
    return {
      kind,
      templateName: "",
      name: "",
      codePath: "",
      code: "",
      codeReadOnly: kind === NG.NODE_CODE,
      codeStatus: kind === NG.NODE_CODE ? "Choose a code file to enable editing." : "",
      newInputName: "",
      newOutputName: "",
      newOutputValue: "",
      graphName: "",
      graphId: 0,
      graphSummary: { inputs: [], outputs: [] },
      inputs: [],
      outputs: [],
    };
  }

  _captureNodeDraftFromForm(draft, form) {
    if (!draft || !form) return;
    const formData = new FormData(form);
    draft.name = String(formData.get("name") || "").trim();
    draft.codePath = String(formData.get("code-path") || "").trim();
    draft.code = String(formData.get("code") || "");
    draft.newInputName = String(formData.get("new-input-name") || "");
    draft.newOutputName = String(formData.get("new-output-name") || "");
    draft.newOutputValue = String(formData.get("new-output-value") || "");

    const nextInputs = [];
    const inputIds = formData.getAll("input-port-id");
    const inputNames = formData.getAll("input-port-name");
    for (let i = 0; i < inputIds.length; i++) {
      const inputId = Number(inputIds[i]);
      if (!Number.isFinite(inputId)) continue;
      nextInputs.push({
        inputId,
        name: String(inputNames[i] || "").trim(),
      });
    }

    const nextOutputs = [];
    const outputIds = formData.getAll("output-port-id");
    const outputNames = formData.getAll("output-port-name");
    const outputValues = formData.getAll("output-port-value");
    for (let i = 0; i < outputIds.length; i++) {
      const outputId = Number(outputIds[i]);
      if (!Number.isFinite(outputId)) continue;
      nextOutputs.push({
        outputId,
        name: String(outputNames[i] || "").trim(),
        value: String(outputValues[i] || ""),
      });
    }

    draft.inputs = nextInputs;
    draft.outputs = nextOutputs;
  }

  _normalizeNodeTemplatePayload(payload, fallbackKind = NG.NODE_CODE) {
    const rawKind = Number(payload?.kind || fallbackKind);
    const kind = rawKind === NG.NODE_VALUE || rawKind === NG.NODE_GOAL || rawKind === NG.NODE_CODE || rawKind === NG.NODE_CALL
      ? rawKind
      : fallbackKind;
    const normalized = this._createNodeDraft(kind);
    normalized.name = String(payload?.name || "").trim();
    normalized.codePath = String(payload?.codePath || "").trim();
    normalized.code = String(payload?.code || "");
    normalized.graphName = String(payload?.graphName || "").trim();
    normalized.graphId = Number(payload?.graphId || 0);
    normalized.codeReadOnly = kind === NG.NODE_CODE && (!normalized.codePath || Boolean(normalized.code));
    normalized.codeStatus = normalized.codePath
      ? ""
      : normalized.code
        ? "Legacy inline code detected. Use Save as to migrate it to a file."
        : kind === NG.NODE_CODE
          ? "Choose a code file to enable editing."
          : "";

    const inputList = Array.isArray(payload?.inputs) ? payload.inputs : [];
    const outputList = Array.isArray(payload?.outputs) ? payload.outputs : [];

    normalized.inputs = inputList.map((input, index) => {
      const inputId = Number(input?.inputId || input?.id || index + 1);
      return {
        inputId: Number.isFinite(inputId) && inputId > 0 ? inputId : index + 1,
        name: String(input?.name || "").trim(),
        value: String(input?.defaultValue || input?.value || ""),
      };
    });

    normalized.outputs = outputList.map((output, index) => {
      const outputId = Number(output?.outputId || output?.id || index + 1);
      return {
        outputId: Number.isFinite(outputId) && outputId > 0 ? outputId : index + 1,
        name: String(output?.name || "").trim(),
        value: String(output?.value || ""),
      };
    });

    if (kind === NG.NODE_CALL && normalized.graphName) {
      normalized.codeReadOnly = true;
      normalized.codeStatus = "Import nodes are edited by selecting a graph.";
    }

    return normalized;
  }

  _applyNodeTemplateToDraft(draft, templateEntry) {
    const payload = this._normalizeNodeTemplatePayload(templateEntry?.data, Number(templateEntry?.kind || NG.NODE_CODE));
    draft.kind = payload.kind;
    draft.templateName = String(templateEntry?.name || "").trim();
    draft.name = payload.name;
    draft.codePath = payload.codePath;
    draft.code = payload.code;
    draft.codeReadOnly = payload.codeReadOnly;
    draft.codeStatus = payload.codeStatus;
    draft.newInputName = "";
    draft.newOutputName = "";
    draft.newOutputValue = "";
    draft.inputs = payload.inputs;
    draft.outputs = payload.outputs;
  }

  _serializeNodeTemplateDraft(draft) {
    return {
      kind: Number(draft?.kind || NG.NODE_CODE),
      name: String(draft?.name || "").trim(),
      codePath: String(draft?.codePath || "").trim(),
      graphName: String(draft?.graphName || "").trim(),
      graphId: Number(draft?.graphId || 0),
      inputs: (draft?.inputs || []).map((port, index) => ({
        inputId: Number(port?.inputId || index + 1),
        name: String(port?.name || "").trim(),
        defaultValue: String(port?.value || ""),
      })),
      outputs: (draft?.outputs || []).map((port, index) => ({
        outputId: Number(port?.outputId || index + 1),
        name: String(port?.name || "").trim(),
        value: String(port?.value || ""),
      })),
    };
  }

  _nextAvailableNodeId() {
    const used = new Set(this.getGraphSnapshot().nodes.map((node) => Number(node.id)));
    for (let id = 1; id < 0x7fffffff; id++) {
      if (!used.has(id)) return id;
    }
    return 0;
  }

  _viewportCenterWorld() {
    this._resizeCanvas();
    return {
      x: (this.canvas.width * 0.5 - this.offsetX) / Math.max(0.0001, this.scale),
      y: (this.canvas.height * 0.5 - this.offsetY) / Math.max(0.0001, this.scale),
    };
  }

  _getCodePath(nodeId) {
    if (!(this.codePathByNode instanceof Map)) return "";
    return String(this.codePathByNode.get(Number(nodeId)) || "").trim();
  }

  _setCodePath(nodeId, codePath) {
    if (!(this.codePathByNode instanceof Map)) this.codePathByNode = new Map();
    const normalized = String(codePath || "").trim();
    if (normalized) this.codePathByNode.set(Number(nodeId), normalized);
    else this.codePathByNode.delete(Number(nodeId));
  }

  _setCodeReadOnly(nodeId, readOnly) {
    if (!(this.codeReadOnlyByNode instanceof Map)) this.codeReadOnlyByNode = new Map();
    this.codeReadOnlyByNode.set(Number(nodeId), Boolean(readOnly));
  }

  _getCodeReadOnly(nodeId) {
    if (!(this.codeReadOnlyByNode instanceof Map)) return false;
    return Boolean(this.codeReadOnlyByNode.get(Number(nodeId)));
  }

  _setCodeStatus(nodeId, message = "") {
    if (!(this.codeStatusByNode instanceof Map)) this.codeStatusByNode = new Map();
    const text = String(message || "").trim();
    if (text) this.codeStatusByNode.set(Number(nodeId), text);
    else this.codeStatusByNode.delete(Number(nodeId));
  }

  _getCodeStatus(nodeId) {
    if (!(this.codeStatusByNode instanceof Map)) return "";
    return String(this.codeStatusByNode.get(Number(nodeId)) || "");
  }

  _setGraphNameForNode(nodeId, graphName) {
    if (!(this.graphNameByNode instanceof Map)) this.graphNameByNode = new Map();
    const normalized = String(graphName || "").trim();
    if (normalized) this.graphNameByNode.set(Number(nodeId), normalized);
    else this.graphNameByNode.delete(Number(nodeId));
  }

  _setGraphIdForNode(nodeId, graphId) {
    if (!(this.graphIdByNode instanceof Map)) this.graphIdByNode = new Map();
    const normalized = Number(graphId || 0);
    if (Number.isFinite(normalized) && normalized > 0) this.graphIdByNode.set(Number(nodeId), normalized);
    else this.graphIdByNode.delete(Number(nodeId));
  }

  _getGraphIdForNode(nodeId) {
    if (!(this.graphIdByNode instanceof Map)) return 0;
    return Number(this.graphIdByNode.get(Number(nodeId)) || 0);
  }

  _getGraphNameForNode(nodeId) {
    if (!(this.graphNameByNode instanceof Map)) return "";
    return String(this.graphNameByNode.get(Number(nodeId)) || "");
  }

  _setImportGraphArg(nodeId, graphId) {
    if (!this.api || typeof this.api.ng_node_set_arg !== "function") return 1;
    const normalized = Number(graphId || 0);
    return this.api.ng_node_set_arg(
      Number(nodeId),
      NG_IMPORT_ARG.GRAPH_ID,
      NG_VALUE.I64,
      Number.isFinite(normalized) && normalized > 0 ? normalized : 0,
      0,
    );
  }

  _setImportDefaultsForNode(nodeId, defaults) {
    if (!(this.importDefaultsByNode instanceof Map)) this.importDefaultsByNode = new Map();
    const bucket = new Map();
    if (Array.isArray(defaults)) {
      defaults.forEach((entry, index) => {
        if (entry && typeof entry === "object") {
          const portId = Number(entry.portId || entry.inputId || entry.id || 0);
          if (Number.isFinite(portId) && portId > 0) {
            bucket.set(portId, String(entry.value ?? entry.defaultValue ?? ""));
          }
          return;
        }
        bucket.set(index + 1, String(entry ?? ""));
      });
    }
    if (bucket.size) this.importDefaultsByNode.set(Number(nodeId), bucket);
    else this.importDefaultsByNode.delete(Number(nodeId));
  }

  _getImportDefaultsForNode(nodeId) {
    if (!(this.importDefaultsByNode instanceof Map)) return new Map();
    const list = this.importDefaultsByNode.get(Number(nodeId));
    return list instanceof Map ? list : new Map();
  }

  _getImportDefaultForPort(nodeId, portId) {
    return String(this._getImportDefaultsForNode(nodeId).get(Number(portId)) || "");
  }

  _getDefaultCodeFilename(name = "") {
    const base = String(name || "node-code")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "node-code";
    return `${base}.lua`;
  }

  _decodePluginText(result) {
    return this.td.decode(result?.output || new Uint8Array());
  }

  async _readCodeFile(codePath) {
    const path = String(codePath || "").trim();
    if (!path) throw new Error("Code file path is required.");
    const result = await window.pluginManager.call("fs", "read", path);
    if (result.returnCode !== 0) {
      throw new Error(this._decodePluginText(result) || `Failed to read ${path}.`);
    }
    return this._decodePluginText(result);
  }

  async _writeCodeFile(codePath, content) {
    const path = String(codePath || "").trim();
    if (!path) throw new Error("Code file path is required.");
    const payload = createWriteInput(path, String(content ?? ""));
    const result = await window.pluginManager.call("fs", "write", payload);
    if (result.returnCode !== 0) {
      throw new Error(this._decodePluginText(result) || `Failed to write ${path}.`);
    }
  }

  async _hydrateCodeNode(nodeId, { allowEmptyOnReadFailure = false } = {}) {
    const path = this._getCodePath(nodeId);
    if (!path) {
      if (!this.sourceByNode.has(Number(nodeId))) {
        this.sourceByNode.set(Number(nodeId), "");
        this._setCodeStatus(nodeId, "Choose a code file to enable editing.");
      }
      this._setCodeReadOnly(nodeId, true);
      return { ok: false, error: "Code file path is not set." };
    }
    try {
      const source = await this._readCodeFile(path);
      this.sourceByNode.set(Number(nodeId), source);
      this._setCodeReadOnly(nodeId, false);
      this._setCodeStatus(nodeId, "");
      return { ok: true, source, path };
    } catch (error) {
      if (allowEmptyOnReadFailure && !this.sourceByNode.has(Number(nodeId))) {
        this.sourceByNode.set(Number(nodeId), "");
      }
      this._setCodeStatus(nodeId, String(error?.message || error));
      return { ok: false, error: String(error?.message || error), path };
    }
  }

  async _hydrateCodeNodesForRun() {
    const snapshot = this.getGraphSnapshot();
    const codeNodes = snapshot.nodes.filter((node) => node.kind === NG.NODE_CODE);
    for (const node of codeNodes) {
      const result = await this._hydrateCodeNode(node.id);
      if (!result.ok) {
        const path = this._getCodePath(node.id);
        toast.error(path
          ? `Node #${node.id} cannot load ${path}: ${result.error}`
          : `Node #${node.id} has no code file.`);
        return false;
      }
    }
    return true;
  }

  async _chooseCodeFile({ title = "Choose code file" } = {}) {
    const selection = await ViewFiles.choose({ title, root: "/" });
    return selection?.path ? String(selection.path) : "";
  }

  async _chooseCodeSavePath(defaultName = "node-code.lua") {
    const selection = await ViewFiles.save({
      title: "Choose code save location",
      root: "/",
      defaultName,
    });
    return selection?.path ? String(selection.path) : "";
  }

  _renderCodeSourceFields({ codePath = "", code = "", readOnly = false, status = "" } = {}) {
    const hasPath = Boolean(String(codePath || "").trim());
    const message = String(status || "").trim();
    return `
      <fieldset>
        <legend>Code file</legend>
        <input type="hidden" name="code-path" value="${escapeAttribute(codePath)}">
        <label>
          Path
          <input type="text" value="${escapeAttribute(codePath)}" readonly placeholder="Choose or create a Lua file">
        </label>
        <div>
          <button type="submit" name="intent" value="choose-code-file">Choose file</button>
          <button type="submit" name="intent" value="save-code-file">Save as</button>
          ${hasPath ? `<button type="submit" name="intent" value="reload-code-file">Reload</button>` : ""}
        </div>
        ${message ? `<p>${escapeAttribute(message)}</p>` : ""}
        <code-editor name="code" lang="lua" rows="12" spellcheck="false" ${readOnly ? "readonly" : ""} placeholder="-- Lua code. Read inputs via inputs[<id>] and write outputs via outputs[<id>].">${escapeAttribute(code)}</code-editor>
      </fieldset>
    `;
  }

  async showAddNodePopup() {
    const popupManager = this.closest("popup-manager") || document.querySelector("popup-manager");
    if (!popupManager) {
      toast.error("Popup manager is not available.");
      return;
    }
    if (!this.api || typeof this.api.ng_node_create !== "function") return;

    let templates = [];
    try {
      templates = await this.listNodeTemplates();
    } catch (error) {
      toast.error(`Failed to load templates: ${String(error?.message || error)}`);
    }

    let graphEntries = [];
    try {
      graphEntries = await this._listSavedGraphs();
    } catch (error) {
      toast.error(`Failed to load graphs: ${String(error?.message || error)}`);
    }

    const form = document.createElement("form");
    const draft = this._createNodeDraft(NG.NODE_CODE);

    const renderForm = () => {
      const isCodeNode = draft.kind === NG.NODE_CODE;
      const isValueNode = draft.kind === NG.NODE_VALUE;
      const isImportNode = draft.kind === NG.NODE_CALL;
      const graphSummary = draft.graphSummary || { inputs: [], outputs: [] };
      const graphOptions = graphEntries.length
        ? graphEntries.map((entry) => `<option value="${Number(entry.id || 0)}" ${Number(entry.id || 0) === Number(draft.graphId || 0) ? "selected" : ""}>${escapeAttribute(entry.name)} (${Number(entry.nodeCount || 0)} node${Number(entry.nodeCount || 0) === 1 ? "" : "s"})</option>`).join("")
        : `<option value="" disabled selected>no saved graphs</option>`;
      form.innerHTML = `
       <p>Add a new node.</p>
        <label>
         Type
          <select name="node-kind">
            ${this._renderNodeTypeOptions(draft.kind, templates, draft.templateName)}
          </select>
        </label>
        <label>
          Node name
          <input type="text" name="name" placeholder="Enter node name" value="${escapeAttribute(draft.name)}">
        </label>
        ${isImportNode ? `
        <fieldset>
          <legend>Imported graph</legend>
            <label>
              Graph
              <select name="graph-name">
              <option value="" ${!draft.graphId ? "selected" : ""}>choose graph</option>
              ${graphOptions}
              </select>
            </label>
          ${this._renderImportBoundarySummary(graphSummary)}
        </fieldset>` : ""}
        ${isCodeNode ? this._renderCodeSourceFields({
        codePath: draft.codePath,
        code: draft.code,
        readOnly: draft.codeReadOnly,
        status: draft.codeStatus,
      }) : ""}
       ${this._nodeSupportsInputs(draft.kind) && !isImportNode ? `
        <fieldset>
          <legend>Inputs</legend>
          <ul>
           ${draft.inputs.map((port, index) => `
           <li>
             <input type="hidden" name="input-port-id" value="${Number(port.inputId || index + 1)}">
             <input type="text" name="input-port-name" value="${escapeAttribute(port.name || "")}" placeholder="Input ${index + 1}">
             <button type="submit" name="remove-input-id" value="${Number(port.inputId || index + 1)}" aria-label="Delete input ${index + 1}" title="Delete input"><i aria-hidden="true">delete</i></button>
           </li>`).join("")}
                   <li>
             <input type="text" name="new-input-name" value="${escapeAttribute(draft.newInputName)}" placeholder="Input name">
             <button type="submit" name="intent" value="add-input" aria-label="Add input" title="Add input" ${String(draft.newInputName).trim() ? "" : "disabled"}><i aria-hidden="true">add</i></button>
           </li>
         </ul>
       </fieldset>` : ""}
        ${this._nodeSupportsOutputs(draft.kind) && !isImportNode ? `
        <fieldset>
          <legend>Outputs</legend>
         <ul>
           ${draft.outputs.map((port, index) => `
           <li>
             <input type="hidden" name="output-port-id" value="${Number(port.outputId || index + 1)}">
             ${isValueNode
          ? `<input type="text" name="output-port-value" value="${escapeAttribute(port.value || "")}" placeholder="Value ${index + 1}">`
          : `<input type="text" name="output-port-name" value="${escapeAttribute(port.name || "")}" placeholder="Output ${index + 1}">`}
             <button type="submit" name="remove-output-id" value="${Number(port.outputId || index + 1)}" aria-label="Delete output ${index + 1}" title="Delete output"><i aria-hidden="true">delete</i></button>
           </li>`).join("")}
           <li>
             ${isValueNode
            ? `<input type="text" name="new-output-value" value="${escapeAttribute(draft.newOutputValue)}" placeholder="Value">`
            : `<input type="text" name="new-output-name" value="${escapeAttribute(draft.newOutputName)}" placeholder="Output name">`}
             <button type="submit" name="intent" value="add-output" aria-label="Add output" title="Add output" ${!isValueNode && !String(draft.newOutputName).trim() ? "disabled" : ""}><i aria-hidden="true">add</i></button>
           </li>
         </ul>
       </fieldset>` : ""}
       <footer>
         <button type="submit" name="intent" value="create-node" class="accent">Create</button>
       </footer>
      `;

      const kindSelect = form.querySelector('[name="node-kind"]');
      if (kindSelect) {
        kindSelect.onchange = async () => {
          this._captureNodeDraftFromForm(draft, form);
          const selectedValue = String(kindSelect.value || "");
          if (selectedValue.startsWith("template:")) {
            const templateName = selectedValue.slice("template:".length).trim();
            const templateEntry = templates.find((entry) => String(entry?.name || "") === templateName);
            if (!templateEntry) {
              toast.warning(`Template "${templateName}" was not found.`);
              return;
            }
            this._applyNodeTemplateToDraft(draft, templateEntry);
            if (draft.kind === NG.NODE_CODE && draft.codePath) {
              try {
                draft.code = await this._readCodeFile(draft.codePath);
                draft.codeReadOnly = false;
                draft.codeStatus = "";
              } catch (error) {
                draft.codePath = "";
                draft.codeReadOnly = true;
                draft.codeStatus = String(error?.message || error);
              }
            }
            renderForm();
            return;
          }

          const previousKind = draft.kind;
          draft.kind = this._kindFromFormValue(selectedValue, draft.kind);
          draft.templateName = "";
          if (draft.kind !== previousKind) {
            if (draft.kind === NG.NODE_CODE && !draft.codePath) {
              draft.codeReadOnly = true;
              draft.codeStatus = "Choose a code file to enable editing.";
            }
            if (draft.kind === NG.NODE_CALL) {
              draft.graphId = draft.graphId || Number(graphEntries[0]?.id || 0);
              await this._applyImportNodeGraphRef(draft, draft.graphId);
            }
            if (!this._nodeSupportsInputs(draft.kind)) {
              draft.inputs = [];
              draft.newInputName = "";
            }
            if (!this._nodeSupportsOutputs(draft.kind)) {
              draft.outputs = [];
              draft.newOutputName = "";
              draft.newOutputValue = "";
            }
          }
          renderForm();
        };
      }

      const graphSelect = form.querySelector('[name="graph-name"]');
      if (graphSelect && isImportNode) {
        graphSelect.onchange = async () => {
          draft.graphId = Number(graphSelect.value || 0);
          await this._applyImportNodeGraphRef(draft, draft.graphId);
          renderForm();
        };
      }

      const newInput = form.querySelector('[name="new-input-name"]');
      const addInput = form.querySelector('[name="intent"][value="add-input"]');
      if (newInput && addInput) {
        newInput.addEventListener("input", () => {
          addInput.disabled = !String(newInput.value || "").trim();
        });
      }

      const newOutput = form.querySelector('[name="new-output-name"]');
      const addOutput = form.querySelector('[name="intent"][value="add-output"]');
      if (newOutput && addOutput && !isValueNode) {
        newOutput.addEventListener("input", () => {
          addOutput.disabled = !String(newOutput.value || "").trim();
        });
      }
    };

    const popup = popupManager.showPopup({
      title: "Add node",
      content: form,
      size: "medium",
    });

    form.onsubmit = async (event) => {
      event.preventDefault();
      this._captureNodeDraftFromForm(draft, form);

      const submitter = event.submitter;
      const formData = new FormData(form, submitter || undefined);
      const intent = formData.has("remove-input-id")
        ? `remove-input:${String(formData.get("remove-input-id") || "")}`
        : formData.has("remove-output-id")
          ? `remove-output:${String(formData.get("remove-output-id") || "")}`
          : String(formData.get("intent") || "create-node");

      if (intent === "add-input") {
        const inputName = String(formData.get("new-input-name") || "").trim();
        if (inputName) {
          const nextId = draft.inputs.reduce((max, port) => Math.max(max, Number(port.inputId || 0)), 0) + 1;
          draft.inputs.push({ inputId: nextId, name: inputName });
          draft.newInputName = "";
        }
        renderForm();
        return;
      }

      if (intent.startsWith("remove-input:")) {
        const inputId = Number(intent.split(":")[1]);
        draft.inputs = draft.inputs.filter((port) => Number(port.inputId) !== inputId);
        renderForm();
        return;
      }

      if (intent === "add-output") {
        const outputName = String(formData.get("new-output-name") || "").trim();
        const outputValue = String(formData.get("new-output-value") || "");
        if (draft.kind === NG.NODE_VALUE || outputName) {
          const nextId = draft.outputs.reduce((max, port) => Math.max(max, Number(port.outputId || 0)), 0) + 1;
          draft.outputs.push({ outputId: nextId, name: outputName, value: outputValue });
          draft.newOutputName = "";
          draft.newOutputValue = "";
        }
        renderForm();
        return;
      }

      if (intent.startsWith("remove-output:")) {
        const outputId = Number(intent.split(":")[1]);
        draft.outputs = draft.outputs.filter((port) => Number(port.outputId) !== outputId);
        renderForm();
        return;
      }

      if (intent === "choose-code-file") {
        const selectedPath = await this._chooseCodeFile({ title: "Choose Lua code file" });
        if (selectedPath) {
          try {
            draft.code = await this._readCodeFile(selectedPath);
            draft.codePath = selectedPath;
            draft.codeReadOnly = false;
            draft.codeStatus = "";
          } catch (error) {
            draft.codePath = "";
            draft.codeReadOnly = true;
            draft.codeStatus = String(error?.message || error);
          }
        }
        renderForm();
        return;
      }

      if (intent === "save-code-file") {
        const savePath = await this._chooseCodeSavePath(this._getDefaultCodeFilename(draft.name));
        if (savePath) {
          draft.codePath = savePath;
          try {
            await this._writeCodeFile(savePath, draft.code);
            draft.codeReadOnly = false;
            draft.codeStatus = "";
          } catch (error) {
            draft.codeReadOnly = true;
            draft.codeStatus = String(error?.message || error);
          }
        }
        renderForm();
        return;
      }

      if (intent === "reload-code-file") {
        if (!draft.codePath) {
          draft.codeStatus = "Choose a code file first.";
        } else {
          try {
            draft.code = await this._readCodeFile(draft.codePath);
            draft.codeStatus = "";
          } catch (error) {
            draft.codeStatus = String(error?.message || error);
          }
        }
        renderForm();
        return;
      }

      if (draft.kind === NG.NODE_CALL) {
        const graphId = Number(formData.get("graph-name") || draft.graphId || 0);
        if (!Number.isFinite(graphId) || graphId <= 0) {
          toast.warning("Choose a graph to import.");
          return;
        }
        await this._applyImportNodeGraphRef(draft, graphId);
      }

      const nodeId = this._nextAvailableNodeId();
      if (nodeId <= 0) {
        toast.error("Could not allocate a node id.");
        return;
      }

      if (draft.kind === NG.NODE_CODE) {
        if (!draft.codePath) {
          toast.warning("Choose or create a code file for this node.");
          draft.codeReadOnly = true;
          draft.codeStatus = "Choose a code file to enable editing.";
          renderForm();
          return;
        }
        try {
          await this._writeCodeFile(draft.codePath, draft.code);
          draft.codeReadOnly = false;
          draft.codeStatus = "";
        } catch (error) {
          draft.codeReadOnly = true;
          draft.codeStatus = String(error?.message || error);
          toast.error(`Failed to save code file: ${draft.codeStatus}`);
          renderForm();
          return;
        }
      }

      if (draft.kind === NG.NODE_CALL && !draft.graphName) {
        toast.warning("Choose a graph to import.");
        renderForm();
        return;
      }

      const createErr = this.api.ng_node_create(nodeId, draft.kind);
      if (createErr !== 0) {
        toast.error(`Failed to create node (code ${createErr}).`);
        return;
      }

      for (const port of draft.inputs) {
        const err = this.api.ng_input_add(nodeId, Number(port.inputId));
        if (err !== 0) {
          toast.error(`Failed to add input ${port.inputId} (code ${err}).`);
          popup.close();
          this.requestRenderIfGenerationChanged(true);
          return;
        }
      }

      if (draft.kind === NG.NODE_CALL) {
        this._setGraphIdForNode(nodeId, draft.graphId);
        this._setGraphNameForNode(nodeId, draft.graphName);
        const argErr = this._setImportGraphArg(nodeId, draft.graphId);
        if (argErr !== 0) {
          toast.error(`Failed to set import graph id (code ${argErr}).`);
          popup.close();
          this.requestRenderIfGenerationChanged(true);
          return;
        }
      }

      for (const port of draft.outputs) {
        const err = this.api.ng_output_add(nodeId, Number(port.outputId));
        if (err !== 0) {
          toast.error(`Failed to add output ${port.outputId} (code ${err}).`);
          popup.close();
          this.requestRenderIfGenerationChanged(true);
          return;
        }
      }

      const labels = { inputs: {}, outputs: {} };
      for (const port of draft.inputs) {
        const name = String(port.name || "").trim();
        if (!name) continue;
        labels.inputs[String(port.inputId)] = name;
      }
      for (const port of draft.outputs) {
        if (draft.kind === NG.NODE_VALUE) continue;
        const name = String(port.name || "").trim();
        if (!name) continue;
        labels.outputs[String(port.outputId)] = name;
      }
      if (!(this.portLabels instanceof Map)) this.portLabels = new Map();
      this.portLabels.set(nodeId, labels);

      if (draft.kind === NG.NODE_CALL) {
        this._setImportDefaultsForNode(nodeId, draft.inputs.map((port) => ({ portId: Number(port.inputId), value: String(port.value || "") })));
      }

      if (draft.kind === NG.NODE_VALUE) {
        const bucket = new Map();
        for (const port of draft.outputs) {
          bucket.set(Number(port.outputId), String(port.value || ""));
        }
        if (!(this.valueByNode instanceof Map)) this.valueByNode = new Map();
        this.valueByNode.set(nodeId, bucket);
      }

      if (draft.kind === NG.NODE_CODE) {
        this._setCodePath(nodeId, draft.codePath);
        this.sourceByNode.set(nodeId, String(draft.code || ""));
        this._setCodeReadOnly(nodeId, false);
        this._setCodeStatus(nodeId, "");
      }

      this.nodeNames.set(nodeId, String(draft.name || "").trim());
      const tempNode = {
        id: nodeId,
        kind: draft.kind,
        execState: 0,
        inputCount: draft.inputs.length,
        outputCount: draft.outputs.length,
        inputs: draft.inputs.map((port) => ({ inputId: Number(port.inputId) })),
        outputs: draft.outputs.map((port) => ({ outputId: Number(port.outputId) })),
      };
      const center = this._viewportCenterWorld();
      const nodeSize = this._measureNodeSize(tempNode);
      this.nodeLayout.set(nodeId, {
        x: Math.round(center.x - nodeSize.width * 0.5),
        y: Math.round(center.y - nodeSize.height * 0.5),
        width: nodeSize.width,
        height: nodeSize.height,
      });

      this.selectedNodeIds.clear();
      this.selectedNodeIds.add(nodeId);
      this._emitSelectionChanged();
      this.requestRenderIfGenerationChanged(true);
      toast.success(`Added ${this._getNodeKindLabel(draft.kind)} #${nodeId}.`);
      popup.close();
    };

    renderForm();
  }

  _serializeGraphNodes() {
    const snapshot = this.getGraphSnapshot();
    const nodes = snapshot.nodes || [];
    return nodes.map((node, index) => {
      const pos = this.nodeLayout.get(node.id) || this._ensureLayout(node.id, index);
      const name = String(this.nodeNames.get(node.id) || "").trim();
      const serialized = {
        id: Number(node.id),
        kind: Number(node.kind),
        x: Math.round(Number(pos?.x || 0)),
        y: Math.round(Number(pos?.y || 0)),
        name,
        codePath: node.kind === NG.NODE_CODE ? this._getCodePath(node.id) : "",
        graphId: node.kind === NG.NODE_CALL ? this._getGraphIdForNode(node.id) : 0,
        graphName: node.kind === NG.NODE_CALL ? this._getGraphNameForNode(node.id) : "",
        inputs: (node.inputs || []).map((input, i) => ({
          id: Number(input?.inputId || i + 1),
          name: this._getStoredPortLabel(node.id, "input", Number(input?.inputId || i + 1)),
          srcNodeId: Number(input?.srcNodeId || 0),
          srcOutputId: Number(input?.srcOutputId || 0),
          defaultValue: node.kind === NG.NODE_CALL ? this._getImportDefaultForPort(node.id, Number(input?.inputId || i + 1)) || String(input?.defaultValue || "") : undefined,
        })),
        outputs: (node.outputs || []).map((output, i) => ({
          id: Number(output?.outputId || i + 1),
          name: this._getStoredPortLabel(node.id, "output", Number(output?.outputId || i + 1)),
          value: node.kind === NG.NODE_VALUE
            ? this._getStoredNodeValue(node.id, Number(output?.outputId || i + 1))
            : "",
        })),
      };
      return serialized;
    });
  }

  async _applySerializedGraph(nodes) {
    if (!this.api || !Array.isArray(nodes)) return 1;

    let err = this.api.ng_clear_graph();
    if (err !== 0) return err;

    this.goalRunQueue = [];
    this.ioToastOffset = 0;
    this.boxSelection = null;
    this.connectionDrag = null;
    this.hoverPick = null;

    this.selectedNodeIds.clear();
    this.nodeLayout = new Map();
    this.nodeNames = new Map();
    this.portLabels = new Map();
    this.sourceByNode = new Map();
    this.codePathByNode = new Map();
    this.codeReadOnlyByNode = new Map();
    this.codeStatusByNode = new Map();
    this.graphIdByNode = new Map();
    this.graphNameByNode = new Map();
    this.importDefaultsByNode = new Map();
    this.valueByNode = new Map();
    this._emitSelectionChanged();

    const sorted = [...nodes].sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
    const availableIds = new Set(sorted.map((node) => Number(node?.id || 0)));

    for (const raw of sorted) {
      const nodeId = Number(raw?.id || 0);
      const kind = Number(raw?.kind || 0);
      if (!Number.isFinite(nodeId) || nodeId <= 0) continue;
      if (kind !== NG.NODE_CODE && kind !== NG.NODE_GOAL && kind !== NG.NODE_VALUE && kind !== NG.NODE_CALL) continue;

      err = this.api.ng_node_create(nodeId, kind);
      if (err !== 0) return err;

      const inputs = Array.isArray(raw?.inputs) ? [...raw.inputs] : [];
      const outputs = Array.isArray(raw?.outputs) ? [...raw.outputs] : [];

      if (kind === NG.NODE_CALL && (inputs.length === 0 || outputs.length === 0)) {
        const graphId = Number(raw?.graphId || 0);
        const summary = await this._loadImportNodeBoundarySummary(graphId);
        if (inputs.length === 0) {
          (summary.inputs || []).forEach((port, index) => {
            inputs.push({ id: Number(port.importPortId || index + 1), name: port.name, defaultValue: port.value });
          });
        }
        if (outputs.length === 0) {
          (summary.outputs || []).forEach((port, index) => {
            outputs.push({ id: Number(port.importPortId || index + 1), name: port.name });
          });
        }
      }

      for (const input of inputs) {
        const inputId = Number(input?.id || 0);
        if (!Number.isFinite(inputId) || inputId <= 0) continue;
        err = this.api.ng_input_add(nodeId, inputId);
        if (err !== 0) return err;
      }

      for (const output of outputs) {
        const outputId = Number(output?.id || 0);
        if (!Number.isFinite(outputId) || outputId <= 0) continue;
        err = this.api.ng_output_add(nodeId, outputId);
        if (err !== 0) return err;
      }

      const labels = { inputs: {}, outputs: {} };
      for (const input of inputs) {
        const inputId = Number(input?.id || 0);
        const label = String(input?.name || "").trim();
        if (inputId > 0 && label) labels.inputs[String(inputId)] = label;
      }
      for (const output of outputs) {
        const outputId = Number(output?.id || 0);
        const label = String(output?.name || "").trim();
        if (outputId > 0 && label) labels.outputs[String(outputId)] = label;
      }
      this.portLabels.set(nodeId, labels);

      const nodeName = String(raw?.name || "").trim();
      if (nodeName) this.nodeNames.set(nodeId, nodeName);

      if (kind === NG.NODE_CALL) {
        this._setGraphIdForNode(nodeId, Number(raw?.graphId || 0));
        this._setGraphNameForNode(nodeId, String(raw?.graphName || "").trim());
        err = this._setImportGraphArg(nodeId, this._getGraphIdForNode(nodeId));
        if (err !== 0) return err;
        this._setImportDefaultsForNode(nodeId, (inputs || []).map((input) => ({ portId: Number(input?.id || 0), value: String(input?.defaultValue || "") })));
      }

      if (kind === NG.NODE_CODE) {
        const codePath = String(raw?.codePath || "").trim();
        const legacyCode = String(raw?.code || "");
        this._setCodePath(nodeId, codePath);
        if (codePath) {
          this._setCodeReadOnly(nodeId, false);
        } else if (legacyCode) {
          this.sourceByNode.set(nodeId, legacyCode);
          this._setCodeReadOnly(nodeId, true);
          this._setCodeStatus(nodeId, "Legacy inline code detected. Use Save as to migrate it to a file.");
        } else {
          this._setCodeReadOnly(nodeId, true);
          this._setCodeStatus(nodeId, "Choose a code file to enable editing.");
        }
      }

      if (kind === NG.NODE_VALUE) {
        const bucket = new Map();
        for (const output of outputs) {
          const outputId = Number(output?.id || 0);
          if (!Number.isFinite(outputId) || outputId <= 0) continue;
          bucket.set(outputId, String(output?.value || ""));
        }
        this.valueByNode.set(nodeId, bucket);
      }
      this.nodeLayout.set(nodeId, {
        x: Math.round(Number(raw?.x || 0)),
        y: Math.round(Number(raw?.y || 0)),
      });
      this._updateNodeFrame(nodeId, {
        id: nodeId,
        kind,
        execState: 0,
        inputCount: inputs.length,
        outputCount: outputs.length,
        inputs: inputs.map((input, index) => ({ inputId: Number(input?.id || index + 1) })),
        outputs: outputs.map((output, index) => ({ outputId: Number(output?.id || index + 1) })),
      }, sorted.findIndex((entry) => Number(entry?.id || 0) === nodeId));
    }

    for (const raw of sorted) {
      const nodeId = Number(raw?.id || 0);
      if (!Number.isFinite(nodeId) || nodeId <= 0 || !availableIds.has(nodeId)) continue;
      const inputs = Array.isArray(raw?.inputs) ? raw.inputs : [];
      for (const input of inputs) {
        const inputId = Number(input?.id || 0);
        const srcNodeId = Number(input?.srcNodeId || 0);
        const srcOutputId = Number(input?.srcOutputId || 0);
        if (inputId <= 0 || srcNodeId <= 0 || srcOutputId <= 0) continue;
        if (!availableIds.has(srcNodeId)) continue;
        err = this.api.ng_input_connect(nodeId, inputId, srcNodeId, srcOutputId);
        if (err !== 0) return err;
      }
    }

    this._emitSelectionChanged();
    this.requestRenderIfGenerationChanged(true);
    this._queueInitialFit();
    return 0;
  }

  async saveGraphByName(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return 1;
    this.graphName = cleanName;
    this.currentGraphId = 0;
    this.setAttribute("graph-name", cleanName);
    const payload = this._serializeGraphNodes();
    const json = JSON.stringify(payload);
    const escapedName = cleanName.replace(/'/g, "''");
    const escapedJson = json.replace(/'/g, "''");
    const sql = `INSERT INTO nodegraph2_storage (name, data, node_count, updated_at) VALUES ('${escapedName}', '${escapedJson}', ${payload.length}, datetime('now')) ON CONFLICT(name) DO UPDATE SET data = excluded.data, node_count = excluded.node_count, updated_at = excluded.updated_at`;
    await window.pluginManager.call("sql", "exec", sql);
    try {
      const result = await window.pluginManager.call("sql", "query", `SELECT rowid FROM nodegraph2_storage WHERE name = '${escapedName}'`);
      const csv = this.td.decode(result.output || new Uint8Array());
      const rows = parseCSVLines(csv.trim());
      this.currentGraphId = Number(rows[1]?.[0] || 0);
      if (this.currentGraphId > 0) {
        if (!(this.graphSnapshotById instanceof Map)) this.graphSnapshotById = new Map();
        this.graphSnapshotById.set(this.currentGraphId, { id: this.currentGraphId, name: cleanName, nodeCount: payload.length, nodes: payload });
      }
    } catch {
      this.currentGraphId = 0;
    }
    return 0;
  }

  async loadGraphByName(name, { quietCodeIssues = false, setCurrentGraph = true } = {}) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return 1;
    const escapedName = cleanName.replace(/'/g, "''");
    const result = await window.pluginManager.call("sql", "query", `SELECT rowid, data FROM nodegraph2_storage WHERE name = '${escapedName}'`);
    const csv = this.td.decode(result.output || new Uint8Array());
    const rows = parseCSVLines(csv.trim());
    if (rows.length < 2 || rows[1].length < 2) return 1;
    const parsed = JSON.parse(rows[1][1]);
    if (!Array.isArray(parsed)) return 1;
    const err = await this._applySerializedGraph(parsed);
    if (err !== 0) return err;
    this.currentGraphId = Number(rows[1][0] || 0);
    if (setCurrentGraph) {
      this.graphName = cleanName;
      this.setAttribute("graph-name", cleanName);
    }
    if (this.currentGraphId > 0) {
      if (!(this.graphSnapshotById instanceof Map)) this.graphSnapshotById = new Map();
      this.graphSnapshotById.set(this.currentGraphId, { id: this.currentGraphId, name: cleanName, nodeCount: parsed.length, nodes: parsed });
    }
    const snapshot = this.getGraphSnapshot();
    const codeNodes = snapshot.nodes.filter((node) => node.kind === NG.NODE_CODE);
    const hydrated = await Promise.all(codeNodes.map((node) => this._hydrateCodeNode(node.id, { allowEmptyOnReadFailure: true })));
    const failed = hydrated.filter((entry) => !entry.ok);
    if (!quietCodeIssues && failed.length > 0) {
      toast.warning(`Loaded graph with ${failed.length} code file issue${failed.length === 1 ? "" : "s"}. Open the affected nodes to review.`);
    }
    return 0;
  }

  async saveNodeTemplateByName(name, draftLike) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return 1;
    if (Number(draftLike?.kind || NG.NODE_CODE) === NG.NODE_CODE && !String(draftLike?.codePath || "").trim()) {
      throw new Error("Code templates require a code file path.");
    }
    const payload = this._serializeNodeTemplateDraft(
      this._normalizeNodeTemplatePayload(draftLike, Number(draftLike?.kind || NG.NODE_CODE))
    );
    const json = JSON.stringify(payload);
    const escapedName = cleanName.replace(/'/g, "''");
    const escapedJson = json.replace(/'/g, "''");
    const sql = `INSERT OR REPLACE INTO nodegraph2_node_templates (name, kind, data, updated_at) VALUES ('${escapedName}', ${Number(payload.kind || NG.NODE_CODE)}, '${escapedJson}', datetime('now'))`;
    await window.pluginManager.call("sql", "exec", sql);
    return 0;
  }

  _getSuggestedSaveGraphName() {
    if (Number(this.currentGraphId || 0) > 0) {
      return String(this.graphName || "").trim();
    }
    return "";
  }

  async listNodeTemplates() {
    const result = await window.pluginManager.call("sql", "query", "SELECT name, kind, data FROM nodegraph2_node_templates ORDER BY name");
    const csv = this.td.decode(result.output || new Uint8Array());
    const rows = parseCSVLines(csv.trim());
    const entries = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const name = String(row[0] || "").trim();
      if (!name) continue;
      const kind = Number(row[1] || NG.NODE_CODE);
      let parsedData = {};
      try {
        parsedData = row[2] ? JSON.parse(String(row[2])) : {};
      } catch {
        parsedData = {};
      }
      const data = this._serializeNodeTemplateDraft(this._normalizeNodeTemplatePayload(parsedData, kind));
      const normalized = { name, kind: Number(data.kind || kind || NG.NODE_CODE), data };
      entries.push(normalized);
    }
    return entries;
  }

  showSaveNodeTemplatePopup({ draft, initialName = "" } = {}) {
    const popupManager = this.closest("popup-manager") || document.querySelector("popup-manager");
    if (!popupManager) {
      toast.error("Popup manager is not available.");
      return Promise.resolve({ saved: false });
    }

    const normalized = this._serializeNodeTemplateDraft(
      this._normalizeNodeTemplatePayload(draft, Number(draft?.kind || NG.NODE_CODE))
    );
    const suggestedName = String(initialName || normalized.name || "").trim();

    const form = document.createElement("form");
    form.innerHTML = `
      <p>Save this node setup as a reusable template.</p>
      <label>
        Template name
        <input type="text" name="template-name" placeholder="Enter template name" value="${escapeAttribute(suggestedName)}" required>
      </label>
      <footer>
        <button type="submit" class="accent">Save template</button>
      </footer>
    `;

    const popup = popupManager.showPopup({
      title: "Save node template",
      content: form,
      size: "small",
    });

    return new Promise((resolve) => {
      form.onsubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const name = String(formData.get("template-name") || "").trim();
        if (!name) return;
        try {
          await this.saveNodeTemplateByName(name, normalized);
          popup.close();
          resolve({ saved: true, name });
        } catch (error) {
          toast.error(`Failed to save template: ${String(error?.message || error)}`);
        }
      };
    });
  }

  showSaveGraphPopup() {
    const popupManager = this.closest("popup-manager") || document.querySelector("popup-manager");
    if (!popupManager) return;

    const form = document.createElement("form");
    const suggestedName = this._getSuggestedSaveGraphName();
    form.innerHTML = `
      <p>Save current node graph.</p>
      <label>
        Graph name
        <input type="text" name="graph-name" placeholder="Enter graph name" value="${escapeAttribute(suggestedName)}" required autofocus>
      </label>
      <footer>
        <button type="submit" class="accent">Save</button>
      </footer>
    `;

    const popup = popupManager.showPopup({
      title: "Save node graph",
      content: form,
      size: "small",
    });

    const nameInput = form.querySelector('input[name="graph-name"]');
    if (nameInput) {
      requestAnimationFrame(() => {
        nameInput.focus();
        nameInput.select();
      });
    }

    form.onsubmit = async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const name = String(formData.get("graph-name") || "").trim();
      if (!name) return;
      try {
        await this.saveGraphByName(name);
        toast.success(`Saved graph \"${name}\".`);
        popup.close();
      } catch (error) {
        toast.error(`Failed to save graph: ${String(error?.message || error)}`);
      }
    };
  }

  async showLoadGraphPopup() {
    const popupManager = this.closest("popup-manager") || document.querySelector("popup-manager");
    if (!popupManager) {
      toast.error("Popup manager is not available.");
      return;
    }

    try {
      const selection = await ViewSqlTable.choose({
        title: "Load node graph",
        confirmLabel: "Load",
        returnColumn: "name",
        query: "SELECT rowid AS id, name, node_count FROM nodegraph2_storage ORDER BY name LIMIT :limit OFFSET :offset",
        countQuery: "SELECT COUNT(*) FROM nodegraph2_storage",
        pageSize: 20,
        columnTypes: {
          id: "number",
          node_count: "number",
        },
      });

      const name = String(selection?.value || "").trim();
      if (!name) return;

      const err = await this.loadGraphByName(name);
      if (err !== 0) {
        toast.error(`Failed to load graph \"${name}\" (code ${err}).`);
        return;
      }

      toast.success(`Loaded graph \"${name}\".`);
    } catch (error) {
      toast.error(`Failed to load graph: ${String(error?.message || error)}`);
    }
  }

  async showEditNodePopup(forcedNodeId = null) {
    const popupManager = this.closest("popup-manager") || document.querySelector("popup-manager");
    if (!popupManager) {
      toast.error("Popup manager is not available.");
      return;
    }

    const selected = this.getSelectedNodeIds();
    const nodeId = forcedNodeId ?? (selected.length ? Number(selected[0]) : null);
    if (!nodeId) {
      return;
    }

    const snapshot = this.getGraphSnapshot();
    const node = snapshot.nodes.find((item) => item.id === nodeId);
    if (!node) {
      toast.error(`Node #${nodeId} is no longer available.`);
      return;
    }

    const kindName = this._getNodeKindLabel(node.kind);
    const nameValue = this.nodeNames.get(nodeId) || "";
    const nodeTitle = `${kindName} #${nodeId}`;

    if (node.kind === NG.NODE_CODE) {
      await this._hydrateCodeNode(nodeId, { allowEmptyOnReadFailure: true });
    }

    let codePathValue = this._getCodePath(nodeId);
    let codeValue = String(this.sourceByNode.get(nodeId) || "");
    let codeReadOnly = !codePathValue || this._getCodeReadOnly(nodeId);
    let codeStatus = this._getCodeStatus(nodeId);
    let graphEntries = [];
    try {
      graphEntries = await this._listSavedGraphs();
    } catch (error) {
      toast.error(`Failed to load graphs: ${String(error?.message || error)}`);
    }
    let graphIdValue = this._getGraphIdForNode(nodeId) || Number(node?.graphId || 0);
    let graphNameValue = this._getGraphNameForNode(nodeId) || String(node?.graphName || "").trim();
    if (!graphIdValue && graphNameValue) {
      graphIdValue = await this._resolveGraphIdByName(graphNameValue);
    }
    let graphSummary = node.kind === NG.NODE_CALL
      ? await this._loadImportNodeBoundarySummary(graphIdValue)
      : { inputs: [], outputs: [] };

    const form = document.createElement("form");
    const renderForm = (
      currentNode,
      currentName,
      {
        newInputName = "",
        newOutputName = "",
        newOutputValue = "",
        code = null,
        codePath = codePathValue,
        codeEditorReadOnly = codeReadOnly,
        codeMessage = codeStatus,
        graphName = graphNameValue,
        graphId = graphIdValue,
        graphSummary: summary = graphSummary,
      } = {}
    ) => {
      const isCodeNode = currentNode.kind === NG.NODE_CODE;
      const isValueNode = currentNode.kind === NG.NODE_VALUE;
      const isImportNode = currentNode.kind === NG.NODE_CALL;
      form.innerHTML = `
       <p>Edit node settings.</p>
       <label>
         Type
         <select name="node-kind" disabled>
           ${this._renderNodeTypeOptions(currentNode.kind)}
         </select>
       </label>
        <label>
          Node name
          <input type="text" name="name" placeholder="Enter node name" value="${escapeAttribute(currentName)}">
        </label>
        ${isImportNode ? `
        <fieldset>
          <legend>Imported graph</legend>
              <label>
                Graph
                <select name="graph-name">
              <option value="" ${!graphId ? "selected" : ""}>choose graph</option>
              ${(graphEntries.length ? graphEntries : [{ id: graphId || 0, name: graphName || "", nodeCount: 0 }]).map((entry) => `<option value="${Number(entry.id || 0)}" ${Number(entry.id || 0) === Number(graphId || 0) ? "selected" : ""}>${escapeAttribute(entry.name)}${entry.nodeCount ? ` (${Number(entry.nodeCount || 0)} node${Number(entry.nodeCount || 0) === 1 ? "" : "s"})` : ""}</option>`).join("")}
                </select>
              </label>
          ${this._renderImportBoundarySummary(summary)}
        </fieldset>` : ""}
          ${isCodeNode ? this._renderCodeSourceFields({
        codePath,
        code: code === null || code === undefined ? codeValue : String(code),
        readOnly: codeEditorReadOnly,
        status: codeMessage,
      }) : ""}
        ${this._nodeSupportsInputs(currentNode.kind) && !isImportNode ? `
        <fieldset>
          <legend>Inputs</legend>
         <ul>
           ${currentNode.inputs.map((port, index) => `
           <li>
             <input type="hidden" name="input-port-id" value="${Number(port.inputId || index + 1)}">
             <input type="text" name="input-port-name" value="${escapeAttribute(this._getPortEditorDefaultLabel(currentNode.id, "input", Number(port.inputId || index + 1), index))}" placeholder="Input ${index + 1}">
             <button type="submit" name="remove-input-id" value="${Number(port.inputId || index + 1)}" aria-label="Delete input ${index + 1}" title="Delete input"><i aria-hidden="true">delete</i></button>
           </li>`).join("")}
           <li>
               <input type="text" name="new-input-name" value="${escapeAttribute(newInputName)}" placeholder="Input name">
             <button type="submit" name="intent" value="add-input" aria-label="Add input" title="Add input" ${String(newInputName).trim() ? "" : "disabled"}><i aria-hidden="true">add</i></button>
           </li>
         </ul>
       </fieldset>` : ""}
        ${this._nodeSupportsOutputs(currentNode.kind) && !isImportNode ? `
        <fieldset>
          <legend>Outputs</legend>
          <ul>

            ${currentNode.outputs.map((port, index) => `
            <li>
              <input type="hidden" name="output-port-id" value="${Number(port.outputId || index + 1)}">
              ${isValueNode
          ? `<input type="text" name="output-port-value" value="${escapeAttribute(this._getStoredNodeValue(currentNode.id, Number(port.outputId || index + 1)))}" placeholder="Value ${index + 1}">`
          : `<input type="text" name="output-port-name" value="${escapeAttribute(this._getPortEditorDefaultLabel(currentNode.id, "output", Number(port.outputId || index + 1), index))}" placeholder="Output ${index + 1}">`}
              <button type="submit" name="remove-output-id" value="${Number(port.outputId || index + 1)}" aria-label="Delete output ${index + 1}" title="Delete output"><i aria-hidden="true">delete</i></button>
            </li>`).join("")}
            <li> 
              ${isValueNode
            ? `<input type="text" name="new-output-value" value="${escapeAttribute(newOutputValue)}" placeholder="Value">`
            : `<input type="text" name="new-output-name" value="${escapeAttribute(newOutputName)}" placeholder="Output name">`}
              <button type="submit" name="intent" value="add-output" aria-label="Add output" title="Add output"><i aria-hidden="true">add</i></button>
            </li>
          </ul>
        </fieldset>` : ""}
       <footer>
         <button type="submit" name="intent" value="save-name" class="accent">Save</button>
         <button type="submit" name="intent" value="save-template">Save as template</button>
        </footer>
     `;

      const newInput = form.querySelector('[name="new-input-name"]');
      const addInput = form.querySelector('[name="intent"][value="add-input"]');
      if (newInput && addInput) {
        const sync = () => {
          addInput.disabled = !String(newInput.value || "").trim();
        };
        sync();
        newInput.addEventListener("input", sync);
      }

      const addOutput = form.querySelector('[name="intent"][value="add-output"]');
      if (addOutput) addOutput.disabled = false;

      const graphSelect = form.querySelector('[name="graph-name"]');
      if (graphSelect && currentNode.kind === NG.NODE_CALL) {
        graphSelect.onchange = async () => {
          graphIdValue = Number(graphSelect.value || 0);
          const selectedGraph = await this._readSavedGraphById(graphIdValue);
          graphNameValue = String(selectedGraph?.name || "").trim();
          graphSummary = this._buildImportBoundarySummary(selectedGraph?.nodes || []);
          renderForm(currentNode, currentName, {
            newInputName,
            newOutputName,
            newOutputValue,
            code,
            codePath,
            codeEditorReadOnly,
            codeMessage,
            graphName: graphNameValue,
            graphId: graphIdValue,
            graphSummary,
          });
        };
      }
    };

    renderForm(node, nameValue);

    const popup = popupManager.showPopup({
      title: nodeTitle,
      content: form,
      size: "medium",
    });

    form.onsubmit = async (event) => {
      event.preventDefault();

      const form = event.target;
      const formData = new FormData(form, event.submitter);
      const intent = formData.has("remove-input-id")
        ? `remove-input:${String(formData.get("remove-input-id") || "")}`
        : formData.has("remove-output-id")
          ? `remove-output:${String(formData.get("remove-output-id") || "")}`
          : String(formData.get("intent") || "save-name");

      const current = this.getGraphSnapshot().nodes.find((item) => item.id === nodeId);
      if (!current) {
        toast.error(`Node #${nodeId} is no longer available.`);
        popup.close();
        return;
      }

      const pendingCode = current.kind === NG.NODE_CODE ? String(formData.get("code") || "") : null;
      const pendingCodePath = current.kind === NG.NODE_CODE ? String(formData.get("code-path") || "").trim() : "";

      if (intent === "choose-code-file") {
        const selectedPath = await this._chooseCodeFile({ title: `Choose code file for ${nodeTitle}` });
        if (selectedPath) {
          try {
            codeValue = await this._readCodeFile(selectedPath);
            codePathValue = selectedPath;
            codeReadOnly = false;
            codeStatus = "";
          } catch (error) {
            codePathValue = pendingCodePath || this._getCodePath(nodeId);
            codeReadOnly = !codePathValue || this._getCodeReadOnly(nodeId);
            codeStatus = String(error?.message || error);
          }
        }
        renderForm(current, String(formData.get("name") || ""), {
          newInputName: String(formData.get("new-input-name") || "").trim(),
          newOutputName: String(formData.get("new-output-name") || "").trim(),
          newOutputValue: String(formData.get("new-output-value") || ""),
          code: codeValue,
          codePath: codePathValue,
          codeEditorReadOnly: codeReadOnly,
          codeMessage: codeStatus,
        });
        return;
      }

      if (intent === "save-code-file") {
        const savePath = await this._chooseCodeSavePath(this._getDefaultCodeFilename(String(formData.get("name") || nodeTitle)));
        if (savePath) {
          codePathValue = savePath;
          codeValue = pendingCode ?? codeValue;
          try {
            await this._writeCodeFile(savePath, codeValue);
            codeReadOnly = false;
            codeStatus = "";
          } catch (error) {
            codeReadOnly = true;
            codeStatus = String(error?.message || error);
          }
        }
        renderForm(current, String(formData.get("name") || ""), {
          newInputName: String(formData.get("new-input-name") || "").trim(),
          newOutputName: String(formData.get("new-output-name") || "").trim(),
          newOutputValue: String(formData.get("new-output-value") || ""),
          code: codeValue,
          codePath: codePathValue,
          codeEditorReadOnly: codeReadOnly,
          codeMessage: codeStatus,
        });
        return;
      }

      if (intent === "reload-code-file") {
        codePathValue = pendingCodePath || codePathValue;
        if (!codePathValue) {
          codeStatus = "Choose a code file first.";
        } else {
          try {
            codeValue = await this._readCodeFile(codePathValue);
            codeStatus = "";
          } catch (error) {
            codeStatus = String(error?.message || error);
          }
        }
        renderForm(current, String(formData.get("name") || ""), {
          newInputName: String(formData.get("new-input-name") || "").trim(),
          newOutputName: String(formData.get("new-output-name") || "").trim(),
          newOutputValue: String(formData.get("new-output-value") || ""),
          code: codeValue,
          codePath: codePathValue,
          codeEditorReadOnly: codeReadOnly,
          codeMessage: codeStatus,
        });
        return;
      }

      if (intent === "save-template") {
        const draft = this._createNodeDraft(current.kind);
        this._captureNodeDraftFromForm(draft, form);
        draft.kind = current.kind;
        draft.codePath = pendingCodePath || codePathValue;
        draft.code = pendingCode ?? codeValue;
        draft.codeReadOnly = codeReadOnly;
        draft.codeStatus = codeStatus;
        if (current.kind === NG.NODE_CALL) {
          draft.graphId = Number(formData.get("graph-name") || graphIdValue || 0);
          const selectedGraph = await this._readSavedGraphById(draft.graphId);
          draft.graphName = String(selectedGraph?.name || graphNameValue || "").trim();
          draft.inputs = (graphSummary.inputs || []).map((entry, index) => ({
            inputId: Number(entry?.importPortId || index + 1),
            name: String(entry?.name || "").trim(),
            value: String(entry?.value || ""),
          }));
          draft.outputs = (graphSummary.outputs || []).map((entry, index) => ({
            outputId: Number(entry?.importPortId || index + 1),
            name: String(entry?.name || "").trim(),
            value: "",
          }));
        }
        try {
          const result = await this.showSaveNodeTemplatePopup({
            draft,
            initialName: draft.name || `${this._getNodeKindLabel(current.kind)}-${nodeId}`,
          });
          if (result?.saved && result?.name) {
            toast.success(`Saved template "${result.name}".`);
          }
        } catch (error) {
          toast.error(`Failed to save template: ${String(error?.message || error)}`);
        }
        return;
      }

      if (intent === "save-name") {
        const rawName = formData.get("name");
        this.nodeNames.set(nodeId, String(rawName || "").trim());
        if (current.kind === NG.NODE_CALL) {
          const selectedGraphId = Number(formData.get("graph-name") || graphIdValue || 0);
          if (!Number.isFinite(selectedGraphId) || selectedGraphId <= 0) {
            toast.warning("Choose a graph to import.");
            renderForm(current, String(rawName || ""), {
              newInputName: String(formData.get("new-input-name") || "").trim(),
              newOutputName: String(formData.get("new-output-name") || "").trim(),
              newOutputValue: String(formData.get("new-output-value") || ""),
              graphName: graphNameValue,
              graphId: graphIdValue,
              graphSummary,
            });
            return;
          }
          const selectedGraph = await this._readSavedGraphById(selectedGraphId);
          if (!selectedGraph) {
            toast.warning("Selected graph is no longer available.");
            return;
          }
          graphIdValue = selectedGraph.id;
          graphNameValue = selectedGraph.name;
          graphSummary = this._buildImportBoundarySummary(selectedGraph.nodes || []);
          const rebuildErr = this._rebuildImportNodePorts(nodeId, graphSummary);
          if (rebuildErr !== 0) {
            toast.error(`Failed to rebuild import-node ports (code ${rebuildErr}).`);
            return;
          }
          this._setGraphIdForNode(nodeId, selectedGraph.id);
          this._setGraphNameForNode(nodeId, selectedGraph.name);
          const argErr = this._setImportGraphArg(nodeId, selectedGraph.id);
          if (argErr !== 0) {
            toast.error(`Failed to set import graph id (code ${argErr}).`);
            return;
          }
          this._setImportDefaultsForNode(nodeId, (graphSummary.inputs || []).map((entry) => ({ portId: Number(entry?.importPortId || 0), value: String(entry?.value || "") })));
          const labels = { inputs: {}, outputs: {} };
          (graphSummary.inputs || []).forEach((entry, index) => {
            const label = String(entry?.name || `input ${index + 1}`).trim();
            labels.inputs[String(Number(entry?.importPortId || index + 1))] = label;
          });
          (graphSummary.outputs || []).forEach((entry, index) => {
            const label = String(entry?.name || `output ${index + 1}`).trim();
            labels.outputs[String(Number(entry?.importPortId || index + 1))] = label;
          });
          if (!(this.portLabels instanceof Map)) this.portLabels = new Map();
          this.portLabels.set(nodeId, labels);
        } else {
          this._savePortNamesFromForm(nodeId, formData, current.kind);
        }
        if (current.kind === NG.NODE_VALUE) {
          this._saveOutputValuesFromForm(nodeId, formData);
        }
        if (current.kind === NG.NODE_CODE) {
          codeValue = pendingCode ?? codeValue;
          codePathValue = pendingCodePath || codePathValue;
          if (!codePathValue) {
            codeReadOnly = true;
            codeStatus = "Choose a code file to enable editing.";
            toast.error("Code node requires a code file.");
            renderForm(current, String(rawName || ""), {
              newInputName: String(formData.get("new-input-name") || "").trim(),
              newOutputName: String(formData.get("new-output-name") || "").trim(),
              newOutputValue: String(formData.get("new-output-value") || ""),
              code: codeValue,
              codePath: codePathValue,
              codeEditorReadOnly: codeReadOnly,
              codeMessage: codeStatus,
            });
            return;
          }
          try {
            await this._writeCodeFile(codePathValue, codeValue);
            this._setCodePath(nodeId, codePathValue);
            this._setCodeReadOnly(nodeId, false);
            this._setCodeStatus(nodeId, "");
            codeReadOnly = false;
            codeStatus = "";
          } catch (error) {
            codeReadOnly = true;
            codeStatus = String(error?.message || error);
            this._setCodeReadOnly(nodeId, true);
            this._setCodeStatus(nodeId, codeStatus);
            toast.error(`Failed to save code file: ${codeStatus}`);
            renderForm(current, String(rawName || ""), {
              newInputName: String(formData.get("new-input-name") || "").trim(),
              newOutputName: String(formData.get("new-output-name") || "").trim(),
              newOutputValue: String(formData.get("new-output-value") || ""),
              code: codeValue,
              codePath: codePathValue,
              codeEditorReadOnly: codeReadOnly,
              codeMessage: codeStatus,
            });
            return;
          }
          this.sourceByNode.set(nodeId, codeValue);
          if (this.api?.ng_exec_clear) {
            this.api.ng_exec_clear(nodeId, 1);
          }
        }
        this._refreshNodeFrame(nodeId);
        this.requestRenderIfGenerationChanged(true);
        toast.success(`Saved settings for ${nodeTitle}.`);
        popup.close();
        return;
      }

      this._savePortNamesFromForm(nodeId, formData, current.kind);
      if (current.kind === NG.NODE_VALUE) {
        this._saveOutputValuesFromForm(nodeId, formData);
      }
      const changed = this._applyPortEditIntent(current, intent, {
        newInputName: String(formData.get("new-input-name") || "").trim(),
        newOutputName: String(formData.get("new-output-name") || "").trim(),
        newOutputValue: String(formData.get("new-output-value") || ""),
      });
      if (changed) {
        this._refreshNodeFrame(nodeId);
        this.requestRenderIfGenerationChanged(true);
        const refreshed = this.getGraphSnapshot().nodes.find((item) => item.id === nodeId);
        if (!refreshed) {
          popup.close();
          return;
        }
        renderForm(refreshed, String(formData.get("name") || this.nodeNames.get(nodeId) || "").trim(), {
          newInputName: intent === "add-input" ? "" : String(formData.get("new-input-name") || ""),
          newOutputName: intent === "add-output" ? "" : String(formData.get("new-output-name") || ""),
          newOutputValue: intent === "add-output" ? "" : String(formData.get("new-output-value") || ""),
          code: pendingCode,
          codePath: pendingCodePath || codePathValue,
          codeEditorReadOnly: codeReadOnly,
          codeMessage: codeStatus,
        });
      }
    };
  }

  _getNodeKindLabel(kind) {
    if (kind === NG.NODE_CODE) return "node-code";
    if (kind === NG.NODE_GOAL) return "node-goal";
    if (kind === NG.NODE_VALUE) return "node-value"
    if (kind === NG.NODE_CALL) return "import-node";
    return "node";
  }

  _nodeSupportsInputs(kind) {
    return kind === NG.NODE_CODE || kind === NG.NODE_GOAL || kind === NG.NODE_CALL;
  }

  _nodeSupportsOutputs(kind) {
    return kind === NG.NODE_CODE || kind === NG.NODE_VALUE || kind === NG.NODE_CALL;
  }

  _getPortEditorDefaultLabel(nodeId, direction, portId, index) {
    const stored = this._getStoredPortLabel(nodeId, direction, portId);
    if (stored) return stored;
    return `${direction === "input" ? "input" : "output"} ${index + 1}`;
  }

  _nextInputId(node) {
    let maxId = 0;
    for (const port of node.inputs || []) {
      maxId = Math.max(maxId, Number(port.inputId || 0));
    }
    return maxId + 1;
  }

  _nextOutputId(node) {
    let maxId = 0;
    for (const port of node.outputs || []) {
      maxId = Math.max(maxId, Number(port.outputId || 0));
    }
    return maxId + 1;
  }

  _applyPortEditIntent(node, intent, options = {}) {
    if (!this.api) return false;

    if (node.kind === NG.NODE_CALL) {
      toast.info("Import node ports are read-only and come from the referenced graph.");
      return false;
    }

    if (intent === "add-input") {
      if (!this._nodeSupportsInputs(node.kind)) {
        toast.warning("This node type cannot have inputs.");
        return false;
      }
      const inputName = String(options.newInputName || "").trim();
      if (!inputName) {
        toast.warning("Enter a name before adding an input.");
        return false;
      }
      const inputId = this._nextInputId(node);
      const err = this.api.ng_input_add(node.id, inputId);
      if (err !== 0) {
        toast.error(`Failed to add input on node #${node.id} (code ${err}).`);
        return false;
      }
      this._setStoredPortLabel(node.id, "input", inputId, inputName);
      toast.success(`Added input ${inputId} to node #${node.id}.`);
      return true;
    }

    if (intent.startsWith("remove-input:")) {
      if (!this._nodeSupportsInputs(node.kind)) {
        toast.warning("This node type cannot have inputs.");
        return false;
      }
      if (!node.inputCount) {
        toast.info("This node has no inputs to remove.");
        return false;
      }
      const rawId = intent.split(":")[1];
      const inputId = Number(rawId);
      if (!Number.isFinite(inputId)) {
        toast.error("Invalid input id.");
        return false;
      }
      this._applyInputDisconnect(node.id, inputId);
      const err = this.api.ng_input_remove(node.id, inputId);
      if (err !== 0) {
        toast.error(`Failed to remove input ${inputId} from node #${node.id} (code ${err}).`);
        return false;
      }
      this._deleteStoredPortLabel(node.id, "input", inputId);
      toast.success(`Removed input ${inputId} from node #${node.id}.`);
      return true;
    }

    if (intent === "add-output") {
      if (!this._nodeSupportsOutputs(node.kind)) {
        toast.warning("This node type cannot have outputs.");
        return false;
      }
      const outputName = String(options.newOutputName || "").trim();
      if (node.kind !== NG.NODE_VALUE && !outputName) {
        toast.warning("Enter a name before adding an output.");
        return false;
      }
      const outputId = this._nextOutputId(node);
      const err = this.api.ng_output_add(node.id, outputId);
      if (err !== 0) {
        toast.error(`Failed to add output on node #${node.id} (code ${err}).`);
        return false;
      }
      if (node.kind === NG.NODE_VALUE) {
        this._setStoredNodeValue(node.id, outputId, String(options.newOutputValue || ""));
      } else {
        this._setStoredPortLabel(node.id, "output", outputId, outputName);
      }
      toast.success(`Added output ${outputId} to node #${node.id}.`);
      return true;
    }

    if (intent.startsWith("remove-output:")) {
      if (!this._nodeSupportsOutputs(node.kind)) {
        toast.warning("This node type cannot have outputs.");
        return false;
      }
      if (!node.outputCount) {
        toast.info("This node has no outputs to remove.");
        return false;
      }
      const rawId = intent.split(":")[1];
      const outputId = Number(rawId);
      if (!Number.isFinite(outputId)) {
        toast.error("Invalid output id.");
        return false;
      }
      const err = this.api.ng_output_remove(node.id, outputId);
      if (err !== 0) {
        toast.error(`Failed to remove output ${outputId} from node #${node.id} (code ${err}).`);
        return false;
      }
      this._deleteStoredPortLabel(node.id, "output", outputId);
      if (node.kind === NG.NODE_VALUE) {
        this._deleteStoredNodeValue(node.id, outputId);
      }
      toast.success(`Removed output ${outputId} from node #${node.id}.`);
      return true;
    }

    return false;
  }

  _getStoredPortLabel(nodeId, direction, portId) {
    const labels = this._getNodePortLabels(nodeId);
    const dict = labels ? labels[direction === "input" ? "inputs" : "outputs"] : null;
    const key = String(portId);
    if (dict && typeof dict === "object") {
      if (dict[key] !== undefined) return String(dict[key]);
      if (dict[portId] !== undefined) return String(dict[portId]);
    }
    return "";
  }

  _setStoredPortLabel(nodeId, direction, portId, label) {
    if (!(this.portLabels instanceof Map)) {
      this.portLabels = new Map();
    }

    const existing = this.portLabels.get(nodeId) || { inputs: {}, outputs: {} };
    const key = direction === "input" ? "inputs" : "outputs";
    existing[key][String(portId)] = String(label || "").trim();
    this.portLabels.set(nodeId, existing);
  }

  _deleteStoredPortLabel(nodeId, direction, portId) {
    if (!(this.portLabels instanceof Map)) return;
    const existing = this.portLabels.get(nodeId);
    if (!existing) return;
    const key = direction === "input" ? "inputs" : "outputs";
    if (existing[key]) {
      delete existing[key][String(portId)];
    }
    this.portLabels.set(nodeId, existing);
  }

  _savePortNamesFromForm(nodeId, formData, nodeKind = null) {
    const inputIds = formData.getAll("input-port-id");
    const inputNames = formData.getAll("input-port-name");
    const outputIds = formData.getAll("output-port-id");
    const outputNames = formData.getAll("output-port-name");

    const labels = { inputs: {}, outputs: {} };

    for (let i = 0; i < inputIds.length; i++) {
      const id = Number(inputIds[i]);
      const name = String(inputNames[i] || "").trim();
      if (!Number.isFinite(id) || !name) continue;
      labels.inputs[String(id)] = name;
    }

    if (nodeKind !== NG.NODE_VALUE) {
      for (let i = 0; i < outputIds.length; i++) {
        const id = Number(outputIds[i]);
        const name = String(outputNames[i] || "").trim();
        if (!Number.isFinite(id) || !name) continue;
        labels.outputs[String(id)] = name;
      }
    }

    if (!(this.portLabels instanceof Map)) {
      this.portLabels = new Map();
    }
    this.portLabels.set(nodeId, labels);
  }

  _getNodeValueBucket(nodeId) {
    if (!(this.valueByNode instanceof Map)) {
      this.valueByNode = new Map();
    }
    let bucket = this.valueByNode.get(nodeId);
    if (!(bucket instanceof Map)) {
      bucket = new Map();
      this.valueByNode.set(nodeId, bucket);
    }
    return bucket;
  }

  _getStoredNodeValue(nodeId, outputId) {
    if (!(this.valueByNode instanceof Map)) return "";
    const bucket = this.valueByNode.get(nodeId);
    if (!(bucket instanceof Map)) return "";
    const val = bucket.get(Number(outputId));
    return val === undefined || val === null ? "" : String(val);
  }

  _setStoredNodeValue(nodeId, outputId, value) {
    const bucket = this._getNodeValueBucket(nodeId);
    bucket.set(Number(outputId), String(value ?? ""));
  }

  _deleteStoredNodeValue(nodeId, outputId) {
    if (!(this.valueByNode instanceof Map)) return;
    const bucket = this.valueByNode.get(nodeId);
    if (!(bucket instanceof Map)) return;
    bucket.delete(Number(outputId));
  }

  _saveOutputValuesFromForm(nodeId, formData) {
    const outputIds = formData.getAll("output-port-id");
    const outputValues = formData.getAll("output-port-value");
    const bucket = new Map();
    for (let i = 0; i < outputIds.length; i++) {
      const outputId = Number(outputIds[i]);
      if (!Number.isFinite(outputId)) continue;
      bucket.set(outputId, String(outputValues[i] || ""));
    }
    if (!(this.valueByNode instanceof Map)) {
      this.valueByNode = new Map();
    }
    this.valueByNode.set(nodeId, bucket);
  }

  async fetchData() {
    this.data = this.getGraphSnapshot();
    this.contentBounds = this.calculateContentBounds(this.data);
    return this.data;
  }

  calculateContentBounds(data, posById = null) {
    const nodes = data?.nodes || [];
    if (!nodes.length) return { minX: 0, minY: 0, maxX: 1200, maxY: 800 };

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const pos = posById?.get(node.id) || this.nodeLayout.get(node.id) || this._ensureLayout(node.id, i);
      const size = this._getNodeSize(node);
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + size.width);
      maxY = Math.max(maxY, pos.y + size.height);
    }

    return { minX, minY, maxX, maxY }
  }

  fitToContent() {
    if (!this.canvas || this.canvas.width <= 0 || this.canvas.height <= 0) return false;
    if (!this.api || !this.memory || !this.assets) return false;
    if (!this._ensureDataView()) return false;

    this._resizeCanvas();
    const graph = this._readGraph();
    if (!graph.nodes.length) return false;

    const posById = new Map();
    graph.nodes.forEach((node, i) => {
      posById.set(node.id, this._ensureLayout(node.id, i));
    });

    const bounds = this.calculateContentBounds(graph, posById);
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    if (contentWidth <= 0 || contentHeight <= 0) return false;

    const targetWidth = Math.max(1, this.canvas.width);
    const targetHeight = Math.max(1, this.canvas.height);
    const scaleX = targetWidth / contentWidth;
    const scaleY = targetHeight / contentHeight;
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)));

    const contentCenterX = (bounds.minX + bounds.maxX) * 0.5;
    const contentCenterY = (bounds.minY + bounds.maxY) * 0.5;
    this.offsetX = this.canvas.width * 0.5 - contentCenterX * this.scale;
    this.offsetY = this.canvas.height * 0.5 - contentCenterY * this.scale;

    this.contentBounds = bounds;
    if (typeof this._constrainPosition === "function") {
      this._constrainPosition();
    }
    this.requestRenderIfGenerationChanged(true);
    return true;
  }

  drawContent() {
    // WebGL rendering is handled in draw().
  }

  getSelectQuery() {
    throw new Error("Subclass must implement getSelectQuery()");
  }

  getInsertQueryFn() {
    throw new Error("Subclass must implement getInsertQueryFn()");
  }

  draw = () => {
    this.requestRenderIfGenerationChanged(true);
    this._tryAutoFit();
  }

  onCanvasMouseDown(e) {
    this._onPointerDown(e);
  }

  onCanvasMouseMove(e) {
    this._onPointerMove(e);
  }

  onCanvasMouseUp(e) {
    this._onPointerUp(e);
  }

  _ensureDataView() {
    if (!this.memory) return false;
    if (!this.dv || this.dv.buffer !== this.memory.buffer) {
      this.dv = new DataView(this.memory.buffer);
    }
    return true;
  }

  requestRenderIfGenerationChanged(force = false) {
    if (!this.gl || !this.api || !this.memory || !this.assets) return;
    if (!this._ensureDataView()) return;
    const generation = this.dv.getUint32(this.api.ng_get_info_ptr() + INFO.GENERATION, true);
    const sizeKey = this._resizeCanvas();
    if (!force && generation === this.lastGeneration && sizeKey === this.lastSizeKey) return;
    if (force || generation !== this.lastGeneration) {
      this._refreshAllNodeFrames();
    }
    this.lastGeneration = generation;
    this.lastSizeKey = sizeKey;
    this._render();
  }

  _resizeCanvas() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const w = Math.max(1, Math.floor(this.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return `${w}x${h}`;
  }

  _onWheel(e) {
    if (!this.gl) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width));
    const y = (e.clientY - rect.top) * (this.canvas.height / Math.max(1, rect.height));

    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this._zoomAt(x, y, factor);
    } else {
      this.offsetX -= e.deltaX;
      this.offsetY -= e.deltaY;
      this.requestRenderIfGenerationChanged(true);
    }
  }

  _onPointerDown(e) {
    if (!this.gl) return;

    const world = this._worldFromClientPoint(e.clientX, e.clientY);
    const pick = this._pickFromClientPoint(e.clientX, e.clientY);
    this.hoverPick = pick;
    const multi = e.ctrlKey || e.metaKey;
    const marquee = e.shiftKey;

    if (marquee && pick?.kind !== "port" && pick?.kind !== "edge") {
      this._beginBoxSelection(world);
      if (Number.isFinite(e.pointerId)) this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = "crosshair";
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    if (pick?.kind === "port") {
      this._beginConnectionFromPort(pick);
      if (!this.connectionDrag) return;
      this.connectionDrag.moving = world;
      this._updateConnectionHoverTarget(world.x, world.y);
      if (Number.isFinite(e.pointerId)) this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = "crosshair";
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    if (pick?.kind === "edge") {
      this._beginReconnectFromEdge(pick);
      if (!this.connectionDrag) return;
      this.connectionDrag.moving = world;
      this._updateConnectionHoverTarget(world.x, world.y);
      if (Number.isFinite(e.pointerId)) this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = "crosshair";
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    if (!pick) {
      const hadSelection = this.selectedNodeIds.size > 0;
      if (!multi) this.selectedNodeIds.clear();
      if (hadSelection && !this.selectedNodeIds.size) this._emitSelectionChanged();
      this.isDragging = true;
      this.isPanning = true;
      this.isNodeDragging = false;
      this.dragStartX = e.clientX - this.offsetX;
      this.dragStartY = e.clientY - this.offsetY;
      if (Number.isFinite(e.pointerId)) this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = "grabbing";
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    if (pick.kind === "node") {
      const id = pick.nodeId;
      const before = this.getSelectedNodeIds().join(",");
      if (multi) {
        if (this.selectedNodeIds.has(id)) this.selectedNodeIds.delete(id);
        else this.selectedNodeIds.add(id);
      } else {
        const keepGroupSelection = this.selectedNodeIds.size > 1 && this.selectedNodeIds.has(id);
        if (!keepGroupSelection) {
          this.selectedNodeIds.clear();
          this.selectedNodeIds.add(id);
        }
      }
      const after = this.getSelectedNodeIds().join(",");
      if (before !== after) this._emitSelectionChanged();

      const dragTargets = this.selectedNodeIds.has(id) ? Array.from(this.selectedNodeIds) : [id];
      this.isDragging = true;
      this.isPanning = false;
      this.isNodeDragging = true;
      this.nodeDragStartWorld = world;
      this.nodeDragItems = dragTargets
        .map((nodeId) => {
          const pos = this.nodeLayout.get(nodeId);
          if (!pos) return null;
          return { nodeId, startX: pos.x, startY: pos.y };
        })
        .filter(Boolean);
      if (Number.isFinite(e.pointerId)) this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = "grabbing";
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    this.isDragging = false;
    this.isPanning = false;
    this.isNodeDragging = false;
    this.canvas.style.cursor = "crosshair";

    this.requestRenderIfGenerationChanged(true);
  }

  _onPointerMove(e) {
    if (this.connectionDrag) {
      const world = this._worldFromClientPoint(e.clientX, e.clientY);
      this.connectionDrag.moving = world;
      this._updateConnectionHoverTarget(world.x, world.y);
      this.canvas.style.cursor = "crosshair";
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    if (this.boxSelection) {
      const world = this._worldFromClientPoint(e.clientX, e.clientY);
      this.boxSelection.currentWorld = world;
      this.hoverPick = null;
      this._updateBoxSelectionPreview();
      this.canvas.style.cursor = "crosshair";
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    if (this.isDragging && this.isNodeDragging) {
      const world = this._worldFromClientPoint(e.clientX, e.clientY);
      const dx = world.x - this.nodeDragStartWorld.x;
      const dy = world.y - this.nodeDragStartWorld.y;
      for (const item of this.nodeDragItems) {
        const pos = this.nodeLayout.get(item.nodeId);
        if (!pos) continue;
        pos.x = Math.round(item.startX + dx);
        pos.y = Math.round(item.startY + dy);
      }
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    if (this.isDragging && this.isPanning) {
      this.offsetX = e.clientX - this.dragStartX;
      this.offsetY = e.clientY - this.dragStartY;
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    const pick = this._pickFromClientPoint(e.clientX, e.clientY);
    this.hoverPick = pick;
    this.canvas.style.cursor = pick ? "crosshair" : "default";
    this.requestRenderIfGenerationChanged(true);
  }

  _onPointerUp(e) {
    if (this.connectionDrag) {
      this._finishConnectionDrag();
      if (Number.isFinite(e.pointerId) && this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
      this.canvas.style.cursor = "default";
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    if (this.boxSelection) {
      const world = this._worldFromClientPoint(e.clientX, e.clientY);
      this.boxSelection.currentWorld = world;
      this._finishBoxSelection();
      if (Number.isFinite(e.pointerId) && this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
      const pick = this._pickFromClientPoint(e.clientX, e.clientY);
      this.hoverPick = pick;
      this.canvas.style.cursor = pick ? "crosshair" : "default";
      this.requestRenderIfGenerationChanged(true);
      return;
    }

    if (this.isDragging) {
      this.isDragging = false;
      this.isPanning = false;
      this.isNodeDragging = false;
      this.nodeDragItems = [];
      if (Number.isFinite(e.pointerId) && this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    }
    if (!this.isDragging) {
      const pick = this._pickFromClientPoint(e.clientX, e.clientY);
      this.hoverPick = pick;
      this.canvas.style.cursor = pick ? "crosshair" : "default";
      this.requestRenderIfGenerationChanged(true);
    }
  }

  _beginConnectionFromPort(portPick) {
    const nodesById = new Map((this.lastGraph?.nodes || []).map((node) => [node.id, node]));
    const node = nodesById.get(portPick.nodeId);
    const pos = this.lastPosById.get(portPick.nodeId);
    if (!node || !pos) return;

    const p = this._getPortCenter(node, pos, portPick.direction === "input", portPick.index);
    this.connectionDrag = {
      mode: portPick.direction === "output" ? "from-output" : "from-input",
      fixed: {
        nodeId: portPick.nodeId,
        direction: portPick.direction,
        index: portPick.index,
        portId: portPick.portId,
        x: p.x,
        y: p.y,
      },
      moving: { x: p.x, y: p.y },
      hoverTarget: null,
      validTarget: null,
      originalEdge: null,
    };

    if (portPick.direction === "input" && portPick.connected) {
      const existingEdge = (this.lastGraph?.edges || []).find(
        (edge) => edge.to === portPick.nodeId && edge.toInputId === portPick.portId
      );
      if (existingEdge) {
        this.connectionDrag.mode = "reconnect-input";
        this.connectionDrag.originalEdge = existingEdge;
        this.connectionDrag.fixed = {
          nodeId: existingEdge.from,
          direction: "output",
          index: this._getOutputIndex(nodesById.get(existingEdge.from), existingEdge.fromOutputId),
          portId: existingEdge.fromOutputId,
          x: this._getPortCenter(
            nodesById.get(existingEdge.from),
            this.lastPosById.get(existingEdge.from),
            false,
            this._getOutputIndex(nodesById.get(existingEdge.from), existingEdge.fromOutputId)
          ).x,
          y: this._getPortCenter(
            nodesById.get(existingEdge.from),
            this.lastPosById.get(existingEdge.from),
            false,
            this._getOutputIndex(nodesById.get(existingEdge.from), existingEdge.fromOutputId)
          ).y,
        };
      }
    }
  }

  _beginReconnectFromEdge(edgePick) {
    const edge = edgePick.edge;
    if (!edge) return;
    const nodesById = new Map((this.lastGraph?.nodes || []).map((node) => [node.id, node]));
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    const fromPos = this.lastPosById.get(edge.from);
    const toPos = this.lastPosById.get(edge.to);
    if (!fromNode || !toNode || !fromPos || !toPos) return;

    const fromIndex = this._getOutputIndex(fromNode, edge.fromOutputId);
    const toIndex = this._getInputIndex(toNode, edge.toInputId);
    const fromPort = this._getPortCenter(fromNode, fromPos, false, fromIndex);
    const toPort = this._getPortCenter(toNode, toPos, true, toIndex);

    if (edgePick.side === "output") {
      this.connectionDrag = {
        mode: "reconnect-output",
        fixed: {
          nodeId: edge.to,
          direction: "input",
          index: toIndex,
          portId: edge.toInputId,
          x: toPort.x,
          y: toPort.y,
        },
        moving: { x: fromPort.x, y: fromPort.y },
        hoverTarget: null,
        validTarget: null,
        originalEdge: edge,
      };
      return;
    }

    this.connectionDrag = {
      mode: "reconnect-input",
      fixed: {
        nodeId: edge.from,
        direction: "output",
        index: fromIndex,
        portId: edge.fromOutputId,
        x: fromPort.x,
        y: fromPort.y,
      },
      moving: { x: toPort.x, y: toPort.y },
      hoverTarget: null,
      validTarget: null,
      originalEdge: edge,
    };
  }

  _updateConnectionHoverTarget(worldX, worldY) {
    if (!this.connectionDrag || !this.lastGraph) return;
    const hit = this._hitTestPort(worldX, worldY, this.lastGraph.nodes, this.lastPosById);
    if (!hit) {
      this.connectionDrag.hoverTarget = null;
      this.connectionDrag.validTarget = null;
      this.hoverPick = null;
      return;
    }
    this.connectionDrag.hoverTarget = hit;
    this.connectionDrag.validTarget = this._validateConnectionTarget(this.connectionDrag, hit) ? hit : null;
    this.hoverPick = { kind: "port", ...hit };
  }

  _validateConnectionTarget(drag, target) {
    if (!drag || !target) return false;
    if (target.direction === drag.fixed.direction) return false;
    if (target.nodeId === drag.fixed.nodeId) return false;
    return true;
  }

  _applyInputDisconnect(nodeId, inputId) {
    if (!this.api?.ng_input_disconnect) return;
    const err = this.api.ng_input_disconnect(nodeId, inputId);
    if (err !== 0) {
      toast.warning(`Could not disconnect input ${inputId} on node #${nodeId} (code ${err}).`);
    }
  }

  _applyInputConnect(toNodeId, toInputId, fromNodeId, fromOutputId) {
    if (!this.api?.ng_input_connect) return;
    const err = this.api.ng_input_connect(toNodeId, toInputId, fromNodeId, fromOutputId);
    if (err !== 0) {
      toast.warning(`Could not connect ${fromNodeId}.${fromOutputId} -> ${toNodeId}.${toInputId} (code ${err}).`);
    }
  }

  _finishConnectionDrag() {
    const drag = this.connectionDrag;
    if (!drag) return;
    const target = drag.validTarget;
    const orig = drag.originalEdge;
    const isReconnect = drag.mode === "reconnect-input" || drag.mode === "reconnect-output";

    if (target) {
      const from = drag.fixed.direction === "output"
        ? drag.fixed
        : {
          nodeId: target.nodeId,
          portId: target.portId,
          direction: target.direction,
        };
      const to = drag.fixed.direction === "input"
        ? drag.fixed
        : {
          nodeId: target.nodeId,
          portId: target.portId,
          direction: target.direction,
        };

      const sameAsOriginal = Boolean(
        orig &&
        from.nodeId === orig.from &&
        from.portId === orig.fromOutputId &&
        to.nodeId === orig.to &&
        to.portId === orig.toInputId
      );

      if (isReconnect && orig && !sameAsOriginal) {
        this._applyInputDisconnect(orig.to, orig.toInputId);
      }

      if (!sameAsOriginal) {
        this._applyInputConnect(to.nodeId, to.portId, from.nodeId, from.portId);
      }
    } else if (isReconnect && orig) {
      this._applyInputDisconnect(orig.to, orig.toInputId);
    }

    this.connectionDrag = null;
  }

  _canvasPxFromClientPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width)),
      y: (clientY - rect.top) * (this.canvas.height / Math.max(1, rect.height)),
    };
  }

  _worldFromClientPoint(clientX, clientY) {
    const px = this._canvasPxFromClientPoint(clientX, clientY);
    return this._screenToWorld(px.x, px.y);
  }

  _screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale,
    };
  }

  _pickFromClientPoint(clientX, clientY) {
    if (!this.lastGraph || !this.lastPosById?.size) return null;
    const px = this._canvasPxFromClientPoint(clientX, clientY);
    const x = px.x;
    const y = px.y;
    const world = this._screenToWorld(x, y);

    const portHit = this._hitTestPort(world.x, world.y, this.lastGraph.nodes, this.lastPosById);
    if (portHit) return { kind: "port", ...portHit };

    const nodeHit = this._hitTestNode(world.x, world.y, this.lastGraph.nodes, this.lastPosById);
    if (nodeHit) return { kind: "node", ...nodeHit };

    const edgeHit = this._hitTestEdge(world.x, world.y, this.lastGraph.nodes, this.lastGraph.edges, this.lastPosById);
    if (edgeHit) return { kind: "edge", ...edgeHit };

    return null;
  }

  _beginBoxSelection(world) {
    this.isDragging = false;
    this.isPanning = false;
    this.isNodeDragging = false;
    this.nodeDragItems = [];
    this.hoverPick = null;
    this.boxSelection = {
      anchorWorld: { x: world.x, y: world.y },
      currentWorld: { x: world.x, y: world.y },
      baseSelection: new Set(this.selectedNodeIds),
      startSelectionKey: this._getSelectionKey(this.selectedNodeIds),
    };
    this._updateBoxSelectionPreview();
  }

  _finishBoxSelection() {
    if (!this.boxSelection) return;
    this._updateBoxSelectionPreview();
    const selectionChanged = this.boxSelection.startSelectionKey !== this._getSelectionKey(this.selectedNodeIds);
    this.boxSelection = null;
    if (selectionChanged) {
      this._emitSelectionChanged();
    }
  }

  _updateBoxSelectionPreview() {
    if (!this.boxSelection) return;
    const graph = this.lastGraph || this.getGraphSnapshot();
    const posById = this.lastPosById?.size ? this.lastPosById : new Map();
    const rect = this._getNormalizedWorldRect(this.boxSelection.anchorWorld, this.boxSelection.currentWorld);
    const hitIds = this._collectNodeIdsInWorldRect(rect, graph.nodes || [], posById);
    this.selectedNodeIds = new Set(this.boxSelection.baseSelection);
    hitIds.forEach((nodeId) => this.selectedNodeIds.add(nodeId));
  }

  _getNormalizedWorldRect(a, b) {
    return {
      minX: Math.min(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxX: Math.max(a.x, b.x),
      maxY: Math.max(a.y, b.y),
    };
  }

  _getSelectionKey(selection) {
    return Array.from(selection || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .sort((a, b) => a - b)
      .join(",");
  }

  _zoomAt(screenX, screenY, factor) {
    const old = this.scale;
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * factor));
    const worldX = (screenX - this.offsetX) / old;
    const worldY = (screenY - this.offsetY) / old;
    this.offsetX = screenX - worldX * this.scale;
    this.offsetY = screenY - worldY * this.scale;
    this.requestRenderIfGenerationChanged(true);
  }

  _viewMatrix() {
    return new Float32Array([
      this.scale, 0, 0,
      0, this.scale, 0,
      this.offsetX, this.offsetY, 1,
    ]);
  }

  _initPrograms() {
    const gl = this.gl;
    const quad = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    this.baseVao = gl.createVertexArray();
    this.baseVbo = gl.createBuffer();
    gl.bindVertexArray(this.baseVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.baseVbo);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.edgeProgram = createProgram(
      gl,
      `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv;
      layout(location=1) in vec2 a_p0;
      layout(location=2) in vec2 a_p3;
      layout(location=3) in float a_h;
      layout(location=4) in float a_width;
      layout(location=5) in vec4 a_color;
      uniform mat3 u_view;
      uniform vec2 u_viewportPx;
      uniform float u_glowPx;
      uniform float u_aaPx;
      out vec2 v_screenPx;
      out vec2 v_p0; out vec2 v_p1; out vec2 v_p2; out vec2 v_p3;
      out float v_width;
      out vec4 v_color;
      vec2 applyView(vec2 p) { return (u_view * vec3(p, 1.0)).xy; }
      void main() {
        vec2 w0 = a_p0;
        vec2 w3 = a_p3;
        vec2 hdir = normalize(vec2(max(0.0001, abs(w3.x - w0.x)), 0.0));
        float h = a_h;
        vec2 w1 = w0 + hdir * h;
        vec2 w2 = w3 - hdir * h;

        vec2 p0 = applyView(w0);
        vec2 p1 = applyView(w1);
        vec2 p2 = applyView(w2);
        vec2 p3 = applyView(w3);

        vec2 mn = min(min(p0, p1), min(p2, p3));
        vec2 mx = max(max(p0, p1), max(p2, p3));
        float pad = a_width + u_glowPx + u_aaPx;
        mn -= vec2(pad);
        mx += vec2(pad);
        vec2 screenPx = mix(mn, mx, a_uv);
        v_screenPx = screenPx;
        v_p0 = p0; v_p1 = p1; v_p2 = p2; v_p3 = p3;
        v_width = a_width;
        v_color = a_color;
        vec2 ndc = (screenPx / u_viewportPx) * 2.0 - 1.0;
        ndc.y = -ndc.y;
        gl_Position = vec4(ndc, 0.0, 1.0);
      }`,
      `#version 300 es
      precision highp float;
      in vec2 v_screenPx;
      in vec2 v_p0; in vec2 v_p1; in vec2 v_p2; in vec2 v_p3;
      in float v_width;
      in vec4 v_color;
      uniform float u_glowPx;
      out vec4 outColor;
      vec2 bez(vec2 p0, vec2 p1, vec2 p2, vec2 p3, float t) {
        float u = 1.0 - t;
        return (u*u*u)*p0 + (3.0*u*u*t)*p1 + (3.0*u*t*t)*p2 + (t*t*t)*p3;
      }
      float segDist(vec2 p, vec2 a, vec2 b) {
        vec2 ab = b - a;
        float ab2 = dot(ab, ab);
        float t = ab2 > 1e-6 ? clamp(dot(p - a, ab) / ab2, 0.0, 1.0) : 0.0;
        return length(p - (a + t * ab));
      }
      void main() {
        const int N = 24;
        float minD = 1e20;
        vec2 prev = bez(v_p0, v_p1, v_p2, v_p3, 0.0);
        for (int i = 1; i <= N; i++) {
          float t = float(i) / float(N);
          vec2 cur = bez(v_p0, v_p1, v_p2, v_p3, t);
          minD = min(minD, segDist(v_screenPx, prev, cur));
          prev = cur;
        }
        float aa = max(1.0, fwidth(minD));
        float lineA = 1.0 - smoothstep(v_width - aa, v_width + aa, minD);
        float glowA = 0.0;
        if (u_glowPx > 0.0) {
          glowA = 1.0 - smoothstep(v_width + u_glowPx, v_width + u_glowPx + aa, minD);
          glowA *= 0.34;
        }
        float a = lineA + glowA;
        if (a <= 0.001) discard;
        outColor = vec4(v_color.rgb, v_color.a * a);
      }`
    );

    this.nodeProgram = createProgram(
      gl,
      `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv;
      layout(location=1) in vec4 a_rect;
      uniform mat3 u_view;
      uniform vec2 u_viewportPx;
      out vec2 v_local;
      out vec2 v_size;
      void main() {
        vec2 world = a_rect.xy + a_uv * a_rect.zw;
        vec2 screen = (u_view * vec3(world, 1.0)).xy;
        v_local = a_uv * a_rect.zw;
        v_size = a_rect.zw;
        vec2 ndc = (screen / u_viewportPx) * 2.0 - 1.0;
        ndc.y = -ndc.y;
        gl_Position = vec4(ndc, 0.0, 1.0);
      }`,
      `#version 300 es
      precision highp float;
      in vec2 v_local;
      in vec2 v_size;
      uniform sampler2D u_skin;
      uniform vec2 u_skinSize;
      uniform vec4 u_slice;
      out vec4 outColor;

      float mapAxis(float p, float size, float s0, float s1, float texSize) {
        float inner = max(1.0, size - s0 - s1);
        float texInner = max(1.0, texSize - s0 - s1);
        if (p < s0) {
          return (p / max(1.0, s0)) * (s0 / texSize);
        }
        if (p > size - s1) {
          float d = size - p;
          return 1.0 - ((d / max(1.0, s1)) * (s1 / texSize));
        }
        float t = (p - s0) / inner;
        return (s0 / texSize) + t * (texInner / texSize);
      }

      void main() {
        float u = mapAxis(v_local.x, v_size.x, u_slice.x, u_slice.y, u_skinSize.x);
        float v = mapAxis(v_local.y, v_size.y, u_slice.z, u_slice.w, u_skinSize.y);
        vec4 skin = texture(u_skin, vec2(u, v));
        if (skin.a < 0.001) discard;
        outColor = skin;
      }`
    );

    this.spriteProgram = createProgram(
      gl,
      `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv;
      layout(location=1) in vec4 a_rect;
      layout(location=2) in vec4 a_uvRect;
      uniform mat3 u_view;
      uniform vec2 u_viewportPx;
      out vec2 v_uv;
      void main() {
        vec2 world = a_rect.xy + a_uv * a_rect.zw;
        vec2 screen = (u_view * vec3(world, 1.0)).xy;
        v_uv = a_uvRect.xy + a_uv * a_uvRect.zw;
        vec2 ndc = (screen / u_viewportPx) * 2.0 - 1.0;
        ndc.y = -ndc.y;
        gl_Position = vec4(ndc, 0.0, 1.0);
      }`,
      `#version 300 es
      precision highp float;
      in vec2 v_uv;
      uniform sampler2D u_tex;
      out vec4 outColor;
      void main() {
        vec4 tex = texture(u_tex, v_uv);
        if (tex.a < 0.001) discard;
        outColor = tex;
      }`
    );

    this.textProgram = createProgram(
      gl,
      `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv;
      uniform mat3 u_view;
      uniform vec2 u_viewport;
      uniform vec2 uP;
      uniform vec4 uT;
      uniform vec4 u_uv;
      out vec2 v_uv;
      void main() {
        vec2 aP = a_uv * 2.0 - 1.0;
        vec2 world = aP * mat2(uT) + uP;
        vec2 screen = (u_view * vec3(world, 1.0)).xy;
        vec2 aP01 = aP * 0.5 + 0.5;
        vec2 aFlip = vec2(aP01.x, 1.0 - aP01.y);
        v_uv = u_uv.xy + aFlip * u_uv.zw;
        vec2 ndc = (screen / u_viewport) * 2.0 - 1.0;
        ndc.y = -ndc.y;
        gl_Position = vec4(ndc, 0.0, 1.0);
      }`,
      `#version 300 es
      precision highp float;
      in vec2 v_uv;
      uniform sampler2D u_tex;
      uniform vec4 u_color;
      uniform float u_aa;
      uniform float uDistRange;
      uniform int uEffect;
      uniform float uStroke;
      uniform float uGlow;
      uniform vec2 uShadowPx;
      uniform vec2 uAtlasSize;
      out vec4 outColor;
      float median(float r, float g, float b) {
        return max(min(r, g), min(max(r, g), b));
      }
      void main() {
        vec4 tex = texture(u_tex, v_uv);
        float msdf = median(tex.r, tex.g, tex.b) - 0.5;
        float sdf = tex.a - 0.5;
        float fill = clamp(msdf * u_aa + 0.5, 0.0, 1.0);
        float distPx = sdf * uDistRange;

        float outline = 1.0 - smoothstep(max(0.0, uStroke - 1.0), uStroke + 1.0, abs(distPx));
        float outsideDist = max(0.0, -distPx);
        float glow = (1.0 - smoothstep(0.0, max(0.001, uGlow), outsideDist)) * (1.0 - fill);

        vec2 suv = v_uv + (uShadowPx / uAtlasSize);
        float sdist = (texture(u_tex, suv).a - 0.5) * uDistRange;
        float shadowOutside = max(0.0, -sdist);
        float shadow = (1.0 - smoothstep(0.0, max(0.001, uGlow), shadowOutside)) * (1.0 - fill);

        float alpha = fill;
        if (uEffect == 1) {
          alpha = max(outline, fill);
        } else if (uEffect == 2) {
          alpha = max(fill, glow * 0.8);
        } else if (uEffect == 3) {
          alpha = max(fill, shadow * 0.65);
        } else if (uEffect == 4) {
          alpha = max(fill, max(outline * 0.8, glow * 0.55));
        }
        if (alpha < 0.001) discard;
        outColor = vec4(u_color.rgb, u_color.a * alpha);
      }`
    );

    this.edgeBuffer = gl.createBuffer();
    this.nodeBuffer = gl.createBuffer();
    this.spriteBuffer = gl.createBuffer();
    this.textAtlas = null;
  }

  async _loadTextureFromUrl(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`failed to fetch ${url}: ${res.status}`);
    }
    const blob = await res.blob();
    const image = await createImageBitmap(blob);

    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    return { texture: tex, width: image.width, height: image.height };
  }

  async _loadNineSliceTextureFromAssets() {
    if (!this.gl || !this.assets) return;
    const cfg = this.assets.nineSlice;
    const textureUrl = cfg?.textureUrl;
    if (!textureUrl) {
      throw new Error("missing nineSlice.textureUrl");
    }

    const gl = this.gl;
    const texInfo = await this._loadTextureFromUrl(textureUrl);
    if (this.skinTexture?.texture) {
      gl.deleteTexture(this.skinTexture.texture);
    }
    this.skinTexture = texInfo;
  }

  async _loadPortTexturesFromAssets() {
    if (!this.gl || !this.assets?.ports) return;
    const gl = this.gl;
    const cfg = this.assets.ports;
    if (!cfg.emptyIconUrl || !cfg.fullIconUrl) {
      throw new Error("missing ports.emptyIconUrl or ports.fullIconUrl");
    }

    const [empty, full] = await Promise.all([
      this._loadTextureFromUrl(cfg.emptyIconUrl),
      this._loadTextureFromUrl(cfg.fullIconUrl),
    ]);

    if (this.portTextures?.empty?.texture) gl.deleteTexture(this.portTextures.empty.texture);
    if (this.portTextures?.full?.texture) gl.deleteTexture(this.portTextures.full.texture);
    this.portTextures = { empty, full };
  }

  async _loadTextAtlasFromAssets() {
    const source = this.assets?.text?.source;
    if (!source?.metaUrl || !source?.atlasUrl) {
      throw new Error("missing text.source.metaUrl or text.source.atlasUrl");
    }

    const [metaRes, atlasRes] = await Promise.all([
      fetch(source.metaUrl, { cache: "no-cache" }),
      fetch(source.atlasUrl, { cache: "no-cache" }),
    ]);
    if (!metaRes.ok) throw new Error(`failed to fetch ${source.metaUrl}: ${metaRes.status}`);
    if (!atlasRes.ok) throw new Error(`failed to fetch ${source.atlasUrl}: ${atlasRes.status}`);

    const meta = await metaRes.json();
    const atlasBlob = await atlasRes.blob();
    const atlasImage = await createImageBitmap(atlasBlob);
    const glyphs = buildGlyphMap(meta);

    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImage);

    this.textAtlas = {
      texture: tex,
      glyphs,
      atlasW: Number(meta.atlas.width),
      atlasH: Number(meta.atlas.height),
      atlasSize: Number(meta.atlas.size),
      distRange: Number(meta.atlas.distanceRange || 8),
      lineHeight: Number(meta.metrics?.lineHeight || 1.2),
    };
  }

  _ensureLayout(nodeId, index) {
    if (this.nodeLayout.has(nodeId)) return this.nodeLayout.get(nodeId);
    const snapshot = this.getGraphSnapshot();
    const node = snapshot.nodes.find((entry) => entry.id === nodeId);
    if (node) {
      return this._updateNodeFrame(nodeId, node, index);
    }
    const layout = this.assets.layout;
    const col = index % layout.gridColumns;
    const row = Math.floor(index / layout.gridColumns);
    const frame = {
      x: layout.gridOriginX + col * layout.gridStepX,
      y: layout.gridOriginY + row * layout.gridStepY,
      width: Number(this.assets.node?.width || 146),
      height: Number(this.assets.node?.minHeight || this.assets.node?.height || 62),
    };
    this.nodeLayout.set(nodeId, frame);
    return frame;
  }

  _readGraph() {
    const ptr = this.api.ng_get_info_ptr();
    const nodes = [];
    const edges = [];
    for (let i = 0; i < NG.MAX_NODES; i++) {
      const base = ptr + INFO.NODES + i * ABI.NODE_SIZE;
      const id = this.dv.getUint32(base + NODE.ID, true);
      if (id === 0) continue;
      const kind = this.dv.getUint32(base + NODE.KIND, true);
      const execState = this.dv.getUint32(base + NODE.EXEC_STATE, true);
      const inputCount = this.dv.getUint32(base + NODE.INPUT_COUNT, true);
      const outputCount = this.dv.getUint32(base + NODE.OUTPUT_COUNT, true);
      const node = { id, kind, execState, inputCount, outputCount, inputs: [], outputs: [] };

      for (let j = 0; j < inputCount; j++) {
        const inBase = base + ABI.NODE_HEADER_SIZE + j * ABI.INPUT_PORT_SIZE;
        const inputId = this.dv.getUint32(inBase, true);
        const srcNodeId = this.dv.getUint32(inBase + 4, true);
        const srcOutputId = this.dv.getUint32(inBase + 8, true);
        node.inputs.push({ inputId, srcNodeId, srcOutputId });
        if (srcNodeId) {
          edges.push({
            from: srcNodeId,
            fromOutputId: srcOutputId,
            to: id,
            toInputId: inputId,
            execState,
          });
        }
      }

      const outputsBase = base + ABI.NODE_HEADER_SIZE + NG.MAX_INPUTS * ABI.INPUT_PORT_SIZE;
      for (let j = 0; j < outputCount; j++) {
        const outputId = this.dv.getUint32(outputsBase + j * ABI.OUTPUT_PORT_SIZE, true);
        node.outputs.push({ outputId });
      }
      nodes.push(node);
    }
    return { nodes, edges };
  }

  _colorForExec(state, key) {
    const t = this.assets.theme;
    if (state === 1) return t[`${key}Success`] || t[key];
    if (state === 2) return t[`${key}Error`] || t[key];
    if (state === 3) return t[`${key}Stale`] || t[key];
    return t[key];
  }

  _render() {
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const graph = this._readGraph();
    const posById = new Map();
    graph.nodes.forEach((node, i) => {
      posById.set(node.id, this._ensureLayout(node.id, i));
    });
    this.contentBounds = this.calculateContentBounds(graph, posById);
    this.lastGraph = graph;
    this.lastPosById = posById;

    gl.viewport(0, 0, width, height);
    const clear = this.assets.theme.clear;
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const view = this._viewMatrix();
    this._drawEdges(graph.nodes, graph.edges, posById, width, height, view);
    this._drawActiveConnection(width, height, view);
    this._drawNodes(graph.nodes, posById, width, height, view);
    this._drawSelectionOverlay(graph.nodes, posById, width, height, view);
    this._drawBoxSelectionOverlay(width, height, view);
    this._drawPorts(graph.nodes, graph.edges, posById, width, height, view);
    this._drawLabels(graph.nodes, posById, width, height, view);
    this._drawPickOverlay(this.hoverPick, graph.nodes, graph.edges, posById, width, height, view);
  }

  _drawActiveConnection(width, height, view) {
    if (!this.connectionDrag) return;
    const drag = this.connectionDrag;
    const edgeCfg = this.assets.edge;
    const active = this.assets.theme.edgeActive || [133 / 255, 192 / 255, 255 / 255, 1];

    let p0;
    let p3;
    if (drag.fixed.direction === "output") {
      p0 = { x: drag.fixed.x, y: drag.fixed.y };
      p3 = drag.moving;
    } else {
      p0 = drag.moving;
      p3 = { x: drag.fixed.x, y: drag.fixed.y };
    }

    const h = Math.max(edgeCfg.handleMin, Math.min(edgeCfg.handleMax, Math.abs(p3.x - p0.x) * 0.5));
    const data = new Float32Array([
      p0.x, p0.y,
      p3.x, p3.y,
      h,
      Math.max(edgeCfg.halfWidthPx * 1.35, edgeCfg.halfWidthPx + 0.5),
      active[0], active[1], active[2], active[3],
    ]);

    const gl = this.gl;
    gl.useProgram(this.edgeProgram);
    gl.bindVertexArray(this.baseVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const stride = 10 * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 20);
    gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 24);
    gl.vertexAttribDivisor(5, 1);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.edgeProgram, "u_view"), false, view);
    gl.uniform2f(gl.getUniformLocation(this.edgeProgram, "u_viewportPx"), width, height);
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, "u_glowPx"), Math.max(edgeCfg.glowPx, 4));
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, "u_aaPx"), edgeCfg.aaPx);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
  }

  _worldDistanceToBezier(x, y, p0, p1, p2, p3) {
    let minDist = Infinity;
    let prev = p0;
    const samples = 24;
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const u = 1 - t;
      const pt = {
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      };
      const abx = pt.x - prev.x;
      const aby = pt.y - prev.y;
      const apx = x - prev.x;
      const apy = y - prev.y;
      const ab2 = abx * abx + aby * aby;
      const h = ab2 > 1e-6 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2)) : 0;
      const qx = prev.x + abx * h;
      const qy = prev.y + aby * h;
      const dx = x - qx;
      const dy = y - qy;
      const d = Math.hypot(dx, dy);
      if (d < minDist) minDist = d;
      prev = pt;
    }
    return minDist;
  }

  _hitTestNode(worldX, worldY, nodes, posById) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const pos = posById.get(node.id);
      if (!pos) continue;
      const size = this._getNodeSize(node);
      if (
        worldX >= pos.x && worldX <= pos.x + size.width &&
        worldY >= pos.y && worldY <= pos.y + size.height
      ) {
        return { nodeId: node.id };
      }
    }
    return null;
  }

  _collectNodeIdsInWorldRect(rect, nodes, posById) {
    const hitIds = [];
    for (const node of nodes) {
      const pos = posById.get(node.id);
      if (!pos) continue;
      const size = this._getNodeSize(node);
      const intersects =
        rect.minX <= pos.x + size.width &&
        rect.maxX >= pos.x &&
        rect.minY <= pos.y + size.height &&
        rect.maxY >= pos.y;
      if (intersects) {
        hitIds.push(node.id);
      }
    }
    return hitIds;
  }

  _hitTestPort(worldX, worldY, nodes, posById) {
    const hitRadiusPx = Number(this.assets.ports.hitRadiusPx || 16);
    const hitRadiusWorld = hitRadiusPx / Math.max(0.0001, this.scale);
    const outputUsage = new Set();
    for (const edge of this.lastGraph?.edges || []) {
      outputUsage.add(`${edge.from}:${edge.fromOutputId}`);
    }

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const pos = posById.get(node.id);
      if (!pos) continue;

      for (let idx = 0; idx < node.inputCount; idx++) {
        const input = node.inputs[idx];
        const p = this._getPortCenter(node, pos, true, idx);
        if (Math.hypot(worldX - p.x, worldY - p.y) <= hitRadiusWorld) {
          return {
            nodeId: node.id,
            direction: "input",
            index: idx,
            portId: input?.inputId ?? idx + 1,
            connected: Boolean(input?.srcNodeId),
          };
        }
      }

      for (let idx = 0; idx < node.outputCount; idx++) {
        const output = node.outputs[idx];
        const p = this._getPortCenter(node, pos, false, idx);
        if (Math.hypot(worldX - p.x, worldY - p.y) <= hitRadiusWorld) {
          const portId = output?.outputId ?? idx + 1;
          return {
            nodeId: node.id,
            direction: "output",
            index: idx,
            portId,
            connected: outputUsage.has(`${node.id}:${portId}`),
          };
        }
      }
    }
    return null;
  }

  _hitTestEdge(worldX, worldY, nodes, edges, posById) {
    const edgeCfg = this.assets.edge;
    const hitRadiusPx = Number(edgeCfg.hitRadiusPx || 10);
    const hitRadiusWorld = hitRadiusPx / Math.max(0.0001, this.scale);
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    let best = null;
    for (const edge of edges) {
      const fromNode = nodesById.get(edge.from);
      const toNode = nodesById.get(edge.to);
      const fromPos = posById.get(edge.from);
      const toPos = posById.get(edge.to);
      if (!fromNode || !toNode || !fromPos || !toPos) continue;

      const fromPortIndex = this._getOutputIndex(fromNode, edge.fromOutputId);
      const toPortIndex = this._getInputIndex(toNode, edge.toInputId);
      const p0 = this._getPortCenter(fromNode, fromPos, false, fromPortIndex);
      const p3 = this._getPortCenter(toNode, toPos, true, toPortIndex);
      const dx = Math.abs(p3.x - p0.x);
      const h = Math.max(edgeCfg.handleMin, Math.min(edgeCfg.handleMax, dx * 0.5));
      const p1 = { x: p0.x + h, y: p0.y };
      const p2 = { x: p3.x - h, y: p3.y };
      const dist = this._worldDistanceToBezier(worldX, worldY, p0, p1, p2, p3);
      if (dist <= hitRadiusWorld && (!best || dist < best.distance)) {
        const dStart = Math.hypot(worldX - p0.x, worldY - p0.y);
        const dEnd = Math.hypot(worldX - p3.x, worldY - p3.y);
        best = {
          edge,
          distance: dist,
          side: dStart <= dEnd ? "output" : "input",
        };
      }
    }

    return best;
  }

  _getInputIndex(node, inputId) {
    if (!node?.inputs?.length) return 0;
    const idx = node.inputs.findIndex((port) => port.inputId === inputId);
    return idx >= 0 ? idx : 0;
  }

  _getOutputIndex(node, outputId) {
    if (!node?.outputs?.length) return 0;
    const idx = node.outputs.findIndex((port) => port.outputId === outputId);
    return idx >= 0 ? idx : 0;
  }

  _getNodeSize(node) {
    const cached = node?.id ? this.nodeLayout.get(node.id) : null;
    if (cached?.width && cached?.height) {
      return { width: cached.width, height: cached.height };
    }
    return this._measureNodeSize(node);
  }

  _getPortCenter(node, pos, isInput, portIndex) {
    const cfg = this.assets.ports;
    const nodeSize = this._getNodeSize(node);
    const x = isInput ? pos.x + cfg.inputInsetX : pos.x + nodeSize.width - cfg.outputInsetX;
    const y = pos.y + cfg.rowStartY + portIndex * cfg.spacingY;
    return { x, y };
  }

  _getNodePortLabels(nodeId) {
    if (!this.portLabels) return null;
    if (this.portLabels instanceof Map) {
      return this.portLabels.get(nodeId) || this.portLabels.get(String(nodeId)) || null;
    }
    return this.portLabels[nodeId] || this.portLabels[String(nodeId)] || null;
  }

  _getPortLabel(nodeId, direction, portId, index) {
    const labels = this._getNodePortLabels(nodeId);
    const dict = labels ? labels[direction === "input" ? "inputs" : "outputs"] : null;
    const key = String(portId);
    if (dict instanceof Map) {
      if (dict.has(portId)) return String(dict.get(portId));
      if (dict.has(key)) return String(dict.get(key));
    } else if (dict && typeof dict === "object") {
      if (dict[portId] !== undefined) return String(dict[portId]);
      if (dict[key] !== undefined) return String(dict[key]);
    }
    return `${direction === "input" ? "in" : "out"} ${portId || index + 1}`;
  }

  _drawEdges(nodes, edges, posById, width, height, view) {
    const gl = this.gl;
    if (!edges.length) return;
    const edgeCfg = this.assets.edge;
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const data = new Float32Array(edges.length * 10);
    let o = 0;
    for (const edge of edges) {
      if (this.connectionDrag?.originalEdge) {
        const orig = this.connectionDrag.originalEdge;
        if (
          edge.from === orig.from &&
          edge.fromOutputId === orig.fromOutputId &&
          edge.to === orig.to &&
          edge.toInputId === orig.toInputId
        ) {
          continue;
        }
      }

      const from = posById.get(edge.from);
      const to = posById.get(edge.to);
      if (!from || !to) continue;
      const fromNode = nodesById.get(edge.from);
      const toNode = nodesById.get(edge.to);
      const fromPortIndex = this._getOutputIndex(fromNode, edge.fromOutputId);
      const toPortIndex = this._getInputIndex(toNode, edge.toInputId);
      const p0 = this._getPortCenter(fromNode, from, false, fromPortIndex);
      const p3 = this._getPortCenter(toNode, to, true, toPortIndex);
      const p0x = p0.x;
      const p0y = p0.y;
      const p3x = p3.x;
      const p3y = p3.y;
      const h = Math.max(edgeCfg.handleMin, Math.min(edgeCfg.handleMax, Math.abs(p3x - p0x) * 0.5));
      const c = this._colorForExec(edge.execState, "edge");
      data[o++] = p0x;
      data[o++] = p0y;
      data[o++] = p3x;
      data[o++] = p3y;
      data[o++] = h;
      data[o++] = edgeCfg.halfWidthPx;
      data[o++] = c[0];
      data[o++] = c[1];
      data[o++] = c[2];
      data[o++] = c[3];
    }

    gl.useProgram(this.edgeProgram);
    gl.bindVertexArray(this.baseVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const stride = 10 * 4;

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 20);
    gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 24);
    gl.vertexAttribDivisor(5, 1);

    gl.uniformMatrix3fv(gl.getUniformLocation(this.edgeProgram, "u_view"), false, view);
    gl.uniform2f(gl.getUniformLocation(this.edgeProgram, "u_viewportPx"), width, height);
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, "u_glowPx"), edgeCfg.glowPx);
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, "u_aaPx"), edgeCfg.aaPx);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.floor(o / 10));
  }

  _drawPickOverlay(pick, nodes, edges, posById, width, height, view) {
    if (!pick) return;
    if (pick.kind === "port") {
      const node = nodes.find((n) => n.id === pick.nodeId);
      const pos = node ? posById.get(node.id) : null;
      if (!node || !pos || !this.portTextures?.full) return;
      const p = this._getPortCenter(node, pos, pick.direction === "input", pick.index);
      const iconSize = Number(this.assets.ports.iconSizePx || 12) + 4;
      const half = iconSize * 0.5;
      const data = new Float32Array([
        p.x - half, p.y - half, iconSize, iconSize,
        0, 0, 1, 1,
      ]);
      this._drawPortBatch(this.portTextures.full, data, width, height, view);
      return;
    }

    if (pick.kind === "edge" && pick.edge) {
      const edgeCfg = this.assets.edge;
      const nodesById = new Map(nodes.map((node) => [node.id, node]));
      const fromNode = nodesById.get(pick.edge.from);
      const toNode = nodesById.get(pick.edge.to);
      const fromPos = posById.get(pick.edge.from);
      const toPos = posById.get(pick.edge.to);
      if (!fromNode || !toNode || !fromPos || !toPos) return;

      const fromPortIndex = this._getOutputIndex(fromNode, pick.edge.fromOutputId);
      const toPortIndex = this._getInputIndex(toNode, pick.edge.toInputId);
      const p0 = this._getPortCenter(fromNode, fromPos, false, fromPortIndex);
      const p3 = this._getPortCenter(toNode, toPos, true, toPortIndex);
      const h = Math.max(edgeCfg.handleMin, Math.min(edgeCfg.handleMax, Math.abs(p3.x - p0.x) * 0.5));
      const active = this.assets.theme.edgeActive || [133 / 255, 192 / 255, 255 / 255, 1];
      const data = new Float32Array([
        p0.x, p0.y,
        p3.x, p3.y,
        h,
        Math.max(edgeCfg.halfWidthPx * 1.8, edgeCfg.halfWidthPx + 0.8),
        active[0], active[1], active[2], active[3],
      ]);

      const gl = this.gl;
      gl.useProgram(this.edgeProgram);
      gl.bindVertexArray(this.baseVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const stride = 10 * 4;
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8);
      gl.vertexAttribDivisor(2, 1);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16);
      gl.vertexAttribDivisor(3, 1);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 20);
      gl.vertexAttribDivisor(4, 1);
      gl.enableVertexAttribArray(5);
      gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 24);
      gl.vertexAttribDivisor(5, 1);
      gl.uniformMatrix3fv(gl.getUniformLocation(this.edgeProgram, "u_view"), false, view);
      gl.uniform2f(gl.getUniformLocation(this.edgeProgram, "u_viewportPx"), width, height);
      gl.uniform1f(gl.getUniformLocation(this.edgeProgram, "u_glowPx"), Math.max(edgeCfg.glowPx, 4));
      gl.uniform1f(gl.getUniformLocation(this.edgeProgram, "u_aaPx"), edgeCfg.aaPx);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
      return;
    }

    if (pick.kind === "node") {
      const node = nodes.find((n) => n.id === pick.nodeId);
      const pos = node ? posById.get(node.id) : null;
      if (!node || !pos) return;
      const size = this._getNodeSize(node);
      const active = this.assets.theme.edgeActive || [133 / 255, 192 / 255, 255 / 255, 1];
      this._drawRectOutline([
        {
          x: pos.x - 2,
          y: pos.y - 2,
          width: size.width + 4,
          height: size.height + 4,
          color: [active[0], active[1], active[2], 0.85],
          strokePx: 2,
        },
      ], width, height, view);
    }
  }

  _drawSelectionOverlay(nodes, posById, width, height, view) {
    if (!this.selectedNodeIds?.size) return;
    const selection = this.assets.theme.selection || [74 / 255, 199 / 255, 255 / 255, 1];
    const rects = [];
    for (const node of nodes) {
      if (!this.selectedNodeIds.has(node.id)) continue;
      const pos = posById.get(node.id);
      if (!pos) continue;
      const size = this._getNodeSize(node);
      rects.push({
        x: pos.x - 3,
        y: pos.y - 3,
        width: size.width + 6,
        height: size.height + 6,
        color: [selection[0], selection[1], selection[2], 0.95],
        strokePx: 2,
      });
    }
    this._drawRectOutline(rects, width, height, view);
  }

  _drawBoxSelectionOverlay(width, height, view) {
    if (!this.boxSelection) return;
    const rect = this._getNormalizedWorldRect(this.boxSelection.anchorWorld, this.boxSelection.currentWorld);
    const stroke = this.assets.theme.selection || [74 / 255, 199 / 255, 255 / 255, 1];
    this._drawRectFill([
      {
        x: rect.minX,
        y: rect.minY,
        width: Math.max(1, rect.maxX - rect.minX),
        height: Math.max(1, rect.maxY - rect.minY),
        color: [stroke[0], stroke[1], stroke[2], 0.14],
      },
    ], width, height, view);
    this._drawRectOutline([
      {
        x: rect.minX,
        y: rect.minY,
        width: Math.max(1, rect.maxX - rect.minX),
        height: Math.max(1, rect.maxY - rect.minY),
        color: [stroke[0], stroke[1], stroke[2], 0.9],
        strokePx: 1.5,
      },
    ], width, height, view);
  }

  _drawRectFill(rects, width, height, view) {
    if (!rects.length) return;
    const gl = this.gl;
    if (!this.rectFillProgram) {
      this.rectFillProgram = createProgram(
        gl,
        `#version 300 es
        precision highp float;
        layout(location=0) in vec2 a_uv;
        layout(location=1) in vec4 a_rect;
        layout(location=2) in vec4 a_color;
        uniform mat3 u_view;
        uniform vec2 u_viewportPx;
        out vec4 v_color;
        void main() {
          vec2 world = a_rect.xy + a_uv * a_rect.zw;
          vec2 screen = (u_view * vec3(world, 1.0)).xy;
          v_color = a_color;
          vec2 ndc = (screen / u_viewportPx) * 2.0 - 1.0;
          ndc.y = -ndc.y;
          gl_Position = vec4(ndc, 0.0, 1.0);
        }`,
        `#version 300 es
        precision highp float;
        in vec4 v_color;
        out vec4 outColor;
        void main() {
          outColor = v_color;
        }`
      );
      this.rectFillBuffer = gl.createBuffer();
    }

    const data = new Float32Array(rects.length * 8);
    let o = 0;
    for (const rect of rects) {
      data[o++] = rect.x;
      data[o++] = rect.y;
      data[o++] = rect.width;
      data[o++] = rect.height;
      data[o++] = rect.color[0];
      data[o++] = rect.color[1];
      data[o++] = rect.color[2];
      data[o++] = rect.color[3];
    }

    gl.useProgram(this.rectFillProgram);
    gl.bindVertexArray(this.baseVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectFillBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const stride = 8 * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.rectFillProgram, "u_view"), false, view);
    gl.uniform2f(gl.getUniformLocation(this.rectFillProgram, "u_viewportPx"), width, height);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rects.length);
  }

  _drawRectOutline(rects, width, height, view) {
    if (!rects.length) return;
    const gl = this.gl;
    if (!this.rectProgram) {
      this.rectProgram = createProgram(
        gl,
        `#version 300 es
        precision highp float;
        layout(location=0) in vec2 a_uv;
        layout(location=1) in vec4 a_rect;
        layout(location=2) in vec4 a_color;
        layout(location=3) in float a_stroke;
        uniform mat3 u_view;
        uniform vec2 u_viewportPx;
        out vec2 v_local;
        out vec2 v_size;
        out vec4 v_color;
        out float v_stroke;
        void main() {
          vec2 world = a_rect.xy + a_uv * a_rect.zw;
          vec2 screen = (u_view * vec3(world, 1.0)).xy;
          v_local = a_uv * a_rect.zw;
          v_size = a_rect.zw;
          v_color = a_color;
          v_stroke = a_stroke;
          vec2 ndc = (screen / u_viewportPx) * 2.0 - 1.0;
          ndc.y = -ndc.y;
          gl_Position = vec4(ndc, 0.0, 1.0);
        }`,
        `#version 300 es
        precision highp float;
        in vec2 v_local;
        in vec2 v_size;
        in vec4 v_color;
        in float v_stroke;
        out vec4 outColor;
        void main() {
          float edgeDist = min(min(v_local.x, v_local.y), min(v_size.x - v_local.x, v_size.y - v_local.y));
          float aa = max(1.0, fwidth(edgeDist));
          float a = 1.0 - smoothstep(v_stroke - aa, v_stroke + aa, edgeDist);
          if (a < 0.001) discard;
          outColor = vec4(v_color.rgb, v_color.a * a);
        }`
      );
      this.rectBuffer = gl.createBuffer();
    }

    const data = new Float32Array(rects.length * 9);
    let o = 0;
    for (const r of rects) {
      data[o++] = r.x;
      data[o++] = r.y;
      data[o++] = r.width;
      data[o++] = r.height;
      data[o++] = r.color[0];
      data[o++] = r.color[1];
      data[o++] = r.color[2];
      data[o++] = r.color[3];
      data[o++] = r.strokePx;
    }

    gl.useProgram(this.rectProgram);
    gl.bindVertexArray(this.baseVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const stride = 9 * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 32);
    gl.vertexAttribDivisor(3, 1);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.rectProgram, "u_view"), false, view);
    gl.uniform2f(gl.getUniformLocation(this.rectProgram, "u_viewportPx"), width, height);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rects.length);
  }

  _drawPortBatch(textureInfo, instances, width, height, view) {
    if (!instances.length) return;
    const gl = this.gl;
    gl.useProgram(this.spriteProgram);
    gl.bindVertexArray(this.baseVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.DYNAMIC_DRAW);

    const stride = 8 * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.disableVertexAttribArray(3);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
    gl.uniform1i(gl.getUniformLocation(this.spriteProgram, "u_tex"), 0);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.spriteProgram, "u_view"), false, view);
    gl.uniform2f(gl.getUniformLocation(this.spriteProgram, "u_viewportPx"), width, height);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instances.length / 8);
  }

  _drawPorts(nodes, edges, posById, width, height, view) {
    if (!this.portTextures) return;
    const cfg = this.assets.ports;
    const iconSize = Number(cfg.iconSizePx) || 12;
    const half = iconSize * 0.5;
    const uvRect = [0, 0, 1, 1];

    const outputUsage = new Set();
    for (const edge of edges) {
      outputUsage.add(`${edge.from}:${edge.fromOutputId}`);
    }

    const emptyInstances = [];
    const fullInstances = [];
    const pushInstance = (target, cx, cy) => {
      target.push(cx - half, cy - half, iconSize, iconSize);
      target.push(uvRect[0], uvRect[1], uvRect[2], uvRect[3]);
    };

    for (const node of nodes) {
      const pos = posById.get(node.id);
      if (!pos) continue;

      for (let i = 0; i < node.inputCount; i++) {
        const input = node.inputs[i];
        const p = this._getPortCenter(node, pos, true, i);
        if (input?.srcNodeId) {
          pushInstance(fullInstances, p.x, p.y);
        } else {
          pushInstance(emptyInstances, p.x, p.y);
        }
      }

      for (let i = 0; i < node.outputCount; i++) {
        const output = node.outputs[i];
        const p = this._getPortCenter(node, pos, false, i);
        if (output && outputUsage.has(`${node.id}:${output.outputId}`)) {
          pushInstance(fullInstances, p.x, p.y);
        } else {
          pushInstance(emptyInstances, p.x, p.y);
        }
      }
    }

    this._drawPortBatch(this.portTextures.empty, new Float32Array(emptyInstances), width, height, view);
    this._drawPortBatch(this.portTextures.full, new Float32Array(fullInstances), width, height, view);
  }

  _drawNodes(nodes, posById, width, height, view) {
    const gl = this.gl;
    if (!nodes.length || !this.skinTexture) return;

    const data = new Float32Array(nodes.length * 4);
    let o = 0;
    for (const node of nodes) {
      const pos = posById.get(node.id);
      const nodeSize = this._getNodeSize(node);
      data[o++] = pos.x;
      data[o++] = pos.y;
      data[o++] = nodeSize.width;
      data[o++] = nodeSize.height;
    }

    gl.useProgram(this.nodeProgram);
    gl.bindVertexArray(this.baseVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const stride = 4 * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.skinTexture.texture);
    gl.uniform1i(gl.getUniformLocation(this.nodeProgram, "u_skin"), 0);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.nodeProgram, "u_view"), false, view);
    gl.uniform2f(gl.getUniformLocation(this.nodeProgram, "u_viewportPx"), width, height);
    gl.uniform2f(gl.getUniformLocation(this.nodeProgram, "u_skinSize"), this.skinTexture.width, this.skinTexture.height);
    gl.uniform4f(
      gl.getUniformLocation(this.nodeProgram, "u_slice"),
      this.assets.nineSlice.left,
      this.assets.nineSlice.right,
      this.assets.nineSlice.top,
      this.assets.nineSlice.bottom
    );
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nodes.length);
  }

  _drawLabels(nodes, posById, width, height, view) {
    const gl = this.gl;
    if (!this.textAtlas) return;
    const glyphs = this.textAtlas.glyphs;
    const c = this.assets.theme.text;
    const cMuted = this.assets.theme.textMuted || c;

    gl.useProgram(this.textProgram);
    gl.bindVertexArray(this.baseVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textAtlas.texture);
    gl.uniform1i(gl.getUniformLocation(this.textProgram, "u_tex"), 0);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.textProgram, "u_view"), false, view);
    gl.uniform2f(gl.getUniformLocation(this.textProgram, "u_viewport"), width, height);
    const colorLoc = gl.getUniformLocation(this.textProgram, "u_color");
    gl.uniform4f(colorLoc, c[0], c[1], c[2], c[3]);
    const aaBase = Number(this.assets.text.aa || 8);
    const aa = Math.min(32.0, Math.max(6.0, aaBase * this.scale));
    gl.uniform1f(gl.getUniformLocation(this.textProgram, "u_aa"), aa);
    gl.uniform1f(gl.getUniformLocation(this.textProgram, "uDistRange"), this.textAtlas.distRange);
    const effectNames = { fill: 0, outline: 1, glow: 2, shadow: 3, combo: 4 };
    const rawEffect = String(this.assets.text.effect || "fill").toLowerCase();
    const effect = Number.isFinite(Number(rawEffect)) ? Number(rawEffect) : (effectNames[rawEffect] ?? 0);
    gl.uniform1i(gl.getUniformLocation(this.textProgram, "uEffect"), effect);
    gl.uniform1f(gl.getUniformLocation(this.textProgram, "uStroke"), Number(this.assets.text.stroke || 2.5));
    gl.uniform1f(gl.getUniformLocation(this.textProgram, "uGlow"), Number(this.assets.text.glow || 2));
    gl.uniform2f(
      gl.getUniformLocation(this.textProgram, "uShadowPx"),
      Number(this.assets.text.shadowX || 4),
      Number(this.assets.text.shadowY || -4)
    );
    gl.uniform2f(gl.getUniformLocation(this.textProgram, "uAtlasSize"), this.textAtlas.atlasW, this.textAtlas.atlasH);

    const atlasSize = Math.max(1, this.textAtlas.atlasSize || 48);
    const titlePx = Number(this.assets.text.fontPx || 14);
    const portPx = Number(this.assets.ports.labelFontPx || 11);
    const titleScale = titlePx / atlasSize;
    const portScale = portPx / atlasSize;

    const drawText = (text, startX, baselineY, scale) => {
      let x = startX;
      for (const ch of text) {
        const g = glyphs.get(ch.codePointAt(0));
        if (!g) {
          x += atlasSize * 0.3 * scale;
          continue;
        }
        if (g.empty) {
          x += g.advancePx * scale;
          continue;
        }
        const gw = g.widthPx * scale;
        const gh = g.heightPx * scale;
        const px = x + g.offsetXPx * scale;
        const py = baselineY + g.baselineOffsetYPx * scale;
        gl.uniform2f(gl.getUniformLocation(this.textProgram, "uP"), px, py);
        gl.uniform4f(gl.getUniformLocation(this.textProgram, "uT"), gw * 0.5, 0, 0, gh * 0.5);
        gl.uniform4f(gl.getUniformLocation(this.textProgram, "u_uv"), g.uv[0], g.uv[1], g.uv[2], g.uv[3]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        x += g.advancePx * scale;
      }
    };

    const iconHalf = Number(this.assets.ports.iconSizePx || 12) * 0.5;
    const labelOffset = Number(this.assets.ports.labelOffsetX || 10);
    const padX = Number(this.assets.layout.nodePaddingX || 10);

    for (const node of nodes) {
      const pos = posById.get(node.id);
      const nodeSize = this._getNodeSize(node);
      const labelA = this._getNodeTitleLabel(node);
      const labelState = this._getNodeStateLabel(node);
      const x = pos.x + padX;
      const yA = pos.y + titlePx + 2;

      gl.uniform4f(colorLoc, c[0], c[1], c[2], c[3]);
      drawText(labelA, x, yA, titleScale);

      const stateWidth = this._measureTextWidth(labelState, portScale);
      const stateX = Math.max(x + 56, pos.x + nodeSize.width - padX - stateWidth);
      gl.uniform4f(colorLoc, cMuted[0], cMuted[1], cMuted[2], cMuted[3]);
      drawText(labelState, stateX, yA, portScale);

      for (let i = 0; i < node.inputCount; i++) {
        const inputId = node.inputs[i]?.inputId ?? i + 1;
        const label = this._getPortLabel(node.id, "input", inputId, i);
        const p = this._getPortCenter(node, pos, true, i);
        const baselineY = p.y + portPx * 0.35;
        const startX = p.x + iconHalf + labelOffset;
        drawText(label, startX, baselineY, portScale);
      }

      for (let i = 0; i < node.outputCount; i++) {
        const outputId = node.outputs[i]?.outputId ?? i + 1;
        const label = node.kind === NG.NODE_VALUE
          ? (this._getStoredNodeValue(node.id, outputId) || "value")
          : this._getPortLabel(node.id, "output", outputId, i);
        const p = this._getPortCenter(node, pos, false, i);
        const baselineY = p.y + portPx * 0.35;
        const labelWidth = this._measureTextWidth(label, portScale);
        const endX = p.x - iconHalf - labelOffset;
        drawText(label, endX - labelWidth, baselineY, portScale);
      }

    }
  }

  _emitSelectionChanged() {
    this._syncSelectionActionButtons();
    this.dispatchEvent(new CustomEvent("ng-selection-change", {
      bubbles: true,
      composed: true,
      detail: { selectedNodeIds: this.getSelectedNodeIds() },
    }));
  }

  _syncSelectionActionButtons() {
    const hasSelection = this.selectedNodeIds?.size > 0;
    const editBtn = this.queryHeaderControl('[data-action="edit"]');
    if (editBtn) editBtn.disabled = !hasSelection;
    const deleteBtn = this.queryHeaderControl('[data-action="delete"]');
    if (deleteBtn) deleteBtn.disabled = !hasSelection;
  }

  async _hydrateSerializedGraphCodeNodes(nodes) {
    const list = Array.isArray(nodes) ? nodes : [];
    for (const node of list) {
      if (Number(node?.kind || 0) !== NG.NODE_CODE) continue;
      const codePath = String(node?.codePath || "").trim();
      if (!codePath || node?.code) continue;
      try {
        node.code = await this._readCodeFile(codePath);
      } catch {
        node.code = "";
      }
    }
    return list;
  }

  async _readSavedGraphById(graphId, { fresh = false, hydrateCode = false } = {}) {
    const id = Number(graphId || 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (!fresh && this.graphSnapshotById instanceof Map && this.graphSnapshotById.has(id)) {
      return this.graphSnapshotById.get(id);
    }
    const result = await window.pluginManager.call("sql", "query", `SELECT rowid, name, data, node_count FROM nodegraph2_storage WHERE rowid = ${id}`);
    const csv = this.td.decode(result.output || new Uint8Array());
    const rows = parseCSVLines(csv.trim());
    if (rows.length < 2 || !rows[1][2]) return null;
    try {
      const parsed = JSON.parse(rows[1][2]);
      if (!Array.isArray(parsed)) return null;
      if (hydrateCode) {
        await this._hydrateSerializedGraphCodeNodes(parsed);
      }
      const graph = {
        id,
        name: String(rows[1][1] || "").trim(),
        nodeCount: Number(rows[1][3] || parsed.length || 0),
        nodes: parsed,
      };
      if (!(this.graphSnapshotById instanceof Map)) this.graphSnapshotById = new Map();
      this.graphSnapshotById.set(id, graph);
      return graph;
    } catch {
      return null;
    }
  }

  async _listSavedGraphs() {
    const result = await window.pluginManager.call("sql", "query", "SELECT rowid, name, node_count FROM nodegraph2_storage ORDER BY name");
    const csv = this.td.decode(result.output || new Uint8Array());
    const rows = parseCSVLines(csv.trim());
    const entries = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const name = String(row[1] || row[0] || "").trim();
      if (!name) continue;
      entries.push({ id: Number(row[0] || 0), name, nodeCount: Number(row[2] || 0) });
    }
    return entries;
  }

  async _resolveGraphIdByName(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return 0;
    const graphs = await this._listSavedGraphs();
    const match = graphs.find((entry) => String(entry.name || "") === cleanName);
    return Number(match?.id || 0);
  }

  _buildImportBoundarySummary(nodes) {
    const inputs = [];
    const outputs = [];
    const list = Array.isArray(nodes) ? nodes : [];

    for (const node of list) {
      const kind = Number(node?.kind || 0);
      const nodeId = Number(node?.id || 0);
      const nodeName = String(node?.name || `#${nodeId}`).trim();
      if (kind === NG.NODE_VALUE) {
        const bucket = Array.isArray(node?.outputs) ? node.outputs : [];
        bucket.forEach((port, index) => {
          const outputId = Number(port?.id || index + 1);
          const portName = String(port?.name || `output ${index + 1}`).trim();
          inputs.push({
            nodeId,
            portId: outputId,
            importPortId: encodeImportBoundaryPortId(nodeId, outputId),
            name: bucket.length > 1 ? `${nodeName}.${portName}` : nodeName,
            nodeName,
            portName,
            value: String(port?.value || ""),
          });
        });
      } else if (kind === NG.NODE_GOAL) {
        const bucket = Array.isArray(node?.inputs) ? node.inputs : [];
        bucket.forEach((port, index) => {
          const inputId = Number(port?.id || index + 1);
          const portName = String(port?.name || `input ${index + 1}`).trim();
          outputs.push({
            nodeId,
            portId: inputId,
            importPortId: encodeImportBoundaryPortId(nodeId, inputId),
            name: bucket.length > 1 ? `${nodeName}.${portName}` : nodeName,
            nodeName,
            portName,
          });
        });
      }
    }

    return { inputs, outputs };
  }

  _renderImportBoundarySummary(summary = {}) {
    const inputs = Array.isArray(summary.inputs) ? summary.inputs : [];
    const outputs = Array.isArray(summary.outputs) ? summary.outputs : [];
    const renderItems = (items, kind) => items.map((item, index) => {
      const title = String(item?.name || `${kind} ${index + 1}`);
      const value = kind === "input" ? String(item?.value || "") : "";
      return `
        <li>
          <input type="text" value="${escapeAttribute(title)}" readonly>
          ${kind === "input" ? `<input type="text" value="${escapeAttribute(value)}" readonly placeholder="Default value">` : ""}
        </li>`;
    }).join("");

    return `
      <fieldset>
        <legend>Imported inputs</legend>
        <ul>${renderItems(inputs, "input") || "<li><em>none</em></li>"}</ul>
      </fieldset>
      <fieldset>
        <legend>Imported outputs</legend>
        <ul>${renderItems(outputs, "output") || "<li><em>none</em></li>"}</ul>
      </fieldset>
    `;
  }

  async _loadImportNodeBoundarySummary(graphId) {
    const graph = await this._readSavedGraphById(graphId);
    return this._buildImportBoundarySummary(graph?.nodes || []);
  }

  async _primeImportGraphCache(nodes, stack = new Set()) {
    const list = Array.isArray(nodes) ? nodes : [];
    for (const node of list) {
      if (Number(node?.kind || 0) !== NG.NODE_CALL) continue;
      const graphId = Number(node?.graphId || this._getGraphIdForNode(node?.id) || 0);
      if (!Number.isFinite(graphId) || graphId <= 0 || stack.has(graphId)) continue;
      stack.add(graphId);
      const graph = await this._readSavedGraphById(graphId, { fresh: true, hydrateCode: true });
      if (graph) {
        await this._primeImportGraphCache(graph.nodes || [], stack);
      }
      stack.delete(graphId);
    }
  }

  async _applyImportNodeGraphRef(draft, graphRef) {
    const graphId = Number(graphRef || 0) || 0;
    const graph = graphId > 0 ? await this._readSavedGraphById(graphId) : null;
    const cleanName = String(graph?.name || "").trim();
    const previousGraphName = String(draft?.graphName || "").trim();
    draft.graphId = graph?.id || graphId;
    draft.graphName = cleanName;
    if (!String(draft?.name || "").trim() || String(draft?.name || "").trim() === previousGraphName) {
      draft.name = cleanName;
    }
    draft.inputs = [];
    draft.outputs = [];
    if (!cleanName) {
      draft.graphSummary = { inputs: [], outputs: [] };
      return;
    }
    const summary = this._buildImportBoundarySummary(graph?.nodes || []);
    draft.graphSummary = summary;
    draft.inputs = summary.inputs.map((entry, index) => ({
      inputId: Number(entry.importPortId || index + 1),
      name: entry.name,
      value: entry.value,
    }));
    draft.outputs = summary.outputs.map((entry, index) => ({
      outputId: Number(entry.importPortId || index + 1),
      name: entry.name,
      value: "",
    }));
  }

  _rebuildImportNodePorts(nodeId, summary = {}) {
    if (!this.api || typeof this.api.ng_node_replace !== "function") return 1;
    let err = this.api.ng_node_replace(nodeId, NG.NODE_CALL);
    if (err !== 0) return err;
    for (const [index, entry] of (summary.inputs || []).entries()) {
      err = this.api.ng_input_add(nodeId, Number(entry?.importPortId || index + 1));
      if (err !== 0) return err;
    }
    for (const [index, entry] of (summary.outputs || []).entries()) {
      err = this.api.ng_output_add(nodeId, Number(entry?.importPortId || index + 1));
      if (err !== 0) return err;
    }
    return 0;
  }

}

function getNodeGraphRenderAssets() {
  return {
    theme: {
      clear: [11 / 255, 25 / 255, 34 / 255, 1],
      text: [214 / 255, 236 / 255, 248 / 255, 1],
      textMuted: [147 / 255, 177 / 255, 194 / 255, 1],
      selection: [74 / 255, 199 / 255, 255 / 255, 1],
      edge: [70 / 255, 108 / 255, 132 / 255, 0.95],
      edgeActive: [133 / 255, 192 / 255, 255 / 255, 1],
      edgeSuccess: [44 / 255, 201 / 255, 170 / 255, 0.98],
      edgeError: [255 / 255, 107 / 255, 107 / 255, 0.98],
      edgeStale: [222 / 255, 177 / 255, 95 / 255, 0.98],
    },
    layout: {
      gridColumns: 4,
      gridOriginX: 80,
      gridOriginY: 58,
      gridStepX: 186,
      gridStepY: 112,
      nodeHeaderHeight: 28,
      nodePaddingX: 10,
      nodePaddingY: 8,
    },
    node: {
      width: 146,
      minHeight: 62,
      height: 62,
    },
    ports: {
      emptyIconUrl: "/assets/ng/port-empty.png",
      fullIconUrl: "/assets/ng/port-full.png",
      iconSizePx: 12,
      spacingY: 18,
      rowStartY: 30,
      hitRadiusPx: 16,
      labelOffsetX: 10,
      labelFontPx: 11,
      inputInsetX: 0,
      outputInsetX: 0,
    },
    edge: {
      handleMin: 26,
      handleMax: 180,
      halfWidthPx: 1.7,
      glowPx: 2.2,
      aaPx: 1.0,
      hitRadiusPx: 10,
    },
    text: {
      fontPx: 14,
      aa: 8,
      effect: "fill",
      stroke: 2.5,
      glow: 2,
      shadowX: 4,
      shadowY: -4,
      source: {
        metaUrl: "/assets/ng/atlas-mtsdf.json",
        atlasUrl: "/assets/ng/atlas-mtsdf.png",
        channels: 4,
      },
    },
    nineSlice: {
      textureUrl: "/assets/ng/nine.png",
      left: 8,
      right: 8,
      top: 8,
      bottom: 8,
    },
  };
}

function autoArrangeNodeGraphView(view) {
  if (!view?.api || !view?.memory || !view?.assets || typeof view._readGraph !== "function") return false;

  const graph = view._readGraph();
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!nodes.length) return false;

  const layoutCfg = view.assets?.layout || {};
  const baseX = Number(layoutCfg.gridOriginX || 80);
  const baseY = Number(layoutCfg.gridOriginY || 58);
  const layerGapX = Math.max(0, Math.round(AUTO_ARRANGE_MIN_HORIZONTAL_SPACING_PX));
  const nodeGapY = Math.max(0, Math.round(AUTO_ARRANGE_MIN_VERTICAL_SPACING_PX));
  const componentGapY = Math.max(0, Math.round(nodeGapY * 2));
  const laneGapY = Math.max(0, Math.round(nodeGapY * 0.75));

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sizeById = new Map(nodes.map((node) => [node.id, view._getNodeSize(node)]));
  const incoming = new Map(nodes.map((node) => [node.id, new Set()]));
  const outgoing = new Map(nodes.map((node) => [node.id, new Set()]));
  const undirected = new Map(nodes.map((node) => [node.id, new Set()]));

  for (const edge of edges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to) || edge.from === edge.to) continue;
    incoming.get(edge.to).add(edge.from);
    outgoing.get(edge.from).add(edge.to);
    undirected.get(edge.from).add(edge.to);
    undirected.get(edge.to).add(edge.from);
  }

  const components = [];
  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const stack = [node.id];
    const component = [];
    seen.add(node.id);
    while (stack.length) {
      const nodeId = stack.pop();
      component.push(nodeId);
      for (const nextId of undirected.get(nodeId) || []) {
        if (seen.has(nextId)) continue;
        seen.add(nextId);
        stack.push(nextId);
      }
    }
    components.push(component);
  }

  components.sort((a, b) => compareArrangeComponents(a, b, view, nodeById, incoming, outgoing));

  const placements = new Map();
  let componentTopY = baseY;

  for (const component of components) {
    const componentSet = new Set(component);
    const localIncomingCount = new Map(component.map((nodeId) => {
      let count = 0;
      for (const srcId of incoming.get(nodeId) || []) {
        if (componentSet.has(srcId)) count += 1;
      }
      return [nodeId, count];
    }));
    const localLayers = new Map();
    const queue = component
      .filter((nodeId) => (localIncomingCount.get(nodeId) || 0) === 0)
      .sort((a, b) => compareNodesForArrange(nodeById.get(a), nodeById.get(b), incoming, outgoing));

    while (queue.length) {
      const nodeId = queue.shift();
      const outIds = Array.from(outgoing.get(nodeId) || []).filter((nextId) => componentSet.has(nextId));
      for (const nextId of outIds) {
        const nextLayer = (localLayers.get(nodeId) || 0) + 1;
        localLayers.set(nextId, Math.max(localLayers.get(nextId) || 0, nextLayer));
        const remaining = (localIncomingCount.get(nextId) || 0) - 1;
        localIncomingCount.set(nextId, remaining);
        if (remaining === 0) queue.push(nextId);
      }
      queue.sort((a, b) => compareNodesForArrange(nodeById.get(a), nodeById.get(b), incoming, outgoing));
    }

    for (const nodeId of component) {
      if (localLayers.has(nodeId)) continue;
      const parentLayers = Array.from(incoming.get(nodeId) || [])
        .filter((srcId) => componentSet.has(srcId))
        .map((srcId) => localLayers.get(srcId))
        .filter((value) => Number.isFinite(value));
      if (parentLayers.length) {
        localLayers.set(nodeId, Math.max(...parentLayers) + 1);
        continue;
      }
      const childLayers = Array.from(outgoing.get(nodeId) || [])
        .filter((dstId) => componentSet.has(dstId))
        .map((dstId) => localLayers.get(dstId))
        .filter((value) => Number.isFinite(value));
      localLayers.set(nodeId, childLayers.length ? Math.max(0, Math.min(...childLayers) - 1) : 0);
    }

    const layers = new Map();
    for (const nodeId of component) {
      const layerIndex = Math.max(0, Number(localLayers.get(nodeId) || 0));
      if (!layers.has(layerIndex)) layers.set(layerIndex, []);
      layers.get(layerIndex).push(nodeId);
    }

    const sortedLayerIndexes = Array.from(layers.keys()).sort((a, b) => a - b);
    const rootIds = getArrangeComponentRoots(component, localIncomingCount)
      .sort((a, b) => compareArrangeRoots(a, b, view, nodeById, incoming, outgoing));
    const laneById = assignArrangeLanes(component, sortedLayerIndexes, layers, rootIds, incoming, outgoing, componentSet);

    let previousOrder = null;
    for (const layerIndex of sortedLayerIndexes) {
      const ids = layers.get(layerIndex);
      ids.sort((a, b) => {
        const laneDelta = compareArrangeNodeLanes(a, b, laneById);
        if (laneDelta !== 0) return laneDelta;
        const aScore = neighborBarycenter(a, previousOrder, incoming, componentSet);
        const bScore = neighborBarycenter(b, previousOrder, incoming, componentSet);
        if (aScore !== bScore) return aScore - bScore;
        return compareNodesForArrange(nodeById.get(a), nodeById.get(b), incoming, outgoing);
      });
      previousOrder = new Map(ids.map((nodeId, index) => [nodeId, index]));
    }

    let nextOrder = null;
    for (let i = sortedLayerIndexes.length - 1; i >= 0; i--) {
      const layerIndex = sortedLayerIndexes[i];
      const ids = layers.get(layerIndex);
      ids.sort((a, b) => {
        const laneDelta = compareArrangeNodeLanes(a, b, laneById);
        if (laneDelta !== 0) return laneDelta;
        const aScore = neighborBarycenter(a, nextOrder, outgoing, componentSet);
        const bScore = neighborBarycenter(b, nextOrder, outgoing, componentSet);
        if (aScore !== bScore) return aScore - bScore;
        return compareNodesForArrange(nodeById.get(a), nodeById.get(b), incoming, outgoing);
      });
      nextOrder = new Map(ids.map((nodeId, index) => [nodeId, index]));
    }

    const layerWidths = new Map();
    const layerHeights = new Map();
    for (const layerIndex of sortedLayerIndexes) {
      const ids = layers.get(layerIndex);
      let maxWidth = 0;
      let totalHeight = 0;
      ids.forEach((nodeId, index) => {
        const size = sizeById.get(nodeId) || { width: 146, height: 62 };
        maxWidth = Math.max(maxWidth, Number(size.width || 146));
        totalHeight += Number(size.height || 62);
        if (index > 0) {
          const prevNodeId = ids[index - 1];
          const gap = compareArrangeNodeLanes(prevNodeId, nodeId, laneById) === 0 ? nodeGapY : nodeGapY + laneGapY;
          totalHeight += gap;
        }
      });
      layerWidths.set(layerIndex, maxWidth);
      layerHeights.set(layerIndex, totalHeight);
    }

    const componentHeight = sortedLayerIndexes.reduce(
      (maxHeight, layerIndex) => Math.max(maxHeight, Number(layerHeights.get(layerIndex) || 0)),
      0,
    );

    let layerX = baseX;
    let componentBottomY = componentTopY;
    for (const layerIndex of sortedLayerIndexes) {
      const ids = layers.get(layerIndex);
      const layerHeight = Number(layerHeights.get(layerIndex) || 0);
      let cursorY = componentTopY + Math.max(0, (componentHeight - layerHeight) * 0.5);
      for (const nodeId of ids) {
        const size = sizeById.get(nodeId) || { width: 146, height: 62 };
        placements.set(nodeId, {
          x: Math.round(layerX),
          y: Math.round(cursorY),
          width: Number(size.width || 146),
          height: Number(size.height || 62),
        });
        componentBottomY = Math.max(componentBottomY, cursorY + Number(size.height || 62));
        const currentIndex = ids.indexOf(nodeId);
        if (currentIndex < ids.length - 1) {
          const nextNodeId = ids[currentIndex + 1];
          const gap = compareArrangeNodeLanes(nodeId, nextNodeId, laneById) === 0 ? nodeGapY : nodeGapY + laneGapY;
          cursorY += Number(size.height || 62) + gap;
        }
      }
      layerX += Number(layerWidths.get(layerIndex) || 146) + layerGapX;
    }

    componentTopY = componentBottomY + componentGapY;
  }

  for (const node of nodes) {
    const placement = placements.get(node.id);
    if (!placement) continue;
    view.nodeLayout.set(node.id, placement);
  }

  view.requestRenderIfGenerationChanged(true);
  view.fitToContent();
  return true;
}

function compareNodesForArrange(a, b, incoming, outgoing) {
  const aKindRank = getNodeArrangeKindRank(a);
  const bKindRank = getNodeArrangeKindRank(b);
  if (aKindRank !== bKindRank) return aKindRank - bKindRank;

  const aIncoming = incoming.get(a?.id)?.size || 0;
  const bIncoming = incoming.get(b?.id)?.size || 0;
  if (aIncoming !== bIncoming) return aIncoming - bIncoming;

  const aOutgoing = outgoing.get(a?.id)?.size || 0;
  const bOutgoing = outgoing.get(b?.id)?.size || 0;
  if (aOutgoing !== bOutgoing) return bOutgoing - aOutgoing;

  return Number(a?.id || 0) - Number(b?.id || 0);
}

function compareArrangeComponents(a, b, view, nodeById, incoming, outgoing) {
  const aY = getArrangeComponentAnchorY(a, view);
  const bY = getArrangeComponentAnchorY(b, view);
  if (aY !== bY) return aY - bY;

  const aRoots = getArrangeComponentRoots(a, incoming);
  const bRoots = getArrangeComponentRoots(b, incoming);

  const aRootRank = getArrangeRootGroupRank(aRoots, nodeById);
  const bRootRank = getArrangeRootGroupRank(bRoots, nodeById);
  if (aRootRank !== bRootRank) return aRootRank - bRootRank;

  if (aRoots.length !== bRoots.length) return aRoots.length - bRoots.length;
  if (a.length !== b.length) return b.length - a.length;

  const aOutputWeight = getArrangeComponentOutputWeight(a, outgoing);
  const bOutputWeight = getArrangeComponentOutputWeight(b, outgoing);
  if (aOutputWeight !== bOutputWeight) return bOutputWeight - aOutputWeight;

  const aMinId = Math.min(...a);
  const bMinId = Math.min(...b);
  return aMinId - bMinId;
}

function compareArrangeRoots(aNodeId, bNodeId, view, nodeById, incoming, outgoing) {
  const aY = getArrangeNodeCurrentY(aNodeId, view);
  const bY = getArrangeNodeCurrentY(bNodeId, view);
  if (aY !== bY) return aY - bY;
  return compareNodesForArrange(nodeById.get(aNodeId), nodeById.get(bNodeId), incoming, outgoing);
}

function getArrangeComponentAnchorY(component, view) {
  let bestY = Number.POSITIVE_INFINITY;
  for (const nodeId of component) {
    bestY = Math.min(bestY, getArrangeNodeCurrentY(nodeId, view));
  }
  return Number.isFinite(bestY) ? bestY : Number.POSITIVE_INFINITY;
}

function getArrangeNodeCurrentY(nodeId, view) {
  const pos = view?.nodeLayout?.get(nodeId);
  const y = Number(pos?.y);
  if (Number.isFinite(y)) return y;
  return Number(nodeId) || 0;
}

function getArrangeComponentRoots(component, incoming) {
  const roots = component.filter((nodeId) => (incoming.get(nodeId)?.size || 0) === 0);
  return roots.length ? roots : [...component];
}

function assignArrangeLanes(component, sortedLayerIndexes, layers, rootIds, incoming, outgoing, componentSet) {
  const laneById = new Map();
  rootIds.forEach((nodeId, index) => {
    laneById.set(nodeId, index);
  });

  for (const layerIndex of sortedLayerIndexes) {
    for (const nodeId of layers.get(layerIndex) || []) {
      if (laneById.has(nodeId)) continue;
      const parentLanes = Array.from(incoming.get(nodeId) || [])
        .filter((srcId) => componentSet.has(srcId) && laneById.has(srcId))
        .map((srcId) => laneById.get(srcId));
      if (parentLanes.length) {
        laneById.set(nodeId, selectArrangeLane(parentLanes));
      }
    }
  }

  for (let i = sortedLayerIndexes.length - 1; i >= 0; i--) {
    for (const nodeId of layers.get(sortedLayerIndexes[i]) || []) {
      if (laneById.has(nodeId)) continue;
      const childLanes = Array.from(outgoing.get(nodeId) || [])
        .filter((dstId) => componentSet.has(dstId) && laneById.has(dstId))
        .map((dstId) => laneById.get(dstId));
      if (childLanes.length) {
        laneById.set(nodeId, selectArrangeLane(childLanes));
      }
    }
  }

  const fallbackLane = rootIds.length > 0 ? 0 : Math.max(0, Math.floor(component.length * 0.5));
  for (const nodeId of component) {
    if (!laneById.has(nodeId)) laneById.set(nodeId, fallbackLane);
  }
  return laneById;
}

function selectArrangeLane(lanes) {
  const counts = new Map();
  for (const lane of lanes) {
    const numericLane = Number(lane);
    if (!Number.isFinite(numericLane)) continue;
    counts.set(numericLane, (counts.get(numericLane) || 0) + 1);
  }
  let bestLane = 0;
  let bestCount = -1;
  for (const [lane, count] of counts) {
    if (count > bestCount || (count === bestCount && lane < bestLane)) {
      bestLane = lane;
      bestCount = count;
    }
  }
  return bestLane;
}

function compareArrangeNodeLanes(aNodeId, bNodeId, laneById) {
  const aLane = Number(laneById.get(aNodeId) || 0);
  const bLane = Number(laneById.get(bNodeId) || 0);
  if (aLane !== bLane) return aLane - bLane;
  return 0;
}

function getArrangeRootGroupRank(rootIds, nodeById) {
  let rank = Number.POSITIVE_INFINITY;
  for (const nodeId of rootIds) {
    rank = Math.min(rank, getNodeArrangeKindRank(nodeById.get(nodeId)));
  }
  return Number.isFinite(rank) ? rank : 99;
}

function getArrangeComponentOutputWeight(component, outgoing) {
  let total = 0;
  for (const nodeId of component) {
    total += outgoing.get(nodeId)?.size || 0;
  }
  return total;
}

function getNodeArrangeKindRank(node) {
  if (!node) return 99;
  if (node.kind === NG.NODE_VALUE) return 0;
  if (node.kind === NG.NODE_CODE) return 1;
  if (node.kind === NG.NODE_GOAL) return 2;
  return 3;
}

function neighborBarycenter(nodeId, orderMap, adjacency, componentSet) {
  if (!(orderMap instanceof Map) || orderMap.size === 0) return Number.POSITIVE_INFINITY;
  const neighbors = Array.from(adjacency.get(nodeId) || []).filter((neighborId) => componentSet.has(neighborId));
  let total = 0;
  let count = 0;
  for (const neighborId of neighbors) {
    const order = orderMap.get(neighborId);
    if (!Number.isFinite(order)) continue;
    total += order;
    count += 1;
  }
  return count > 0 ? total / count : Number.POSITIVE_INFINITY;
}

export default ViewNodeGraph2;
