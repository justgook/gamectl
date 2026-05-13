# cmd/app Runtime TODO

Status: **top priority**.

This is the current implementation TODO for the `cmd/app` runtime. It supersedes the older broad architecture checklist in `app-runtime-component-ui-spec.md` for day-to-day work.

## Current Direction

`cmd/app` is the primary host runtime. The old standalone `cmd/cli` component runner remains an experiment/source of patterns only.

Runtime model:

- WASM components expose/import real WIT interfaces.
- Frontend calls exported functions through structured `runtime.invoke(target, args)`; targets must be namespace-less and version-less, e.g. `fs/fs::read-text`.
- Components are loaded through `runtime.addPlugins(paths)` without caller-defined plugin ids.
- Real WASI remains available to WASM components through `wasmtime_wasi::p2::add_to_linker_sync(...)`.
- Frontend should not call raw `wasi:filesystem` directly for normal app IO.
- Frontend/app IO should go through the `gams:fs` proxy component.
- Dynamic multi-instance frontend views are still planned through `gams:runtime/runtime.call(view-id, string)`.
- Singleton typed frontend UI plugins are still planned through WIT-shaped UI plugin registration.

## Recently Completed

- [x] Moved useful component-runtime ideas into `cmd/app`.
- [x] Added structured frontend runtime APIs:
  - `runtime.invoke(target, args)`
  - `runtime.addPlugins(paths, reload)`
  - `runtime.diagnostics()`
- [x] Added Wasmtime component model support in `cmd/app`.
- [x] Added real WASI support for WASM components with `wasmtime_wasi::p2::add_to_linker_sync(...)`.
- [x] Added WIT-like exported function resolution, including unversioned matching.
- [x] Added smoke tests for `adder` and `calculator` component invocation.
- [x] Added `plugins/fs` C WASM component.
- [x] Added `gams:fs@1.0.0` WIT package.
- [x] Implemented `plugins/fs/component.c` with:
  - `gams:fs/fs::read-file`
  - `gams:fs/fs::read-text`
  - `gams:fs/fs::list`
- [x] Updated frontend app demo to use `gams:fs`, not raw `wasi:filesystem`.
- [x] Removed obsolete frontend/native raw WASI filesystem wrappers from `cmd/app/src-tauri/src/runtime/mod.rs`.
- [x] Removed manual frontend descriptor/preopen/directory-entry-stream resource tracking.
- [x] Kept real WASI for components.
- [x] Added/kept smoke test for the `gams:fs` proxy component.
- [x] Verified runtime tests pass with `cargo test`.

## Completed Task: Topological Loading for `addPlugins`

Initial implementation is complete. Keep this section as the behavior/test checklist for future hardening.

### Problem

`runtime.addPlugins(paths)` currently depends on caller order. If component `calculator` imports an interface exported by component `adder`, then this works:

```js
await runtime.addPlugins([
  "plugins/adder.wasm",
  "plugins/calculator.wasm",
])
```

but the reverse order can fail during instantiation:

```js
await runtime.addPlugins([
  "plugins/calculator.wasm",
  "plugins/adder.wasm",
])
```

### Target Behavior

Implemented initial topo-sort pass. Keep this section as the accepted behavior:

1. Resolve/canonicalize all requested paths.
2. Load component metadata for every not-yet-loaded requested path without instantiating immediately.
3. Inspect WIT imports/exports for each component.
4. Build a provider table from:
   - already-loaded component exports,
   - native/runtime exports if applicable,
   - new requested component exports.
5. Reject duplicate providers with a clear error.
6. Resolve dependencies among the newly requested components.
7. Topologically sort new components so providers instantiate before consumers.
8. Instantiate in sorted order.
9. Return handles in the same order as requested by the caller, not necessarily instantiation order.
10. Preserve current already-loaded behavior: adding an already-loaded path without reload should return its existing handle.

### Dependency Matching Rules

Canonical version rules are documented in `docs/VERSION.md`.

For topo-sort, dependency is interface-level:

```text
import docs:adder/add depends on provider exporting docs:adder/add
import gams:runtime/runtime@1.0.0 may be satisfied by compatible */runtime/runtime@1.x.y
```

Compatibility identity is:

```text
package/interface@major.minor.patch
```

Provider conflict family is:

```text
package/interface@major
```

Namespace is ignored for compatibility but retained for diagnostics and exact Wasmtime linker names.

### Tests to Add

- [x] Loading `[calculator, adder]` succeeds and `calculator` can call `adder`.
- [x] Loading `[adder, calculator]` still succeeds.
- [x] Duplicate providers for the same exported interface fail clearly.
- [x] Missing non-native provider fails clearly.
- [x] Already-loaded dependency can satisfy a newly loaded component.
- [x] Returned handles preserve caller request order.
- [x] Reload path still rebuilds registry and applies topo-sort.

## Remaining Runtime TODO

### Next Task: `gams:fs` Proxy Integration

- [ ] Ensure app startup/demo loads `plugins/fs.wasm` before frontend calls `fs/fs::*`.
- [ ] Decide whether `plugins/fs.wasm` is auto-loaded by host bootstrap, project config, or frontend boot code.
- [ ] Add frontend convenience wrapper around `gams:fs`:

  ```js
  runtime.fs.readText(path)
  runtime.fs.readFile(path)
  runtime.fs.list(path)
  ```

- [ ] Expand `gams:fs` methods only when needed; do not reintroduce raw frontend WASI wrapper complexity.

### WIT Value Conversion

- [x] Added `plugins/benchmark` component to exercise JSON ↔ WIT conversion.
- [x] Expanded JSON -> WIT conversion in `cmd/app/src-tauri/src/runtime/values.rs` for:
  - records,
  - lists,
  - tuples,
  - flags,
  - variants,
  - options,
  - results.
- [x] Added runtime tests covering scalar echo functions plus records/lists/tuples/flags/variants/options/results.
- [ ] Decide whether resource values should ever be frontend-invokable through JSON.
- [ ] Finalize JS representation compatibility policy for:
  - variants,
  - results,
  - flags,
  - `u64`/`s64`,
  - `list<u8>`.

### Blocking View Calls

- [x] Added `plugins/benchmark` method `benchmark/benchmark::call-runtime-view` that calls `gams:runtime/runtime.call(target, args)` directly. Use this as the deadlock/regression harness when replacing the stub.
- [x] Replaced the `gams:runtime/runtime.call` stub with a Rust view bridge that emits a frontend request and blocks until response.
- [x] Connected WASM `runtime.call(view-id, args)` to frontend `runtime.onCallView(callback)` through the Tauri event/command bridge.
- [x] Added frontend listener readiness handshake through `runtime_call_view_ready` so host calls fail fast until JS is listening.
- [x] Added frontend demo validation where `benchmark/benchmark::call-runtime-view` calls `benchmark:view` and receives a JSON string response.
- [x] Response handling does not lock `RuntimeInner`; `runtime_call_view_response` talks only to the separate view bridge pending-call table.
- [ ] Add an automated integration test for the real frontend bridge/deadlock behavior. Current Rust unit tests still validate the no-frontend error path only.

### Singleton UI Plugins

- [ ] Implement frontend `runtime.addUiPlugin(wit, functions)`.
- [ ] Parse/register WIT-shaped frontend provider functions.
- [ ] Let WASM components import those UI plugin interfaces.
- [ ] Forward WASM calls to JS functions and block until result.
- [ ] Convert typed WIT args/results between Wasmtime `Val` and JS values.

### WASI Filesystem Benchmark

- [x] Added `plugins/benchmark` method `benchmark/benchmark::check-wasi-filesystem`.
- [x] Added runtime test proving a component can see preopens and list a directory through real `wasi:filesystem`.
- [ ] Expand the benchmark if/when the app needs more WASI operations beyond preopens/stat/open-directory/read-directory.

### Project Bootstrap / Config

- [ ] Decide project root/bootstrap config source.
- [ ] Decide when initial plugins are loaded:
  - host bootstrap,
  - project config,
  - frontend boot script,
  - or a combination.
- [ ] Keep bootstrap native filesystem access minimal and explicit.
- [ ] Avoid rebuilding the old GAMS virtual mount system.

### CLI Through Tauri

- [ ] Replace placeholder `run` subcommand.
- [ ] Use the same `cmd/app` runtime for CLI/subcommand execution.
- [ ] Keep runtime code modular enough for a future dedicated CLI binary, but do not maintain a separate runtime now.

### Legacy Cleanup

- [ ] Mark or remove old `wit/plugin.wit` byte-call draft once no longer referenced.
- [ ] Keep `docs/PLAN/fs-runtime.md` as historical/superseded unless a new storage-specific plan is needed.
- [ ] Remove stale references to raw frontend `wasi:filesystem` usage from docs and demos.
