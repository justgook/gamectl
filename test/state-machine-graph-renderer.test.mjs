import assert from "node:assert/strict"
import test from "node:test"

import { StateMachineGraphRenderer } from "../packages/util/state-machine-graph-renderer.js"

function rendererConfig() {
  return {
    node: {
      width: 100,
      height: 60,
      radius: 8,
      borderWidth: 2,
      transitionRegion: { left: 10, right: 12, top: 6, bottom: 8 },
    },
    edge: {
      width: 2,
      selectedWidth: 4,
      bidirectionalOffset: 34,
      arrowSize: 15,
      arrowInset: 10,
    },
    text: { font: "sans-serif", titleSize: 13, padding: 8 },
    theme: {
      node: [0, 0, 0, 1],
      nodeHover: [0, 0, 0, 1],
      nodeSelected: [0, 0, 0, 1],
      nodeBorder: [0, 0, 0, 1],
      transitionRegion: [0, 0, 0, 1],
      transitionRegionHover: [0, 0, 0, 1],
      transitionRegionDisabled: [0, 0, 0, 1],
      requiredNode: [0, 0, 0, 1],
      requiredNodeHover: [0, 0, 0, 1],
      requiredNodeSelected: [0, 0, 0, 1],
      text: [0, 0, 0, 1],
      edge: [0, 0, 0, 1],
      edgeSelected: [0, 0, 0, 1],
      edgeSymbol: [0, 0, 0, 1],
      edgeConditionSymbol: [1, 0.5, 0, 1],
    },
  }
}

const node = { id: 1, x: 20, y: 30 }

test("transition region is the visible frame around the node body", () => {
  const renderer = new StateMachineGraphRenderer(rendererConfig())

  assert.deepEqual(renderer.nodeBodyBounds(node), { x: 30, y: 36, width: 78, height: 46 })
  assert.equal(renderer.hitTransitionRegion([node], { x: 24, y: 50 }), node)
  assert.equal(renderer.hitTransitionRegion([node], { x: 50, y: 50 }), null)
  assert.equal(renderer.hitNode([node], { x: 50, y: 50 }), node)
})

test("conditioned transitions require a distinct arrow symbol color", () => {
  const config = rendererConfig()
  delete config.theme.edgeConditionSymbol
  assert.throws(() => new StateMachineGraphRenderer(config), /edgeConditionSymbol/)
})

test("transition region must leave a positive node body", () => {
  const config = rendererConfig()
  config.node.transitionRegion.left = 50
  config.node.transitionRegion.right = 50

  assert.throws(
    () => new StateMachineGraphRenderer(config),
    /transition region must leave a positive node body/,
  )
})
