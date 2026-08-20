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

test("view-ng breadcrumbs reflect root and nested child-graph owners", () => {
  assert.match(source, /breadcrumbItems\(\) \{[\s\S]*?id: "root", label: this\.graphName, icon: "schema"/)
  assert.match(source, /this\.activeGroupPath\.forEach\(\(groupId, index\) => \{[\s\S]*?id: `group:\$\{index\}`/)
  assert.match(source, /group\.kind === NG_NODE_KINDS\.FOR_EACH \? "repeat" : "account_tree"/)
  assert.match(source, /breadcrumbs\.addEventListener\("navigate", \(event\) => this\.navigateToBreadcrumb\(event\.detail\.id\)\)/)
})

test("editing Group and For Each Nodes navigates into their child graphs", () => {
  assert.match(source, /if \(node\.kind === NG_NODE_KINDS\.GROUP \|\| node\.kind === NG_NODE_KINDS\.FOR_EACH\) \{\s*this\.navigateToGroupPath\(\[\.\.\.this\.activeGroupPath, node\.id\]\)/)
})

test("editing with no selection renames the active child-graph owner", () => {
  assert.match(source, /if \(this\.selectedNodeIds\.size === 0 && this\.activeGroupPath\.length > 0\) return this\.showRenameActiveGroupPopup\(\)/)
  assert.match(source, /async showRenameActiveGroupPopup\(\)[\s\S]*?group\.name = payload\.draft\.name\.trim\(\)[\s\S]*?this\.syncBreadcrumbs\(\)[\s\S]*?this\.recordEdit\(`rename \$\{label\}`, before\)/)
  assert.match(source, /editButton\.disabled = !hasNodeSelection && this\.activeGroupPath\.length === 0/)
})

test("boundary node types follow the active child-graph owner", () => {
  assert.match(nodeEditorSource, /childGraphOwnerKind[\s\S]*?<option value="for-each"/)
  assert.match(nodeEditorSource, /<option value="for-each-input"[\s\S]*?<option value="for-each-shared-input"[\s\S]*?<option value="for-each-get-var"[\s\S]*?<option value="for-each-set-var"[\s\S]*?<option value="iteration-control"/)
  assert.match(source, /childGraphOwnerKind: this\.activeGroupPath\.length \? this\.activeGroupNode\(\)\.kind : 0/)
})

test("GetVar derives paired outputs from its editable inputs", () => {
  assert.match(nodeEditorSource, /this\.draft\.kind === NG\.NODE_FOR_EACH_GET_VAR[\s\S]*?this\.draft\.outputs = this\.draft\.inputs\.map/)
  assert.match(source, /kind === NG_NODE_KINDS\.FOR_EACH_GET_VAR[\s\S]*?draftInputs\.map/)
})

test("new composite presets receive fresh child identities", () => {
  assert.match(source, /freshChildGraph = \(childGraph\) => cloneNgNodesWithNewIds\(childGraph, Number\(nodeId\) \+ 1\)\.nodes/)
  assert.match(source, /existing\?\.childGraph \|\| freshChildGraph/)
})

test("linked Group presets preserve storage and hydrate their authoritative document", () => {
  assert.match(nodeEditorSource, /this\.draft\.storage = payload\.kind === NG\.NODE_GROUP \? structuredClone\(payload\.storage\) : undefined/)
  assert.match(source, /await this\.loadLinkedGraphFS\(path, \[\], hydrated\)/)
  assert.match(source, /this\.assertLinkAllowedInActiveDocument\(path\)/)
  assert.match(source, /syncNgGroupBoundary\(node, raw, \{ resolveLinked: this\.linkedResolver\(\) \}\)/)
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

test("pasting linked Groups hydrates their documents before committing the edit", () => {
  assert.match(source, /async pasteNodes\(text, anchor\) \{[\s\S]*?const linkedPaths = this\.linkedPathsInGraph\(source\)[\s\S]*?await this\.loadLinkedGraphFS\(path, \[\], hydrated\)[\s\S]*?this\.linkedGraphs = hydrated[\s\S]*?this\.replaceActiveGraph\(raw/)
  assert.match(source, /async pasteNodes\(text, anchor\) \{[\s\S]*?catch \(error\) \{\s*this\.linkedGraphs = previousLinkedGraphs\s*this\.restoreSnapshot\(before\)/)
})

test("Group Export rejects root overwrite and export-path cycles", () => {
  assert.match(source, /Group export cannot overwrite the root graph document/)
  assert.match(source, /!this\.graphLinksTo\(group\.childGraph, path\)/)
})

test("view-ng always shows a completion toast after a pipeline run", () => {
  assert.match(
    source,
    /this\._setStatus\("graph run completed", "success"\)[\s\S]*?await runtime\.call\("ui\.toast\.success", \{ message: `Pipeline '\$\{this\.graphName\}' completed\$\{goalResult\}` \}\)/,
  )
})

test("New and Save As cannot overwrite a loaded linked Group document", () => {
  assert.match(source, /assertRootSavePathAvailable\(path\)/)
  assert.match(source, /root graph path conflicts with linked Group document/)
  assert.match(source, /new graph requires selected path"\)\s*this\.assertRootSavePathAvailable\(payload\.path\)/)
  assert.match(source, /save-as requires selected path"\)\s*this\.assertRootSavePathAvailable\(payload\.path\)/)
})
