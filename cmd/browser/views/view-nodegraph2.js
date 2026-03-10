import { toast } from '../systems/toast.js'
import { ViewCanvasBase } from "./view-canvas-base.js";
import { createWasiPreview1Imports } from "../util/wasi.js";
import { parseCSVLines } from "../util/csv.js";
import "./code-editor.js";

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
  NODE_VALUE: 4,
};

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
      offsetXPx: widthPx * 0.5 + widthPx * Number(pb.left),
      baselineOffsetYPx: -(heightPx * 0.5 + heightPx * Number(pb.bottom)),
      advancePx,
    });
  }

  return map;
}

class ViewNodeGraph2 extends ViewCanvasBase {
  static get viewMeta() {
    return { displayName: "Node Graph 2", category: "Canvas" };
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
    this.connectionDrag = null;

    this.td = new TextDecoder();
    this.te = new TextEncoder();
    this.sourceByNode = new Map([[1, 'print("hello from node-code")']]);
    this.valueByNode = new Map([
      [7, new Map([[1, "https://example.com/a"]])],
      [8, new Map([[1, "https://example.com/b"]])],
      [9, new Map([[1, "https://example.com/c"]])],
    ]);
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
    `;
    return controls;
  }

  setupUI() {
    this.canvas.style.touchAction = "none";
  }

  async connectedCallback() {
    super.connectedCallback();

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
    if (resetBtn) resetBtn.onclick = () => this.setupGraph();

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
        .then(() => this.requestRenderIfGenerationChanged(true))
        .catch(() => {
          toast.error("Failed to load Node Graph 2 render assets.");
        });
    }
  }

  setNodeLayoutMap(map) {
    this.nodeLayout = map;
    this.requestRenderIfGenerationChanged(true);
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
    this.setupGraph();
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
    let response = "";
    try {
      const result = await window.pluginManager.call(service, method, payloadJson || "");
      const output = result?.output instanceof Uint8Array
        ? result.output
        : new Uint8Array(result?.output || []);
      response = this.td.decode(output);
    } catch (error) {
      response = JSON.stringify({ ok: false, error: String(error?.message || error) });
    }

    const ptr = this.api.ng_get_io_ptr();
    const bytes = this.te.encode(response);
    const len = Math.min(bytes.length, 65535);
    new Uint8Array(this.memory.buffer, ptr, len).set(bytes.subarray(0, len));
    this.api.ng_run_response(requestId, ptr, len);
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

  setupGraph() {
    if (!this.api) return;
    if (this.selectedNodeIds.size > 0) {
      this.selectedNodeIds.clear();
      this._emitSelectionChanged();
    } else {
      this._syncSelectionActionButtons();
    }
    this.goalRunQueue = [];
    this.ioToastOffset = 0;
    let err = this.api.ng_init();
    if (err !== 0) return;
    err = this.api.ng_clear_graph();
    if (err !== 0) return;

    const ops = [
      () => this.api.ng_node_create(1, 2),
      () => this.api.ng_output_add(1, 1),
      () => this.api.ng_output_add(1, 2),
      () => this.api.ng_node_create(2, 1),
      () => this.api.ng_input_add(2, 1),
      () => this.api.ng_input_add(2, 2),
      () => this.api.ng_input_connect(2, 1, 1, 1),
      () => this.api.ng_node_create(3, 2),
      () => this.api.ng_input_add(3, 1),
      () => this.api.ng_input_add(3, 2),
      () => this.api.ng_output_add(3, 1),
      () => this.api.ng_output_add(3, 2),
      () => this.api.ng_output_add(3, 3),
      () => this.api.ng_input_connect(3, 1, 1, 2),
      () => this.api.ng_node_create(4, 1),
      () => this.api.ng_input_add(4, 1),
      () => this.api.ng_input_connect(4, 1, 3, 2),
      () => this.api.ng_node_create(5, 2),
      () => this.api.ng_output_add(5, 1),
      () => this.api.ng_node_create(6, 1),
      () => this.api.ng_input_add(6, 1),
      () => this.api.ng_input_add(6, 2),
      () => this.api.ng_input_connect(6, 1, 3, 1),
      () => this.api.ng_input_connect(6, 2, 5, 1),
      () => this.api.ng_node_create(7, 4),
      () => this.api.ng_output_add(7, 1),
      () => this.api.ng_node_create(8, 4),
      () => this.api.ng_output_add(8, 1),
      () => this.api.ng_node_create(9, 4),
      () => this.api.ng_output_add(9, 1),
      () => this.api.ng_node_create(10, 1),
      () => this.api.ng_input_add(10, 1),
      () => this.api.ng_input_add(10, 2),
      () => this.api.ng_input_add(10, 3),
      () => this.api.ng_input_connect(10, 1, 7, 1),
      () => this.api.ng_input_connect(10, 2, 8, 1),
      () => this.api.ng_input_connect(10, 3, 9, 1),
    ];

    for (const op of ops) {
      err = op();
      if (err !== 0) break;
    }
    this.requestRenderIfGenerationChanged(true);
  }

  runGraph() {
    if (!this.api) return;
    const selectedGoals = this._getSelectedGoalNodeIds();
    this.goalRunQueue = [];

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
    return "code";
  }

  _kindFromFormValue(value, fallback = NG.NODE_CODE) {
    if (value === "value") return NG.NODE_VALUE;
    if (value === "goal") return NG.NODE_GOAL;
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
      code: "",
      newInputName: "",
      newOutputName: "",
      newOutputValue: "",
      inputs: [],
      outputs: [],
    };
  }

  _captureNodeDraftFromForm(draft, form) {
    if (!draft || !form) return;
    const formData = new FormData(form);
    draft.name = String(formData.get("name") || "").trim();
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
    const kind = rawKind === NG.NODE_VALUE || rawKind === NG.NODE_GOAL || rawKind === NG.NODE_CODE
      ? rawKind
      : fallbackKind;
    const normalized = this._createNodeDraft(kind);
    normalized.name = String(payload?.name || "").trim();
    normalized.code = String(payload?.code || "");

    const inputList = Array.isArray(payload?.inputs) ? payload.inputs : [];
    const outputList = Array.isArray(payload?.outputs) ? payload.outputs : [];

    normalized.inputs = inputList.map((input, index) => {
      const inputId = Number(input?.inputId || input?.id || index + 1);
      return {
        inputId: Number.isFinite(inputId) && inputId > 0 ? inputId : index + 1,
        name: String(input?.name || "").trim(),
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

    return normalized;
  }

  _applyNodeTemplateToDraft(draft, templateEntry) {
    const payload = this._normalizeNodeTemplatePayload(templateEntry?.data, Number(templateEntry?.kind || NG.NODE_CODE));
    draft.kind = payload.kind;
    draft.templateName = String(templateEntry?.name || "").trim();
    draft.name = payload.name;
    draft.code = payload.code;
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
      code: String(draft?.code || ""),
      inputs: (draft?.inputs || []).map((port, index) => ({
        inputId: Number(port?.inputId || index + 1),
        name: String(port?.name || "").trim(),
      })),
      outputs: (draft?.outputs || []).map((port, index) => ({
        outputId: Number(port?.outputId || index + 1),
        name: String(port?.name || "").trim(),
        value: String(port?.value || ""),
      })),
    };
  }

  _getBuiltinNodeTemplates() {
    const luaDemo = String.raw`-- Demo: query tilemaps via SQL, parse CSV, decode tilemap JSON.
-- Requires ng runtime helpers: csv.parse, json.decode, json.encode.

local sql = "SELECT name, data FROM tilemap_storage ORDER BY name LIMIT 8"
local csvText = host.awaitCall("sql", "query", sql)
local rows = csv.parse(csvText, { headers = true })

local items = {}
for i, row in ipairs(rows) do
  local name = row.name or ("row_" .. i)
  local ok, tilemap = pcall(json.decode, row.data or "{}")
  if ok and type(tilemap) == "table" then
    local layers = tilemap.layers or {}
    items[#items + 1] = {
      name = name,
      layerCount = #layers,
      width = (layers[1] and layers[1].width) or 0,
      tileCount = (layers[1] and #(layers[1].data or {})) or 0,
    }
  else
    items[#items + 1] = {
      name = name,
      error = "invalid tilemap json",
    }
  end
end

outputs[1] = json.encode(items)
outputs[2] = json.encode({ count = #items })
`;

    const respackDemo = String.raw`-- Demo: initialize respack, write a payload, and generate an Odin decoder.
-- Text-only on purpose: respack.dump returns binary bytes, while this demo keeps
-- everything JSON/string based for the current nodegraph host bridge.

local schema = [[
{
  "package": "respacktest",
  "types": {
    "Vec2": {
      "type": "struct",
      "fields": {
        "x": "f32",
        "y": "f32"
      }
    },
    "CircleShape": {
      "type": "struct",
      "fields": {
        "radius": "f32"
      }
    },
    "RectShape": {
      "type": "struct",
      "fields": {
        "size": "Vec2"
      }
    },
    "Shape": {
      "type": "oneof",
      "value": ["CircleShape", "RectShape"]
    },
    "ColorRGB": {
      "type": "array",
      "len": 3,
      "value": "u8"
    },
    "Bundle": {
      "type": "struct",
      "fields": {
        "points": {
          "type": "vector",
          "value": "Vec2"
        },
        "blob": {
          "type": "bytes",
          "max_len": 64
        },
        "label": {
          "type": "string"
        },
        "text_blob": {
          "type": "bytes",
          "max_len": 16
        },
        "shape": "Shape",
        "palette": {
          "type": "vector",
          "value": "ColorRGB"
        }
      }
    }
  },
  "data": ["Bundle"]
}
]]

local payload = {
  points = {
    { x = 3.5, y = -2.0 },
    { x = 10.25, y = 8.75 },
  },
  blob = { 0, 17, 34, 51, 200, 255 },
  label = "line\\n2",
  text_blob = "line\\n2",
  shape = {
    rect = {
      size = { x = 6.0, y = 9.5 }
    }
  },
  palette = {
    { 255, 0, 128 },
    { 12, 34, 56 },
    { 1, 2, 3 },
  }
}

local initResult = host.awaitCall("respack", "init", schema)
local writeResult = host.awaitCall("respack", "write", json.encode({
  slot = 0,
  payload = payload,
}))
local odinSource = host.awaitCall("respack", "generate_odin", "main")

outputs[1] = odinSource
outputs[2] = json.encode({
  init = initResult,
  write = writeResult,
  package = "main",
  slot = 0,
  schema = "Bundle",
  generated_bytes = #odinSource,
})
`;

    return [
      {
        name: "tilemap sql parse demo",
        kind: NG.NODE_CODE,
        data: {
          kind: NG.NODE_CODE,
          name: "tilemap sql parse demo",
          code: luaDemo,
          inputs: [],
          outputs: [
            { outputId: 1, name: "items" },
            { outputId: 2, name: "stats" },
          ],
        },
      },
      {
        name: "respack text demo",
        kind: NG.NODE_CODE,
        data: {
          kind: NG.NODE_CODE,
          name: "respack text demo",
          code: respackDemo,
          inputs: [],
          outputs: [
            { outputId: 1, name: "odin_source" },
            { outputId: 2, name: "status" },
          ],
        },
      },
    ];
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

    const form = document.createElement("form");
    const draft = this._createNodeDraft(NG.NODE_CODE);

    const renderForm = () => {
      const isCodeNode = draft.kind === NG.NODE_CODE;
      const isValueNode = draft.kind === NG.NODE_VALUE;
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
       ${isCodeNode ? `
       <code-editor name="code" lang="lua" rows="12" spellcheck="false" placeholder="-- Lua code. Read inputs via inputs[<id>] and write outputs via outputs[<id>].">${escapeAttribute(draft.code)}</code-editor>
       ` : ""}
       ${this._nodeSupportsInputs(draft.kind) ? `
       <fieldset>
         <legend>Inputs</legend>
         <ul>
           <li>
             <input type="text" name="new-input-name" value="${escapeAttribute(draft.newInputName)}" placeholder="Input name">
             <button type="submit" name="intent" value="add-input" aria-label="Add input" title="Add input" ${String(draft.newInputName).trim() ? "" : "disabled"}><i aria-hidden="true">add</i></button>
           </li>
           ${draft.inputs.map((port, index) => `
           <li>
             <input type="hidden" name="input-port-id" value="${Number(port.inputId || index + 1)}">
             <input type="text" name="input-port-name" value="${escapeAttribute(port.name || "")}" placeholder="Input ${index + 1}">
             <button type="submit" name="remove-input-id" value="${Number(port.inputId || index + 1)}" aria-label="Delete input ${index + 1}" title="Delete input"><i aria-hidden="true">delete</i></button>
           </li>`).join("")}
         </ul>
       </fieldset>` : ""}
       ${this._nodeSupportsOutputs(draft.kind) ? `
       <fieldset>
         <legend>Outputs</legend>
         <ul>
           <li>
             ${isValueNode
            ? `<input type="text" name="new-output-value" value="${escapeAttribute(draft.newOutputValue)}" placeholder="Value">`
            : `<input type="text" name="new-output-name" value="${escapeAttribute(draft.newOutputName)}" placeholder="Output name">`}
             <button type="submit" name="intent" value="add-output" aria-label="Add output" title="Add output" ${!isValueNode && !String(draft.newOutputName).trim() ? "disabled" : ""}><i aria-hidden="true">add</i></button>
           </li>
           ${draft.outputs.map((port, index) => `
           <li>
             <input type="hidden" name="output-port-id" value="${Number(port.outputId || index + 1)}">
             ${isValueNode
                ? `<input type="text" name="output-port-value" value="${escapeAttribute(port.value || "")}" placeholder="Value ${index + 1}">`
                : `<input type="text" name="output-port-name" value="${escapeAttribute(port.name || "")}" placeholder="Output ${index + 1}">`}
             <button type="submit" name="remove-output-id" value="${Number(port.outputId || index + 1)}" aria-label="Delete output ${index + 1}" title="Delete output"><i aria-hidden="true">delete</i></button>
           </li>`).join("")}
         </ul>
       </fieldset>` : ""}
       <footer>
         <button type="submit" name="intent" value="create-node" class="accent">Create</button>
       </footer>
      `;

      const kindSelect = form.querySelector('[name="node-kind"]');
      if (kindSelect) {
        kindSelect.onchange = () => {
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
            renderForm();
            return;
          }

          const previousKind = draft.kind;
          draft.kind = this._kindFromFormValue(selectedValue, draft.kind);
          draft.templateName = "";
          if (draft.kind !== previousKind) {
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

    form.onsubmit = (event) => {
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

      const nodeId = this._nextAvailableNodeId();
      if (nodeId <= 0) {
        toast.error("Could not allocate a node id.");
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

      if (draft.kind === NG.NODE_VALUE) {
        const bucket = new Map();
        for (const port of draft.outputs) {
          bucket.set(Number(port.outputId), String(port.value || ""));
        }
        if (!(this.valueByNode instanceof Map)) this.valueByNode = new Map();
        this.valueByNode.set(nodeId, bucket);
      }

      if (draft.kind === NG.NODE_CODE) {
        this.sourceByNode.set(nodeId, String(draft.code || ""));
      }

      this.nodeNames.set(nodeId, String(draft.name || "").trim());
      const tempNode = {
        kind: draft.kind,
        inputCount: draft.inputs.length,
        outputCount: draft.outputs.length,
      };
      const nodeSize = this._getNodeSize(tempNode);
      const center = this._viewportCenterWorld();
      this.nodeLayout.set(nodeId, {
        x: Math.round(center.x - nodeSize.width * 0.5),
        y: Math.round(center.y - nodeSize.height * 0.5),
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
        code: node.kind === NG.NODE_CODE ? String(this.sourceByNode.get(node.id) || "") : "",
        inputs: (node.inputs || []).map((input, i) => ({
          id: Number(input?.inputId || i + 1),
          name: this._getStoredPortLabel(node.id, "input", Number(input?.inputId || i + 1)),
          srcNodeId: Number(input?.srcNodeId || 0),
          srcOutputId: Number(input?.srcOutputId || 0),
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

  _applySerializedGraph(nodes) {
    if (!this.api || !Array.isArray(nodes)) return 1;

    let err = this.api.ng_clear_graph();
    if (err !== 0) return err;

    this.goalRunQueue = [];
    this.ioToastOffset = 0;
    this.connectionDrag = null;
    this.hoverPick = null;

    this.selectedNodeIds.clear();
    this.nodeLayout = new Map();
    this.nodeNames = new Map();
    this.portLabels = new Map();
    this.sourceByNode = new Map();
    this.valueByNode = new Map();
    this._emitSelectionChanged();

    const sorted = [...nodes].sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
    const availableIds = new Set(sorted.map((node) => Number(node?.id || 0)));

    for (const raw of sorted) {
      const nodeId = Number(raw?.id || 0);
      const kind = Number(raw?.kind || 0);
      if (!Number.isFinite(nodeId) || nodeId <= 0) continue;
      if (kind !== NG.NODE_CODE && kind !== NG.NODE_GOAL && kind !== NG.NODE_VALUE) continue;

      err = this.api.ng_node_create(nodeId, kind);
      if (err !== 0) return err;

      const inputs = Array.isArray(raw?.inputs) ? raw.inputs : [];
      const outputs = Array.isArray(raw?.outputs) ? raw.outputs : [];

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

      if (kind === NG.NODE_CODE) {
        this.sourceByNode.set(nodeId, String(raw?.code || ""));
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
    this.fitToContent();
    return 0;
  }

  async saveGraphByName(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return 1;
    const payload = this._serializeGraphNodes();
    const json = JSON.stringify(payload);
    const escapedName = cleanName.replace(/'/g, "''");
    const escapedJson = json.replace(/'/g, "''");
    const sql = `INSERT OR REPLACE INTO nodegraph2_storage (name, data, node_count, updated_at) VALUES ('${escapedName}', '${escapedJson}', ${payload.length}, datetime('now'))`;
    await window.pluginManager.call("sql", "exec", sql);
    return 0;
  }

  async loadGraphByName(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return 1;
    const escapedName = cleanName.replace(/'/g, "''");
    const result = await window.pluginManager.call("sql", "query", `SELECT data FROM nodegraph2_storage WHERE name = '${escapedName}'`);
    const csv = this.td.decode(result.output || new Uint8Array());
    const rows = parseCSVLines(csv.trim());
    if (rows.length < 2 || rows[1].length < 1) return 1;
    const parsed = JSON.parse(rows[1][0]);
    if (!Array.isArray(parsed)) return 1;
    return this._applySerializedGraph(parsed);
  }

  async saveNodeTemplateByName(name, draftLike) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return 1;
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

  async listNodeTemplates() {
    const builtins = this._getBuiltinNodeTemplates();
    const result = await window.pluginManager.call("sql", "query", "SELECT name, kind, data FROM nodegraph2_node_templates ORDER BY name");
    const csv = this.td.decode(result.output || new Uint8Array());
    const rows = parseCSVLines(csv.trim());
    const entries = [];
    const byName = new Map();

    for (const entry of builtins) {
      const name = String(entry?.name || "").trim();
      if (!name) continue;
      const kind = Number(entry?.kind || NG.NODE_CODE);
      const data = this._serializeNodeTemplateDraft(this._normalizeNodeTemplatePayload(entry?.data || {}, kind));
      const normalized = { name, kind: Number(data.kind || kind || NG.NODE_CODE), data };
      byName.set(name, normalized);
      entries.push(normalized);
    }

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
      if (byName.has(name)) {
        const idx = entries.findIndex((entry) => entry.name === name);
        if (idx >= 0) entries[idx] = normalized;
      } else {
        entries.push(normalized);
      }
      byName.set(name, normalized);
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
    form.innerHTML = `
      <p>Save current node graph.</p>
      <label>
        Graph name
        <input type="text" name="graph-name" placeholder="Enter graph name" required>
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
    if (!popupManager) return;

    let entries = [];
    try {
      const result = await window.pluginManager.call("sql", "query", "SELECT name, node_count FROM nodegraph2_storage ORDER BY name");
      const csv = this.td.decode(result.output || new Uint8Array());
      const rows = parseCSVLines(csv.trim());
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || [];
        if (!row[0]) continue;
        entries.push({ name: row[0], nodeCount: Number(row[1] || 0) });
      }
    } catch (error) {
      toast.error(`Failed to load saved graph list: ${String(error?.message || error)}`);
      return;
    }

    const content = document.createElement("div");
    if (!entries.length) {
      content.innerHTML = `<p>No saved node graphs yet.</p>`;
    } else {
      content.innerHTML = entries.map((entry) => `
        <button type="button" data-name="${escapeAttribute(entry.name)}">
          <strong>${escapeAttribute(entry.name)}</strong>
          <span>${entry.nodeCount} node${entry.nodeCount === 1 ? "" : "s"}</span>
        </button>
      `).join("");
    }

    const popup = popupManager.showPopup({
      title: "Load node graph",
      content,
      size: "medium",
    });

    content.querySelectorAll("button[data-name]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const name = String(btn.getAttribute("data-name") || "");
        if (!name) return;
        try {
          const err = await this.loadGraphByName(name);
          if (err !== 0) {
            toast.error(`Failed to load graph \"${name}\" (code ${err}).`);
            return;
          }
          toast.success(`Loaded graph \"${name}\".`);
          popup.close();
        } catch (error) {
          toast.error(`Failed to load graph: ${String(error?.message || error)}`);
        }
      });
    });
  }

  showEditNodePopup(forcedNodeId = null) {
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

    const form = document.createElement("form");
    const renderForm = (
      currentNode,
      currentName,
      {
        newInputName = "",
        newOutputName = "",
        newOutputValue = "",
        code = null,
      } = {}
    ) => {
      const isCodeNode = currentNode.kind === NG.NODE_CODE;
      const isValueNode = currentNode.kind === NG.NODE_VALUE;
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
        ${isCodeNode ? `
        <code-editor name="code" lang="lua" rows="12" spellcheck="false" placeholder="-- Lua code. Read inputs via inputs[<id>] and write outputs via outputs[<id>].">${escapeAttribute(code === null || code === undefined ? (this.sourceByNode.get(currentNode.id) || "") : String(code))}</code-editor>
        ` : ""}
       ${this._nodeSupportsInputs(currentNode.kind) ? `
       <fieldset>
         <legend>Inputs</legend>
         <ul>
           <li>
               <input type="text" name="new-input-name" value="${escapeAttribute(newInputName)}" placeholder="Input name">
             <button type="submit" name="intent" value="add-input" aria-label="Add input" title="Add input" ${String(newInputName).trim() ? "" : "disabled"}><i aria-hidden="true">add</i></button>
           </li>
           ${currentNode.inputs.map((port, index) => `
           <li>
             <input type="hidden" name="input-port-id" value="${Number(port.inputId || index + 1)}">
             <input type="text" name="input-port-name" value="${escapeAttribute(this._getPortEditorDefaultLabel(currentNode.id, "input", Number(port.inputId || index + 1), index))}" placeholder="Input ${index + 1}">
             <button type="submit" name="remove-input-id" value="${Number(port.inputId || index + 1)}" aria-label="Delete input ${index + 1}" title="Delete input"><i aria-hidden="true">delete</i></button>
           </li>`).join("")}
         </ul>
       </fieldset>` : ""}
       ${this._nodeSupportsOutputs(currentNode.kind) ? `
       <fieldset>
          <legend>Outputs</legend>
          <ul>
            <li> 
              ${isValueNode
            ? `<input type="text" name="new-output-value" value="${escapeAttribute(newOutputValue)}" placeholder="Value">`
            : `<input type="text" name="new-output-name" value="${escapeAttribute(newOutputName)}" placeholder="Output name">`}
              <button type="submit" name="intent" value="add-output" aria-label="Add output" title="Add output"><i aria-hidden="true">add</i></button>
            </li>
            ${currentNode.outputs.map((port, index) => `
            <li>
              <input type="hidden" name="output-port-id" value="${Number(port.outputId || index + 1)}">
              ${isValueNode
                ? `<input type="text" name="output-port-value" value="${escapeAttribute(this._getStoredNodeValue(currentNode.id, Number(port.outputId || index + 1)))}" placeholder="Value ${index + 1}">`
                : `<input type="text" name="output-port-name" value="${escapeAttribute(this._getPortEditorDefaultLabel(currentNode.id, "output", Number(port.outputId || index + 1), index))}" placeholder="Output ${index + 1}">`}
              <button type="submit" name="remove-output-id" value="${Number(port.outputId || index + 1)}" aria-label="Delete output ${index + 1}" title="Delete output"><i aria-hidden="true">delete</i></button>
            </li>`).join("")}
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

      if (intent === "save-template") {
        const draft = this._createNodeDraft(current.kind);
        this._captureNodeDraftFromForm(draft, form);
        draft.kind = current.kind;
        draft.code = pendingCode ?? "";
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
        this._savePortNamesFromForm(nodeId, formData, current.kind);
        if (current.kind === NG.NODE_VALUE) {
          this._saveOutputValuesFromForm(nodeId, formData);
        }
        if (current.kind === NG.NODE_CODE) {
          this.sourceByNode.set(nodeId, pendingCode ?? "");
          if (this.api?.ng_exec_clear) {
            this.api.ng_exec_clear(nodeId, 1);
          }
        }
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
        });
      }
    };
  }

  _getNodeKindLabel(kind) {
    if (kind === NG.NODE_CODE) return "node-code";
    if (kind === NG.NODE_GOAL) return "node-goal";
    if (kind === NG.NODE_VALUE) return "node-value"
    return "node";
  }

  _nodeSupportsInputs(kind) {
    return kind === NG.NODE_CODE || kind === NG.NODE_GOAL;
  }

  _nodeSupportsOutputs(kind) {
    return kind === NG.NODE_CODE || kind === NG.NODE_VALUE;
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
    const layout = this.assets.layout;
    const col = index % layout.gridColumns;
    const row = Math.floor(index / layout.gridColumns);
    const pos = {
      x: layout.gridOriginX + col * layout.gridStepX,
      y: layout.gridOriginY + row * layout.gridStepY,
    };
    this.nodeLayout.set(nodeId, pos);
    return pos;
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
    const nodeCfg = this.assets.node;
    const layout = this.assets.layout || {};
    const ports = this.assets.ports;
    const width = Number(nodeCfg.width || 146);
    const minHeight = Number(nodeCfg.minHeight || nodeCfg.height || 62);
    const rowCount = Math.max(node.inputCount || 0, node.outputCount || 0);
    if (rowCount <= 0) return { width, height: minHeight };

    const rowStartY = Number(ports.rowStartY || ((layout.nodeHeaderHeight || 28) + 2));
    const spacingY = Number(ports.spacingY || 18);
    const iconSizePx = Number(ports.iconSizePx || 12);
    const nodePaddingY = Number(layout.nodePaddingY || 8);
    const lastPortCenterY = rowStartY + (rowCount - 1) * spacingY;
    const requiredHeight = lastPortCenterY + iconSizePx * 0.5 + nodePaddingY;
    return { width, height: Math.max(minHeight, Math.ceil(requiredHeight)) };
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

    const measureTextWidth = (text, scale) => {
      let widthPx = 0;
      for (const ch of text) {
        const g = glyphs.get(ch.codePointAt(0));
        if (!g) {
          widthPx += atlasSize * 0.3 * scale;
          continue;
        }
        widthPx += g.advancePx * scale;
      }
      return widthPx;
    };

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
      const kindLabel = node.kind === NG.NODE_CODE
        ? "code"
        : node.kind === NG.NODE_GOAL
          ? "goal"
          : node.kind === NG.NODE_VALUE
            ? "value"
            : "node";
      const customName = (this.nodeNames.get(node.id) || "").trim();
      const labelA = customName ? `${customName} (#${node.id})` : `${kindLabel} #${node.id}`;
      const labelState = `state ${node.execState}`;
      const x = pos.x + padX;
      const yA = pos.y + titlePx + 2;

      gl.uniform4f(colorLoc, c[0], c[1], c[2], c[3]);
      drawText(labelA, x, yA, titleScale);

      const stateWidth = measureTextWidth(labelState, portScale);
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
        const labelWidth = measureTextWidth(label, portScale);
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

export default ViewNodeGraph2;
