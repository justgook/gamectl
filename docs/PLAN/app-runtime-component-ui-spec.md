# App Runtime, Components, UI Plugins, and Views

Status: **top priority / target architecture**.

This plan defines the intended replacement direction for the current experimental `cmd/cli` component runner and the older app-side GAMS virtual filesystem/runtime wiring.

## Summary

`cmd/cli` is an experiment only. Its useful ideas — loading WASM components, inspecting WIT imports/exports, topological wiring, and invoking functions by WIT-like symbols — should migrate into `cmd/app`.

`cmd/app` becomes the single primary host for both:

- desktop UI mode, and
- CLI/subcommand mode through Tauri's existing CLI support.

The app runtime should be modular enough that a separate dedicated CLI binary could be created later, but the immediate goal is **one runtime inside `cmd/app`**, not two diverging runtimes.

The target model is:

```text
cmd/app host
  bootstraps native capabilities
  registers WASI filesystem first
  loads configured/requested WASM components
  wires typed WIT imports/exports
  exposes low-level runtime controls to frontend JS
  supports singleton UI plugins with WIT-shaped APIs
  supports dynamic multi-instance UI views through a string call API
```

## Core Decisions

1. **Use native WIT/component interfaces for stable plugin APIs.**
   - WASM components export/import real WIT interfaces.
   - Stable UI services also expose WIT-shaped interfaces.
   - Calls are addressed with WIT-like symbols such as:

     ```text
     gams:calculator/calculate::eval-expression(add, 2, 3)
     ```

2. **Do not require a universal `export call(...)` plugin ABI.**
   - Components should not have to implement a generic byte-oriented plugin export.
   - Their exported WIT interfaces are the plugin API.

3. **Keep only a small dynamic runtime import for WASM-to-view calls.**
   - WASM components should not get a dynamic `invoke` import for arbitrary WIT calls.
   - Typed component-to-component and component-to-UI-service calls should use real WIT imports.
   - The only dynamic call exposed to WASM is for dynamic view instances.

4. **Replace the app's GAMS-specific virtual mount filesystem with WASI filesystem as the primary filesystem model.**
   - Host bootstrap may use native `std::fs` to locate/read initial config.
   - Runtime-visible filesystem access should be provided through `wasi:filesystem` from the start.
   - Frontend can call the registered filesystem provider through the frontend runtime bridge, even though browser JS does not import WASI directly at ABI level.

5. **Frontend has low-level control APIs that can be wrapped into higher-level app runtime APIs.**
   - These are frontend/Tauri bridge controls, not necessarily WIT imports available to WASM.

6. **Separate singleton UI plugins from multi-instance UI views.**
   - `ui.plugins`: singleton/reactor-like providers with WIT-shaped APIs.
   - `ui.views`: many dynamic instances, accessed only through `runtime.call(view-id, string-args)`.

## Runtime Categories

The runtime registry should be able to hold multiple implementation kinds behind a common resolver.

### Native Providers

Implemented by the Rust/Tauri host.

Initial native providers:

- WASI filesystem provider.
- App/runtime management provider for frontend bridge calls.
- Potential future host services that must be native.

Native providers may expose WIT-shaped functions to the registry.

### WASM Components

Loaded by the app runtime from filesystem paths.

They:

- are WebAssembly components,
- import/export WIT interfaces,
- may import `wasi:filesystem`,
- may import singleton UI plugin interfaces,
- may import `gams:runtime/runtime.call` only when they need to call dynamic view instances.

They should not need a manually assigned plugin id for basic registration. The runtime can discover their exported interfaces from the component type.

### UI Plugins

Frontend singleton/reactor providers.

They:

- are registered by frontend JS,
- provide WIT text plus an object of JS functions,
- act 1:1 like component providers from the perspective of typed calls,
- are single logical instances,
- can be called from WASM components through typed WIT imports,
- can block a WASM component while waiting for user input.

Example use cases:

- confirmation dialogs,
- file pickers,
- command palette,
- notification service,
- asset picker,
- frontend-only editor services.

### UI Views

Dynamic frontend instances.

They:

- may have many instances of the same view type,
- are not registered as full WIT providers per instance,
- are addressed by runtime-generated or frontend-generated `view-id`,
- are called through a dynamic string protocol only.

Example use cases:

- multiple nodegraph tabs,
- multiple inspectors,
- multiple tilemap editors,
- temporary preview panels.

## WASM Runtime Import

The WASM-visible dynamic runtime import should stay intentionally small.

Proposed WIT:

```wit
package gams:runtime@1.0.0;

interface runtime {
  /// Dynamic call to a frontend view instance.
  ///
  /// `target` is a concrete view instance id.
  /// `args` is owned by the view protocol. JSON string is the recommended
  /// initial encoding, but this interface intentionally treats it as opaque.
  ///
  /// The call is synchronous from the WASM component's perspective. The host
  /// must block the component until the frontend view returns a response or an
  /// error.
  call: func(target: string, args: string) -> result<string, string>;
}
```

Important exclusions:

- No `invoke` function on this WASM import.
- No generic arbitrary component dispatch from WASM through this runtime API.
- No generic bytes API unless a concrete need appears.

Rationale:

- Stable plugin/service APIs should be typed WIT imports.
- Dynamic invocation from WASM would complicate implementation and blur the architecture.
- Views are the only intentionally dynamic/multi-instance target class.

## Frontend Low-Level Runtime API

The Tauri/frontend bridge should expose a small low-level object that higher-level JS runtime helpers can wrap.

Conceptual API:

```js
gams.runtime.invoke(target, args)
gams.runtime.addPlugins(paths)
gams.runtime.onCallView(callback)
gams.runtime.addUiPlugin(wit, functions)
```

These names are planning names; exact JS naming can be refined during implementation.

### `invoke(target, args)`

Frontend-only dynamic call into the runtime registry.

Example:

```js
await gams.runtime.invoke(
  "gams:calculator/calculate::eval-expression",
  ["add", 2, 3],
)
```

The host resolves the symbol against registered providers:

```text
native provider / WASM component export / UI plugin export
```

Return values should be decoded into natural JS values when WIT type information is available:

- WIT integers -> JS numbers where safe/appropriate,
- WIT strings -> JS strings,
- WIT records -> JS objects,
- WIT lists -> JS arrays or typed arrays for `list<u8>`,
- WIT variants/results/options -> documented JS representation.

This API is for frontend orchestration/control/debugging. It is not the WASM-side component-to-component call mechanism.

### `addPlugins(paths) -> handles`

Registers WASM component plugins by path.

Preferred shape:

```js
const handles = await gams.runtime.addPlugins([
  "/project/plugins/calculator.component.wasm",
])
```

No explicit user-defined id should be required. The runtime discovers identity from component imports/exports.

Returned handles should contain enough diagnostics for UI and later unload/reload work:

```js
[
  {
    handle: "component:1",
    path: "/project/plugins/calculator.component.wasm",
    imports: [
      "wasi:filesystem/preopens",
      "gams:ui/dialog",
    ],
    exports: [
      "gams:calculator/calculate::eval-expression",
    ],
  },
]
```

Handles are runtime identifiers, not semantic plugin ids.

### `onCallView(callback)`

Registers the frontend dispatcher for WASM `gams:runtime/runtime.call` requests.

Example:

```js
gams.runtime.onCallView(async (target, args) => {
  const view = views.get(target)
  if (!view) throw new Error(`unknown view ${target}`)
  return await view.call(args)
})
```

The host call path is:

```text
WASM component
  -> import gams:runtime/runtime.call(view-id, args)
  -> Rust host import
  -> frontend onCallView callback
  -> callback returns string or throws
  -> Rust returns result<string, string> to WASM
```

The host must block the WASM component until the callback resolves. The frontend must remain async/event-loop driven while the original caller awaits.

### `addUiPlugin(wit, functions)`

Registers a singleton frontend UI plugin as a WIT-shaped provider.

Example:

```js
await gams.runtime.addUiPlugin(`
package gams:ui;

interface dialog {
  confirm: func(message: string) -> bool;
}
`, {
  "gams:ui/dialog": {
    confirm(message) {
      return window.confirm(message)
    },
  },
})
```

A WASM component can then import and call:

```wit
import gams:ui/dialog;
```

The runtime adapts:

```text
WIT typed args -> JS function args -> JS return -> WIT typed result
```

The call is synchronous/blocking from the WASM component perspective, even if JS internally returns a Promise.

## Call Addressing

The preferred user-facing invoke syntax is WIT-like:

```text
package/interface::function(args...)
```

Examples:

```text
gams:calculator/calculate::eval-expression("add", 2, 3)
gams:ui/dialog::confirm("Delete selected nodes?")
wasi:filesystem/preopens::get-directories()
```

Internally, frontend `invoke` can pass target and args separately:

```js
gams.runtime.invoke("gams:calculator/calculate::eval-expression", ["add", 2, 3])
```

A single string expression parser may be useful for CLI/debug UX, but the structured `target + args` API is better for app code.

## Typed Values vs Bytes

Default rule: **use WIT types, not opaque bytes, when WIT type information exists.**

For frontend `invoke`, the runtime should decode results into JS values based on the target function's WIT signature.

Opaque bytes are only the default when the WIT function actually uses `list<u8>`.

This means a WIT function:

```wit
eval-expression: func(op: op, a: u32, b: u32) -> u32;
```

should return to JS as:

```js
5
```

not:

```js
Uint8Array([...])
```

For dynamic view calls, the protocol is intentionally string-only:

```wit
call: func(target: string, args: string) -> result<string, string>;
```

View protocols can choose JSON strings initially.

## Filesystem Direction

The previous app-side GAMS virtual FS/mount model should not be the target runtime design.

Target filesystem model:

```text
host bootstrap uses native std::fs
runtime registers WASI filesystem/preopens first
WASM components use wasi:filesystem directly
frontend accesses filesystem through runtime.invoke/helper wrappers to the same registered provider
```

There may still be configuration telling the host which directories are available, but this should configure WASI preopens/capabilities, not a separate GAMS path router.

Example conceptual preopens:

```text
/project  -> selected project root
/cache    -> app cache/internal data
```

Components read ordinary paths through WASI APIs:

```text
/project/gams.json
/project/assets/player.png
/cache/generated/foo.json
```

Frontend helpers may exist:

```js
await runtime.fs.readText("/project/gams.json")
```

but those helpers should call the same runtime-registered filesystem provider rather than a separate GAMS-specific mount system.

## Bootstrap Sequence

Initial target sequence:

```text
1. Tauri app starts.
2. Host reads minimal bootstrap config using native std::fs.
3. Host creates runtime registry.
4. Host registers WASI filesystem/preopen provider.
5. Host registers app/runtime management provider for frontend bridge.
6. Host initializes Wasmtime component engine/linker.
7. Frontend loads.
8. Frontend may call addPlugins([...]) to load WASM components.
9. Frontend may call addUiPlugin(wit, functions) to expose singleton UI services.
10. Runtime wires component imports to native providers, other components, or UI plugins.
11. Frontend invokes exported functions through runtime.invoke(...).
12. WASM components call dynamic views through gams:runtime/runtime.call(...).
```

Config-driven loading can be layered on top of this later. The first implementation can allow frontend-driven `addPlugins(paths)` because it directly exercises the same runtime registration mechanism.

## Blocking WASM-to-Frontend Calls

Blocking UI calls are required for workflows such as user confirmation before execution.

Two blocking paths are needed:

### Typed UI Plugin Call

```text
WASM imports gams:ui/dialog.confirm
  -> Rust host import
  -> frontend UI plugin function
  -> user responds
  -> result returned to WASM
```

### Dynamic View Call

```text
WASM imports gams:runtime/runtime.call
  -> Rust host import
  -> frontend onCallView dispatcher
  -> target view handles call
  -> result returned to WASM
```

Implementation notes:

- The WASM component may block.
- The frontend event loop must not be blocked.
- The Rust host likely needs request ids plus response channels to wait for frontend responses.
- Errors should propagate loudly and explicitly.
- Missing required UI plugin/view targets are internal wiring bugs and should fail fast.

## UI Views and Instance Identity

Views are dynamic instances and need dynamic ids.

Example:

```text
nodegraph:main
nodegraph:room-12
nodegraph:temp-preview-7
```

The runtime does not need to know each view's typed interface. It only needs to route:

```text
view-id + string args -> string result
```

View creation/registration can be managed by frontend app code. The important runtime requirement is that `onCallView` can dispatch by `view-id` and that views can unregister cleanly when destroyed.

## Relationship to `cmd/cli`

`cmd/cli` is not a long-term app component.

Keep/migrate these ideas from it:

- Wasmtime component model setup.
- Loading components from paths.
- Reading imports/exports from component types.
- Topological dependency ordering where relevant.
- Forwarding exported WIT interfaces into a linker/registry.
- WIT-like function addressing for invocation.

Do not preserve it as a separate runtime now. The Tauri app already has CLI support and should become the primary host for both UI and command execution.

## Implementation Chunks

### Phase 1: Runtime Skeleton in `cmd/app`

- Create a modular runtime area under `cmd/app/src-tauri/src/runtime/` or equivalent.
- Move/adapt component loading and export inspection ideas from `cmd/cli`.
- Add a registry that can store callable WIT functions/providers.
- Keep current Tauri command bridge minimal while replacing old byte plugin assumptions.

### Phase 2: WASI Filesystem First

- Add Wasmtime WASI/component dependencies to `cmd/app`.
- Register `wasi:filesystem` support during runtime initialization.
- Remove app runtime dependency on the old GAMS virtual mount FS as the primary path.
- Keep only minimal bootstrap native fs reads.

### Phase 3: Frontend Low-Level Runtime Bridge

Expose frontend APIs:

```js
gams.runtime.invoke(target, args)
gams.runtime.addPlugins(paths)
gams.runtime.onCallView(callback)
gams.runtime.addUiPlugin(wit, functions)
```

Start with exact features needed to prove end-to-end calls.

### Phase 4: UI Plugin Provider

- Let frontend register WIT text and JS implementation object.
- Let WASM components import those interfaces.
- Implement blocking request/response bridge from Rust host to frontend.

### Phase 5: Dynamic Views

- Implement `gams:runtime/runtime.call` import for WASM.
- Route to frontend `onCallView`.
- Add view instance registration/unregistration conventions in frontend app code.

### Phase 6: Config-Driven Startup

- Add app/project config loading once primitives are stable.
- Config can request preopens, initial WASM components, and initial UI plugins/views.
- Avoid introducing legacy compatibility shims unless explicitly needed.

## Open Questions

- Exact JS representation for every WIT value kind, especially variants/results/options/flags and 64-bit integers.
- Exact source of WIT text for UI plugins: inline string, file path, generated metadata, or package manifest.
- Whether frontend `invoke` should accept only structured `(target, args)` or also a single expression string.
- How plugin unload/reload should work when other components depend on a removed export.
- How async/promise frontend UI plugin functions map to blocking host imports under Wasmtime.
- How to package/discover frontend UI plugin files once config-driven startup lands.

## Non-Goals

- No long-term separate `cmd/cli` runtime right now.
- No universal `export call(method, bytes)` requirement for all WASM components.
- No GAMS virtual mount FS as the primary filesystem architecture.
- No generic WASM-side dynamic `invoke` unless a concrete need appears.
- No event-only UI bridge for user-confirmation workflows; blocking request/response is required.
