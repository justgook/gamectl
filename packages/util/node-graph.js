function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function requireObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  return value
}

function endpointKey(endpoint) {
  return `${typeof endpoint.nodeId}:${String(endpoint.nodeId)}:${typeof endpoint.portId}:${String(endpoint.portId)}`
}

function validatePort(port, label) {
  requireObject(port, label)
  assert(port.id !== undefined && port.id !== null, `${label}.id is required`)
  assert(port.direction === "input" || port.direction === "output", `${label}.direction must be input or output`)
  assert(typeof port.dataType === "string" && port.dataType.length > 0, `${label}.dataType must be a non-empty string`)
  assert(port.maxConnections === null || (Number.isInteger(port.maxConnections) && port.maxConnections >= 0), `${label}.maxConnections must be null or a non-negative integer`)
}

function validateNode(node, label) {
  requireObject(node, label)
  assert(node.id !== undefined && node.id !== null, `${label}.id is required`)
  assert(typeof node.kind === "string" && node.kind.length > 0, `${label}.kind must be a non-empty string`)
  assert(typeof node.name === "string", `${label}.name must be a string`)
  if (Object.hasOwn(node, "displayName")) assert(typeof node.displayName === "string" && node.displayName.length > 0, `${label}.displayName must be a non-empty string`)
  assert(node.name.length > 0 || node.displayName?.length > 0, `${label} must have a non-empty name or displayName`)
  assert(Number.isFinite(node.x) && Number.isFinite(node.y), `${label} position must be finite`)
  assert(Array.isArray(node.ports), `${label}.ports must be an array`)
  const portIds = new Set()
  node.ports.forEach((port, index) => {
    validatePort(port, `${label}.ports[${index}]`)
    assert(!portIds.has(port.id), `${label} has duplicate port id ${port.id}`)
    portIds.add(port.id)
  })
}

export class NodeGraph {
  constructor({ graph, requiredNodes = [], allowCycles = false }) {
    requireObject(graph, "node graph graph")
    assert(Array.isArray(graph.nodes), "node graph graph.nodes must be an array")
    assert(Array.isArray(graph.edges), "node graph graph.edges must be an array")
    assert(Array.isArray(requiredNodes), "node graph requiredNodes must be an array")
    assert(typeof allowCycles === "boolean", "node graph allowCycles must be boolean")
    this.allowCycles = allowCycles
    this.requiredNodes = new Map()
    for (const [index, definition] of requiredNodes.entries()) {
      const label = `node graph requiredNodes[${index}]`
      requireObject(definition, label)
      validateNode(definition.node, `${label}.node`)
      const constraints = requireObject(definition.constraints, `${label}.constraints`)
      for (const key of ["deletable", "copyable", "renameable"])
        assert(typeof constraints[key] === "boolean", `${label}.constraints.${key} must be boolean`)
      assert(!this.requiredNodes.has(definition.node.id), `node graph duplicate required node id ${definition.node.id}`)
      this.requiredNodes.set(definition.node.id, structuredClone(definition))
    }
    const ordinaryIds = new Set(graph.nodes.map((node) => node.id))
    for (const id of this.requiredNodes.keys()) assert(!ordinaryIds.has(id), `node graph ordinary node duplicates required node id ${id}`)
    this.graph = {
      nodes: [...this.requiredNodes.values()].map((definition) => structuredClone(definition.node)).concat(structuredClone(graph.nodes)),
      edges: structuredClone(graph.edges),
    }
    this.validateGraph(this.graph)
  }

  constraints(nodeId) {
    return this.requiredNodes.get(nodeId)?.constraints || { deletable: true, copyable: true, renameable: true }
  }

  isRequired(nodeId) {
    return this.requiredNodes.has(nodeId)
  }

  node(nodeId) {
    const node = this.graph.nodes.find((candidate) => candidate.id === nodeId)
    assert(node, `node graph missing node ${nodeId}`)
    return node
  }

  port(endpoint) {
    requireObject(endpoint, "node graph endpoint")
    const node = this.node(endpoint.nodeId)
    const port = node.ports.find((candidate) => candidate.id === endpoint.portId)
    assert(port, `node graph missing port ${endpoint.nodeId}.${endpoint.portId}`)
    return port
  }

  edgesForPort(endpoint) {
    const key = endpointKey(endpoint)
    return this.graph.edges.filter((edge) => endpointKey(edge.from) === key || endpointKey(edge.to) === key)
  }

  wouldCreateCycle(fromNodeId, toNodeId) {
    if (this.allowCycles) return false
    const outgoing = new Map(this.graph.nodes.map((node) => [node.id, []]))
    for (const edge of this.graph.edges) outgoing.get(edge.from.nodeId).push(edge.to.nodeId)
    const pending = [toNodeId]
    const visited = new Set()
    while (pending.length > 0) {
      const nodeId = pending.pop()
      if (nodeId === fromNodeId) return true
      if (visited.has(nodeId)) continue
      visited.add(nodeId)
      pending.push(...outgoing.get(nodeId))
    }
    return false
  }

  canAddEdge(from, to) {
    const fromPort = this.port(from)
    const toPort = this.port(to)
    if (from.nodeId === to.nodeId) return { ok: false, reason: "A node cannot connect to itself" }
    if (fromPort.direction !== "output") return { ok: false, reason: "Connections must start at an output port" }
    if (toPort.direction !== "input") return { ok: false, reason: "Connections must end at an input port" }
    if (fromPort.dataType !== toPort.dataType) return { ok: false, reason: `Cannot connect ${fromPort.dataType} to ${toPort.dataType}` }
    if (this.graph.edges.some((edge) => endpointKey(edge.from) === endpointKey(from) && endpointKey(edge.to) === endpointKey(to)))
      return { ok: false, reason: "Connection already exists" }
    if (fromPort.maxConnections !== null && this.edgesForPort(from).length >= fromPort.maxConnections)
      return { ok: false, reason: `Output ${from.nodeId}.${from.portId} has reached its connection limit` }
    if (toPort.maxConnections !== null && this.edgesForPort(to).length >= toPort.maxConnections)
      return { ok: false, reason: `Input ${to.nodeId}.${to.portId} has reached its connection limit` }
    if (this.wouldCreateCycle(from.nodeId, to.nodeId)) return { ok: false, reason: "Connection would create a cycle" }
    return { ok: true }
  }

  addNode(node) {
    validateNode(node, "node graph node")
    assert(!this.graph.nodes.some((candidate) => candidate.id === node.id), `node graph duplicate node id ${node.id}`)
    this.graph.nodes.push(node)
  }

  addEdge(edge) {
    requireObject(edge, "node graph edge")
    assert(!this.graph.edges.some((candidate) => candidate.id === edge.id), `node graph duplicate edge id ${edge.id}`)
    const result = this.canAddEdge(edge.from, edge.to)
    assert(result.ok, result.reason)
    this.graph.edges.push(edge)
  }

  removeEdge(edgeId) {
    const index = this.graph.edges.findIndex((edge) => edge.id === edgeId)
    assert(index >= 0, `node graph missing edge ${edgeId}`)
    return this.graph.edges.splice(index, 1)[0]
  }

  removeNodes(nodeIds) {
    const requested = new Set(nodeIds)
    for (const id of requested) this.node(id)
    const removed = new Set([...requested].filter((id) => this.constraints(id).deletable))
    const preserved = [...requested].filter((id) => !this.constraints(id).deletable)
    const removedEdgeCount = this.graph.edges.filter((edge) => removed.has(edge.from.nodeId) || removed.has(edge.to.nodeId)).length
    this.graph.nodes = this.graph.nodes.filter((node) => !removed.has(node.id))
    this.graph.edges = this.graph.edges.filter((edge) => !removed.has(edge.from.nodeId) && !removed.has(edge.to.nodeId))
    return { removedNodeIds: [...removed], preservedNodeIds: preserved, removedEdgeCount }
  }

  validateGraph(graph) {
    const nodeIds = new Set()
    for (const [index, node] of graph.nodes.entries()) {
      validateNode(node, `node graph graph.nodes[${index}]`)
      assert(!nodeIds.has(node.id), `node graph duplicate node id ${node.id}`)
      nodeIds.add(node.id)
    }
    const edgeIds = new Set()
    for (const [index, edge] of graph.edges.entries()) {
      requireObject(edge, `node graph graph.edges[${index}]`)
      assert(!edgeIds.has(edge.id), `node graph duplicate edge id ${edge.id}`)
      edgeIds.add(edge.id)
      const result = this.canAddEdgeAgainst(graph, edge.from, edge.to, edge.id)
      assert(result.ok, result.reason)
    }
  }

  canAddEdgeAgainst(graph, from, to, ignoredEdgeId) {
    const oldGraph = this.graph
    this.graph = {
      nodes: graph.nodes,
      edges: graph.edges.filter((edge) => edge.id !== ignoredEdgeId),
    }
    try {
      return this.canAddEdge(from, to)
    } finally {
      this.graph = oldGraph
    }
  }
}
