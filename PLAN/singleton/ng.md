# ng

- kind: `singleton`
- status: `requires-clarification`
- source: `plugins/ng`

## Description
Project node-graph runtime. The current code already separates a fairly rich graph/runtime API from the browser editor, but the execution model still depends on a view-local load path and browser host callbacks.

## Current Observations
- `ng` is registered in the browser plugin table with `scope='view'`.
- `cmd/browser/views/view-nodegraph2.js` directly loads `ng` via `pluginManager.load(...)` and wires browser host imports such as `ng_on_node_changed`, `ng_on_goal_reached`, `ng_on_run_event`, and `ng_host_resolve`.
- The plugin exports a substantial graph/runtime API (`ng_init`, graph mutation calls, run calls, state inspection calls) plus a CLI-safe `run` export.
- `view-nodegraph2` also uses routed calls to other plugins like `sql` and `fs`, and can call `window.pluginManager.call('ng', 'run', ...)` for saved graph batch execution.

## Clarifications
- The likely singleton target is the **runtime/execution service**, while the node editor remains a separate `view` plugin.
- The biggest unresolved issue is graph ownership:
  - one singleton runtime holding one active graph
  - one singleton runtime managing multiple named graphs/documents
  - or a singleton execution service plus separate document/storage service
- Host resolution callbacks should eventually become explicit plugin contracts where possible, especially for storage/service calls.

## Notes
- Today `ng` is not just "some project plugin"; it is already a major architectural test case for graph editing, execution, and host/plugin boundaries.
- This file tracks the desired long-term singleton/runtime shape.
- Current legacy instance usage is tracked in `PLAN/instance/ng.md`.

## Open Questions
- What is the intended stable identity of a graph document: in-memory singleton state, named saved graph, or externally stored graph payload?
- Which host callbacks are truly runtime requirements, and which should be replaced with normal plugin routing?
- Does the long-term execution model need background/worker execution separate from the editor-facing state model?

## Todo
- [ ] requires clarification
- [ ] confirm whether this plugin already fits the singleton target model
- [ ] document current API surface
- [ ] decide whether any migration work is needed
