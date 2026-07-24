function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function requireObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  return value
}

function validateMaximum(value, label) {
  assert(value === null || (Number.isInteger(value) && value >= 0), `${label} must be null or a non-negative integer`)
  return value
}

function validateRequiredNodeDefinition(definition, index) {
  const label = `state machine graph requiredNodes[${index}]`
  requireObject(definition, label)
  const node = requireObject(definition.node, `${label}.node`)
  assert(node.id !== undefined && node.id !== null, `${label}.node.id is required`)
  assert(typeof node.type === "string" && node.type.length > 0, `${label}.node.type must be a non-empty string`)
  assert(typeof node.name === "string" && node.name.length > 0, `${label}.node.name must be a non-empty string`)
  const constraints = requireObject(definition.constraints, `${label}.constraints`)
  const incoming = requireObject(constraints.incoming, `${label}.constraints.incoming`)
  const outgoing = requireObject(constraints.outgoing, `${label}.constraints.outgoing`)
  validateMaximum(incoming.max, `${label}.constraints.incoming.max`)
  validateMaximum(outgoing.max, `${label}.constraints.outgoing.max`)
  for (const key of ["deletable", "copyable", "renameable"])
    assert(typeof constraints[key] === "boolean", `${label}.constraints.${key} must be boolean`)
  assert(typeof outgoing.edgeKind === "string" && outgoing.edgeKind.length > 0, `${label}.constraints.outgoing.edgeKind must be a non-empty string`)
  return definition
}

export class StateMachineGraph {
  constructor({ graph, requiredNodes }) {
    requireObject(graph, "state machine graph graph")
    assert(Array.isArray(graph.nodes), "state machine graph graph.nodes must be an array")
    assert(Array.isArray(graph.edges), "state machine graph graph.edges must be an array")
    assert(Array.isArray(requiredNodes), "state machine graph requiredNodes must be an array")

    this.requiredNodes = new Map()
    for (const [index, definition] of requiredNodes.entries()) {
      validateRequiredNodeDefinition(definition, index)
      assert(!this.requiredNodes.has(definition.node.id), `state machine graph duplicate required node id ${definition.node.id}`)
      this.requiredNodes.set(definition.node.id, structuredClone(definition))
    }

    const ordinaryIds = new Set(graph.nodes.map((node) => node.id))
    for (const id of this.requiredNodes.keys())
      assert(!ordinaryIds.has(id), `state machine graph ordinary node duplicates required node id ${id}`)

    this.graph = {
      nodes: [...this.requiredNodes.values()].map((definition) => structuredClone(definition.node)).concat(structuredClone(graph.nodes)),
      edges: structuredClone(graph.edges),
    }
    this.validateGraph(this.graph)
  }

  definition(nodeId) {
    return this.requiredNodes.get(nodeId) || null
  }

  constraints(nodeId) {
    const definition = this.definition(nodeId)
    if (definition) return definition.constraints
    return {
      incoming: { max: null },
      outgoing: { max: null, edgeKind: "transition" },
      deletable: true,
      copyable: true,
      renameable: true,
    }
  }

  isRequired(nodeId) {
    return this.requiredNodes.has(nodeId)
  }

  canDeleteNode(nodeId) {
    return this.constraints(nodeId).deletable
  }

  canCopyNode(nodeId) {
    return this.constraints(nodeId).copyable
  }

  canRenameNode(nodeId) {
    return this.constraints(nodeId).renameable
  }

  edgesInto(nodeId) {
    return this.graph.edges.filter((edge) => edge.to === nodeId)
  }

  edgesOutOf(nodeId) {
    return this.graph.edges.filter((edge) => edge.from === nodeId)
  }

  transitionSourceState(nodeId) {
    const { max } = this.constraints(nodeId).outgoing
    if (max === 0) return null
    if (max !== null && this.edgesOutOf(nodeId).length >= max) return "disabled"
    return "available"
  }

  edgeKindFrom(nodeId) {
    return this.constraints(nodeId).outgoing.edgeKind
  }

  canAddEdge(from, to) {
    const fromNode = this.graph.nodes.find((node) => node.id === from)
    const toNode = this.graph.nodes.find((node) => node.id === to)
    assert(fromNode, `state machine graph missing edge source node ${from}`)
    assert(toNode, `state machine graph missing edge target node ${to}`)
    if (from === to) return { ok: false, reason: "Self-transitions are not supported" }
    if (this.graph.edges.some((edge) => edge.from === from && edge.to === to))
      return { ok: false, reason: `${fromNode.name} → ${toNode.name} already exists` }

    const outgoingMax = this.constraints(from).outgoing.max
    if (outgoingMax !== null && this.edgesOutOf(from).length >= outgoingMax)
      return { ok: false, reason: `${fromNode.name} already has its maximum of ${outgoingMax} outgoing transition${outgoingMax === 1 ? "" : "s"}` }

    const incomingMax = this.constraints(to).incoming.max
    if (incomingMax !== null && this.edgesInto(to).length >= incomingMax)
      return { ok: false, reason: `${toNode.name} already has its maximum of ${incomingMax} incoming transition${incomingMax === 1 ? "" : "s"}` }

    return { ok: true }
  }

  addNode(node) {
    requireObject(node, "state machine graph node")
    assert(!this.graph.nodes.some((candidate) => candidate.id === node.id), `state machine graph duplicate node id ${node.id}`)
    this.graph.nodes.push(node)
  }

  addEdge(edge) {
    requireObject(edge, "state machine graph edge")
    assert(!this.graph.edges.some((candidate) => candidate.id === edge.id), `state machine graph duplicate edge id ${edge.id}`)
    const result = this.canAddEdge(edge.from, edge.to)
    assert(result.ok, result.reason)
    assert(edge.kind === this.edgeKindFrom(edge.from), `state machine graph edge from ${edge.from} must have kind ${this.edgeKindFrom(edge.from)}`)
    this.graph.edges.push(edge)
  }

  removeEdge(edgeId) {
    const index = this.graph.edges.findIndex((edge) => edge.id === edgeId)
    assert(index >= 0, `state machine graph missing edge ${edgeId}`)
    return this.graph.edges.splice(index, 1)[0]
  }

  removeNodes(nodeIds) {
    const requested = new Set(nodeIds)
    for (const id of requested)
      assert(this.graph.nodes.some((node) => node.id === id), `state machine graph missing node ${id}`)
    const removedNodeIds = new Set([...requested].filter((id) => this.canDeleteNode(id)))
    const preservedNodeIds = [...requested].filter((id) => !this.canDeleteNode(id))
    const removedEdgeCount = this.graph.edges.filter((edge) => removedNodeIds.has(edge.from) || removedNodeIds.has(edge.to)).length
    this.graph.nodes = this.graph.nodes.filter((node) => !removedNodeIds.has(node.id))
    this.graph.edges = this.graph.edges.filter((edge) => !removedNodeIds.has(edge.from) && !removedNodeIds.has(edge.to))
    return { removedNodeIds: [...removedNodeIds], preservedNodeIds, removedEdgeCount }
  }

  replaceGraph(graph) {
    this.validateGraph(graph)
    this.graph = structuredClone(graph)
  }

  validateGraph(graph) {
    requireObject(graph, "state machine graph graph")
    assert(Array.isArray(graph.nodes), "state machine graph graph.nodes must be an array")
    assert(Array.isArray(graph.edges), "state machine graph graph.edges must be an array")
    const nodesById = new Map()
    for (const node of graph.nodes) {
      assert(!nodesById.has(node.id), `state machine graph duplicate node id ${node.id}`)
      nodesById.set(node.id, node)
    }
    for (const [id, definition] of this.requiredNodes) {
      const node = nodesById.get(id)
      assert(node, `state machine graph missing required node ${id}`)
      for (const key of ["id", "type", "name"])
        assert(node[key] === definition.node[key], `state machine graph required node ${id} cannot change ${key}`)
    }
    const edgeIds = new Set()
    const edgeDirections = new Set()
    for (const edge of graph.edges) {
      assert(!edgeIds.has(edge.id), `state machine graph duplicate edge id ${edge.id}`)
      edgeIds.add(edge.id)
      assert(nodesById.has(edge.from), `state machine graph edge ${edge.id} references missing source ${edge.from}`)
      assert(nodesById.has(edge.to), `state machine graph edge ${edge.id} references missing target ${edge.to}`)
      const direction = `${typeof edge.from}:${String(edge.from)}→${typeof edge.to}:${String(edge.to)}`
      assert(!edgeDirections.has(direction), `state machine graph duplicate edge ${edge.from} → ${edge.to}`)
      edgeDirections.add(direction)
      assert(edge.kind === this.edgeKindFrom(edge.from), `state machine graph edge from ${edge.from} must have kind ${this.edgeKindFrom(edge.from)}`)
    }
    for (const node of graph.nodes) {
      const incomingMax = this.constraints(node.id).incoming.max
      const outgoingMax = this.constraints(node.id).outgoing.max
      const incomingCount = graph.edges.filter((edge) => edge.to === node.id).length
      const outgoingCount = graph.edges.filter((edge) => edge.from === node.id).length
      assert(incomingMax === null || incomingCount <= incomingMax, `state machine graph node ${node.id} exceeds incoming edge maximum`)
      assert(outgoingMax === null || outgoingCount <= outgoingMax, `state machine graph node ${node.id} exceeds outgoing edge maximum`)
    }
  }
}
