function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function requireObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  return value
}

function requireNumber(value, label) {
  assert(typeof value === "number" && Number.isFinite(value), `${label} must be a finite number`)
  return value
}

function requireColor(value, label) {
  assert(Array.isArray(value) && value.length === 4, `${label} must contain four numbers`)
  value.forEach((channel, index) => requireNumber(channel, `${label}[${index}]`))
}

function cssColor(value) {
  return `rgba(${Math.round(value[0] * 255)}, ${Math.round(value[1] * 255)}, ${Math.round(value[2] * 255)}, ${value[3]})`
}

export function validateNodeGraphRendererConfig(input) {
  const config = requireObject(input, "node graph renderer config")
  const node = requireObject(config.node, "node graph renderer config.node")
  const edge = requireObject(config.edge, "node graph renderer config.edge")
  const text = requireObject(config.text, "node graph renderer config.text")
  const theme = requireObject(config.theme, "node graph renderer config.theme")
  for (const key of ["width", "headerHeight", "portRowHeight", "padding", "radius", "borderWidth", "portRadius"])
    requireNumber(node[key], `node graph renderer config.node.${key}`)
  for (const key of ["width", "selectedWidth", "curveOffset"])
    requireNumber(edge[key], `node graph renderer config.edge.${key}`)
  requireNumber(text.size, "node graph renderer config.text.size")
  assert(typeof text.font === "string" && text.font.length > 0, "node graph renderer config.text.font must be a non-empty string")
  for (const key of ["node", "nodeHover", "nodeSelected", "nodeBorder", "header", "requiredHeader", "text", "textMuted", "port", "portHover", "edge", "edgeSelected", "edgePreviewInvalid"])
    requireColor(theme[key], `node graph renderer config.theme.${key}`)
  assert(node.width > 0 && node.headerHeight > 0 && node.portRowHeight > 0 && node.portRadius > 0, "node graph renderer node dimensions must be positive")
  return config
}

export class NodeGraphRenderer {
  constructor(config) {
    this.config = validateNodeGraphRendererConfig(config)
  }

  nodeSize(node) {
    const inputs = node.ports.filter((port) => port.direction === "input").length
    const outputs = node.ports.filter((port) => port.direction === "output").length
    return {
      width: this.config.node.width,
      height: this.config.node.headerHeight + Math.max(1, inputs, outputs) * this.config.node.portRowHeight + this.config.node.padding,
    }
  }

  nodeBounds(node) {
    const size = this.nodeSize(node)
    return { x: node.x, y: node.y, ...size }
  }

  contentBounds(nodes, padding = 80) {
    assert(Array.isArray(nodes), "node graph renderer nodes must be an array")
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    const bounds = nodes.map((node) => this.nodeBounds(node))
    return {
      minX: Math.min(...bounds.map((rect) => rect.x)) - padding,
      minY: Math.min(...bounds.map((rect) => rect.y)) - padding,
      maxX: Math.max(...bounds.map((rect) => rect.x + rect.width)) + padding,
      maxY: Math.max(...bounds.map((rect) => rect.y + rect.height)) + padding,
    }
  }

  hitNode(nodes, point) {
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index]
      const rect = this.nodeBounds(node)
      if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) return node
    }
    return null
  }

  ports(node, direction) {
    return node.ports.filter((port) => port.direction === direction)
  }

  portPoint(node, portId) {
    const port = node.ports.find((candidate) => candidate.id === portId)
    assert(port, `node graph renderer missing port ${node.id}.${portId}`)
    const list = this.ports(node, port.direction)
    const index = list.findIndex((candidate) => candidate.id === portId)
    assert(index >= 0, `node graph renderer missing ${port.direction} port ${node.id}.${portId}`)
    return {
      x: port.direction === "input" ? node.x : node.x + this.config.node.width,
      y: node.y + this.config.node.headerHeight + this.config.node.portRowHeight * (index + 0.5),
    }
  }

  hitPort(nodes, point) {
    const threshold = this.config.node.portRadius * 2
    for (let nodeIndex = nodes.length - 1; nodeIndex >= 0; nodeIndex -= 1) {
      const node = nodes[nodeIndex]
      for (const port of node.ports) {
        const center = this.portPoint(node, port.id)
        if (Math.hypot(point.x - center.x, point.y - center.y) <= threshold) return { node, port, point: center }
      }
    }
    return null
  }

  edgeGeometry(edge, nodesById) {
    const fromNode = nodesById.get(edge.from.nodeId)
    const toNode = nodesById.get(edge.to.nodeId)
    assert(fromNode, `node graph renderer edge ${edge.id} missing source ${edge.from.nodeId}`)
    assert(toNode, `node graph renderer edge ${edge.id} missing target ${edge.to.nodeId}`)
    const start = this.portPoint(fromNode, edge.from.portId)
    const end = this.portPoint(toNode, edge.to.portId)
    const offset = Math.max(this.config.edge.curveOffset, Math.abs(end.x - start.x) * 0.45)
    return {
      start,
      control1: { x: start.x + offset, y: start.y },
      control2: { x: end.x - offset, y: end.y },
      end,
    }
  }

  cubicPoint(geometry, t) {
    const inverse = 1 - t
    return {
      x: inverse ** 3 * geometry.start.x + 3 * inverse ** 2 * t * geometry.control1.x + 3 * inverse * t ** 2 * geometry.control2.x + t ** 3 * geometry.end.x,
      y: inverse ** 3 * geometry.start.y + 3 * inverse ** 2 * t * geometry.control1.y + 3 * inverse * t ** 2 * geometry.control2.y + t ** 3 * geometry.end.y,
    }
  }

  distanceToSegment(point, start, end) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)
    const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
    return Math.hypot(point.x - start.x - projection * dx, point.y - start.y - projection * dy)
  }

  hitEdge(graph, point, threshold = 10) {
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
    let closest = null
    let closestDistance = threshold
    for (const edge of graph.edges) {
      const geometry = this.edgeGeometry(edge, nodesById)
      let previous = geometry.start
      for (let step = 1; step <= 24; step += 1) {
        const current = this.cubicPoint(geometry, step / 24)
        const distance = this.distanceToSegment(point, previous, current)
        if (distance <= closestDistance) {
          closest = edge
          closestDistance = distance
        }
        previous = current
      }
    }
    return closest
  }

  draw(ctx, graph, state) {
    assert(ctx instanceof CanvasRenderingContext2D, "node graph renderer requires a 2d canvas context")
    assert(state.selectedNodeIds instanceof Set, "node graph renderer selectedNodeIds must be a Set")
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
    for (const edge of graph.edges) this.drawEdge(ctx, this.edgeGeometry(edge, nodesById), state.selectedEdgeId === edge.id)
    for (const node of graph.nodes) this.drawNode(ctx, node, {
      selected: state.selectedNodeIds.has(node.id),
      hovered: state.hoveredNodeId === node.id,
      hoveredPortId: state.hoveredPort?.nodeId === node.id ? state.hoveredPort.portId : null,
      required: state.requiredNodeIds.has(node.id),
    })
  }

  drawEdge(ctx, geometry, selected) {
    ctx.save()
    ctx.strokeStyle = cssColor(selected ? this.config.theme.edgeSelected : this.config.theme.edge)
    ctx.lineWidth = selected ? this.config.edge.selectedWidth : this.config.edge.width
    ctx.beginPath()
    ctx.moveTo(geometry.start.x, geometry.start.y)
    ctx.bezierCurveTo(geometry.control1.x, geometry.control1.y, geometry.control2.x, geometry.control2.y, geometry.end.x, geometry.end.y)
    ctx.stroke()
    ctx.restore()
  }

  drawSelectionRect(ctx, rect) {
    const color = this.config.theme.edgeSelected
    ctx.save()
    ctx.fillStyle = cssColor([color[0], color[1], color[2], 0.14])
    ctx.strokeStyle = cssColor(color)
    ctx.lineWidth = 1
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
    ctx.restore()
  }

  drawConnectionPreview(ctx, start, end, valid) {
    const offset = Math.max(this.config.edge.curveOffset, Math.abs(end.x - start.x) * 0.45)
    ctx.save()
    ctx.strokeStyle = cssColor(valid ? this.config.theme.edgeSelected : this.config.theme.edgePreviewInvalid)
    ctx.lineWidth = this.config.edge.selectedWidth
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.bezierCurveTo(start.x + offset, start.y, end.x - offset, end.y, end.x, end.y)
    ctx.stroke()
    ctx.restore()
  }

  drawNode(ctx, node, state) {
    const { node: nodeConfig, text, theme } = this.config
    const rect = this.nodeBounds(node)
    const fill = state.selected ? theme.nodeSelected : state.hovered ? theme.nodeHover : theme.node
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, nodeConfig.radius)
    ctx.fillStyle = cssColor(fill)
    ctx.fill()
    ctx.lineWidth = nodeConfig.borderWidth
    ctx.strokeStyle = cssColor(theme.nodeBorder)
    ctx.stroke()
    ctx.beginPath()
    ctx.roundRect(rect.x, rect.y, rect.width, nodeConfig.headerHeight, [nodeConfig.radius, nodeConfig.radius, 0, 0])
    ctx.fillStyle = cssColor(state.required ? theme.requiredHeader : theme.header)
    ctx.fill()
    ctx.fillStyle = cssColor(theme.text)
    ctx.font = `600 ${text.size}px ${text.font}`
    ctx.textBaseline = "middle"
    ctx.fillText(String(node.name), rect.x + nodeConfig.padding, rect.y + nodeConfig.headerHeight / 2, rect.width - nodeConfig.padding * 2)
    for (const direction of ["input", "output"]) {
      const ports = this.ports(node, direction)
      ports.forEach((port, index) => {
        const center = this.portPoint(node, port.id)
        ctx.beginPath()
        ctx.arc(center.x, center.y, nodeConfig.portRadius, 0, Math.PI * 2)
        ctx.fillStyle = cssColor(state.hoveredPortId === port.id ? theme.portHover : theme.port)
        ctx.fill()
        ctx.fillStyle = cssColor(theme.textMuted)
        ctx.font = `${text.size}px ${text.font}`
        ctx.textAlign = direction === "input" ? "left" : "right"
        const x = direction === "input" ? rect.x + nodeConfig.padding : rect.x + rect.width - nodeConfig.padding
        ctx.fillText(String(port.name ?? port.id), x, center.y)
      })
    }
    ctx.restore()
  }
}
