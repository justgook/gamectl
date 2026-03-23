# Node Graph 2 Import Node Spec

## Goal

Add a reusable `import-node` that wraps a saved graph record and exposes it as a single node in a parent graph.

The wrapped graph stays a normal standalone graph. It can still be run directly with `value` and `goal` nodes.

## Core Model

- A graph is always stored as a full DB record.
- `value` nodes define graph inputs.
- `goal` nodes define graph outputs.
- `import-node` references one saved graph record by stable graph id.
- The imported graph is not copied into the parent graph.

## Import Node Shape

The import node should look like any other node:

- title from the saved graph name
- inputs copied from the imported graph's `value` nodes
- outputs copied from the imported graph's `goal` nodes
- normal layout/selection/connection behavior

## Execution Rules

Before each run:

- reload the imported graph from DB
- treat the DB record as the source of truth

Input mapping:

- if a parent input is connected, use that value
- otherwise use the default value defined in the imported graph's `value` node

Output mapping:

- only connected parent outputs activate the imported graph's matching `goal` nodes
- unconnected outputs stay inactive

Standalone execution:

- opening the graph directly should behave exactly as today
- running selected goals or running all goals should still work on the graph record itself

## Editing Rules

- Do not edit the imported graph inline inside the parent graph view.
- Editing happens in a separate panel/window.
- The editor reuses `view-nodegraph2.js`, but is scoped to the selected graph record by id.
- Saving writes back to the same DB record.
- Reload before edit and before run.

## UI Behavior

- `import-node` should not introduce a special editor flow in the parent canvas.
- It should present the same node affordances as other nodes.
- The graph name already provides the identity needed for display.

## Suggested Terms

- `import-node`: runtime wrapper node
- `subgraph`: the saved graph being imported
- `value`: input boundary node
- `goal`: output boundary node

## Implementation Notes

- `plugins/ng` will need a new node kind for `import-node`.
- `view-nodegraph2.js` will need graph loading/saving scoping for the external editor panel.
- The runtime should resolve import-node ports from the referenced graph on demand.
