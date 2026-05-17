# CLI HTTP serve host

## Status

Future / post-v1

## Source material

- `docs/legacy/CLI_SERVE.md`

## Problem

GAMS should eventually support a CLI/app host mode that serves HTTP by loading a Project Unit WASM component that exports a WASI HTTP handler interface. The legacy `CLI_SERVE.md` captured an unfinished experiment validating Wasmtime cache behavior, Tauri CLI commands, and detection of `wasi:http/proxy` exports, but this is not part of Project Config v1 implementation.

## Goals

- Treat `serve` as a Host capability, not as a general plugin-manager responsibility.
- Require a serve-capable Project Unit, likely a WASM component exporting `wasi:http/proxy` / `wasi:http/incoming-handler` semantics.
- Let the serve handler call other plugins through normal component imports/exports and Plugin Manager wiring.
- Keep the HTTP adapter thin: native HTTP request handling adapts to WASI HTTP resources and calls the exported handler.
- Preserve the validation insight that the Host can inspect loaded Project Units and require exactly one HTTP handler exporter for `serve` mode.

## Non-goals

- Do not implement `serve` for Project Config v1.
- Do not require a separate handler positional argument for the old experimental `--plug` flow.
- Do not duplicate component-to-component wiring outside the Plugin Manager long-term.
- Do not decide the final async runtime/store strategy in this PRD.

## Requirements

- `serve` is a future CLI/app Host mode.
- `serve` requires a Project Unit that exports a WASI HTTP handler interface.
- The Host must fail clearly if no HTTP handler exporter is found.
- The Host must fail clearly if multiple HTTP handler exporters are active and no future config disambiguation exists.
- Component-to-component calls from the handler should use normal plugin/component imports and exports.
- The native HTTP adapter is responsible for converting HTTP requests/responses to and from WASI HTTP resources.

## Experiment notes preserved from legacy

- The experiment added/validated compiled Wasmtime component cache behavior.
- The experiment added placeholder Tauri CLI commands such as `add`, `clean`, `init`, `run`, and `serve`.
- The experiment found that `wasmtime_wasi_http::p2::add_only_http_to_linker_sync` avoided duplicate `wasi:io/error` linker definitions when WASI was already registered.
- The experiment detected candidate HTTP handlers by scanning exports for `wasi:http/incoming-handler`, `wasi:http/handler`, or `wasi:http/proxy`.
- The main unresolved implementation question was whether HTTP serve should use a separate async serve runtime or extend the current sync-ish runtime/store model.

## Open questions

- Should `serve` select its handler solely by inspecting active Project Units, or should future Project Config include explicit serve routing/disambiguation?
- Should the serve Host use a separate async runtime path or share the same runtime/store as app/browser hosts?
- Is compiled Wasmtime component cache policy part of core runtime v1 or a separate performance PRD?

## Related ADRs

- `docs/adr/0004-wit-interface-version-matching.md`
- `docs/adr/0005-use-wasi-and-gams-fs-instead-of-host-virtual-fs.md`
