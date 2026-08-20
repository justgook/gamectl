import { NG_NODE_KINDS, normalizeNgGroupPath } from "./ng-node-graph.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function kindFromString(value, fallback) {
  if (value === "value") return NG_NODE_KINDS.VALUE
  if (value === "goal") return NG_NODE_KINDS.GOAL
  if (value === "group" || value === "import") return NG_NODE_KINDS.GROUP
  if (value === "input") return NG_NODE_KINDS.GRAPH_INPUT
  if (value === "output") return NG_NODE_KINDS.GRAPH_OUTPUT
  if (value === "for-each") return NG_NODE_KINDS.FOR_EACH
  if (value === "for-each-input") return NG_NODE_KINDS.FOR_EACH_INPUT
  if (value === "for-each-shared-input" || value === "shared-input") return NG_NODE_KINDS.FOR_EACH_SHARED_INPUT
  if (value === "for-each-get-var" || value === "get-var") return NG_NODE_KINDS.FOR_EACH_GET_VAR
  if (value === "for-each-set-var" || value === "set-var") return NG_NODE_KINDS.FOR_EACH_SET_VAR
  if (value === "iteration-control") return NG_NODE_KINDS.ITERATION_CONTROL
  if (value === "code") return NG_NODE_KINDS.CODE
  return fallback
}

export function ngPresetKind(value, fallback = NG_NODE_KINDS.CODE) {
  if (typeof value === "string") return kindFromString(value.trim().toLowerCase(), fallback)
  const kind = Number(value || fallback)
  return Object.values(NG_NODE_KINDS).includes(kind) ? kind : fallback
}

export function normalizeNgPresetDraft(payload, fallbackKind = NG_NODE_KINDS.CODE) {
  assert(payload && typeof payload === "object" && !Array.isArray(payload), "view-ng preset must be an object")
  const kind = ngPresetKind(payload.kind, fallbackKind)
  const inputs = Array.isArray(payload.inputs) ? payload.inputs : []
  const outputs = Array.isArray(payload.outputs) ? payload.outputs : []
  const draft = {
    kind,
    name: String(payload.name || "").trim(),
    inputs: inputs.map((input, index) => ({
      inputId: Number(input.inputId || input.id || index + 1),
      name: String(input.name || "").trim(),
      value: String(input.defaultValue || input.value || ""),
    })),
    outputs: outputs.map((output, index) => ({
      outputId: Number(output.outputId || output.id || index + 1),
      name: kind === NG_NODE_KINDS.VALUE ? "" : String(output.name || "").trim(),
      value: String(output.value || ""),
    })),
  }
  if (kind === NG_NODE_KINDS.CODE) {
    draft.codePath = String(payload.codePath || "").trim()
    draft.code = String(payload.code || "")
  }
  if (kind === NG_NODE_KINDS.GROUP) {
    const storage = payload.storage ?? { mode: "inline" }
    assert(storage && typeof storage === "object" && !Array.isArray(storage), "view-ng Group preset storage must be an object")
    assert(storage.mode === "inline" || storage.mode === "linked", "view-ng Group preset storage.mode must be inline or linked")
    draft.storage = storage.mode === "linked"
      ? { mode: "linked", path: normalizeNgGroupPath(storage.path) }
      : { mode: "inline" }
    if (draft.storage.mode === "linked") {
      assert(payload.childGraph === undefined, "view-ng linked Group preset must not contain childGraph")
    } else {
      assert(payload.childGraph === undefined || Array.isArray(payload.childGraph), "view-ng inline Group preset childGraph must be an array")
      draft.childGraph = structuredClone(payload.childGraph || [])
    }
  } else if (kind === NG_NODE_KINDS.FOR_EACH) {
    assert(payload.childGraph === undefined || Array.isArray(payload.childGraph), "view-ng For Each preset childGraph must be an array")
    draft.childGraph = structuredClone(payload.childGraph || [])
  }
  return draft
}
