import { runtime } from '../core/runtime.js'

const textDecoder = new TextDecoder()

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function readI32String(result) {
  const text = decodeOutput(result).replace(/\u0000/g, '').trim()
  const value = Number.parseInt(text, 10)
  if (!Number.isFinite(value)) throw new Error(`Expected integer output, got '${text}'`)
  return value
}

const NG = {
  MAX_NODES: 128,
  MAX_INPUTS: 32,
  MAX_OUTPUTS: 32,
  MAX_ARGS: 32,
  NODE_GOAL: 1,
  NODE_CODE: 2,
  NODE_CALL: 3,
  NODE_VALUE: 4,
}

const ABI = {
  NODE_HEADER_SIZE: 32,
  INPUT_PORT_SIZE: 12,
  OUTPUT_PORT_SIZE: 4,
  VALUE_SLOT_SIZE: 12,
}
ABI.NODE_SIZE = ABI.NODE_HEADER_SIZE + NG.MAX_INPUTS * ABI.INPUT_PORT_SIZE + NG.MAX_OUTPUTS * ABI.OUTPUT_PORT_SIZE + NG.MAX_ARGS * ABI.VALUE_SLOT_SIZE

const INFO = {
  GENERATION: 8,
  NODE_COUNT: 12,
  NODES: 28,
}

const NODE = {
  ID: 0,
  KIND: 4,
  EXEC_STATE: 8,
  INPUT_COUNT: 20,
  OUTPUT_COUNT: 24,
}

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
      emptyIconUrl: '/assets/ng/port-empty.png',
      fullIconUrl: '/assets/ng/port-full.png',
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
      effect: 'fill',
      stroke: 2.5,
      glow: 2,
      shadowX: 4,
      shadowY: -4,
      source: {
        metaUrl: '/assets/ng/atlas-mtsdf.json',
        atlasUrl: '/assets/ng/atlas-mtsdf.png',
        channels: 4,
      },
    },
    nineSlice: {
      textureUrl: '/assets/ng/nine.png',
      left: 8,
      right: 8,
      top: 8,
      bottom: 8,
    },
  }
}

export class ViewNg extends HTMLElement {
  static get observedAttributes() {
    return ['graph-name']
  }

  constructor() {
    super()
    this.canvas = null
    this.gl = null
    this.assets = getNodeGraphRenderAssets()
    this.skinTexture = null
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
    this.ngHandle = 0
    this.ngMemory = null
    this.ngInfoPtr = null
    this.ngInfoSize = 0
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
    if (!this._ready) {
      this._ready = true
      this.style.display = 'contents'
      this.innerHTML = `
        <canvas data-element="canvas"></canvas>
        <footer>
          <output data-element="handle">handle: scaffold</output>
          <output data-element="backend" class="warning">backend: ng integration pending</output>
          <output data-element="status" class="info">rendering: legacy WebGL scaffold copied from view-nodegraph2.js</output>
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
      this._initSampleLayout()
      this._initPrograms()
      this._bindEvents()
      this._resizeTarget = this.parentElement || this.canvas
      this.resizeObserver.observe(this._resizeTarget)
      this._loadAssets().then(() => {
        this.handleElement.textContent = 'handle: not loaded'
        this._setBackendStatus('backend: ng graph storage', 'success')
        this._setStatus(`ready to open ng graph '${this.graphName}'`, 'info')
        this.render()
      }).catch((error) => {
        throw error
      })
    }

    this.render()
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect()
    this._resizeTarget = null
    this._unbindEvents()
    this._unmountHeaderControls()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === 'graph-name') {
      this.graphName = String(newValue || 'default').trim() || 'default'
      if (this._ready) void this.refreshGraphSource()
      return
    }
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement('div')
    toolbar.dataset.element = 'toolbar'
    toolbar.setAttribute('slot', 'header-controls')
    toolbar.innerHTML = `
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
      <button data-action="refresh" aria-label="Refresh" title="Refresh"><i aria-hidden="true">refresh</i></button>
    `
    return toolbar
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControlsElement) return
    this._headerControlsElement = this.createHeaderControlsElement()
    this.parentElement.appendChild(this._headerControlsElement)
    this._headerControlsElement.querySelector('[data-action="run"]')?.addEventListener('click', () => {
      void this.runGraph()
    })
    this._headerControlsElement.querySelector('[data-action="add"]')?.addEventListener('click', () => {
      void this.showAddNodePopup()
    })
    this._headerControlsElement.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      void this.showSaveGraphPopup()
    })
    this._headerControlsElement.querySelector('[data-action="load"]')?.addEventListener('click', () => {
      void this.showLoadGraphPopup()
    })
    this._headerControlsElement.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      void this.resetGraph()
    })
    this._headerControlsElement.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
      this.clearExecutionState()
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
    this._headerControlsElement.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
      void this.refreshGraphSource()
    })
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
    this._setStatus(`rendering ng graph '${this.graphName}'`, 'info')
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
    const hitRadiusPx = Number(this.assets.ports.hitRadiusPx || 16)
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
    const hitRadiusPx = Number(edgeCfg.hitRadiusPx || 10)
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
    const ok = await this._callngMutation('ng_input_disconnect', { handle: this.ngHandle, nodeId, inputId }, `Could not disconnect input ${inputId} on node #${nodeId}`)
    if (!ok) return false
    this._syncGraphSnapshotFromng({ preserveLayout: true })
    return true
  }

  async _applyInputConnect(toNodeId, toInputId, fromNodeId, fromOutputId) {
    const ok = await this._callngMutation('ng_input_connect', { handle: this.ngHandle, nodeId: toNodeId, inputId: toInputId, srcNodeId: fromNodeId, srcOutputId: fromOutputId }, `Could not connect ${fromNodeId}.${fromOutputId} -> ${toNodeId}.${toInputId}`)
    if (!ok) return false
    this._syncGraphSnapshotFromng({ preserveLayout: true })
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

  async _callngMutation(method, payload, failurePrefix) {
    await this.ensurengBinding()
    const result = await runtime.call('ng', method, JSON.stringify(payload))
    if (result.returnCode !== 0) {
      const detail = decodeOutput(result) || result.returnCode
      const message = `${failurePrefix}: ${detail}`
      this._setStatus(message, 'warning')
      await runtime.call('ui.toast', 'warning', { message })
      return false
    }
    return true
  }

  _syncGraphSnapshotFromng({ preserveLayout = true, fit = false } = {}) {
    this.setGraphSnapshot(this.readGraphSnapshotFromng(), { preserveLayout, fit })
  }

  async _createNodeViang(nodeId, draft) {
    const kind = Number(draft.kind || NG.NODE_CODE)
    const draftInputs = Array.isArray(draft.inputs) ? draft.inputs : []
    const draftOutputs = Array.isArray(draft.outputs) ? draft.outputs : []
    let ok = await this._callngMutation('ng_node_create', { handle: this.ngHandle, nodeId, kind }, `Could not create node #${nodeId}`)
    if (!ok) return false
    for (const port of draftInputs) {
      ok = await this._callngMutation('ng_input_add', { handle: this.ngHandle, nodeId, inputId: Number(port.inputId) }, `Could not add input ${Number(port.inputId)} to node #${nodeId}`)
      if (!ok) return false
    }
    for (const port of draftOutputs) {
      ok = await this._callngMutation('ng_output_add', { handle: this.ngHandle, nodeId, outputId: Number(port.outputId) }, `Could not add output ${Number(port.outputId)} to node #${nodeId}`)
      if (!ok) return false
    }
    if (kind === NG.NODE_CALL && Number(draft.graphId || 0) > 0) {
      ok = await this._callngMutation('ng_node_set_arg', { handle: this.ngHandle, nodeId, argIndex: 0, type: 1, a: Number(draft.graphId || 0), b: 0 }, `Could not set import graph id on node #${nodeId}`)
      if (!ok) return false
    }
    return true
  }

  async _replaceNodeViang(nodeId, draft, kind) {
    let ok = await this._callngMutation('ng_node_replace', { handle: this.ngHandle, nodeId, kind }, `Could not replace node #${nodeId}`)
    if (!ok) return false
    const draftInputs = Array.isArray(draft.inputs) ? draft.inputs : []
    const draftOutputs = Array.isArray(draft.outputs) ? draft.outputs : []
    for (const port of draftInputs) {
      ok = await this._callngMutation('ng_input_add', { handle: this.ngHandle, nodeId, inputId: Number(port.inputId) }, `Could not add input ${Number(port.inputId)} to node #${nodeId}`)
      if (!ok) return false
    }
    for (const port of draftOutputs) {
      ok = await this._callngMutation('ng_output_add', { handle: this.ngHandle, nodeId, outputId: Number(port.outputId) }, `Could not add output ${Number(port.outputId)} to node #${nodeId}`)
      if (!ok) return false
    }
    if (kind === NG.NODE_CALL && Number(draft.graphId || 0) > 0) {
      ok = await this._callngMutation('ng_node_set_arg', { handle: this.ngHandle, nodeId, argIndex: 0, type: 1, a: Number(draft.graphId || 0), b: 0 }, `Could not set import graph id on node #${nodeId}`)
      if (!ok) return false
    }
    return true
  }

  _updateGraphView({ fit = false } = {}) {
    this.contentBounds = this.calculateContentBounds()
    if (fit) this.fitToContent()
    this._syncSelectionActionButtons()
    this.render()
  }

  async runGraph() {
    await this.ensurengBinding()
    const request = JSON.stringify({ handle: this.ngHandle, goal: 0, inputs: {} })
    const result = await runtime.call('ng', 'ng_run', request)
    if (result.returnCode !== 0) {
      throw new Error(`ng.ng_run failed: ${decodeOutput(result) || result.returnCode}`)
    }
    let payload = null
    try {
      payload = JSON.parse(decodeOutput(result) || 'null')
    } catch (error) {
      throw new Error(`ng.ng_run returned invalid JSON: ${error?.message || error}`)
    }
    this._syncGraphSnapshotFromng({ preserveLayout: true, fit: false })
    this._setStatus(`run finished for '${payload?.graph || this.graphName}'`, 'success')
    await this._showInfoPopup('Run result', JSON.stringify(payload, null, 2), 'info')
  }

  async resetGraph() {
    await this.refreshGraphSource()
    this._setStatus(`reset graph '${this.graphName}'`, 'info')
  }

  clearExecutionState() {
    for (const node of this.lastGraph.nodes) node.execState = 0
    for (const edge of this.lastGraph.edges) edge.execState = 0
    this._updateGraphView()
    this._setStatus('cleared local execution state', 'info')
  }

  autoArrangeNodes() {
    const layout = this.assets.layout
    this.lastGraph.nodes.forEach((node, index) => {
      const col = index % layout.gridColumns
      const row = Math.floor(index / layout.gridColumns)
      const size = this._measureNodeSize(node)
      this.nodeLayout.set(node.id, {
        x: layout.gridOriginX + col * layout.gridStepX,
        y: layout.gridOriginY + row * layout.gridStepY,
        width: size.width,
        height: size.height,
      })
    })
    this._updateGraphView({ fit: true })
    this._setStatus('auto-arranged nodes', 'success')
  }

  async deleteSelectedNodes() {
    if (!this._assertMutableGraphSource('deleteSelectedNodes')) return
    if (!this.selectedNodeIds.size) return
    const selected = new Set([...this.selectedNodeIds].map((id) => Number(id)))
    await this.ensurengBinding()
    for (const nodeId of selected) {
      const ok = await this._callngMutation('ng_node_delete', { handle: this.ngHandle, nodeId }, `Could not delete node #${nodeId}`)
      if (!ok) return
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
    this._syncGraphSnapshotFromng({ preserveLayout: true, fit: false })
    this._setStatus(`deleted ${selected.size} selected node${selected.size === 1 ? '' : 's'}`, 'success')
  }

  async showSaveGraphPopup() {
    await this.ensurengBinding()
    const document = this._buildPersistedGraphDocument()
    const result = await runtime.call('ng', 'ng_graph_save', JSON.stringify({
      handle: this.ngHandle,
      name: this.graphName,
      data: document,
    }))
    if (result.returnCode !== 0) {
      throw new Error(`ng.ng_graph_save failed: ${decodeOutput(result) || result.returnCode}`)
    }
    this._setStatus(`saved graph '${this.graphName}'`, 'success')
    await runtime.call('ui.toast', 'success', { message: `Saved graph '${this.graphName}'` })
  }

  async showLoadGraphPopup() {
    const result = await runtime.call('ui.popup', 'open', {
      title: 'Open graph',
      size: 'large',
      tag: 'view-ng-graph',
      props: {
        mode: 'chooser',
      },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const graphName = String(payload.value || '').trim()
    assert(graphName, 'view-ng open graph requires graph name')
    this.setAttribute('graph-name', graphName)
    await this.refreshGraphSource()
    this._setStatus(`requested graph '${graphName}'`, 'info')
  }

  async showAddNodePopup() {
    if (!this._assertMutableGraphSource('showAddNodePopup')) return
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
    const kind = Number(draft.kind || NG.NODE_CODE)
    const draftInputs = Array.isArray(draft.inputs) ? draft.inputs : []
    const draftOutputs = Array.isArray(draft.outputs) ? draft.outputs : []
    const inputCount = draftInputs.length
    const outputCount = draftOutputs.length

    await this.ensurengBinding()
    const ok = await this._createNodeViang(nodeId, draft)
    if (!ok) return
    this._syncGraphSnapshotFromng({ preserveLayout: true, fit: false })

    this.nodeNames.set(nodeId, String(draft.name || '').trim())
    if (kind === NG.NODE_CODE) {
      this.nodeCodePaths.set(nodeId, String(draft.codePath || '').trim())
      this.nodeCode.set(nodeId, String(draft.code || ''))
    } else {
      this.nodeCodePaths.delete(nodeId)
      this.nodeCode.delete(nodeId)
    }
    if (kind === NG.NODE_CALL) {
      this.nodeImportGraphIds.set(nodeId, Number(draft.graphId || 0))
      this.nodeImportGraphNames.set(nodeId, String(draft.graphName || '').trim())
      this.nodeImportGraphSummaries.set(nodeId, draft.graphSummary || { inputs: [], outputs: [] })
    } else {
      this.nodeImportGraphIds.delete(nodeId)
      this.nodeImportGraphNames.delete(nodeId)
      this.nodeImportGraphSummaries.delete(nodeId)
    }
    this.portLabels.set(nodeId, {
      inputs: Object.fromEntries(draftInputs.map((port, index) => [String(Number(port.inputId || index + 1)), String(port?.name || `input ${index + 1}`)])),
      outputs: Object.fromEntries(draftOutputs.map((port, index) => [String(Number(port.outputId || index + 1)), kind === NG.NODE_VALUE ? '' : String(port?.name || `output ${index + 1}`)])),
    })
    if (kind === NG.NODE_VALUE) {
      this.valueByNode.set(nodeId, new Map(draftOutputs.map((port, index) => [Number(port.outputId || index + 1), String(port?.value || '')])))
    }
    const center = this._viewportCenterWorld()
    const liveNode = this._getNodeById(nodeId) || { id: nodeId, kind, inputCount, outputCount, inputs: draftInputs, outputs: draftOutputs }
    const size = this._measureNodeSize(liveNode)
    this.nodeLayout.set(nodeId, {
      x: Math.round(center.x - size.width * 0.5),
      y: Math.round(center.y - size.height * 0.5),
      width: size.width,
      height: size.height,
    })
    this.selectedNodeIds.clear()
    this.selectedNodeIds.add(nodeId)
    this.activeNodeId = nodeId
    this._updateGraphView()
    this._setStatus(`added node #${nodeId}`, 'success')
  }

  async showEditNodePopup() {
    if (!this._assertMutableGraphSource('showEditNodePopup')) return
    if (this.selectedNodeIds.size !== 1) {
      this._setStatus('select exactly one node to edit', 'warning')
      return
    }
    const nodeId = this.activeNodeId && this.selectedNodeIds.has(this.activeNodeId) ? this.activeNodeId : [...this.selectedNodeIds][0]
    const node = this._getNodeById(nodeId)
    assert(node, `view-ng missing selected node ${nodeId}`)
    const labels = this.portLabels.get(nodeId) || { inputs: {}, outputs: {} }
    const values = this.valueByNode.get(nodeId) || new Map()
    const result = await runtime.call('ui.popup', 'open', {
      title: `Edit node #${nodeId}`,
      size: 'medium',
      tag: 'view-ng-node',
      props: {
        mode: 'edit',
        nodeId,
        kind: node.kind,
        nodeName: this.nodeNames.get(nodeId) || '',
        inputCount: node.inputCount,
        outputCount: node.outputCount,
        codePath: this.nodeCodePaths?.get?.(nodeId) || '',
        code: this.nodeCode?.get?.(nodeId) || '',
        graphId: this.nodeImportGraphIds?.get?.(nodeId) || 0,
        graphName: this.nodeImportGraphNames?.get?.(nodeId) || '',
        graphSummary: this.nodeImportGraphSummaries?.get?.(nodeId) || { inputs: [], outputs: [] },
        valueText: node.kind === NG.NODE_VALUE ? (values.get(Number(node.outputs[0]?.outputId || 1)) || '') : '',
        inputLabels: node.inputs.map((input, index) => labels.inputs?.[String(input.inputId)] || `input ${index + 1}`),
        outputLabels: node.outputs.map((output, index) => node.kind === NG.NODE_VALUE ? (values.get(Number(output.outputId)) || '') : (labels.outputs?.[String(output.outputId)] || `output ${index + 1}`)),
      },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const draft = payload.draft || {}

    await this.ensurengBinding()
    const ok = await this._replaceNodeViang(nodeId, draft, node.kind)
    if (!ok) return
    this._syncGraphSnapshotFromng({ preserveLayout: true, fit: false })

    const liveNode = this._getNodeById(nodeId) || node
    const nextInputs = Array.isArray(draft.inputs) ? draft.inputs : liveNode.inputs.map((input) => ({ inputId: input.inputId, name: labels.inputs?.[String(input.inputId)] || '' }))
    const nextOutputs = Array.isArray(draft.outputs) ? draft.outputs : liveNode.outputs.map((output) => ({ outputId: output.outputId, name: labels.outputs?.[String(output.outputId)] || '', value: values.get(Number(output.outputId)) || '' }))
    this.nodeNames.set(nodeId, String(draft.name || '').trim())
    if (node.kind === NG.NODE_CODE) {
      this.nodeCodePaths.set(nodeId, String(draft.codePath || '').trim())
      this.nodeCode.set(nodeId, String(draft.code || ''))
    } else {
      this.nodeCodePaths.delete(nodeId)
      this.nodeCode.delete(nodeId)
    }
    if (node.kind === NG.NODE_CALL) {
      this.nodeImportGraphIds.set(nodeId, Number(draft.graphId || 0))
      this.nodeImportGraphNames.set(nodeId, String(draft.graphName || '').trim())
      this.nodeImportGraphSummaries.set(nodeId, draft.graphSummary || { inputs: [], outputs: [] })
    } else {
      this.nodeImportGraphIds.delete(nodeId)
      this.nodeImportGraphNames.delete(nodeId)
      this.nodeImportGraphSummaries.delete(nodeId)
    }
    const nextLabels = {
      inputs: Object.fromEntries(nextInputs.map((port, index) => [String(Number(port.inputId || index + 1)), String(port?.name || '').trim()])),
      outputs: Object.fromEntries(nextOutputs.map((port, index) => [String(Number(port.outputId || index + 1)), node.kind === NG.NODE_VALUE ? '' : String(port?.name || '').trim()])),
    }
    if (node.kind === NG.NODE_VALUE) {
      const nextValues = new Map(nextOutputs.map((port, index) => [Number(port.outputId || index + 1), String(port?.value || '')]))
      this.valueByNode.set(nodeId, nextValues)
    }
    this.portLabels.set(nodeId, nextLabels)
    this.nodeLayout.set(nodeId, {
      ...(this.nodeLayout.get(nodeId) || { x: 0, y: 0, width: 0, height: 0 }),
      ...this._measureNodeSize(liveNode),
    })
    this._updateGraphView()
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
        width: Number(this.assets.node.width || 146),
        height: Number(this.assets.node.minHeight || 62),
      })
    })
  }

  _buildPersistedGraphDocument() {
    return {
      nodes: this.lastGraph.nodes.map((node) => {
        const layout = this.nodeLayout.get(node.id) || { x: 0, y: 0 }
        const labels = this.portLabels.get(node.id) || { inputs: {}, outputs: {} }
        const values = this.valueByNode.get(node.id) || new Map()
        return {
          id: Number(node.id),
          kind: Number(node.kind),
          execState: Number(node.execState || 0),
          name: String(this.nodeNames.get(node.id) || ''),
          x: Number(layout.x || 0),
          y: Number(layout.y || 0),
          codePath: String(this.nodeCodePaths.get(node.id) || ''),
          code: String(this.nodeCode.get(node.id) || ''),
          graphId: Number(this.nodeImportGraphIds.get(node.id) || 0),
          graphName: String(this.nodeImportGraphNames.get(node.id) || ''),
          graphSummary: this.nodeImportGraphSummaries.get(node.id) || { inputs: [], outputs: [] },
          inputs: node.inputs.map((input, index) => ({
            inputId: Number(input.inputId),
            name: String(labels.inputs?.[String(input.inputId)] || `input ${index + 1}`),
            srcNodeId: Number(input.srcNodeId || 0),
            srcOutputId: Number(input.srcOutputId || 0),
          })),
          outputs: node.outputs.map((output, index) => ({
            outputId: Number(output.outputId),
            name: node.kind === NG.NODE_VALUE ? '' : String(labels.outputs?.[String(output.outputId)] || `output ${index + 1}`),
            value: String(values.get(Number(output.outputId)) || ''),
          })),
        }
      }),
      edges: this.lastGraph.edges.map((edge) => ({
        from: Number(edge.from),
        fromOutputId: Number(edge.fromOutputId),
        to: Number(edge.to),
        toInputId: Number(edge.toInputId),
        execState: Number(edge.execState || 0),
      })),
    }
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

  _graphSnapshotFromPersistedDocument(document) {
    const nodes = Array.isArray(document?.nodes) ? document.nodes : []
    const edges = Array.isArray(document?.edges) ? document.edges.map((edge) => ({
      from: Number(edge?.from || 0),
      fromOutputId: Number(edge?.fromOutputId || 0),
      to: Number(edge?.to || 0),
      toInputId: Number(edge?.toInputId || 0),
      execState: Number(edge?.execState || 0),
    })) : []
    return {
      nodes: nodes.map((node) => ({
        id: Number(node?.id || 0),
        kind: Number(node?.kind || 0),
        execState: Number(node?.execState || 0),
        inputCount: Array.isArray(node?.inputs) ? node.inputs.length : 0,
        outputCount: Array.isArray(node?.outputs) ? node.outputs.length : 0,
        inputs: (Array.isArray(node?.inputs) ? node.inputs : []).map((input, index) => ({ inputId: Number(input?.inputId || index + 1), srcNodeId: Number(input?.srcNodeId || 0), srcOutputId: Number(input?.srcOutputId || 0) })),
        outputs: (Array.isArray(node?.outputs) ? node.outputs : []).map((output, index) => ({ outputId: Number(output?.outputId || index + 1) })),
      })),
      edges,
    }
  }

  _applyPersistedGraphDocument(document) {
    this._clearPersistedMetadata()
    const nodes = Array.isArray(document?.nodes) ? document.nodes : []
    for (const node of nodes) {
      const nodeId = Number(node?.id || 0)
      if (!nodeId) continue
      this.nodeNames.set(nodeId, String(node?.name || '').trim())
      this.portLabels.set(nodeId, {
        inputs: Object.fromEntries((Array.isArray(node?.inputs) ? node.inputs : []).map((port, index) => [String(Number(port?.inputId || index + 1)), String(port?.name || '').trim()])),
        outputs: Object.fromEntries((Array.isArray(node?.outputs) ? node.outputs : []).map((port, index) => [String(Number(port?.outputId || index + 1)), Number(node?.kind || 0) === NG.NODE_VALUE ? '' : String(port?.name || '').trim()])),
      })
      if (Number(node?.kind || 0) === NG.NODE_VALUE) {
        this.valueByNode.set(nodeId, new Map((Array.isArray(node?.outputs) ? node.outputs : []).map((port, index) => [Number(port?.outputId || index + 1), String(port?.value || '')])))
      }
      if (Number(node?.kind || 0) === NG.NODE_CODE) {
        this.nodeCodePaths.set(nodeId, String(node?.codePath || '').trim())
        this.nodeCode.set(nodeId, String(node?.code || ''))
      }
      if (Number(node?.kind || 0) === NG.NODE_CALL) {
        this.nodeImportGraphIds.set(nodeId, Number(node?.graphId || 0))
        this.nodeImportGraphNames.set(nodeId, String(node?.graphName || '').trim())
        this.nodeImportGraphSummaries.set(nodeId, node?.graphSummary || { inputs: [], outputs: [] })
      }
      if (Number.isFinite(Number(node?.x)) && Number.isFinite(Number(node?.y))) {
        this.nodeLayout.set(nodeId, {
          x: Number(node.x),
          y: Number(node.y),
          width: Number(this.assets.node.width || 146),
          height: Number(this.assets.node.minHeight || 62),
        })
      }
    }
  }

  async _closengHandle() {
    if (!this.ngHandle) return
    await runtime.call('ng', 'ng_handle_close', String(this.ngHandle))
    this.ngHandle = 0
    this.ngInfoPtr = null
  }

  async _openngGraphByName(name) {
    await this._closengHandle()
    if (!this.ngMemory) {
      this.ngMemory = await runtime.memory('ng')
    }
    if (!this.ngInfoSize) {
      this.ngInfoSize = readI32String(await runtime.call('ng', 'ng_get_info_size', ''))
      assert(this.ngInfoSize > 0, 'ng.ng_get_info_size returned invalid size')
    }
    const result = await runtime.call('ng', 'ng_graph_open', JSON.stringify({ name }))
    if (result.returnCode !== 0) {
      throw new Error(`ng.ng_graph_open failed: ${decodeOutput(result) || result.returnCode}`)
    }
    const document = JSON.parse(decodeOutput(result) || 'null')
    assert(document && typeof document === 'object', 'ng.ng_graph_open returned invalid graph document')
    this.ngHandle = 1
    this._applyPersistedGraphDocument(document)
    this.setGraphSnapshot(this._graphSnapshotFromPersistedDocument(document), { preserveLayout: true, fit: true })
  }

  async refreshGraphSource() {
    await this._openngGraphByName(this.graphName)
    this.handleElement.textContent = `handle: ${this.ngHandle}`
    this._setBackendStatus('backend: ng graph storage', 'success')
    this._setStatus(`rendering ng graph '${this.graphName}' via shared memory`, 'info')
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
        if (this.nodeLayout.has(node.id)) continue
        const layout = this.assets.layout
        this.nodeLayout.set(node.id, {
          x: layout.gridOriginX + (fallbackIndex % layout.gridColumns) * layout.gridStepX,
          y: layout.gridOriginY + Math.floor(fallbackIndex / layout.gridColumns) * layout.gridStepY,
          width: Number(this.assets.node.width || 146),
          height: Number(this.assets.node.minHeight || 62),
        })
        fallbackIndex += 1
      }
    } else {
      this._initSampleLayout()
    }
    const validNodeIds = new Set(graph.nodes.map((node) => Number(node.id)))
    this.selectedNodeIds = new Set([...this.selectedNodeIds].filter((id) => validNodeIds.has(Number(id))))
    if (!validNodeIds.has(Number(this.activeNodeId))) this.activeNodeId = this.selectedNodeIds.size ? [...this.selectedNodeIds][this.selectedNodeIds.size - 1] : 0
    this._syncSelectionActionButtons()
    if (fit) this.fitToContent()
    else this.render()
  }

  async ensurengBinding() {
    if (!this.ngHandle) {
      const created = await runtime.call('ng', 'ng_handle_create', '')
      this.ngHandle = readI32String(created)
      assert(this.ngHandle > 0, 'ng.ng_handle_create returned invalid handle')
    }
    if (!this.ngMemory) {
      this.ngMemory = await runtime.memory('ng')
    }
    if (!this.ngInfoSize) {
      this.ngInfoSize = readI32String(await runtime.call('ng', 'ng_get_info_size', ''))
      assert(this.ngInfoSize > 0, 'ng.ng_get_info_size returned invalid size')
    }
    this.ngInfoPtr = readI32String(await runtime.call('ng', 'ng_get_info_ptr', String(this.ngHandle)))
    assert(this.ngInfoPtr >= 0, 'ng.ng_get_info_ptr returned invalid pointer')
    assert(this.ngInfoPtr + this.ngInfoSize <= this.ngMemory.byteLength, `ng.ng_get_info_ptr out of bounds: ptr=${this.ngInfoPtr} size=${this.ngInfoSize} mem=${this.ngMemory.byteLength}`)
  }

  readGraphSnapshotFromng() {
    assert(this.ngMemory, 'view-ng ng memory is not bound')
    assert(this.ngInfoPtr != null, 'view-ng ng info pointer is not bound')
    const dv = new DataView(this.ngMemory)
    const nodes = []
    const edges = []
    for (let i = 0; i < NG.MAX_NODES; i++) {
      const base = this.ngInfoPtr + INFO.NODES + i * ABI.NODE_SIZE
      const id = dv.getUint32(base + NODE.ID, true)
      if (id === 0) continue
      const kind = dv.getUint32(base + NODE.KIND, true)
      const execState = dv.getUint32(base + NODE.EXEC_STATE, true)
      const inputCount = dv.getUint32(base + NODE.INPUT_COUNT, true)
      const outputCount = dv.getUint32(base + NODE.OUTPUT_COUNT, true)
      const node = { id, kind, execState, inputCount, outputCount, inputs: [], outputs: [] }
      for (let j = 0; j < inputCount; j++) {
        const inBase = base + ABI.NODE_HEADER_SIZE + j * ABI.INPUT_PORT_SIZE
        const inputId = dv.getUint32(inBase, true)
        const srcNodeId = dv.getUint32(inBase + 4, true)
        const srcOutputId = dv.getUint32(inBase + 8, true)
        node.inputs.push({ inputId, srcNodeId, srcOutputId })
        if (srcNodeId) {
          edges.push({ from: srcNodeId, fromOutputId: srcOutputId, to: id, toInputId: inputId, execState })
        }
      }
      const outputsBase = base + ABI.NODE_HEADER_SIZE + NG.MAX_INPUTS * ABI.INPUT_PORT_SIZE
      for (let j = 0; j < outputCount; j++) {
        node.outputs.push({ outputId: dv.getUint32(outputsBase + j * ABI.OUTPUT_PORT_SIZE, true) })
      }
      nodes.push(node)
    }
    return { nodes, edges }
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
    const atlasSize = Math.max(1, this.textAtlas?.atlasSize || this.assets?.text?.fontPx || 14)
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
    return `state ${node.execState}`
  }

  _getStoredNodeValue(nodeId, outputId) {
    return String(this.valueByNode.get(Number(nodeId))?.get(Number(outputId)) || '')
  }

  _measureNodeSize(node) {
    const nodeCfg = this.assets?.node || {}
    const layout = this.assets?.layout || {}
    const ports = this.assets?.ports || {}
    const text = this.assets?.text || {}
    const minWidth = Number(nodeCfg.width || 146)
    const minHeight = Number(nodeCfg.minHeight || nodeCfg.height || 62)
    const padX = Number(layout.nodePaddingX || 10)
    const nodePaddingY = Number(layout.nodePaddingY || 8)
    const rowStartY = Number(ports.rowStartY || ((layout.nodeHeaderHeight || 28) + 2))
    const spacingY = Number(ports.spacingY || 18)
    const iconSizePx = Number(ports.iconSizePx || 12)
    const labelOffset = Number(ports.labelOffsetX || 10)
    const inputInsetX = Number(ports.inputInsetX || 0)
    const outputInsetX = Number(ports.outputInsetX || 0)
    const titlePx = Number(text.fontPx || 14)
    const portPx = Number(ports.labelFontPx || 11)
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
      this._drawSelectionOverlay(graph.nodes, posById, this.canvas.width, this.canvas.height, view)
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
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`)
    const blob = await res.blob()
    const image = await createImageBitmap(blob)
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
    this.skinTexture = await this._loadTextureFromUrl(this.assets.nineSlice.textureUrl)
  }

  async _loadPortTexturesFromAssets() {
    const [empty, full] = await Promise.all([
      this._loadTextureFromUrl(this.assets.ports.emptyIconUrl),
      this._loadTextureFromUrl(this.assets.ports.fullIconUrl),
    ])
    this.portTextures = { empty, full }
  }

  async _loadTextAtlasFromAssets() {
    const [metaRes, atlasRes] = await Promise.all([
      fetch(this.assets.text.source.metaUrl, { cache: 'no-cache' }),
      fetch(this.assets.text.source.atlasUrl, { cache: 'no-cache' }),
    ])
    if (!metaRes.ok) throw new Error(`failed to fetch ${this.assets.text.source.metaUrl}: ${metaRes.status}`)
    if (!atlasRes.ok) throw new Error(`failed to fetch ${this.assets.text.source.atlasUrl}: ${atlasRes.status}`)
    const meta = await metaRes.json()
    const atlasBlob = await atlasRes.blob()
    const atlasImage = await createImageBitmap(atlasBlob)
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

  _drawNodes(nodes, posById, width, height, view) {
    if (!nodes.length || !this.skinTexture) return
    const gl = this.gl
    const data = new Float32Array(nodes.length * 4)
    let o = 0
    for (const node of nodes) {
      const pos = posById.get(node.id)
      const size = this._getNodeSize(node)
      data[o++] = pos.x; data[o++] = pos.y; data[o++] = size.width; data[o++] = size.height
    }
    gl.useProgram(this.nodeProgram)
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.skinTexture.texture)
    gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'u_skin'), 0)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.nodeProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'u_viewportPx'), width, height)
    gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'u_skinSize'), this.skinTexture.width, this.skinTexture.height)
    gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'u_slice'), this.assets.nineSlice.left, this.assets.nineSlice.right, this.assets.nineSlice.top, this.assets.nineSlice.bottom)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nodes.length)
  }

  _drawSelectionOverlay(nodes, posById, width, height, view) {
    if (!this.selectedNodeIds.size) return
    const selection = this.assets.theme.selection
    const rects = []
    for (const node of nodes) {
      if (!this.selectedNodeIds.has(node.id)) continue
      const pos = posById.get(node.id)
      const size = this._getNodeSize(node)
      const isActive = Number(node.id) === Number(this.activeNodeId)
      rects.push({
        x: pos.x - (isActive ? 5 : 3),
        y: pos.y - (isActive ? 5 : 3),
        width: size.width + (isActive ? 10 : 6),
        height: size.height + (isActive ? 10 : 6),
        color: [selection[0], selection[1], selection[2], isActive ? 1.0 : 0.95],
        strokePx: isActive ? 3 : 2,
      })
    }
    this._drawRectOutline(rects, width, height, view)
  }

  _drawActiveConnection(width, height, view) {
    if (!this.connectionDrag) return
    const drag = this.connectionDrag
    const edgeCfg = this.assets.edge
    const active = this.assets.theme.edgeActive || [133 / 255, 192 / 255, 255 / 255, 1]
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
      const iconSize = Number(this.assets.ports.iconSizePx || 12) + 4
      const half = iconSize * 0.5
      this._drawPortBatch(this.portTextures.full, new Float32Array([p.x - half, p.y - half, iconSize, iconSize, 0, 0, 1, 1]), width, height, view)
      const validColor = this.assets.theme.edgeSuccess || [44 / 255, 201 / 255, 170 / 255, 0.98]
      const invalidColor = this.assets.theme.edgeError || [255 / 255, 107 / 255, 107 / 255, 0.98]
      const activeColor = this.assets.theme.edgeActive || [133 / 255, 192 / 255, 255 / 255, 1]
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
      const active = this.assets.theme.edgeActive || [133 / 255, 192 / 255, 255 / 255, 1]
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
    if (pick.kind === 'node') {
      const node = nodes.find((entry) => entry.id === pick.nodeId)
      const pos = node ? posById.get(node.id) : null
      if (!node || !pos) return
      const size = this._getNodeSize(node)
      const active = this.assets.theme.edgeActive || [133 / 255, 192 / 255, 255 / 255, 1]
      this._drawRectOutline([{ x: pos.x - 2, y: pos.y - 2, width: size.width + 4, height: size.height + 4, color: [active[0], active[1], active[2], 0.85], strokePx: 2 }], width, height, view)
    }
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
    const iconSize = Number(this.assets.ports.iconSizePx) || 12
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
    const cMuted = this.assets.theme.textMuted || c
    gl.useProgram(this.textProgram)
    gl.bindVertexArray(this.baseVao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textAtlas.texture)
    gl.uniform1i(gl.getUniformLocation(this.textProgram, 'u_tex'), 0)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.textProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.textProgram, 'u_viewport'), width, height)
    const colorLoc = gl.getUniformLocation(this.textProgram, 'u_color')
    const aa = Math.min(32.0, Math.max(6.0, Number(this.assets.text.aa || 8) * this.scale))
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'u_aa'), aa)
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'uDistRange'), this.textAtlas.distRange)
    gl.uniform1i(gl.getUniformLocation(this.textProgram, 'uEffect'), 0)
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'uStroke'), Number(this.assets.text.stroke || 2.5))
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'uGlow'), Number(this.assets.text.glow || 2))
    gl.uniform2f(gl.getUniformLocation(this.textProgram, 'uShadowPx'), Number(this.assets.text.shadowX || 4), Number(this.assets.text.shadowY || -4))
    gl.uniform2f(gl.getUniformLocation(this.textProgram, 'uAtlasSize'), this.textAtlas.atlasW, this.textAtlas.atlasH)
    const atlasSize = Math.max(1, this.textAtlas.atlasSize || 48)
    const titlePx = Number(this.assets.text.fontPx || 14)
    const portPx = Number(this.assets.ports.labelFontPx || 11)
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
    const iconHalf = Number(this.assets.ports.iconSizePx || 12) * 0.5
    const labelOffset = Number(this.assets.ports.labelOffsetX || 10)
    const padX = Number(this.assets.layout.nodePaddingX || 10)
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
