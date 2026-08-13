import { NodeGraph } from "./node-graph.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export const NG_NODE_KINDS = Object.freeze({
  GOAL: 1,
  CODE: 2,
  GROUP: 3,
  VALUE: 4,
  GRAPH_INPUT: 5,
  GRAPH_OUTPUT: 6,
})

const VALID_KINDS = new Set(Object.values(NG_NODE_KINDS))

export function ngInputPortId(id) { return `input:${id}` }
export function ngOutputPortId(id) { return `output:${id}` }

function cloneInput(input, nodeId) {
  for (const key of ["id", "srcNodeId", "srcOutputId"])
    assert(typeof input[key] === "number" && Number.isFinite(input[key]), `view-ng graph input ${nodeId}.${key} must be a finite number`)
  assert(typeof input.name === "string", `view-ng graph input ${nodeId}.${input.id}.name must be a string`)
  return { id: input.id, name: input.name, srcNodeId: input.srcNodeId, srcOutputId: input.srcOutputId }
}

function cloneOutput(output, nodeId) {
  assert(typeof output.id === "number" && Number.isFinite(output.id), `view-ng graph output ${nodeId}.id must be a finite number`)
  assert(typeof output.name === "string", `view-ng graph output ${nodeId}.${output.id}.name must be a string`)
  assert(output.value === null || typeof output.value === "string", `view-ng graph output ${nodeId}.${output.id}.value must be a string or null`)
  return { id: output.id, name: output.name, value: output.value }
}

function cloneLevel(graph, globalIds, label, { allowExternalSources = false } = {}) {
  assert(Array.isArray(graph), `${label} must be a raw node array`)
  const localIds = new Set()
  const nodes = graph.map((raw) => {
    assert(raw && typeof raw === "object" && !Array.isArray(raw), `${label} node must be an object`)
    for (const key of ["id", "kind", "x", "y", "graphId"])
      assert(typeof raw[key] === "number" && Number.isFinite(raw[key]), `${label} node ${key} must be a finite number`)
    for (const key of ["name", "codePath", "graphName"])
      assert(typeof raw[key] === "string", `${label} node ${raw.id}.${key} must be a string`)
    assert(raw.id > 0, `${label} node id must be positive: ${raw.id}`)
    assert(!globalIds.has(raw.id), `view-ng graph has duplicate document node id ${raw.id}`)
    assert(VALID_KINDS.has(raw.kind), `${label} node ${raw.id} has unknown kind ${raw.kind}`)
    assert(Array.isArray(raw.inputs), `${label} node ${raw.id}.inputs must be an array`)
    assert(Array.isArray(raw.outputs), `${label} node ${raw.id}.outputs must be an array`)
    globalIds.add(raw.id)
    localIds.add(raw.id)
    const inputs = raw.inputs.map((input) => cloneInput(input, raw.id))
    const outputs = raw.outputs.map((output) => cloneOutput(output, raw.id))
    const inputIds = new Set()
    for (const input of inputs) {
      assert(input.id > 0, `${label} node ${raw.id} input id must be positive`)
      assert(!inputIds.has(input.id), `${label} node ${raw.id} has duplicate input id ${input.id}`)
      inputIds.add(input.id)
    }
    const outputIds = new Set()
    for (const output of outputs) {
      assert(output.id > 0, `${label} node ${raw.id} output id must be positive`)
      assert(!outputIds.has(output.id), `${label} node ${raw.id} has duplicate output id ${output.id}`)
      outputIds.add(output.id)
    }
    if (raw.kind === NG_NODE_KINDS.GRAPH_INPUT) {
      assert(inputs.length === 0 && outputs.length === 1, `Graph Input ${raw.id} requires exactly one output and no inputs`)
    }
    if (raw.kind === NG_NODE_KINDS.GRAPH_OUTPUT) {
      assert(inputs.length === 1 && outputs.length === 0, `Graph Output ${raw.id} requires exactly one input and no outputs`)
    }
    return {
      id: raw.id, kind: raw.kind, x: raw.x, y: raw.y, name: raw.name,
      codePath: raw.codePath, graphId: raw.graphId, graphName: raw.graphName,
      inputs, outputs,
      ...(raw.kind === NG_NODE_KINDS.GROUP ? { childGraph: cloneLevel(raw.childGraph, globalIds, `view-ng Group Node ${raw.id}.childGraph`) } : {}),
    }
  })
  for (const node of nodes) if (node.kind === NG_NODE_KINDS.GROUP) syncNgGroupBoundary(node, nodes)
  for (const node of nodes) {
    for (const input of node.inputs)
      assert(allowExternalSources || input.srcNodeId === 0 || localIds.has(input.srcNodeId), `${label} input ${node.id}.${input.id} references node ${input.srcNodeId} outside its graph level`)
  }
  return nodes
}

export function cloneNgGraphFragment(graph) {
  return cloneLevel(structuredClone(graph), new Set(), "view-ng graph fragment")
}

export function cloneNgGraph(graph) {
  const cloned = cloneLevel(structuredClone(graph), new Set(), "view-ng graph")
  for (const node of cloned)
    assert(node.kind !== NG_NODE_KINDS.GRAPH_INPUT && node.kind !== NG_NODE_KINDS.GRAPH_OUTPUT, `root graph cannot contain ${kindName(node.kind)} ${node.id}`)
  return cloned
}

export function visitNgNodes(graph, visitor, path = []) {
  for (const node of graph) {
    visitor(node, path)
    if (node.kind === NG_NODE_KINDS.GROUP) visitNgNodes(node.childGraph, visitor, [...path, node.id])
  }
}

export function nextNgNodeId(graph) {
  let maximum = 0
  visitNgNodes(graph, (node) => { maximum = Math.max(maximum, node.id) })
  return maximum + 1
}

export function cloneNgNodesWithNewIds(nodes, firstId) {
  const cloned = cloneLevel(structuredClone(nodes), new Set(), "view-ng clipboard graph", { allowExternalSources: true })
  const idMap = new Map()
  let nextId = firstId
  visitNgNodes(cloned, (node) => idMap.set(node.id, nextId++))
  const remapLevel = (level) => level.map((node) => {
    const originalId = node.id
    const remapSource = (input) => ({
      ...input,
      srcNodeId: input.srcNodeId && idMap.has(input.srcNodeId) ? idMap.get(input.srcNodeId) : 0,
      srcOutputId: input.srcNodeId && idMap.has(input.srcNodeId) ? input.srcOutputId : 0,
    })
    const result = {
      ...node,
      id: idMap.get(originalId),
      inputs: node.inputs.map(remapSource),
      outputs: node.outputs.map((output) => ({ ...output })),
    }
    if (node.kind === NG_NODE_KINDS.GROUP) {
      result.childGraph = remapLevel(node.childGraph)
      result.inputs = result.inputs.map((input) => ({ ...input, id: idMap.get(input.id) }))
      result.outputs = result.outputs.map((output) => ({ ...output, id: idMap.get(output.id) }))
    }
    return result
  })
  return { nodes: remapLevel(cloned), nextId }
}

export function findNgGroupPath(graph, groupPath) {
  let level = graph
  const groups = []
  for (const id of groupPath) {
    const group = level.find((node) => node.id === id)
    assert(group && group.kind === NG_NODE_KINDS.GROUP, `view-ng missing Group Node ${id}`)
    groups.push(group)
    level = group.childGraph
  }
  return { graph: level, groups }
}

export function syncNgGroupBoundary(group, parentGraph = null) {
  assert(group.kind === NG_NODE_KINDS.GROUP, `view-ng node ${group.id} must be a Group Node`)
  const previousInputs = new Map(group.inputs.map((port) => [port.id, port]))
  group.inputs = group.childGraph.filter((node) => node.kind === NG_NODE_KINDS.GRAPH_INPUT).map((node) => ({
    id: node.id,
    name: node.name || `input ${node.id}`,
    srcNodeId: previousInputs.get(node.id)?.srcNodeId || 0,
    srcOutputId: previousInputs.get(node.id)?.srcOutputId || 0,
  }))
  group.outputs = group.childGraph.filter((node) => node.kind === NG_NODE_KINDS.GRAPH_OUTPUT).map((node) => ({
    id: node.id,
    name: node.name || `output ${node.id}`,
    value: null,
  }))
  if (parentGraph) {
    const outputIds = new Set(group.outputs.map((output) => output.id))
    for (const node of parentGraph) for (const input of node.inputs) {
      if (input.srcNodeId === group.id && !outputIds.has(input.srcOutputId)) {
        input.srcNodeId = 0
        input.srcOutputId = 0
      }
    }
  }
  return group
}

function kindName(kind) {
  if (kind === NG_NODE_KINDS.GOAL) return "goal"
  if (kind === NG_NODE_KINDS.CODE) return "code"
  if (kind === NG_NODE_KINDS.GROUP) return "group"
  if (kind === NG_NODE_KINDS.VALUE) return "value"
  if (kind === NG_NODE_KINDS.GRAPH_INPUT) return "graph-input"
  if (kind === NG_NODE_KINDS.GRAPH_OUTPUT) return "graph-output"
  throw new Error(`view-ng unknown node kind ${kind}`)
}

export function projectNgGraph(rawGraph) {
  const raw = cloneLevel(structuredClone(rawGraph), new Set(), "view-ng active graph")
  const missingOutputs = new Map(raw.map((node) => [node.id, new Set()]))
  for (const node of raw) for (const input of node.inputs) {
    if (!input.srcNodeId) continue
    const source = raw.find((candidate) => candidate.id === input.srcNodeId)
    if (!source.outputs.some((output) => output.id === input.srcOutputId)) missingOutputs.get(source.id).add(input.srcOutputId)
  }
  const nodes = raw.map((node) => ({
    id: node.id,
    kind: kindName(node.kind),
    name: node.name || `${kindName(node.kind)} #${node.id}`,
    subtitle: kindName(node.kind),
    x: node.x, y: node.y, ng: structuredClone(node), execState: "idle",
    ports: [
      ...node.inputs.map((input, index) => ({ id: ngInputPortId(input.id), name: input.name || `input ${index + 1}`, direction: "input", dataType: "ng-value", maxConnections: 1, ngPortId: input.id })),
      ...node.outputs.map((output, index) => ({ id: ngOutputPortId(output.id), name: node.kind === NG_NODE_KINDS.VALUE ? String(output.value ?? "") : output.name || `output ${index + 1}`, direction: "output", dataType: "ng-value", maxConnections: null, ngPortId: output.id })),
      ...[...missingOutputs.get(node.id)].map((id) => ({ id: ngOutputPortId(id), name: `output ${id}`, direction: "output", dataType: "ng-value", maxConnections: null, ngPortId: id, synthetic: true })),
    ],
  }))
  let edgeId = 1
  const edges = []
  for (const node of raw) for (const input of node.inputs) if (input.srcNodeId) edges.push({
    id: edgeId++, from: { nodeId: input.srcNodeId, portId: ngOutputPortId(input.srcOutputId) },
    to: { nodeId: node.id, portId: ngInputPortId(input.id) }, execState: "idle",
  })
  return { nodes, edges }
}

export function createNgNodeGraph(rawGraph) {
  return new NodeGraph({ graph: projectNgGraph(rawGraph), allowCycles: true })
}

export function serializeNgNodeGraph(graph) {
  assert(graph instanceof NodeGraph, "view-ng serialization requires a NodeGraph")
  const incoming = new Map(graph.graph.edges.map((edge) => [`${edge.to.nodeId}:${edge.to.portId}`, edge.from]))
  return graph.graph.nodes.map((node) => {
    const result = structuredClone(node.ng)
    result.x = node.x
    result.y = node.y
    result.inputs = result.inputs.map((input) => {
      const source = incoming.get(`${node.id}:${ngInputPortId(input.id)}`)
      return { ...input, srcNodeId: source ? Number(source.nodeId) : 0, srcOutputId: source ? Number(String(source.portId).slice("output:".length)) : 0 }
    })
    return result
  })
}

function sourceKey(source) { return `${source.srcNodeId}:${source.srcOutputId}` }

export function flattenNgGraph(graph) {
  const document = cloneNgGraph(graph)
  const aliases = new Map()
  const ordinary = []
  const addLevel = (level, owner = null) => {
    for (const node of level) {
      if (node.kind === NG_NODE_KINDS.GRAPH_INPUT) {
        assert(owner, `root graph cannot contain Graph Input ${node.id}`)
        const parentInput = owner.inputs.find((input) => input.id === node.id)
        assert(parentInput, `Group Node ${owner.id} missing input for Graph Input ${node.id}`)
        aliases.set(`${node.id}:${node.outputs[0].id}`, parentInput.srcNodeId ? { srcNodeId: parentInput.srcNodeId, srcOutputId: parentInput.srcOutputId } : null)
      } else if (node.kind === NG_NODE_KINDS.GRAPH_OUTPUT) {
        assert(owner, `root graph cannot contain Graph Output ${node.id}`)
        const input = node.inputs[0]
        aliases.set(`${owner.id}:${node.id}`, input.srcNodeId ? { srcNodeId: input.srcNodeId, srcOutputId: input.srcOutputId } : null)
      } else if (node.kind === NG_NODE_KINDS.GROUP) addLevel(node.childGraph, node)
      else ordinary.push(structuredClone(node))
    }
  }
  addLevel(document)
  const resolve = (source) => {
    const seen = new Set()
    let current = source
    while (current && aliases.has(sourceKey(current))) {
      const key = sourceKey(current)
      assert(!seen.has(key), `view-ng Group Node boundary alias cycle at ${key}`)
      seen.add(key)
      current = aliases.get(key)
    }
    return current
  }
  for (const node of ordinary) node.inputs = node.inputs.map((input) => {
    if (!input.srcNodeId) return input
    const source = resolve(input)
    return source ? { ...input, ...source } : { ...input, srcNodeId: 0, srcOutputId: 0 }
  })
  return ordinary
}
