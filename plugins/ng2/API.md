# NG2 API Draft

Status: scaffolded

Module name: `ng2`

This file captures the public API shape for the browser2-oriented nodegraph backend.
It is intentionally handle-based.

## Core Model

- `ng2` is a global worker-side WASM plugin
- one plugin instance can manage multiple graph/document handles
- graph state is never addressed through an implicit active document
- browser2 views hold a handle and operate on that handle explicitly
- `ng2` performs storage/code access through plugin-to-plugin calls

## Explicit Non-Goals

- no `ng_host_resolve`
- no browser view-owned WASM instance
- no hidden active-graph switching API

## Current Status

The full exported public surface now exists so backend and view work can proceed in parallel.

The plugin also now exposes `__sql_init` for worker/runtime bootstrap.
It currently:
- creates `ng2_graph_storage`
- seeds a `default` graph row if missing

That means:
- final method names are in place
- PDK export routing is in place
- methods not implemented yet fail explicitly with `NG2_ERR_NOT_IMPLEMENTED`
- browser2 currently uses a temporary `ng_debug_load_sample(handle)` helper to populate a sample graph for rendering work

## Transport Shape

Current PDK argument/result shape is intentionally simple:

- scalar integer arguments are passed as ASCII decimal input bytes
- scalar integer results are returned as ASCII decimal output bytes
- status comes from the wasm function return code
- richer request payloads are expected to move to structured text/binary payloads per method as implementations land

## Exported Public API

### Handle lifecycle

- `ng_handle_create() -> handle`
- `ng_handle_close(handle)`
- `ng_handle_close_all()`
- `ng_handle_reset(handle)`

Current scaffold status:
- implemented

### Graph storage

- `ng_graph_open(name) -> handle`
- `ng_graph_open_id(graphId) -> handle`
- `ng_graph_save(handle, name)`
- `ng_graph_list()`
- `ng_graph_delete(name)`

Current scaffold status:
- exported
- currently returns `NG2_ERR_NOT_IMPLEMENTED`

### Template storage

- `ng_template_save(name, payload)`
- `ng_template_list()`
- `ng_template_delete(name)`

Current scaffold status:
- exported
- currently returns `NG2_ERR_NOT_IMPLEMENTED`

### Graph mutation

Every graph mutation function takes `handle` first.

- `ng_node_create(handle, nodeId, kind)`
- `ng_node_replace(handle, nodeId, kind)`
- `ng_node_delete(handle, nodeId)`
- `ng_input_add(handle, nodeId, inputId)`
- `ng_output_add(handle, nodeId, outputId)`
- `ng_input_connect(handle, nodeId, inputId, srcNodeId, srcOutputId)`
- `ng_input_disconnect(handle, nodeId, inputId)`
- `ng_node_set_arg(handle, nodeId, argIndex, type, a, b)`

Current scaffold status:
- exported
- currently returns `NG2_ERR_NOT_IMPLEMENTED`

### Execution

Low-level interactive execution surface:
- `ng_run_start(handle, goalNodeId)`
- `ng_run_cancel(handle)`
- `ng_run_all_goals(handle)`
- `ng_run_goal(handle, goalNodeId)`
- `ng_exec_clear(handle, nodeId, recursiveDownstream)`
- `ng_exec_clear_all(handle)`

Higher-level execution helpers:
- `ng_run(...)`
- `ng_run_and_close(...)`

Current scaffold status:
- `ng_run` implemented as an early structured batch helper
- `ng_run_and_close` implemented as an early structured one-shot batch helper
- low-level interactive execution methods still return `NG2_ERR_NOT_IMPLEMENTED`

## Proposed high-level run contracts

These are the recommended stable directions so browser, CLI, and automation can code against them before the wasm bodies are finished.

### `ng_run(input)`

Intended role:
- execute an already-open handle or a named stored graph using one structured request shape
- return collected goal-node payloads through normal PDK output

Recommended request JSON:

```json
{
  "handle": 12,
  "graph": "optional-name-if-handle-not-provided",
  "goal": 0,
  "inputs": {
    "entry": {"seed": 123, "theme": "forest"}
  },
  "close": false
}
```

Rules:
- either `handle` or `graph` must be supplied
- `goal: 0` means run all goals
- `inputs` provides execution-scope values, similar in spirit to import-node boundary inputs, but without mutating stored graph structure
- if `graph` is supplied and no `handle` is supplied, `ng2` may open/load internally
- if `close: true`, the temporary/opened handle is closed after execution

Current prototype response JSON shape:

```json
{
  "success": true,
  "handle": 12,
  "graph": "default",
  "goalCount": 1,
  "goals": [
    {
      "goalNodeId": 6,
      "payload": {
        "id": 6,
        "requestedGoal": 0,
        "inputs": {"entry": {}},
        "result": "sample-goal"
      }
    }
  ]
}
```

This is intentionally temporary:
- current implementation uses the sample graph/runtime scaffold
- request-scoped `inputs` are already plumbed through to the goal payload
- real graph loading, execution, and true goal collection still need to replace the sample behavior

### `ng_run_and_close(input)`

Intended role:
- one-shot batch execution helper for CLI, agents, and browser actions that should not keep an editor/runtime handle alive

Recommended request JSON:

```json
{
  "graph": "default",
  "goal": 0,
  "inputs": {
    "entry": {"seed": 123, "theme": "forest"}
  }
}
```

Behavior:
1. open/load the named graph
2. apply execution-scope inputs
3. execute requested goal or all goals
4. collect goal payloads
5. close the temporary handle
6. return structured JSON result through PDK output

This method is a good fit for:
- CLI
- automation
- browser commands like “run saved graph now”

It is intentionally close to the old CLI/batch `run(graphName)` direction, but generalized to structured inputs and explicit goal-result output.

### Shared memory / inspection

- `ng_get_info_ptr(handle)`
- `ng_get_info_size()`

Current scaffold status:
- implemented

Current bridge note:
- each created handle owns one graph slot in the current prototype
- `ng_get_info_ptr(handle)` returns that handle's `Ng2Info` slot address
- browser2 can already render directly from those per-handle shared-memory regions

## Temporary Development Helper

- `ng_debug_load_sample(handle)`

This is not part of the intended long-term public contract.
It exists only to keep browser2 renderer/integration work moving while mutation and storage methods are implemented.

## Internal Service Calls

`ng2` should use explicit plugin calls for:
- `__sql_init` already uses `sql.exec` to create and seed `ng2_graph_storage`
- `sql.query` / `sql.exec` for graph storage and templates
- `fs.read` for code loading
- any future runtime services needed by node execution
