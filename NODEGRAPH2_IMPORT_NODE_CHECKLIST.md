# Node Graph 2 Import Node Checklist

## Phase 1: Graph-scoped editor

- [ ] Allow `view-nodegraph2` to load a graph by name/id instead of only `default`.
- [ ] Add a way to open the same editor in a separate popup/panel for a chosen graph.
- [ ] Reload the graph from DB before opening the scoped editor.

## Phase 2: Import node model

- [ ] Add a new `import-node` kind to `plugins/ng`.
- [ ] Persist the referenced subgraph record on the node.
- [ ] Copy boundary ports from imported graph `value`/`goal` nodes.

## Phase 3: Runtime wiring

- [ ] Resolve import-node inputs from connected parent ports first.
- [ ] Fall back to imported graph default `value` data when no connection exists.
- [ ] Trigger imported graph `goal` nodes only for connected parent outputs.
- [ ] Reload the subgraph from DB before each run.

## Phase 4: UX polish

- [ ] Add graph picker/launcher actions where needed.
- [ ] Clarify node labels and import-node naming in the UI.
- [ ] Verify save/load, run, and editing flows still work for standalone graphs.
