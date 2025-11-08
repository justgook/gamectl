# Tilemap Storage Plugin

A centralized storage system for managing multiple tilemaps in GameCtl. This plugin provides CRUD operations for tilemaps and can be accessed by other plugins via `pdk.Call()`.

## Overview

The tilemap-storage plugin maintains an in-memory map of tilemaps during the WASM module's lifecycle. It provides 17 exported functions for managing tilemaps, layers, and individual tiles.

## Features

- **Centralized Storage**: Single source of truth for all tilemaps
- **Plugin Interoperability**: Any plugin can read/write tilemaps via `pdk.Call()`
- **Granular Access**: Operations at tilemap, layer, and tile levels
- **Metadata Queries**: Find tilemaps and layers by metadata
- **Simple API**: Clean, focused functions with JSON I/O

## API Reference

### TileMap Operations (6 functions)

#### `set`
Creates or updates a tilemap.

**Input:**
```json
{
  "id": "map1",
  "map": {
    "layers": [...],
    "meta": {"tileWidth": "32", "tileHeight": "32"}
  }
}
```

**Output:**
```json
{"success": true}
```

#### `get`
Retrieves a tilemap by ID.

**Input:**
```json
{"id": "map1"}
```

**Output:**
```json
{
  "layers": [...],
  "meta": {...}
}
```

#### `setMeta`
Sets a metadata key-value pair on a tilemap.

**Input:**
```json
{
  "id": "map1",
  "key": "tileWidth",
  "value": "32"
}
```

**Output:**
```json
{"success": true}
```

#### `getMeta`
Gets a metadata value from a tilemap.

**Input:**
```json
{
  "id": "map1",
  "key": "tileWidth"
}
```

**Output:**
```json
{"value": "32"}
```

#### `list`
Lists all tilemap IDs currently in storage.

**Input:**
```json
""
```
(empty string or any JSON - input is ignored)

**Output:**
```json
{"ids": ["map1", "map2", "minimap"]}
```

#### `select`
Queries tilemaps by metadata (exact match only in v1).

**Input:**
```json
{"query": "tileWidth=32"}
```

**Output:**
```json
{"ids": ["map1", "map2"]}
```

### TileLayer Operations (9 functions)

#### `setLayer`
Sets a layer at a specific index (creates if needed).

**Input:**
```json
{
  "id": "map1",
  "index": 0,
  "layer": {
    "width": 20,
    "data": [0, 1, 2, ...],
    "meta": {"name": "ground"}
  }
}
```

**Output:**
```json
{"success": true}
```

#### `getLayer`
Retrieves a layer by index.

**Input:**
```json
{
  "id": "map1",
  "index": 0
}
```

**Output:**
```json
{
  "width": 20,
  "data": [0, 1, 2, ...],
  "meta": {"name": "ground"}
}
```

#### `setLayerWidth`
Sets the width of a layer.

**Input:**
```json
{
  "id": "map1",
  "index": 0,
  "value": 50
}
```

**Output:**
```json
{"success": true}
```

#### `getLayerWidth`
Gets the width of a layer.

**Input:**
```json
{
  "id": "map1",
  "index": 0
}
```

**Output:**
```json
{"value": 50}
```

#### `setLayerData`
Sets the entire data array of a layer.

**Input:**
```json
{
  "id": "map1",
  "index": 0,
  "data": [0, 1, 2, 3, 4, 5, ...]
}
```

**Output:**
```json
{"success": true}
```

#### `getLayerData`
Gets the entire data array of a layer.

**Input:**
```json
{
  "id": "map1",
  "index": 0
}
```

**Output:**
```json
{"value": [0, 1, 2, 3, ...]}
```

#### `setLayerMeta`
Sets a metadata key-value pair on a layer.

**Input:**
```json
{
  "id": "map1",
  "index": 0,
  "key": "name",
  "value": "ground"
}
```

**Output:**
```json
{"success": true}
```

#### `getLayerMeta`
Gets a metadata value from a layer.

**Input:**
```json
{
  "id": "map1",
  "index": 0,
  "key": "name"
}
```

**Output:**
```json
{"value": "ground"}
```

#### `selectLayer`
Queries layers by metadata within a tilemap.

**Input:**
```json
{
  "id": "map1",
  "query": "collision=true"
}
```

**Output:**
```json
{"indices": [0, 2, 5]}
```

### Tile Operations (2 functions)

#### `setTile`
Sets a tile value at specific coordinates.

**Input:**
```json
{
  "id": "map1",
  "index": 0,
  "x": 5,
  "y": 3,
  "value": 42
}
```

**Output:**
```json
{"success": true}
```

#### `getTile`
Gets a tile value at specific coordinates.

**Input:**
```json
{
  "id": "map1",
  "index": 0,
  "x": 5,
  "y": 3
}
```

**Output:**
```json
{"value": 42}
```

## Usage Examples

### From Host (CLI/LSP)

```go
import (
    "encoding/json"
    "github.com/justgook/wpm/sdk"
)

// Create a new tilemap
input := map[string]interface{}{
    "id": "dungeon-1",
    "map": map[string]interface{}{
        "layers": []interface{}{},
        "meta": map[string]string{
            "tileWidth": "32",
            "tileHeight": "32",
        },
    },
}
inputJSON, _ := json.Marshal(input)
manager.Call("tilemap-storage", "set", inputJSON)

// Set a tile
tileInput := map[string]interface{}{
    "id": "dungeon-1",
    "index": 0,
    "x": 5,
    "y": 3,
    "value": 42,
}
tileJSON, _ := json.Marshal(tileInput)
manager.Call("tilemap-storage", "setTile", tileJSON)
```

### From Another Plugin

```go
import (
    "encoding/json"
    "github.com/justgook/wpm/pdk"
)

// Store generated minimap
minimapData := generateMinimap()
storeInput := map[string]interface{}{
    "id": "minimap-dungeon-1",
    "map": minimapData,
}
inputJSON, _ := json.Marshal(storeInput)
pdk.Call("tilemap-storage", "set", inputJSON)

// Later, retrieve it
getInput := map[string]string{"id": "minimap-dungeon-1"}
queryJSON, _ := json.Marshal(getInput)
_, output, _ := pdk.Call("tilemap-storage", "get", queryJSON)
// Parse output as TileMap...
```

## Query Language (v1)

The `select` and `selectLayer` functions support simple exact-match queries:

**Format:** `key=value`

**Examples:**
- `tileWidth=32` - Find tilemaps with tileWidth=32
- `name=ground` - Find layers with name=ground
- `collision=true` - Find collision layers

Future versions may support:
- Comparisons: `tileWidth>16`
- Substring matching: `name~dungeon`
- Multiple conditions: `tileWidth=32&tileHeight=32`

## Error Handling

All functions return:
- **Status code**: `0` for success, `1` for error
- **JSON output**: Contains either `success: true` or `error: "message"`

**Example error response:**
```json
{
  "success": false,
  "error": "tilemap not found: invalid-id"
}
```

## Storage Lifecycle

- **In-memory**: Tilemaps are stored in RAM while the WASM module is loaded
- **Session-scoped**: Storage persists across function calls during a single session
- **Non-persistent**: Data is lost when the plugin unloads (host can manage persistence)

## Building

```bash
make plugins-release
# or
tinygo build -buildmode=c-shared -o build.nosync/tilemap-storage.wasm plugins/tilemap-storage/main.go
```

## Future Enhancements

- **Native WASM tile operations**: Direct integer parameters for `setTile`/`getTile` to improve performance
- **Advanced queries**: Comparisons, ranges, substring matching
- **Bulk operations**: `setTiles`, `copyRegion`, `fillRect`
- **Layer manipulation**: `insertLayer`, `deleteLayer`, `moveLayer`
- **Serialization helpers**: Import/export to common formats
- **Host storage integration**: Persistence across sessions
