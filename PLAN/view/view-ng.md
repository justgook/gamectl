# view-ng

- kind: `view`
- status: `migration-needed`
- source: `cmd/browser2/views/view-ng.js`

## Description

Browser2 nodegraph editor view.

`view-ng` is the only planned browser2 nodegraph frontend. It must be refactored so all graph editing/rendering state is frontend-owned plain JavaScript data using the raw node-array protocol in `PLAN/ng-protocol.md`.

## Target Shape

Implementation should separate the frontend graph model from WebGL rendering incrementally:

- graph protocol validation/conversion lives outside rendering code
- `view-ng` owns UI/event orchestration and calls model helpers
- WebGL rendering can remain in `view-ng` initially, but should be extracted later once state migration is stable

Current first extraction:

- `cmd/browser2/views/view-ng-state.js` validates/clones raw node arrays and derives render snapshots.

`view-ng` owns:

- graph JSON state
- canvas/WebGL rendering
- node selection and movement
- edge creation/removal by editing input `srcNodeId` / `srcOutputId`
- node editing UI
- graph serialization/deserialization
- a future `run` command hook

For now, it does **not** own or implement:

- graph persistence
- code execution
- code generation
- code/module loading
- import graph resolution
- run/template behavior

## Protocol

The graph protocol is documented in:

- `PLAN/ng-protocol.md`

Important protocol choices:

- graph storage shape is a raw node array
- node kind is numeric
- initial node kinds are `goal`, `code`, `import`, `value`
- edges are embedded in input ports through `srcNodeId` / `srcOutputId`
- output values are opaque strings
- `codePath`, `graphId`, and `graphName` are opaque to the base view

Example:

```json
[
  {
    "id": 1,
    "kind": 2,
    "x": 100,
    "y": 200,
    "name": "Example",
    "codePath": "local:/assets/ng/example.lua",
    "graphId": 0,
    "graphName": "",
    "inputs": [],
    "outputs": [{ "id": 1, "name": "result", "value": "" }]
  }
]
```

## Required View API

`view-ng` should provide methods equivalent to:

```ts
loadGraph(graph: NgNode[]): void
getGraph(): NgNode[]
```

The exact names can be finalized during implementation, but this capability is required.

`loadGraph` should:

- accept the raw node array protocol
- validate required fields loudly
- replace current frontend graph state
- update rendering state from the loaded graph

`getGraph` should:

- return the current graph as the same raw node array protocol
- preserve ids, numeric kinds, positions, names, code paths, graph refs, inputs, outputs, and output string values

## Future Run Command

A `run` command will exist later, but its implementation is intentionally not planned here.

For now:

- `view-ng` may expose a command stub or button placeholder only if useful
- the command should operate on `getGraph()` when implemented
- `view-ng` should not know whether run uses templates, scripts, SQL, FS, or another mechanism

## Migration Notes

- Do not depend on any nodegraph WASM backend.
- Do not use backend-owned graph handles.
- Do not use shared memory as the graph source of truth.
- Do not implement persistence yet.
- Do not interpret `codePath` beyond storing/showing/editing the string.
- Do not infer types from `outputs[].value`.
- Required internal graph fields should be assumed present and malformed graph data should fail loudly.
- Preserve browser2 view UI rules from `cmd/browser2/VIEW_RULES.md` when adding controls/panels.

## Todo

- [x] replace backend/shared-memory graph sample integration with frontend graph JSON state
- [x] implement `loadGraph(graph)` behavior for the raw node array protocol
- [x] implement `getGraph()` behavior for the raw node array protocol
- [x] validate protocol shape on load
- [ ] render nodes and connections from frontend state only
- [ ] update frontend state directly for move/connect/disconnect/edit operations
- [ ] leave `run` as a later command hook
