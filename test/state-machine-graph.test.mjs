import assert from "node:assert/strict"
import test from "node:test"

import { StateMachineGraph } from "../packages/util/state-machine-graph.js"

function requiredNodes() {
  return [
    {
      node: { id: "start", type: "entry", name: "Start", x: 0, y: 20 },
      constraints: {
        incoming: { max: 0 },
        outgoing: { max: 1, edgeKind: "entry" },
        deletable: false,
        copyable: false,
        renameable: false,
      },
    },
    {
      node: { id: "end", type: "exit", name: "End", x: 300, y: 20 },
      constraints: {
        incoming: { max: null },
        outgoing: { max: 0, edgeKind: "transition" },
        deletable: false,
        copyable: false,
        renameable: false,
      },
    },
  ]
}

function createGraph() {
  return new StateMachineGraph({
    graph: { nodes: [{ id: 1, type: "animation", name: "Idle", x: 120, y: 20 }], edges: [] },
    requiredNodes: requiredNodes(),
  })
}

test("required nodes are injected and survive mixed deletion", () => {
  const model = createGraph()

  assert.deepEqual(model.graph.nodes.map((node) => node.id), ["start", "end", 1])
  assert.deepEqual(model.removeNodes(["start", "end", 1]), {
    removedNodeIds: [1],
    preservedNodeIds: ["start", "end"],
    removedEdgeCount: 0,
  })
  assert.deepEqual(model.graph.nodes.map((node) => node.id), ["start", "end"])
})

test("required node direction and degree constraints are enforced", () => {
  const model = createGraph()

  assert.deepEqual(model.canAddEdge(1, "start"), { ok: false, reason: "Start already has its maximum of 0 incoming transitions" })
  assert.deepEqual(model.canAddEdge("end", 1), { ok: false, reason: "End already has its maximum of 0 outgoing transitions" })
  assert.deepEqual(model.transitionSourceState("end"), null)
  assert.deepEqual(model.transitionSourceState("start"), "available")

  model.addEdge({ id: 1, kind: "entry", from: "start", to: 1 })
  assert.deepEqual(model.transitionSourceState("start"), "disabled")
  assert.match(model.canAddEdge("start", "end").reason, /maximum of 1 outgoing transition/)

  model.addEdge({ id: 2, kind: "transition", from: 1, to: "end", switchMode: "immediate" })
  assert.equal(model.edgesInto("end").length, 1)
})

test("required node identity is immutable while coordinates remain movable", () => {
  const model = createGraph()
  const start = model.graph.nodes.find((node) => node.id === "start")
  start.x = 40
  model.replaceGraph(model.graph)
  assert.equal(model.graph.nodes.find((node) => node.id === "start").x, 40)

  const renamed = structuredClone(model.graph)
  renamed.nodes.find((node) => node.id === "start").name = "Entry"
  assert.throws(() => model.replaceGraph(renamed), /cannot change name/)
})
