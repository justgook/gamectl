# App Runtime, Components, UI Plugins, and Views

Status: **background architecture / superseded for active task tracking**.

Active work is now tracked in `PLAN/app-runtime-todo.md`. Use that file as the top-priority implementation checklist.

## Current Architecture Direction

`cmd/app` is the main host runtime. The standalone `cmd/cli` component runner is experimental only; useful ideas from it should live inside the app runtime.

Core direction:

- WASM components expose/import real WIT interfaces.
- Components should not be forced to implement a generic `export call(method, bytes)` ABI.
- Frontend calls component/native/UI exports through structured `runtime.invoke(target, args)`.
- Components are loaded with `runtime.addPlugins(paths)`; plugin identity comes from WIT exports, not caller-defined ids.
- Real WASI remains available to WASM components through Wasmtime WASI.
- Frontend app IO should use the `gams:fs` proxy component instead of raw frontend-facing `wasi:filesystem` wrappers.
- Dynamic view instances are addressed through `gams:runtime/runtime.call(view-id, string-args)`.
- Singleton frontend UI plugins should eventually register WIT-shaped APIs through `runtime.addUiPlugin(wit, functions)`.

## Runtime Categories

### WASM Components

Loaded from paths through `runtime.addPlugins(paths)`.

They:

- are WebAssembly components,
- import/export WIT interfaces,
- may import WASI directly,
- may import `gams:runtime/runtime.call` for dynamic view calls,
- may import future singleton UI plugin interfaces.

### Native Host Support

The Rust/Tauri host provides:

- Wasmtime component runtime,
- WASI component support,
- frontend command bridge,
- component registry and invocation,
- future blocking bridge from WASM to frontend views/UI plugins.

The host should not grow a second GAMS virtual filesystem layer for normal frontend IO. Prefer the `gams:fs` component proxy for simple app filesystem operations.

### `gams:fs` Proxy Component

`plugins/fs` exposes simple app-facing filesystem functions:

```text
gams:fs/fs::read-file
gams:fs/fs::read-text
gams:fs/fs::list
```

This keeps frontend code simple while retaining real WASI access inside components.

### UI Plugins

Planned singleton frontend reactors/services.

They should:

- register WIT text plus JS functions,
- behave like typed providers,
- be callable from WASM imports,
- block the calling WASM component until frontend returns.

### UI Views

Planned dynamic multi-instance frontend views.

They should:

- have many instances of the same view type,
- be addressed by `view-id`,
- be callable from WASM only through a string protocol:

```wit
package gams:runtime@1.0.0;

interface runtime {
  call: func(target: string, args: string) -> result<string, string>;
}
```

## Frontend Low-Level Runtime API

Current/planned low-level shape:

```js
gams.runtime.invoke(target, args)
gams.runtime.addPlugins(paths, reload)
gams.runtime.diagnostics()
gams.runtime.onCallView(callback)      // planned Rust bridge not complete
gams.runtime.addUiPlugin(wit, funcs)   // planned
```

## Active TODO

See `PLAN/app-runtime-todo.md`.

Immediate next task: **add topological sorting for `addPlugins`** so dependency load order does not depend on caller-provided path order.
