import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("../views/view-animation-tree.js", import.meta.url), "utf8")

test("animation tree leaves standard edit result wrapping to registerViewPlugin", () => {
  const methods = source.match(/createViewPluginMethods\(\) \{[\s\S]*?\n    \}/)
  assert.ok(methods, "createViewPluginMethods must be present")
  assert.doesNotMatch(methods[0], /\bedit\s*:/, "custom methods must not override the standard WIT-result-wrapped edit method")
})

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

test("blend inspector changes capture undo snapshots at the change transaction boundary", () => {
  const method = source.match(/bindBlendNodeInspector\(node\) \{[\s\S]*?\n    renderNodeGraphInspector/)
  assert.ok(method, "bindBlendNodeInspector method must be present")
  assert.doesNotMatch(method[0], /addEventListener\("focus"/, "blend inspector snapshots must not depend on focus events")
  assert.equal(
    [...method[0].matchAll(/addEventListener\("change", \(\) => \{\s*const before = this\.captureSnapshot\(\)/g)].length,
    2,
    "switch input names and node values must capture snapshots when their change begins",
  )
})

test("clear selection only navigates to the parent animation node when nothing is selected", () => {
  assert.match(
    source,
    /clearSelection\(\) \{[\s\S]*?const hasSelection = this\.selectedNodeIds\.size > 0 \|\| this\.selectedEdgeId !== null\s*if \(!hasSelection && this\.activeNodePath\.length > 1\) \{[\s\S]*?this\.navigateToAnimationNode\(parentNodeId\)[\s\S]*?return true[\s\S]*?this\.setNodeSelection\(\[\]\)/,
    "Escape should clear a node or edge selection before moving up one breadcrumb layer",
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
