import assert from "node:assert/strict"
import test from "node:test"

import {
  ANIMATION_NODE_KINDS,
  DEFAULT_ANIMATION_NODE_VIEWS,
  animationNodePath,
  createAnimationNode,
  createAnimationTreeDocument,
  createDemoAnimationTreeDocument,
  validateAnimationNodeViews,
  validateAnimationSelector,
} from "../packages/util/animation-tree.js"

test("animation tree embeds child animation nodes with document-wide identities", () => {
  const document = createDemoAnimationTreeDocument()
  assert.deepEqual(animationNodePath(document, "movement").map((node) => node.id), ["root", "movement"])
  assert.deepEqual(animationNodePath(document, "movement-blend2").map((node) => node.id), ["root", "movement", "movement-blend2"])
})

test("animation nodes select an Aseprite source, layer, and tag", () => {
  const animation = createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "animation" })
  assert.deepEqual(animation.animation, { url: "", layer: "*", tag: "*" })
  assert.equal(validateAnimationSelector(animation.animation), animation.animation)
  assert.throws(() => validateAnimationSelector({ url: "file.aseprite", layer: "*" }), /only url, layer, and tag/)
})

test("sprite composition nodes only store parameters that affect 2D playback", () => {
  const oneShot = createAnimationNode(ANIMATION_NODE_KINDS.ONE_SHOT, { id: "one-shot" })
  const blend = createAnimationNode(ANIMATION_NODE_KINDS.BLEND_2, { id: "blend" })
  const switchNode = createAnimationNode(ANIMATION_NODE_KINDS.SWITCH, { id: "switch" })

  assert.deepEqual(oneShot.parameters, { active: false })
  assert.equal("parameters" in blend, false)
  assert.deepEqual(switchNode.parameters, { currentInput: "input-1" })
})

test("animation node views exhaustively configure editable and inspector-only node kinds", () => {
  assert.equal(validateAnimationNodeViews(DEFAULT_ANIMATION_NODE_VIEWS), DEFAULT_ANIMATION_NODE_VIEWS)
  for (const kind of ["one-shot", "blend2", "time-seek", "time-scale", "switch"])
    assert.equal(DEFAULT_ANIMATION_NODE_VIEWS[kind], null)

  const missing = { ...DEFAULT_ANIMATION_NODE_VIEWS }
  delete missing.animation
  assert.throws(() => validateAnimationNodeViews(missing), /configure every animation node kind/)
  assert.throws(
    () => validateAnimationNodeViews({ ...DEFAULT_ANIMATION_NODE_VIEWS, animation: "" }),
    /animation node view animation must be a non-empty view tag or null/,
  )
})

test("animation tree rejects duplicate embedded animation node ids", () => {
  const root = createAnimationNode(ANIMATION_NODE_KINDS.STATE_MACHINE, { id: "root", name: "Root" })
  root.graph.states.push(
    { node: createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "duplicate", name: "A" }), position: { x: 0, y: 0 } },
    { node: createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "duplicate", name: "B" }), position: { x: 100, y: 0 } },
  )
  assert.throws(() => createAnimationTreeDocument({ id: "tree", root }), /duplicate animation node id duplicate/)
})
