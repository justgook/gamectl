import assert from "node:assert/strict"
import test from "node:test"

import { NodeGraph } from "../packages/util/node-graph.js"

const animationOutput = { id: "animation", direction: "output", dataType: "animation", maxConnections: null }
const animationInput = (id) => ({ id, direction: "input", dataType: "animation", maxConnections: 1 })

function createGraph() {
  return new NodeGraph({
    graph: {
      nodes: [
        { id: "a", kind: "animation", name: "A", x: 0, y: 0, ports: [animationOutput] },
        { id: "b", kind: "blend2", name: "B", x: 200, y: 0, ports: [animationInput("a"), animationInput("b"), animationOutput] },
      ],
      edges: [],
    },
    requiredNodes: [{
      node: { id: "output", kind: "output", name: "Output", x: 400, y: 0, ports: [animationInput("animation")] },
      constraints: { deletable: false, copyable: false, renameable: false },
    }],
    allowCycles: false,
  })
}

test("node graph connects explicit compatible port endpoints", () => {
  const graph = createGraph()
  const edge = { id: "one", from: { nodeId: "a", portId: "animation" }, to: { nodeId: "b", portId: "a" } }
  assert.deepEqual(graph.canAddEdge(edge.from, edge.to), { ok: true })
  graph.addEdge(edge)
  assert.equal(graph.graph.edges.length, 1)
  assert.match(graph.canAddEdge(edge.from, edge.to).reason, /already exists|connection limit/)
})

test("node graph enforces direction, type, capacity, and acyclic policy", () => {
  const graph = createGraph()
  graph.addEdge({ id: "one", from: { nodeId: "a", portId: "animation" }, to: { nodeId: "b", portId: "a" } })
  graph.addEdge({ id: "two", from: { nodeId: "b", portId: "animation" }, to: { nodeId: "output", portId: "animation" } })
  assert.match(graph.canAddEdge({ nodeId: "b", portId: "a" }, { nodeId: "a", portId: "animation" }).reason, /output port/)
  assert.match(graph.canAddEdge({ nodeId: "b", portId: "animation" }, { nodeId: "b", portId: "b" }).reason, /itself/)
})

test("node graph rejects cycles and mismatched port types", () => {
  const ioPorts = [animationInput("in"), animationOutput]
  const graph = new NodeGraph({
    graph: {
      nodes: [
        { id: "a", kind: "operator", name: "A", x: 0, y: 0, ports: ioPorts },
        { id: "b", kind: "operator", name: "B", x: 200, y: 0, ports: ioPorts },
        {
          id: "scalar",
          kind: "scalar",
          name: "Scalar",
          x: 0,
          y: 200,
          ports: [{ id: "value", direction: "output", dataType: "number", maxConnections: null }],
        },
      ],
      edges: [],
    },
    allowCycles: false,
  })
  graph.addEdge({ id: "forward", from: { nodeId: "a", portId: "animation" }, to: { nodeId: "b", portId: "in" } })
  assert.match(graph.canAddEdge({ nodeId: "b", portId: "animation" }, { nodeId: "a", portId: "in" }).reason, /cycle/)
  assert.match(graph.canAddEdge({ nodeId: "scalar", portId: "value" }, { nodeId: "a", portId: "in" }).reason, /Cannot connect number to animation/)
})

test("required nodes survive deletion", () => {
  const graph = createGraph()
  const result = graph.removeNodes(["a", "output"])
  assert.deepEqual(result.removedNodeIds, ["a"])
  assert.deepEqual(result.preservedNodeIds, ["output"])
  assert(graph.graph.nodes.some((node) => node.id === "output"))
})
