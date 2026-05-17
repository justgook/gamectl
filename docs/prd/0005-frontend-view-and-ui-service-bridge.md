# Frontend views and UI Service bridge

## Status

Draft

## Source material

- `docs/legacy/docs/PLAN/app-runtime-component-ui-spec.md`
- `docs/prd/0002-runtime-plugin-manager.md`
- `docs/prd/0003-project-config.md`
- `docs/contexts/core-runtime/CONTEXT.md`
- `docs/contexts/project-composition/CONTEXT.md`

## Problem

GAMS needs browser-host behavior to move out of host-specific callbacks and into Project Units. Dynamic view instances and singleton GUI services need explicit runtime boundaries so WASM components can call them without hard-coding Tauri/browser details.

## Goals

- Model frontend-rendered views as View Plugins/Project Units managed by Project Config.
- Model singleton GUI-host services as UI Services, not legacy `ui-plugins`.
- Keep hosts thin: hosts load Project Config and provide runtime bridges, but do not own project-specific behavior.
- Support dynamic multi-instance view calls through `gams:runtime/runtime.call(view-id, string)` until typed view calls are specified.
- Plan WIT-shaped UI Service registration so WASM components can import UI Service interfaces.

## Non-goals

- Do not specify each concrete view's UI rules here.
- Do not replace current `runtime.invoke(...)` here; wRPC is tracked separately.
- Do not require UI Services to work in non-GUI hosts such as future CLI.

## Requirements

- View entries are Project Units declared under top-level `views` in `gams.json`.
- UI Service entries are Project Units declared under top-level `ui-services` in `gams.json`.
- Dynamic view instances are addressed by `view-id`.
- WASM-to-view calls use `gams:runtime/runtime.call(target, args)` returning `result<string, string>` until a future PRD specifies typed calls.
- UI Services are singleton GUI-host services that may later register WIT-shaped provider functions.
- Hosts that do not support GUI Project Units must fail clearly when Project Config requires them.

## Acceptance criteria

- Legacy `UI plugins` terminology is replaced with **UI Service** in current docs.
- Runtime PRD points at this PRD for frontend view/UI Service bridge details.
- Browser/view-specific legacy files remain separate source material for later view PRDs.

## Open questions

- What is the exact JS registration API for UI Services?
- Should UI Services register raw WIT text plus functions, or package metadata plus schemas?
- Should dynamic view calls remain string-based after wRPC frontend/backend calls are proven?

## Related ADRs

- `docs/adr/0003-project-config-owns-composition.md`
