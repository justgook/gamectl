# cmd/browser2

This directory is the next browser host for GAMS.

The goal is to bootstrap the application through explicit plugin loading and deterministic setup, without hard-coding long-term browser-only architecture into the host.

This host is intentionally a fresh start:
- breaking changes are acceptable here
- backwards compatibility with the old browser host is not required
- legacy fallback keys and compatibility shims should not be introduced unless explicitly chosen

## Base Plugins

### `echo`
WASM debug plugin used to validate the bridge pipeline.

Current API:
- `call(json)` where `json` is shaped like:
  - `{"plugin":"view.echo","method":"hello","input":"world"}`

Notes:
- Intended to exercise the path main thread → worker runtime → WASM plugin → main-thread endpoint.
- The WASM plugin calls the target endpoint directly by plugin id, and the worker runtime resolves registered main-thread endpoints as remote host plugins.


### `fs.opfs`
JS filesystem plugin backed by OPFS.

Current API:
- `read(path)`
- `write(binaryPathPlusData)`
- `remove(path)`
- `exists(path)`
- `list(path)`
- `mkdir(path)`
- `rmdir(path)`
- `stat(path)`

Notes:
- Uses `SharedArrayBuffer` + `Atomics` + a dedicated worker for synchronous execution semantics.
- Supports local storage paths, `http(s):` reads, and read-only mounted files declared in `gams.json` under `fs.mount`.
- This is currently the default filesystem provider selected by `core/setup.js` through `browser.fs` localStorage config.

### `fs.webdav`
JS filesystem plugin backed by a WebDAV server.

Current API:
- `read(path)`
- `write(binaryPathPlusData)`
- `remove(path)`
- `exists(path)`
- `list(path)`
- `mkdir(path)`
- `rmdir(path)`
- `stat(path)`

Notes:
- Uses the same sync worker pattern as `fs.opfs`.
- Intended to be selected through setup/config instead of changing callers.
- Backend configuration support will be extended as bootstrap evolves.

## Bootstrap Notes

Current phase-1 bootstrap flow:
1. `app.js` calls `runtime.init()`
2. `core/worker-runtime.js` owns the actual plugin runtime in the worker
3. `core/setup.js` runs in the worker and selects the filesystem provider
4. the selected `fs.*` plugin is loaded first inside the worker runtime
5. setup uses the `fs` capability to decide the next bootstrap steps
6. plugin init hooks such as `__fs_init` and `__sql_init` are part of plugin load; when a plugin is loaded, those hooks are called if they exist
7. the `sql` plugin opens its in-memory database from its own `__sql_init` hook instead of exposing a public `open` method
8. `core/setup-view.js` registers main-thread view endpoints like `view.echo`
9. DB restore/load and broader plugin registry bootstrap are the next planned step

## Call Semantics

### Main thread → runtime
The public runtime API on the main thread is intentionally small:
- `runtime.init()`
- `runtime.register(...)`
- `runtime.call(pluginId, method, input)`
- `setupResult` exported from the runtime module

`runtime.call(pluginId, method, input)` is asynchronous on the main thread because it bridges to the worker.

### Plugin → plugin inside worker runtime
The target architecture is synchronous plugin-to-plugin calls inside the worker runtime.
Current worker runtime now has a `callSync(...)` path for worker-local plugins and WASM host-function dispatch, and `fs` is wired so `sql` can call it through the worker-side plugin runtime.

### Worker runtime → main-thread plugins/views
Main-thread plugins/views are registered through `runtime.register(...)`, currently from `core/setup-view.js`.
The worker can call them through the bridge by plugin id.
Browser2 now includes the first Atomics-backed synchronous bridge path for worker/plugin-side calls into main-thread endpoints, while the main-thread public `runtime.call(...)` API remains asynchronous. Main-thread endpoints are registered into the worker runtime as remote host plugins, so WASM plugins can call them directly by plugin id.
