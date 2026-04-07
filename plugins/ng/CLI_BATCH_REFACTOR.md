# NG CLI/Batch Refactor Plan

## Goal

Make `ng` execution self-contained enough that:

```bash
gams run ng run --input default
```

works through the generic CLI without adding `ng`-specific logic to the CLI.

The CLI should stay thin and generic:
- bootstrap runtime
- load plugins from registry
- call `<plugin>.<function>`
- print result

All graph-specific behavior should live in `ng`.

---

## Design Direction

### Keep CLI generic

The CLI must **not** know about:
- node graphs
- graph hydration
- code-path loading
- goal collection
- browser-style request/response execution

Instead, `ng.run(input)` should own the full batch flow.

### Make `ng` more self-sufficient

`ng` should rely primarily on:
- PDK input/output
- sync plugin-to-plugin calls
- `sql` plugin
- `fs` plugin

and much less on custom browser-oriented host callbacks.

---

## Architectural Split

### 1. Batch mode

Used by:
- CLI
- potentially browser "run saved graph"

Entry point:
- `ng.run(graphName)`

Responsibilities:
- load graph from storage
- load code from files
- execute graph
- collect goal outputs
- return structured JSON

### 2. Interactive mode

Used by:
- browser node editor

Responsibilities:
- live graph edits
- in-memory graph mutation
- run progress visualization
- event callbacks for rendering

This mode can keep using low-level `ng_*` APIs and callbacks.

---

## Key Insight

Most current `ng` browser host mediation appears to be replaceable in batch mode.

### Current browser-oriented pieces

- `ng_host_request`
- `ng_run_response`
- `ng_run_response_error`
- `ng_host_resolve`

These exist because browser/editor mode currently participates in execution.

### Desired batch-mode replacement

Use normal plugin/runtime mechanisms instead:
- `sql.query(...)` to load graph JSON
- `fs.read(...)` to load Lua/code files
- direct sync plugin-to-plugin calls via PDK for pipeline/plugin execution

---

## Proposed Refactor

### A. Replace `host.awaitCall(...)` internals with sync plugin calls

Current idea:
- Lua `host.awaitCall(service, method, payload)` currently flows through custom host request/response logic.

Target:
- back it with direct sync plugin calls via PDK/plugin ABI
- keep Lua API shape if desired for compatibility
- implementation becomes sync under the hood

Possible options:

#### Option A1: keep `host.awaitCall(...)` name
- no Lua/user-code changes
- implementation becomes synchronous internally

#### Option A2: introduce `host.call(...)`
- preferred semantic name for sync usage
- optionally keep `host.awaitCall(...)` as alias for compatibility

Recommended:
- implement `host.call(...)`
- keep `host.awaitCall(...)` as compatibility alias to the same sync path initially

### B. Make `ng.run(graphName)` truly execute a graph

Current state:
- `run()` returns placeholder JSON

Target behavior:
1. read graph name from PDK input
2. query `nodegraph2_storage` using `sql.query`
3. parse stored graph JSON
4. initialize/clear runtime graph state
5. apply serialized graph
6. load code files through `fs.read`
7. execute all goals
8. collect goal payloads internally
9. return final structured JSON through PDK output

### C. Reduce custom host hooks to interactive-only responsibilities

Keep for editor/live mode:
- `ng_on_node_changed`
- `ng_on_run_event`
- `ng_on_goal_reached`

Potentially reduce/remove from batch path:
- `ng_host_request`
- much of `ng_host_resolve`

---

## Target Runtime Dependencies for Batch Mode

`ng.run(graphName)` should primarily depend on:

### `sql`
Used for:
- load graph JSON from `nodegraph2_storage`
- load subgraph/import graph JSON by id if needed

### `fs`
Used for:
- read Lua/code source from `codePath`
- read local assets referenced by graph code

### PDK/plugin calls
Used for:
- `treegen.gen`
- `minimap.gen`
- `automap.automap`
- `image.*`
- `pack.*`
- `respack.*`
- any other runtime plugin calls

---

## Why This Is Better

### Shared semantics across CLI and browser

The same batch graph run path can work in both environments.

### Simpler browser host

Browser focuses on:
- editor state
- rendering
- interactivity

not on orchestrating execution.

### Thinner CLI

CLI stays plugin-agnostic.

### Easier testing

`default` graph can become a real integration test for `ng.run`.

---

## Suggested Implementation Order

### Phase 1: investigate and map dependencies
- audit `default` graph dependencies
- classify each dependency as:
  - plugin call
  - fs read
  - sql query
  - still interactive-only host behavior

### Phase 2: add sync call path inside `ng`
- implement sync Lua host call helper backed by PDK/plugin calls
- make `host.awaitCall(...)` use that path or alias it

### Phase 3: implement real batch `run(graphName)`
- replace placeholder
- load graph via `sql`
- load code via `fs`
- run all goals
- collect result JSON

### Phase 4: validate in CLI
- `gams run ng run --input default`
- use `default` as integration proof

### Phase 5: simplify browser glue
- remove execution-specific mediation no longer needed
- keep only live editor/runtime callbacks

---

## Open Questions

1. Should `host.awaitCall(...)` remain the public Lua API name even when sync?
2. Should batch mode still use `ng_host_resolve` internally for some graph cases, or move entirely to `sql`/`fs`?
3. Should there be a second batch API like `run_json(serializedGraph)` for unsaved browser graphs?
4. How much of the current low-level graph application code can be reused directly inside `run()`?

---

## Expected End State

### CLI

Still generic:

```bash
gams run <plugin> <function> --input <value>
```

### NG

Provides:
- low-level interactive graph API
- high-level batch execution API

### Browser

Provides:
- editor UI
- live graph mutation
- execution visualization

not core execution orchestration.

---

## Immediate Next Step

Implement the first real batch milestone:
- replace placeholder `ng.run`
- make it load `default` from `nodegraph2_storage`
- execute all goals using plugin/fs/sql paths
- return structured result JSON
