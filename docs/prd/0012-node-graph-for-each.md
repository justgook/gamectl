# Node Graph For Each

## Status

Complete

## Source material

- `docs/contexts/project-composition/CONTEXT.md`
- `packages/util/ng-node-graph.js`
- `views/view-ng.js`
- `examples/demo/ng/compile-graph.lua`

## Problem

Node Graph Group Nodes compose a child graph but execute it only once. Authors need a compositional iteration node that can transform, zip, filter, and perform ordered side effects over arrays without moving the iteration logic into one opaque Code Node.

## Goals

- Add a first-class For Each Node with an editable inline child Node Graph.
- Execute the child graph sequentially over one or more arrays.
- Expose each input's current item, one-based current index, and complete original array.
- Collect child Graph Outputs into arrays.
- Support global skip and break control.
- Compose with nested For Each Nodes and inline or linked Group Nodes.

## Non-goals

- Linked storage directly on For Each Nodes.
- Parallel iteration.
- Per-output skip or break behavior.
- Sparse-array or scalar broadcasting semantics.
- Partial results after an iteration failure.

## Requirements

### Authored graph

- For Each is a distinct Node Graph node kind that owns an inline `childGraph`.
- A new For Each starts with one For Each Input named `items`.
- A For Each child graph requires at least one For Each Input.
- Each For Each Input creates one required parent input port and exposes exactly three fixed child outputs:
  - `Item`: the current item;
  - `Index`: the current one-based index;
  - `Array`: the complete original input array.
- The fixed outputs cannot be added, removed, or renamed. Renaming the For Each Input renames its parent input port.
- Graph Outputs inside the child graph become array output ports on the parent For Each Node.
- A child graph may have zero Graph Outputs for side-effect-only execution.
- An optional Iteration Control node exposes fixed boolean `Skip` and `Break` inputs.
- A child graph allows at most one Iteration Control node.
- Graph Inputs are valid only inside Group Nodes. For Each Inputs and Iteration Control are valid only directly inside For Each Nodes. Graph Outputs are valid inside either composition.
- Goal Nodes are not valid within For Each execution bodies; zero-output Code or For Each Nodes provide side-effect run targets.
- For Each and Group Nodes may nest within one another.
- Copy, paste, undo, redo, breadcrumbs, rename, boundary synchronization, and execution-location tracking include For Each child graphs.

### Runtime inputs

- Every parent input must be connected and active when the For Each executes.
- Every input value must be a dense array. Scalars, objects, sparse arrays, nil values, and inactive inputs fail execution.
- Empty arrays are valid.
- All input arrays must have equal lengths; unequal lengths fail execution.
- Iteration count is the shared input-array length.

### Execution and collection

- Iterations execute sequentially in ascending one-based index order.
- Each iteration's side effects complete before the next iteration begins.
- Output arrays preserve retained iteration order.
- Every retained iteration must produce one active, non-nil value for every Graph Output; otherwise execution fails.
- Any child-node failure aborts the graph run without returning partial outputs.
- If every input is empty, the body executes zero times and every Graph Output produces an empty array.
- A zero-output For Each Node is a graph run target, like a zero-output Code Node.

### Iteration control

- Unconnected or inactive Skip and Break inputs behave as false.
- Active control values must be booleans or execution fails.
- Skip discards every collected value for the current iteration and continues.
- Break discards every collected value for the current iteration and stops the sequence.
- Break takes precedence when both controls are true.
- Skip and Break are global to the iteration, so multiple collected output arrays remain aligned.

### Storage and composition

- For Each supports inline child storage only.
- Reusable or separately stored iteration behavior is represented by placing the For Each inside a Group using Linked Group Storage.
- Execution projection preserves For Each structure for the compiler while flattening Group boundaries.
- Repeated linked Group occurrences containing For Each Nodes receive distinct execution and boundary identities.

## Delivery slices

### Slice 1 — iteration and collection

- For Each and For Each Input schemas.
- Inline child-graph editing and navigation.
- Equal-length input validation and sequential execution.
- Strict array validation and Graph Output collection.
- Multiple inputs and outputs, nesting, and zero-output run targets.

### Slice 2 — iteration control

- Iteration Control schema and editor support.
- Global Skip and Break execution.
- Break-over-skip precedence and strict boolean validation.

## Acceptance criteria

- A two-input For Each behaves like a strict zip: equal-length arrays iterate together, while unequal lengths fail loudly.
- Nested For Each Nodes execute and collect in deterministic order.
- Skip can implement filtering and omits the iteration from every output.
- Break omits its iteration and prevents later iterations.
- Missing inputs, malformed arrays, missing retained outputs, and malformed control values fail loudly.
- A zero-output For Each executes its side-effect body for every iteration.
- A linked Group containing a For Each receives occurrence-specific execution and boundary ids.
- Schema, projection, compiler, and browser DOM-contract tests cover the new behavior.

## Related ADRs

- None. The requirements extend existing Node Graph composition and do not introduce a separate hard-to-reverse architectural policy.
