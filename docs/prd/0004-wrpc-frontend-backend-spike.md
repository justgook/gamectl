# wRPC frontend/backend spike

## Status

Draft

## Source material

- `docs/legacy/docs/PLAN/app-runtime-wrpc.md`
- `docs/prd/0002-runtime-plugin-manager.md`
- `docs/adr/0002-runtime-invoke-is-compatibility-api.md`

## Problem

The current `cmd/app` frontend/backend bridge uses Tauri command/event payloads plus JSON-to-WIT conversion. GAMS wants to investigate a WIT-shaped byte protocol so frontend-to-runtime calls can become typed without inventing another long-lived ad-hoc app protocol.

## Goals

- Spike wRPC/component-model value encoding over Tauri IPC.
- Keep existing `runtime.invoke(...)` working while the spike is gated.
- Treat Tauri as the byte carrier; do not introduce WebTransport or a local network server for app IPC.
- Test one manually encoded JS call to a known loaded component function.
- Explicitly reject streams/resources/futures/deferred values in the first spike unless a concrete view needs them.

## Non-goals

- Do not replace all frontend/runtime calls in the first spike.
- Do not require generated JavaScript bindings for arbitrary plugins in v1.
- Do not merge Rust-to-JS view calls into the same mechanism unless a later PRD reopens that boundary.

## Requirements

- Add a gated Tauri command equivalent to `runtime_wrpc_call(request: Vec<u8>) -> Vec<u8>`.
- Add an experimental JS API such as `runtime.wrpcInvokeExperimental(requestBytes)`.
- Encode one known WIT call manually in JS, preferably against `adder/add::add` or `fs/fs::read-text`.
- Decode the invocation on the Rust side, resolve it through the existing runtime registry, call the loaded component, and encode the typed result.
- Make fail-fast errors visible in the UI console.
- Clearly separate standardized wRPC/component-model encoding from GAMS/Tauri carrier glue.

## Acceptance criteria

- Frontend can call one loaded plugin function over wRPC/component-model bytes and receive a typed result.
- Existing `runtime.invoke(...)` remains available and unchanged for callers.
- No WebTransport/local server is introduced.
- Unsupported value kinds fail explicitly.

## Open questions

- Should the spike use full wRPC framed-stream bytes, or a smaller GAMS envelope whose params/results use component-model value encoding?
- Can `wrpc-runtime-wasmtime` integrate cleanly with the current sync Store, or should `cmd/app` enable Wasmtime async support?
- Should Rust-to-JS `gams:runtime/runtime.call(target, string)` remain string-based for dynamic views long-term?

## Related ADRs

- `docs/adr/0002-runtime-invoke-is-compatibility-api.md`
