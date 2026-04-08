# view-layout

- kind: `view`
- status: `migration-needed`
- source: `cmd/browser/views/view-layout.js`

## Description
Browser layout view and likely central example of a browser-side service/view plugin. This area will help define how main-thread views are registered and called through `pluginManager`.

## Migration Target
- become first-class `pluginManager`-managed `view` plugin
- expose only the minimal routed surface needed by other plugins
- avoid special-case host wiring where possible

## Notes
- This file tracks the browser view side.
- Related legacy and target discussion also exists in `PLAN/instance/layout.md` and `PLAN/singleton/layout.md`.

## Todo
- [ ] define the plugin identity and scope for layout in browser
- [ ] define callable functions / notifications expected from layout
- [ ] decide what state should stay internal vs be exposed through routing/shared state
- [ ] document migration from current custom view handling
- [ ] requires clarification
