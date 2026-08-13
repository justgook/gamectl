import assert from "node:assert/strict"
import test from "node:test"

import {
  NG_NODE_KINDS,
  cloneNgGraph,
  cloneNgNodesWithNewIds,
  createNgNodeGraph,
  flattenNgGraph,
  ngInputPortId,
  ngOutputPortId,
  serializeNgNodeGraph,
  syncNgGroupBoundary,
} from "../packages/util/ng-node-graph.js"

function rawGraph() {
  return [
    {
      id: 1, kind: 4, x: 10, y: 20, name: "Value", codePath: "", graphId: 0, graphName: "",
      inputs: [], outputs: [{ id: 1, name: "", value: "hello" }],
    },
    {
      id: 2, kind: 2, x: 200, y: 20, name: "Code", codePath: "code.lua", graphId: 0, graphName: "",
      inputs: [{ id: 1, name: "value", srcNodeId: 1, srcOutputId: 1 }], outputs: [{ id: 1, name: "result", value: null }],
    },
  ]
}

test("NG projection namespaces overlapping input and output ids and round trips", () => {
  const model = createNgNodeGraph(rawGraph())
  assert(model.node(2).ports.some((port) => port.id === ngInputPortId(1)))
  assert(model.node(2).ports.some((port) => port.id === ngOutputPortId(1)))
  assert.deepEqual(serializeNgNodeGraph(model), rawGraph())
})

test("NG serialization writes NodeGraph disconnection edits into input source fields", () => {
  const model = createNgNodeGraph(rawGraph())
  model.removeEdge(1)
  const serialized = serializeNgNodeGraph(model)
  assert.equal(serialized[1].inputs[0].srcNodeId, 0)
  assert.equal(serialized[1].inputs[0].srcOutputId, 0)
})

test("NG projection preserves legacy references to undeclared output ids", () => {
  const raw = rawGraph()
  raw[1].inputs[0].srcOutputId = 99
  const model = createNgNodeGraph(raw)
  assert(model.node(1).ports.some((port) => port.id === ngOutputPortId(99) && port.synthetic))
  assert.deepEqual(serializeNgNodeGraph(model), raw)
})

test("NG cloning retains the persisted schema only", () => {
  const raw = rawGraph()
  raw[0].unknown = true
  raw[0].outputs[0].unknown = true
  assert.deepEqual(serializeNgNodeGraph(createNgNodeGraph(raw)), rawGraph())
})

function groupedGraph() {
  const graph = rawGraph()
  graph[1].inputs[0] = { id: 1, name: "value", srcNodeId: 10, srcOutputId: 22 }
  graph.unshift({
    id: 10, kind: NG_NODE_KINDS.GROUP, x: 100, y: 100, name: "Transform", codePath: "", graphId: 0, graphName: "",
    inputs: [], outputs: [], childGraph: [
      { id: 20, kind: NG_NODE_KINDS.GRAPH_INPUT, x: 0, y: 0, name: "source", codePath: "", graphId: 0, graphName: "", inputs: [], outputs: [{ id: 1, name: "source", value: null }] },
      { id: 21, kind: NG_NODE_KINDS.CODE, x: 200, y: 0, name: "Inner", codePath: "inner.lua", graphId: 0, graphName: "", inputs: [{ id: 1, name: "source", srcNodeId: 20, srcOutputId: 1 }], outputs: [{ id: 1, name: "result", value: null }] },
      { id: 22, kind: NG_NODE_KINDS.GRAPH_OUTPUT, x: 400, y: 0, name: "result", codePath: "", graphId: 0, graphName: "", inputs: [{ id: 1, name: "result", srcNodeId: 21, srcOutputId: 1 }], outputs: [] },
    ],
  })
  graph[0].inputs = [{ id: 20, name: "source", srcNodeId: 1, srcOutputId: 1 }]
  graph[0].outputs = [{ id: 22, name: "result", value: null }]
  return graph
}

test("Group Node boundaries derive parent ports", () => {
  const graph = groupedGraph()
  graph[0].inputs = []
  graph[0].outputs = []
  syncNgGroupBoundary(graph[0])
  assert.deepEqual(graph[0].inputs, [{ id: 20, name: "source", srcNodeId: 0, srcOutputId: 0 }])
  assert.deepEqual(graph[0].outputs, [{ id: 22, name: "result", value: null }])
})

test("removing a Graph Output disconnects its parent consumers", () => {
  const graph = groupedGraph()
  graph[0].childGraph = graph[0].childGraph.filter((node) => node.kind !== NG_NODE_KINDS.GRAPH_OUTPUT)
  syncNgGroupBoundary(graph[0], graph)
  assert.deepEqual(graph[2].inputs[0], { id: 1, name: "value", srcNodeId: 0, srcOutputId: 0 })
})

test("inline Group Nodes flatten to executable graph connections", () => {
  const flat = flattenNgGraph(groupedGraph())
  assert.deepEqual(flat.map((node) => node.id), [21, 1, 2])
  assert.deepEqual(flat.find((node) => node.id === 21).inputs[0], { id: 1, name: "source", srcNodeId: 1, srcOutputId: 1 })
  assert.deepEqual(flat.find((node) => node.id === 2).inputs[0], { id: 1, name: "value", srcNodeId: 21, srcOutputId: 1 })
})

test("nested Group Node boundaries flatten through every level", () => {
  const base = groupedGraph()
  const inner = base[0]
  inner.inputs[0].srcNodeId = 31
  inner.inputs[0].srcOutputId = 1
  const outer = {
    id: 30, kind: NG_NODE_KINDS.GROUP, x: 100, y: 100, name: "Outer", codePath: "", graphId: 0, graphName: "",
    inputs: [{ id: 31, name: "source", srcNodeId: 1, srcOutputId: 1 }],
    outputs: [{ id: 32, name: "result", value: null }],
    childGraph: [
      { id: 31, kind: NG_NODE_KINDS.GRAPH_INPUT, x: 0, y: 0, name: "source", codePath: "", graphId: 0, graphName: "", inputs: [], outputs: [{ id: 1, name: "source", value: null }] },
      inner,
      { id: 32, kind: NG_NODE_KINDS.GRAPH_OUTPUT, x: 400, y: 0, name: "result", codePath: "", graphId: 0, graphName: "", inputs: [{ id: 1, name: "result", srcNodeId: 10, srcOutputId: 22 }], outputs: [] },
    ],
  }
  base[2].inputs[0].srcNodeId = 30
  base[2].inputs[0].srcOutputId = 32
  const flat = flattenNgGraph([outer, base[1], base[2]])
  assert.equal(flat.find((node) => node.id === 21).inputs[0].srcNodeId, 1)
  assert.equal(flat.find((node) => node.id === 2).inputs[0].srcNodeId, 21)
})

test("node ids must be unique across nested graph levels", () => {
  const graph = groupedGraph()
  graph[0].childGraph[1].id = 10
  assert.throws(() => cloneNgGraph(graph), /duplicate document node id 10/)
})

test("copying Group Nodes remaps every nested identity and boundary port", () => {
  const group = groupedGraph()[0]
  const cloned = cloneNgNodesWithNewIds([group], 100).nodes[0]
  assert.equal(cloned.id, 100)
  assert.deepEqual(cloned.childGraph.map((node) => node.id), [101, 102, 103])
  assert.equal(cloned.inputs[0].id, 101)
  assert.equal(cloned.outputs[0].id, 103)
  assert.equal(cloned.childGraph[1].inputs[0].srcNodeId, 101)
  assert.equal(cloned.childGraph[2].inputs[0].srcNodeId, 102)
})
