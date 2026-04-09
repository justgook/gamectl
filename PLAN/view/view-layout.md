# view-layout

- kind: `view`
- status: `migration-needed`
- source: `cmd/browser/views/view-layout.js`

## Description
Browser layout shell and likely central example of a browser-side service/view boundary. This area will help define how main-thread UI infrastructure is registered and called through `pluginManager`.

## Current Observations
- `view-layout.js` is not currently listed in the dynamic `views` table; instead `LayoutManager` is registered directly from `cmd/browser/app.js`.
- The file owns DOM concerns such as chrome creation, corner/handle elements, view selection UI, and embedding other views.
- It also directly boots the `layout` WASM runtime and translates user interactions into runtime calls.

## Clarifications
- This file may not map cleanly to a normal end-user `view` plugin. Part of it is closer to browser shell infrastructure.
- The likely migration is a split where:
  - shell/view code remains browser-main-thread UI
  - routed layout state/manipulation moves behind a plugin contract
- The practical goal is to remove special-case boot/ownership rules, not necessarily to force every DOM helper into WASM.

## Notes
- This file tracks the browser view/shell side.
- Related legacy and target discussion also exists in `PLAN/instance/layout.md` and `PLAN/singleton/layout.md`.

## Todo
- [ ] define the plugin identity and scope for layout in browser
- [ ] define callable functions / notifications expected from layout
- [ ] decide what state should stay internal vs be exposed through routing/shared state
- [ ] document migration from current custom view handling
- [ ] requires clarification
