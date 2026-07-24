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
  return value
}

function cssColor(value) {
  const [red, green, blue, alpha] = value
  return `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)}, ${alpha})`
}

export function validateStateMachineGraphRendererConfig(input) {
  const config = requireObject(input, "state machine graph renderer config")
  const node = requireObject(config.node, "state machine graph renderer config.node")
  const edge = requireObject(config.edge, "state machine graph renderer config.edge")
  const text = requireObject(config.text, "state machine graph renderer config.text")
  const theme = requireObject(config.theme, "state machine graph renderer config.theme")

  for (const key of ["width", "height", "radius", "borderWidth"])
    requireNumber(node[key], `state machine graph renderer config.node.${key}`)
  for (const key of ["width", "selectedWidth", "bidirectionalOffset", "arrowSize", "arrowInset"])
    requireNumber(edge[key], `state machine graph renderer config.edge.${key}`)
  for (const key of ["titleSize", "padding"])
    requireNumber(text[key], `state machine graph renderer config.text.${key}`)
  assert(typeof text.font === "string" && text.font.length > 0, "state machine graph renderer config.text.font must be a non-empty string")

  for (const key of [
    "node",
    "nodeHover",
    "nodeSelected",
    "nodeBorder",
    "text",
    "edge",
    "edgeSelected",
    "edgeSymbol",
    "start",
  ])
    requireColor(theme[key], `state machine graph renderer config.theme.${key}`)

  assert(node.width > 0 && node.height > 0, "state machine graph renderer node dimensions must be positive")
  assert(node.radius >= 0, "state machine graph renderer node radius must not be negative")
  assert(edge.bidirectionalOffset > 0 && edge.arrowSize > 0 && edge.arrowInset > 0, "state machine graph renderer edge direction dimensions must be positive")
  return config
}

export class StateMachineGraphRenderer {
  constructor(config) {
    this.config = validateStateMachineGraphRendererConfig(config)
  }

  nodeBounds(node) {
    assert(node && typeof node === "object", "state machine graph renderer node must be an object")
    assert(Number.isFinite(node.x) && Number.isFinite(node.y), "state machine graph renderer node position must be finite")
    return {
      x: node.x,
      y: node.y,
      width: this.config.node.width,
      height: this.config.node.height,
    }
  }

  contentBounds(nodes, padding = 80) {
    assert(Array.isArray(nodes), "state machine graph renderer nodes must be an array")
    requireNumber(padding, "state machine graph renderer content padding")
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
    assert(Array.isArray(nodes), "state machine graph renderer nodes must be an array")
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index]
      const rect = this.nodeBounds(node)
      if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height)
        return node
    }
    return null
  }

  hitEdge(graph, point, threshold = 10) {
    requireObject(graph, "state machine graph renderer graph")
    assert(Array.isArray(graph.nodes), "state machine graph renderer graph.nodes must be an array")
    assert(Array.isArray(graph.edges), "state machine graph renderer graph.edges must be an array")
    requireNumber(threshold, "state machine graph renderer edge hit threshold")
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
    const edgeDirections = new Set(graph.edges.map((edge) => `${edge.from}:${edge.to}`))
    let closest = null
    let closestDistance = threshold

    for (const edge of graph.edges) {
      const geometry = this.edgeGeometry(edge, nodesById, edgeDirections.has(`${edge.to}:${edge.from}`))
      let previous = geometry.start
      for (let step = 1; step <= 24; step += 1) {
        const current = this.quadraticPoint(geometry.start, geometry.control, geometry.end, step / 24)
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

  distanceToSegment(point, start, end) {
    const deltaX = end.x - start.x
    const deltaY = end.y - start.y
    const lengthSquared = deltaX * deltaX + deltaY * deltaY
    assert(lengthSquared > 0, "state machine graph renderer cannot hit-test a zero-length segment")
    const projection = Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared))
    return Math.hypot(point.x - (start.x + projection * deltaX), point.y - (start.y + projection * deltaY))
  }

  draw(ctx, graph, state = {}) {
    assert(ctx instanceof CanvasRenderingContext2D, "state machine graph renderer requires a 2d canvas context")
    requireObject(graph, "state machine graph renderer graph")
    assert(Array.isArray(graph.nodes), "state machine graph renderer graph.nodes must be an array")
    assert(Array.isArray(graph.edges), "state machine graph renderer graph.edges must be an array")

    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
    const edgeDirections = new Set(graph.edges.map((edge) => `${edge.from}:${edge.to}`))
    for (const edge of graph.edges) {
      const bidirectional = edgeDirections.has(`${edge.to}:${edge.from}`)
      this.drawEdge(ctx, edge, nodesById, state.selectedEdgeId === edge.id, bidirectional)
    }
    assert(state.selectedNodeIds instanceof Set, "state machine graph renderer selectedNodeIds must be a Set")
    for (const node of graph.nodes)
      this.drawNode(ctx, node, {
        selected: state.selectedNodeIds.has(node.id),
        hovered: state.hoveredNodeId === node.id,
      })
  }

  drawSelectionRect(ctx, rect) {
    requireObject(rect, "state machine graph renderer selection rect")
    for (const key of ["x", "y", "width", "height"])
      requireNumber(rect[key], `state machine graph renderer selection rect.${key}`)
    const color = this.config.theme.edgeSelected
    ctx.save()
    ctx.fillStyle = cssColor([color[0], color[1], color[2], 0.14])
    ctx.strokeStyle = cssColor(color)
    ctx.lineWidth = 1
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
    ctx.restore()
  }

  edgeGeometry(edge, nodesById, bidirectional) {
    const from = nodesById.get(edge.from)
    const to = nodesById.get(edge.to)
    assert(from, `state machine graph renderer edge ${edge.id} references missing from node ${edge.from}`)
    assert(to, `state machine graph renderer edge ${edge.id} references missing to node ${edge.to}`)
    assert(from.id !== to.id, `state machine graph renderer edge ${edge.id} self-transitions are not implemented`)

    const fromRect = this.nodeBounds(from)
    const toRect = this.nodeBounds(to)
    const start = { x: fromRect.x + fromRect.width / 2, y: fromRect.y + fromRect.height / 2 }
    const end = { x: toRect.x + toRect.width / 2, y: toRect.y + toRect.height / 2 }
    const deltaX = end.x - start.x
    const deltaY = end.y - start.y
    const distance = Math.hypot(deltaX, deltaY)
    assert(distance > 0, `state machine graph renderer edge ${edge.id} connects overlapping states`)
    const normalX = -deltaY / distance
    const normalY = deltaX / distance
    const curveOffset = bidirectional ? this.config.edge.bidirectionalOffset : 0
    return {
      start,
      end,
      control: {
        x: (start.x + end.x) / 2 + normalX * curveOffset,
        y: (start.y + end.y) / 2 + normalY * curveOffset,
      },
      distance,
      deltaX,
      deltaY,
      toRect,
    }
  }

  drawEdge(ctx, edge, nodesById, selected, bidirectional) {
    const geometry = this.edgeGeometry(edge, nodesById, bidirectional)
    const { start, end, control, distance, deltaX, deltaY, toRect } = geometry
    const directionToTargetX = deltaX / distance
    const directionToTargetY = deltaY / distance
    const horizontalRadius = Math.abs(directionToTargetX) > 0 ? toRect.width / 2 / Math.abs(directionToTargetX) : Number.POSITIVE_INFINITY
    const verticalRadius = Math.abs(directionToTargetY) > 0 ? toRect.height / 2 / Math.abs(directionToTargetY) : Number.POSITIVE_INFINITY
    const targetRadius = Math.min(horizontalRadius, verticalRadius)
    const arrowDistance = targetRadius + this.config.edge.arrowInset
    const arrowT = Math.max(0.55, Math.min(0.9, 1 - arrowDistance / distance))
    const arrow = this.quadraticPoint(start, control, end, arrowT)
    const tangent = this.quadraticTangent(start, control, end, arrowT)
    const tangentLength = Math.hypot(tangent.x, tangent.y)
    assert(tangentLength > 0, `state machine graph renderer edge ${edge.id} has no direction`)
    const directionX = tangent.x / tangentLength
    const directionY = tangent.y / tangentLength

    ctx.save()
    ctx.strokeStyle = cssColor(selected ? this.config.theme.edgeSelected : this.config.theme.edge)
    ctx.fillStyle = ctx.strokeStyle
    ctx.lineWidth = selected ? this.config.edge.selectedWidth : this.config.edge.width
    assert(
      edge.switchMode === "immediate" || edge.switchMode === "sync" || edge.switchMode === "at-end",
      `state machine graph renderer edge ${edge.id} has unknown switch mode ${edge.switchMode}`,
    )
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y)
    ctx.stroke()

    const symbolColor = cssColor(this.config.theme.edgeSymbol)
    ctx.fillStyle = symbolColor
    ctx.strokeStyle = symbolColor
    const arrowSize = this.config.edge.arrowSize
    const arrowBaseX = arrow.x - directionX * arrowSize
    const arrowBaseY = arrow.y - directionY * arrowSize
    const arrowNormalX = -directionY
    const arrowNormalY = directionX
    ctx.beginPath()
    ctx.moveTo(arrow.x, arrow.y)
    ctx.lineTo(arrowBaseX + arrowNormalX * arrowSize * 0.55, arrowBaseY + arrowNormalY * arrowSize * 0.55)
    ctx.lineTo(arrowBaseX - arrowNormalX * arrowSize * 0.55, arrowBaseY - arrowNormalY * arrowSize * 0.55)
    ctx.closePath()
    ctx.fill()

    if (edge.switchMode === "sync" || edge.switchMode === "at-end") {
      const sync = edge.switchMode === "sync"
      const side = sync ? -1 : 1
      const gap = arrowSize * (sync ? 0.22 : 0.04)
      const originX = (sync ? arrowBaseX : arrow.x) + directionX * gap * side
      const originY = (sync ? arrowBaseY : arrow.y) + directionY * gap * side
      const barRadius = arrowSize * 0.55
      ctx.lineWidth = Math.max(2.5, this.config.edge.width)
      ctx.beginPath()
      ctx.moveTo(originX - arrowNormalX * barRadius, originY - arrowNormalY * barRadius)
      ctx.lineTo(originX + arrowNormalX * barRadius, originY + arrowNormalY * barRadius)
      ctx.stroke()
    }
    ctx.restore()
  }

  quadraticPoint(start, control, end, t) {
    const inverse = 1 - t
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    }
  }

  quadraticTangent(start, control, end, t) {
    return {
      x: 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x),
      y: 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y),
    }
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
    ctx.strokeStyle = cssColor(node.start ? theme.start : theme.nodeBorder)
    ctx.stroke()

    ctx.fillStyle = cssColor(theme.text)
    ctx.font = `600 ${text.titleSize}px ${text.font}`
    ctx.textBaseline = "middle"
    ctx.fillText(String(node.name), rect.x + text.padding, rect.y + rect.height / 2, rect.width - text.padding * 2)

    if (node.start) {
      ctx.fillStyle = cssColor(theme.start)
      ctx.beginPath()
      ctx.arc(rect.x + rect.width - text.padding, rect.y + text.padding, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}
