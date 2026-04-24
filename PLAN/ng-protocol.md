# NG Graph Protocol

- status: `draft`
- owner: `view-ng`
- applies to: `cmd/browser2/views/view-ng.js`

## Direction

The browser2 nodegraph model is **frontend-owned graph JSON**.

`view-ng` must be refactored so the graph state is plain JavaScript data using this protocol. For now, `view-ng` only needs to:

- accept graph JSON in this schema
- validate required structure loudly
- render/manipulate that frontend state
- expose methods to load graph JSON into the view
- expose methods to return graph JSON from the view

Execution, code generation, templating, persistence, and graph import resolution are intentionally outside this document for now.

A future `run` command may take the current graph JSON and pass it to a separate implementation, but `view-ng` should not know or care how that run implementation works.

## Non-Goals

Do not design browser2 nodegraph around:

- backend-owned graph handles
- backend/runtime nodegraph state
- shared-memory graph mutation as the source of truth
- old host callbacks
- view-local runtime loading
- run/template details
- persistence details

## Storage Shape

Use a **raw node array**.

Do not wrap the graph in an envelope like `{ "version": 1, "nodes": [...] }` for the first browser2 protocol.

```json
[
  {
    "id": 1,
    "kind": 2,
    "x": 100,
    "y": 200,
    "name": "Example Code Node",
    "codePath": "local:/assets/ng/example.lua",
    "graphId": 0,
    "graphName": "",
    "inputs": [
      { "id": 1, "name": "input", "srcNodeId": 2, "srcOutputId": 1 }
    ],
    "outputs": [
      { "id": 1, "name": "result", "value": "" }
    ]
  },
  {
    "id": 2,
    "kind": 4,
    "x": 20,
    "y": 200,
    "name": "Literal",
    "codePath": "",
    "graphId": 0,
    "graphName": "",
    "inputs": [],
    "outputs": [
      { "id": 1, "name": "", "value": "42" }
    ]
  }
]
```

## Node Kind Enum

Use **numeric node kinds**.

| Kind | Name | View Meaning |
| ---: | --- | --- |
| `1` | `goal` | Target/sink node for a run command. |
| `2` | `code` | Node that points at a code/module path. |
| `3` | `import` | Node that points at another graph. |
| `4` | `value` | Literal value node. |

`view-ng` may use readable names internally for UI labels, but the saved protocol uses numbers.

## Node Object

```ts
type NgNode = {
  id: number
  kind: 1 | 2 | 3 | 4
  x: number
  y: number
  name: string
  codePath: string
  graphId: number
  graphName: string
  inputs: NgInput[]
  outputs: NgOutput[]
}
```

All fields are required in browser2 internal graph JSON.

Meaning for `view-ng`:

- `id` — unique node id inside the graph.
- `kind` — numeric node kind.
- `x` / `y` — editor-space coordinates.
- `name` — display name.
- `codePath` — opaque string shown/edited for `code` nodes.
- `graphId` — opaque graph reference id for `import` nodes.
- `graphName` — opaque graph reference name for `import` nodes.
- `inputs` — input ports and their current connection source.
- `outputs` — output ports and optional string value.

`view-ng` should not interpret `codePath` beyond displaying/editing it. Path schemes such as `local:/...`, `/...`, and `http://...` are meaningful to future code editing/saving/running behavior, not to the base graph view state model.

## Input Object

```ts
type NgInput = {
  id: number
  name: string
  srcNodeId: number
  srcOutputId: number
}
```

Edges are embedded in input ports.

A connected input points to a source node output:

```json
{ "id": 1, "name": "image", "srcNodeId": 16, "srcOutputId": 1 }
```

An unconnected input uses:

```json
{ "srcNodeId": 0, "srcOutputId": 0 }
```

`view-ng` should preserve unconnected inputs exactly as graph state. It should not decide whether an input is required for execution.

## Output Object

```ts
type NgOutput = {
  id: number
  name: string
  value: string
}
```

`value` remains an opaque string.

`view-ng` should not infer types from `outputs[].value`. No JSON/number/bool typing is part of this protocol yet.

## Node Kinds

### `value` node

A literal-value node from the view's perspective.

```json
{
  "id": 4,
  "kind": 4,
  "x": 3264,
  "y": 286,
  "name": "RSPK",
  "codePath": "",
  "graphId": 0,
  "graphName": "",
  "inputs": [],
  "outputs": [
    { "id": 1, "name": "", "value": "{\"_file\":\"local:/assets/respack/game2.rspk.json\"}" },
    { "id": 2, "name": "", "value": "/data.rspk" }
  ]
}
```

`view-ng` behavior:
- render it as a value node
- allow output values to be edited later
- preserve output string values exactly

### `goal` node

A target/sink node from the view's perspective.

```json
{
  "id": 5,
  "kind": 1,
  "x": 4066,
  "y": 273,
  "name": "THE BUILD",
  "codePath": "",
  "graphId": 0,
  "graphName": "",
  "inputs": [
    { "id": 2, "name": "error", "srcNodeId": 3, "srcOutputId": 2 }
  ],
  "outputs": []
}
```

`view-ng` behavior:
- render it as a goal node
- allow connections into its inputs
- future `run` command may use selected goal nodes, but that is not part of this protocol yet

### `code` node

A node with an opaque `codePath` string.

```json
{
  "id": 2,
  "kind": 2,
  "x": 1162,
  "y": 290,
  "name": "Tilemap Scaler",
  "codePath": "local:/assets/ng/pipeline-tilemap-scaler.lua",
  "graphId": 0,
  "graphName": "",
  "inputs": [
    { "id": 1, "name": "inputMapId", "srcNodeId": 11, "srcOutputId": 1 }
  ],
  "outputs": [
    { "id": 1, "name": "outputMapId", "value": "" },
    { "id": 2, "name": "error", "value": "" }
  ]
}
```

`view-ng` behavior:
- render it as a code node
- show/edit `codePath` later through UI
- preserve input/output ports
- do not load, parse, compile, or execute the referenced code

### `import` node

A node that points at another graph using `graphId` and/or `graphName`.

```json
{
  "id": 10,
  "kind": 3,
  "x": 100,
  "y": 100,
  "name": "Shared Pipeline",
  "codePath": "",
  "graphId": 42,
  "graphName": "shared-pipeline",
  "inputs": [],
  "outputs": [
    { "id": 1, "name": "result", "value": "" }
  ]
}
```

`view-ng` behavior:
- render it as an import node
- preserve `graphId` and `graphName`
- do not resolve the imported graph

Whether imported graphs live in SQL or FS is still open and is not part of the view protocol.

## Required `view-ng` API Shape

The exact JavaScript method names can change during implementation, but `view-ng` needs this capability:

```ts
loadGraph(graph: NgNode[]): void
getGraph(): NgNode[]
```

Expected behavior:

- `loadGraph` replaces the current frontend state with the provided raw node array.
- `getGraph` returns the current graph as the same raw node array protocol.
- Returned graph JSON should preserve node ids, kind numbers, coordinates, names, code paths, graph refs, inputs, outputs, and output string values.

Persistence is intentionally skipped for now. Later code can call these methods and decide whether to load/save through SQL, FS, or another source.

## Validation Rules

Browser2 internal code should fail loudly on malformed required graph data.

Minimum validation for `loadGraph`:

- graph is an array
- every node has required fields
- `id`, `kind`, `x`, `y`, `graphId` are numbers
- `kind` is one of `1`, `2`, `3`, `4`
- `name`, `codePath`, `graphName` are strings
- `inputs` and `outputs` are arrays
- input ids/source refs are numbers
- output ids are numbers and output values are strings
- node ids are unique
- connected `srcNodeId` references point to an existing node unless `srcNodeId` is `0`

Do not add graceful fallback/defaulting for missing internal graph fields.

## Open Questions

- How will the future `run` command receive/use the graph?
- Will import graph references eventually resolve through SQL, FS, or both?
- What popup/editor owns creation/editing of `codePath` and graph import references?
