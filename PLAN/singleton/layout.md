# layout

- kind: `singleton`
- status: `requires-clarification`
- source: `plugins/layout`

## Description
Potential long-term routed layout service. The current WASM plugin is already a headless geometry/state engine; the unresolved part is how much of browser layout ownership should live in that service versus the DOM shell around it.

## Current Observations
- `layout` is registered in the browser plugin table with `scope='view'`.
- `cmd/browser/views/view-layout.js` directly loads `layout` with `pluginManager.load(...)` and passes shared memory through `env.memory`.
- The WASM API is geometry-oriented, not DOM-oriented: `init_screen`, `resize_screen`, `move_handle`, `move_corner`, `try_corner`, `set_area_content`, `set_handle_content`, `get_info_ptr`.
- `LayoutManager` is currently bootstrapped as browser infrastructure in `cmd/browser/app.js` via `customElements.define('layout-manager', LayoutManager)` rather than through the normal `views` table.

## Clarifications
- The likely singleton target is the **headless layout model/service**, not the DOM chrome itself.
- A split model is currently the safest assumption:
  - `layout` singleton/browser-service plugin owns panel geometry, splits, handles, and routed layout operations
  - browser view/shell code owns actual DOM creation, chrome, focus, and view embedding
- If other plugins need to open/replace/move panels, they should probably call a routed layout contract instead of touching DOM helpers directly.

## Notes
- This file tracks the possible **target singleton/service shape**.
- Current legacy usage is tracked in `PLAN/instance/layout.md`.
- Browser rendering side is tracked in `PLAN/view/view-layout.md`.

## Open Questions
- Should `layout` remain a WASM plugin on the main thread, or become a JS browser service plugin that preserves the same routed API?
- What is the minimal stable contract other plugins need: open panel, split panel, replace view, focus panel, read snapshot?
- How much state should be queryable through routing versus observed through shared state/events?

## Current browser2 migration note
- a fresh-start `plugins/layout2` PDK-style wrapper now exists as an initial singleton migration step
- it copies the current `plugins/layout` geometry engine and exposes PDK-callable methods with the same core operation names
- current wrapper methods: `init_screen`, `resize_screen`, `move_handle`, `move_corner`, `try_corner`, `set_area_content`, `set_handle_content`, `get_info_ptr`, `snapshot`, `get_info_size`, `info`
- this is an incremental migration step, not yet the final browser2 layout contract

## Todo
- [ ] decide whether layout should expose a singleton service contract
- [ ] define the boundary between layout service responsibilities and browser view responsibilities
- [ ] document which `layout2` wrapper methods survive unchanged versus which become higher-level commands
- [ ] connect `layout2` into browser2 worker runtime
- [ ] move legacy instance-only browser layout usage off direct wasm loading
