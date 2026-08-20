import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const treeSource = await readFile(new URL("../views/view-animation-tree.js", import.meta.url), "utf8")
const popupSource = await readFile(new URL("../views/view-animation-parameters.js", import.meta.url), "utf8")
const rendererSource = await readFile(new URL("../packages/util/state-machine-graph-renderer.js", import.meta.url), "utf8")
const demoConfig = JSON.parse(await readFile(new URL("../examples/demo/gams.json", import.meta.url), "utf8"))

test("animation transition inspector authors structured conditions", () => {
  assert.match(treeSource, /edge\.conditions\.push\(\{ parameterId: this\.animationTree\.parameters\[0\]\.id, operator: "gt", value: 0 \}\)/)
  assert.match(treeSource, /data-field="condition-parameter"/)
  assert.match(treeSource, /data-field="condition-operator"/)
  assert.match(treeSource, /data-field="condition-value"/)
  assert.match(treeSource, /<output>Always<\/output>/)
  assert.match(treeSource, /entry edge must not contain conditions|edge\.kind === "transition" \? this\.conditionFields/)
})

test("Animation Parameters have inline and transactional popup editors", () => {
  assert.equal(demoConfig.ui.views["view-animation-parameters"].internal, true)
  assert.match(treeSource, /data-element="animation-parameters-inspector"/)
  assert.match(treeSource, /tag: "view-animation-parameters"/)
  assert.match(treeSource, /animationParameterReferenceCounts\(this\.animationTree\)/)
  assert.match(popupSource, /parameters: structuredClone\(this\.parameters\)/)
  assert.match(popupSource, /data-action="cancel"/)
  assert.match(popupSource, /setCustomValidity\(message\)/)
  assert.match(popupSource, /classList\.add\("danger"\)/)
})

test("conditioned transition arrowheads use a separate configured color", () => {
  assert.deepEqual(demoConfig.ui.views["view-animation-tree"].config.renderer.theme.edgeConditionSymbol, [0.9607843137, 0.6509803922, 0.137254902, 1])
  assert.match(rendererSource, /conditioned \? this\.config\.theme\.edgeConditionSymbol : this\.config\.theme\.edgeSymbol/)
})
