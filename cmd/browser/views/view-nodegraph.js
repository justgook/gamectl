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

// Colors (TODO: integrate with design tokens)
const COLORS = {
  background: '#1e1e1e',
  grid: '#2a2a2a',
  node: {
    idle: '#3a3a3a',
    ready: '#2563eb',
    running: '#f59e0b',
    success: '#10b981',
    error: '#ef4444'
  },
  nodeHeader: {
    input: '#6366f1',
    plugin: '#8b5cf6',
    output: '#ec4899',
    template: '#10b981'  // Green for template nodes
  },
  connection: '#64748b',
  connectionActive: '#3b82f6',
  port: '#94a3b8',
  portConnected: '#3b82f6',
  text: '#ffffff',
  textSecondary: '#94a3b8',
  selection: '#3b82f6'
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
      zoomFitBtn.onclick = () => this.fitToContent()
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
      bus.on('view:zoom-fit', () => this.fitToContent()),
    ]
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
    // 1. Draw grid
    this.drawGrid(ctx)

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
      this.drawConnection(ctx, conn)
    }

    // 3. Draw active connection being created/reconnected
    if (this.connectionDragState) {
      this.drawActiveConnection(ctx)
    }

    // 4. Draw nodes in DOM order (first child = back layer, last child = front layer)
    for (const node of this.children) {
      // Only draw actual node elements (skip other possible child elements)
      if (node.getDisplayInfo) {
        this.drawNode(ctx, node)
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

  drawGrid(ctx) {
    const gridSize = 50
    const { minX, maxX, minY, maxY } = this.contentBounds

    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 1

    // Vertical lines
    for (let x = Math.floor(minX / gridSize) * gridSize; x < maxX; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, minY)
      ctx.lineTo(x, maxY)
      ctx.stroke()
    }

    // Horizontal lines
    for (let y = Math.floor(minY / gridSize) * gridSize; y < maxY; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(minX, y)
      ctx.lineTo(maxX, y)
      ctx.stroke()
    }
  }

  drawNode(ctx, node) {
    const x = parseFloat(node.getAttribute('x')) || 0
    const y = parseFloat(node.getAttribute('y')) || 0
    const focused = this.isNodeFocused(node)
    const info = node.getDisplayInfo()

    // Determine colors
    const nodeColor = COLORS.node[node.state] || COLORS.node.idle
    const headerColor = COLORS.nodeHeader[info.type] || COLORS.nodeHeader.plugin

    // Draw focus highlight
    if (focused) {
      ctx.strokeStyle = COLORS.selection
      ctx.lineWidth = 3
      ctx.strokeRect(x - 2, y - 2, info.width + 4, info.height + 4)
    }

    // Draw node body
    ctx.fillStyle = nodeColor
    ctx.fillRect(x, y, info.width, info.height)

    // Draw node header
    ctx.fillStyle = headerColor
    ctx.fillRect(x, y, info.width, NODE_HEADER_HEIGHT)

    // Draw title
    ctx.fillStyle = COLORS.text
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(info.title, x + 10, y + NODE_HEADER_HEIGHT / 2)

    // Draw run button for plugin nodes
    if (info.type === 'plugin') {
      this.drawRunButton(ctx, x, y, info, node)
    }

    // Draw edit button for template nodes
    if (info.type === 'template') {
      this.drawEditButton(ctx, x, y, info, node)
      this.drawTemplateValues(ctx, x, y, info, node)
    }

    // Draw delete button for focused nodes
    if (focused) {
      this.drawDeleteButton(ctx, x, y, info, node)
    }

    // Draw input ports
    this.drawPorts(ctx, x, y + NODE_HEADER_HEIGHT, info.inputs, 'input', node)

    // Draw output ports
    this.drawPorts(ctx, x, y + NODE_HEADER_HEIGHT, info.outputs, 'output', node)
  }

  drawPorts(ctx, nodeX, startY, ports, type, node) {
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
      let portColor = COLORS.port // Default: gray
      if (isHoverTarget) {
        portColor = COLORS.portConnected // Hover target: blue
      } else if (isConnected) {
        portColor = COLORS.portConnected // Connected: blue
      }

      // Draw port circle
      ctx.fillStyle = portColor
      ctx.beginPath()
      ctx.arc(portX, portY, PORT_SIZE / 2, 0, Math.PI * 2)
      ctx.fill()

      // Draw hover highlight ring
      if (isHoverTarget) {
        ctx.strokeStyle = COLORS.portConnected
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(portX, portY, PORT_SIZE / 2 + 3, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Draw port label
      ctx.fillStyle = COLORS.textSecondary
      ctx.font = '11px sans-serif'
      ctx.textAlign = isInput ? 'left' : 'right'
      ctx.textBaseline = 'middle'
      const labelX = isInput ? portX + 10 : portX - 10

      let labelText = port.label || port.name

      // For template nodes, show output values
      if (node.constructor.name === 'NodeTemplate' && !isInput && port.hasValue) {
        const value = port.value
        const truncatedValue = value.length > 8 ? value.substring(0, 8) + '...' : value
        labelText = `${port.name}: ${truncatedValue}`
        ctx.fillStyle = COLORS.text // Make value text more visible
      }

      ctx.fillText(labelText, labelX, portY)
    })
  }

  drawConnection(ctx, conn) {
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
      COLORS.connection
    )
  }

  drawActiveConnection(ctx) {
    const { fixedEnd, movingEnd } = this.connectionDragState

    // Determine connection direction based on port type
    // Output ports are on the right, input ports on the left
    if (fixedEnd.type === 'output') {
      // Fixed end is output (right side), moving end will be input (left side)
      this.drawBezierConnection(
        ctx,
        fixedEnd.x, fixedEnd.y,
        movingEnd.x, movingEnd.y,
        COLORS.connectionActive
      )
    } else {
      // Fixed end is input (left side), moving end will be output (right side)
      // Reverse the connection so it flows output -> input
      this.drawBezierConnection(
        ctx,
        movingEnd.x, movingEnd.y,
        fixedEnd.x, fixedEnd.y,
        COLORS.connectionActive
      )
    }
  }

  drawBezierConnection(ctx, x1, y1, x2, y2, color) {
    const dx = Math.abs(x2 - x1)
    const cpOffset = Math.min(dx * 0.5, 100)

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.bezierCurveTo(
      x1 + cpOffset, y1,
      x2 - cpOffset, y2,
      x2, y2
    )
    ctx.stroke()
  }

  drawRunButton(ctx, nodeX, nodeY, info, node) {
    const buttonSize = 16
    const buttonX = nodeX + info.width - buttonSize - 6
    const buttonY = nodeY + (NODE_HEADER_HEIGHT - buttonSize) / 2

    // Determine button color based on node state
    let buttonColor = COLORS.port
    let iconColor = COLORS.text
    let icon = '▶'

    switch (node.state) {
      case 'running':
        buttonColor = COLORS.node.running
        icon = '⏸'
        break
      case 'success':
        buttonColor = COLORS.node.success
        icon = '↻'  // Rerun icon for completed nodes
        break
      case 'error':
        buttonColor = COLORS.node.error
        icon = '↻'  // Rerun icon for failed nodes
        break
      default:
        buttonColor = COLORS.port
        icon = '▶'  // Play icon for idle nodes
    }

    // Draw button background
    ctx.fillStyle = buttonColor
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw button border
    ctx.strokeStyle = COLORS.text
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.stroke()

    // Draw icon
    ctx.fillStyle = iconColor
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, buttonX + buttonSize / 2, buttonY + buttonSize / 2)

    // Store button bounds for click detection
    node._runButtonBounds = {
      x: buttonX,
      y: buttonY,
      width: buttonSize,
      height: buttonSize
    }
  }

  drawEditButton(ctx, nodeX, nodeY, info, node) {
    const buttonSize = 16
    const buttonX = nodeX + info.width - buttonSize - 6
    const buttonY = nodeY + (NODE_HEADER_HEIGHT - buttonSize) / 2

    // Edit button color - blue for template nodes
    const buttonColor = COLORS.nodeHeader.input // Blue color
    const iconColor = COLORS.text
    const icon = '📝' // Edit icon

    // Draw button background
    ctx.fillStyle = buttonColor
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw button border
    ctx.strokeStyle = COLORS.text
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.stroke()

    // Draw icon
    ctx.fillStyle = iconColor
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, buttonX + buttonSize / 2, buttonY + buttonSize / 2)

    // Store button bounds for click detection
    node._editButtonBounds = {
      x: buttonX,
      y: buttonY,
      width: buttonSize,
      height: buttonSize
    }
  }

  drawTemplateValues(ctx, nodeX, nodeY, info, node) {
    // Show current output values in the node body
    if (!info.values || info.values.size === 0) return

    const valuesY = nodeY + NODE_HEADER_HEIGHT + 8
    const maxWidth = info.width - 20

    ctx.fillStyle = COLORS.textSecondary
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    let currentY = valuesY
    const lineHeight = 14

    // Display up to 3 values to avoid cluttering
    let count = 0
    for (const [key, value] of info.values) {
      if (count >= 3) break

      const displayValue = String(value).length > 15 ? String(value).substring(0, 15) + '...' : String(value)
      const text = `${key}: ${displayValue}`

      // Measure text and truncate if needed
      const textWidth = ctx.measureText(text).width
      let finalText = text
      if (textWidth > maxWidth) {
        // Truncate text to fit
        const ratio = maxWidth / textWidth
        const truncateIndex = Math.floor(text.length * ratio) - 3
        finalText = text.substring(0, Math.max(0, truncateIndex)) + '...'
      }

      ctx.fillText(finalText, nodeX + 10, currentY)
      currentY += lineHeight
      count++
    }

    // Show "..." if there are more values
    if (info.values.size > 3) {
      ctx.fillText('...', nodeX + 10, currentY)
    }
  }

  drawDeleteButton(ctx, nodeX, nodeY, info, node) {
    const buttonSize = 14
    const buttonX = nodeX + 4 // Position in top-left corner of node
    const buttonY = nodeY + 4

    // Delete button color - red for danger
    const buttonColor = COLORS.node.error // Red color
    const iconColor = COLORS.text
    const icon = '✕' // Delete/close icon

    // Draw button background
    ctx.fillStyle = buttonColor
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw button border
    ctx.strokeStyle = COLORS.text
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(buttonX + buttonSize / 2, buttonY + buttonSize / 2, buttonSize / 2, 0, Math.PI * 2)
    ctx.stroke()

    // Draw icon
    ctx.fillStyle = iconColor
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, buttonX + buttonSize / 2, buttonY + buttonSize / 2)

    // Store button bounds for click detection
    node._deleteButtonBounds = {
      x: buttonX,
      y: buttonY,
      width: buttonSize,
      height: buttonSize
    }
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
    if (node.constructor.name !== 'NodePopup') {
      console.error('Edit button clicked on non-template node:', node)
      return
    }

    // console.log(`Opening edit popup for template node: ${node.id}`)

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

  showTemplateSelectorPopup(templates) {
    // Find popup manager
    const popupManager = this.closest('popup-manager')
    if (!popupManager) {
      console.error('popup-manager not found')
      return
    }

    // Create content for popup
    const content = document.createElement('div')

    // Group templates by category
    const grouped = {}
    templates.forEach(t => {
      if (!grouped[t.category]) {
        grouped[t.category] = []
      }
      grouped[t.category].push(t)
    })

    // Build template list
    Object.keys(grouped).sort().forEach(category => {
      // Create category section
      const categorySection = document.createElement('div')
      categorySection.style.marginBottom = 'var(--spacing-scale-3)'

      // Category title
      const categoryTitle = document.createElement('h3')
      categoryTitle.textContent = category.toUpperCase()
      categoryTitle.style.cssText = `
        margin: 0 0 var(--spacing-scale-2) 0;
        font-size: var(--font-size-sm);
        color: var(--color-semantic-text-secondary);
        text-transform: uppercase;
      `
      categorySection.appendChild(categoryTitle)

      // Category items container
      const categoryItems = document.createElement('div')
      categoryItems.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: var(--spacing-scale-1);
      `

      // Add each template item
      grouped[category].forEach(template => {
        const itemButton = document.createElement('button')
        itemButton.className = 'button-secondary'
        itemButton.style.cssText = `
          width: 100%;
          text-align: left;
          padding: var(--spacing-scale-2);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        `

        const itemName = document.createElement('strong')
        itemName.textContent = template.name
        itemButton.appendChild(itemName)

        if (template.description) {
          const itemDescription = document.createElement('small')
          itemDescription.textContent = template.description
          itemDescription.style.cssText = `
            color: var(--color-semantic-text-secondary);
            margin-top: var(--spacing-scale-1);
          `
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

    // Set content styles for scrolling
    content.style.cssText = `
      max-height: 60vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-scale-2);
    `

    // Create and show popup
    const popup = document.createElement('view-popup')
    popup.setAttribute('size', 'large')

    // Create title element for slot
    const titleElement = document.createElement('h2')
    titleElement.slot = 'title'
    titleElement.className = 'popup-title'
    titleElement.textContent = 'Select Node Template'
    popup.appendChild(titleElement)

    popup.appendChild(content)
    popupManager.appendChild(popup)
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
}

customElements.define('view-nodegraph', ViewNodeGraph)
