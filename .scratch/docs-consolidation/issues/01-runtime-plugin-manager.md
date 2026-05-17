# Convert runtime and plugin-manager legacy docs

Status: needs-info

## Source material

- `docs/prd/0002-runtime-plugin-manager.md` migration backlog (converted from legacy `app-runtime-todo.md`)
- `docs/prd/0004-wrpc-frontend-backend-spike.md` (converted from legacy `app-runtime-wrpc.md`)
- `docs/prd/0005-frontend-view-and-ui-service-bridge.md` (converted from legacy `app-runtime-component-ui-spec.md`)
- `docs/adr/0005-use-wasi-and-gams-fs-instead-of-host-virtual-fs.md` (converted from legacy `fs-runtime.md`)
- `docs/adr/0004-wit-interface-version-matching.md` (converted from deleted legacy `docs/VERSION.md`)
- `docs/prd/0006-cli-http-serve-host.md` (converted from legacy `CLI_SERVE.md`)

## Expected output

- One or more PRDs under `docs/prd/` covering runtime/plugin-manager migration slices.
- ADRs only for settled hard-to-reverse runtime decisions.
- `CONTEXT.md` updates for resolved runtime vocabulary.
- Conversion links/status in `docs/legacy/INDEX.md`.

## Current output

- Draft PRD: `docs/prd/0002-runtime-plugin-manager.md`
- Split PRD: `docs/prd/0003-project-config.md`
- Multi-context map: `CONTEXT-MAP.md`

## Comments

- Resolved: **Plugin Manager** remains the umbrella term. **Plugin Registration/Loading** and **Call Routing** are named responsibilities in `CONTEXT.md` and `docs/prd/0002-runtime-plugin-manager.md`.
- Resolved: `runtime.invoke(target, args)` remains the current compatibility API, not the frozen long-term frontend-to-plugin contract. Captured in `docs/adr/0002-runtime-invoke-is-compatibility-api.md`.
- Resolved: dev mode may hardcode base plugin loading, but long-term composition belongs to Project Config. Captured in `docs/adr/0003-project-config-owns-composition.md`.
- Resolved vocabulary: the configured thing that becomes a runnable tool is a **Project**.
- Resolved Project Config v1 categories: theme; plugins with config; views with config; UI Services with config. Presets belong to view config. Scripts belong to UI Service key/action config. Themes/plugins/views/UI Services should ship JSON Schemas for config validation.
- Resolved vocabulary: Project Config moving parts are **Project Units**.
- Resolved: version matching is an ADR. Captured in `docs/adr/0004-wit-interface-version-matching.md`, based on deleted legacy `docs/VERSION.md` and confirmed against `cmd/app/src-tauri/src/runtime/mod.rs`.
- Resolved: split Project Config into `docs/prd/0003-project-config.md`.
- Resolved: convert to multi-context docs now because Project Units are expected to split into separate repositories/packages after prototype phase.
- Resolved: default Project Config file is `gams.json` in the Project root. Alternate config path/name at runtime is a future launch feature.
- Resolved vocabulary: `ui-plugin` is now **UI Service**; Project Config uses `ui-services`.
- Resolved: Project Config v1 is JSON only.
- Resolved direction: Project Config v1 uses object maps keyed by Project-local ids, not arrays, so Project Unit schemas can validate stable paths like `views.main.config` or `ui-services.keys.config`. Parser must reject duplicate object keys before schema validation.
- Resolved: no `enabled` field in v1; a Project Unit is enabled by being present in Project Config.
- Resolved: Project Config v1 flattens Project Unit sections to top-level `theme`, `plugins`, `views`, and `ui-services`; do not keep the WIP `ui.theme`/`ui.views`/`ui.keys` nesting.
- Resolved: all Project Unit collections, including `plugins`, use object maps keyed by Project-local id, not arrays with `id` fields.
- Resolved: `theme` is a single active theme object: `{ "url": "themes/the98.css", "config": {} }`.
- Resolved: `theme.config` can be extended/validated by Project Units such as `view-ng` for visual representation/theme fields.
- Resolved: view core-owned fields are `url`, `config`, `label`, `group`, and `internal`; `defaultSource` belongs to view-specific config.
- Resolved: plugin entries use only `url` and `config` for v1. `deps` moved to WASM component imports/exports; `runtime`, `role`, and `memory` are removed from v1 Project Config.
- Resolved: `theme.config` extension is by schema only. Any Project Unit schema may validate any needed part of `theme.config`; conflicts/overrides/ownership declarations are out of scope for v1.
- Resolved: `docs/prd/0003-project-config.md` includes a concrete v1 `gams.json` example.
- Resolved: do not migrate `examples/demo/gams.json` yet. Implementation starts after legacy docs are converted/removed.
- Converted: legacy `app-runtime-wrpc.md` -> `docs/prd/0004-wrpc-frontend-backend-spike.md`.
- Converted: legacy `app-runtime-component-ui-spec.md` -> `docs/prd/0005-frontend-view-and-ui-service-bridge.md`.
- Converted: legacy `fs-runtime.md` -> `docs/adr/0005-use-wasi-and-gams-fs-instead-of-host-virtual-fs.md`.
- Converted: legacy `app-runtime-todo.md` -> migration backlog in `docs/prd/0002-runtime-plugin-manager.md`.
- Deleted split fragment `runtime-and-project-config.md` after covering it in runtime/project-config PRDs and ADRs.
- Converted: legacy `CLI_SERVE.md` -> `docs/prd/0006-cli-http-serve-host.md`; `serve` is future/post-v1 CLI/app Host mode requiring an HTTP Handler Project Unit.
- Deleted split fragment `implementation-order-and-clarifications.md` after moving generation leftovers to `docs/legacy/split/docs/PLAN/PLAN/generation-leftovers.md`.
