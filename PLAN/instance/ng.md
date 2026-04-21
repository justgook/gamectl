# ng

- kind: `instance`
- status: `legacy`
- source: `cmd/browser/views/view-nodegraph2.js`

## Description
Current legacy instance-style runtime loaded by `view-nodegraph2` through `pluginManager.load(...)`. This is the main known example of a browser view directly instantiating a WASM runtime on the main thread.

## Current Observations
- `view-nodegraph2` owns the runtime boot sequence and passes browser-only host imports into the WASM module.
- The view keeps direct references to WASM memory/API for rendering, graph mutation, run status, and host resolution.
- The same feature area already mixes direct instance access with routed plugin usage (`sql`, `fs`, and a routed `ng run` path for saved graph batches).

## Migration Target
Move away from direct instance-style loading. The most likely target is:

- runtime logic as `singleton` plugin(s)
- browser rendering/editor surface as `view` plugin(s)
- plugin-to-plugin contracts instead of ad-hoc host resolve callbacks
- current non-destructive fresh-start backend target is `plugins/ng2`
- `ng2` should use explicit handle-based graph APIs and remove `ng_host_resolve`

## Notes
- This file tracks the **current legacy usage**.
- The long-term target is tracked separately in `PLAN/singleton/ng.md` and related view files.
- This area is currently a top priority because it affects responsiveness and future architecture.

## Todo
- [ ] confirm whether any instance-style `ng` runtime must remain temporarily
- [ ] define the replacement plugin boundaries for runtime vs browser view
- [ ] remove direct `pluginManager.load(...)` dependency from `view-nodegraph2`
- [ ] replace host-style resolve behavior with explicit plugin-to-plugin contracts
- [ ] requires clarification
