# Runtime and Plugin Manager migration

## Status

Draft

## Source material

- `docs/legacy/docs/PLAN/PLAN.md`
- `docs/legacy/docs/PLAN/app-runtime-todo.md`
- `docs/legacy/docs/PLAN/app-runtime-wrpc.md`
- `docs/legacy/docs/PLAN/app-runtime-component-ui-spec.md`
- `docs/legacy/docs/PLAN/fs-runtime.md`
- `docs/legacy/docs/VERSION.md`
- `docs/legacy/CLI_SERVE.md`

## Problem

GAMS is migrating toward a plugin-driven CMS/toolkit where hosts stay thin and most behavior is exposed through WASM components, singleton services, view plugins, and stable WIT contracts. Runtime and plugin-manager behavior is currently described across legacy planning files and needs one canonical PRD for migration work.

## Goals

- In dev mode, allow required base plugins such as `gams:fs` to be loaded by hardcoded bootstrap.
- Move toward project-config-driven loading for all moving parts: plugins, views, UI plugins, themes, scripts, presets, and per-plugin/view configuration.
- Make the GAMS runtime a small orchestration/plugin-management layer.
- Allow the same project config to be run by multiple hosts, including future `browser` and `cli` hosts.
- Keep current `cmd/app` as the built-in development host/runtime while the host split is clarified.
- Load WASM components through runtime-managed plugin registration/loading.
- Prefer real WIT/component interfaces as stable plugin APIs.
- Prefer plugin-to-plugin/component-to-component calls over host-specific callbacks.
- Route frontend calls into registered WIT exports through structured runtime invocation while typed/wRPC-shaped calls are investigated.
- Keep real WASI available to WASM components.
- Use `gams:fs` for frontend/app filesystem operations instead of raw frontend `wasi:filesystem` wrappers.

## Non-goals

- Do not recreate the old universal byte-call plugin API as the primary model.
- Do not maintain separate app and CLI runtimes.
- Do not reintroduce the old virtual mount system unless a future PRD reopens storage architecture.

## Requirements

- **Plugin Manager** remains the umbrella term for registration/loading and call routing.
- **Plugin Registration/Loading** covers discovery, validation, dependency ordering, and instantiation.
- **Call Routing** covers dispatching host-to-plugin and plugin-to-plugin calls to registered exports.
- Runtime plugin loading resolves dependencies independent of caller order.
- Runtime rejects duplicate providers clearly.
- Runtime returns plugin handles in caller request order even if instantiation order differs.
- Runtime preserves real WASI access for components.
- `runtime.invoke(target, args)` remains the current compatibility API for frontend-to-plugin calls, not a frozen long-term contract.
- Frontend/app filesystem helpers go through `gams:fs`.
- Dev-mode hardcoded base plugin loading must not become the long-term project composition model.
- Long-term plugin/view/UI-plugin/theme/script/preset loading is driven by Project Config.
- The configured thing that becomes a runnable GAMS-specific tool is called a **Project**.
- Version matching follows the compatibility rules converted from `docs/legacy/docs/VERSION.md`.
- Dynamic multi-instance views and singleton UI plugins remain planned extension points until separate PRDs define them.

## Acceptance criteria

- Runtime/plugin-manager terminology is resolved in `CONTEXT.md`.
- Version matching and provider conflict rules are either captured in this PRD or split into a focused ADR/PRD.
- `docs/legacy/INDEX.md` links the runtime legacy files to this PRD when conversion is complete.
- `.scratch/docs-consolidation/issues/01-runtime-plugin-manager.md` records the conversion outcome.

## Open questions

- What exact moving-part categories belong in Project Config v1?
- Should version matching be an ADR because namespace-less compatibility is surprising and durable?

## Related ADRs

- `docs/adr/0002-runtime-invoke-is-compatibility-api.md`
- `docs/adr/0003-project-config-owns-composition.md`
