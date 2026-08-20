import assert from "node:assert/strict"
import test from "node:test"

import { NG_NODE_KINDS } from "../packages/util/ng-node-graph.js"
import { normalizeNgPresetDraft } from "../packages/util/ng-node-preset.js"

test("Code presets normalize their declared interface", () => {
  const draft = normalizeNgPresetDraft({
    name: "JSON.Encode",
    kind: "code",
    codePath: "ng/presets/json_encode.lua",
    inputs: [{ name: "data", defaultValue: "{}" }],
    outputs: [{ name: "text" }],
  })
  assert.equal(draft.kind, NG_NODE_KINDS.CODE)
  assert.equal(draft.codePath, "ng/presets/json_encode.lua")
  assert.deepEqual(draft.inputs, [{ inputId: 1, name: "data", value: "{}" }])
  assert.deepEqual(draft.outputs, [{ outputId: 1, name: "text", value: "" }])
})

test("Iteration State preset kinds normalize GetVar and SetVar aliases", () => {
  assert.equal(normalizeNgPresetDraft({ name: "Get", kind: "get-var" }).kind, NG_NODE_KINDS.FOR_EACH_GET_VAR)
  assert.equal(normalizeNgPresetDraft({ name: "Set", kind: "set-var" }).kind, NG_NODE_KINDS.FOR_EACH_SET_VAR)
})

test("linked Group presets need only their authoritative Group document", () => {
  const draft = normalizeNgPresetDraft({
    name: "Mission Background",
    kind: "group",
    storage: { mode: "linked", path: "CYBERPUNK\\missions/./m01.group.ng.json" },
  })
  assert.deepEqual(draft, {
    kind: NG_NODE_KINDS.GROUP,
    name: "Mission Background",
    inputs: [],
    outputs: [],
    storage: { mode: "linked", path: "CYBERPUNK/missions/m01.group.ng.json" },
  })
})

test("linked Group presets reject embedded child graphs", () => {
  assert.throws(() => normalizeNgPresetDraft({
    name: "Invalid",
    kind: "group",
    storage: { mode: "linked", path: "groups/invalid.ng.json" },
    childGraph: [],
  }), /must not contain childGraph/)
})

test("inline Group preset child graphs are cloned", () => {
  const childGraph = [{ id: 1 }]
  const draft = normalizeNgPresetDraft({ name: "Inline", kind: "group", childGraph })
  childGraph[0].id = 2
  assert.deepEqual(draft.storage, { mode: "inline" })
  assert.deepEqual(draft.childGraph, [{ id: 1 }])
})
