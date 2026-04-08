# view-nodegraph2

- kind: `view`
- status: `migration-needed`
- source: `cmd/browser/views/view-nodegraph2.js`

## Description
High-priority browser view for migration. Today it contains custom runtime handling and directly loads `ng` as an instance-style plugin. The target direction is to make this a first-class `view` plugin managed through `pluginManager`.

## Migration Target
- browser rendering/editor behavior stays in a `view` plugin
- heavy runtime work moves away from direct main-thread instance loading
- cross-plugin communication uses routed plugin calls / notifications
- shared state can be added where it improves responsiveness without special-case host APIs

## Notes
- This file tracks the **browser view side** of the migration.
- The legacy runtime-instantiation side is tracked in `PLAN/instance/ng.md`.

## Todo
- [ ] define the plugin identity and callable surface for this view
- [ ] identify what should stay view-local vs move into singleton services
- [ ] define notifications / state exposure expected from runtime side
- [ ] document migration from current custom view boot path
- [ ] requires clarification
