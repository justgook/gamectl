# layout

- kind: `singleton`
- status: `requires-clarification`
- source: `plugins/layout`

## Description
Potential long-term routed layout service. Needs clarification on whether layout should end up as a pure singleton service, a browser-side view plugin, or a split model with service + view responsibilities.

## Notes
- This file tracks the possible **target singleton/service shape**.
- Current legacy usage is tracked in `PLAN/instance/layout.md`.
- Browser rendering side is tracked in `PLAN/view/view-layout.md`.

## Todo
- [ ] decide whether layout should expose a singleton service contract
- [ ] define the boundary between layout service responsibilities and browser view responsibilities
- [ ] document current API surface, if any, that should survive migration
- [ ] requires clarification
