import { ViewCanvasBase } from "./view-canvas-base.js"
import { bus } from "../systems/event-bus.js"
import { parseCSVLines } from '../util/csv.js'

// Node constants
const NODE_WIDTH = 200
const NODE_HEIGHT = 120
const NODE_HEADER_HEIGHT = 30
const PORT_SIZE = 12
const PORT_SPACING = 24
const PORT_HIT_RADIUS = 20 // Larger hit area for easier clicking
const CONNECTION_HIT_RADIUS = 10 // How close to click on connection line

const DEFAULT_THEME = {
  background: '#1e1e1e',
  gridImageSrc: null,
  connectionColor: '#64748b',
  connectionActiveColor: '#3b82f6',
  connectionWidth: 2,
  selectionColor: '#3b82f6',
  selectionWidth: 3,
  portColor: '#94a3b8',
  portConnectedColor: '#3b82f6',
  textColor: '#ffffff',
  textSecondaryColor: '#94a3b8',
  valueBgColor: 'rgba(0, 0, 0, 0.6)',
  valueTextColor: '#ffffff',
  typeBadgeColor: '#64748b',
  typeBadgeTextColor: '#e2e8f0',
  titleFontFamily: 'sans-serif',
  portFontFamily: 'sans-serif',
  titleFontSize: 14,
  portFontSize: 11,
  nodeStateColors: {
    idle: '#3a3a3a',
    ready: '#2563eb',
    running: '#f59e0b',
    success: '#10b981',
    error: '#ef4444'
  },
  nodeHeaderColors: {
    input: '#6366f1',
    plugin: '#8b5cf6',
    output: '#ec4899',
    template: '#10b981',
    code: '#06b6d4'
  }
}

/**
 * Node Graph Editor View
 * 
 * Extends ViewCanvasBase to provide a visual node-based pipeline editor.
 * Nodes are HTML custom elements (children of this element) that are rendered to canvas.
 * 
 * Features:
 * - Pan and zoom (inherited from ViewCanvasBase)
 * - Visual node rendering with state colors
 * - Connection rendering based on node input attributes
 * - Node selection and dragging
 * - Interactive connection creation
 * - Pipeline execution
 */
export class ViewNodeGraph extends ViewCanvasBase {
  static get viewMeta() { return { displayName: 'Node Graph', category: 'Canvas' } }

  constructor() {
    super()

    // Node registry (id -> node element)
    this.nodes = new Map()

    // Interaction state
    // Note: selectedNodes replaced with DOM-based 'focused' attributes
    this.draggedNode = null
    this.dragOffset = { x: 0, y: 0 }

    // Connection interaction state
    this.connectionDragState = null
    // Structure:
    // {
    //   mode: 'create' | 'reconnect-input' | 'reconnect-output',
    //   fixedEnd: { nodeId, port, type: 'input'|'output', x, y },
    //   movingEnd: { x, y },
    //   originalConnection: { fromNodeId, fromPort, toNodeId, toPort }, // if reconnecting
    //   hoverTarget: { nodeId, port, type } | null // current valid hover target
    // }

    // Cached connection index for rendering
    this.connectionIndex = []

    // Execution state
    this.isExecuting = false

    // Node ID counter for simple incrementing IDs
    this.nodeIdCounter = 1

    // Cache for external node skin assets used by 9-slice rendering
    this.nodeSkinCache = new Map()
  }

  getCssValue(style, name, fallback) {
    const value = style.getPropertyValue(name).trim()
    return value || fallback
  }

  getCssNumber(style, name, fallback) {
    const raw = this.getCssValue(style, name, '')
    const parsed = parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  getCssUrl(style, name) {
    const raw = this.getCssValue(style, name, '')
    if (!raw || raw === 'none') return null
    const match = raw.match(/^url\((.*)\)$/i)
    if (!match) return null
    return match[1].trim().replace(/^['"]|['"]$/g, '') || null
  }

  getSliceInsets(style, name, fallback = { top: 8, right: 8, bottom: 8, left: 8 }) {
    const raw = this.getCssValue(style, name, '')
    if (!raw) return fallback

    const values = raw
      .split(/[\s,]+/)
      .map((part) => parseFloat(part))
      .filter((num) => Number.isFinite(num))

    if (values.length === 0) return fallback
    if (values.length === 1) {
      return { top: values[0], right: values[0], bottom: values[0], left: values[0] }
    }
    if (values.length === 2) {
      return { top: values[0], right: values[1], bottom: values[0], left: values[1] }
    }
    if (values.length === 3) {
      return { top: values[0], right: values[1], bottom: values[2], left: values[1] }
    }
    return { top: values[0], right: values[1], bottom: values[2], left: values[3] }
  }

  getGraphTheme() {
    const style = getComputedStyle(this)
    return {
      background: this.getCssValue(style, '--ng-bg', DEFAULT_THEME.background),
      gridImageSrc: this.getCssUrl(style, '--ng-grid-image') || DEFAULT_THEME.gridImageSrc,
      connectionColor: this.getCssValue(style, '--ng-conn-color', DEFAULT_THEME.connectionColor),
      connectionActiveColor: this.getCssValue(style, '--ng-conn-active-color', DEFAULT_THEME.connectionActiveColor),
      connectionWidth: this.getCssNumber(style, '--ng-conn-width', DEFAULT_THEME.connectionWidth),
      selectionColor: this.getCssValue(style, '--ng-selection-color', DEFAULT_THEME.selectionColor),
      selectionWidth: this.getCssNumber(style, '--ng-selection-width', DEFAULT_THEME.selectionWidth),
      portColor: this.getCssValue(style, '--ng-port-color', DEFAULT_THEME.portColor),
      portConnectedColor: this.getCssValue(style, '--ng-port-connected-color', DEFAULT_THEME.portConnectedColor),
      textColor: this.getCssValue(style, '--ng-text', DEFAULT_THEME.textColor),
      textSecondaryColor: this.getCssValue(style, '--ng-text-muted', DEFAULT_THEME.textSecondaryColor),
      valueBgColor: this.getCssValue(style, '--ng-value-bg', DEFAULT_THEME.valueBgColor),
      valueTextColor: this.getCssValue(style, '--ng-value-text', DEFAULT_THEME.valueTextColor),
      typeBadgeColor: this.getCssValue(style, '--ng-type-badge-bg', DEFAULT_THEME.typeBadgeColor),
      typeBadgeTextColor: this.getCssValue(style, '--ng-type-badge-text', DEFAULT_THEME.typeBadgeTextColor),
      titleFontFamily: this.getCssValue(style, '--ng-font-title', DEFAULT_THEME.titleFontFamily),
      portFontFamily: this.getCssValue(style, '--ng-font-port', DEFAULT_THEME.portFontFamily),
      titleFontSize: this.getCssNumber(style, '--ng-font-size-title', DEFAULT_THEME.titleFontSize),
      portFontSize: this.getCssNumber(style, '--ng-font-size-port', DEFAULT_THEME.portFontSize)
    }
  }

  getNodeTheme(node, graphTheme, info) {
    const style = getComputedStyle(node)
    const fallbackBody = DEFAULT_THEME.nodeStateColors[node.state] || DEFAULT_THEME.nodeStateColors.idle
    const fallbackHeader = DEFAULT_THEME.nodeHeaderColors[info.type] || DEFAULT_THEME.nodeHeaderColors.plugin

    const bodySkinSrc = this.getCssUrl(style, '--ng-node-skin-src')
    const headerSkinSrc = this.getCssUrl(style, '--ng-node-header-skin-src')

    return {
      bodyColor: this.getCssValue(style, '--ng-node-body-bg', fallbackBody),
      headerColor: this.getCssValue(style, '--ng-node-header-bg', fallbackHeader),
      selectionColor: this.getCssValue(style, '--ng-selection-color', graphTheme.selectionColor),
      bodySkinSrc,
      bodySkinSlice: this.getSliceInsets(style, '--ng-node-skin-slice'),
      headerSkinSrc,
      headerSkinSlice: this.getSliceInsets(style, '--ng-node-header-skin-slice')
    }
  }

  getOrLoadNodeSkin(src) {
    if (!src) return null

    const cached = this.nodeSkinCache.get(src)
    if (cached) return cached.ready ? cached.image : null

    const image = new Image()
    const entry = { image, ready: false, failed: false }

    image.onload = () => {
      entry.ready = true
      this.draw('skinLoaded')
    }

    image.onerror = () => {
      entry.failed = true
      this.draw('skinLoadError')
    }

    image.src = src
    this.nodeSkinCache.set(src, entry)

    return null
  }

  drawNineSlice(ctx, image, x, y, width, height, slice) {
    if (!image || width <= 0 || height <= 0) return

    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    if (!sourceWidth || !sourceHeight) return

    const left = Math.max(0, Math.min(slice.left, sourceWidth / 2))
    const right = Math.max(0, Math.min(slice.right, sourceWidth / 2))
    const top = Math.max(0, Math.min(slice.top, sourceHeight / 2))
    const bottom = Math.max(0, Math.min(slice.bottom, sourceHeight / 2))

    const destLeft = Math.max(0, Math.min(left, width / 2))
    const destRight = Math.max(0, Math.min(right, width - destLeft))
    const destTop = Math.max(0, Math.min(top, height / 2))
    const destBottom = Math.max(0, Math.min(bottom, height - destTop))

    const sourceCenterWidth = Math.max(0, sourceWidth - left - right)
    const sourceCenterHeight = Math.max(0, sourceHeight - top - bottom)
    const destCenterWidth = Math.max(0, width - destLeft - destRight)
    const destCenterHeight = Math.max(0, height - destTop - destBottom)

    const drawPart = (sx, sy, sw, sh, dx, dy, dw, dh) => {
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return
      ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
    }

    drawPart(0, 0, left, top, x, y, destLeft, destTop)
    drawPart(left, 0, sourceCenterWidth, top, x + destLeft, y, destCenterWidth, destTop)
    drawPart(sourceWidth - right, 0, right, top, x + width - destRight, y, destRight, destTop)

    drawPart(0, top, left, sourceCenterHeight, x, y + destTop, destLeft, destCenterHeight)
    drawPart(left, top, sourceCenterWidth, sourceCenterHeight, x + destLeft, y + destTop, destCenterWidth, destCenterHeight)
    drawPart(sourceWidth - right, top, right, sourceCenterHeight, x + width - destRight, y + destTop, destRight, destCenterHeight)

    drawPart(0, sourceHeight - bottom, left, bottom, x, y + height - destBottom, destLeft, destBottom)
    drawPart(left, sourceHeight - bottom, sourceCenterWidth, bottom, x + destLeft, y + height - destBottom, destCenterWidth, destBottom)
    drawPart(sourceWidth - right, sourceHeight - bottom, right, bottom, x + width - destRight, y + height - destBottom, destRight, destBottom)
  }

  createHeaderControlsElement() {
    const controls = document.createElement('div')
    controls.innerHTML = `
      <button data-action="add-node" aria-label="Add Node" title="Add Node"><i aria-hidden="true">add_ad</i></button>
      <button data-action="run" class="success" aria-label="Run" title="Run"><i aria-hidden="true">play_arrow</i></button>
      <button data-action="save" class="accent" aria-label="Save" title="Save"><i aria-hidden="true">save</i></button>
      <button data-action="load" aria-label="Load" title="Load"><i aria-hidden="true">folder_open</i></button>
      <button data-action="edit" aria-label="Edit Node" title="Edit Node"><i aria-hidden="true">edit</i></button>
      <button data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      <button data-action="zoom-in" aria-label="Zoom In" title="Zoom In"><i aria-hidden="true">zoom_in</i></button>
      <button data-action="zoom-out" aria-label="Zoom Out" title="Zoom Out"><i aria-hidden="true">zoom_out</i></button>
      <button data-action="zoom-fit" aria-label="Fit View" title="Fit View"><i aria-hidden="true">fit_screen</i></button>
    `
    return controls
  }

  setupUI() {
    // Create tooltip
    this.tileInfo = document.createElement('div')
    this.tileInfo.className = 'tooltip'
    this.tileInfo.setAttribute('data-tooltip', '')
    this.tileInfo.style.display = 'none'
    this.appendChild(this.tileInfo)
  }

  connectedCallback() {
    super.connectedCallback()

    // Setup UI button handlers (query from header controls)
    const addNodeBtn = this.queryHeaderControl('[data-action="add-node"]')
    if (addNodeBtn) {
      addNodeBtn.onclick = () => this.addNodeMenu()
    }

    const runBtn = this.queryHeaderControl('[data-action="run"]')
    if (runBtn) {
      runBtn.onclick = () => this.executeGraph()
    }

    const saveBtn = this.queryHeaderControl('[data-action="save"]')
    if (saveBtn) {
      saveBtn.onclick = () => this.showSavePopup()
    }

    const loadBtn = this.queryHeaderControl('[data-action="load"]')
    if (loadBtn) {
      loadBtn.onclick = () => this.showLoadPopup()
    }

    const reloadBtn = this.queryHeaderControl('[data-action="reload"]')
    if (reloadBtn) {
      reloadBtn.onclick = () => this.fetchData()
    }

    const zoomInBtn = this.queryHeaderControl('[data-action="zoom-in"]')
    if (zoomInBtn) {
      zoomInBtn.onclick = () => this.zoomIn()
    }

    const zoomOutBtn = this.queryHeaderControl('[data-action="zoom-out"]')
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => this.zoomOut()
    }

    const zoomFitBtn = this.queryHeaderControl('[data-action="zoom-fit"]')
    if (zoomFitBtn) {
      zoomFitBtn.onclick = () => this.fitGraphToContent()
    }

    const editBtn = this.queryHeaderControl('[data-action="edit"]')
    if (editBtn) {
      editBtn.onclick = () => this.showEditNodePopup()
    }

    // Setup keybinding event listeners
    this.setupKeybindings()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    // Clean up keybinding listeners
    if (this.keybindingUnsubscribers) {
      this.keybindingUnsubscribers.forEach(unsub => unsub())
      this.keybindingUnsubscribers = []
    }
  }

  setupKeybindings() {
    // Store unsubscribe functions for cleanup
    this.keybindingUnsubscribers = [
      bus.on('node:create', () => this.addNodeMenu()),
      bus.on('node:delete', () => this.deleteFocusedNodes()),
      bus.on('node:run', () => this.executeGraph()),
      bus.on('view:zoom-in', () => this.zoomIn()),
      bus.on('view:zoom-out', () => this.zoomOut()),
      bus.on('view:zoom-fit', () => this.fitGraphToContent()),
    ]
  }

  fitGraphToContent() {
    this.contentBounds = this.calculateContentBounds(this.data)
    return this.fitToContent()
  }

  normalizeNodePositionsToTopLeft() {
    const graphNodes = Array.from(this.children).filter((child) => child.getDisplayInfo)
    if (graphNodes.length === 0) return

    let minX = Infinity
    let minY = Infinity

    for (const node of graphNodes) {
      const x = parseFloat(node.getAttribute('x')) || 0
      const y = parseFloat(node.getAttribute('y')) || 0
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return
    if (minX === 0 && minY === 0) return

    for (const node of graphNodes) {
      const x = parseFloat(node.getAttribute('x')) || 0
      const y = parseFloat(node.getAttribute('y')) || 0
      node.setAttribute('x', (x - minX).toString())
      node.setAttribute('y', (y - minY).toString())
    }
  }

  // --- Node Registry ---

  registerNode(nodeElement) {
    const id = nodeElement.id
    if (!id) {
      console.error('Node must have an id attribute', nodeElement)
      return
    }

    this.nodes.set(id, nodeElement)

    this.rebuildConnectionIndex()
    this.draw("registerNode")
  }

  unregisterNode(nodeElement) {
    const nodeId = nodeElement.id
    // console.log(`Unregistering node: ${nodeId}`)

    // Clean up connections TO this node before removing it
    // console.log(`Cleaning up connections for deleted node: ${nodeId}`)
    this.removeConnectionsToNode(nodeId)

    // Remove from internal state
    this.nodes.delete(nodeId)
    // Focus state is automatically removed when element is removed from DOM

    // Rebuild connection index and redraw
    this.rebuildConnectionIndex()
    this.draw("unregisterNode")
  }

  // --- Data Pipeline (overrides from ViewCanvasBase) ---

  async fetchData() {
    // We don't fetch - our data IS the DOM nodes
    // Return a simple object for compatibility, but rendering uses this.children directly
    return { nodeCount: this.children.length }
  }

  calculateContentBounds(data) {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    // Count actual node elements
    let nodeCount = 0
    for (const child of this.children) {
      if (child.getDisplayInfo) nodeCount++
    }

    if (nodeCount === 0) {
      return { minX: 0, maxX: 800, minY: 0, maxY: 600 }
    }

    // Calculate bounds from DOM children (consistent with rendering)
    for (const node of this.children) {
      if (!node.getDisplayInfo) continue

      const x = parseFloat(node.getAttribute('x')) || 0
      const y = parseFloat(node.getAttribute('y')) || 0
      const info = node.getDisplayInfo()

      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x + info.width)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y + info.height)
    }

    // Add padding
    const padding = 100
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    }
  }

  drawContent(ctx, data) {
    const graphTheme = this.getGraphTheme()

    if (this.contentBounds) {
      const { minX, maxX, minY, maxY } = this.contentBounds
      ctx.fillStyle = graphTheme.background
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY)
    }

    // 1. Grid rendering disabled for performance

    // 2. Draw connections
    for (const conn of this.connectionIndex) {
      // Skip drawing the original connection if we're currently reconnecting it
      if (this.connectionDragState?.originalConnection) {
        const orig = this.connectionDragState.originalConnection
        if (conn.fromNodeId === orig.fromNodeId &&
          conn.fromPort === orig.fromPort &&
          conn.toNodeId === orig.toNodeId &&
          conn.toPort === orig.toPort) {
          continue // Skip this connection during drag
        }
      }
      this.drawConnection(ctx, conn, graphTheme)
    }

    // 3. Draw active connection being created/reconnected
    if (this.connectionDragState) {
      this.drawActiveConnection(ctx, graphTheme)
    }

    // 4. Draw nodes in DOM order (first child = back layer, last child = front layer)
    for (const node of this.children) {
      // Only draw actual node elements (skip other possible child elements)
      if (node.getDisplayInfo) {
        this.drawNode(ctx, node, graphTheme)
      }
    }
  }

  getHoverInfo(worldX, worldY, _data) {
    const node = this.getNodeAt(worldX, worldY)
    if (!node) return null

    const inputs = node.getInputConnections()
    const inputStr = inputs.map(c => `${c.port}: ${c.sourceNodeId}`).join('<br>')

    return `
      <strong>${node.id}</strong><br>
      Type: ${node.constructor.name}<br>
      State: ${node.state}<br>
      ${inputStr ? `Inputs:<br>${inputStr}` : 'No inputs'}
    `
  }

  // --- Drawing Methods ---

  drawGrid(ctx, theme) {
    if (!theme.gridImageSrc || !this.canvas) return

    const gridImage = this.getOrLoadNodeSkin(theme.gridImageSrc)
    if (!gridImage) return

    const tileWidth = gridImage.naturalWidth || gridImage.width
    const tileHeight = gridImage.naturalHeight || gridImage.height
    if (!tileWidth || !tileHeight) return

    const worldMinX = (-this.offsetX) / this.scale
    const worldMinY = (-this.offsetY) / this.scale
    const worldMaxX = worldMinX + this.canvas.width / this.scale
    const worldMaxY = worldMinY + this.canvas.height / this.scale

    const startX = Math.floor(worldMinX / tileWidth) * tileWidth
    const startY = Math.floor(worldMinY / tileHeight) * tileHeight

    for (let x = startX; x < worldMaxX + tileWidth; x += tileWidth) {
      for (let y = startY; y < worldMaxY + tileHeight; y += tileHeight) {
        ctx.drawImage(gridImage, x, y, tileWidth, tileHeight)
      }
    }
  }

  drawNode(ctx, node, graphTheme) {
    const x = parseFloat(node.getAttribute('x')) || 0
    const y = parseFloat(node.getAttribute('y')) || 0
    const focused = this.isNodeFocused(node)
    const info = node.getDisplayInfo()
    const nodeTheme = this.getNodeTheme(node, graphTheme, info)

    // Draw focus highlight
    if (focused) {
      ctx.strokeStyle = nodeTheme.selectionColor
      ctx.lineWidth = graphTheme.selectionWidth
      ctx.strokeRect(x - 2, y - 2, info.width + 4, info.height + 4)
    }

    // Draw node body
    const bodySkinImage = this.getOrLoadNodeSkin(nodeTheme.bodySkinSrc)
    if (bodySkinImage) {
      this.drawNineSlice(ctx, bodySkinImage, x, y, info.width, info.height, nodeTheme.bodySkinSlice)
    } else {
      ctx.fillStyle = nodeTheme.bodyColor
      ctx.fillRect(x, y, info.width, info.height)
    }

    // Draw node header
    const headerSkinImage = this.getOrLoadNodeSkin(nodeTheme.headerSkinSrc)
    if (headerSkinImage) {
      this.drawNineSlice(ctx, headerSkinImage, x, y, info.width, NODE_HEADER_HEIGHT, nodeTheme.headerSkinSlice)
    } else {
      ctx.fillStyle = nodeTheme.headerColor
      ctx.fillRect(x, y, info.width, NODE_HEADER_HEIGHT)
    }

    // Draw title
    ctx.fillStyle = graphTheme.textColor
    ctx.font = `${graphTheme.titleFontSize}px ${graphTheme.titleFontFamily}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(info.title, x + 10, y + NODE_HEADER_HEIGHT / 2)

    // Draw run button for executable nodes (plugin, fsread, fswrite)
    if (info.type === 'plugin' || info.type === 'fsread' || info.type === 'fswrite') {
      this.drawRunButton(ctx, x, y, info, node, graphTheme)
    }

    // Draw edit button for template and code nodes
    if (info.type === 'template' || info.type === 'code') {
      this.drawEditButton(ctx, x, y, info, node, graphTheme, nodeTheme)
      // Note: values are shown in port labels, not in node body anymore
    }

    // Draw delete button for focused nodes
    if (focused) {
      this.drawDeleteButton(ctx, x, y, info, node, graphTheme)
    }

    // Draw input ports
    this.drawPorts(ctx, x, y + NODE_HEADER_HEIGHT, info.inputs, 'input', node, graphTheme)

    // Draw output ports
    this.drawPorts(ctx, x, y + NODE_HEADER_HEIGHT, info.outputs, 'output', node, graphTheme)
  }

  drawPorts(ctx, nodeX, startY, ports, type, node, graphTheme) {
    const isInput = type === 'input'
    const portX = isInput ? nodeX : nodeX + NODE_WIDTH

    ports.forEach((port, index) => {
      const portY = startY + (index + 1) * PORT_SPACING

      // Check if this port is being dragged from (should show as disconnected)
      let isBeingDragged = false
      if (this.connectionDragState?.originalConnection) {
        const orig = this.connectionDragState.originalConnection
        if (isInput) {
          // Check if this is the input port being reconnected
          isBeingDragged = orig.toNodeId === node.id && orig.toPort === port.name
        } else {
          // Check if this is the output port being reconnected
          isBeingDragged = orig.fromNodeId === node.id && orig.fromPort === port.name
        }
      }

      // Check if this port is the hover target (should show as highlighted)
      let isHoverTarget = false
      if (this.connectionDragState?.hoverTarget) {
        const hover = this.connectionDragState.hoverTarget
        isHoverTarget = hover.nodeId === node.id && hover.port === port.name && hover.type === type
      }

      // Check if port is connected (but not if it's being dragged)
      let isConnected = false
      if (!isBeingDragged) {
        if (isInput) {
          // Check if port exists AND has a connection (not null)
          const connection = node._parsedInputs?.get(port.name)
          isConnected = connection !== undefined && connection !== null
        } else {
          // Check if any node uses this output
          isConnected = this.connectionIndex.some(
            conn => conn.fromNodeId === node.id && conn.fromPort === port.name
          )
        }
      }

      // Determine port color
      let portColor = graphTheme.portColor
      if (isHoverTarget) {
        portColor = graphTheme.portConnectedColor
      } else if (isConnected) {
        portColor = graphTheme.portConnectedColor
      }

      // Draw port circle
      ctx.fillStyle = portColor
      ctx.beginPath()
      ctx.arc(portX, portY, PORT_SIZE / 2, 0, Math.PI * 2)
      ctx.fill()

      // Draw hover highlight ring
      if (isHoverTarget) {
        ctx.strokeStyle = graphTheme.portConnectedColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(portX, portY, PORT_SIZE / 2 + 3, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Draw port label
      ctx.font = `${graphTheme.portFontSize}px ${graphTheme.portFontFamily}`
      ctx.textAlign = isInput ? 'left' : 'right'
      ctx.textBaseline = 'middle'
      const labelX = isInput ? portX + 10 : portX - 10

      // Check if node is in a colored state that needs better contrast for text
      const needsHighContrast = node.state === 'success' || node.state === 'running' || node.state === 'error'

      // For output ports with values, show value with type badge
      if (!isInput && port.hasValue) {
        const value = String(port.value)
        const truncatedValue = value.length > 8 ? value.substring(0, 8) + '...' : value
        const typeTag = this.getTypeTag(port.value)

        // Draw value with background for better readability
        const fullText = `${port.name}: ${truncatedValue}`
        const textWidth = ctx.measureText(fullText).width
        const badgeText = `[${typeTag}]`
        const badgeWidth = ctx.measureText(badgeText).width
        const totalWidth = textWidth + 4 + badgeWidth
        const bgX = isInput ? labelX - 2 : labelX - totalWidth - 2
        const bgHeight = 16
        const bgY = portY - bgHeight / 2

        // Draw dark background for value text
        ctx.fillStyle = graphTheme.valueBgColor
        ctx.fillRect(bgX, bgY, totalWidth + 4, bgHeight)

        // Draw value text
        ctx.fillStyle = graphTheme.valueTextColor
        ctx.fillText(fullText, labelX, portY)

        // Draw type badge
        const badgeX = isInput ? labelX + textWidth + 4 : labelX - textWidth - 4
        ctx.fillStyle = graphTheme.typeBadgeColor
        ctx.textAlign = isInput ? 'left' : 'right'
        ctx.fillText(badgeText, badgeX, portY)
      } else {
        // Regular port label - add background on success state for readability
        const labelText = port.label || port.name

        if (needsHighContrast) {
          const textWidth = ctx.measureText(labelText).width
          const bgHeight = 16
          const bgY = portY - bgHeight / 2
          const bgX = isInput ? labelX - 2 : labelX - textWidth - 2

          // Draw dark background
          ctx.fillStyle = graphTheme.valueBgColor
          ctx.fillRect(bgX, bgY, textWidth + 4, bgHeight)

          // Draw text in white for contrast
          ctx.fillStyle = graphTheme.valueTextColor
        } else {
          ctx.fillStyle = graphTheme.textSecondaryColor
        }
        ctx.fillText(labelText, labelX, portY)
      }
    })
  }

  /**
   * Get a short type tag for a value
   * @param {any} value - The value to get type for
   * @returns {string} Short type tag like 'num', 'str', 'bool', 'obj', 'arr', 'nil'
   */
  getTypeTag(value) {
    if (value === null || value === undefined) return 'nil'
    if (typeof value === 'number') return 'num'
    if (typeof value === 'boolean') return 'bool'
    if (typeof value === 'string') {
      // Check if it looks like a number string
      if (!isNaN(value) && value.trim() !== '') return 'num'
      // Check if it looks like a boolean string
      if (value === 'true' || value === 'false') return 'bool'
      return 'str'
    }
    if (Array.isArray(value)) return 'arr'
    if (typeof value === 'object') return 'obj'
    return '?'
  }

  drawConnection(ctx, conn, graphTheme) {
    const fromNode = this.nodes.get(conn.fromNodeId)
    const toNode = this.nodes.get(conn.toNodeId)

    if (!fromNode || !toNode) return

    const fromInfo = fromNode.getDisplayInfo()
    const toInfo = toNode.getDisplayInfo()

    // Calculate port positions
    const fromX = parseFloat(fromNode.getAttribute('x')) || 0
    const fromY = parseFloat(fromNode.getAttribute('y')) || 0
    const fromPortIndex = fromInfo.outputs.findIndex(p => p.name === conn.fromPort)

    // If port not found, default to first port (index 0)
    const validFromPortIndex = fromPortIndex >= 0 ? fromPortIndex : 0
    const fromPortY = fromY + NODE_HEADER_HEIGHT + (validFromPortIndex + 1) * PORT_SPACING

    const toX = parseFloat(toNode.getAttribute('x')) || 0
    const toY = parseFloat(toNode.getAttribute('y')) || 0
    const toPortIndex = toInfo.inputs.findIndex(p => p.name === conn.toPort)

    // If port not found, default to first port (index 0)
    const validToPortIndex = toPortIndex >= 0 ? toPortIndex : 0
    const toPortY = toY + NODE_HEADER_HEIGHT + (validToPortIndex + 1) * PORT_SPACING

    // Draw bezier curve
    this.drawBezierConnection(
      ctx,
      fromX + fromInfo.width, fromPortY,
      toX, toPortY,
      graphTheme.connectionColor,
      graphTheme.connectionWidth
    )
  }

  drawActiveConnection(ctx, graphTheme) {
    const { fixedEnd, movingEnd } = this.connectionDragState

    // Determine connection direction based on port type
    // Output ports are on the right, input ports on the left
    if (fixedEnd.type === 'output') {
      // Fixed end is output (right side), moving end will be input (left side)
      this.drawBezierConnection(
        ctx,
        fixedEnd.x, fixedEnd.y,
        movingEnd.x, movingEnd.y,
        graphTheme.connectionActiveColor,
        graphTheme.connectionWidth
      )
    } else {
      // Fixed end is input (left side), moving end will be output (right side)
      // Reverse the connection so it flows output -> input
      this.drawBezierConnection(
        ctx,
        movingEnd.x, movingEnd.y,
        fixedEnd.x, fixedEnd.y,
        graphTheme.connectionActiveColor,
        graphTheme.connectionWidth
      )
    }
  }

  drawBezierConnection(ctx, x1, y1, x2, y2, color, lineWidth = 2) {
    const dx = Math.abs(x2 - x1)
    const cpOffset = Math.min(dx * 0.5, 100)

    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.bezierCurveTo(
      x1 + cpOffset, y1,
      x2 - cpOffset, y2,
      x2, y2
    )
    ctx.stroke()
  }

  drawRunButton(ctx, nodeX, nodeY, info, node, graphTheme) {
    const buttonSize = 16
    const buttonX = nodeX + info.width - buttonSize - 6
    const buttonY = nodeY + (NODE_HEADER_HEIGHT - buttonSize) / 2

    // Determine button color based on node state
    let buttonColor = graphTheme.portColor
    let iconType = 'play'

    switch (node.state) {
      case 'running':
        buttonColor = DEFAULT_THEME.nodeStateColors.running
        iconType = 'pause'
        break
      case 'success':
        buttonColor = DEFAULT_THEME.nodeStateColors.success
        iconType = 'refresh'
        break
      case 'error':
        buttonColor = DEFAULT_THEME.nodeStateColors.error
        iconType = 'refresh'
        break
      default:
        buttonColor = graphTheme.portColor
        iconType = 'play'
    }

    // Draw button background
    ctx.fillStyle = buttonColor
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw button border
    ctx.strokeStyle = graphTheme.textColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.stroke()

    this.drawNodeButtonIcon(ctx, iconType, buttonX, buttonY, buttonSize, graphTheme.textColor)

    // Store button bounds for click detection
    node._runButtonBounds = {
      x: buttonX,
      y: buttonY,
      width: buttonSize,
      height: buttonSize
    }
  }

  drawEditButton(ctx, nodeX, nodeY, info, node, graphTheme, nodeTheme) {
    const buttonSize = 16
    const buttonX = nodeX + info.width - buttonSize - 6
    const buttonY = nodeY + (NODE_HEADER_HEIGHT - buttonSize) / 2

    // Edit button color - blue for template nodes
    const buttonColor = nodeTheme.headerColor
    const iconType = 'edit'

    // Draw button background
    ctx.fillStyle = buttonColor
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw button border
    ctx.strokeStyle = graphTheme.textColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.stroke()

    this.drawNodeButtonIcon(ctx, iconType, buttonX, buttonY, buttonSize, graphTheme.textColor)

    // Store button bounds for click detection
    node._editButtonBounds = {
      x: buttonX,
      y: buttonY,
      width: buttonSize,
      height: buttonSize
    }
  }

  drawTemplateValues(ctx, nodeX, nodeY, info, node, graphTheme) {
    // Show current output values in the node body
    if (!info.values || info.values.size === 0) return

    const valuesY = nodeY + NODE_HEADER_HEIGHT + 8
    const maxWidth = info.width - 20
    const lineHeight = 18
    const padding = 4

    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    let currentY = valuesY

    // Display up to 3 values to avoid cluttering
    let count = 0
    for (const [key, value] of info.values) {
      if (count >= 3) break

      const displayValue = String(value).length > 12 ? String(value).substring(0, 12) + '...' : String(value)
      const typeTag = this.getTypeTag(value)
      const text = `${key}: ${displayValue}`
      const badgeText = `[${typeTag}]`

      // Measure text for background
      const textWidth = ctx.measureText(text).width
      const badgeWidth = ctx.measureText(badgeText).width
      const totalWidth = Math.min(textWidth + 4 + badgeWidth, maxWidth)

      // Draw dark background for better readability on success (green) state
      ctx.fillStyle = graphTheme.valueBgColor
      ctx.fillRect(nodeX + 10 - padding, currentY - 2, totalWidth + padding * 2, lineHeight)

      // Draw value text
      ctx.fillStyle = graphTheme.valueTextColor
      let finalText = text
      if (textWidth > maxWidth - badgeWidth - 8) {
        // Truncate text to fit
        const ratio = (maxWidth - badgeWidth - 8) / textWidth
        const truncateIndex = Math.floor(text.length * ratio) - 3
        finalText = text.substring(0, Math.max(0, truncateIndex)) + '...'
      }
      ctx.fillText(finalText, nodeX + 10, currentY)

      // Draw type badge
      const finalTextWidth = ctx.measureText(finalText).width
      ctx.fillStyle = graphTheme.typeBadgeColor
      ctx.fillText(badgeText, nodeX + 10 + finalTextWidth + 4, currentY)

      currentY += lineHeight
      count++
    }

    // Show "..." if there are more values
    if (info.values.size > 3) {
      ctx.fillText('...', nodeX + 10, currentY)
    }
  }

  drawDeleteButton(ctx, nodeX, nodeY, info, node, graphTheme) {
    const buttonSize = 14
    const buttonX = nodeX + 4 // Position in top-left corner of node
    const buttonY = nodeY + 4

    // Delete button color - red for danger
    const buttonColor = DEFAULT_THEME.nodeStateColors.error
    const iconType = 'close'

    // Draw button background
    ctx.fillStyle = buttonColor
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw button border
    ctx.strokeStyle = graphTheme.textColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.stroke()

    this.drawNodeButtonIcon(ctx, iconType, buttonX, buttonY, buttonSize, graphTheme.textColor)

    // Store button bounds for click detection
    node._deleteButtonBounds = {
      x: buttonX,
      y: buttonY,
      width: buttonSize,
      height: buttonSize
    }
  }

  drawNodeButtonIcon(ctx, iconType, buttonX, buttonY, buttonSize, color) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const cx = buttonX + buttonSize / 2
    const cy = buttonY + buttonSize / 2
    const half = buttonSize / 2

    if (iconType === 'play') {
      ctx.beginPath()
      ctx.moveTo(cx - half * 0.35, cy - half * 0.55)
      ctx.lineTo(cx + half * 0.55, cy)
      ctx.lineTo(cx - half * 0.35, cy + half * 0.55)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      return
    }

    if (iconType === 'pause') {
      const bar = half * 0.3
      const h = half * 1.1
      ctx.fillRect(cx - bar - 1, cy - h / 2, bar, h)
      ctx.fillRect(cx + 1, cy - h / 2, bar, h)
      ctx.restore()
      return
    }

    if (iconType === 'refresh') {
      ctx.beginPath()
      ctx.arc(cx, cy, half * 0.55, Math.PI * 0.1, Math.PI * 1.65)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx + half * 0.4, cy - half * 0.55)
      ctx.lineTo(cx + half * 0.7, cy - half * 0.55)
      ctx.lineTo(cx + half * 0.68, cy - half * 0.25)
      ctx.fill()
      ctx.restore()
      return
    }

    if (iconType === 'edit') {
      ctx.beginPath()
      ctx.moveTo(cx - half * 0.45, cy + half * 0.35)
      ctx.lineTo(cx - half * 0.1, cy + half * 0.05)
      ctx.lineTo(cx + half * 0.4, cy - half * 0.45)
      ctx.lineTo(cx + half * 0.15, cy - half * 0.7)
      ctx.lineTo(cx - half * 0.35, cy - half * 0.2)
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
      return
    }

    if (iconType === 'close') {
      ctx.beginPath()
      ctx.moveTo(cx - half * 0.45, cy - half * 0.45)
      ctx.lineTo(cx + half * 0.45, cy + half * 0.45)
      ctx.moveTo(cx + half * 0.45, cy - half * 0.45)
      ctx.lineTo(cx - half * 0.45, cy + half * 0.45)
      ctx.stroke()
      ctx.restore()
      return
    }

    ctx.restore()
  }

  // --- Connection Index ---

  rebuildConnectionIndex() {
    this.connectionIndex = []

    for (const node of this.nodes.values()) {
      const connections = node.getInputConnections()

      for (const conn of connections) {
        this.connectionIndex.push({
          fromNodeId: conn.sourceNodeId,
          fromPort: conn.sourcePort,
          toNodeId: node.id,
          toPort: conn.port
        })
      }
    }
  }

  // --- Connection Interaction ---

  /**
   * Get connection at world coordinates
   * @returns {{ connection: object, side: 'input'|'output' } | null}
   */
  getConnectionAt(worldX, worldY) {
    for (const conn of this.connectionIndex) {
      const dist = this.distanceToConnection(worldX, worldY, conn)

      if (dist < CONNECTION_HIT_RADIUS) {
        // Determine which side is closer
        const side = this.getConnectionSide(worldX, worldY, conn)
        return { connection: conn, side }
      }
    }
    return null
  }

  /**
   * Calculate distance from point to connection bezier curve
   */
  distanceToConnection(x, y, connection) {
    const points = this.getConnectionCurvePoints(connection)
    if (!points) return Infinity

    const { x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y } = points

    // Sample points along bezier curve
    let minDist = Infinity
    for (let t = 0; t <= 1; t += 0.05) {
      const px = this.bezierPoint(t, x1, cp1x, cp2x, x2)
      const py = this.bezierPoint(t, y1, cp1y, cp2y, y2)
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
      minDist = Math.min(minDist, dist)
    }

    return minDist
  }

  /**
   * Calculate point on cubic bezier curve at t (0 to 1)
   */
  bezierPoint(t, p0, p1, p2, p3) {
    const u = 1 - t
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  }

  /**
   * Get bezier curve control points for a connection
   */
  getConnectionCurvePoints(connection) {
    const fromNode = this.nodes.get(connection.fromNodeId)
    const toNode = this.nodes.get(connection.toNodeId)

    if (!fromNode || !toNode) return null

    const fromInfo = fromNode.getDisplayInfo()
    const toInfo = toNode.getDisplayInfo()

    // Calculate port positions
    const fromX = parseFloat(fromNode.getAttribute('x')) || 0
    const fromY = parseFloat(fromNode.getAttribute('y')) || 0
    const fromPortIndex = fromInfo.outputs.findIndex(p => p.name === connection.fromPort)
    const validFromPortIndex = fromPortIndex >= 0 ? fromPortIndex : 0
    const fromPortY = fromY + NODE_HEADER_HEIGHT + (validFromPortIndex + 1) * PORT_SPACING

    const toX = parseFloat(toNode.getAttribute('x')) || 0
    const toY = parseFloat(toNode.getAttribute('y')) || 0
    const toPortIndex = toInfo.inputs.findIndex(p => p.name === connection.toPort)
    const validToPortIndex = toPortIndex >= 0 ? toPortIndex : 0
    const toPortY = toY + NODE_HEADER_HEIGHT + (validToPortIndex + 1) * PORT_SPACING

    const x1 = fromX + fromInfo.width
    const y1 = fromPortY
    const x2 = toX
    const y2 = toPortY

    const dx = Math.abs(x2 - x1)
    const cpOffset = Math.min(dx * 0.5, 100)

    return {
      x1, y1, x2, y2,
      cp1x: x1 + cpOffset,
      cp1y: y1,
      cp2x: x2 - cpOffset,
      cp2y: y2
    }
  }

  /**
   * Determine which side of connection is closer to point
   * @returns {'input'|'output'}
   */
  getConnectionSide(worldX, worldY, connection) {
    const points = this.getConnectionCurvePoints(connection)
    if (!points) return 'input'

    const distToStart = Math.sqrt((worldX - points.x1) ** 2 + (worldY - points.y1) ** 2)
    const distToEnd = Math.sqrt((worldX - points.x2) ** 2 + (worldY - points.y2) ** 2)

    return distToStart < distToEnd ? 'output' : 'input'
  }

  /**
   * Find existing connection to an input port
   */
  findConnectionToInput(nodeId, portName) {
    return this.connectionIndex.find(
      conn => conn.toNodeId === nodeId && conn.toPort === portName
    )
  }

  // --- Focus Management (DOM-based state) ---

  /**
   * Set focus state on a node (DOM attribute-based)
   * @param {Element} node - The node to focus
   * @param {boolean} focused - Whether to focus or unfocus
   */
  setNodeFocus(node, focused) {
    if (!node) return

    if (focused) {
      node.setAttribute('focused', 'true')
    } else {
      node.removeAttribute('focused')
    }
  }

  /**
   * Check if a node is focused (DOM attribute-based)
   * @param {Element} node - The node to check
   * @returns {boolean}
   */
  isNodeFocused(node) {
    return node && node.hasAttribute('focused')
  }

  /**
   * Get all currently focused nodes (DOM attribute-based)
   * @returns {Array<Element>}
   */
  getFocusedNodes() {
    const focused = []
    for (const child of this.children) {
      if (child.hasAttribute('focused')) {
        focused.push(child)
      }
    }
    return focused
  }

  /**
   * Clear focus from all nodes
   */
  clearAllFocus() {
    for (const child of this.children) {
      if (child.hasAttribute('focused')) {
        child.removeAttribute('focused')
      }
    }
  }

  /**
   * Move a node to the front (last in DOM order) for both visual and click priority
   * This implements "DOM as state" - last child = front layer = highest priority
   * Uses moveBefore() to preserve state without triggering disconnected/connected callbacks
   */
  focusNode(node) {
    if (!node || !this.contains(node)) {
      return
    }

    // Check if node is already last (no need to move)
    if (this.lastElementChild === node) {
      return
    }

    // console.log(`Moving node ${node.id} to front (preserving state and connections)`)

    // Use moveBefore() to move the node to the end
    // parent.moveBefore(child, null) moves child to the end of parent
    // This triggers connectedMoveCallback instead of disconnected/connected callbacks
    // which preserves all state automatically without needing workarounds
    this.moveBefore(node, null)

    // console.log(`Node ${node.id} moved to front successfully`)

    // Redraw to show the new layering
    this.draw("focusNode")
  }

  // --- Interaction Helpers ---

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect()
    const x = (screenX - rect.left - this.offsetX) / this.scale
    const y = (screenY - rect.top - this.offsetY) / this.scale
    return { x, y }
  }

  /**
   * Get node at world coordinates
   * Iterates in reverse DOM order so last child (front layer) gets priority
   */
  getNodeAt(worldX, worldY) {
    // Iterate through DOM children in reverse order (last child = front layer = highest priority)
    const children = Array.from(this.children)
    for (let i = children.length - 1; i >= 0; i--) {
      const node = children[i]

      // Only check actual node elements
      if (!node.getDisplayInfo) continue

      const x = parseFloat(node.getAttribute('x')) || 0
      const y = parseFloat(node.getAttribute('y')) || 0
      const info = node.getDisplayInfo()

      if (worldX >= x && worldX <= x + info.width &&
        worldY >= y && worldY <= y + info.height) {
        return node
      }
    }
    return null
  }

  /**
   * Get port at world coordinates within a node
   * @returns {{ port: object, type: 'input'|'output', index: number } | null}
   */
  getPortAt(node, worldX, worldY) {
    const x = parseFloat(node.getAttribute('x')) || 0
    const y = parseFloat(node.getAttribute('y')) || 0
    const info = node.getDisplayInfo()

    const startY = y + NODE_HEADER_HEIGHT

    // Check input ports (left side)
    for (let i = 0; i < info.inputs.length; i++) {
      const portX = x
      const portY = startY + (i + 1) * PORT_SPACING
      const dist = Math.sqrt((worldX - portX) ** 2 + (worldY - portY) ** 2)

      if (dist <= PORT_HIT_RADIUS) {
        return { port: info.inputs[i], type: 'input', index: i }
      }
    }

    // Check output ports (right side)
    for (let i = 0; i < info.outputs.length; i++) {
      const portX = x + info.width
      const portY = startY + (i + 1) * PORT_SPACING
      const dist = Math.sqrt((worldX - portX) ** 2 + (worldY - portY) ** 2)

      if (dist <= PORT_HIT_RADIUS) {
        return { port: info.outputs[i], type: 'output', index: i }
      }
    }

    return null
  }

  // --- Canvas Hook Implementations (called when space is NOT pressed) ---

  /**
   * Check if a world point is occluded by any node in front of the given node index
   * Used to ensure front nodes' bodies take priority over back nodes' ports
   * @param {number} worldX - World X coordinate
   * @param {number} worldY - World Y coordinate  
   * @param {number} behindNodeIndex - Index of the node we're checking ports for
   * @param {Array} children - Array of child elements (DOM order)
   * @returns {boolean} True if point is covered by a node in front
   */
  isPointOccludedByFrontNode(worldX, worldY, behindNodeIndex, children) {
    // Check nodes that are in front (higher index = later in DOM = in front)
    for (let j = behindNodeIndex + 1; j < children.length; j++) {
      const frontNode = children[j]
      if (!frontNode.getDisplayInfo) continue

      const x = parseFloat(frontNode.getAttribute('x')) || 0
      const y = parseFloat(frontNode.getAttribute('y')) || 0
      const info = frontNode.getDisplayInfo()

      if (worldX >= x && worldX <= x + info.width &&
        worldY >= y && worldY <= y + info.height) {
        return true // Point is occluded by this front node's body
      }
    }
    return false
  }

  onCanvasMouseDown(e) {
    const worldPos = this.screenToWorld(e.clientX, e.clientY)

    // Priority 1: Check if clicking on a port (extended hit area - highest priority)
    // Check nodes in reverse DOM order so front nodes get priority
    // But also check that no front node's body occludes the port
    const children = Array.from(this.children)
    for (let i = children.length - 1; i >= 0; i--) {
      const node = children[i]
      if (!node.getDisplayInfo) continue

      const portHit = this.getPortAt(node, worldPos.x, worldPos.y)

      if (portHit) {
        // Check if this port is occluded by a node in front
        // If so, skip this port hit and let the node body handle it
        if (this.isPointOccludedByFrontNode(worldPos.x, worldPos.y, i, children)) {
          continue // Port is hidden behind another node's body
        }

        if (portHit.type === 'output') {
          // Output port - always create new connection (outputs support multiple connections)
          this.startConnectionCreate(node, portHit.port, 'output', worldPos)
          return
        } else {
          // Input port - check if already connected
          const existingConn = this.findConnectionToInput(node.id, portHit.port.name)
          if (existingConn) {
            // Reconnect existing connection
            this.startConnectionReconnect(existingConn, 'input', worldPos)
          } else {
            // Start new connection from input port
            this.startConnectionCreate(node, portHit.port, 'input', worldPos)
          }
          return
        }
      }
    }

    // Priority 2: Check if clicking on node body
    const node = this.getNodeAt(worldPos.x, worldPos.y)

    if (node) {
      // Check delete button first (highest priority for focused nodes)
      if (this.isNodeFocused(node) && node._deleteButtonBounds && this.isPointInDeleteButton(worldPos, node)) {
        this.onDeleteButtonClick(node)
        return
      }

      // Check if clicking on run button
      if (node._runButtonBounds && this.isPointInRunButton(worldPos, node)) {
        this.onRunButtonClick(node)
        return
      }

      // Check if clicking on edit button for template nodes
      if (node._editButtonBounds && this.isPointInEditButton(worldPos, node)) {
        this.onEditButtonClick(node)
        return
      }

      // Handle multi-selection with Ctrl/Cmd key
      if (e.ctrlKey || e.metaKey) {
        // Toggle focus with Ctrl/Cmd
        if (this.isNodeFocused(node)) {
          this.setNodeFocus(node, false)
        } else {
          this.setNodeFocus(node, true)
          // Move focused node to front
          this.focusNode(node)
        }
      } else {
        // Single selection (clear others)
        this.clearAllFocus()
        this.setNodeFocus(node, true)
        // Move focused node to front
        this.focusNode(node)
      }

      const nodeX = parseFloat(node.getAttribute('x')) || 0
      const nodeY = parseFloat(node.getAttribute('y')) || 0

      this.draggedNode = node
      this.dragOffset = {
        x: worldPos.x - nodeX,
        y: worldPos.y - nodeY
      }

      // No need to call this.draw() here since focusNode already calls it
      return
    }

    // Priority 3: Check if clicking on connection line (lowest priority)
    const connHit = this.getConnectionAt(worldPos.x, worldPos.y)
    if (connHit) {
      this.startConnectionReconnect(connHit.connection, connHit.side, worldPos)
      return
    }

    // Clicked on empty space - clear all focus (defocus)
    if (!e.ctrlKey && !e.metaKey) {
      this.clearAllFocus()
      this.draw()
    }
  }

  onCanvasMouseMove(e) {
    const worldPos = this.screenToWorld(e.clientX, e.clientY)

    // Handle connection drag
    if (this.connectionDragState) {
      this.connectionDragState.movingEnd = { x: worldPos.x, y: worldPos.y }

      // Find hover target for visual feedback
      this.connectionDragState.hoverTarget = null
      const children = Array.from(this.children)
      for (let i = children.length - 1; i >= 0; i--) {
        const node = children[i]
        if (!node.getDisplayInfo) continue

        const portHit = this.getPortAt(node, worldPos.x, worldPos.y)
        if (portHit) {
          // Check if this is a valid connection target
          const isValid = this.validateConnection(this.connectionDragState, node, portHit)
          if (isValid) {
            this.connectionDragState.hoverTarget = {
              nodeId: node.id,
              port: portHit.port.name,
              type: portHit.type
            }
          }
          break
        }
      }

      this.draw()
      return
    }

    // Handle node drag
    if (this.draggedNode) {
      const newX = worldPos.x - this.dragOffset.x
      const newY = worldPos.y - this.dragOffset.y

      this.draggedNode.setAttribute('x', newX)
      this.draggedNode.setAttribute('y', newY)
      this.draw()
      return
    }
  }

  onCanvasMouseUp(e) {
    // Handle connection creation/reconnection
    if (this.connectionDragState) {
      const worldPos = this.screenToWorld(e.clientX, e.clientY)

      // Check if dropping on any port (extended hit area)
      let targetNode = null
      let portHit = null

      const children = Array.from(this.children)
      for (let i = children.length - 1; i >= 0; i--) {
        const node = children[i]
        if (!node.getDisplayInfo) continue

        const hit = this.getPortAt(node, worldPos.x, worldPos.y)
        if (hit) {
          targetNode = node
          portHit = hit
          break
        }
      }

      if (targetNode && portHit) {
        // Validate: can we connect?
        const isValid = this.validateConnection(
          this.connectionDragState,
          targetNode,
          portHit
        )

        if (isValid) {
          // Determine from/to based on port types
          let fromNodeId, fromPort, toNodeId, toPort

          if (this.connectionDragState.fixedEnd.type === 'output') {
            // Fixed end is output, moving end connected to input
            fromNodeId = this.connectionDragState.fixedEnd.nodeId
            fromPort = this.connectionDragState.fixedEnd.port
            toNodeId = targetNode.id
            toPort = portHit.port.name
          } else {
            // Fixed end is input, moving end connected to output
            fromNodeId = targetNode.id
            fromPort = portHit.port.name
            toNodeId = this.connectionDragState.fixedEnd.nodeId
            toPort = this.connectionDragState.fixedEnd.port
          }

          // If reconnecting, disconnect the old connection first
          if (this.connectionDragState.mode !== 'create' && this.connectionDragState.originalConnection) {
            const orig = this.connectionDragState.originalConnection
            this.disconnectInput(orig.toNodeId, orig.toPort)
          }

          this.completeConnection(fromNodeId, fromPort, toNodeId, toPort)
        } else if (this.connectionDragState.mode !== 'create' && this.connectionDragState.originalConnection) {
          // Reconnection to invalid port - disconnect (delete the connection)
          const orig = this.connectionDragState.originalConnection
          this.disconnectInput(orig.toNodeId, orig.toPort)
        }
      } else if (this.connectionDragState.mode !== 'create' && this.connectionDragState.originalConnection) {
        // Dropped on empty space during reconnection - disconnect (delete)
        const orig = this.connectionDragState.originalConnection
        this.disconnectInput(orig.toNodeId, orig.toPort)
      }

      // Clear state
      this.connectionDragState = null
      this.draw()
      return
    }

    // End node drag
    this.draggedNode = null
  }

  // --- Node Deletion ---

  /**
   * Delete a node by removing it from the DOM
   * This triggers the disconnectedCallback -> unregisterNode flow automatically
   * @param {string} nodeId - ID of the node to delete
   */
  deleteNode(nodeId) {
    const node = this.nodes.get(nodeId)
    if (!node) {
      console.warn(`Cannot delete node ${nodeId}: not found`)
      return false
    }

    // console.log(`Deleting node: ${nodeId}`)

    // Remove from DOM - this triggers disconnectedCallback -> unregisterNode
    node.remove()
    return true
  }

  /**
   * Delete currently focused nodes
   */
  deleteFocusedNodes() {
    const nodesToDelete = this.getFocusedNodes()
    if (nodesToDelete.length === 0) {
      // console.log('No nodes focused for deletion')
      return 0
    }

    // console.log(`Deleting ${nodesToDelete.length} focused nodes`)

    for (const node of nodesToDelete) {
      this.deleteNode(node.id)
    }

    return nodesToDelete.length
  }


  /**
   * Remove all connections TO a specific node
   * This cleans up input connections on other nodes that reference the deleted node
   * @param {string} nodeId - ID of the node being deleted
   */
  removeConnectionsToNode(nodeId) {
    // console.log(`Cleaning up connections to node: ${nodeId}`)

    let anyUpdated = false

    // Find all nodes that have inputs connected to this node
    for (const [id, node] of this.nodes) {
      if (id === nodeId) continue // Skip the node being deleted

      const currentInputs = node.getAttribute('inputs') || ''
      if (!currentInputs) continue

      const inputPairs = currentInputs.split(',').map(s => s.trim()).filter(Boolean)

      // Disconnect connections to the deleted node (keep port, remove connection)
      const updatedPairs = inputPairs.map(pair => {
        const [port, source] = pair.split(':')
        if (!source) return pair // Keep disconnected ports as-is

        const [sourceNodeId] = source.split('.')
        if (sourceNodeId === nodeId) {
          // Disconnect this port (remove source, keep port definition)
          return port
        }
        return pair // Keep connected ports to other nodes
      })

      // Update the inputs attribute if any connections were disconnected
      const hasChanges = updatedPairs.some((pair, index) => pair !== inputPairs[index])
      if (hasChanges) {
        const newInputs = updatedPairs.join(',')
        // console.log(`  Disconnected ${node.id} inputs: ${currentInputs} -> ${newInputs}`)
        node.setAttribute('inputs', newInputs)
        anyUpdated = true
      }
    }

    // Rebuild connection index if any connections were updated
    if (anyUpdated) {
      this.rebuildConnectionIndex()
    }
  }

  // --- Connection Management ---

  /**
   * Disconnect an input port (removes the :source part, keeps the port definition)
   */
  disconnectInput(nodeId, portName) {
    const node = this.nodes.get(nodeId)
    if (!node) return

    const currentInputs = node.getAttribute('inputs') || ''
    const inputPairs = currentInputs.split(',').map(s => s.trim()).filter(Boolean)

    // Convert "portName:source" -> "portName" (keeping port, removing connection)
    const updated = inputPairs.map(pair => {
      const [port] = pair.split(':')
      if (port === portName) {
        return port // Remove the :source part, keep just the port name
      }
      return pair // Keep other ports unchanged
    })

    node.setAttribute('inputs', updated.join(','))
    this.rebuildConnectionIndex()
  }

  /**
   * Complete a connection (create or reconnect)
   */
  completeConnection(fromNodeId, fromPort, toNodeId, toPort) {
    const toNode = this.nodes.get(toNodeId)
    if (!toNode) return

    const currentInputs = toNode.getAttribute('inputs') || ''
    const inputPairs = currentInputs.split(',').map(s => s.trim()).filter(Boolean)

    // Update the connection for this port (preserve port order)
    const updated = inputPairs.map(pair => {
      const [port] = pair.split(':')
      if (port === toPort) {
        // Update this port's connection
        return `${toPort}:${fromNodeId}.${fromPort}`
      }
      return pair // Keep other ports unchanged
    })

    // If port didn't exist yet, add it
    const portExists = inputPairs.some(pair => pair.split(':')[0] === toPort)
    if (!portExists) {
      updated.push(`${toPort}:${fromNodeId}.${fromPort}`)
    }

    // Update attribute
    toNode.setAttribute('inputs', updated.join(','))

    this.rebuildConnectionIndex()
    this.draw()
  }

  /**
   * Validate if connection can be created
   */
  validateConnection(dragState, targetNode, targetPort) {
    // Rule 1: Can't connect output to output, or input to input
    if (dragState.fixedEnd.type === targetPort.type) {
      return false
    }

    // Rule 2: Can't connect node to itself
    if (dragState.fixedEnd.nodeId === targetNode.id) {
      return false
    }

    return true
  }

  /**
   * Start creating a new connection from a port
   */
  startConnectionCreate(node, port, portType, worldPos) {
    const nodeX = parseFloat(node.getAttribute('x')) || 0
    const nodeY = parseFloat(node.getAttribute('y')) || 0
    const info = node.getDisplayInfo()

    const portList = portType === 'output' ? info.outputs : info.inputs
    const portIndex = portList.findIndex(p => p.name === port.name)
    const validPortIndex = portIndex >= 0 ? portIndex : 0
    const portY = nodeY + NODE_HEADER_HEIGHT + (validPortIndex + 1) * PORT_SPACING
    const portX = portType === 'output' ? nodeX + info.width : nodeX

    this.connectionDragState = {
      mode: 'create',
      fixedEnd: {
        nodeId: node.id,
        port: port.name,
        type: portType,
        x: portX,
        y: portY
      },
      movingEnd: { x: worldPos.x, y: worldPos.y }
    }
  }

  /**
   * Start reconnecting an existing connection
   */
  startConnectionReconnect(connection, grabbedSide, worldPos) {
    // Store original connection - we'll need this to restore if user cancels
    this.connectionDragState = {
      mode: grabbedSide === 'input' ? 'reconnect-input' : 'reconnect-output',
      originalConnection: { ...connection },
      movingEnd: { x: worldPos.x, y: worldPos.y }
    }

    // Get the fixed end position
    const points = this.getConnectionCurvePoints(connection)
    if (grabbedSide === 'input') {
      // Disconnecting input side, output stays fixed
      this.connectionDragState.fixedEnd = {
        nodeId: connection.fromNodeId,
        port: connection.fromPort,
        type: 'output',
        x: points.x1,
        y: points.y1
      }
    } else {
      // Disconnecting output side, input stays fixed  
      this.connectionDragState.fixedEnd = {
        nodeId: connection.toNodeId,
        port: connection.toPort,
        type: 'input',
        x: points.x2,
        y: points.y2
      }
    }

    // Don't actually disconnect yet - we'll do that only when:
    // 1. User successfully connects to a new target, OR
    // 2. User drops on empty space (intentional delete)
    // The draw() method will skip rendering this connection during the drag
  }

  // --- Run Button Handling ---

  /**
   * Check if a point is within a node's run button
   */
  isPointInRunButton(worldPos, node) {
    if (!node._runButtonBounds) return false

    const bounds = node._runButtonBounds
    return worldPos.x >= bounds.x &&
      worldPos.x <= bounds.x + bounds.width &&
      worldPos.y >= bounds.y &&
      worldPos.y <= bounds.y + bounds.height
  }

  /**
   * Handle run button click
   */
  async onRunButtonClick(node) {
    if (node.isExecuting) {
      // console.log(`Node ${node.id} is already executing`)
      return
    }

    const isRerun = node.state === 'success' || node.state === 'error'
    const action = isRerun ? 'Re-running' : 'Running'

    // console.log(`${action} node: ${node.id}`)

    try {
      // Force rerun if the node has already completed
      const outputPorts = node.getOutputPorts()
      const firstOutput = outputPorts.length > 0 ? outputPorts[0].name : 'output'

      await node.getOutputValue(firstOutput, isRerun) // Force rerun if needed
      // console.log(`✓ Node ${node.id} completed successfully`)
    } catch (error) {
      console.error(`✗ Node ${node.id} failed:`, error)
    }

    this.draw()
  }

  // --- Delete Button Handling ---

  /**
   * Check if a point is within a node's delete button
   */
  isPointInDeleteButton(worldPos, node) {
    if (!node._deleteButtonBounds) return false

    const bounds = node._deleteButtonBounds
    return worldPos.x >= bounds.x &&
      worldPos.x <= bounds.x + bounds.width &&
      worldPos.y >= bounds.y &&
      worldPos.y <= bounds.y + bounds.height
  }

  /**
   * Handle delete button click
   */
  onDeleteButtonClick(node) {
    // console.log(`Delete button clicked for node: ${node.id}`)

    // Delete immediately for better UX (no confirmation dialog)
    this.deleteNode(node.id)
  }

  // --- Edit Button Handling ---

  /**
   * Check if a point is within a node's edit button
   */
  isPointInEditButton(worldPos, node) {
    if (!node._editButtonBounds) return false

    const bounds = node._editButtonBounds
    return worldPos.x >= bounds.x &&
      worldPos.x <= bounds.x + bounds.width &&
      worldPos.y >= bounds.y &&
      worldPos.y <= bounds.y + bounds.height
  }

  /**
   * Handle edit button click
   */
  async onEditButtonClick(node) {
    if (node.constructor.name !== 'NodePopup' && node.constructor.name !== 'NodeCode') {
      console.error('Edit button clicked on non-editable node:', node)
      return
    }

    // console.log(`Opening edit popup for node: ${node.id}`)

    try {
      await node.openEditPopup()
    } catch (error) {
      console.error(`Failed to open edit popup for ${node.id}:`, error)
    }
  }

  // --- Execution ---

  async executeGraph() {
    if (this.isExecuting) return

    this.isExecuting = true
    // console.log('Executing entire graph...')

    try {
      // Execute all output nodes (they will naturally trigger their dependencies)
      const outputNodes = Array.from(this.nodes.values()).filter(
        node => node.getOutputPorts().length === 0 || node.constructor.name === 'NodeOutput'
      )

      if (outputNodes.length === 0) {
        // console.log('No output nodes found. Try adding some output nodes or use individual run buttons.')
        return
      }

      for (const node of outputNodes) {
        // console.log(`Executing output node: ${node.id}`)
        try {
          await node.startExecution()
        } catch (error) {
          console.error(`Output node ${node.id} failed:`, error)
        }
      }

      console.log('✓ Graph execution completed')
    } finally {
      this.isExecuting = false
    }
  }

  // --- UI Actions ---

  async addNodeMenu() {
    try {
      // Query templates from database
      const result = await window.pluginManager.call('sql', 'query',
        'SELECT name, category, description, html_template FROM node_templates ORDER BY category, name'
      )

      const csv = new TextDecoder().decode(result.output)
      const templates = this.parseTemplatesCSV(csv)

      if (templates.length === 0) {
        console.error('No templates found in database')
        return
      }

      // Show popup using new system
      this.showTemplateSelectorPopup(templates)
    } catch (error) {
      console.error('Error loading node templates:', error)
    }
  }

  /**
   * Fuzzy search: returns match info with positions for highlighting
   * @param {string} query - Search query (lowercase)
   * @param {string} text - Text to search in
   * @returns {{ matches: boolean, score: number, positions: number[] } | null}
   */
  fuzzyMatch(query, text) {
    if (!query) return { matches: true, score: 0, positions: [] }

    const textLower = text.toLowerCase()
    const positions = []
    let queryIndex = 0
    let score = 0
    let lastMatchIndex = -1

    for (let i = 0; i < textLower.length && queryIndex < query.length; i++) {
      if (textLower[i] === query[queryIndex]) {
        positions.push(i)

        // Consecutive matches score higher
        if (lastMatchIndex === i - 1) {
          score += 2
        } else {
          score += 1
        }

        // Matches at start of word score higher
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '-' || text[i - 1] === '_') {
          score += 3
        }

        lastMatchIndex = i
        queryIndex++
      }
    }

    // All query characters must match
    if (queryIndex !== query.length) {
      return null
    }

    return { matches: true, score, positions }
  }

  /**
   * Highlight matched characters in text
   * @param {string} text - Original text
   * @param {number[]} positions - Positions to highlight
   * @returns {DocumentFragment}
   */
  highlightMatches(text, positions) {
    const fragment = document.createDocumentFragment()
    const posSet = new Set(positions)

    let i = 0
    while (i < text.length) {
      const isMatch = posSet.has(i)

      // Collect consecutive chars of same type
      let chunk = ''
      while (i < text.length && posSet.has(i) === isMatch) {
        chunk += text[i]
        i++
      }

      if (isMatch) {
        // Create inverted highlight: background = currentColor, text = inverted
        const wrapper = document.createElement('span')
        wrapper.style.background = 'currentColor'
        const inner = document.createElement('span')
        inner.style.filter = 'invert(1)'
        inner.textContent = chunk
        wrapper.appendChild(inner)
        fragment.appendChild(wrapper)
      } else {
        fragment.appendChild(document.createTextNode(chunk))
      }
    }

    return fragment
  }

  showTemplateSelectorPopup(templates) {
    // Find popup manager
    const popupManager = this.closest('popup-manager')
    if (!popupManager) {
      console.error('popup-manager not found')
      return
    }

    // Create content container
    const content = document.createElement('div')
    content.style.cssText = `
      max-height: 60vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-2);
    `

    // Store references for search filtering
    let currentQuery = ''

    /**
     * Render template list (filtered by query)
     */
    const renderTemplateList = (query = '') => {
      content.innerHTML = ''
      const queryLower = query.toLowerCase().trim()

      // Filter and score templates
      const scoredTemplates = templates
        .map(template => {
          // Match against name, category, and description
          const nameMatch = this.fuzzyMatch(queryLower, template.name)
          const categoryMatch = this.fuzzyMatch(queryLower, template.category)
          const descMatch = template.description ? this.fuzzyMatch(queryLower, template.description) : null

          // Use best match
          let bestMatch = null
          let matchField = null

          if (nameMatch && (!bestMatch || nameMatch.score > bestMatch.score)) {
            bestMatch = nameMatch
            matchField = 'name'
          }
          if (categoryMatch && (!bestMatch || categoryMatch.score > bestMatch.score)) {
            bestMatch = categoryMatch
            matchField = 'category'
          }
          if (descMatch && (!bestMatch || descMatch.score > bestMatch.score)) {
            bestMatch = descMatch
            matchField = 'description'
          }

          if (!bestMatch) return null

          return {
            template,
            score: bestMatch.score,
            namePositions: nameMatch?.positions || [],
            descPositions: descMatch?.positions || []
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)

      if (scoredTemplates.length === 0) {
        const noResults = document.createElement('div')
        noResults.style.cssText = `
          padding: var(--spacing-scale-3);
          text-align: center;
          color: var(--color-semantic-text-secondary);
        `
        noResults.textContent = query ? `No templates matching "${query}"` : 'No templates available'
        content.appendChild(noResults)
        return
      }

      // Group filtered templates by category
      const grouped = {}
      scoredTemplates.forEach(({ template, namePositions, descPositions }) => {
        if (!grouped[template.category]) {
          grouped[template.category] = []
        }
        grouped[template.category].push({ template, namePositions, descPositions })
      })

      // Build template list
      Object.keys(grouped).sort().forEach(category => {
        // Create category section
        const categorySection = document.createElement('div')

        // Category title
        const categoryTitle = document.createElement('h3')
        categoryTitle.textContent = category.toUpperCase()
        categorySection.appendChild(categoryTitle)

        // Category items container
        const categoryItems = document.createElement('div')
        categoryItems.style.cssText = `
          display: flex;
          flex-direction: column;
        `

        // Add each template item
        grouped[category].forEach(({ template, namePositions, descPositions }) => {
          const itemButton = document.createElement('button')


          const itemName = document.createElement('strong')
          if (queryLower && namePositions.length > 0) {
            itemName.appendChild(this.highlightMatches(template.name, namePositions))
          } else {
            itemName.textContent = template.name
          }
          itemButton.appendChild(itemName)

          if (template.description) {
            const itemDescription = document.createElement('small')
            if (queryLower && descPositions.length > 0) {
              itemDescription.appendChild(this.highlightMatches(template.description, descPositions))
            } else {
              itemDescription.textContent = template.description
            }
            itemButton.appendChild(itemDescription)
          }

          // Handle template selection
          itemButton.onclick = () => {
            this.createNodeFromTemplate(template.html_template)
            // Find and close the popup
            const popup = itemButton.closest('view-popup')
            if (popup) {
              popup.close()
            }
          }

          categoryItems.appendChild(itemButton)
        })

        categorySection.appendChild(categoryItems)
        content.appendChild(categorySection)
      })
    }

    // Initial render
    renderTemplateList()

    // Create and show popup
    const popup = document.createElement('view-popup')
    popup.setAttribute('size', 'large')

    // Create title element for slot
    const titleElement = document.createElement('h2')
    titleElement.slot = 'title'
    titleElement.textContent = 'Select Node Template'
    popup.appendChild(titleElement)

    // Create search input for header-controls slot
    const headerControls = document.createElement('div')
    headerControls.slot = 'header-controls'
    headerControls.style.cssText = `
      display: flex;
      align-items: center;
      gap: var(--spacing-scale-2);
    `

    const searchInput = document.createElement('input')
    searchInput.type = 'text'
    searchInput.placeholder = 'Search nodes...'

    // Debounced search
    let searchTimeout = null
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        currentQuery = e.target.value
        renderTemplateList(currentQuery)
      }, 100)
    })

    // Focus search on popup open
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && searchInput.value) {
        e.stopPropagation()
        searchInput.value = ''
        currentQuery = ''
        renderTemplateList('')
      }
    })

    headerControls.appendChild(searchInput)
    popup.appendChild(headerControls)
    popup.appendChild(content)
    popupManager.appendChild(popup)

    // Auto-focus search input after popup is added
    requestAnimationFrame(() => {
      searchInput.focus()
    })
  }

  createNodeFromTemplate(htmlTemplate) {
    // Parse HTML template
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlTemplate.trim()
    const nodeElement = tempDiv.firstElementChild

    if (!nodeElement) {
      console.error('Invalid template HTML:', htmlTemplate)
      return
    }

    // Generate unique ID using simple counter
    const nodeId = `node_${this.nodeIdCounter++}`
    nodeElement.id = nodeId

    // Set position (center of viewport or at last mouse position)
    const pos = this.getCreationPosition()
    nodeElement.setAttribute('x', pos.x.toString())
    nodeElement.setAttribute('y', pos.y.toString())

    // Insert into DOM - node will auto-register via connectedCallback
    this.appendChild(nodeElement)

    // console.log('Created node:', nodeId, 'at', pos)
  }

  getCreationPosition() {
    // Try to use viewport center in world coordinates
    if (this.canvas && this.camera) {
      // Get canvas center
      const canvasCenterX = this.canvas.width / 2
      const canvasCenterY = this.canvas.height / 2

      // Convert to world coordinates
      const worldX = (canvasCenterX - this.camera.x) / this.camera.zoom
      const worldY = (canvasCenterY - this.camera.y) / this.camera.zoom

      return { x: Math.round(worldX), y: Math.round(worldY) }
    }

    // Fallback to origin
    return { x: 0, y: 0 }
  }

  parseTemplatesCSV(csv) {
    const lines = parseCSVLines(csv.trim())
    if (lines.length < 2) return []

    const headers = lines[0]
    const templates = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]
      if (values.length === 0) continue

      templates.push({
        name: values[0] || '',
        category: values[1] || 'other',
        description: values[2] || '',
        html_template: values[3] || ''
      })
    }

    return templates
  }

  // --- Public API for External Access ---

  /**
   * Public method to delete nodes programmatically
   * Usage: nodegraph.deleteNodes('node1') or nodegraph.deleteNodes(['node1', 'node2'])
   */
  deleteNodes(nodeIds) {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds]
    let deletedCount = 0

    for (const nodeId of ids) {
      if (this.deleteNode(nodeId)) {
        deletedCount++
      }
    }

    return deletedCount
  }

  /**
   * Get all node IDs for debugging/external access
   */
  getNodeIds() {
    return Array.from(this.nodes.keys())
  }

  // --- Save/Load Pipeline Functionality ---

  /**
   * Serialize all node-* elements to HTML string
   * Only captures node-* elements, ignoring canvas and other UI elements
   * @returns {string} HTML string of all nodes
   */
  serializeGraph(options = {}) {
    const normalizePositions = options.normalizePositions === true

    let offsetX = 0
    let offsetY = 0
    if (normalizePositions) {
      const graphNodes = Array.from(this.children).filter((child) => child.tagName && child.tagName.toLowerCase().startsWith('node-'))
      if (graphNodes.length > 0) {
        offsetX = Infinity
        offsetY = Infinity
        for (const node of graphNodes) {
          const x = parseFloat(node.getAttribute('x')) || 0
          const y = parseFloat(node.getAttribute('y')) || 0
          offsetX = Math.min(offsetX, x)
          offsetY = Math.min(offsetY, y)
        }
        if (!Number.isFinite(offsetX)) offsetX = 0
        if (!Number.isFinite(offsetY)) offsetY = 0
      }
    }

    const nodeElements = []
    for (const child of this.children) {
      // Only serialize node-* elements (e.g., node-plugin, node-popup, node-code, etc.)
      if (child.tagName && child.tagName.toLowerCase().startsWith('node-')) {
        // Use node's serialize() method if available, otherwise fallback to default
        let serializedNodeHtml = ''
        if (typeof child.serialize === 'function') {
          serializedNodeHtml = child.serialize()
        } else {
          // Fallback for nodes without serialize method
          const clone = child.cloneNode(true)
          clone.removeAttribute('focused')
          serializedNodeHtml = clone.outerHTML
        }

        if (normalizePositions) {
          const temp = document.createElement('div')
          temp.innerHTML = serializedNodeHtml.trim()
          const serializedNode = temp.firstElementChild
          if (serializedNode) {
            const x = parseFloat(serializedNode.getAttribute('x')) || 0
            const y = parseFloat(serializedNode.getAttribute('y')) || 0
            serializedNode.setAttribute('x', (x - offsetX).toString())
            serializedNode.setAttribute('y', (y - offsetY).toString())
            serializedNode.removeAttribute('focused')
            serializedNodeHtml = serializedNode.outerHTML
          }
        }

        nodeElements.push(serializedNodeHtml)
      }
    }
    return nodeElements.join('\n')
  }

  /**
   * Count node-* elements in the graph
   * @returns {number}
   */
  countNodes() {
    let count = 0
    for (const child of this.children) {
      if (child.tagName && child.tagName.toLowerCase().startsWith('node-')) {
        count++
      }
    }
    return count
  }

  // ========================================
  // Node Attribute Editor
  // ========================================

  /**
   * Show popup to edit the focused node's attributes
   */
  showEditNodePopup() {
    const focusedNodes = this.getFocusedNodes()

    if (focusedNodes.length === 0) {
      console.warn('No node selected to edit')
      return
    }

    if (focusedNodes.length > 1) {
      console.warn('Select only one node to edit')
      return
    }

    const node = focusedNodes[0]
    const popupManager = this.closest('popup-manager')
    if (!popupManager) {
      console.error('popup-manager not found')
      return
    }

    // Get current attributes (exclude internal/managed ones)
    const excludedAttrs = new Set(['focused', 'state', 'class', 'style'])
    const currentAttrs = {}
    for (const attr of node.attributes) {
      if (!excludedAttrs.has(attr.name)) {
        currentAttrs[attr.name] = attr.value
      }
    }

    // Build popup content
    const content = document.createElement('div')
    content.innerHTML = `
      <section style="display:flex; flex-direction:column">
        <h3>Core</h3>
        <label>id <input type="text" data-attr="id" value="${currentAttrs.id || ''}" placeholder="node_id"></label>
        <label>title <input type="text" data-attr="title" value="${currentAttrs.title || ''}" placeholder="Node Title"></label>
        <label>x <input type="number" data-attr="x" value="${currentAttrs.x || '0'}" step="1"></label>
        <label>y <input type="number" data-attr="y" value="${currentAttrs.y || '0'}" step="1"></label>
      </section>
      <label>Inputs <button type="button" data-action="add-input">+ Add</button></label>
      <div data-element="inputs-list"></div>

      <label >Outputs <button type="button" data-action="add-output">+ Add</button></label>
      <div data-element="outputs-list"></div>

      <label >Other Attributes <button type="button" data-action="add-attr">+ Add</button></label>
      <div data-element="attrs-list"></div>

      <button type="button" data-action="cancel">Cancel</button>
      <button type="button" class="success" data-action="save">Save</button>
    `

    // Parse inputs attribute and populate
    const inputsList = content.querySelector('[data-element="inputs-list"]')
    const inputsValue = currentAttrs.inputs || ''
    if (inputsValue) {
      const inputPairs = inputsValue.split(',').map(s => s.trim()).filter(Boolean)
      for (const pair of inputPairs) {
        const colonIdx = pair.indexOf(':')
        if (colonIdx > 0) {
          const portName = pair.substring(0, colonIdx)
          const source = pair.substring(colonIdx + 1)
          this._addInputRow(inputsList, portName, source)
        } else {
          // Disconnected port (no source)
          this._addInputRow(inputsList, pair, '')
        }
      }
    }

    // Parse outputs attribute and populate
    const outputsList = content.querySelector('[data-element="outputs-list"]')
    const outputsValue = currentAttrs.outputs || ''
    if (outputsValue) {
      const outputNames = outputsValue.split(',').map(s => s.trim()).filter(Boolean)
      for (const name of outputNames) {
        this._addOutputRow(outputsList, name)
      }
    }

    // Parse other attributes and populate
    const attrsList = content.querySelector('[data-element="attrs-list"]')
    const coreAttrs = new Set(['id', 'title', 'x', 'y', 'inputs', 'outputs'])
    for (const [key, value] of Object.entries(currentAttrs)) {
      if (!coreAttrs.has(key)) {
        this._addAttrRow(attrsList, key, value)
      }
    }

    // Event handlers for add buttons
    content.querySelector('[data-action="add-input"]').addEventListener('click', () => {
      this._addInputRow(inputsList, '', '')
    })

    content.querySelector('[data-action="add-output"]').addEventListener('click', () => {
      this._addOutputRow(outputsList, '')
    })

    content.querySelector('[data-action="add-attr"]').addEventListener('click', () => {
      this._addAttrRow(attrsList, '', '')
    })

    // Create popup
    const popup = popupManager.showPopup({
      title: `Edit Node: ${node.id}`,
      content: content,
      size: 'medium'
    })

    // Cancel/Save handlers
    content.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      popup.close()
    })

    content.querySelector('[data-action="save"]').addEventListener('click', () => {
      this._saveNodeEdits(node, content, popup)
    })

    // Focus first editable field
    setTimeout(() => {
      content.querySelector('[data-attr="id"]').focus()
    }, 100)
  }

  /**
   * Add an input row to the inputs list
   */
  _addInputRow(container, portName = '', source = '') {
    const row = document.createElement('div')
    row.setAttribute('data-row', 'input')
    row.innerHTML = `
      <input type="text" data-field="port-name" placeholder="port name" value="${this._escapeHtml(portName)}">
      :
      <input type="text" data-field="source" placeholder="nodeId.output (optional)" value="${this._escapeHtml(source)}">
      <button type="button" data-action="remove">&times;</button>
    `
    row.querySelector('[data-action="remove"]').addEventListener('click', () => row.remove())
    container.appendChild(row)
  }

  /**
   * Add an output row to the outputs list
   */
  _addOutputRow(container, name = '') {
    const row = document.createElement('div')
    row.setAttribute('data-row', 'output')
    row.innerHTML = `
      <input type="text" data-field="port-name" placeholder="output name" value="${this._escapeHtml(name)}">
      <button type="button" data-action="remove">&times;</button>
    `
    row.querySelector('[data-action="remove"]').addEventListener('click', () => row.remove())
    container.appendChild(row)
  }

  /**
   * Add an attribute row to the attributes list
   */
  _addAttrRow(container, key = '', value = '') {
    const row = document.createElement('div')
    row.setAttribute('data-row', 'attr')
    row.innerHTML = `
      <input type="text" data-field="key" placeholder="attribute" value="${this._escapeHtml(key)}">
      =
      <input type="text" data-field="value" placeholder="value" value="${this._escapeHtml(value)}">
      <button type="button" data-action="remove">&times;</button>
    `
    row.querySelector('[data-action="remove"]').addEventListener('click', () => row.remove())
    container.appendChild(row)
  }

  /**
   * Escape HTML special characters for safe insertion into attribute values
   */
  _escapeHtml(str) {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  /**
   * Save edited node attributes
   */
  _saveNodeEdits(node, content, popup) {
    const oldId = node.id

    // Collect core attributes
    const newId = content.querySelector('[data-attr="id"]').value.trim()
    const newTitle = content.querySelector('[data-attr="title"]').value.trim()
    const newX = content.querySelector('[data-attr="x"]').value.trim()
    const newY = content.querySelector('[data-attr="y"]').value.trim()

    // Validate id
    if (!newId) {
      console.error('Node id cannot be empty')
      content.querySelector('[data-attr="id"]').focus()
      return
    }

    // Check if id changed and new id already exists (but allow same id)
    if (newId !== oldId && this.nodes.has(newId)) {
      console.error(`Node with id "${newId}" already exists`)
      content.querySelector('[data-attr="id"]').focus()
      return
    }

    // Collect inputs
    const inputRows = content.querySelectorAll('[data-row="input"]')
    const inputs = []
    for (const row of inputRows) {
      const portName = row.querySelector('[data-field="port-name"]').value.trim()
      const source = row.querySelector('[data-field="source"]').value.trim()
      if (portName) {
        if (source) {
          inputs.push(`${portName}:${source}`)
        } else {
          inputs.push(portName)
        }
      }
    }

    // Collect outputs
    const outputRows = content.querySelectorAll('[data-row="output"]')
    const outputs = []
    for (const row of outputRows) {
      const name = row.querySelector('[data-field="port-name"]').value.trim()
      if (name) {
        outputs.push(name)
      }
    }

    // Collect other attributes
    const attrRows = content.querySelectorAll('[data-row="attr"]')
    const otherAttrs = new Map()
    for (const row of attrRows) {
      const key = row.querySelector('[data-field="key"]').value.trim()
      const value = row.querySelector('[data-field="value"]').value
      if (key) {
        otherAttrs.set(key, value)
      }
    }

    // If id changed, update the nodes registry
    if (newId !== oldId) {
      // Remove old entry from nodes map
      this.nodes.delete(oldId)
      // Update the id attribute (this will NOT automatically re-register)
      node.id = newId
      // Re-add to nodes map with new id
      this.nodes.set(newId, node)
      console.log(`Node id changed: ${oldId} -> ${newId}`)
    }

    // Apply core attributes
    if (newTitle !== node.getAttribute('title')) {
      node.setAttribute('title', newTitle)
    }
    if (newX !== node.getAttribute('x')) {
      node.setAttribute('x', newX)
    }
    if (newY !== node.getAttribute('y')) {
      node.setAttribute('y', newY)
    }

    // Apply inputs
    const newInputs = inputs.join(',')
    if (newInputs !== node.getAttribute('inputs')) {
      node.setAttribute('inputs', newInputs)
    }

    // Apply outputs
    const newOutputs = outputs.join(',')
    if (newOutputs !== node.getAttribute('outputs')) {
      node.setAttribute('outputs', newOutputs)
    }

    // Remove old attributes that are no longer present
    const coreAttrs = new Set(['id', 'title', 'x', 'y', 'inputs', 'outputs', 'focused', 'state', 'class', 'style'])
    const attrsToRemove = []
    for (const attr of node.attributes) {
      if (!coreAttrs.has(attr.name) && !otherAttrs.has(attr.name)) {
        attrsToRemove.push(attr.name)
      }
    }
    for (const attrName of attrsToRemove) {
      node.removeAttribute(attrName)
    }

    // Apply new/updated attributes
    for (const [key, value] of otherAttrs) {
      if (node.getAttribute(key) !== value) {
        node.setAttribute(key, value)
      }
    }

    // Rebuild connection index and redraw
    this.rebuildConnectionIndex()
    this.draw("saveNodeEdits")

    popup.close()
    console.log(`Node ${newId} updated`)
  }

  /**
   * Show save pipeline popup with name input
   */
  showSavePopup() {
    const popupManager = this.closest('popup-manager')
    if (!popupManager) {
      console.error('popup-manager not found')
      return
    }

    const nodeCount = this.countNodes()
    if (nodeCount === 0) {
      console.warn('No nodes to save')
      return
    }

    // Create content container
    const content = document.createElement('div')

    // Info text
    const info = document.createElement('p')
    info.textContent = `Save ${nodeCount} node${nodeCount !== 1 ? 's' : ''} as a pipeline`
    content.appendChild(info)

    // Name input
    const inputContainer = document.createElement('div')
    const label = document.createElement('label')
    label.textContent = 'Pipeline Name'

    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.placeholder = 'Enter pipeline name...'

    inputContainer.appendChild(label)
    inputContainer.appendChild(nameInput)
    content.appendChild(inputContainer)

    // Button container
    const buttonContainer = document.createElement('div')

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'

    const saveBtn = document.createElement('button')
    saveBtn.textContent = 'Save'
    saveBtn.disabled = true

    buttonContainer.appendChild(cancelBtn)
    buttonContainer.appendChild(saveBtn)
    content.appendChild(buttonContainer)

    // Create popup
    const popup = document.createElement('view-popup')
    popup.setAttribute('size', 'small')

    const titleElement = document.createElement('h2')
    titleElement.slot = 'title'
    titleElement.className = 'popup-title'
    titleElement.textContent = 'Save Pipeline'
    popup.appendChild(titleElement)
    popup.appendChild(content)
    popupManager.appendChild(popup)

    // Event handlers
    nameInput.addEventListener('input', () => {
      saveBtn.disabled = !nameInput.value.trim()
    })

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && nameInput.value.trim()) {
        this.savePipeline(nameInput.value.trim(), popup)
      }
    })

    cancelBtn.onclick = () => popup.close()

    saveBtn.onclick = () => {
      const name = nameInput.value.trim()
      if (name) {
        this.savePipeline(name, popup)
      }
    }

    // Focus input
    requestAnimationFrame(() => nameInput.focus())
  }

  /**
   * Save pipeline to database
   * @param {string} name - Pipeline name
   * @param {HTMLElement} popup - Popup to close on success
   */
  async savePipeline(name, popup) {
    try {
      const htmlContent = this.serializeGraph({ normalizePositions: true })
      const nodeCount = this.countNodes()

      console.log("savePipeline", htmlContent)
      // Escape single quotes for SQL
      const escapedName = name.replace(/'/g, "''")
      const escapedHtml = htmlContent.replace(/'/g, "''")

      // Use INSERT OR REPLACE to handle both new and existing pipelines
      const sql = `INSERT OR REPLACE INTO pipeline_storage (name, node_count, html_content, created_at) VALUES ('${escapedName}', ${nodeCount}, '${escapedHtml}', datetime('now'))`

      await window.pluginManager.call('sql', 'exec', sql)

      console.log(`Pipeline "${name}" saved with ${nodeCount} nodes`)
      popup.close()
    } catch (error) {
      console.error('Failed to save pipeline:', error)
    }
  }

  /**
   * Show load pipeline popup with list of saved pipelines
   */
  async showLoadPopup() {
    const popupManager = this.closest('popup-manager')
    if (!popupManager) {
      console.error('popup-manager not found')
      return
    }

    // Load pipeline list from database
    let pipelines = []
    try {
      const result = await window.pluginManager.call('sql', 'query',
        'SELECT name, node_count FROM pipeline_storage ORDER BY name'
      )
      const csv = new TextDecoder().decode(result.output)
      pipelines = this.parsePipelineListCSV(csv)
    } catch (error) {
      console.error('Failed to load pipeline list:', error)
    }

    // Create content container
    const content = document.createElement('div')
    // Store for search filtering
    let currentQuery = ''

    /**
     * Render pipeline list (filtered by query)
     */
    const renderPipelineList = (query = '') => {
      content.innerHTML = ''
      const queryLower = query.toLowerCase().trim()

      // Filter pipelines
      const filtered = pipelines.filter(p => {
        if (!queryLower) return true
        return p.name.toLowerCase().includes(queryLower)
      })

      if (filtered.length === 0) {
        const noResults = document.createElement('div')
        noResults.textContent = pipelines.length === 0
          ? 'No saved pipelines yet'
          : `No pipelines matching "${query}"`
        content.appendChild(noResults)
        return
      }

      // Render each pipeline
      for (const pipeline of filtered) {
        const itemButton = document.createElement('button')
        const nameSpan = document.createElement('strong')
        nameSpan.textContent = pipeline.name
        itemButton.appendChild(nameSpan)

        const countSpan = document.createElement('span')
        countSpan.textContent = `${pipeline.nodeCount} node${pipeline.nodeCount !== 1 ? 's' : ''}`
        itemButton.appendChild(countSpan)

        itemButton.onclick = () => {
          this.loadPipeline(pipeline.name)
          popup.close()
        }

        content.appendChild(itemButton)
      }
    }

    // Initial render
    renderPipelineList()

    // Create popup
    const popup = document.createElement('view-popup')
    popup.setAttribute('size', 'large')

    const titleElement = document.createElement('h2')
    titleElement.slot = 'title'
    titleElement.className = 'popup-title'
    titleElement.textContent = 'Load Pipeline'
    popup.appendChild(titleElement)

    // Create search input for header-controls slot
    const headerControls = document.createElement('div')
    headerControls.slot = 'header-controls'

    const searchInput = document.createElement('input')
    searchInput.type = 'text'
    searchInput.placeholder = 'Search pipelines...'
    searchInput.style.cssText = `min-width: 200px;`

    // Debounced search
    let searchTimeout = null
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        currentQuery = e.target.value
        renderPipelineList(currentQuery)
      }, 100)
    })

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && searchInput.value) {
        e.stopPropagation()
        searchInput.value = ''
        currentQuery = ''
        renderPipelineList('')
      }
    })

    headerControls.appendChild(searchInput)
    popup.appendChild(headerControls)
    popup.appendChild(content)
    popupManager.appendChild(popup)

    // Auto-focus search input
    requestAnimationFrame(() => searchInput.focus())
  }

  /**
   * Parse pipeline list CSV from SQL query result
   * @param {string} csv - CSV string
   * @returns {Array<{name: string, nodeCount: number}>}
   */
  parsePipelineListCSV(csv) {
    const lines = parseCSVLines(csv.trim())
    if (lines.length < 2) return []

    const pipelines = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]
      if (values.length < 2) continue
      pipelines.push({
        name: values[0] || '',
        nodeCount: parseInt(values[1], 10) || 0
      })
    }
    return pipelines
  }

  /**
   * Load a pipeline from database by name
   * @param {string} name - Pipeline name
   */
  async loadPipeline(name) {
    try {
      // Escape single quotes for SQL
      const escapedName = name.replace(/'/g, "''")
      const result = await window.pluginManager.call('sql', 'query',
        `SELECT html_content FROM pipeline_storage WHERE name = '${escapedName}'`
      )

      const csv = new TextDecoder().decode(result.output)
      const lines = parseCSVLines(csv.trim())

      if (lines.length < 2 || !lines[1][0]) {
        console.error(`Pipeline "${name}" not found`)
        return
      }

      const htmlContent = lines[1][0]

      // Clear existing nodes
      this.clearGraph()

      // Parse and insert new nodes
      const tempContainer = document.createElement('div')
      tempContainer.innerHTML = htmlContent

      // Find max node ID to update counter
      let maxId = 0

      for (const child of Array.from(tempContainer.children)) {
        if (child.tagName && child.tagName.toLowerCase().startsWith('node-')) {
          // Extract numeric ID if present
          const idMatch = child.id?.match(/node_(\d+)/)
          if (idMatch) {
            maxId = Math.max(maxId, parseInt(idMatch[1], 10))
          }
          this.appendChild(child)
        }
      }

      // Update node ID counter to avoid conflicts
      this.nodeIdCounter = maxId + 1

      // Normalize loaded node coordinates so graph starts from top-left node,
      // not from arbitrary saved canvas offsets.
      this.normalizeNodePositionsToTopLeft()

      console.log(`Pipeline "${name}" loaded`)

      // Fit to content after loading
      requestAnimationFrame(() => {
        this.fitGraphToContent()
      })
    } catch (error) {
      console.error('Failed to load pipeline:', error)
    }
  }

  /**
   * Clear all nodes from the graph
   */
  clearGraph() {
    const nodesToRemove = []
    for (const child of this.children) {
      if (child.tagName && child.tagName.toLowerCase().startsWith('node-')) {
        nodesToRemove.push(child)
      }
    }
    for (const node of nodesToRemove) {
      node.remove()
    }
    this.nodes.clear()
    this.connectionIndex = []
    this.nodeIdCounter = 1
  }
}

export default ViewNodeGraph
