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
  const method = source.match(/bindBlendNodeInspector\(node, graphNode = node\) \{[\s\S]*?\n    renderNodeGraphInspector/)
  assert.ok(method, "bindBlendNodeInspector method must be present")
  assert.doesNotMatch(method[0], /addEventListener\("focus"/, "blend inspector snapshots must not depend on focus events")
  assert.equal(
    [...method[0].matchAll(/addEventListener\("change", \(\) => \{\s*const before = this\.captureSnapshot\(\)/g)].length,
    2,
    "switch input names and node values must capture snapshots when their change begins",
  )
})

test("Animation state names remain empty while their tag supplies the canvas label", () => {
  const inspector = source.match(/const nameInput = this\.inspectorElement\.querySelector\('\[data-field="name"\]'\)[\s\S]*?this\.bindBlendNodeInspector\(node\.animationNode, node\)/)
  assert.ok(inspector, "state name inspector binding must be present")
  const inputHandler = inspector[0].match(/nameInput\.addEventListener\("input", \(\) => \{[\s\S]*?\n        \}\)/)
  assert.ok(inputHandler, "state name input handler must be present")
  assert.match(inputHandler[0], /node\.animationNode\.name = name\s*node\.name = animationNodeDisplayName\(node\.animationNode\)/)
  assert.match(inspector[0], /if \(!name && node\.animationNode\.kind !== ANIMATION_NODE_KINDS\.ANIMATION\)/)
  assert.match(source, /data-field="name" value="\$\{this\.escapeAttribute\(node\.animationNode\.name\)\}"[\s\S]*?placeholder="\$\{this\.escapeAttribute\(node\.animationNode\.animation\.tag\)\}"/)
})

test("clear selection only navigates to the parent animation node when nothing is selected", () => {
  assert.match(
    source,
    /clearSelection\(\) \{[\s\S]*?const hasSelection = this\.selectedNodeIds\.size > 0 \|\| this\.selectedEdgeId !== null\s*if \(!hasSelection && this\.activeNodePath\.length > 1\) \{[\s\S]*?this\.navigateToAnimationNode\(parentNodeId\)[\s\S]*?return true[\s\S]*?this\.setNodeSelection\(\[\]\)/,
    "Escape should clear a node or edge selection before moving up one breadcrumb layer",
  )
})

test("Animation Tree persistence actions are enabled and bound", () => {
  for (const action of ["new", "open", "save", "save-as"]) {
    assert.match(source, new RegExp(`data-action="${action}"(?![^>]* disabled)[^>]*>`))
  }
  assert.match(source, /data-action="reload"[^>]* disabled/)
  for (const method of ["new", "open", "save", "saveAs", "reload"]) {
    assert.match(source, new RegExp(`async ${method}\\(\\)`))
  }
  assert.match(source, /static get observedAttributes\(\) \{\s*return \["data-source"\]/)
})

test("restored data-source is adopted once after connection setup", () => {
  assert.match(source, /attributeChangedCallback\(name, oldValue, newValue\) \{[\s\S]*?this\.animationTreePath = path[\s\S]*?if \(path && !this\._connecting\) void this\.loadDataSource\(path\)/)
  assert.match(source, /connectedCallback\(\) \{[\s\S]*?this\._connecting = true[\s\S]*?super\.connectedCallback\(\)\s*this\._connecting = false[\s\S]*?if \(this\.animationTreePath\) void this\.loadDataSource\(this\.animationTreePath\)/)
})

test("Animation Tree persistence uses direct JSON and transactional loads", () => {
  assert.match(source, /JSON\.stringify\(this\.animationTree, null, 2\)/)
  assert.match(source, /document = JSON\.parse\(source\)\s*validateAnimationTreeDocument\(document\)[\s\S]*?this\.replaceAnimationTree\(document\)/)
  assert.match(source, /if \(!this\.animationTreePath\) return this\.saveAs\(\)/)
  assert.match(source, /props: \{ mode: "saver", filter: "", defaultName: `\$\{this\.animationTree\.name\}\.anim\.json` \}/)
})

test("active animation node changes refresh header breadcrumbs", () => {
  for (const method of ["navigateToAnimationNode\\(nodeId\\)", "restoreSnapshot\\(snapshot\\)"]) {
    assert.match(
      source,
      new RegExp(`${method} \\{[\\s\\S]*?queryHeaderControl\\('\\[data-element="breadcrumbs"\\]'\\)[\\s\\S]*?breadcrumbs\\.items = this\\.breadcrumbItems\\(\\)`),
    )
  }
})
