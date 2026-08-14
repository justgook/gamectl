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
  assert.match(source, /this\.activeGroupPath\.forEach\(\(groupId, index\) => \{[\s\S]*?id: `group:\$\{index\}`[\s\S]*?icon: "account_tree"/)
  assert.match(source, /breadcrumbs\.addEventListener\("navigate", \(event\) => this\.navigateToBreadcrumb\(event\.detail\.id\)\)/)
})

test("editing a Group Node navigates into its child graph", () => {
  assert.match(source, /if \(node\.kind === NG_NODE_KINDS\.GROUP\) \{\s*this\.navigateToGroupPath\(\[\.\.\.this\.activeGroupPath, node\.id\]\)/)
})

test("editing with no node selected inside a Group renames the active Group", () => {
  assert.match(source, /if \(this\.selectedNodeIds\.size === 0 && this\.activeGroupPath\.length > 0\) return this\.showRenameActiveGroupPopup\(\)/)
  assert.match(source, /async showRenameActiveGroupPopup\(\)[\s\S]*?group\.name = payload\.draft\.name\.trim\(\)[\s\S]*?this\.syncBreadcrumbs\(\)[\s\S]*?this\.recordEdit\("rename Group", before\)/)
  assert.match(source, /editButton\.disabled = !hasNodeSelection && this\.activeGroupPath\.length === 0/)
})

test("Graph Input and Graph Output node types are offered only inside groups", () => {
  assert.match(nodeEditorSource, /this\.popupProps\.allowGraphBoundaryNodes \? `<option value="input"[\s\S]*?<option value="output"/)
  assert.match(source, /allowGraphBoundaryNodes: this\.activeGroupPath\.length > 0/)
})

test("view-ng exposes Import, Export, and Make Inline Group actions", () => {
  assert.match(source, /data-action="import-group"/)
  assert.match(source, /data-action="export-group"/)
  assert.match(source, /data-action="make-inline"/)
  assert.match(source, /async importLinkedGroup\(\)/)
  assert.match(source, /async exportSelectedGroup\(\)/)
  assert.match(source, /makeSelectedGroupInline\(\)/)
})

test("view-ng saves linked dependencies before their parents and the root graph", () => {
  assert.match(source, /async save\(\) \{[\s\S]*?await this\.saveLinkedGraphs\(\)[\s\S]*?await this\.saveToPath\(this\.graphPath/)
  assert.match(source, /for \(const childPath of this\.linkedPathsInGraph\(graph\)\) await savePath\(childPath\)[\s\S]*?saveDocumentToPath\(path, serializeNgGroupGraphDocument\(graph\)\)/)
})

test("linked hydration swaps the per-view working set only after every file loads", () => {
  assert.match(source, /async hydrateLinkedGraphs\(rootGraph\) \{\s*const hydrated = new Map\(\)[\s\S]*?await this\.loadLinkedGraphFS\(path, \[\], hydrated\)[\s\S]*?this\.linkedGraphs = hydrated/)
})

test("Group Export rejects root overwrite and export-path cycles", () => {
  assert.match(source, /Group export cannot overwrite the root graph document/)
  assert.match(source, /!this\.graphLinksTo\(group\.childGraph, path\)/)
})

test("New and Save As cannot overwrite a loaded linked Group document", () => {
  assert.match(source, /assertRootSavePathAvailable\(path\)/)
  assert.match(source, /root graph path conflicts with linked Group document/)
  assert.match(source, /new graph requires selected path"\)\s*this\.assertRootSavePathAvailable\(payload\.path\)/)
  assert.match(source, /save-as requires selected path"\)\s*this\.assertRootSavePathAvailable\(payload\.path\)/)
})
