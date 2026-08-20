import assert from "node:assert/strict"
import test from "node:test"

import { NodeGraphRenderer } from "../packages/util/node-graph-renderer.js"

const config = {
  node: { width: 180, headerHeight: 30, portRowHeight: 28, padding: 12, radius: 8, borderWidth: 2, portRadius: 6 },
  edge: { width: 2, selectedWidth: 4, curveOffset: 48 },
  text: { font: "sans-serif", size: 13 },
  theme: Object.fromEntries([
    "node", "nodeHover", "nodeSelected", "nodeBorder", "header", "requiredHeader", "text", "textMuted",
    "port", "portHover", "edge", "edgeSelected", "edgePreviewInvalid",
  ].map((key) => [key, [0, 0, 0, 1]])),
}

const measureText = (value) => String(value).length * 10

function node(ports) {
  return { id: 1, kind: "value", name: "Value", x: 20, y: 30, ports }
}

test("node graph nodes grow to contain long port labels", () => {
  const renderer = new NodeGraphRenderer(config, { measureText })
  const graphNode = node([
    { id: "output:1", name: "a very long authored output value", direction: "output", dataType: "value", maxConnections: null },
  ])
  const size = renderer.nodeSize(graphNode)
  assert.equal(size.width, 354)
  assert.equal(renderer.nodeBounds(graphNode).width, size.width)
  assert.equal(renderer.portPoint(graphNode, "output:1").x, graphNode.x + size.width)
})

test("node graph nodes may render a derived display name without changing the authored name", () => {
  const renderer = new NodeGraphRenderer(config, { measureText })
  const graphNode = { ...node([]), name: "", displayName: "Long Animation Tag" }
  assert.equal(renderer.nodeSize(graphNode).width, 204)
  assert.equal(graphNode.name, "")
})

test("node graph nodes reserve one row for opposing labels", () => {
  const renderer = new NodeGraphRenderer(config, { measureText })
  const graphNode = node([
    { id: "input:1", name: "long input", direction: "input", dataType: "value", maxConnections: 1 },
    { id: "output:1", name: "long output", direction: "output", dataType: "value", maxConnections: null },
  ])
  assert.equal(renderer.nodeSize(graphNode).width, 246)
})
