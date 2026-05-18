# Runtime and Plugin Manager migration

## Status

Draft

## Source material

- migration backlog converted from deleted legacy `docs/PLAN/app-runtime-todo.md`
- `docs/prd/0004-wrpc-frontend-backend-spike.md` (converted from legacy `app-runtime-wrpc.md`)
- `docs/prd/0005-frontend-view-and-ui-service-bridge.md` (converted from legacy `app-runtime-component-ui-spec.md`)
- `docs/adr/0005-use-wasi-and-gams-fs-instead-of-host-virtual-fs.md` (converted from legacy `fs-runtime.md`)
- `docs/adr/0004-wit-interface-version-matching.md` (converted from deleted legacy `docs/VERSION.md`)
- `docs/prd/0006-cli-http-serve-host.md` (converted from deleted legacy `CLI_SERVE.md`)

## Problem

GAMS is migrating toward a plugin-driven CMS/toolkit where hosts stay thin and most behavior is exposed through WASM components, singleton services, view plugins, and stable WIT contracts. Runtime and plugin-manager behavior is currently described across legacy planning files and needs one canonical PRD for migration work.

## Goals

- In dev mode, allow required base plugins such as `gams:fs` to be loaded by hardcoded bootstrap.
- Move toward project-config-driven loading for the Project's **Project Units**: theme, plugins, views, UI Services, and their configuration.
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
- Runtime plugin loading resolves dependencies independent of caller order by inspecting WASM component imports/exports rather than reading dependency lists from Project Config.
- Runtime rejects duplicate providers clearly.
- Runtime returns plugin handles in caller request order even if instantiation order differs.
- Runtime preserves real WASI access for components.
- `runtime.invoke(target, args)` remains the current compatibility API for frontend-to-plugin calls, not a frozen long-term contract.
- Frontend/app filesystem helpers go through `gams:fs`.
- Dev-mode hardcoded base plugin loading must not become the long-term project composition model.
- Long-term Project Unit loading is driven by Project Config.
- Project Units are themes, plugins, views, and UI Services.
- Presets are part of view configuration, not a top-level Project Config category.
- Scripts are part of UI Service key/action configuration, not a top-level Project Config category.
- Themes, plugins, views, and UI Services should ship JSON Schemas for validating their Project Config sections.
- The configured thing that becomes a runnable GAMS-specific tool is called a **Project**.
- Version matching follows `docs/adr/0004-wit-interface-version-matching.md`: compatibility identity is `package/interface@major.minor.patch`, provider conflicts are `package/interface@major`, namespace is provenance, provider minor must be greater than or equal to import minor, and patch is ignored.
- Dynamic multi-instance views and singleton UI Services remain planned extension points until separate PRDs define them.

## Acceptance criteria

- Runtime/plugin-manager terminology is resolved in `CONTEXT.md`.
- Version matching and provider conflict rules are captured in `docs/adr/0004-wit-interface-version-matching.md`.
- Runtime legacy material has been converted or removed as part of completed legacy migration.
- `.scratch/docs-consolidation/issues/01-runtime-plugin-manager.md` records the conversion outcome.

## Migration backlog

Runtime work converted from legacy TODOs:

- Load required dev-mode base plugins such as `gams:fs` before frontend filesystem calls; long-term loading comes from Project Config.
- Keep frontend/app filesystem helpers routed through `gams:fs`; do not restore raw frontend `wasi:filesystem` wrappers.
- Keep dependency loading order based on component import/export inspection and topological sorting.
- Continue JSON ↔ WIT value conversion hardening for structured values and define a policy for resources, variants/results/flags, 64-bit integers, and `list<u8>`.
- Keep `gams:runtime/runtime.call` as the dynamic WASM-to-view bridge and add automated bridge/deadlock coverage when implementation work resumes.
- Implement UI Service registration in a later slice using `docs/prd/0005-frontend-view-and-ui-service-bridge.md`.
- Keep `cmd/app` as the built-in development host while future `browser` and `cli` hosts are clarified.
- Replace placeholder CLI/subcommand behavior through the same runtime instead of maintaining a separate runtime.
- Treat HTTP `serve` as a future CLI/app Host mode tracked by `docs/prd/0006-cli-http-serve-host.md`, not part of Project Config v1.

## Open questions

- Project Config details are split into `docs/prd/0003-project-config.md`; runtime PRD should only define runtime responsibilities and integration boundaries.

## Related ADRs

- `docs/adr/0002-runtime-invoke-is-compatibility-api.md`
- `docs/prd/0003-project-config.md`
- `docs/adr/0003-project-config-owns-composition.md`
- `docs/adr/0004-wit-interface-version-matching.md`
- `docs/adr/0005-use-wasi-and-gams-fs-instead-of-host-virtual-fs.md`
- `docs/prd/0006-cli-http-serve-host.md`
