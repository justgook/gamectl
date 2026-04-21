# NG2 Rules

This file records the working rules for the fresh-start `ng2` refactor.

## Status

`plugins/ng2/` is an intentionally breaking, non-compatibility branch cloned from `plugins/ng/`.

Work in `ng2` should optimize for the target browser2 architecture, not for preserving legacy behavior.

## Core Rules

1. `ng2` is a **fresh/clean codebase**.
2. Breaking changes are expected and allowed.
3. Do **not** preserve old API shapes just for compatibility.
4. Do **not** add deprecated parameters, compatibility flags, or dual old/new code paths.
5. Do **not** keep a global active nodegraph/document.
6. All graph/document operations must use **explicit handles** where applicable.
7. Do **not** reintroduce view-owned WASM runtime assumptions.
8. Do **not** add host-callback escape hatches like `ng_host_resolve`.
9. `ng2` must perform its own plugin-to-plugin calls for required services.
10. Prefer fail-fast behavior for invalid internal state or missing required data.

## Required Architectural Direction

### Handle-based document ownership

`ng2` must use explicit graph/document handles.

Examples of the intended shape:
- `ng_node_create(handle, nodeId, kind)`
- `ng_node_delete(handle, nodeId)`
- `ng_input_add(handle, nodeId, inputId)`
- `ng_run_start(handle, goalNodeId)`
- `ng_get_info_ptr(handle)`

There must be no hidden fallback like:
- handle `0` means active graph
- omitted handle means global document
- implicit current editor document

Temporary bridge note:
- the current browser2 prototype validates explicit handles on the public API and maps each handle to its own graph slot
- this is still a bridge model, not the final persistence/runtime architecture
- the end state still needs richer per-document ownership, mutation APIs, and storage/runtime integration behind the handle table

### Plugin-to-plugin service access

Responsibilities that used to be hidden behind host callbacks must move into `ng2` itself.

### High-level batch execution is allowed

In addition to low-level handle-based mutation/run APIs, `ng2` may expose higher-level execution helpers such as:
- `ng_run(...)`
- `ng_run_and_close(...)`

This is acceptable as long as:
- the contract is explicit
- there is still no implicit active graph
- graph identity is passed explicitly, e.g. by `handle` or graph name in structured input
- temporary open/load/close behavior is owned by `ng2`, not by host-specific glue
- execution-scope inputs are treated as explicit request data, not hidden host callbacks

Examples:
- code loading -> `fs`
- graph save/load -> `sql`
- template persistence -> `sql`
- future service calls -> explicit plugin contracts

### No `ng_host_resolve`

`ng_host_resolve` is not part of the target architecture and should be removed, not adapted.

## Scope Boundaries

`ng2` should own:
- graph/document lifecycle
- graph mutation
- execution
- persistence through plugin calls
- code loading through plugin calls
- shared runtime state exposed to browser2 views

`ng2` should not own browser UI concerns such as:
- camera/zoom/pan
- selection/highlight state
- drag gesture state
- popup/form state
- browser layout integration

## Migration Intent

The long-term goal is that, once `ng2` is fully refactored and validated, it can replace the legacy `ng` implementation cleanly.
