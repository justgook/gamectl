# view-nodegraph2

- kind: `view`
- status: `migration-needed`
- source: `cmd/browser/views/view-nodegraph2.js`

## Description
High-priority browser view for migration. Today it contains custom runtime handling and directly loads `ng` as an instance-style plugin. The target direction is to make this a first-class `view` plugin managed through `pluginManager`.

## Current Observations
- The browser view itself is already in the dynamic `views` registry as `nodegraph2`.
- The class exposes normal view metadata (`displayName`, category, keybindings), so it already looks like a view-level unit from the browser side.
- It directly loads `ng` and keeps direct WASM memory/API access for graph editing and rendering.
- It also talks to routed services such as `sql` and `fs`, including persistence for saved graphs/templates.
- `ng_host_resolve` currently mixes concerns: source lookup, service resolution, stored node values, and graph lookup.

## Migration Target
- browser rendering/editor behavior stays in a `view` plugin
- heavy runtime work moves away from direct main-thread instance loading
- cross-plugin communication uses routed plugin calls / notifications
- shared state can be added where it improves responsiveness without special-case host APIs
- current fresh-start backend target for browser2 work is `plugins/ng2`
- `plugins/ng2` should expose handle-based graph/document APIs with no implicit active graph
- `ng_host_resolve` should be removed and replaced by explicit plugin-to-plugin calls inside `ng2`

## Clarifications
- The browser view boundary is relatively clear: canvas/editor UX, selection, editing gestures, popups, and keybindings should stay view-local.
- The less clear boundary is runtime/document ownership: what state should stay in the view for responsiveness versus move into a routed `ng` service.
- `ng_host_resolve` should be decomposed into named contracts where possible instead of one broad host callback.

## Notes
- This file tracks the **browser view side** of the migration.
- The legacy runtime-instantiation side is tracked in `PLAN/instance/ng.md`.

## Todo
- [ ] define the plugin identity and callable surface for this view
- [ ] identify what should stay view-local vs move into singleton services
- [ ] define notifications / state exposure expected from runtime side
- [ ] document migration from current custom view boot path
- [ ] requires clarification
