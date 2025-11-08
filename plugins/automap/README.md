# Automap Plugin

An automapping plugin for GameCtl inspired by [Tiled's Automapping feature](https://doc.mapeditor.org/en/stable/manual/automapping/). This plugin transforms input tilemaps based on pattern-matching rules to generate output tilemaps.

## Overview

The automap plugin demonstrates **plugin-to-plugin communication** by using the `tilemap-storage` plugin to store and retrieve tilemaps. It provides a foundation for future automapping logic that can automatically place tiles based on their neighbors and context.

## Current Features (v1)

- **Three Tilemap Types**: Creates rules, input, and output tilemaps
- **Tilemap Storage Integration**: Stores maps in the centralized tilemap-storage plugin
- **Plugin Communication**: Demonstrates `pdk.Call()` for inter-plugin communication
- **Metadata Tagging**: All maps tagged with `type=automap` for easy querying

## Future Features

The plugin is designed to support:

- **Pattern Matching**: Detect specific tile patterns in input maps
- **Rule-Based Transformation**: Apply transformation rules based on matched patterns
- **Neighbor Analysis**: Analyze surrounding tiles for context-aware placement
- **Multiple Rule Sets**: Support different rule configurations
- **Probability-Based Placement**: Random variations in tile selection
- **Multi-Layer Processing**: Transform multiple layers simultaneously

## API Reference

### `automap`

Main function that creates the three automapping tilemaps.

**Input:**
```json
{
  "rulesMapId": "rules-basic-walls",
  "inputMapId": "input-test-map",
  "outputMapId": "output-result-map"
}
```

All fields are optional. If not provided, default IDs will be used.

**Output:**
```json
{
  "success": true,
  "rulesMapId": "rules-basic-walls",
  "inputMapId": "input-test-map",
  "outputMapId": "output-result-map"
}
```

### `init`

Initializes the plugin with default tilemaps.

**Input:**
```json
{}
```

**Output:**
```json
{
  "success": true,
  "rulesMapId": "rules-basic-walls",
  "inputMapId": "input-test-map",
  "outputMapId": "output-result-map",
  "mapIds": ["rules-basic-walls", "input-test-map", "output-result-map"]
}
```

### `listMaps`

Lists all automapping-related tilemaps stored in tilemap-storage.

**Input:**
```json
{}
```

**Output:**
```json
{
  "ids": ["rules-basic-walls", "input-test-map", "output-result-map"]
}
```

## Tilemap Types

### Rules Map (`rules-*`)

Contains pattern matching rules for automapping.

**Structure:**
- **Layer 0 (pattern-input)**: Pattern to match in the input tilemap
- **Layer 1 (pattern-output)**: Tiles to place when pattern matches

**Example:**
```
Pattern (3x3):     Output:
1 1 0              10 0 0
1 0 0       =>     0  0 0
0 0 0              0  0 0

Where:
  1 = wall tile in input
  0 = empty
  10 = corner tile to place in output
```

**Metadata:**
- `name`: "Basic Wall Rules"
- `type`: "automap"
- `category`: "rules"
- `tileWidth`: "32"
- `tileHeight`: "32"

### Input Map (`input-*`)

The source tilemap to be transformed.

**Structure:**
- **Layer 0 (walls)**: Simple room outline (20x15 tiles)
- Border tiles set to `1` (wall)
- Interior tiles set to `0` (empty)

**Metadata:**
- `name`: "Test Input Map"
- `type`: "automap"
- `category`: "input"
- `tileWidth`: "32"
- `tileHeight`: "32"

### Output Map (`output-*`)

The result of automapping transformation (initially empty).

**Structure:**
- **Layer 0 (generated)**: Empty 20x15 layer
- Will be filled by automapping logic in future versions

**Metadata:**
- `name`: "Automap Output"
- `type`: "automap"
- `category`: "output"
- `tileWidth`: "32"
- `tileHeight`: "32"

## Usage Examples

### From Host (CLI)

```go
import (
    "encoding/json"
    "github.com/justgook/wpm/sdk"
)

// Initialize automap with default tilemaps
initInput := map[string]interface{}{}
inputJSON, _ := json.Marshal(initInput)
status, output, _ := manager.Call("automap", "init", inputJSON)

// Create custom automap tilemaps
automapInput := map[string]interface{}{
    "rulesMapId": "rules-dungeon-walls",
    "inputMapId": "input-level-1",
    "outputMapId": "output-level-1",
}
inputJSON, _ = json.Marshal(automapInput)
status, output, _ = manager.Call("automap", "automap", inputJSON)

// List all automap tilemaps
listInput := map[string]interface{}{}
inputJSON, _ = json.Marshal(listInput)
status, output, _ = manager.Call("automap", "listMaps", inputJSON)
```

### From Another Plugin

```go
import (
    "encoding/json"
    "github.com/justgook/wpm/pdk"
)

// Create automap tilemaps
config := map[string]interface{}{
    "rulesMapId": "rules-biome-grass",
    "inputMapId": "input-overworld",
    "outputMapId": "output-overworld",
}
inputJSON, _ := json.Marshal(config)
status, output, err := pdk.Call("automap", "automap", inputJSON)

// Later, retrieve the output from tilemap-storage
getInput := map[string]string{"id": "output-overworld"}
queryJSON, _ := json.Marshal(getInput)
_, tmOutput, _ := pdk.Call("tilemap-storage", "get", queryJSON)
```

## How Automapping Works (Future Implementation)

1. **Load Rules**: Read pattern and transformation rules from rules tilemap
2. **Scan Input**: Iterate through input tilemap looking for pattern matches
3. **Pattern Match**: Compare tile neighborhoods against rule patterns
4. **Transform**: When pattern matches, apply transformation to output tilemap
5. **Save Output**: Store result in output tilemap via tilemap-storage

### Example Rule Processing

```
Input Layer:          Rules Pattern:       Output Layer:
. . . . .             1 1 .                . . . . .
. 1 1 . .    Match    1 . .       =>       . C . . .
. 1 . . .      =>     . . .                . . . . .
. . . . .                                  . . . . .

Where:
  . = empty (0)
  1 = wall
  C = corner tile (placed by rule)
```

## Plugin Communication Flow

```
Host/Plugin
    |
    v
  automap.init()
    |
    +---> Creates rules tilemap
    |     |
    |     v
    |   pdk.Call("tilemap-storage", "set", rulesMap)
    |
    +---> Creates input tilemap
    |     |
    |     v
    |   pdk.Call("tilemap-storage", "set", inputMap)
    |
    +---> Creates output tilemap
          |
          v
        pdk.Call("tilemap-storage", "set", outputMap)
```

## Dependencies

- **tilemap-storage plugin**: Required for storing and retrieving tilemaps
- **pkg/tilemap**: Core tilemap data structures

## Building

```bash
make plugins-release
# or
tinygo build -buildmode=c-shared -o build.nosync/automap.wasm plugins/automap/main.go
```

## Future Enhancements

### Phase 1: Basic Automapping
- [ ] Pattern matching algorithm
- [ ] Simple neighbor detection (4-directional)
- [ ] Rule application engine
- [ ] Basic tile transformation

### Phase 2: Advanced Features
- [ ] 8-directional neighbor analysis
- [ ] Multiple pattern sizes (3x3, 5x5, etc.)
- [ ] Probability-based tile selection
- [ ] Multiple rule priorities

### Phase 3: Optimization
- [ ] Region-based processing for large maps
- [ ] Cached pattern matching
- [ ] Parallel processing support
- [ ] Incremental updates

### Phase 4: Extended Functionality
- [ ] Custom rule scripting
- [ ] Conditional transformations
- [ ] Layer blending modes
- [ ] Rule composition and inheritance

## Related Documentation

- [Tiled Automapping](https://doc.mapeditor.org/en/stable/manual/automapping/)
- [Tilemap Storage Plugin](../tilemap-storage/README.md)
- [GameCtl Tilemap Package](../../pkg/tilemap/README.md)

## Examples

See the CLI test in `cmd/cli/main.go` for integration examples.
