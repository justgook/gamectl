# layout

- kind: `instance`
- status: `legacy`
- source: `cmd/browser/views/view-layout.js`

## Description
Legacy instance-style layout runtime loaded from browser shell code. This is a strong candidate for replacement by a browser service plugin and/or first-class routed `view` integration.

## Current Observations
- `LayoutManager` loads `layout.wasm` directly with shared memory and keeps direct access to its snapshot structure.
- The runtime itself is headless and geometry-oriented, while DOM panel/view management stays in JS.
- `view-layout.js` currently behaves more like shell infrastructure than a normal entry in the user-facing view registry.

## Migration Target
Likely replacement shape:

- browser-facing layout behavior exposed as `view` plugin and/or browser service plugin
- avoid direct `pluginManager.load(...)` instance boot in the view/shell code
- make layout callable through normal plugin routing where useful

## Notes
- This file tracks the **current instance-style usage**.
- Related target discussion also lives in `PLAN/view/view-layout.md` and `PLAN/singleton/layout.md`.

## Todo
- [ ] confirm whether this instance usage must remain temporarily
- [ ] define whether layout should be a `view`, `singleton`, or split service
- [ ] identify a minimal callable plugin surface for layout
- [ ] define migration path away from direct `pluginManager.load(...)`
- [ ] requires clarification
