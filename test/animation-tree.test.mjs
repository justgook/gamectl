import assert from "node:assert/strict"
import test from "node:test"

import {
  ANIMATION_NODE_KINDS,
  ANIMATION_CONDITION_OPERATORS,
  DEFAULT_ANIMATION_NODE_VIEWS,
  animationNodePath,
  animationParameterReferenceCounts,
  createAnimationNode,
  createAnimationTreeDocument,
  createEmptyAnimationTreeDocument,
  createDemoAnimationTreeDocument,
  validateAnimationNodeViews,
  validateAnimationSelector,
} from "../packages/util/animation-tree.js"

test("new Animation Trees contain an empty State Machine root", () => {
  const document = createEmptyAnimationTreeDocument()
  assert.equal(document.name, "Animation Tree")
  assert.equal(document.root.kind, ANIMATION_NODE_KINDS.STATE_MACHINE)
  assert.deepEqual(document.parameters, [])
  assert.deepEqual(document.root.graph.states, [])
  assert.deepEqual(document.root.graph.transitions, [])
  assert.deepEqual(createAnimationTreeDocument(document), document)
})

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
  for (const kind of ["animation", "one-shot", "blend2", "time-seek", "time-scale", "switch"])
    assert.equal(DEFAULT_ANIMATION_NODE_VIEWS[kind], null)

  const missing = { ...DEFAULT_ANIMATION_NODE_VIEWS }
  delete missing.animation
  assert.throws(() => validateAnimationNodeViews(missing), /configure every animation node kind/)
  assert.throws(
    () => validateAnimationNodeViews({ ...DEFAULT_ANIMATION_NODE_VIEWS, animation: "" }),
    /animation node view animation must be a non-empty view tag or null/,
  )
})

test("animation tree validates document-level integer parameters and transition conditions", () => {
  const document = createDemoAnimationTreeDocument()
  document.parameters.push({ id: "speed-id", name: "movement speed", defaultValue: 0 })
  const transition = document.root.graph.transitions.find((edge) => edge.kind === "transition")
  transition.conditions.push({ parameterId: "speed-id", operator: "gt", value: 0 })

  assert.deepEqual(createAnimationTreeDocument(document), document)
  assert.deepEqual(ANIMATION_CONDITION_OPERATORS, ["eq", "neq", "lt", "lte", "gt", "gte"])
  assert.equal(animationParameterReferenceCounts(document).get("speed-id"), 1)

  const missing = structuredClone(document)
  missing.root.graph.transitions.find((edge) => edge.kind === "transition").conditions[0].parameterId = "missing"
  assert.throws(() => createAnimationTreeDocument(missing), /must reference an Animation Parameter/)

  const fractional = structuredClone(document)
  fractional.parameters[0].defaultValue = 0.5
  assert.throws(() => createAnimationTreeDocument(fractional), /signed 32-bit integer/)

  const entryConditions = structuredClone(document)
  entryConditions.root.graph.transitions.find((edge) => edge.kind === "entry").conditions = []
  assert.throws(() => createAnimationTreeDocument(entryConditions), /entry edge must not contain conditions/)
})

test("animation parameter references include nested state machines", () => {
  const document = createDemoAnimationTreeDocument()
  document.parameters.push({ id: "grounded-id", name: "grounded", defaultValue: 1 })
  const nested = createAnimationNode(ANIMATION_NODE_KINDS.STATE_MACHINE, { id: "nested", name: "Nested" })
  const child = createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "nested-child", name: "Child" })
  nested.graph.states.push({ node: child, position: { x: 0, y: 0 } })
  nested.graph.transitions.push(
    { id: "nested-entry", kind: "entry", from: "start", to: child.id },
    { id: "nested-exit", kind: "transition", from: child.id, to: "end", switchMode: "at-end", conditions: [{ parameterId: "grounded-id", operator: "eq", value: 0 }] },
  )
  document.root.graph.states.push({ node: nested, position: { x: 0, y: 0 } })

  assert.equal(animationParameterReferenceCounts(document).get("grounded-id"), 1)
})

test("animation tree rejects duplicate embedded animation node ids", () => {
  const root = createAnimationNode(ANIMATION_NODE_KINDS.STATE_MACHINE, { id: "root", name: "Root" })
  root.graph.states.push(
    { node: createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "duplicate", name: "A" }), position: { x: 0, y: 0 } },
    { node: createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "duplicate", name: "B" }), position: { x: 100, y: 0 } },
  )
  assert.throws(() => createAnimationTreeDocument({ id: "tree", root }), /duplicate animation node id duplicate/)
})
