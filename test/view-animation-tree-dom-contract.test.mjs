import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("../views/view-animation-tree.js", import.meta.url), "utf8")

test("animation tree does not shadow the DOM nodeName property", () => {
  assert.doesNotMatch(
    source,
    /^\s+nodeName\s*\(/m,
    "custom elements must preserve Node.nodeName as a string for host DOM code",
  )
})

test("breadcrumbs are a closed first child of header controls", () => {
  assert.match(
    source,
    /controls\.innerHTML = `[\s\S]*?<widget-breadcrumbs data-element="breadcrumbs"><\/widget-breadcrumbs>\s*<div role="buttongroup"/,
    "custom elements cannot use self-closing HTML syntax because following controls become their children",
  )
})

test("active animation node changes refresh header breadcrumbs", () => {
  for (const method of ["navigateToAnimationNode\\(nodeId\\)", "restoreSnapshot\\(snapshot\\)"]) {
    assert.match(
      source,
      new RegExp(`${method} \\{[\\s\\S]*?queryHeaderControl\\('\\[data-element="breadcrumbs"\\]'\\)[\\s\\S]*?breadcrumbs\\.items = this\\.breadcrumbItems\\(\\)`),
    )
  }
})
