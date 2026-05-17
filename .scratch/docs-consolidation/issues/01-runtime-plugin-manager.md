# Convert runtime and plugin-manager legacy docs

Status: needs-info

## Source material

- `docs/legacy/docs/PLAN/PLAN.md`
- `docs/legacy/docs/PLAN/app-runtime-todo.md`
- `docs/legacy/docs/PLAN/app-runtime-wrpc.md`
- `docs/legacy/docs/PLAN/app-runtime-component-ui-spec.md`
- `docs/legacy/docs/PLAN/fs-runtime.md`
- `docs/legacy/docs/VERSION.md`
- `docs/legacy/CLI_SERVE.md`

## Expected output

- One or more PRDs under `docs/prd/` covering runtime/plugin-manager migration slices.
- ADRs only for settled hard-to-reverse runtime decisions.
- `CONTEXT.md` updates for resolved runtime vocabulary.
- Conversion links/status in `docs/legacy/INDEX.md`.

## Current output

- Draft PRD: `docs/prd/0002-runtime-plugin-manager.md`

## Comments

- Resolved: **Plugin Manager** remains the umbrella term. **Plugin Registration/Loading** and **Call Routing** are named responsibilities in `CONTEXT.md` and `docs/prd/0002-runtime-plugin-manager.md`.
- Resolved: `runtime.invoke(target, args)` remains the current compatibility API, not the frozen long-term frontend-to-plugin contract. Captured in `docs/adr/0002-runtime-invoke-is-compatibility-api.md`.
- Resolved: dev mode may hardcode base plugin loading, but long-term composition belongs to Project Config. Captured in `docs/adr/0003-project-config-owns-composition.md`.
- Resolved vocabulary: the configured thing that becomes a runnable tool is a **Project**.
