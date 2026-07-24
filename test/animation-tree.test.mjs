import assert from "node:assert/strict"
import test from "node:test"

import {
  ANIMATION_NODE_KINDS,
  animationNodePath,
  createAnimationNode,
  createAnimationTreeDocument,
  createDemoAnimationTreeDocument,
} from "../packages/util/animation-tree.js"

test("animation tree embeds child animation nodes with document-wide identities", () => {
  const document = createDemoAnimationTreeDocument()
  assert.deepEqual(animationNodePath(document, "movement").map((node) => node.id), ["root", "movement"])
  assert.deepEqual(animationNodePath(document, "movement-blend2").map((node) => node.id), ["root", "movement", "movement-blend2"])
})

test("animation tree rejects duplicate embedded animation node ids", () => {
  const root = createAnimationNode(ANIMATION_NODE_KINDS.STATE_MACHINE, { id: "root", name: "Root" })
  root.graph.states.push(
    { node: createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "duplicate", name: "A" }), position: { x: 0, y: 0 } },
    { node: createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "duplicate", name: "B" }), position: { x: 100, y: 0 } },
  )
  assert.throws(() => createAnimationTreeDocument({ id: "tree", root }), /duplicate animation node id duplicate/)
})
