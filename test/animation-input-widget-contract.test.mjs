import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const treeSource = await readFile(new URL("../views/view-animation-tree.js", import.meta.url), "utf8")
const widgetSource = await readFile(new URL("../packages/widgets/inputs/animation.js", import.meta.url), "utf8")
const selectorSource = await readFile(new URL("../views/view-animation-selector.js", import.meta.url), "utf8")
const demoConfig = JSON.parse(await readFile(new URL("../examples/demo/gams.json", import.meta.url), "utf8"))

test("animation tree inspector inputs are configured by predefined target path", () => {
  const inputs = demoConfig.ui.views["view-animation-tree"].config.inputs
  assert.equal(inputs.animation, "<widget-input-animation></widget-input-animation>")
  assert.match(treeSource, /const INSPECTOR_INPUT_TARGETS = new Set/)
  assert.match(treeSource, /INSPECTOR_INPUT_TARGETS\.has\(target\)/)
  assert.match(treeSource, /await import\(new URL\(`\/widgets\/inputs\/\$\{moduleName\}\.js`/)
  assert.match(treeSource, /input\.value = structuredClone\(this\.blendNodeValue/)
  assert.match(treeSource, /const animationInspector = this\.blendNodeInspector\(node\.animationNode\)/)
})

test("animation input widget publishes structured Aseprite selectors", () => {
  assert.match(widgetSource, /validateAnimationSelector\(value/)
  assert.match(widgetSource, /input\.type = "text"/)
  assert.match(widgetSource, /input\.value = JSON\.stringify\(this\._value\)/)
  assert.match(widgetSource, /icon\.textContent = "edit"/)
  assert.match(widgetSource, /group\.setAttribute\("role", "buttongroup"\)/)
  assert.match(widgetSource, /group\.append\(input, button\)/)
  assert.match(widgetSource, /tag: "view-animation-selector"/)
  assert.match(widgetSource, /new Event\("change", \{ bubbles: true \}\)/)
  assert.match(widgetSource, /unwrap\([\s\S]*ui\.popup\.open/, "configured view popups return WIT result objects")
  assert.match(selectorSource, /import "\/widgets\/inputs\/file\.js"/)
  assert.match(selectorSource, /<widget-input-file data-field="url" filter="\*\.aseprite,\*\.ase"><\/widget-input-file>/)
})

test("animation selector loads layer and tag names from the selected Aseprite file", () => {
  assert.equal(demoConfig.ui.views["view-animation-selector"].internal, true)
  assert.match(selectorSource, /aseprite\/aseprite::layers/)
  assert.match(selectorSource, /aseprite\/aseprite::tags/)
  assert.match(selectorSource, /runtime\.releaseResource\(documentResource\)/)
  assert.match(selectorSource, /value = \{ url: this\.loadedUrl, layer: this\.layerElement\.value, tag: this\.tagElement\.value \}/)
  assert.match(selectorSource, /all\.value = "\*"/)
})
