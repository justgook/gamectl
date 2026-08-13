import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("../views/view-ng.js", import.meta.url), "utf8")
const nodeEditorSource = await readFile(new URL("../views/view-ng-node.js", import.meta.url), "utf8")

test("view-ng places breadcrumbs first in its header controls", () => {
  assert.match(source, /import "\/widgets\/breadcrumbs\.js"/)
  assert.match(
    source,
    /controls\.innerHTML = `[\s\S]*?<widget-breadcrumbs data-element="breadcrumbs"><\/widget-breadcrumbs>\s*<div role="buttongroup" data-element="file-actions">/,
  )
})

test("view-ng breadcrumbs reflect the root graph and active Group Node path", () => {
  assert.match(source, /breadcrumbItems\(\) \{[\s\S]*?id: "root", label: this\.graphName, icon: "schema"/)
  assert.match(source, /for \(const groupId of this\.activeGroupPath\)[\s\S]*?icon: "account_tree"/)
  assert.match(source, /breadcrumbs\.addEventListener\("navigate", \(event\) => this\.navigateToBreadcrumb\(event\.detail\.id\)\)/)
})

test("editing a Group Node navigates into its child graph", () => {
  assert.match(source, /if \(node\.kind === NG_NODE_KINDS\.GROUP\) \{\s*this\.navigateToGroupPath\(\[\.\.\.this\.activeGroupPath, node\.id\]\)/)
})

test("Graph Input and Graph Output node types are offered only inside groups", () => {
  assert.match(nodeEditorSource, /this\.popupProps\.allowGraphBoundaryNodes \? `<option value="input"[\s\S]*?<option value="output"/)
  assert.match(source, /allowGraphBoundaryNodes: this\.activeGroupPath\.length > 0/)
})
