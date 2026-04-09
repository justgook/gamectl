# cmd/browser2

This directory is the next browser host for GAMS.

The goal is to bootstrap the application through explicit plugin loading and deterministic setup, without hard-coding long-term browser-only architecture into the host.

This host is intentionally a fresh start:
- breaking changes are acceptable here
- backwards compatibility with the old browser host is not required
- legacy fallback keys and compatibility shims should not be introduced unless explicitly chosen

## Base Plugins

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
- Supports local storage paths as well as helper protocols like `local:` and `http(s):` via the copied browser FS behavior.
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
1. `app.js` creates the main-thread runtime proxy
2. `core/worker-runtime.js` owns the actual plugin runtime in the worker
3. `core/setup.js` runs in the worker and selects the filesystem provider
4. the selected `fs.*` plugin is loaded first inside the worker runtime
5. setup uses the `fs` capability to decide the next bootstrap steps
6. SQL bootstrap is the next planned step

## Call Semantics

### Main thread → runtime
`runtime.call(pluginId, method, input)` is asynchronous on the main thread because it bridges to the worker.

### Plugin → plugin inside worker runtime
The target architecture is synchronous plugin-to-plugin calls inside the worker runtime.
Current scaffolding still uses async JS handlers, but browser2 should evolve toward sync plugin semantics inside the worker.

### Worker runtime → main-thread plugins/views
Main-thread plugins/views are registered as endpoints on the runtime proxy.
The worker can call them through the bridge by plugin id.
This bridge is asynchronous in transport, and is the place where later Atomics-backed synchronization will be added for worker/plugin-side sync semantics.
