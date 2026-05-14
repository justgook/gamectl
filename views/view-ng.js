import { runtime } from '/core/runtime.js'
import { unwrap } from '/util/unwrap.js'
import { createWriteInput } from '/util/fs.js'

const textDecoder = new TextDecoder()

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function luaStringLiteral(value) {
  return JSON.stringify(String(value))
}

function assertRuntimeOk(result, label) {
  if (Number(result.returnCode || 0) !== 0) {
    throw new Error(`${label} failed: ${decodeOutput(result)}`)
  }
}

function okResult() {
  return { returnCode: 0, output: new Uint8Array() }
}

function decodeRuntimeInput(input) {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return textDecoder.decode(input)
  if (ArrayBuffer.isView(input)) return textDecoder.decode(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
  return String(input ?? '')
}

function stripLuaLineComments(source) {
  return String(source).split('\n').map((line) => line.replace(/--.*$/, '')).join('\n')
}

function collectHostCallPluginNames(source) {
  const plugins = new Set()
  const text = stripLuaLineComments(source)
  const pattern = /\bhost\.(?:call|awaitCall)\s*\(\s*(['"])([^'"]+)\1/g
  let match = pattern.exec(text)
  while (match) {
    plugins.add(match[2])
    match = pattern.exec(text)
  }
  return [...plugins].sort()
}

const NG = {
  NODE_GOAL: 1,
  NODE_CODE: 2,
  NODE_CALL: 3,
  NODE_VALUE: 4,
}

const EXEC_IDLE = 0
const EXEC_DONE = 1
const EXEC_ERROR = 2
const EXEC_RUNNING = 3

const MIN_SCALE = 0.2
const MAX_SCALE = 3.0

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(info || 'shader compile failed')
  }
  return shader
}

function createProgram(gl, vert, frag) {
  const program = gl.createProgram()
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vert))
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(info || 'program link failed')
  }
  return program
}

function buildGlyphMap(meta) {
  const map = new Map()
  if (!meta || !meta.glyphs || !meta.atlas) return map
  const aw = Number(meta.atlas.width) || 1
  const ah = Number(meta.atlas.height) || 1
  const em = Number(meta.atlas.size) || 1
  const yOriginTop = meta.atlas.yOrigin === 'top'

  for (const g of meta.glyphs) {
    const code = g.unicode
    const advancePx = Number(g.advance || 0) * em
    if (!g.planeBounds || !g.atlasBounds) {
      map.set(code, { empty: true, advancePx })
      continue
    }

    const ab = g.atlasBounds
    const pb = g.planeBounds
    const left = Number(ab.left)
    const right = Number(ab.right)
    const srcBottom = Number(ab.bottom)
    const srcTop = Number(ab.top)
    const bottom = yOriginTop ? ah - srcBottom : srcBottom
    const top = yOriginTop ? ah - srcTop : srcTop
    const widthPx = right - left
    const heightPx = top - bottom

    map.set(code, {
      empty: false,
      uv: [left / aw, bottom / ah, widthPx / aw, heightPx / ah],
      widthPx,
      heightPx,
      offsetXPx: (Number(pb.left) + Number(pb.right)) * 0.5 * em,
      baselineOffsetYPx: -((Number(pb.bottom) + Number(pb.top)) * 0.5 * em),
      advancePx,
    })
  }

  return map
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cloneConfigValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneConfigValue(item))
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneConfigValue(item)]))
  return value
}

function requireObject(value, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`)
  return value
}

function requireConfigString(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`)
  return value
}

function requireConfigNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`)
  return value
}

function requireConfigNumberArray(value, label, length = null) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  if (length != null && value.length !== length) throw new Error(`${label} must contain ${length} numbers`)
  for (let i = 0; i < value.length; i += 1) requireConfigNumber(value[i], `${label}[${i}]`)
  return value
}

function requireKeys(object, label, keys) {
  requireObject(object, label)
  for (const key of keys) {
    if (!(key in object)) throw new Error(`${label}.${key} is required`)
  }
  return object
}

function validateNineSlice(slice, label) {
  requireKeys(slice, label, ['textureUrl', 'left', 'right', 'top', 'bottom'])
  requireConfigString(slice.textureUrl, `${label}.textureUrl`)
  requireConfigNumber(slice.left, `${label}.left`)
  requireConfigNumber(slice.right, `${label}.right`)
  requireConfigNumber(slice.top, `${label}.top`)
  requireConfigNumber(slice.bottom, `${label}.bottom`)
}

function validateNodeGraphRenderConfig(config) {
  requireKeys(config, 'view-ng config.config', ['theme', 'layout', 'node', 'ports', 'edge', 'text', 'nineSlices'])
  requireKeys(config.theme, 'view-ng config.config.theme', ['clear', 'text', 'textMuted', 'selection', 'edge', 'edgeActive', 'edgeSuccess', 'edgeError', 'edgeStale'])
  for (const key of Object.keys(config.theme)) requireConfigNumberArray(config.theme[key], `view-ng config.config.theme.${key}`, 4)

  requireKeys(config.layout, 'view-ng config.config.layout', ['gridColumns', 'gridOriginX', 'gridOriginY', 'gridStepX', 'gridStepY', 'nodeHeaderHeight', 'nodePaddingX', 'nodePaddingY'])
  for (const key of Object.keys(config.layout)) requireConfigNumber(config.layout[key], `view-ng config.config.layout.${key}`)

  requireKeys(config.node, 'view-ng config.config.node', ['width', 'minHeight', 'height'])
  for (const key of Object.keys(config.node)) requireConfigNumber(config.node[key], `view-ng config.config.node.${key}`)

  requireKeys(config.ports, 'view-ng config.config.ports', ['emptyIconUrl', 'fullIconUrl', 'iconSizePx', 'spacingY', 'rowStartY', 'hitRadiusPx', 'labelOffsetX', 'labelFontPx', 'inputInsetX', 'outputInsetX'])
  requireConfigString(config.ports.emptyIconUrl, 'view-ng config.config.ports.emptyIconUrl')
  requireConfigString(config.ports.fullIconUrl, 'view-ng config.config.ports.fullIconUrl')
  for (const key of ['iconSizePx', 'spacingY', 'rowStartY', 'hitRadiusPx', 'labelOffsetX', 'labelFontPx', 'inputInsetX', 'outputInsetX']) requireConfigNumber(config.ports[key], `view-ng config.config.ports.${key}`)

  requireKeys(config.edge, 'view-ng config.config.edge', ['handleMin', 'handleMax', 'halfWidthPx', 'glowPx', 'aaPx', 'hitRadiusPx'])
  for (const key of Object.keys(config.edge)) requireConfigNumber(config.edge[key], `view-ng config.config.edge.${key}`)

  requireKeys(config.text, 'view-ng config.config.text', ['fontPx', 'aa', 'effect', 'stroke', 'glow', 'shadowX', 'shadowY', 'source'])
  requireConfigString(config.text.effect, 'view-ng config.config.text.effect')
  for (const key of ['fontPx', 'aa', 'stroke', 'glow', 'shadowX', 'shadowY']) requireConfigNumber(config.text[key], `view-ng config.config.text.${key}`)
  requireKeys(config.text.source, 'view-ng config.config.text.source', ['metaUrl', 'atlasUrl', 'channels'])
  requireConfigString(config.text.source.metaUrl, 'view-ng config.config.text.source.metaUrl')
  requireConfigString(config.text.source.atlasUrl, 'view-ng config.config.text.source.atlasUrl')
  requireConfigNumber(config.text.source.channels, 'view-ng config.config.text.source.channels')

  requireKeys(config.nineSlices, 'view-ng config.config.nineSlices', ['idle', 'success', 'error', 'processing', 'hover', 'selected', 'activeSelected', 'selectedSuccess', 'selectedError', 'selectedProcessing'])
  for (const key of Object.keys(config.nineSlices)) validateNineSlice(config.nineSlices[key], `view-ng config.config.nineSlices.${key}`)

  return config
}

export class ViewNg extends HTMLElement {
  static get observedAttributes() {
    return ['graph-name', 'data-source']
  }

  constructor() {
    super()
    this.canvas = null
    this.gl = null
    this.viewConfig = null
    this.assets = null
    this.skinTextures = null
    this.portTextures = null
    this.textAtlas = null
    this.baseVao = null
    this.baseVbo = null
    this.edgeProgram = null
    this.nodeProgram = null
    this.spriteProgram = null
    this.textProgram = null
    this.rectProgram = null
    this.rectBuffer = null
    this.rectFillProgram = null
    this.rectFillBuffer = null
    this.edgeBuffer = null
    this.nodeBuffer = null
    this.spriteBuffer = null
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
    this.contentBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    this.graphName = String(this.getAttribute('graph-name') || 'default').trim() || 'default'
    this.graphPath = String(this.getAttribute('data-source') || '').trim()
    this._suppressDataSourceReload = false
    this.pluginId = ''
    this.progressPluginId = ''
    this.currentRunId = ''
    this._progressPluginRegistered = false
    this.nodeLayout = new Map()
    this.nodeNames = new Map()
    this.portLabels = new Map()
    this.valueByNode = new Map()
    this.nodeCodePaths = new Map()
    this.nodeCode = new Map()
    this.nodeImportGraphIds = new Map()
    this.nodeImportGraphNames = new Map()
    this.nodeImportGraphSummaries = new Map()
    this.selectedNodeIds = new Set()
    this.activeNodeId = 0
    this.graphNodes = []
    this.lastGraph = { nodes: [], edges: [] }
    this.lastPosById = new Map()
    this.hoverPick = null
    this.connectionDrag = null
    this._headerControlsElement = null
    this._ready = false
    this._renderQueued = false
    this._pointerMode = 'idle'
    this._pointerStartClientX = 0
    this._pointerStartClientY = 0
    this._pointerStartCanvasX = 0
    this._pointerStartCanvasY = 0
    this._pointerStartWorldX = 0
    this._pointerStartWorldY = 0
    this._pointerStartOffsetX = 0
    this._pointerStartOffsetY = 0
    this._pointerMoved = false
    this._pointerDownHitNodeId = 0
    this._dragNodeStartLayout = new Map()
    this._marqueeRect = null
    this.handleElement = null
    this.backendElement = null
    this.statusElement = null
    this.resizeObserver = new ResizeObserver(() => {
      this._resizeCanvas()
      this.render()
    })
    this._resizeTarget = null
    this._onWheel = this._onWheel.bind(this)
    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)
  }

  connectedCallback() {
    this._registerProgressPlugin()
    if (!this._ready) {
      this._applyViewConfig()
      this._ready = true
      this.style.display = 'contents'
      this.innerHTML = `
        <canvas data-element="canvas"></canvas>
        <footer>
          <output data-element="handle">graph: raw node array</output>
          <output data-element="backend" class="success">state: frontend</output>
          <output data-element="status" class="info">rendering frontend nodegraph state</output>
        </footer>
      `
      this.canvas = this.querySelector('canvas[data-element="canvas"]')
      this.handleElement = this.querySelector('[data-element="handle"]')
      this.backendElement = this.querySelector('[data-element="backend"]')
      this.statusElement = this.querySelector('[data-element="status"]')
      assert(this.canvas instanceof HTMLCanvasElement, 'view-ng missing canvas')
      assert(this.handleElement instanceof HTMLOutputElement, 'view-ng missing handle output')
      assert(this.backendElement instanceof HTMLOutputElement, 'view-ng missing backend output')
      assert(this.statusElement instanceof HTMLOutputElement, 'view-ng missing status output')
      this.canvas.style.display = 'block'
      this.canvas.style.width = '100%'
      this.canvas.style.height = '100%'
      this.canvas.style.minWidth = '0'
      this.canvas.style.minHeight = '0'
      this.canvas.style.maxWidth = '100%'
      this.canvas.style.maxHeight = '100%'
      this.canvas.style.justifySelf = 'stretch'
      this.canvas.style.alignSelf = 'stretch'
      this.canvas.style.touchAction = 'none'
      this.canvas.tabIndex = 0
      this.gl = this.canvas.getContext('webgl2', { alpha: false, antialias: true })
      assert(this.gl, 'view-ng requires WebGL2')
      this._mountHeaderControls()
      if (!this.graphNodes.length) this._initSampleLayout()
      this._initPrograms()
      this._bindEvents()
      this._resizeTarget = this.parentElement || this.canvas
      this.resizeObserver.observe(this._resizeTarget)
      this._loadAssets().then(async () => {
        const path = String(this.getAttribute('data-source') || '').trim()
        if (path) await this.loadGraphFS(path)
        this.handleElement.textContent = `nodes: ${this.graphNodes.length}`
        this._setBackendStatus('state: frontend', 'success')
        this._setStatus(`ready for graph '${this.graphName}'`, 'info')
        this.render()
      }).catch((e) => {
        e.plugin = "view-ng"
        throw e
      })
    }

    this.render()
  }

  _applyViewConfig() {
    const config = this.viewConfig
    if (!isPlainObject(config)) throw new Error('view-ng config must be an object')
    if (!isPlainObject(config.config)) throw new Error('view-ng config.config must be an object')
    this.assets = validateNodeGraphRenderConfig(cloneConfigValue(config.config))
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect()
    this._resizeTarget = null
    this._unbindEvents()
    this._unmountHeaderControls()
    void this._unregisterProgressPlugin()
  }

  _registerProgressPlugin() {
    if (this._progressPluginRegistered) return
    this.pluginId = `view.ng.${crypto.randomUUID()}`
    this.progressPluginId = this.pluginId
    runtime.register({
      id: this.pluginId,
      methods: {
        nodeStart: (input) => this._handleRunProgress('nodeStart', input),
        nodeDone: (input) => this._handleRunProgress('nodeDone', input),
        nodeError: (input) => this._handleRunProgress('nodeError', input),
        goalStart: (input) => this._handleRunProgress('goalStart', input),
        goalDone: (input) => this._handleRunProgress('goalDone', input),
        save: async () => {
          await this.saveGraph()
          return okResult()
        },
        saveAs: async () => {
          await this.saveGraphAs()
          return okResult()
        },
        new: async () => {
          await this.newGraph()
          return okResult()
        },
        open: async () => {
          await this.showLoadGraphPopup()
          return okResult()
        },
        run: async () => {
          await this.runGraph()
          return okResult()
        },
        reload: async () => {
          await this.reloadGraph()
          return okResult()
        },
        zoomIn: async () => {
          this.zoomIn()
          return okResult()
        },
        zoomOut: async () => {
          this.zoomOut()
          return okResult()
        },
        zoomFit: async () => {
          this.fitToContent()
          return okResult()
        },
        clearSelection: async () => {
          this.clearSelection()
          return okResult()
        },
        tool_1: async () => {
          await this.runGraph()
          return okResult()
        },
        tool_2: async () => {
          await this.showAddNodePopup()
          return okResult()
        },
        tool_3: async () => {
          await this.showEditNodePopup()
          return okResult()
        },
        tool_4: async () => {
          await this.deleteSelectedNodes()
          return okResult()
        },
        tool_5: async () => okResult(),
        tool_6: async () => okResult(),
      },
    })
    void runtime.call('ui.context', 'activateView', { id: this.pluginId })
    this._progressPluginRegistered = true
  }

  async _unregisterProgressPlugin() {
    if (!this._progressPluginRegistered) return
    const pluginId = this.pluginId
    this._progressPluginRegistered = false
    this.pluginId = ''
    this.progressPluginId = ''
    await runtime.unregister(pluginId)
  }

  _handleRunProgress(method, input) {
    const payload = JSON.parse(decodeRuntimeInput(input))
    if (payload.runId !== this.currentRunId) return { returnCode: 0, output: new Uint8Array() }
    const nodeId = Number(payload.nodeId || 0)
    if (nodeId <= 0) throw new Error(`view-ng progress ${method} missing nodeId`)
    if (method === 'nodeStart' || method === 'goalStart') this._setExecutionState(nodeId, EXEC_RUNNING, 'incoming')
    if (method === 'nodeDone' || method === 'goalDone') this._setExecutionState(nodeId, EXEC_DONE, 'connected')
    if (method === 'nodeError') this._setExecutionState(nodeId, EXEC_ERROR, 'connected')
    this.render()
    return { returnCode: 0, output: new Uint8Array() }
  }

  _setExecutionState(nodeId, state, edgeMode) {
    const node = this.lastGraph.nodes.find((entry) => Number(entry.id) === Number(nodeId))
    if (!node) throw new Error(`view-ng progress references missing node ${nodeId}`)
    node.execState = state
    for (const edge of this.lastGraph.edges) {
      const incoming = Number(edge.to) === Number(nodeId)
      const outgoing = Number(edge.from) === Number(nodeId)
      if (edgeMode === 'incoming' && incoming) edge.execState = state
      if (edgeMode === 'outgoing' && outgoing) edge.execState = state
      if (edgeMode === 'connected' && (incoming || outgoing)) edge.execState = state
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === 'graph-name') {
      this.graphName = String(newValue || 'default').trim() || 'default'
      if (this._ready) this._setStatus(`graph name set to '${this.graphName}'`, 'info')
      return
    }
    if (name === 'data-source' && this._ready) {
      const dataSource = String(newValue || '').trim()
      this.graphPath = dataSource
      if (this._suppressDataSourceReload) return
      if (dataSource) void this.loadGraphFS(dataSource)
      return
    }
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement('div')
    toolbar.dataset.element = 'toolbar'
    toolbar.setAttribute('slot', 'header-controls')
    toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="new" aria-label="New graph" title="New graph"><i aria-hidden="true">docs</i></button>
        <button type="button" data-action="open" aria-label="Open graph" title="Open graph"><i aria-hidden="true">folder_open</i></button>
        <button type="button" data-action="save" class="accent" aria-label="Save graph" title="Save graph"><i aria-hidden="true">save</i></button>
        <button type="button" data-action="save-as" aria-label="Save graph as" title="Save graph as"><i aria-hidden="true">save_as</i></button>
        <button type="button" data-action="reload" aria-label="Reload graph" title="Reload graph"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <button type="button" data-action="run" class="success" aria-label="Run" title="Run"><i aria-hidden="true">play_arrow</i></button>
        <button type="button" data-action="add" aria-label="Add Node" title="Add Node"><i aria-hidden="true">add</i></button>
        <button type="button" data-action="edit" aria-label="Edit" title="Edit"><i aria-hidden="true">edit</i></button>
        <button type="button" data-action="delete" aria-label="Delete Selected" title="Delete Selected"><i aria-hidden="true">delete</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-in" aria-label="Zoom In" title="Zoom In"><i aria-hidden="true">zoom_in</i></button>
        <button type="button" data-action="zoom-out" aria-label="Zoom Out" title="Zoom Out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit View" title="Fit View"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="auto-arrange" aria-label="Auto Arrange" title="Auto Arrange"><i aria-hidden="true">account_tree</i></button>
      </div>
    `
    return toolbar
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControlsElement) return
    this._headerControlsElement = this.createHeaderControlsElement()
    this.parentElement.appendChild(this._headerControlsElement)
    this._headerControlsElement.querySelector('[data-action="new"]')?.addEventListener('click', () => {
      void this.newGraph()
    })
    this._headerControlsElement.querySelector('[data-action="open"]')?.addEventListener('click', () => {
      void this.showLoadGraphPopup()
    })
    this._headerControlsElement.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      void this.saveGraph()
    })
    this._headerControlsElement.querySelector('[data-action="save-as"]')?.addEventListener('click', () => {
      void this.saveGraphAs()
    })
    this._headerControlsElement.querySelector('[data-action="reload"]')?.addEventListener('click', () => {
      void this.reloadGraph()
    })
    this._headerControlsElement.querySelector('[data-action="run"]')?.addEventListener('click', () => {
      void this.runGraph()
    })
    this._headerControlsElement.querySelector('[data-action="add"]')?.addEventListener('click', () => {
      void this.showAddNodePopup()
    })
    this._headerControlsElement.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
      void this.showEditNodePopup()
    })
    this._headerControlsElement.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      this.deleteSelectedNodes()
    })
    this._headerControlsElement.querySelector('[data-action="zoom-in"]')?.addEventListener('click', () => this.zoomIn())
    this._headerControlsElement.querySelector('[data-action="zoom-out"]')?.addEventListener('click', () => this.zoomOut())
    this._headerControlsElement.querySelector('[data-action="zoom-fit"]')?.addEventListener('click', () => this.fitToContent())
    this._headerControlsElement.querySelector('[data-action="auto-arrange"]')?.addEventListener('click', () => this.autoArrangeNodes())
    this._syncSelectionActionButtons()
  }

  _unmountHeaderControls() {
    this._headerControlsElement?.remove()
    this._headerControlsElement = null
  }

  _setOutputTone(element, tone = null) {
    if (!(element instanceof HTMLOutputElement)) return
    element.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) element.classList.add(tone)
  }

  _setStatus(text, tone = null) {
    assert(this.statusElement instanceof HTMLOutputElement, 'view-ng missing status output')
    this.statusElement.textContent = text
    this._setOutputTone(this.statusElement, tone)
  }

  _setBackendStatus(text, tone = null) {
    assert(this.backendElement instanceof HTMLOutputElement, 'view-ng missing backend output')
    this.backendElement.textContent = text
    this._setOutputTone(this.backendElement, tone)
  }

  _syncSelectionActionButtons() {
    if (!this._headerControlsElement) return
    const hasSelection = this.selectedNodeIds.size > 0
    const editButton = this._headerControlsElement.querySelector('[data-action="edit"]')
    const deleteButton = this._headerControlsElement.querySelector('[data-action="delete"]')
    if (editButton instanceof HTMLButtonElement) editButton.disabled = !hasSelection
    if (deleteButton instanceof HTMLButtonElement) deleteButton.disabled = !hasSelection
  }

  _setInteractionStatusFromState() {
    if (this.connectionDrag) {
      const fixed = this.connectionDrag.fixed
      const target = this.connectionDrag.validTarget
      if (target) {
        this._setStatus(`connect ${fixed.nodeId}.${fixed.portId} -> ${target.nodeId}.${target.portId}`, 'info')
        return
      }
      this._setStatus(`drag connection from ${fixed.nodeId}.${fixed.portId}`, 'info')
      return
    }
    if (this._marqueeRect) {
      this._setStatus(`selecting ${this.selectedNodeIds.size} node${this.selectedNodeIds.size === 1 ? '' : 's'}`, 'info')
      return
    }
    if (this.hoverPick?.kind === 'port') {
      this._setStatus(`${this.hoverPick.direction} port ${this.hoverPick.nodeId}.${this.hoverPick.portId}`, 'info')
      return
    }
    if (this.hoverPick?.kind === 'edge') {
      const edge = this.hoverPick.edge
      this._setStatus(`edge ${edge.from}.${edge.fromOutputId} -> ${edge.to}.${edge.toInputId}`, 'info')
      return
    }
    if (this.hoverPick?.kind === 'node') {
      this._setStatus(`node #${this.hoverPick.nodeId}`, 'info')
      return
    }
    if (this.selectedNodeIds.size > 0) {
      const activeSuffix = this.activeNodeId && this.selectedNodeIds.has(this.activeNodeId) ? ` (active #${this.activeNodeId})` : ''
      this._setStatus(`${this.selectedNodeIds.size} node${this.selectedNodeIds.size === 1 ? '' : 's'} selected${activeSuffix}`, 'info')
      return
    }
    this._setStatus(`rendering graph '${this.graphName}'`, 'info')
  }

  async _showInfoPopup(title, message, tone = null) {
    const type = tone === 'danger' ? 'error' : tone || 'info'
    await runtime.call('ui.toast', 'alert', {
      type,
      buttonText: 'OK',
      message: title ? `${title}\n\n${String(message || '')}` : String(message || ''),
    })
  }

  _clientToCanvasPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width)),
      y: (clientY - rect.top) * (this.canvas.height / Math.max(1, rect.height)),
    }
  }

  _canvasToWorld(canvasX, canvasY) {
    return {
      x: (canvasX - this.offsetX) / Math.max(this.scale, 0.0001),
      y: (canvasY - this.offsetY) / Math.max(this.scale, 0.0001),
    }
  }

  _viewportCenterWorld() {
    return this._canvasToWorld(this.canvas.width * 0.5, this.canvas.height * 0.5)
  }

  _hitTestNode(worldX, worldY) {
    for (let i = this.lastGraph.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.lastGraph.nodes[i]
      const pos = this.nodeLayout.get(node.id)
      if (!pos) continue
      const size = this._getNodeSize(node)
      if (worldX < pos.x || worldX > pos.x + size.width || worldY < pos.y || worldY > pos.y + size.height) continue
      return node
    }
    return null
  }

  _applyMarqueeSelection(additive = false) {
    if (!this._marqueeRect) return
    const minX = Math.min(this._marqueeRect.x0, this._marqueeRect.x1)
    const minY = Math.min(this._marqueeRect.y0, this._marqueeRect.y1)
    const maxX = Math.max(this._marqueeRect.x0, this._marqueeRect.x1)
    const maxY = Math.max(this._marqueeRect.y0, this._marqueeRect.y1)
    const next = additive ? new Set(this.selectedNodeIds) : new Set()
    for (const node of this.lastGraph.nodes) {
      const pos = this.nodeLayout.get(node.id)
      if (!pos) continue
      const size = this._getNodeSize(node)
      const overlaps = !(pos.x + size.width < minX || pos.x > maxX || pos.y + size.height < minY || pos.y > maxY)
      if (overlaps) next.add(node.id)
    }
    this.selectedNodeIds = next
    if (this.activeNodeId && !this.selectedNodeIds.has(this.activeNodeId)) {
      this.activeNodeId = this.selectedNodeIds.size ? [...this.selectedNodeIds][this.selectedNodeIds.size - 1] : 0
    }
    this._syncSelectionActionButtons()
  }

  _pickAtWorld(worldX, worldY) {
    if (!this.lastGraph) return null
    const portHit = this._hitTestPort(worldX, worldY, this.lastGraph.nodes, this.nodeLayout)
    if (portHit) return { kind: 'port', ...portHit }
    const nodeHit = this._hitTestNode(worldX, worldY)
    if (nodeHit) return { kind: 'node', nodeId: nodeHit.id }
    const edgeHit = this._hitTestEdge(worldX, worldY, this.lastGraph.nodes, this.lastGraph.edges, this.nodeLayout)
    if (edgeHit) return { kind: 'edge', ...edgeHit }
    return null
  }

  _worldDistanceToBezier(x, y, p0, p1, p2, p3) {
    let minDist = Infinity
    let prev = p0
    const samples = 24
    for (let i = 1; i <= samples; i += 1) {
      const t = i / samples
      const u = 1 - t
      const pt = {
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      }
      const abx = pt.x - prev.x
      const aby = pt.y - prev.y
      const apx = x - prev.x
      const apy = y - prev.y
      const ab2 = abx * abx + aby * aby
      const h = ab2 > 1e-6 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2)) : 0
      const qx = prev.x + abx * h
      const qy = prev.y + aby * h
      minDist = Math.min(minDist, Math.hypot(x - qx, y - qy))
      prev = pt
    }
    return minDist
  }

  _hitTestPort(worldX, worldY, nodes, posById) {
    const hitRadiusPx = Number(this.assets.ports.hitRadiusPx)
    const hitRadiusWorld = hitRadiusPx / Math.max(0.0001, this.scale)
    const outputUsage = new Set((this.lastGraph?.edges || []).map((edge) => `${edge.from}:${edge.fromOutputId}`))
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const node = nodes[i]
      const pos = posById.get(node.id)
      if (!pos) continue
      for (let idx = 0; idx < node.inputCount; idx += 1) {
        const input = node.inputs[idx]
        const p = this._getPortCenter(node, pos, true, idx)
        if (Math.hypot(worldX - p.x, worldY - p.y) <= hitRadiusWorld) {
          return { nodeId: node.id, direction: 'input', index: idx, portId: input?.inputId ?? idx + 1, connected: Boolean(input?.srcNodeId) }
        }
      }
      for (let idx = 0; idx < node.outputCount; idx += 1) {
        const output = node.outputs[idx]
        const p = this._getPortCenter(node, pos, false, idx)
        if (Math.hypot(worldX - p.x, worldY - p.y) <= hitRadiusWorld) {
          const portId = output?.outputId ?? idx + 1
          return { nodeId: node.id, direction: 'output', index: idx, portId, connected: outputUsage.has(`${node.id}:${portId}`) }
        }
      }
    }
    return null
  }

  _hitTestEdge(worldX, worldY, nodes, edges, posById) {
    const edgeCfg = this.assets.edge
    const hitRadiusPx = Number(edgeCfg.hitRadiusPx)
    const hitRadiusWorld = hitRadiusPx / Math.max(0.0001, this.scale)
    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    let best = null
    for (const edge of edges) {
      const fromNode = nodesById.get(edge.from)
      const toNode = nodesById.get(edge.to)
      const fromPos = posById.get(edge.from)
      const toPos = posById.get(edge.to)
      if (!fromNode || !toNode || !fromPos || !toPos) continue
      const fromPortIndex = this._getOutputIndex(fromNode, edge.fromOutputId)
      const toPortIndex = this._getInputIndex(toNode, edge.toInputId)
      const p0 = this._getPortCenter(fromNode, fromPos, false, fromPortIndex)
      const p3 = this._getPortCenter(toNode, toPos, true, toPortIndex)
      const h = Math.max(edgeCfg.handleMin, Math.min(edgeCfg.handleMax, Math.abs(p3.x - p0.x) * 0.5))
      const p1 = { x: p0.x + h, y: p0.y }
      const p2 = { x: p3.x - h, y: p3.y }
      const dist = this._worldDistanceToBezier(worldX, worldY, p0, p1, p2, p3)
      if (dist <= hitRadiusWorld && (!best || dist < best.distance)) {
        const dStart = Math.hypot(worldX - p0.x, worldY - p0.y)
        const dEnd = Math.hypot(worldX - p3.x, worldY - p3.y)
        best = { edge, distance: dist, side: dStart <= dEnd ? 'output' : 'input' }
      }
    }
    return best
  }

  _beginConnectionFromPort(portPick) {
    const node = this._getNodeById(portPick.nodeId)
    const pos = this.nodeLayout.get(portPick.nodeId)
    if (!node || !pos) return
    const p = this._getPortCenter(node, pos, portPick.direction === 'input', portPick.index)
    this.connectionDrag = {
      mode: portPick.direction === 'output' ? 'from-output' : 'from-input',
      fixed: { nodeId: portPick.nodeId, direction: portPick.direction, index: portPick.index, portId: portPick.portId, x: p.x, y: p.y },
      moving: { x: p.x, y: p.y },
      hoverTarget: null,
      validTarget: null,
    }
    if (portPick.direction === 'input' && portPick.connected) {
      const existingEdge = (this.lastGraph?.edges || []).find((edge) => edge.to === portPick.nodeId && edge.toInputId === portPick.portId)
      if (existingEdge) {
        const fromNode = this._getNodeById(existingEdge.from)
        const fromPos = this.nodeLayout.get(existingEdge.from)
        const fromIndex = this._getOutputIndex(fromNode, existingEdge.fromOutputId)
        const fromPort = this._getPortCenter(fromNode, fromPos, false, fromIndex)
        this.connectionDrag.mode = 'reconnect-input'
        this.connectionDrag.originalEdge = existingEdge
        this.connectionDrag.fixed = { nodeId: existingEdge.from, direction: 'output', index: fromIndex, portId: existingEdge.fromOutputId, x: fromPort.x, y: fromPort.y }
        this.connectionDrag.moving = { x: p.x, y: p.y }
      }
    }
  }

  _beginReconnectFromEdge(edgePick) {
    const edge = edgePick.edge
    if (!edge) return
    const fromNode = this._getNodeById(edge.from)
    const toNode = this._getNodeById(edge.to)
    const fromPos = this.nodeLayout.get(edge.from)
    const toPos = this.nodeLayout.get(edge.to)
    if (!fromNode || !toNode || !fromPos || !toPos) return
    const fromIndex = this._getOutputIndex(fromNode, edge.fromOutputId)
    const toIndex = this._getInputIndex(toNode, edge.toInputId)
    const fromPort = this._getPortCenter(fromNode, fromPos, false, fromIndex)
    const toPort = this._getPortCenter(toNode, toPos, true, toIndex)
    if (edgePick.side === 'output') {
      this.connectionDrag = {
        mode: 'reconnect-output',
        fixed: { nodeId: edge.to, direction: 'input', index: toIndex, portId: edge.toInputId, x: toPort.x, y: toPort.y },
        moving: { x: fromPort.x, y: fromPort.y },
        hoverTarget: null,
        validTarget: null,
        originalEdge: edge,
      }
      return
    }
    this.connectionDrag = {
      mode: 'reconnect-input',
      fixed: { nodeId: edge.from, direction: 'output', index: fromIndex, portId: edge.fromOutputId, x: fromPort.x, y: fromPort.y },
      moving: { x: toPort.x, y: toPort.y },
      hoverTarget: null,
      validTarget: null,
      originalEdge: edge,
    }
  }

  _updateConnectionHoverTarget(worldX, worldY) {
    if (!this.connectionDrag || !this.lastGraph) return
    const hit = this._hitTestPort(worldX, worldY, this.lastGraph.nodes, this.nodeLayout)
    if (!hit) {
      this.connectionDrag.hoverTarget = null
      this.connectionDrag.validTarget = null
      this.hoverPick = null
      return
    }
    this.connectionDrag.hoverTarget = hit
    this.connectionDrag.validTarget = this._validateConnectionTarget(this.connectionDrag, hit) ? hit : null
    this.hoverPick = { kind: 'port', ...hit }
  }

  _validateConnectionTarget(drag, target) {
    if (!drag || !target) return false
    if (target.direction === drag.fixed.direction) return false
    if (target.nodeId === drag.fixed.nodeId) return false
    return true
  }

  async _applyInputDisconnect(nodeId, inputId) {
    const node = this.graphNodes.find((item) => item.id === Number(nodeId))
    assert(node, `view-ng missing node ${nodeId}`)
    const input = node.inputs.find((item) => item.id === Number(inputId))
    assert(input, `view-ng missing input ${nodeId}.${inputId}`)
    input.srcNodeId = 0
    input.srcOutputId = 0
    this._syncGraphSnapshotFromState({ preserveLayout: true })
    return true
  }

  async _applyInputConnect(toNodeId, toInputId, fromNodeId, fromOutputId) {
    const node = this.graphNodes.find((item) => item.id === Number(toNodeId))
    assert(node, `view-ng missing node ${toNodeId}`)
    const input = node.inputs.find((item) => item.id === Number(toInputId))
    assert(input, `view-ng missing input ${toNodeId}.${toInputId}`)
    assert(this.graphNodes.some((item) => item.id === Number(fromNodeId)), `view-ng missing source node ${fromNodeId}`)
    input.srcNodeId = Number(fromNodeId)
    input.srcOutputId = Number(fromOutputId)
    this._syncGraphSnapshotFromState({ preserveLayout: true })
    return true
  }

  async _finishConnectionDrag() {
    const drag = this.connectionDrag
    if (!drag) return
    const target = drag.validTarget
    const orig = drag.originalEdge
    const isReconnect = drag.mode === 'reconnect-input' || drag.mode === 'reconnect-output'
    if (target) {
      const from = drag.fixed.direction === 'output' ? drag.fixed : { nodeId: target.nodeId, portId: target.portId, direction: target.direction }
      const to = drag.fixed.direction === 'input' ? drag.fixed : { nodeId: target.nodeId, portId: target.portId, direction: target.direction }
      const sameAsOriginal = Boolean(orig && from.nodeId === orig.from && from.portId === orig.fromOutputId && to.nodeId === orig.to && to.portId === orig.toInputId)
      if (isReconnect && orig && !sameAsOriginal) {
        await this._applyInputDisconnect(orig.to, orig.toInputId)
      }
      if (!sameAsOriginal) {
        await this._applyInputConnect(to.nodeId, to.portId, from.nodeId, from.portId)
      }
    } else if (isReconnect && orig) {
      await this._applyInputDisconnect(orig.to, orig.toInputId)
    }
    this.connectionDrag = null
    this._setStatus('updated connection state', 'info')
  }

  _nextAvailableNodeId() {
    let maxId = 0
    for (const node of this.lastGraph.nodes) maxId = Math.max(maxId, Number(node.id || 0))
    return maxId + 1
  }

  _getNodeById(nodeId) {
    return this.lastGraph.nodes.find((node) => Number(node.id) === Number(nodeId)) || null
  }

  _assertMutableGraphSource(_action) {
    return true
  }

  _syncGraphSnapshotFromState({ preserveLayout = true, fit = false } = {}) {
    this.setGraphSnapshot(graphToRenderSnapshot(this.graphNodes), { preserveLayout, fit })
  }

  _nodeFromDraft(nodeId, draft, existing = null) {
    const kind = Number(draft.kind || existing?.kind || NG.NODE_CODE)
    const draftInputs = Array.isArray(draft.inputs) ? draft.inputs : []
    const draftOutputs = Array.isArray(draft.outputs) ? draft.outputs : []
    return {
      id: Number(nodeId),
      kind,
      x: Number(existing?.x ?? 0),
      y: Number(existing?.y ?? 0),
      name: String(draft.name || '').trim(),
      codePath: kind === NG.NODE_CODE ? String(draft.codePath || '').trim() : '',
      graphId: kind === NG.NODE_CALL ? Number(draft.graphId || 0) : 0,
      graphName: kind === NG.NODE_CALL ? String(draft.graphName || '').trim() : '',
      inputs: draftInputs.map((port, index) => ({
        id: Number(port.inputId || port.id || index + 1),
        name: String(port.name || '').trim(),
        srcNodeId: Number(existing?.inputs?.find?.((input) => Number(input.id) === Number(port.inputId || port.id || index + 1))?.srcNodeId || 0),
        srcOutputId: Number(existing?.inputs?.find?.((input) => Number(input.id) === Number(port.inputId || port.id || index + 1))?.srcOutputId || 0),
      })),
      outputs: draftOutputs.map((port, index) => {
        const outputId = Number(port.outputId || port.id || index + 1)
        const existingOutput = existing?.outputs?.find?.((output) => Number(output.id) === outputId)
        return {
          id: outputId,
          name: kind === NG.NODE_VALUE ? '' : String(port.name || existingOutput?.name || '').trim(),
          value: String(port.value ?? existingOutput?.value ?? ''),
        }
      }),
    }
  }

  _updateGraphView({ fit = false } = {}) {
    this.contentBounds = this.calculateContentBounds()
    if (fit) this.fitToContent()
    this._syncSelectionActionButtons()
    this.render()
  }

  async runGraph() {
    this.resetExecutionState()
    const runId = crypto.randomUUID()
    this.currentRunId = runId
    this._setStatus('compiling graph run...', 'info')

    const compilerRead = unwrap(await runtime.invoke('fs/fs::read-text', ['ng/run.lua']))

    const graphJson = JSON.stringify(this.getGraph())
    const progressSource = `local __ng_progress_plugin = ${luaStringLiteral(this.progressPluginId)}
local __ng_progress_run_id = ${luaStringLiteral(runId)}
function __ng_progress(method, nodeId, message)
  host.call(__ng_progress_plugin, method, json.encode({
    runId = __ng_progress_run_id,
    nodeId = nodeId,
    message = message,
  }))
end`
    const compilerSource = `_G.input = ${luaStringLiteral(graphJson)}\n_G.ngProgressSource = ${luaStringLiteral(progressSource)}\n${compilerRead}`
    const compileResult = await runtime.call('lua', 'run', compilerSource)
    assertRuntimeOk(compileResult, 'compile graph run')

    const generatedSource = JSON.parse(decodeOutput(compileResult))
    // console.log("source ready", generatedSource)

    const requiredPlugins = collectHostCallPluginNames(generatedSource)
    if (requiredPlugins.length > 0) {
      this._setStatus(`loading graph plugins: ${requiredPlugins.join(', ')}`, 'info')
      await runtime.ensureLoaded(requiredPlugins)
    }
    this._setStatus('running generated graph code...', 'info')

    const runResult = await runtime.call('lua', 'run', generatedSource)
    assertRuntimeOk(runResult, 'run generated graph code')

    if (this.currentRunId !== runId) return
    const resultText = decodeOutput(runResult)
    this._setStatus('graph run completed', 'success')
    await runtime.call('ui.toast', 'success', { message: resultText })
  }

  async resetGraph() {
    this.loadGraph([])
    this._setStatus(`reset graph '${this.graphName}'`, 'info')
  }

  async newGraph() {
    const result = await runtime.call('ui.popup', 'open', {
      title: 'Create Graph',
      size: 'medium',
      tag: 'view-files',
      props: {
        mode: 'saver',
        filter: '*.ng.json,*.json',
        defaultName: 'new-graph.ng.json',
      },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    assert(payload.path, 'view-ng new graph requires selected path')
    await this.saveGraphToPath(payload.path, [])
    await this.loadGraphFS(payload.path, false)
    this._setStatus(`created graph ${payload.path}`, 'success')
    await runtime.call('ui.toast', 'success', { message: `Created graph ${payload.path}` })
  }

  async reloadGraph() {
    const path = String(this.graphPath || '').trim()
    assert(path.length > 0, 'view-ng reload requires current graph path')
    await this.loadGraphFS(path, false)
    this._setStatus(`reloaded graph from ${path}`, 'success')
    await runtime.call('ui.toast', 'success', { message: `Reloaded graph from ${path}` })
  }

  resetExecutionState() {
    for (const node of this.lastGraph.nodes) node.execState = EXEC_IDLE
    for (const edge of this.lastGraph.edges) edge.execState = EXEC_IDLE
    this._updateGraphView()
  }

  autoArrangeNodes() {
    const nodes = this.lastGraph.nodes
    if (!nodes.length) return

    const nodeById = new Map(nodes.map((node) => [Number(node.id), node]))
    const incoming = new Map(nodes.map((node) => [Number(node.id), []]))
    const outgoing = new Map(nodes.map((node) => [Number(node.id), []]))

    for (const edge of this.lastGraph.edges) {
      const from = Number(edge.from)
      const to = Number(edge.to)
      if (!nodeById.has(from) || !nodeById.has(to)) continue
      outgoing.get(from).push(to)
      incoming.get(to).push(from)
    }

    const indegree = new Map(nodes.map((node) => [Number(node.id), incoming.get(Number(node.id)).length]))
    const queue = nodes
      .filter((node) => indegree.get(Number(node.id)) === 0)
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((node) => Number(node.id))
    const topo = []

    while (queue.length) {
      const id = queue.shift()
      topo.push(id)
      for (const next of outgoing.get(id)) {
        indegree.set(next, indegree.get(next) - 1)
        if (indegree.get(next) === 0) {
          queue.push(next)
          queue.sort((a, b) => a - b)
        }
      }
    }

    const topoSet = new Set(topo)
    for (const node of nodes) {
      const id = Number(node.id)
      if (!topoSet.has(id)) topo.push(id)
    }

    const layerById = new Map()
    for (const id of topo) {
      let layer = 0
      for (const prev of incoming.get(id)) {
        if (!layerById.has(prev)) continue
        layer = Math.max(layer, layerById.get(prev) + 1)
      }
      layerById.set(id, layer)
    }

    for (let i = topo.length - 1; i >= 0; i -= 1) {
      const id = topo[i]
      const successorLayers = outgoing.get(id)
        .filter((next) => layerById.has(next))
        .map((next) => layerById.get(next))
      if (!successorLayers.length) continue
      const compactLayer = Math.min(...successorLayers) - 1
      if (compactLayer > layerById.get(id)) layerById.set(id, compactLayer)
    }

    const layers = []
    for (const id of topo) {
      const layer = layerById.get(id)
      if (!layers[layer]) layers[layer] = []
      layers[layer].push(id)
    }

    const sortLayerByNeighborOrder = (layerIds, neighborMap, neighborOrder) => {
      layerIds.sort((a, b) => {
        const aNeighbors = neighborMap.get(a).filter((id) => neighborOrder.has(id))
        const bNeighbors = neighborMap.get(b).filter((id) => neighborOrder.has(id))
        const aScore = aNeighbors.length ? aNeighbors.reduce((sum, id) => sum + neighborOrder.get(id), 0) / aNeighbors.length : Number.MAX_SAFE_INTEGER
        const bScore = bNeighbors.length ? bNeighbors.reduce((sum, id) => sum + neighborOrder.get(id), 0) / bNeighbors.length : Number.MAX_SAFE_INTEGER
        if (aScore !== bScore) return aScore - bScore
        return a - b
      })
    }

    for (let i = 1; i < layers.length; i += 1) {
      const prevOrder = new Map(layers[i - 1].map((id, index) => [id, index]))
      sortLayerByNeighborOrder(layers[i], incoming, prevOrder)
    }
    for (let i = layers.length - 2; i >= 0; i -= 1) {
      const nextOrder = new Map(layers[i + 1].map((id, index) => [id, index]))
      sortLayerByNeighborOrder(layers[i], outgoing, nextOrder)
    }

    const layout = this.assets.layout
    const originX = Number(layout.gridOriginX)
    const originY = Number(layout.gridOriginY)
    const horizontalGap = Math.max(Number(layout.gridStepX), 220)
    const verticalGap = Math.max(Number(layout.gridStepY), 92)
    const layerWidths = layers.map((layerIds) => Math.max(...layerIds.map((id) => this._measureNodeSize(nodeById.get(id)).width), 0))
    const maxLayerHeight = Math.max(...layers.map((layerIds) => layerIds.reduce((sum, id) => sum + this._measureNodeSize(nodeById.get(id)).height + verticalGap, 0) - verticalGap), 0)

    let x = originX
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      const layerIds = layers[layerIndex]
      const totalHeight = layerIds.reduce((sum, id) => sum + this._measureNodeSize(nodeById.get(id)).height + verticalGap, 0) - verticalGap
      let y = originY + Math.max(0, (maxLayerHeight - totalHeight) * 0.5)
      for (const id of layerIds) {
        const node = nodeById.get(id)
        const size = this._measureNodeSize(node)
        this.nodeLayout.set(id, {
          x,
          y: Math.round(y),
          width: size.width,
          height: size.height,
        })
        y += size.height + verticalGap
      }
      x += layerWidths[layerIndex] + horizontalGap
    }

    this._syncGraphNodePositionsFromLayout()
    this._updateGraphView({ fit: true })
    this._setStatus(`auto-arranged ${nodes.length} node${nodes.length === 1 ? '' : 's'} by connections`, 'success')
  }

  clearSelection() {
    this.selectedNodeIds.clear()
    this.activeNodeId = 0
    this._syncSelectionActionButtons()
    this.render()
  }

  async deleteSelectedNodes() {
    if (!this._assertMutableGraphSource('deleteSelectedNodes')) return
    if (!this.selectedNodeIds.size) return
    const selected = new Set([...this.selectedNodeIds].map((id) => Number(id)))
    this._syncGraphNodePositionsFromLayout()
    this.graphNodes = this.graphNodes
      .filter((node) => !selected.has(Number(node.id)))
      .map((node) => ({
        ...node,
        inputs: node.inputs.map((input) => selected.has(Number(input.srcNodeId)) ? { ...input, srcNodeId: 0, srcOutputId: 0 } : input),
      }))
    for (const nodeId of selected) {
      this.nodeLayout.delete(nodeId)
      this.nodeNames.delete(nodeId)
      this.portLabels.delete(nodeId)
      this.valueByNode.delete(nodeId)
      this.nodeCodePaths.delete(nodeId)
      this.nodeCode.delete(nodeId)
      this.nodeImportGraphIds.delete(nodeId)
      this.nodeImportGraphNames.delete(nodeId)
      this.nodeImportGraphSummaries.delete(nodeId)
    }
    this.selectedNodeIds.clear()
    if (selected.has(Number(this.activeNodeId))) this.activeNodeId = 0
    this._syncGraphSnapshotFromState({ preserveLayout: true, fit: false })
    this._setStatus(`deleted ${selected.size} selected node${selected.size === 1 ? '' : 's'}`, 'success')
  }

  async saveGraph() {
    const path = String(this.graphPath || '').trim()
    assert(path.length > 0, 'view-ng save requires current graph path')
    await this.saveGraphToPath(path, this.getGraph())
    this._setStatus(`saved graph to ${path}`, 'success')
    await runtime.call('ui.toast', 'success', { message: `Saved graph to ${path}` })
  }

  async saveGraphAs() {
    const result = await runtime.call('ui.popup', 'open', {
      title: 'Save Graph As',
      size: 'medium',
      tag: 'view-files',
      props: {
        mode: 'saver',
        filter: '*.ng.json,*.json',
        defaultName: `${this.graphName || 'graph'}.ng.json`,
      },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    assert(payload.path, 'view-ng save-as requires selected path')
    await this.saveGraphToPath(payload.path, this.getGraph())
    this.setGraphPath(payload.path)
    this._setStatus(`saved graph to ${payload.path}`, 'success')
    await runtime.call('ui.toast', 'success', { message: `Saved graph to ${payload.path}` })
  }

  async saveGraphToPath(path, graph) {
    assert(typeof path === 'string' && path.length > 0, 'view-ng save requires path')
    const json = `${JSON.stringify(graph, null, 2)}\n`
    unwrap(await runtime.invoke('fs/fs::write-text', [path, json]))
  }

  setGraphPath(path) {
    assert(typeof path === 'string' && path.length > 0, 'view-ng graph path is required')
    this.graphPath = path
    this.graphName = String(path.split('/').pop() || this.graphName).replace(/\.ng\.json$/i, '').replace(/\.json$/i, '')
    if (this.getAttribute('data-source') !== path) {
      this._suppressDataSourceReload = true
      this.setAttribute('data-source', path)
      this._suppressDataSourceReload = false
    }
  }

  async showLoadGraphPopup() {
    const result = await runtime.call('ui.popup', 'open', {
      title: 'Load Graph',
      size: 'medium',
      tag: 'view-files',
      props: {
        mode: 'chooser',
        filter: '*.ng.json,*.json',
      },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const selection = payload.selection
    const path = Array.isArray(selection) ? selection[0]?.path : selection?.path
    assert(path, 'view-ng load graph requires selected file path')

    await this.loadGraphFS(path)
  }

  async loadGraphFS(path, notify = true) {
    const readResult = unwrap(await runtime.invoke("fs/fs::read-text", [path]), path)
    const graph = JSON.parse(readResult)
    this.loadGraph(graph)
    this.setGraphPath(path)
    this._setStatus(`loaded graph from ${path}`, 'success')
    if (notify) {
      await runtime.call('ui.toast', 'success', { message: `Loaded graph from ${path}` })
    }
  }

  async showAddNodePopup() {
    if (!this._assertMutableGraphSource('showAddNodePopup')) return
    this._syncGraphNodePositionsFromLayout()
    const result = await runtime.call('ui.popup', 'open', {
      title: 'Add node',
      size: 'medium',
      tag: 'view-ng-node',
      props: { mode: 'create' },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const draft = payload.draft || {}
    const nodeId = this._nextAvailableNodeId()
    const center = this._viewportCenterWorld()
    const node = this._nodeFromDraft(nodeId, draft, { x: Math.round(center.x), y: Math.round(center.y) })
    const preview = {
      id: node.id,
      kind: node.kind,
      inputCount: node.inputs.length,
      outputCount: node.outputs.length,
      inputs: node.inputs.map((input) => ({ inputId: input.id, srcNodeId: input.srcNodeId, srcOutputId: input.srcOutputId })),
      outputs: node.outputs.map((output) => ({ outputId: output.id })),
    }
    const size = this._measureNodeSize(preview)
    node.x = Math.round(center.x - size.width * 0.5)
    node.y = Math.round(center.y - size.height * 0.5)
    this.graphNodes.push(node)
    this.selectedNodeIds.clear()
    this.selectedNodeIds.add(nodeId)
    this.activeNodeId = nodeId
    this._applyGraphMetadataFromNodes(this.graphNodes)
    this._syncGraphSnapshotFromState({ preserveLayout: true, fit: false })
    this._setStatus(`added node #${nodeId}`, 'success')
  }

  async showEditNodePopup() {
    if (!this._assertMutableGraphSource('showEditNodePopup')) return
    this._syncGraphNodePositionsFromLayout()
    if (this.selectedNodeIds.size !== 1) {
      this._setStatus('select exactly one node to edit', 'warning')
      return
    }
    const nodeId = this.activeNodeId && this.selectedNodeIds.has(this.activeNodeId) ? this.activeNodeId : [...this.selectedNodeIds][0]
    const node = this._getNodeById(nodeId)
    const rawNode = this.graphNodes.find((item) => item.id === Number(nodeId))
    assert(node && rawNode, `view-ng missing selected node ${nodeId}`)
    const result = await runtime.call('ui.popup', 'open', {
      title: `Edit node #${nodeId}`,
      size: 'medium',
      tag: 'view-ng-node',
      props: {
        mode: 'edit',
        nodeId,
        kind: rawNode.kind,
        nodeName: rawNode.name,
        inputCount: rawNode.inputs.length,
        outputCount: rawNode.outputs.length,
        codePath: rawNode.codePath,
        code: '',
        graphId: rawNode.graphId,
        graphName: rawNode.graphName,
        graphSummary: { inputs: [], outputs: [] },
        valueText: rawNode.kind === NG.NODE_VALUE ? (rawNode.outputs[0]?.value || '') : '',
        inputLabels: rawNode.inputs.map((input, index) => input.name || `input ${index + 1}`),
        outputLabels: rawNode.outputs.map((output, index) => rawNode.kind === NG.NODE_VALUE ? output.value : (output.name || `output ${index + 1}`)),
      },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const layout = this.nodeLayout.get(nodeId) || { x: rawNode.x, y: rawNode.y }
    const next = this._nodeFromDraft(nodeId, payload.draft || {}, { ...rawNode, x: layout.x, y: layout.y })
    this.graphNodes = this.graphNodes.map((item) => item.id === Number(nodeId) ? next : item)
    this._applyGraphMetadataFromNodes(this.graphNodes)
    this._syncGraphSnapshotFromState({ preserveLayout: true, fit: false })
    this._setStatus(`updated node #${nodeId}`, 'success')
  }

  _bindEvents() {
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false })
    this.canvas.addEventListener('pointerdown', this._onPointerDown)
    this.canvas.addEventListener('pointermove', this._onPointerMove)
    this.canvas.addEventListener('pointerup', this._onPointerUp)
    this.canvas.addEventListener('pointerleave', this._onPointerUp)
  }

  _unbindEvents() {
    if (!(this.canvas instanceof HTMLCanvasElement)) return
    this.canvas.removeEventListener('wheel', this._onWheel)
    this.canvas.removeEventListener('pointerdown', this._onPointerDown)
    this.canvas.removeEventListener('pointermove', this._onPointerMove)
    this.canvas.removeEventListener('pointerup', this._onPointerUp)
    this.canvas.removeEventListener('pointerleave', this._onPointerUp)
  }

  _onWheel(event) {
    event.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width))
    const y = (event.clientY - rect.top) * (this.canvas.height / Math.max(1, rect.height))
    if (event.ctrlKey || event.metaKey) {
      this._zoomAt(x, y, event.deltaY < 0 ? 1.1 : 0.9)
      return
    }
    this.offsetX -= event.deltaX
    this.offsetY -= event.deltaY
    this.render()
  }

  _onPointerDown(event) {
    if (event.button !== 0 && event.button !== 1) return
    const canvasPoint = this._clientToCanvasPoint(event.clientX, event.clientY)
    const worldPoint = this._canvasToWorld(canvasPoint.x, canvasPoint.y)
    const pick = this._pickAtWorld(worldPoint.x, worldPoint.y)
    const hitNode = pick?.kind === 'node' ? this._getNodeById(pick.nodeId) : null
    this.hoverPick = pick
    this._pointerStartClientX = event.clientX
    this._pointerStartClientY = event.clientY
    this._pointerStartCanvasX = canvasPoint.x
    this._pointerStartCanvasY = canvasPoint.y
    this._pointerStartWorldX = worldPoint.x
    this._pointerStartWorldY = worldPoint.y
    this._pointerStartOffsetX = this.offsetX
    this._pointerStartOffsetY = this.offsetY
    this._pointerMoved = false
    this._pointerDownHitNodeId = hitNode?.id || 0
    this._dragNodeStartLayout = new Map()
    this._marqueeRect = null

    if (event.button === 1 || event.ctrlKey || event.metaKey) {
      this._pointerMode = 'pan'
      this.canvas.style.cursor = 'grabbing'
    } else if (pick?.kind === 'port') {
      this._beginConnectionFromPort(pick)
      if (this.connectionDrag) {
        this.connectionDrag.moving = worldPoint
        this._updateConnectionHoverTarget(worldPoint.x, worldPoint.y)
        this._pointerMode = 'connect'
        this.canvas.style.cursor = 'crosshair'
      }
    } else if (pick?.kind === 'edge') {
      this._beginReconnectFromEdge(pick)
      if (this.connectionDrag) {
        this.connectionDrag.moving = worldPoint
        this._updateConnectionHoverTarget(worldPoint.x, worldPoint.y)
        this._pointerMode = 'connect'
        this.canvas.style.cursor = 'crosshair'
      }
    } else if (hitNode) {
      this._pointerMode = 'drag-node'
      if (event.shiftKey) {
        if (this.selectedNodeIds.has(hitNode.id)) this.selectedNodeIds.delete(hitNode.id)
        else this.selectedNodeIds.add(hitNode.id)
      } else if (!this.selectedNodeIds.has(hitNode.id)) {
        this.selectedNodeIds.clear()
        this.selectedNodeIds.add(hitNode.id)
      }
      if (!this.selectedNodeIds.size) this.selectedNodeIds.add(hitNode.id)
      this.activeNodeId = hitNode.id
      for (const nodeId of this.selectedNodeIds) {
        const pos = this.nodeLayout.get(nodeId)
        if (!pos) continue
        this._dragNodeStartLayout.set(nodeId, { x: pos.x, y: pos.y, width: pos.width, height: pos.height })
      }
      this._syncSelectionActionButtons()
      this.canvas.style.cursor = 'grabbing'
      this.render()
    } else {
      this._pointerMode = 'marquee'
      this._marqueeRect = {
        x0: worldPoint.x,
        y0: worldPoint.y,
        x1: worldPoint.x,
        y1: worldPoint.y,
      }
      if (!event.shiftKey) {
        this.selectedNodeIds.clear()
        this.activeNodeId = 0
        this._syncSelectionActionButtons()
      }
      this.canvas.style.cursor = 'crosshair'
      this.render()
    }

    this._setInteractionStatusFromState()
    this.canvas.focus()
    this.canvas.setPointerCapture(event.pointerId)
  }

  _onPointerMove(event) {
    const canvasPoint = this._clientToCanvasPoint(event.clientX, event.clientY)
    const worldPoint = this._canvasToWorld(canvasPoint.x, canvasPoint.y)
    if (this._pointerMode === 'idle') {
      this.hoverPick = this._pickAtWorld(worldPoint.x, worldPoint.y)
      this.canvas.style.cursor = this.hoverPick ? 'crosshair' : 'default'
      this._setInteractionStatusFromState()
      this.render()
      return
    }
    const dxClient = event.clientX - this._pointerStartClientX
    const dyClient = event.clientY - this._pointerStartClientY
    this._pointerMoved = this._pointerMoved || Math.abs(dxClient) >= 3 || Math.abs(dyClient) >= 3

    if (this._pointerMode === 'pan') {
      this.offsetX = this._pointerStartOffsetX + dxClient
      this.offsetY = this._pointerStartOffsetY + dyClient
      this._setInteractionStatusFromState()
      this.render()
      return
    }

    if (this._pointerMode === 'connect') {
      this.connectionDrag.moving = worldPoint
      this._updateConnectionHoverTarget(worldPoint.x, worldPoint.y)
      this.canvas.style.cursor = 'crosshair'
      this._setInteractionStatusFromState()
      this.render()
      return
    }

    if (this._pointerMode === 'drag-node') {
      const dx = worldPoint.x - this._pointerStartWorldX
      const dy = worldPoint.y - this._pointerStartWorldY
      for (const [nodeId, start] of this._dragNodeStartLayout.entries()) {
        this.nodeLayout.set(nodeId, {
          ...start,
          x: Math.round(start.x + dx),
          y: Math.round(start.y + dy),
        })
      }
      this._setInteractionStatusFromState()
      this.render()
      return
    }

    if (this._pointerMode === 'marquee') {
      this._marqueeRect = {
        x0: this._pointerStartWorldX,
        y0: this._pointerStartWorldY,
        x1: worldPoint.x,
        y1: worldPoint.y,
      }
      this._applyMarqueeSelection(event.shiftKey)
      this._setInteractionStatusFromState()
      this.render()
    }
  }

  _onPointerUp(event) {
    if (this._pointerMode === 'idle') return
    const pointerMode = this._pointerMode
    const moved = this._pointerMoved
    const hitNodeId = this._pointerDownHitNodeId
    this._pointerMode = 'idle'
    this._pointerMoved = false
    this._pointerDownHitNodeId = 0
    this._dragNodeStartLayout.clear()
    if (this.canvas.hasPointerCapture?.(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId)
    }
    this.canvas.style.cursor = 'default'

    if (pointerMode === 'connect') {
      void this._finishConnectionDrag()
      this.hoverPick = null
      this._setInteractionStatusFromState()
      this.render()
      return
    }

    this._marqueeRect = null
    if (pointerMode === 'marquee' && !moved && !event.shiftKey) {
      this.selectedNodeIds.clear()
      this.activeNodeId = 0
    }
    if (pointerMode === 'drag-node') this._syncGraphNodePositionsFromLayout()
    if (pointerMode === 'drag-node' && !moved && hitNodeId > 0 && !event.shiftKey) {
      this.selectedNodeIds.clear()
      this.selectedNodeIds.add(hitNodeId)
      this.activeNodeId = hitNodeId
    }
    const canvasPoint = this._clientToCanvasPoint(event.clientX, event.clientY)
    const worldPoint = this._canvasToWorld(canvasPoint.x, canvasPoint.y)
    this.hoverPick = this._pickAtWorld(worldPoint.x, worldPoint.y)
    this._syncSelectionActionButtons()
    this._setInteractionStatusFromState()
    this.render()
  }

  async _loadAssets() {
    await Promise.all([
      this._loadNineSliceTextureFromAssets(),
      this._loadPortTexturesFromAssets(),
      this._loadTextAtlasFromAssets(),
    ])
  }

  _initSampleLayout() {
    const nodes = this.lastGraph.nodes
    this.nodeLayout.clear()
    nodes.forEach((node, index) => {
      const layout = this.assets.layout
      const col = index % layout.gridColumns
      const row = Math.floor(index / layout.gridColumns)
      this.nodeLayout.set(node.id, {
        x: layout.gridOriginX + col * layout.gridStepX,
        y: layout.gridOriginY + row * layout.gridStepY,
        width: Number(this.assets.node.width),
        height: Number(this.assets.node.minHeight),
      })
    })
  }

  _applyGraphMetadataFromNodes(nodes) {
    this._clearPersistedMetadata()
    for (const node of nodes) {
      const nodeId = Number(node.id)
      this.nodeNames.set(nodeId, node.name)
      this.portLabels.set(nodeId, {
        inputs: Object.fromEntries(node.inputs.map((input, index) => [String(input.id), input.name || `input ${index + 1}`])),
        outputs: Object.fromEntries(node.outputs.map((output, index) => [String(output.id), node.kind === NG.NODE_VALUE ? '' : (output.name || `output ${index + 1}`)])),
      })
      if (node.kind === NG.NODE_VALUE) {
        this.valueByNode.set(nodeId, new Map(node.outputs.map((output) => [Number(output.id), output.value])))
      }
      if (node.kind === NG.NODE_CODE) this.nodeCodePaths.set(nodeId, node.codePath)
      if (node.kind === NG.NODE_CALL) {
        this.nodeImportGraphIds.set(nodeId, node.graphId)
        this.nodeImportGraphNames.set(nodeId, node.graphName)
        this.nodeImportGraphSummaries.set(nodeId, { inputs: [], outputs: [] })
      }
      const size = this._measureNodeSize({
        id: node.id,
        kind: node.kind,
        inputCount: node.inputs.length,
        outputCount: node.outputs.length,
        inputs: node.inputs.map((input) => ({ inputId: input.id })),
        outputs: node.outputs.map((output) => ({ outputId: output.id })),
      })
      this.nodeLayout.set(nodeId, { x: node.x, y: node.y, width: size.width, height: size.height })
    }
  }

  _syncGraphNodePositionsFromLayout() {
    for (const node of this.graphNodes) {
      const layout = this.nodeLayout.get(node.id)
      if (!layout) continue
      node.x = Number(layout.x)
      node.y = Number(layout.y)
    }
  }

  getGraph() {
    this._syncGraphNodePositionsFromLayout()
    return cloneNgGraph(this.graphNodes)
  }

  loadGraph(graph) {
    this.graphNodes = cloneNgGraph(graph)
    this._applyGraphMetadataFromNodes(this.graphNodes)
    this.selectedNodeIds.clear()
    this.activeNodeId = 0
    const snapshot = graphToRenderSnapshot(this.graphNodes)
    if (this._ready) this.setGraphSnapshot(snapshot, { preserveLayout: true, fit: true })
    else this.lastGraph = snapshot
    if (this.handleElement instanceof HTMLOutputElement) this.handleElement.textContent = `nodes: ${this.graphNodes.length}`
    if (this.backendElement instanceof HTMLOutputElement) this._setBackendStatus('state: frontend', 'success')
  }

  _buildPersistedGraphDocument() {
    return this.getGraph()
  }

  _clearPersistedMetadata() {
    this.nodeNames.clear()
    this.portLabels.clear()
    this.valueByNode.clear()
    this.nodeCodePaths.clear()
    this.nodeCode.clear()
    this.nodeImportGraphIds.clear()
    this.nodeImportGraphNames.clear()
    this.nodeImportGraphSummaries.clear()
    this.nodeLayout.clear()
  }

  refreshGraphSource() {
    this._syncGraphSnapshotFromState({ preserveLayout: true, fit: false })
    if (this.handleElement instanceof HTMLOutputElement) this.handleElement.textContent = `nodes: ${this.graphNodes.length}`
    this._setBackendStatus('state: frontend', 'success')
    this._setStatus(`rendering graph '${this.graphName}' from frontend state`, 'info')
  }

  setGraphSnapshot(graph, { preserveLayout = false, fit = true } = {}) {
    assert(graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges), 'view-ng requires graph snapshot with nodes and edges arrays')
    this.lastGraph = graph
    if (preserveLayout) {
      const validNodeIds = new Set(graph.nodes.map((node) => Number(node.id)))
      for (const nodeId of [...this.nodeLayout.keys()]) {
        if (!validNodeIds.has(Number(nodeId))) this.nodeLayout.delete(nodeId)
      }
      let fallbackIndex = 0
      for (const node of graph.nodes) {
        const size = this._measureNodeSize(node)
        if (this.nodeLayout.has(node.id)) {
          this.nodeLayout.set(node.id, { ...this.nodeLayout.get(node.id), width: size.width, height: size.height })
          continue
        }
        const rawNode = this.graphNodes.find((item) => item.id === Number(node.id))
        const layout = this.assets.layout
        this.nodeLayout.set(node.id, {
          x: rawNode ? rawNode.x : layout.gridOriginX + (fallbackIndex % layout.gridColumns) * layout.gridStepX,
          y: rawNode ? rawNode.y : layout.gridOriginY + Math.floor(fallbackIndex / layout.gridColumns) * layout.gridStepY,
          width: size.width,
          height: size.height,
        })
        fallbackIndex += 1
      }
    } else {
      this._initSampleLayout()
    }
    const validNodeIds = new Set(graph.nodes.map((node) => Number(node.id)))
    this.selectedNodeIds = new Set([...this.selectedNodeIds].filter((id) => validNodeIds.has(Number(id))))
    if (!validNodeIds.has(Number(this.activeNodeId))) this.activeNodeId = this.selectedNodeIds.size ? [...this.selectedNodeIds][this.selectedNodeIds.size - 1] : 0
    this.contentBounds = this.calculateContentBounds()
    this._syncSelectionActionButtons()
    if (this.handleElement instanceof HTMLOutputElement) this.handleElement.textContent = `nodes: ${this.graphNodes.length}`
    if (fit) this.fitToContent()
    else this.render()
  }

  _resizeCanvas() {
    if (!(this.canvas instanceof HTMLCanvasElement)) return
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    const canvasRect = this.canvas.getBoundingClientRect()
    const targetRect = this._resizeTarget?.getBoundingClientRect?.() || this.parentElement?.getBoundingClientRect?.() || this.getBoundingClientRect()
    const cssWidth = Math.max(1, Math.floor(canvasRect.width || targetRect.width || window.innerWidth || 1))
    const cssHeight = Math.max(1, Math.floor(canvasRect.height || targetRect.height || window.innerHeight || 1))
    const w = Math.max(1, Math.floor(cssWidth * dpr))
    const h = Math.max(1, Math.floor(cssHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  zoomIn() {
    this._zoomAt(this.canvas.width * 0.5, this.canvas.height * 0.5, 1.2)
  }

  zoomOut() {
    this._zoomAt(this.canvas.width * 0.5, this.canvas.height * 0.5, 0.8)
  }

  _zoomAt(screenX, screenY, factor) {
    const old = this.scale
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * factor))
    const worldX = (screenX - this.offsetX) / old
    const worldY = (screenY - this.offsetY) / old
    this.offsetX = screenX - worldX * this.scale
    this.offsetY = screenY - worldY * this.scale
    this.render()
  }

  fitToContent() {
    this._resizeCanvas()
    const bounds = this.calculateContentBounds(this.lastGraph, this.nodeLayout)
    const contentWidth = bounds.maxX - bounds.minX
    const contentHeight = bounds.maxY - bounds.minY
    if (contentWidth <= 0 || contentHeight <= 0) return false
    const scaleX = this.canvas.width / contentWidth
    const scaleY = this.canvas.height / contentHeight
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)))
    const contentCenterX = (bounds.minX + bounds.maxX) * 0.5
    const contentCenterY = (bounds.minY + bounds.maxY) * 0.5
    this.offsetX = this.canvas.width * 0.5 - contentCenterX * this.scale
    this.offsetY = this.canvas.height * 0.5 - contentCenterY * this.scale
    this.render()
    return true
  }

  calculateContentBounds(graph, posById = null) {
    const nodes = graph?.nodes || []
    const positions = posById instanceof Map ? posById : this.nodeLayout
    if (!nodes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of nodes) {
      const pos = positions.get(node.id)
      if (!pos) continue
      const size = this._getNodeSize(node)
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + size.width)
      maxY = Math.max(maxY, pos.y + size.height)
    }
    return {
      minX: minX - 180,
      minY: minY - 120,
      maxX: maxX + 180,
      maxY: maxY + 120,
    }
  }

  _viewMatrix() {
    return new Float32Array([
      this.scale, 0, 0,
      0, this.scale, 0,
      this.offsetX, this.offsetY, 1,
    ])
  }

  _measureTextWidth(text, scale = 1) {
    const value = String(text || '')
    if (!value) return 0
    const atlasSize = Math.max(1, this.textAtlas?.atlasSize || this.assets.text.fontPx)
    const glyphs = this.textAtlas?.glyphs
    if (!glyphs) return value.length * atlasSize * 0.58 * scale
    let widthPx = 0
    for (const ch of value) {
      const g = glyphs.get(ch.codePointAt(0))
      widthPx += g ? g.advancePx * scale : atlasSize * 0.3 * scale
    }
    return widthPx
  }

  _getNodeTitleLabel(node) {
    const kindLabel = node.kind === NG.NODE_CODE
      ? 'code'
      : node.kind === NG.NODE_GOAL
        ? 'goal'
        : node.kind === NG.NODE_VALUE
          ? 'value'
          : node.kind === NG.NODE_CALL
            ? 'import'
            : 'node'
    const customName = String(this.nodeNames.get(node.id) || '').trim()
    return customName ? `${customName} (#${node.id})` : `${kindLabel} #${node.id}`
  }

  _getNodeStateLabel(node) {
    if (node.execState === EXEC_RUNNING) return 'running'
    if (node.execState === EXEC_DONE) return 'done'
    if (node.execState === EXEC_ERROR) return 'error'
    return 'idle'
  }

  _getStoredNodeValue(nodeId, outputId) {
    return String(this.valueByNode.get(Number(nodeId))?.get(Number(outputId)) || '')
  }

  _measureNodeSize(node) {
    const nodeCfg = this.assets.node
    const layout = this.assets.layout
    const ports = this.assets.ports
    const text = this.assets.text
    const minWidth = Number(nodeCfg.width)
    const minHeight = Number(nodeCfg.minHeight)
    const padX = Number(layout.nodePaddingX)
    const nodePaddingY = Number(layout.nodePaddingY)
    const rowStartY = Number(ports.rowStartY)
    const spacingY = Number(ports.spacingY)
    const iconSizePx = Number(ports.iconSizePx)
    const labelOffset = Number(ports.labelOffsetX)
    const inputInsetX = Number(ports.inputInsetX)
    const outputInsetX = Number(ports.outputInsetX)
    const titlePx = Number(text.fontPx)
    const portPx = Number(ports.labelFontPx)
    const atlasSize = Math.max(1, this.textAtlas?.atlasSize || titlePx)
    const titleScale = titlePx / atlasSize
    const portScale = portPx / atlasSize
    const iconHalf = iconSizePx * 0.5
    const titleWidth = this._measureTextWidth(this._getNodeTitleLabel(node), titleScale)
    const stateWidth = this._measureTextWidth(this._getNodeStateLabel(node), portScale)
    const headerWidth = padX * 2 + titleWidth + stateWidth + 12
    let leftLabelWidth = 0
    for (let i = 0; i < (node.inputCount || 0); i++) {
      const inputId = node.inputs?.[i]?.inputId ?? i + 1
      leftLabelWidth = Math.max(leftLabelWidth, this._measureTextWidth(this._getPortLabel(node.id, 'input', inputId, i), portScale))
    }
    let rightLabelWidth = 0
    for (let i = 0; i < (node.outputCount || 0); i++) {
      const outputId = node.outputs?.[i]?.outputId ?? i + 1
      const label = node.kind === NG.NODE_VALUE ? (this._getStoredNodeValue(node.id, outputId) || 'value') : this._getPortLabel(node.id, 'output', outputId, i)
      rightLabelWidth = Math.max(rightLabelWidth, this._measureTextWidth(label, portScale))
    }
    const bodyWidth = inputInsetX + iconHalf + labelOffset + leftLabelWidth + padX * 2 + rightLabelWidth + labelOffset + iconHalf + outputInsetX
    const width = Math.max(minWidth, Math.ceil(Math.max(headerWidth, bodyWidth)))
    const rowCount = Math.max(node.inputCount || 0, node.outputCount || 0)
    if (rowCount <= 0) return { width, height: minHeight }
    const lastPortCenterY = rowStartY + (rowCount - 1) * spacingY
    const requiredHeight = lastPortCenterY + iconSizePx * 0.5 + nodePaddingY
    return { width, height: Math.max(minHeight, Math.ceil(requiredHeight)) }
  }

  _getNodeSize(node) {
    const cached = this.nodeLayout.get(node.id)
    if (cached?.width && cached?.height) return { width: cached.width, height: cached.height }
    return this._measureNodeSize(node)
  }

  _getPortCenter(node, pos, isInput, portIndex) {
    const cfg = this.assets.ports
    const nodeSize = this._getNodeSize(node)
    return {
      x: isInput ? pos.x + cfg.inputInsetX : pos.x + nodeSize.width - cfg.outputInsetX,
      y: pos.y + cfg.rowStartY + portIndex * cfg.spacingY,
    }
  }

  _getNodePortLabels(nodeId) {
    return this.portLabels.get(nodeId) || null
  }

  _getPortLabel(nodeId, direction, portId, index) {
    const labels = this._getNodePortLabels(nodeId)
    const dict = labels ? labels[direction === 'input' ? 'inputs' : 'outputs'] : null
    if (dict && dict[portId] !== undefined) return String(dict[portId])
    if (dict && dict[String(portId)] !== undefined) return String(dict[String(portId)])
    return `${direction === 'input' ? 'in' : 'out'} ${portId || index + 1}`
  }

  _getInputIndex(node, inputId) {
    return Math.max(0, node.inputs.findIndex((port) => port.inputId === inputId))
  }

  _getOutputIndex(node, outputId) {
    return Math.max(0, node.outputs.findIndex((port) => port.outputId === outputId))
  }

  _colorForExec(state, key) {
    const t = this.assets.theme
    if (state === 1) return t[`${key}Success`] || t[key]
    if (state === 2) return t[`${key}Error`] || t[key]
    if (state === 3) return t[`${key}Stale`] || t[key]
    return t[key]
  }

  render() {
    if (this._renderQueued) return
    this._renderQueued = true
    requestAnimationFrame(() => {
      this._renderQueued = false
      this._resizeCanvas()
      if (!this.gl) return
      const graph = this.lastGraph
      const posById = this.nodeLayout
      this.lastPosById = posById
      this.contentBounds = this.calculateContentBounds(graph, posById)
      const gl = this.gl
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      const clear = this.assets.theme.clear
      gl.clearColor(clear[0], clear[1], clear[2], clear[3])
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      const view = this._viewMatrix()
      this._drawEdges(graph.nodes, graph.edges, posById, this.canvas.width, this.canvas.height, view)
      this._drawActiveConnection(this.canvas.width, this.canvas.height, view)
      this._drawNodes(graph.nodes, posById, this.canvas.width, this.canvas.height, view)
      this._drawMarqueeOverlay(this.canvas.width, this.canvas.height, view)
      this._drawPorts(graph.nodes, graph.edges, posById, this.canvas.width, this.canvas.height, view)
      this._drawLabels(graph.nodes, posById, this.canvas.width, this.canvas.height, view)
      this._drawPickOverlay(this.hoverPick, graph.nodes, graph.edges, posById, this.canvas.width, this.canvas.height, view)
    })
  }

  _initPrograms() {
    const gl = this.gl
    const quad = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
    this.baseVao = gl.createVertexArray()
    this.baseVbo = gl.createBuffer()
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.baseVbo)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    this.edgeProgram = createProgram(gl, `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv; layout(location=1) in vec2 a_p0; layout(location=2) in vec2 a_p3; layout(location=3) in float a_h; layout(location=4) in float a_width; layout(location=5) in vec4 a_color;
      uniform mat3 u_view; uniform vec2 u_viewportPx; uniform float u_glowPx; uniform float u_aaPx;
      out vec2 v_screenPx; out vec2 v_p0; out vec2 v_p1; out vec2 v_p2; out vec2 v_p3; out float v_width; out vec4 v_color;
      vec2 applyView(vec2 p) { return (u_view * vec3(p, 1.0)).xy; }
      void main() {
        vec2 w0 = a_p0; vec2 w3 = a_p3; vec2 hdir = normalize(vec2(max(0.0001, abs(w3.x - w0.x)), 0.0)); float h = a_h; vec2 w1 = w0 + hdir * h; vec2 w2 = w3 - hdir * h;
        vec2 p0 = applyView(w0); vec2 p1 = applyView(w1); vec2 p2 = applyView(w2); vec2 p3 = applyView(w3);
        vec2 mn = min(min(p0, p1), min(p2, p3)); vec2 mx = max(max(p0, p1), max(p2, p3)); float pad = a_width + u_glowPx + u_aaPx; mn -= vec2(pad); mx += vec2(pad);
        vec2 screenPx = mix(mn, mx, a_uv); v_screenPx = screenPx; v_p0 = p0; v_p1 = p1; v_p2 = p2; v_p3 = p3; v_width = a_width; v_color = a_color;
        vec2 ndc = (screenPx / u_viewportPx) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0.0, 1.0);
      }`, `#version 300 es
      precision highp float;
      in vec2 v_screenPx; in vec2 v_p0; in vec2 v_p1; in vec2 v_p2; in vec2 v_p3; in float v_width; in vec4 v_color; uniform float u_glowPx; out vec4 outColor;
      vec2 bez(vec2 p0, vec2 p1, vec2 p2, vec2 p3, float t) { float u = 1.0 - t; return (u*u*u)*p0 + (3.0*u*u*t)*p1 + (3.0*u*t*t)*p2 + (t*t*t)*p3; }
      float segDist(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float ab2 = dot(ab, ab); float t = ab2 > 1e-6 ? clamp(dot(p - a, ab) / ab2, 0.0, 1.0) : 0.0; return length(p - (a + t * ab)); }
      void main() { const int N = 24; float minD = 1e20; vec2 prev = bez(v_p0, v_p1, v_p2, v_p3, 0.0); for (int i = 1; i <= N; i++) { float t = float(i) / float(N); vec2 cur = bez(v_p0, v_p1, v_p2, v_p3, t); minD = min(minD, segDist(v_screenPx, prev, cur)); prev = cur; } float aa = max(1.0, fwidth(minD)); float lineA = 1.0 - smoothstep(v_width - aa, v_width + aa, minD); float glowA = 0.0; if (u_glowPx > 0.0) { glowA = 1.0 - smoothstep(v_width + u_glowPx, v_width + u_glowPx + aa, minD); glowA *= 0.34; } float a = lineA + glowA; if (a <= 0.001) discard; outColor = vec4(v_color.rgb, v_color.a * a); }
    `)

    this.nodeProgram = createProgram(gl, `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv; layout(location=1) in vec4 a_rect; uniform mat3 u_view; uniform vec2 u_viewportPx; out vec2 v_local; out vec2 v_size;
      void main() { vec2 world = a_rect.xy + a_uv * a_rect.zw; vec2 screen = (u_view * vec3(world, 1.0)).xy; v_local = a_uv * a_rect.zw; v_size = a_rect.zw; vec2 ndc = (screen / u_viewportPx) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0.0, 1.0); }
    `, `#version 300 es
      precision highp float;
      in vec2 v_local; in vec2 v_size; uniform sampler2D u_skin; uniform vec2 u_skinSize; uniform vec4 u_slice; out vec4 outColor;
      float mapAxis(float p, float size, float s0, float s1, float texSize) { float inner = max(1.0, size - s0 - s1); float texInner = max(1.0, texSize - s0 - s1); if (p < s0) return (p / max(1.0, s0)) * (s0 / texSize); if (p > size - s1) { float d = size - p; return 1.0 - ((d / max(1.0, s1)) * (s1 / texSize)); } float t = (p - s0) / inner; return (s0 / texSize) + t * (texInner / texSize); }
      void main() { float u = mapAxis(v_local.x, v_size.x, u_slice.x, u_slice.y, u_skinSize.x); float v = mapAxis(v_local.y, v_size.y, u_slice.z, u_slice.w, u_skinSize.y); vec4 skin = texture(u_skin, vec2(u, v)); if (skin.a < 0.001) discard; outColor = skin; }
    `)

    this.spriteProgram = createProgram(gl, `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv; layout(location=1) in vec4 a_rect; layout(location=2) in vec4 a_uvRect; uniform mat3 u_view; uniform vec2 u_viewportPx; out vec2 v_uv;
      void main() { vec2 world = a_rect.xy + a_uv * a_rect.zw; vec2 screen = (u_view * vec3(world, 1.0)).xy; v_uv = a_uvRect.xy + a_uv * a_uvRect.zw; vec2 ndc = (screen / u_viewportPx) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0.0, 1.0); }
    `, `#version 300 es
      precision highp float;
      in vec2 v_uv; uniform sampler2D u_tex; out vec4 outColor; void main() { vec4 tex = texture(u_tex, v_uv); if (tex.a < 0.001) discard; outColor = tex; }
    `)

    this.textProgram = createProgram(gl, `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv; uniform mat3 u_view; uniform vec2 u_viewport; uniform vec2 uP; uniform vec4 uT; uniform vec4 u_uv; out vec2 v_uv;
      void main() { vec2 aP = a_uv * 2.0 - 1.0; vec2 world = aP * mat2(uT) + uP; vec2 screen = (u_view * vec3(world, 1.0)).xy; vec2 aP01 = aP * 0.5 + 0.5; vec2 aFlip = vec2(aP01.x, 1.0 - aP01.y); v_uv = u_uv.xy + aFlip * u_uv.zw; vec2 ndc = (screen / u_viewport) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0.0, 1.0); }
    `, `#version 300 es
      precision highp float;
      in vec2 v_uv; uniform sampler2D u_tex; uniform vec4 u_color; uniform float u_aa; uniform float uDistRange; uniform int uEffect; uniform float uStroke; uniform float uGlow; uniform vec2 uShadowPx; uniform vec2 uAtlasSize; out vec4 outColor;
      float median(float r, float g, float b) { return max(min(r, g), min(max(r, g), b)); }
      void main() {
        vec4 tex = texture(u_tex, v_uv); float msdf = median(tex.r, tex.g, tex.b) - 0.5; float sdf = tex.a - 0.5; float fill = clamp(msdf * u_aa + 0.5, 0.0, 1.0); float distPx = sdf * uDistRange;
        float outline = 1.0 - smoothstep(max(0.0, uStroke - 1.0), uStroke + 1.0, abs(distPx)); float outsideDist = max(0.0, -distPx); float glow = (1.0 - smoothstep(0.0, max(0.001, uGlow), outsideDist)) * (1.0 - fill);
        vec2 suv = v_uv + (uShadowPx / uAtlasSize); float sdist = (texture(u_tex, suv).a - 0.5) * uDistRange; float shadowOutside = max(0.0, -sdist); float shadow = (1.0 - smoothstep(0.0, max(0.001, uGlow), shadowOutside)) * (1.0 - fill);
        float alpha = fill; if (uEffect == 1) alpha = max(outline, fill); else if (uEffect == 2) alpha = max(fill, glow * 0.8); else if (uEffect == 3) alpha = max(fill, shadow * 0.65); else if (uEffect == 4) alpha = max(fill, max(outline * 0.8, glow * 0.55)); if (alpha < 0.001) discard; outColor = vec4(u_color.rgb, u_color.a * alpha);
      }
    `)

    this.edgeBuffer = gl.createBuffer()
    this.nodeBuffer = gl.createBuffer()
    this.spriteBuffer = gl.createBuffer()
  }

  async _loadTextureFromUrl(url) {
    const res = unwrap(await runtime.invoke("fs/fs::read-file", [url]), url)
    let image = null
    try {
      image = await createImageBitmap(new Blob([new Uint8Array(res)]))
    } catch (e) {
      throw Error(`Filed to create image ${url}`)
    }
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    return { texture: tex, width: image.width, height: image.height }
  }

  async _loadNineSliceTextureFromAssets() {
    const entries = Object.entries(this.assets.nineSlices)
    assert(entries.length > 0, 'view-ng requires nineSlices assets')
    const loaded = await Promise.all(entries.map(async ([key, slice]) => {
      assert(slice.textureUrl, `view-ng nineSlices.${key} missing textureUrl`)
      const texture = await this._loadTextureFromUrl(slice.textureUrl)
      return [key, { ...slice, ...texture }]
    }))
    this.skinTextures = new Map(loaded)
  }

  async _loadPortTexturesFromAssets() {
    const [empty, full] = await Promise.all([
      this._loadTextureFromUrl(this.assets.ports.emptyIconUrl),
      this._loadTextureFromUrl(this.assets.ports.fullIconUrl),
    ])
    this.portTextures = { empty, full }
  }

  async _loadTextAtlasFromAssets() {
    const [metaResult, atlasResult] = await Promise.all([
      runtime.invoke("fs/fs::read-text", [this.assets.text.source.metaUrl]).then(unwrap),
      runtime.invoke("fs/fs::read-file", [this.assets.text.source.atlasUrl]).then(unwrap),
    ])

    const meta = JSON.parse(metaResult)
    const atlasRes = atlasResult
    let atlasImage

    try {
      atlasImage = await createImageBitmap(new Blob([new Uint8Array(atlasRes)]))
    } catch (e) {
      throw Error(`Filed to create image ${atlasRes}`)
    }

    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImage)
    this.textAtlas = {
      texture: tex,
      glyphs: buildGlyphMap(meta),
      atlasW: Number(meta.atlas.width),
      atlasH: Number(meta.atlas.height),
      atlasSize: Number(meta.atlas.size),
      distRange: Number(meta.atlas.distanceRange || 8),
      lineHeight: Number(meta.metrics?.lineHeight || 1.2),
    }
  }

  _drawEdges(nodes, edges, posById, width, height, view) {
    if (!edges.length) return
    const gl = this.gl
    const edgeCfg = this.assets.edge
    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    const data = new Float32Array(edges.length * 10)
    let o = 0
    for (const edge of edges) {
      if (this.connectionDrag?.originalEdge) {
        const orig = this.connectionDrag.originalEdge
        if (edge.from === orig.from && edge.fromOutputId === orig.fromOutputId && edge.to === orig.to && edge.toInputId === orig.toInputId) continue
      }
      const from = posById.get(edge.from)
      const to = posById.get(edge.to)
      const fromNode = nodesById.get(edge.from)
      const toNode = nodesById.get(edge.to)
      if (!from || !to || !fromNode || !toNode) continue
      const p0 = this._getPortCenter(fromNode, from, false, this._getOutputIndex(fromNode, edge.fromOutputId))
      const p3 = this._getPortCenter(toNode, to, true, this._getInputIndex(toNode, edge.toInputId))
      const h = Math.max(edgeCfg.handleMin, Math.min(edgeCfg.handleMax, Math.abs(p3.x - p0.x) * 0.5))
      const c = this._colorForExec(edge.execState, 'edge')
      data[o++] = p0.x; data[o++] = p0.y; data[o++] = p3.x; data[o++] = p3.y; data[o++] = h; data[o++] = edgeCfg.halfWidthPx; data[o++] = c[0]; data[o++] = c[1]; data[o++] = c[2]; data[o++] = c[3]
    }
    gl.useProgram(this.edgeProgram)
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    const stride = 10 * 4
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8); gl.vertexAttribDivisor(2, 1)
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(3, 1)
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 20); gl.vertexAttribDivisor(4, 1)
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 24); gl.vertexAttribDivisor(5, 1)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.edgeProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.edgeProgram, 'u_viewportPx'), width, height)
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_glowPx'), edgeCfg.glowPx)
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_aaPx'), edgeCfg.aaPx)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.floor(o / 10))
  }

  _getNodeSkinKey(node) {
    const selected = this.selectedNodeIds.has(node.id)
    const active = selected && Number(node.id) === Number(this.activeNodeId)
    const hovered = this.hoverPick?.kind === 'node' && Number(this.hoverPick.nodeId) === Number(node.id)
    if (selected && node.execState === EXEC_ERROR) return 'selectedError'
    if (selected && node.execState === EXEC_RUNNING) return 'selectedProcessing'
    if (selected && node.execState === EXEC_DONE) return 'selectedSuccess'
    if (active) return 'activeSelected'
    if (selected) return 'selected'
    if (node.execState === EXEC_ERROR) return 'error'
    if (node.execState === EXEC_RUNNING) return 'processing'
    if (node.execState === EXEC_DONE) return 'success'
    if (hovered) return 'hover'
    return 'idle'
  }

  _drawNodeSkinBatch(textureInfo, rects, width, height, view) {
    if (!rects.length) return
    const gl = this.gl
    const data = new Float32Array(rects.length * 4)
    let o = 0
    for (const rect of rects) {
      data[o++] = rect.x; data[o++] = rect.y; data[o++] = rect.width; data[o++] = rect.height
    }
    gl.useProgram(this.nodeProgram)
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture)
    gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'u_skin'), 0)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.nodeProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'u_viewportPx'), width, height)
    gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'u_skinSize'), textureInfo.width, textureInfo.height)
    gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'u_slice'), textureInfo.left, textureInfo.right, textureInfo.top, textureInfo.bottom)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rects.length)
  }

  _drawNodes(nodes, posById, width, height, view) {
    if (!nodes.length || !this.skinTextures) return
    const batches = new Map()
    for (const node of nodes) {
      const pos = posById.get(node.id)
      assert(pos, `view-ng missing node position ${node.id}`)
      const size = this._getNodeSize(node)
      const key = this._getNodeSkinKey(node)
      if (!batches.has(key)) batches.set(key, [])
      batches.get(key).push({ x: pos.x, y: pos.y, width: size.width, height: size.height })
    }
    const drawOrder = ['idle', 'success', 'error', 'processing', 'hover', 'selected', 'activeSelected', 'selectedSuccess', 'selectedError', 'selectedProcessing']
    for (const key of drawOrder) {
      const rects = batches.get(key) || []
      if (!rects.length) continue
      const textureInfo = this.skinTextures.get(key)
      assert(textureInfo, `view-ng missing nineSlices texture '${key}'`)
      this._drawNodeSkinBatch(textureInfo, rects, width, height, view)
    }
  }

  _drawActiveConnection(width, height, view) {
    if (!this.connectionDrag) return
    const drag = this.connectionDrag
    const edgeCfg = this.assets.edge
    const active = this.assets.theme.edgeActive
    const p0 = drag.fixed.direction === 'output' ? { x: drag.fixed.x, y: drag.fixed.y } : drag.moving
    const p3 = drag.fixed.direction === 'output' ? drag.moving : { x: drag.fixed.x, y: drag.fixed.y }
    const h = Math.max(edgeCfg.handleMin, Math.min(edgeCfg.handleMax, Math.abs(p3.x - p0.x) * 0.5))
    const data = new Float32Array([p0.x, p0.y, p3.x, p3.y, h, Math.max(edgeCfg.halfWidthPx * 1.35, edgeCfg.halfWidthPx + 0.5), active[0], active[1], active[2], active[3]])
    const gl = this.gl
    gl.useProgram(this.edgeProgram)
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    const stride = 10 * 4
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8); gl.vertexAttribDivisor(2, 1)
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(3, 1)
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 20); gl.vertexAttribDivisor(4, 1)
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 24); gl.vertexAttribDivisor(5, 1)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.edgeProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.edgeProgram, 'u_viewportPx'), width, height)
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_glowPx'), Math.max(edgeCfg.glowPx, 4))
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_aaPx'), edgeCfg.aaPx)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1)
  }

  _drawPickOverlay(pick, nodes, edges, posById, width, height, view) {
    if (!pick) return
    if (pick.kind === 'port') {
      const node = nodes.find((entry) => entry.id === pick.nodeId)
      const pos = node ? posById.get(node.id) : null
      if (!node || !pos || !this.portTextures?.full) return
      const p = this._getPortCenter(node, pos, pick.direction === 'input', pick.index)
      const iconSize = Number(this.assets.ports.iconSizePx) + 4
      const half = iconSize * 0.5
      this._drawPortBatch(this.portTextures.full, new Float32Array([p.x - half, p.y - half, iconSize, iconSize, 0, 0, 1, 1]), width, height, view)
      const validColor = this.assets.theme.edgeSuccess
      const invalidColor = this.assets.theme.edgeError
      const activeColor = this.assets.theme.edgeActive
      const color = this.connectionDrag
        ? (this.connectionDrag.validTarget && this.connectionDrag.validTarget.nodeId === pick.nodeId && this.connectionDrag.validTarget.portId === pick.portId && this.connectionDrag.validTarget.direction === pick.direction ? validColor : invalidColor)
        : activeColor
      this._drawRectOutline([{ x: p.x - half - 4, y: p.y - half - 4, width: iconSize + 8, height: iconSize + 8, color: [color[0], color[1], color[2], 0.95], strokePx: 2 }], width, height, view)
      return
    }
    if (pick.kind === 'edge' && pick.edge) {
      const fromNode = nodes.find((entry) => entry.id === pick.edge.from)
      const toNode = nodes.find((entry) => entry.id === pick.edge.to)
      const fromPos = posById.get(pick.edge.from)
      const toPos = posById.get(pick.edge.to)
      if (!fromNode || !toNode || !fromPos || !toPos) return
      const edgeCfg = this.assets.edge
      const active = this.assets.theme.edgeActive
      const p0 = this._getPortCenter(fromNode, fromPos, false, this._getOutputIndex(fromNode, pick.edge.fromOutputId))
      const p3 = this._getPortCenter(toNode, toPos, true, this._getInputIndex(toNode, pick.edge.toInputId))
      const h = Math.max(edgeCfg.handleMin, Math.min(edgeCfg.handleMax, Math.abs(p3.x - p0.x) * 0.5))
      const gl = this.gl
      const data = new Float32Array([p0.x, p0.y, p3.x, p3.y, h, Math.max(edgeCfg.halfWidthPx * 1.8, edgeCfg.halfWidthPx + 0.8), active[0], active[1], active[2], active[3]])
      gl.useProgram(this.edgeProgram)
      gl.bindVertexArray(this.baseVao)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
      const stride = 10 * 4
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1)
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8); gl.vertexAttribDivisor(2, 1)
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(3, 1)
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 20); gl.vertexAttribDivisor(4, 1)
      gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 24); gl.vertexAttribDivisor(5, 1)
      gl.uniformMatrix3fv(gl.getUniformLocation(this.edgeProgram, 'u_view'), false, view)
      gl.uniform2f(gl.getUniformLocation(this.edgeProgram, 'u_viewportPx'), width, height)
      gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_glowPx'), Math.max(edgeCfg.glowPx, 4))
      gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_aaPx'), edgeCfg.aaPx)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1)
      return
    }
    if (pick.kind === 'node') return
  }

  _drawMarqueeOverlay(width, height, view) {
    if (!this._marqueeRect) return
    const selection = this.assets.theme.selection
    const minX = Math.min(this._marqueeRect.x0, this._marqueeRect.x1)
    const minY = Math.min(this._marqueeRect.y0, this._marqueeRect.y1)
    const maxX = Math.max(this._marqueeRect.x0, this._marqueeRect.x1)
    const maxY = Math.max(this._marqueeRect.y0, this._marqueeRect.y1)
    this._drawRectFill([{ x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), color: [selection[0], selection[1], selection[2], 0.14] }], width, height, view)
    this._drawRectOutline([
      {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        color: [selection[0], selection[1], selection[2], 0.85],
        strokePx: 1.5,
      },
    ], width, height, view)
  }

  _drawRectFill(rects, width, height, view) {
    if (!rects.length) return
    const gl = this.gl
    if (!this.rectFillProgram) {
      this.rectFillProgram = createProgram(gl, `#version 300 es
        precision highp float;
        layout(location=0) in vec2 a_uv; layout(location=1) in vec4 a_rect; layout(location=2) in vec4 a_color; uniform mat3 u_view; uniform vec2 u_viewportPx; out vec4 v_color;
        void main() { vec2 world = a_rect.xy + a_uv * a_rect.zw; vec2 screen = (u_view * vec3(world, 1.0)).xy; v_color = a_color; vec2 ndc = (screen / u_viewportPx) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0.0, 1.0); }
      `, `#version 300 es
        precision highp float;
        in vec4 v_color; out vec4 outColor; void main() { outColor = v_color; }
      `)
      this.rectFillBuffer = gl.createBuffer()
    }
    const data = new Float32Array(rects.length * 8)
    let o = 0
    for (const r of rects) {
      data[o++] = r.x; data[o++] = r.y; data[o++] = r.width; data[o++] = r.height; data[o++] = r.color[0]; data[o++] = r.color[1]; data[o++] = r.color[2]; data[o++] = r.color[3]
    }
    gl.useProgram(this.rectFillProgram)
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectFillBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    const stride = 8 * 4
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(2, 1)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.rectFillProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.rectFillProgram, 'u_viewportPx'), width, height)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rects.length)
  }

  _drawRectOutline(rects, width, height, view) {
    if (!rects.length) return
    const gl = this.gl
    if (!this.rectProgram) {
      this.rectProgram = createProgram(gl, `#version 300 es
        precision highp float;
        layout(location=0) in vec2 a_uv; layout(location=1) in vec4 a_rect; layout(location=2) in vec4 a_color; layout(location=3) in float a_stroke; uniform mat3 u_view; uniform vec2 u_viewportPx; out vec2 v_local; out vec2 v_size; out vec4 v_color; out float v_stroke;
        void main() { vec2 world = a_rect.xy + a_uv * a_rect.zw; vec2 screen = (u_view * vec3(world, 1.0)).xy; v_local = a_uv * a_rect.zw; v_size = a_rect.zw; v_color = a_color; v_stroke = a_stroke; vec2 ndc = (screen / u_viewportPx) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0.0, 1.0); }
      `, `#version 300 es
        precision highp float;
        in vec2 v_local; in vec2 v_size; in vec4 v_color; in float v_stroke; out vec4 outColor;
        void main() { float edgeDist = min(min(v_local.x, v_local.y), min(v_size.x - v_local.x, v_size.y - v_local.y)); float aa = max(1.0, fwidth(edgeDist)); float a = 1.0 - smoothstep(v_stroke - aa, v_stroke + aa, edgeDist); if (a < 0.001) discard; outColor = vec4(v_color.rgb, v_color.a * a); }
      `)
      this.rectBuffer = gl.createBuffer()
    }
    const data = new Float32Array(rects.length * 9)
    let o = 0
    for (const r of rects) {
      data[o++] = r.x; data[o++] = r.y; data[o++] = r.width; data[o++] = r.height; data[o++] = r.color[0]; data[o++] = r.color[1]; data[o++] = r.color[2]; data[o++] = r.color[3]; data[o++] = r.strokePx
    }
    gl.useProgram(this.rectProgram)
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    const stride = 9 * 4
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(2, 1)
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 32); gl.vertexAttribDivisor(3, 1)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.rectProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.rectProgram, 'u_viewportPx'), width, height)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rects.length)
  }

  _drawPortBatch(textureInfo, instances, width, height, view) {
    if (!instances.length) return
    const gl = this.gl
    gl.useProgram(this.spriteProgram)
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, instances, gl.DYNAMIC_DRAW)
    const stride = 8 * 4
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(2, 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture)
    gl.uniform1i(gl.getUniformLocation(this.spriteProgram, 'u_tex'), 0)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.spriteProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.spriteProgram, 'u_viewportPx'), width, height)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instances.length / 8)
  }

  _drawPorts(nodes, edges, posById, width, height, view) {
    if (!this.portTextures) return
    const iconSize = Number(this.assets.ports.iconSizePx)
    const half = iconSize * 0.5
    const outputUsage = new Set(edges.map((edge) => `${edge.from}:${edge.fromOutputId}`))
    const emptyInstances = []
    const fullInstances = []
    const pushInstance = (target, cx, cy) => {
      target.push(cx - half, cy - half, iconSize, iconSize, 0, 0, 1, 1)
    }
    for (const node of nodes) {
      const pos = posById.get(node.id)
      if (!pos) continue
      for (let i = 0; i < node.inputCount; i++) {
        const input = node.inputs[i]
        const p = this._getPortCenter(node, pos, true, i)
        pushInstance(input?.srcNodeId ? fullInstances : emptyInstances, p.x, p.y)
      }
      for (let i = 0; i < node.outputCount; i++) {
        const output = node.outputs[i]
        const p = this._getPortCenter(node, pos, false, i)
        pushInstance(outputUsage.has(`${node.id}:${output.outputId}`) ? fullInstances : emptyInstances, p.x, p.y)
      }
    }
    this._drawPortBatch(this.portTextures.empty, new Float32Array(emptyInstances), width, height, view)
    this._drawPortBatch(this.portTextures.full, new Float32Array(fullInstances), width, height, view)
  }

  _drawLabels(nodes, posById, width, height, view) {
    if (!this.textAtlas) return
    const gl = this.gl
    const glyphs = this.textAtlas.glyphs
    const c = this.assets.theme.text
    const cMuted = this.assets.theme.textMuted
    gl.useProgram(this.textProgram)
    gl.bindVertexArray(this.baseVao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textAtlas.texture)
    gl.uniform1i(gl.getUniformLocation(this.textProgram, 'u_tex'), 0)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.textProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.textProgram, 'u_viewport'), width, height)
    const colorLoc = gl.getUniformLocation(this.textProgram, 'u_color')
    const aa = Math.min(32.0, Math.max(6.0, Number(this.assets.text.aa) * this.scale))
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'u_aa'), aa)
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'uDistRange'), this.textAtlas.distRange)
    gl.uniform1i(gl.getUniformLocation(this.textProgram, 'uEffect'), 0)
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'uStroke'), Number(this.assets.text.stroke))
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'uGlow'), Number(this.assets.text.glow))
    gl.uniform2f(gl.getUniformLocation(this.textProgram, 'uShadowPx'), Number(this.assets.text.shadowX), Number(this.assets.text.shadowY))
    gl.uniform2f(gl.getUniformLocation(this.textProgram, 'uAtlasSize'), this.textAtlas.atlasW, this.textAtlas.atlasH)
    const atlasSize = Math.max(1, this.textAtlas.atlasSize)
    const titlePx = Number(this.assets.text.fontPx)
    const portPx = Number(this.assets.ports.labelFontPx)
    const titleScale = titlePx / atlasSize
    const portScale = portPx / atlasSize
    const drawText = (text, startX, baselineY, scale) => {
      let x = startX
      for (const ch of String(text || '')) {
        const g = glyphs.get(ch.codePointAt(0))
        if (!g) { x += atlasSize * 0.3 * scale; continue }
        if (g.empty) { x += g.advancePx * scale; continue }
        const gw = g.widthPx * scale
        const gh = g.heightPx * scale
        const px = x + g.offsetXPx * scale
        const py = baselineY + g.baselineOffsetYPx * scale
        gl.uniform2f(gl.getUniformLocation(this.textProgram, 'uP'), px, py)
        gl.uniform4f(gl.getUniformLocation(this.textProgram, 'uT'), gw * 0.5, 0, 0, gh * 0.5)
        gl.uniform4f(gl.getUniformLocation(this.textProgram, 'u_uv'), g.uv[0], g.uv[1], g.uv[2], g.uv[3])
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        x += g.advancePx * scale
      }
    }
    const iconHalf = Number(this.assets.ports.iconSizePx) * 0.5
    const labelOffset = Number(this.assets.ports.labelOffsetX)
    const padX = Number(this.assets.layout.nodePaddingX)
    for (const node of nodes) {
      const pos = posById.get(node.id)
      const size = this._getNodeSize(node)
      const title = this._getNodeTitleLabel(node)
      const state = this._getNodeStateLabel(node)
      const y = pos.y + titlePx + 2
      gl.uniform4f(colorLoc, c[0], c[1], c[2], c[3])
      drawText(title, pos.x + padX, y, titleScale)
      const stateWidth = this._measureTextWidth(state, portScale)
      gl.uniform4f(colorLoc, cMuted[0], cMuted[1], cMuted[2], cMuted[3])
      drawText(state, Math.max(pos.x + padX + 56, pos.x + size.width - padX - stateWidth), y, portScale)
      for (let i = 0; i < node.inputCount; i++) {
        const p = this._getPortCenter(node, pos, true, i)
        drawText(this._getPortLabel(node.id, 'input', node.inputs[i]?.inputId ?? i + 1, i), p.x + iconHalf + labelOffset, p.y + portPx * 0.35, portScale)
      }
      for (let i = 0; i < node.outputCount; i++) {
        const outputId = node.outputs[i]?.outputId ?? i + 1
        const label = node.kind === NG.NODE_VALUE ? (this._getStoredNodeValue(node.id, outputId) || 'value') : this._getPortLabel(node.id, 'output', outputId, i)
        const p = this._getPortCenter(node, pos, false, i)
        const labelWidth = this._measureTextWidth(label, portScale)
        drawText(label, p.x - iconHalf - labelOffset - labelWidth, p.y + portPx * 0.35, portScale)
      }
    }
  }
}

if (!customElements.get('view-ng')) {
  customElements.define('view-ng', ViewNg)
}

// State management

const NG_KIND = new Set([1, 2, 3, 4])

function requireNumber(value, label) {
  assert(typeof value === 'number' && Number.isFinite(value), `view-ng graph ${label} must be a finite number`)
  return value
}

function requireString(value, label) {
  assert(typeof value === 'string', `view-ng graph ${label} must be a string`)
  return value
}

function cloneInput(input) {
  return {
    id: requireNumber(input.id, 'input.id'),
    name: requireString(input.name, 'input.name'),
    srcNodeId: requireNumber(input.srcNodeId, 'input.srcNodeId'),
    srcOutputId: requireNumber(input.srcOutputId, 'input.srcOutputId'),
  }
}

function cloneOutput(output) {
  return {
    id: requireNumber(output.id, 'output.id'),
    name: requireString(output.name, 'output.name'),
    value: requireString(output.value, 'output.value'),
  }
}

function cloneNode(node) {
  assert(node && typeof node === 'object' && !Array.isArray(node), 'view-ng graph node must be an object')
  const id = requireNumber(node.id, 'node.id')
  const kind = requireNumber(node.kind, `node ${id}.kind`)
  assert(NG_KIND.has(kind), `view-ng graph node ${id} kind must be one of 1, 2, 3, 4`)
  assert(Array.isArray(node.inputs), `view-ng graph node ${id}.inputs must be an array`)
  assert(Array.isArray(node.outputs), `view-ng graph node ${id}.outputs must be an array`)
  return {
    id,
    kind,
    x: requireNumber(node.x, `node ${id}.x`),
    y: requireNumber(node.y, `node ${id}.y`),
    name: requireString(node.name, `node ${id}.name`),
    codePath: requireString(node.codePath, `node ${id}.codePath`),
    graphId: requireNumber(node.graphId, `node ${id}.graphId`),
    graphName: requireString(node.graphName, `node ${id}.graphName`),
    inputs: node.inputs.map((input, index) => cloneInput(input, `node ${id}.inputs[${index}]`)),
    outputs: node.outputs.map((output, index) => cloneOutput(output, `node ${id}.outputs[${index}]`)),
  }
}

export function cloneNgGraph(graph) {
  assert(Array.isArray(graph), 'view-ng graph must be a raw node array')
  const nodes = graph.map(cloneNode)
  const ids = new Set()
  for (const node of nodes) {
    assert(node.id > 0, `view-ng graph node id must be positive: ${node.id}`)
    assert(!ids.has(node.id), `view-ng graph has duplicate node id ${node.id}`)
    ids.add(node.id)
  }
  for (const node of nodes) {
    const inputIds = new Set()
    for (const input of node.inputs) {
      assert(input.id > 0, `view-ng graph node ${node.id} input id must be positive`)
      assert(!inputIds.has(input.id), `view-ng graph node ${node.id} has duplicate input id ${input.id}`)
      inputIds.add(input.id)
      if (input.srcNodeId !== 0) assert(ids.has(input.srcNodeId), `view-ng graph input ${node.id}.${input.id} references missing source node ${input.srcNodeId}`)
    }
    const outputIds = new Set()
    for (const output of node.outputs) {
      assert(output.id > 0, `view-ng graph node ${node.id} output id must be positive`)
      assert(!outputIds.has(output.id), `view-ng graph node ${node.id} has duplicate output id ${output.id}`)
      outputIds.add(output.id)
    }
  }
  return nodes
}

function graphToRenderSnapshot(graph) {
  const nodes = cloneNgGraph(graph).map((node) => ({
    id: node.id,
    kind: node.kind,
    execState: EXEC_IDLE,
    inputCount: node.inputs.length,
    outputCount: node.outputs.length,
    inputs: node.inputs.map((input) => ({
      inputId: input.id,
      srcNodeId: input.srcNodeId,
      srcOutputId: input.srcOutputId,
    })),
    outputs: node.outputs.map((output) => ({ outputId: output.id })),
  }))
  const edges = []
  for (const node of nodes) {
    for (const input of node.inputs) {
      if (input.srcNodeId === 0) continue
      edges.push({
        from: input.srcNodeId,
        fromOutputId: input.srcOutputId,
        to: node.id,
        toInputId: input.inputId,
        execState: EXEC_IDLE,
      })
    }
  }
  return { nodes, edges }
}

