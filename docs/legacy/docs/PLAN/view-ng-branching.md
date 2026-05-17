# view-ng Branch / Skip Flow Plan

## Goal

Add lightweight branch control to `cmd/browser/view/view-ng.js` graph execution so code nodes can implement `if`, `branch`, and `or/join` behavior without adding special host callbacks or view-owned execution logic.

The feature is runtime/compiler behavior for the current raw node-array graph and `demo/ng/run.lua` code generation path.

## Proposed Code-Node API

Existing code nodes keep:

```lua
inputs[1]
outputs[1]
```

Add branch-state tables attached to the existing input/output tables:

```lua
outputs.active[1] = false -- output-side branch control for output port 1
inputs.active[1]          -- input-side branch state for input port 1
```

Naming decision:

- `outputs.active` is the output-side branch-state table.
- `inputs.active` is the input-side branch-state table.
- Keeping state under `inputs` / `outputs` makes the API describe the same port collection as the data values.
- It reads naturally in OR/join nodes: `if inputs.active[1] then ... elseif inputs.active[2] then ... end`.

Use actual graph port ids as indexes. The current graph/editor creates port ids starting at `1`, so examples should use `outputs.active[1]`, not `outputs.active[0]`, unless the graph explicitly has port id `0` later.

## Semantics

### Output branch control

For every executed code/value node output port:

- default: `outputs.active[outputId] == true`
- setting `outputs.active[outputId] = false` marks all edges from that output as skipped
- skipped output edges propagate skip state downstream

A node's output branch is active only when:

```lua
nodeActive and outputs.active[outputId] ~= false
```

### Input branch state

For each input port on a node:

- `inputs[inputId]` stays the data value, as today
- `inputs.active[inputId]` is a boolean branch-state flag
- named aliases should mirror existing input aliases when names are present:

```lua
inputs["condition"]
inputs.active["condition"]
```

If an input is connected to a skipped output, then:

```lua
inputs.active[inputId] = false
inputs[inputId] = nil
```

If an input is connected to an active output, then:

```lua
inputs.active[inputId] = true
inputs[inputId] = sourceOutputValue
```

Disconnected inputs should stay inactive for branch purposes:

```lua
inputs.active[inputId] = false
inputs[inputId] = nil
```

### Node execution rule

A non-source node executes when at least one connected input is active.

A node is skipped when it has connected inputs and all connected inputs are inactive/skipped. This matches the desired rule: a child with a single input from a skipped branch is skipped, while a join/OR node with another active input can still run.

Source-like nodes with no connected inputs execute normally.

When a node is skipped:

- user code is not executed
- all of its outputs become `nil`
- all of its output branches become inactive/skipped
- progress can report skipped later, but MVP may leave it visually idle/stale

## Example Nodes

### Branch / if node

One input, two outputs:

```lua
local value = inputs[1]
local condition = value == "left"

outputs[1] = value
outputs[2] = value

outputs.active[1] = condition
outputs.active[2] = not condition
```

Only the selected output branch continues.

### OR / join node

Two inputs, one output:

```lua
if inputs.active[1] then
  outputs[1] = inputs[1]
elseif inputs.active[2] then
  outputs[1] = inputs[2]
else
  outputs.active[1] = false
end
```

This node runs if either input branch is active and forwards the active value.

## Compiler Implementation Sketch (`demo/ng/run.lua`)

1. Add generated boolean variables per output, for example:

```lua
local n2_o1 = nil
local n2_o1_active = false
```

2. For each node before execution, compute input activity:

```lua
local __ng_node_active = true -- source node default
-- for connected-input nodes:
local __ng_node_active = n1_o1_active or n3_o1_active
```

3. Emit code-node wrapper like:

```lua
if __ng_node_active then
  __ng_node_start(nodeId)
  local inputs = { active = {} }
  local outputs = { active = {} }

  inputs[1] = n1_o1_active and n1_o1 or nil
  inputs.active[1] = n1_o1_active
  outputs.active[1] = true

  -- user code

  n2_o1 = outputs[1]
  n2_o1_active = outputs.active[1] ~= false
  __ng_node_done(nodeId)
else
  n2_o1 = nil
  n2_o1_active = false
end
```

4. Value nodes should set all output active flags to `true` after assigning literals.

5. Goal output should include both values and activity, so branch-sensitive results are inspectable:

```lua
output = {
  goal = {
    id = 10,
    inputs = { result = n5_o1 },
    active = { result = n5_o1_active },
  },
}
```

## View / Graph Format Impact

MVP should not add new visual port types or persisted graph properties.

`inputs.active` and `outputs.active` are execution-time tables derived from existing input/output ports. This keeps the raw graph format unchanged:

- `inputs` remain connection targets
- `outputs` remain connection sources
- no new serialized branch-state arrays are required

Later UI polish can show skipped edges/nodes using a dedicated execution state if needed.

## Open Questions

- Should disconnected inputs be `active=false` always, or should some node kinds treat missing optional inputs differently?
- Should skipped progress be a first-class visual state in `view-ng.js` (`nodeSkipped` / `edgeSkipped`), or is idle/stale enough for MVP?
- Should code-node scripts get named `outputs.active["name"]` aliases for outputs, mirroring named `inputs` / `inputs.active` aliases?
- Should this live only in `demo/ng/run.lua` temporarily, or move into the future `ng2` singleton compiler/runtime contract?
