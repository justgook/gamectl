# layout

- kind: `instance`
- status: `legacy`
- source: `cmd/browser/views/view-layout.js`

## Description
Legacy instance-style layout runtime loaded from a browser view. This is a strong candidate for replacement by a browser service plugin and/or first-class `view` plugin integration.

## Migration Target
Likely replacement shape:

- browser-facing layout behavior exposed as `view` plugin and/or browser service plugin
- avoid direct `pluginManager.load(...)` instance boot in the view
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
