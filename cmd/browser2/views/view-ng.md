# view-ng Rules

This file records the intended rules for the future `cmd/browser2/views/view-ng.js` implementation.

`view-ng.js` does not need to preserve legacy `cmd/browser/views/view-nodegraph2.js` runtime ownership patterns.

## Core Rules

1. `view-ng.js` is a **browser2 fresh-start view**.
2. It should target `plugins/ng2/`, not the legacy instance-owned `ng` flow.
3. It must not instantiate its own WASM runtime.
4. It must not own a private worker/runtime.
5. It must not recreate `pluginManager.load(...)`-style per-view runtime ownership.
6. It should bind to a **global worker-side** `ng2` plugin.
7. It should operate on an explicit **graph/document handle**.
8. It should follow `cmd/browser2/VIEW_RULES.md`.
9. It should use strict fail-fast behavior for required internal state.
10. It should not add legacy compatibility behavior for old browser view contracts.

## Expected Responsibilities

`view-ng.js` should own only browser/editor concerns such as:
- rendering
- camera / zoom / pan
- selection
- drag / connect gestures
- header controls
- popups/forms
- keybindings
- mapping user actions to explicit `ng2` calls

## Current Migration Notes

The browser2 view now carries over the legacy header control surface from `view-nodegraph2.js`:
- run
- add
- save
- load
- reset
- clear
- edit
- delete
- zoom in/out/fit
- auto-arrange
- refresh

Current state:
- add/edit/delete are implemented as view-local sample-graph UI actions
- run is wired to `ng2.ng_run` for `graph-source="ng2"`
- open now reuses `view-sql` chooser against `ng2_graph_storage`
- add/edit now share a single popup view:
  - `view-ng-node`
  - controlled by `mode: 'create' | 'edit'`
- popup flows should use `runtime.call('ui.popup', ...)`, not direct `popup-manager` access
- save remains a placeholder until `ng2.ng_graph_save` exists
- reset/clear/auto-arrange are view-side editor actions
- node interaction now supports:
  - single selection
  - background deselection
  - marquee selection
  - node dragging / moving
  - active node tracking within the current selection
  - port hover highlighting
  - edge hover highlighting
  - active connection drag preview
  - valid vs invalid connection target highlighting
  - port-to-port connect / disconnect interaction scaffolding
  - edge-side reconnect initiation
  - footer interaction status updates for hover / selection / connection drag
- on `graph-source="sample"`, connect/disconnect mutates the local sample graph
- on `graph-source="ng2"`, connect/disconnect attempts `ng_input_connect` / `ng_input_disconnect` and currently surfaces backend warnings until those methods are implemented

## Responsibilities That Must Stay Out Of The View

The view must not own:
- WASM plugin bootstrapping
- graph persistence logic via direct SQL ownership
- code loading via direct host glue
- hidden host resolve callbacks
- implicit active-graph runtime state
- ad-hoc browser-only runtime bridges when a plugin contract should exist

## Binding Model

The intended model is:
- browser2 registers `ng2` as a global worker-side WASM plugin
- `view-ng.js` creates/opens one graph handle through `ng2`
- `view-ng.js` issues explicit handle-based calls to mutate/run the graph
- `view-ng.js` reads shared memory from `ng2` for rendering/inspection when appropriate

## Fresh-Start Rule

If the old implementation shape conflicts with the browser2 target architecture, prefer the browser2 target architecture and break the old shape.
