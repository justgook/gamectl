import { ViewCanvasBase } from "./view-canvas-base.js"

// Node constants
const NODE_WIDTH = 200
const NODE_HEIGHT = 120
const NODE_HEADER_HEIGHT = 30
const PORT_SIZE = 12
const PORT_SPACING = 24

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
    output: '#ec4899'
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

    // Connection creation state
    this.connectionDragStart = null // { nodeId, port, x, y }
    this.connectionDragCurrent = null // { x, y }

    // Cached connection index for rendering
    this.connectionIndex = []

    // Execution state
    this.isExecuting = false
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
      this.drawConnection(ctx, conn)
    }

    // 3. Draw active connection being created
    if (this.connectionDragStart && this.connectionDragCurrent) {
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

      // Check if port is connected
      let isConnected = false
      if (isInput) {
        isConnected = node.getAttribute(`input-${port.name}`) !== null
      } else {
        // Check if any node uses this output
        isConnected = this.connectionIndex.some(
          conn => conn.fromNodeId === node.id && conn.fromPort === port.name
        )
      }

      // Draw port circle
      ctx.fillStyle = isConnected ? COLORS.portConnected : COLORS.port
      ctx.beginPath()
      ctx.arc(portX, portY, PORT_SIZE / 2, 0, Math.PI * 2)
      ctx.fill()

      // Draw port label
      ctx.fillStyle = COLORS.textSecondary
      ctx.font = '11px sans-serif'
      ctx.textAlign = isInput ? 'left' : 'right'
      ctx.textBaseline = 'middle'
      const labelX = isInput ? portX + 10 : portX - 10
      ctx.fillText(port.label || port.name, labelX, portY)
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
    const { x: fromX, y: fromY } = this.connectionDragStart
    const { x: toX, y: toY } = this.connectionDragCurrent

    this.drawBezierConnection(ctx, fromX, fromY, toX, toY, COLORS.connectionActive)
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

  // --- Connection Index ---

  rebuildConnectionIndex() {
    this.connectionIndex = []

    for (const node of this.nodes.values()) {
      const connections = node.getInputConnections()
      console.log(`[${node.id}] getInputConnections returned:`, connections)

      for (const conn of connections) {
        this.connectionIndex.push({
          fromNodeId: conn.sourceNodeId,
          fromPort: conn.sourcePort,
          toNodeId: node.id,
          toPort: conn.port
        })
      }
    }

    console.log('Connection index rebuilt:', this.connectionIndex)
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

      if (dist <= PORT_SIZE) {
        return { port: info.inputs[i], type: 'input', index: i }
      }
    }

    // Check output ports (right side)
    for (let i = 0; i < info.outputs.length; i++) {
      const portX = x + info.width
      const portY = startY + (i + 1) * PORT_SPACING
      const dist = Math.sqrt((worldX - portX) ** 2 + (worldY - portY) ** 2)

      if (dist <= PORT_SIZE) {
        return { port: info.outputs[i], type: 'output', index: i }
      }
    }

    return null
  }

  // --- Mouse Event Overrides ---

  _onMouseDown(e) {
    const worldPos = this.screenToWorld(e.clientX, e.clientY)
    const node = this.getNodeAt(worldPos.x, worldPos.y)

    if (node) {
      // Check if clicking on a port
      const portHit = this.getPortAt(node, worldPos.x, worldPos.y)

      if (portHit && portHit.type === 'output') {
        // Start connection drag from output port
        const info = node.getDisplayInfo()
        const nodeX = parseFloat(node.getAttribute('x')) || 0
        const nodeY = parseFloat(node.getAttribute('y')) || 0
        const portY = nodeY + NODE_HEADER_HEIGHT + (portHit.index + 1) * PORT_SPACING

        this.connectionDragStart = {
          nodeId: node.id,
          port: portHit.port.name,
          x: nodeX + info.width,
          y: portY
        }
        this.connectionDragCurrent = { x: worldPos.x, y: worldPos.y }
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

    // Clear selection and pan viewport
    if (!e.ctrlKey && !e.metaKey) {
      this.selectedNodes.clear()
      this.draw()
    }

    super._onMouseDown(e)
  }

  _onMouseMove(e) {
    const worldPos = this.screenToWorld(e.clientX, e.clientY)

    // Handle connection drag
    if (this.connectionDragStart) {
      this.connectionDragCurrent = { x: worldPos.x, y: worldPos.y }
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
    // Handle connection creation
    if (this.connectionDragStart) {
      const worldPos = this.screenToWorld(e.clientX, e.clientY)
      const targetNode = this.getNodeAt(worldPos.x, worldPos.y)

      if (targetNode && targetNode.id !== this.connectionDragStart.nodeId) {
        const portHit = this.getPortAt(targetNode, worldPos.x, worldPos.y)

        if (portHit && portHit.type === 'input') {
          // Create connection
          this.connectNodes(
            this.connectionDragStart.nodeId,
            this.connectionDragStart.port,
            targetNode.id,
            portHit.port.name
          )
        }
      }

      this.connectionDragStart = null
      this.connectionDragCurrent = null
      this.draw()
      return
    }

    // End node drag
    this.draggedNode = null

    super._onMouseUp(e)
  }

  // --- Connection Management ---

  connectNodes(fromNodeId, fromPort, toNodeId, toPort) {
    const toNode = this.nodes.get(toNodeId)
    if (!toNode) return

    // Set the input attribute (our connection model)
    toNode.setAttribute(`input-${toPort}`, `${fromNodeId}.${fromPort}`)

    this.rebuildConnectionIndex()
    this.draw()
  }

  // --- Execution ---

  async executeGraph() {
    if (this.isExecuting) return

    this.isExecuting = true
    console.log('Executing graph...')

    // TODO: Implement topological sort and execution
    // For now, just log
    console.log('Nodes:', Array.from(this.nodes.keys()))
    console.log('Connections:', this.connectionIndex)

    this.isExecuting = false
  }

  // --- UI Actions ---

  addNodeMenu() {
    // TODO: Show a menu to add different node types
    console.log('Add node menu - to be implemented')
  }
}

customElements.define('view-nodegraph', ViewNodeGraph)
