import { ViewCanvasBase } from "./view-canvas-base.js"

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
    super('view-nodegraph')

    // Node registry (id -> node element)
    this.nodes = new Map()

    // Interaction state
    this.selectedNodes = new Set()
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

  connectedCallback() {
    super.connectedCallback()

    // Setup UI buttons
    const addNodeBtn = this.content.querySelector('[data-action="add-node"]')
    if (addNodeBtn) {
      addNodeBtn.onclick = () => this.addNodeMenu()
    }

    const runBtn = this.content.querySelector('[data-action="run"]')
    if (runBtn) {
      runBtn.onclick = () => this.executeGraph()
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
    this.draw()
  }

  unregisterNode(nodeElement) {
    this.nodes.delete(nodeElement.id)
    this.selectedNodes.delete(nodeElement)
    this.rebuildConnectionIndex()
    this.draw()
  }

  // --- Data Pipeline (overrides from ViewCanvasBase) ---

  async fetchData() {
    // We don't fetch - our data IS the DOM nodes
    return { nodes: this.nodes }
  }

  calculateContentBounds(data) {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    if (data.nodes.size === 0) {
      return { minX: 0, maxX: 800, minY: 0, maxY: 600 }
    }

    for (const node of data.nodes.values()) {
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

    // 4. Draw nodes
    for (const node of data.nodes.values()) {
      this.drawNode(ctx, node)
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
    const selected = this.selectedNodes.has(node)
    const info = node.getDisplayInfo()

    // Determine colors
    const nodeColor = COLORS.node[node.state] || COLORS.node.idle
    const headerColor = COLORS.nodeHeader[info.type] || COLORS.nodeHeader.plugin

    // Draw selection highlight
    if (selected) {
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
   */
  getNodeAt(worldX, worldY) {
    for (const node of this.nodes.values()) {
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

  // --- Mouse Event Overrides ---

  _onMouseDown(e) {
    const worldPos = this.screenToWorld(e.clientX, e.clientY)

    // Priority 1: Check if clicking on a port (extended hit area)
    // We check ALL nodes for port hits, not just nodes at this position
    let outputPortHit = null
    for (const node of this.nodes.values()) {
      const portHit = this.getPortAt(node, worldPos.x, worldPos.y)

      if (portHit) {
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

    // Priority 2: Check if clicking on connection line (only if no ports were hit)
    const connHit = this.getConnectionAt(worldPos.x, worldPos.y)
    if (connHit) {
      this.startConnectionReconnect(connHit.connection, connHit.side, worldPos)
      return
    }

    // Priority 3: Check if clicking on node body
    const node = this.getNodeAt(worldPos.x, worldPos.y)

    if (node) {
      // Check if clicking on run button first
      if (node._runButtonBounds && this.isPointInRunButton(worldPos, node)) {
        this.onRunButtonClick(node)
        return
      }

      // Check if clicking on edit button for template nodes
      if (node._editButtonBounds && this.isPointInEditButton(worldPos, node)) {
        this.onEditButtonClick(node)
        return
      }

      // Start node drag
      if (!e.ctrlKey && !e.metaKey) {
        this.selectedNodes.clear()
      }
      this.selectedNodes.add(node)

      const nodeX = parseFloat(node.getAttribute('x')) || 0
      const nodeY = parseFloat(node.getAttribute('y')) || 0

      this.draggedNode = node
      this.dragOffset = {
        x: worldPos.x - nodeX,
        y: worldPos.y - nodeY
      }

      this.draw()
      return
    }

    // Start canvas pan
    super._onMouseDown(e)
  }

  _onMouseMove(e) {
    const worldPos = this.screenToWorld(e.clientX, e.clientY)

    // Handle connection drag
    if (this.connectionDragState) {
      this.connectionDragState.movingEnd = { x: worldPos.x, y: worldPos.y }

      // Find hover target for visual feedback
      this.connectionDragState.hoverTarget = null
      for (const node of this.nodes.values()) {
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
      this._handleHover(e)
      return
    }

    // Handle node drag
    if (this.draggedNode && !this.isDragging) {
      const newX = worldPos.x - this.dragOffset.x
      const newY = worldPos.y - this.dragOffset.y

      this.draggedNode.setAttribute('x', newX)
      this.draggedNode.setAttribute('y', newY)
      return
    }

    super._onMouseMove(e)
  }

  _onMouseUp(e) {
    // Handle connection creation/reconnection
    if (this.connectionDragState) {
      const worldPos = this.screenToWorld(e.clientX, e.clientY)

      // Check if dropping on any port (extended hit area)
      let targetNode = null
      let portHit = null

      for (const node of this.nodes.values()) {
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

    super._onMouseUp(e)
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
      console.log(`Node ${node.id} is already executing`)
      return
    }

    const isRerun = node.state === 'success' || node.state === 'error'
    const action = isRerun ? 'Re-running' : 'Running'

    console.log(`${action} node: ${node.id}`)

    try {
      // Force rerun if the node has already completed
      const outputPorts = node.getOutputPorts()
      const firstOutput = outputPorts.length > 0 ? outputPorts[0].name : 'output'

      await node.getOutputValue(firstOutput, isRerun) // Force rerun if needed
      console.log(`✓ Node ${node.id} completed successfully`)
    } catch (error) {
      console.error(`✗ Node ${node.id} failed:`, error)
    }

    this.draw()
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
    if (node.constructor.name !== 'NodeTemplate') {
      console.error('Edit button clicked on non-template node:', node)
      return
    }

    console.log(`Opening edit popup for template node: ${node.id}`)

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
    console.log('Executing entire graph...')

    try {
      // Execute all output nodes (they will naturally trigger their dependencies)
      const outputNodes = Array.from(this.nodes.values()).filter(
        node => node.getOutputPorts().length === 0 || node.constructor.name === 'NodeOutput'
      )

      if (outputNodes.length === 0) {
        console.log('No output nodes found. Try adding some output nodes or use individual run buttons.')
        return
      }

      for (const node of outputNodes) {
        console.log(`Executing output node: ${node.id}`)
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
    popup.setAttribute('title', 'Select Node Template')
    popup.setAttribute('size', 'medium')
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

    console.log('Created node:', nodeId, 'at', pos)
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
    const lines = csv.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',')
    const templates = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue

      const values = line.split(',')
      templates.push({
        name: values[0] || '',
        category: values[1] || 'other',
        description: values[2] || '',
        html_template: values[3] || ''
      })
    }

    return templates
  }
}

customElements.define('view-nodegraph', ViewNodeGraph)
