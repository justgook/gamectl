import assert from "node:assert/strict"
import test from "node:test"

import {
  createNgNodeGraph,
  ngInputPortId,
  ngOutputPortId,
  serializeNgNodeGraph,
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

test("NG cloning retains the legacy persisted schema only", () => {
  const raw = rawGraph()
  raw[0].unknown = true
  raw[0].outputs[0].unknown = true
  assert.deepEqual(serializeNgNodeGraph(createNgNodeGraph(raw)), rawGraph())
})
