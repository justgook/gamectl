# ng2

- kind: `singleton`
- status: `migration-needed`
- source: `plugins/ng2`

## Description

Fresh-start browser2-oriented nodegraph backend cloned from `plugins/ng` for non-destructive refactoring.

## Target Shape

- global worker-side WASM plugin in browser2
- manages multiple graph/document handles
- no implicit active graph
- browser2 view binds to one handle explicitly
- graph persistence and code loading happen inside the plugin via plugin-to-plugin calls
- `ng_host_resolve` is removed entirely

## Why A Separate `ng2`

The current `ng` implementation is still tied to:
- legacy instance-style browser view ownership
- host callback resolution
- single-active-graph assumptions in the API shape

`ng2` exists so browser2/backend refactor can proceed without destabilizing the current implementation.

## Expected Responsibilities

- handle lifecycle
- graph mutation API
- execution API
- graph/template persistence through `sql`
- code loading through `fs`
- per-handle shared-memory inspection for browser2 views

## Current First Steps

- [x] clone `plugins/ng` into `plugins/ng2`
- [x] isolate build paths
- [ ] define final handle-based export list in `plugins/ng2/ng.h`
- [~] inventory globals that must become per-handle state
  - current minimal browser2 bridge uses lightweight handles plus per-handle graph slots
  - this intentionally avoids duplicating the older oversized prototype shape while still giving browser2 distinct per-handle shared-memory regions
- [ ] remove `ng_host_resolve` from target API
- [~] wire minimal browser2 integration slice
  - `view-ng` now reads a real `ng2` shared-memory sample through PDK endpoints
