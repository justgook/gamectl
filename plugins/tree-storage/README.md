# Tree Storage Plugin

A centralized storage system for managing multiple hierarchical trees in GameCtl. This plugin provides CRUD operations for trees and can be accessed by other plugins via `pdk.Call()`.

## Overview

The tree-storage plugin maintains an in-memory map of trees during the WASM module's lifecycle. It provides exported functions for managing trees, nodes, and edges in hierarchical structures.

## Features

- **Centralized Storage**: Single source of truth for all tree structures
- **Plugin Interoperability**: Any plugin can read/write trees via `pdk.Call()`
- **Granular Access**: Operations at tree, node, and edge levels
- **Hierarchical Structure**: Maintains parent-child relationships with cycle prevention
- **Metadata Support**: Store arbitrary key-value data on nodes
- **Simple API**: Clean, focused functions with JSON I/O

## API Reference

### Tree Operations (6 functions)

#### `set`
Creates or updates a tree.

**Input:**
```json
{
  "id": "dungeon-tree",
  "tree": {
    "nodes": {
      "root": {"name": "entrance", "data": {}, "children": []}
    },
    "root": "root"
  }
}
```

**Output:**
```json
{"success": true}
```

#### `get`
Retrieves a tree by ID.

**Input:**
```json
{"id": "dungeon-tree"}
```

**Output:**
```json
{
  "nodes": {...},
  "root": "root"
}
```

#### `setRoot`
Sets the root node ID of a tree.

**Input:**
```json
{
  "id": "dungeon-tree",
  "root": "entrance"
}
```

**Output:**
```json
{"success": true}
```

#### `getRoot`
Gets the root node ID of a tree.

**Input:**
```json
{"id": "dungeon-tree"}
```

**Output:**
```json
{"value": "entrance"}
```

#### `list`
Lists all tree IDs currently in storage.

**Input:**
```json
""
```
(empty string or any JSON - input is ignored)

**Output:**
```json
{"ids": ["dungeon-tree", "world-tree", "quest-tree"]}
```

#### `select`
Queries trees by root node (exact match only in v1).

**Input:**
```json
{"query": "root=entrance"}
```

**Output:**
```json
{"ids": ["dungeon-tree"]}
```

### Node Operations (8 functions)

#### `addNode`
Adds a new node to the tree.

**Input:**
```json
{
  "id": "dungeon-tree",
  "nodeId": "room1",
  "name": "Treasure Room"
}
```

**Output:**
```json
{"success": true}
```

#### `getNode`
Retrieves a node by ID.

**Input:**
```json
{
  "id": "dungeon-tree",
  "nodeId": "room1"
}
```

**Output:**
```json
{
  "name": "Treasure Room",
  "data": {"type": "treasure"},
  "parent": "entrance",
  "children": [{"to": "room2", "name": "north_door"}]
}
```

#### `setNodeData`
Sets a data key-value pair on a node.

**Input:**
```json
{
  "id": "dungeon-tree",
  "nodeId": "room1",
  "key": "type",
  "value": "treasure"
}
```

**Output:**
```json
{"success": true}
```

#### `getNodeData`
Gets a data value from a node.

**Input:**
```json
{
  "id": "dungeon-tree",
  "nodeId": "room1",
  "key": "type"
}
```

**Output:**
```json
{"value": "treasure"}
```

#### `getChildren`
Returns direct children edges of a node.

**Input:**
```json
{
  "id": "dungeon-tree",
  "nodeId": "room1"
}
```

**Output:**
```json
{
  "value": [
    {"to": "room2", "name": "north_door"},
    {"to": "room3", "name": "east_door"}
  ]
}
```

#### `getParent`
Returns parent node ID ("" if root or missing).

**Input:**
```json
{
  "id": "dungeon-tree",
  "nodeId": "room1"
}
```

**Output:**
```json
{"value": "entrance"}
```

#### `traverse`
Performs preorder traversal from a node (root → children).

**Input:**
```json
{
  "id": "dungeon-tree",
  "nodeId": "entrance"
}
```

**Output:**
```json
{
  "nodes": ["entrance", "room1", "room2", "room3"]
}
```

#### `getRandomNode`
Returns a node ID chosen deterministically based on pt ∈ [0, 1].

**Input:**
```json
{
  "id": "dungeon-tree",
  "pt": 0.5
}
```

**Output:**
```json
{"value": "room2"}
```

### Edge Operations (2 functions)

#### `addEdge`
Adds a parent → child relationship. Prevents cycles and multiple parents.

**Input:**
```json
{
  "id": "dungeon-tree",
  "parent": "entrance",
  "child": "room1",
  "name": "north_door"
}
```

**Output:**
```json
{"success": true}
```

**Error if cycle detected:**
```json
{
  "success": false,
  "error": "adding edge would create cycle: room1 → entrance"
}
```

#### `getEntranceEdge`
Returns the edge that connects the parent to this node.

**Input:**
```json
{
  "id": "dungeon-tree",
  "nodeId": "room1"
}
```

**Output:**
```json
{"to": "room1", "name": "north_door"}
```

### Serialization (2 functions)

#### `toJSON`
Serializes a tree to formatted JSON.

**Input:**
```json
{"id": "dungeon-tree"}
```

**Output:**
```json
{
  "nodes": {
    "entrance": {...},
    "room1": {...}
  },
  "root": "entrance"
}
```

#### `fromJSON`
Deserializes a tree from JSON and stores it.

**Input:**
```json
{
  "id": "dungeon-tree",
  "data": {
    "nodes": {...},
    "root": "entrance"
  }
}
```

**Output:**
```json
{"success": true}
```

## Usage Examples

### From Host (CLI/LSP)

```go
import (
    "encoding/json"
    "github.com/justgook/wpm/sdk"
)

// Create a new tree
input := map[string]interface{}{
    "id": "quest-tree",
    "tree": map[string]interface{}{
        "nodes": map[string]interface{}{},
        "root": "start",
    },
}
inputJSON, _ := json.Marshal(input)
manager.Call("tree-storage", "set", inputJSON)

// Add nodes
addNodeInput := map[string]interface{}{
    "id": "quest-tree",
    "nodeId": "quest1",
    "name": "Find the Sword",
}
nodeJSON, _ := json.Marshal(addNodeInput)
manager.Call("tree-storage", "addNode", nodeJSON)

// Add edge
edgeInput := map[string]interface{}{
    "id": "quest-tree",
    "parent": "start",
    "child": "quest1",
    "name": "accept",
}
edgeJSON, _ := json.Marshal(edgeInput)
manager.Call("tree-storage", "addEdge", edgeJSON)
```

### From Another Plugin

```go
import (
    "encoding/json"
    "github.com/justgook/wpm/pdk"
)

// Store generated dungeon tree
dungeonTree := generateDungeonTree()
storeInput := map[string]interface{}{
    "id": "dungeon-1",
    "tree": dungeonTree,
}
inputJSON, _ := json.Marshal(storeInput)
pdk.Call("tree-storage", "set", inputJSON)

// Later, traverse the tree
traverseInput := map[string]string{
    "id": "dungeon-1",
    "nodeId": "entrance",
}
queryJSON, _ := json.Marshal(traverseInput)
_, output, _ := pdk.Call("tree-storage", "traverse", queryJSON)
// Parse output to get list of nodes in traversal order
```

### Building a Dungeon Graph

```go
// Create tree
t := tree.New("entrance")
storeTree("dungeon-graph", t)

// Add rooms
addNode("dungeon-graph", "room1", "Treasure Room")
addNode("dungeon-graph", "room2", "Boss Room")
addNode("dungeon-graph", "room3", "Secret Passage")

// Connect rooms
addEdge("dungeon-graph", "entrance", "room1", "north_door")
addEdge("dungeon-graph", "entrance", "room2", "east_door")
addEdge("dungeon-graph", "room1", "room3", "hidden_door")

// Set room metadata
setNodeData("dungeon-graph", "room1", "hasChest", "true")
setNodeData("dungeon-graph", "room1", "difficulty", "easy")
setNodeData("dungeon-graph", "room2", "hasBoss", "true")

// Traverse from entrance
nodes := traverse("dungeon-graph", "entrance")
// Returns: ["entrance", "room1", "room3", "room2"]
```

## Query Language (v1)

The `select` function supports simple exact-match queries:

**Format:** `key=value`

**Examples:**
- `root=entrance` - Find trees with root="entrance"

Future versions may support:
- Node metadata queries: `node.data.type=treasure`
- Multiple conditions: `root=entrance&nodeCount>10`

## Error Handling

All functions return:
- **Status code**: `0` for success, `1` for error
- **JSON output**: Contains either `success: true` or `error: "message"`

**Example error response:**
```json
{
  "success": false,
  "error": "node already has a parent: room1"
}
```

**Common Errors:**
- `"tree not found: <id>"` - Tree doesn't exist in storage
- `"node not found: <nodeId>"` - Node doesn't exist in tree
- `"parent node not found: <parent>"` - Parent node doesn't exist
- `"node already has a parent: <child>"` - Attempting to add multiple parents
- `"adding edge would create cycle: <parent> → <child>"` - Edge would create a cycle

## Storage Lifecycle

- **In-memory**: Trees are stored in RAM while the WASM module is loaded
- **Session-scoped**: Storage persists across function calls during a single session
- **Non-persistent**: Data is lost when the plugin unloads (host can manage persistence)

## Building

```bash
make plugins-release
# or
tinygo build -target=wasi -o build.nosync/tree-storage.wasm plugins/tree-storage/main.go
```

## Use Cases

### Procedural Dungeon Generation
- Store room hierarchy and connections
- Track parent/child relationships for dungeon layout
- Query nodes by type (treasure rooms, boss rooms, etc.)

### Quest Systems
- Represent quest dependencies as a tree
- Track quest states in node data
- Traverse quest chains

### Dialogue Trees
- Model conversation flows
- Store dialogue options as edges
- Track conversation state in node data

### World Regions
- Hierarchical region structure (continent → country → city → district)
- Navigate through world hierarchy
- Store region metadata (population, climate, etc.)

## Future Enhancements

- **Advanced queries**: Filter nodes by data attributes
- **Bulk operations**: `addNodes`, `addEdges`, `removeNode`, `removeEdge`
- **Tree manipulation**: `subtree`, `graft`, `prune`
- **Path finding**: `findPath`, `getDepth`, `getAncestors`, `getDescendants`
- **Validation**: Tree integrity checks, cycle detection reports
- **Export formats**: DOT format for visualization, custom serialization
- **Host storage integration**: Persistence across sessions
