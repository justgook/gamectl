# Handoff: GAMS Wasmtime cache + CLI + `serve` validation

## Repository / context
- Repo: `/Users/gook/Repos/gams2`
- Project: GAMS, plugin-driven game asset CMS/runtime.
- Relevant project guidance: `/Users/gook/Repos/gams2/AGENTS.md`
- Architectural plan to consult before bigger changes: `docs/PLAN/PLAN.md`

## User goal for continuation
Continue validating and implementing the theory that:

```sh
gams serve --plug dep1.wasm --plug dep2.wasm --plug handler.wasm
```

should load all components through existing GAMS plugin/component wiring, detect the one component exporting `wasi:http/proxy` / handler, and route native HTTP requests to it. The HTTP handler should be able to call other plugged components using normal component imports/exports.

The user believes the existing pluginManager wiring already solves component-to-component calls; only the `http-server -> pluginManager[wasi:http/proxy]` adapter remains.

## Current working tree changes
Do not rely only on this doc; inspect diffs:

```sh
git diff -- cmd/app/src-tauri/Cargo.toml cmd/app/src-tauri/Cargo.lock cmd/app/src-tauri/src/lib.rs cmd/app/src-tauri/src/runtime/mod.rs cmd/app/src/core/runtime.js Makefile cmd/app/src-tauri/tauri.conf.json
```

Important changed files during this conversation include:
- `Makefile`
- `cmd/app/src-tauri/Cargo.toml`
- `cmd/app/src-tauri/Cargo.lock`
- `cmd/app/src-tauri/src/lib.rs`
- `cmd/app/src-tauri/src/runtime/mod.rs`
- `cmd/app/src/core/runtime.js`
- `cmd/app/src-tauri/tauri.conf.json`

There are also pre-existing/unrelated doc changes visible in status at times:
- `docs/PLAN/PLAN.md`
- `docs/PLAN/app-runtime-todo.md`
- `docs/PLAN/app-runtime-wrpc.md`

Treat those as user/previous-session artifacts unless diff inspection says otherwise.

## Completed in this session

### Wasmtime compiled component cache
Implemented serialized component cache for `.comp.wasm` loads:
- Runtime wraps `Component::from_file` with cache lookup/build.
- Freshness check: cached `.cwasm` mtime >= source `.wasm` mtime.
- Cache file path includes a hash of source path and a format/config-ish subdirectory:
  - `wasmtime44-component-exceptions-v1-{os}-{arch}`
- Uses `Component::serialize()` and unsafe `Component::deserialize()`.
- Added `Runtime::clear_compiled_component_cache()`.
- Added diagnostics field `compiledComponentCacheDir`.
- Added JS API `Runtime.clearCompiledComponentCache()` in `cmd/app/src/core/runtime.js`.
- Added Tauri command `runtime_clear_compiled_component_cache`.

### Cache directory policy
- Tauri setup honors `GAMS_WASMTIME_CACHE_DIR` first.
- If env var missing, Tauri uses:
  - `app.path().app_cache_dir()?.join("wasmtime-components")`
- Runtime fallback for non-Tauri construction uses:
  - env `GAMS_WASMTIME_CACHE_DIR`, else `<root>/build.nosync/wasmtime-cache`
- `Makefile` has:
  - `APP_WASMTIME_CACHE_DIR ?= $(abspath $(BUILD_DIR)/wasmtime-cache)`
- `make app-run` passes:
  - `GAMS_WASMTIME_CACHE_DIR="$(APP_WASMTIME_CACHE_DIR)"`

### CLI commands
Added Tauri CLI commands in `cmd/app/src-tauri/tauri.conf.json` and handling in `cmd/app/src-tauri/src/lib.rs`:

```sh
gams add plugin <path>     # compile/cache component only; does not instantiate/register
gams add theme             # placeholder
gams add view              # placeholder
gams clean                 # clear compiled component cache
gams init                  # create empty gams.json in runtime root
gams run --plug <path>... <target> '[json_args]'
gams serve --addr <addr> --plug <path>...
```

`run` currently loads `--plug` components via absolute/cwd-relative paths using `Runtime::add_component_files`, then calls `runtime.invoke`.

`init` uses `create_new`, so it fails if `gams.json` already exists.

CLI errors in Tauri setup are now printed and exit with code 1 instead of panicking inside Tauri setup.

### `serve` validation slice
Added dependencies:
- `wasmtime-wasi-http = "44"`
- `wasmtime = { version = "44", features = ["component-model", "async"] }`
- `tokio`, `hyper`, `hyper-util`, `http-body-util`, `bytes`

Added to `HostState`:
- `http_ctx: WasiHttpCtx`
- implementation of `wasmtime_wasi_http::p2::WasiHttpView`

Runtime linker now registers WASI HTTP p2 HTTP-only interfaces:

```rust
wasmtime_wasi_http::p2::add_only_http_to_linker_sync(&mut linker)?;
```

Important: using `add_to_linker_sync` caused duplicate `wasi:io/error@0.2.6` because `wasmtime_wasi::p2::add_to_linker_sync` was already called. `add_only_http_to_linker_sync` fixed it.

`serve` currently:
1. Requires at least one `--plug`.
2. Loads all plugged components via existing GAMS runtime wiring.
3. Detects components exporting any of:
   - `wasi:http/incoming-handler...`
   - `wasi:http/handler...`
   - `wasi:http/proxy...`
4. Requires exactly one such exporter.
5. Prints validation success and next-step message; it does **not** yet start a server.

Validated negative case:

```sh
cd cmd/app/src-tauri
GAMS_APP_CWD=../../../examples/demo \
GAMS_WASMTIME_CACHE_DIR=../../../build.nosync/cli-wasmtime-cache \
CARGO_TARGET_DIR=../../../build.nosync/app/target \
cargo run -- serve --plug ../../../build.nosync/plugins/adder.comp.wasm
```

Expected output:

```text
error: `serve` loaded components successfully, but none export wasi:http/proxy
```

## Tests run
Latest known good:

```sh
nix-shell --run 'cd cmd/app/src-tauri && cargo check'
nix-shell --run 'cd cmd/app/src-tauri && cargo test'
```

All 18 Rust tests passed after adding WASI HTTP linker state.

## Research / source references

Wasmtime `serve` implementation in cloned repo:
- Local clone: `/tmp/pi-github-repos/bytecodealliance/wasmtime`
- Commit: `442b415dc5e4f2fca226f9b38420ed54406a0110`

Useful source references:
- Wasmtime serve builds async/component engine/linker and loads component:
  - `src/commands/serve.rs` around lines 542-576
  - permalink: https://github.com/bytecodealliance/wasmtime/blob/442b415dc5e4f2fca226f9b38420ed54406a0110/src/commands/serve.rs#L542-L576
- WASI HTTP linker wiring:
  - https://github.com/bytecodealliance/wasmtime/blob/442b415dc5e4f2fca226f9b38420ed54406a0110/src/commands/serve.rs#L461-L489
- Hyper accept loop + service_fn:
  - https://github.com/bytecodealliance/wasmtime/blob/442b415dc5e4f2fca226f9b38420ed54406a0110/src/commands/serve.rs#L662-L708
- Hyper request -> WASI HTTP resource -> handler call:
  - https://github.com/bytecodealliance/wasmtime/blob/442b415dc5e4f2fca226f9b38420ed54406a0110/src/commands/serve.rs#L1131-L1204
- `wasmtime-wasi-http` handler utilities:
  - https://github.com/bytecodealliance/wasmtime/blob/442b415dc5e4f2fca226f9b38420ed54406a0110/crates/wasi-http/src/handler.rs#L1-L60

Spin middleware example:
- Local clone: `/tmp/pi-github-repos/spinframework/http-auth-middleware`
- Commit: `8c029f3ee2591979298d5f1045cdcfa5e4025461`
- Shows middleware calling imported HTTP handler after auth:
  - https://github.com/spinframework/http-auth-middleware/blob/8c029f3ee2591979298d5f1045cdcfa5e4025461/github-oauth/src/api/authenticate.rs#L33-L39
- README uses `wac plug --plug ...` then `wasmtime serve`:
  - https://github.com/spinframework/http-auth-middleware/blob/8c029f3ee2591979298d5f1045cdcfa5e4025461/README.md#L63-L70

Sample WASI HTTP Rust component:
- Local clone: `/tmp/pi-github-repos/bytecodealliance/sample-wasi-http-rust`
- README says build with `cargo build --release --target wasm32-wasip2`, serve via `wasmtime serve -Scli -Shttp ...`.

## Current understanding / design notes

The user’s preferred semantics:

```sh
gams serve --plug dep1.wasm --plug dep2.wasm --plug handler.wasm
```

No separate handler positional arg. GAMS should not require the user to know which plugin is HTTP handler. Runtime should inspect exports and require exactly one HTTP proxy/handler exporter.

The likely missing implementation is **not** component-to-component wiring. Existing GAMS runtime already has topology/provider logic for component imports/exports. The missing part is the resource-based HTTP adapter:

```text
Hyper request
  -> wasmtime_wasi_http incoming-request resource/outparam/body streams
  -> call exported wasi:http/proxy handler
  -> Hyper response
```

Caveat: Current GAMS runtime is sync-ish and keeps one `Store<HostState>` behind a `Mutex`. Wasmtime `serve` uses async support and `ProxyHandler`/per-request or reusable async instances. Next work needs to decide whether to:
1. create a separate async HTTP serve runtime using GAMS linking logic, or
2. extend current runtime enough for async HTTP handler invocation.

Given user goal, a tracer-bullet separate serve path may be best: duplicate/minimize enough linking logic to validate an actual HTTP request before deep refactor.

## Suggested next steps
1. Build or obtain a small `wasi:http/proxy` component for local validation.
   - Try `bytecodealliance/sample-wasi-http-rust`; may require `wkg wit fetch` before build.
2. Run current `gams serve --plug sample_wasi_http_rust.wasm` and confirm detection succeeds.
3. Implement minimal actual server path:
   - use `tokio::runtime::Runtime` in CLI `serve` branch,
   - bind TCP with `tokio::net::TcpListener` or `TcpSocket`,
   - use `hyper::server::conn::http1::Builder` and `hyper_util::rt::TokioIo`,
   - create/request WASI HTTP resources with `WasiHttpView::http().new_incoming_request` and `new_response_outparam`,
   - call p2 handler export.
4. Decide how to reuse existing linked component graph for handler calls. The current instantiated components are in one sync store; HTTP p2 example creates per-request store and instantiates from pre. This is the major technical decision.
5. Add a focused integration/manual test: start server on `127.0.0.1:0` or fixed temp port, curl `/`, verify response.

## Suggested skills for next session
- `diagnose`: if implementing `serve` hits Wasmtime async/resource/linker errors.
- `librarian`: for deeper Wasmtime/wasi-http/wRPC source spelunking with permalinks.
- `prototype`: if choosing between separate async serve runtime vs extending current runtime.
- `tdd`: if adding a real integration test around CLI `serve`.
