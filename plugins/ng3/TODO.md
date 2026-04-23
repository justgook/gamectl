# NG3 TODO

Purpose: track the short-term migration of `plugins/ng3/` into the real browser2/CLI backend while keeping the old singleton runtime model.

## Current phase goal

Make `ng3` work like old `ng`, but:
- in `cmd/browser2`
- with PDK/plugin-call-based communication
- with no host-facing callback API
- with singleton runtime state retained for now

## Explicitly postponed

- handle-based backend API
- multi-document runtime
- live update/event push model
- shared-memory event protocol redesign
- browser2 reactive sync redesign

---

## Phase 1 — remove host-facing API from `ng3`

### 1. Remove host callback imports from `plugins/ng3/ng.h`
- [x] remove `ng_on_node_changed`
- [x] remove `ng_on_run_event`
- [x] remove `ng_on_goal_reached`
- [x] remove `ng_host_resolve`
- [ ] remove any no-longer-needed host callback enums/constants tied only to that API

### 2. Remove host callback usage from `plugins/ng3/main.c`
- [ ] remove `notify_node_changed(...)`
- [ ] remove `notify_run_event(...)`
- [x] remove `notify_goal_reached(...)`
- [ ] remove any code paths that depend on callback delivery to host/browser

### 3. Replace host resolution with backend-owned PDK calls
- [x] replace graph loading that still uses `ng_host_resolve(..., NG_RESOLVE_GRAPH, ...)`
- [x] replace code loading that still uses `ng_host_resolve(..., NG_RESOLVE_CODE, ...)`
- [x] replace value resolution that still uses `ng_host_resolve(..., NG_RESOLVE_VALUE, ...)`
- [x] ensure runtime/plugin execution uses PDK/plugin calls only

### 4. Keep singleton state intact for now
- [ ] preserve old singleton graph/runtime model
- [ ] do not introduce handles yet
- [ ] do not introduce live event plumbing yet

---

## Phase 2 — make persistence backend-owned

### 5. Move graph storage fully into `ng3`
- [x] implement graph open/load via `sql.query`
- [x] implement graph save via `sql.exec`
- [x] implement graph list via `sql.query`
- [x] implement graph delete if needed by browser2 flow
- [ ] stop relying on browser-owned SQL path for graph persistence

### 6. Move code loading fully into `ng3`
- [ ] load code/file content through `fs.read`
- [ ] stop relying on browser-owned code maps / callback hydration
- [ ] verify subgraph/import-related code paths also use backend-owned loading

---

## Phase 3 — keep old singleton mutation/runtime API working in browser2

### 7. Preserve the current singleton mutation API
- [ ] `ng_init`
- [ ] `ng_clear_graph`
- [ ] node create/replace/delete
- [ ] input/output add/remove
- [ ] connect/disconnect
- [ ] set arg
- [ ] run / run goal / clear exec
- [ ] verify these remain usable from browser2 through the runtime/plugin manager

### 8. Shared memory / state inspection
- [ ] keep `ng_get_info_ptr` working for browser2
- [ ] keep `ng_get_info_size` or equivalent size access working if needed
- [ ] use memory as passive read-model only for now
- [ ] no new live sync/event system in this phase

---

## Phase 4 — make one-shot `run` real for CLI and browser2 command usage

### 9. Implement real `run(input)`
- [ ] parse request input
- [ ] load graph from storage inside `ng3`
- [ ] hydrate graph into runtime state
- [ ] resolve code through `fs.read`
- [ ] execute requested goal or all goals
- [ ] collect goal outputs internally
- [ ] return structured JSON through PDK output

### 10. Define the temporary stable `run` contract
- [ ] support input shape based on graph name/request JSON
- [ ] merge request-scoped input values with graph input-node/boundary semantics
- [ ] return all goal results in structured JSON
- [ ] ensure no handle is created/required for `run`

### 11. CLI proof
- [ ] verify `gams run ng3 run --input ...` works through generic CLI
- [ ] keep CLI generic; no `ng3`-specific CLI logic

---

## Phase 5 — adapt browser2 to the simplified backend contract

### 12. Switch browser2 view flow to backend-owned persistence/execution
- [x] `view-ng` calls `ng3` directly
- [x] browser2 no longer owns graph SQL persistence for nodegraph data
- [x] browser2 no longer owns code resolution
- [x] browser2 refreshes/re-reads state explicitly after operations

### 13. Temporary browser2 interaction model
- [ ] mutation call -> refresh state
- [ ] save/load call -> refresh state
- [ ] run call -> refresh state
- [ ] no host callback/event dependency

---

## Phase 6 — validation

### 14. Browser2 proof
- [ ] open graph
- [ ] edit graph
- [ ] save graph
- [ ] run graph
- [ ] verify singleton runtime works end-to-end in browser2

### 15. Regression/cleanup
- [ ] remove dead legacy host-bridge code from `ng3`
- [ ] remove stale docs/comments that still describe host-callback architecture
- [x] keep this TODO updated while implementing

---

## Success criteria for this phase

- [ ] `ng3` has no host callback imports
- [ ] graph/code resolution is backend-owned via PDK calls
- [ ] browser2 can load/edit/save/run through `ng3`
- [ ] `ng3.run(...)` works in CLI
- [ ] singleton runtime model still works without handles
