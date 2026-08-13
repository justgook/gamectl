import { NodeGraph } from "./node-graph.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export const NG_NODE_KINDS = Object.freeze({
  GOAL: 1,
  CODE: 2,
  CALL: 3,
  VALUE: 4,
})

const VALID_KINDS = new Set(Object.values(NG_NODE_KINDS))

export function ngInputPortId(id) {
  return `input:${id}`
}

export function ngOutputPortId(id) {
  return `output:${id}`
}

export function cloneNgGraph(graph) {
  assert(Array.isArray(graph), "view-ng graph must be a raw node array")
  const cloned = structuredClone(graph)
  const nodeIds = new Set()
  for (const node of cloned) {
    assert(node && typeof node === "object" && !Array.isArray(node), "view-ng graph node must be an object")
    for (const key of ["id", "kind", "x", "y", "graphId"])
      assert(typeof node[key] === "number" && Number.isFinite(node[key]), `view-ng graph node ${key} must be a finite number`)
    for (const key of ["name", "codePath", "graphName"])
      assert(typeof node[key] === "string", `view-ng graph node ${node.id}.${key} must be a string`)
    assert(node.id > 0, `view-ng graph node id must be positive: ${node.id}`)
    assert(!nodeIds.has(node.id), `view-ng graph has duplicate node id ${node.id}`)
    assert(VALID_KINDS.has(node.kind), `view-ng graph node ${node.id} kind must be one of 1, 2, 3, 4`)
    assert(Array.isArray(node.inputs), `view-ng graph node ${node.id}.inputs must be an array`)
    assert(Array.isArray(node.outputs), `view-ng graph node ${node.id}.outputs must be an array`)
    nodeIds.add(node.id)
    const inputIds = new Set()
    for (const input of node.inputs) {
      for (const key of ["id", "srcNodeId", "srcOutputId"])
        assert(typeof input[key] === "number" && Number.isFinite(input[key]), `view-ng graph input ${node.id}.${key} must be a finite number`)
      assert(typeof input.name === "string", `view-ng graph input ${node.id}.${input.id}.name must be a string`)
      assert(input.id > 0, `view-ng graph node ${node.id} input id must be positive`)
      assert(!inputIds.has(input.id), `view-ng graph node ${node.id} has duplicate input id ${input.id}`)
      inputIds.add(input.id)
    }
    const outputIds = new Set()
    for (const output of node.outputs) {
      assert(typeof output.id === "number" && Number.isFinite(output.id), `view-ng graph output ${node.id}.id must be a finite number`)
      assert(typeof output.name === "string", `view-ng graph output ${node.id}.${output.id}.name must be a string`)
      assert(output.value === null || typeof output.value === "string", `view-ng graph output ${node.id}.${output.id}.value must be a string or null`)
      assert(output.id > 0, `view-ng graph node ${node.id} output id must be positive`)
      assert(!outputIds.has(output.id), `view-ng graph node ${node.id} has duplicate output id ${output.id}`)
      outputIds.add(output.id)
    }
  }
  for (const node of cloned) {
    for (const input of node.inputs)
      assert(input.srcNodeId === 0 || nodeIds.has(input.srcNodeId), `view-ng graph input ${node.id}.${input.id} references missing source node ${input.srcNodeId}`)
  }
  return cloned.map((node) => ({
    id: node.id,
    kind: node.kind,
    x: node.x,
    y: node.y,
    name: node.name,
    codePath: node.codePath,
    graphId: node.graphId,
    graphName: node.graphName,
    inputs: node.inputs.map((input) => ({
      id: input.id,
      name: input.name,
      srcNodeId: input.srcNodeId,
      srcOutputId: input.srcOutputId,
    })),
    outputs: node.outputs.map((output) => ({
      id: output.id,
      name: output.name,
      value: output.value,
    })),
  }))
}

function kindName(kind) {
  if (kind === NG_NODE_KINDS.GOAL) return "goal"
  if (kind === NG_NODE_KINDS.CODE) return "code"
  if (kind === NG_NODE_KINDS.CALL) return "import"
  if (kind === NG_NODE_KINDS.VALUE) return "value"
  throw new Error(`view-ng unknown node kind ${kind}`)
}

export function projectNgGraph(rawGraph) {
  const raw = cloneNgGraph(rawGraph)
  const missingOutputs = new Map(raw.map((node) => [node.id, new Set()]))
  for (const node of raw) {
    for (const input of node.inputs) {
      if (!input.srcNodeId) continue
      const source = raw.find((candidate) => candidate.id === input.srcNodeId)
      if (!source.outputs.some((output) => output.id === input.srcOutputId)) missingOutputs.get(source.id).add(input.srcOutputId)
    }
  }
  const nodes = raw.map((node) => ({
    id: node.id,
    kind: kindName(node.kind),
    name: node.name || `${kindName(node.kind)} #${node.id}`,
    subtitle: kindName(node.kind),
    x: node.x,
    y: node.y,
    ng: structuredClone(node),
    execState: "idle",
    ports: [
      ...node.inputs.map((input, index) => ({
        id: ngInputPortId(input.id),
        name: input.name || `input ${index + 1}`,
        direction: "input",
        dataType: "ng-value",
        maxConnections: 1,
        ngPortId: input.id,
      })),
      ...node.outputs.map((output, index) => ({
        id: ngOutputPortId(output.id),
        name: node.kind === NG_NODE_KINDS.VALUE ? String(output.value ?? "") : output.name || `output ${index + 1}`,
        direction: "output",
        dataType: "ng-value",
        maxConnections: null,
        ngPortId: output.id,
      })),
      ...[...missingOutputs.get(node.id)].map((id) => ({
        id: ngOutputPortId(id),
        name: `output ${id}`,
        direction: "output",
        dataType: "ng-value",
        maxConnections: null,
        ngPortId: id,
        synthetic: true,
      })),
    ],
  }))
  let edgeId = 1
  const edges = []
  for (const node of raw) {
    for (const input of node.inputs) {
      if (!input.srcNodeId) continue
      edges.push({
        id: edgeId++,
        from: { nodeId: input.srcNodeId, portId: ngOutputPortId(input.srcOutputId) },
        to: { nodeId: node.id, portId: ngInputPortId(input.id) },
        execState: "idle",
      })
    }
  }
  return { nodes, edges }
}

export function createNgNodeGraph(rawGraph) {
  return new NodeGraph({ graph: projectNgGraph(rawGraph), allowCycles: true })
}

export function serializeNgNodeGraph(graph) {
  assert(graph instanceof NodeGraph, "view-ng serialization requires a NodeGraph")
  const incoming = new Map(graph.graph.edges.map((edge) => [`${edge.to.nodeId}:${edge.to.portId}`, edge.from]))
  const raw = graph.graph.nodes.map((node) => {
    const result = structuredClone(node.ng)
    result.x = node.x
    result.y = node.y
    result.inputs = result.inputs.map((input) => {
      const source = incoming.get(`${node.id}:${ngInputPortId(input.id)}`)
      return {
        ...input,
        srcNodeId: source ? Number(source.nodeId) : 0,
        srcOutputId: source ? Number(String(source.portId).slice("output:".length)) : 0,
      }
    })
    return result
  })
  return cloneNgGraph(raw)
}
