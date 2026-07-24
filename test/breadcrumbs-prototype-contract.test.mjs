import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const layoutSource = await readFile(new URL("../ui-plugins/layout.js", import.meta.url), "utf8")
const widgetSource = await readFile(new URL("../packages/widgets/breadcrumbs.js", import.meta.url), "utf8")

test("Area exposes header controls without a separate header navigation slot", () => {
  assert.doesNotMatch(layoutSource, /header-navigation/)
  assert.match(layoutSource, /<slot name="header-controls" part="header-controls"><\/slot>/)
})

test("breadcrumb widget remains explicitly provisional until guide approval", () => {
  assert.match(widgetSource, /^\/\/ PROTOTYPE:/)
  assert.match(widgetSource, /CustomEvent\("navigate"/)
})

test("breadcrumb widget is the navigation landmark with flat children", () => {
  assert.doesNotMatch(widgetSource, /<\/?(?:nav|ol|li)(?:\s|>)/)
  assert.match(widgetSource, /this\.setAttribute\("role", "navigation"\)/)
  assert.match(widgetSource, /this\.setAttribute\("aria-label", "Breadcrumb"\)/)
  assert.match(widgetSource, /<button type="button" data-index=/)
  assert.match(widgetSource, /<output aria-current="page">/)
})
