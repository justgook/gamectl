import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const propsSource = await readFile(new URL("../views/view-props.js", import.meta.url), "utf8")
const worldSource = await readFile(new URL("../views/view-world.js", import.meta.url), "utf8")
const enumSource = await readFile(new URL("../packages/widgets/inputs/enum.js", import.meta.url), "utf8")
const fileSource = await readFile(new URL("../packages/widgets/inputs/file.js", import.meta.url), "utf8")
const guideSource = await readFile(new URL("../docs/reference/gams-view-development-guide.md", import.meta.url), "utf8")
const demoConfig = JSON.parse(await readFile(new URL("../examples/demo/gams.json", import.meta.url), "utf8"))

test("custom input widgets use the shared input-widget contract", () => {
  assert.match(guideSource, /`packages\/widgets\/inputs\/`/)
  assert.match(guideSource, /names must start with `widget-input-`/)
  assert.match(propsSource, /\^widget-input-/)
  assert.match(propsSource, /new URL\(`\/widgets\/inputs\/\$\{moduleName\}\.js`, location\.origin\)\.href/)
  assert.match(propsSource, /await import\(moduleUrl\)/)
  assert.match(propsSource, /const registeredEditor = document\.createElement\(tag\)/)
  assert.match(propsSource, /"value" in registeredEditor/)
})

test("view-props replaces the value editor when its property name changes", () => {
  assert.match(propsSource, /keyInput\.addEventListener\("input"/)
  assert.match(propsSource, /this\.mountValueEditor\(valueCell, keyInput\.value\.trim\(\), currentValue\)/)
})

test("view-world configures the integer enum input for layer", () => {
  const config = demoConfig.ui.views["view-world"].config
  assert.equal(
    config.inputs.layer,
    '<widget-input-enum type="int" front="1" back="3" middle="2"></widget-input-enum>',
  )
  assert.match(worldSource, /inputs: this\.propertyInputs/)
  assert.match(enumSource, /this\._value = value/)
  assert.match(enumSource, /if \(!this\.selectElement\) return/)
  assert.match(enumSource, /customElements\.define\("widget-input-enum"/)
})

test("file input opens view-files chooser and publishes its selected path", () => {
  const inputs = demoConfig.ui.views["view-world"].config.inputs
  assert.match(inputs.url, /^<widget-input-file /)
  assert.match(inputs.tilemap, /^<widget-input-file /)
  assert.match(fileSource, /tag: "view-files"/)
  assert.match(fileSource, /mode: "chooser"/)
  assert.match(fileSource, /this\.value = payload\.selection\.path/)
  assert.match(fileSource, /group\.setAttribute\("role", "buttongroup"\)/)
  assert.match(fileSource, /group\.append\(input, button\)/)
  assert.match(fileSource, /new Event\("input", \{ bubbles: true \}\)/)
  assert.match(fileSource, /customElements\.define\("widget-input-file"/)
})
