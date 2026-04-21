# NG2 Browser2 Refactor Task

## Purpose

`plugins/ng2/` is a non-destructive clone of `plugins/ng/` for the browser2 migration.

`ng2` is the experimental branch for the new architecture:
- global worker-side WASM plugin in `cmd/browser2`
- handle-based graph/document ownership
- no global active graph
- no `ng_host_resolve`
- plugin-to-plugin calls from `ng2` itself for `fs`, `sql`, and other services
- browser2 view acts as UI/editor only and binds to `ng2` through explicit calls plus shared memory

The original `plugins/ng/` stays untouched as the legacy/working implementation.

## Key Decisions Locked In

1. All graph-mutating/runtime APIs must take a `handle` where graph state is involved.
2. There must be no implicit global active nodegraph.
3. `ng_host_resolve` must be removed, not evolved.
4. Graph save/load and template persistence must move into `ng2` via `sql` plugin calls.
5. Code loading must move into `ng2` via `fs` plugin calls.
6. Browser2 nodegraph view should own only editor/view state:
   - camera
   - selection
   - drag state
   - popup/forms UX
   - rendering
7. Shared graph/runtime state should be exposed from WASM memory in a browser2-friendly way.

## Immediate Work Stages

### Stage 0 — clone and isolate
- [x] clone `plugins/ng` -> `plugins/ng2`
- [x] repoint `plugin.mk` and build script paths to `ng2`
- [ ] verify `ng2` can still be built as an isolated clone before refactoring starts

### Stage 1 — define the new public API
- [ ] draft the `ng2` handle-based exported API in `ng.h`
- [ ] separate document lifecycle, mutation, execution, and storage functions
- [ ] define shared-memory access strategy for browser2 views
- [ ] explicitly remove `ng_host_resolve` from the target API

### Stage 2 — split global state into per-handle state
- [ ] inventory current globals in `main.c`
- [ ] define `NgHandle` / `NgDocument` structures
- [ ] move top-level graph state out of singleton globals into per-handle storage
- [ ] decide what remains truly global (e.g. Lua support caches if any)

### Stage 3 — move persistence into plugin-to-plugin calls
- [ ] move graph load/save into `ng2`
- [ ] move graph listing/query helpers into `ng2`
- [ ] move node-template persistence into `ng2`
- [ ] replace browser view SQL ownership with `ng2` APIs

### Stage 4 — move code loading into plugin-to-plugin calls
- [ ] replace code hydration callback behavior with direct `fs.read` usage inside `ng2`
- [ ] remove runtime dependency on browser-owned code maps
- [ ] keep CLI/browser behavior aligned through the same backend path

### Stage 5 — browser2 integration slice
- [ ] register `ng2` as a global worker-side WASM plugin in `cmd/browser2/app.js`
- [ ] add minimal browser2 nodegraph view bound to one `ng2` handle
- [ ] prove shared-memory rendering path before migrating full editor UX

## Files Expected To Change Early

- `plugins/ng2/ng.h`
- `plugins/ng2/main.c`
- `plugins/ng2/plugin.mk`
- `plugins/ng2/scripts/build-lua-modern.sh`
- `PLAN/singleton/ng2.md`
- `PLAN/view/view-nodegraph2.md`

## Notes

- Do not introduce compatibility shims for browser2 internal communication unless they are truly needed.
- Prefer direct, explicit contracts over generic host callback escape hatches.
- Treat `ng2` as the fresh-start backend for browser2 nodegraph work.
