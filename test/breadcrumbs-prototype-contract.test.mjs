import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const layoutSource = await readFile(new URL("../ui-plugins/layout.js", import.meta.url), "utf8")
const widgetSource = await readFile(new URL("../packages/widgets/breadcrumbs.js", import.meta.url), "utf8")

test("Area exposes provisional navigation separately from controls", () => {
  assert.match(layoutSource, /<slot name="header-navigation" part="header-navigation"><\/slot>/)
  assert.match(layoutSource, /<slot name="header-controls" part="header-controls"><\/slot>/)
})

test("breadcrumb widget remains explicitly provisional until guide approval", () => {
  assert.match(widgetSource, /^\/\/ PROTOTYPE:/)
  assert.match(widgetSource, /CustomEvent\("navigate"/)
})
