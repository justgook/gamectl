# wasm-tiled

A minimal, flexible tile map representation library for game world generation in Go.

## Overview

`wasm-tiled` provides a simple, plugin-extensible tile map format designed for:
- Game world generation
- Automapping (similar to Tiled Map Editor)
- WASM-based plugin systems
- Runtime map manipulation

## Philosophy

This library takes a minimalist approach:
- **No forced structure** - Use metadata to define your own conventions
- **Plugin-friendly** - Core types are simple, plugins add features
- **Flexible** - Layers can represent tiles, collision, biomes, or anything else
- **Serializable** - Clean JSON format for easy storage and transmission

## Core Types

### TileMap

The root structure containing layers and metadata.

```go
type TileMap struct {
    Layers []TileLayer       `json:"layers"`
    Meta   map[string]string `json:"meta"`
}
```

**Common metadata conventions:**
- `version` - Format version
- `tileWidth`, `tileHeight` - Default tile dimensions
- `name` - Map name

### TileLayer

A single layer of tiles with width, data array, and metadata.

```go
type TileLayer struct {
    Width int               `json:"width"`
    Data  []uint32          `json:"data"`
    Meta  map[string]string `json:"meta"`
}
```

**Data format:**
- Flat array of tile indices: `Data[y * Width + x]`
- `0` = empty/no tile
- `1+` = tile ID (meaning defined by layer metadata)

**Common metadata conventions:**
- `name` - Layer name
- `tileset` - JSON string with tileset info: `{"source":"tiles.png","tileWidth":32,"tileHeight":32}`
- `collision` - Boolean flag: `"true"` for collision layers
- `visible` - Visibility flag: `"true"` or `"false"`
- `opacity` - Layer opacity: `"0.0"` to `"1.0"`

## Installation

```bash
go get github.com/justgook/wasm-tiled
```

## Usage

### Creating a Map

```go
import "github.com/justgook/wasm-tiled/tilemap"

// Create a new map
tileMap := tilemap.NewTileMap()
tileMap.Meta["tileWidth"] = "32"
tileMap.Meta["tileHeight"] = "32"

// Create a layer
layer := tilemap.NewTileLayer(20, 15) // 20x15 tiles
layer.Meta["name"] = "ground"
layer.Meta["tileset"] = `{"source":"tiles.png","tileWidth":32,"tileHeight":32}`

// Set some tiles
layer.Data[0] = 1  // Top-left tile
layer.Data[5*layer.Width+3] = 2  // Tile at (3, 5)

// Add layer to map
tileMap.Layers = append(tileMap.Layers, *layer)
```

### Serialization

```go
import "encoding/json"

// To JSON
jsonData, _ := json.Marshal(tileMap)

// From JSON
var loadedMap tilemap.TileMap
json.Unmarshal(jsonData, &loadedMap)
```

### Collision Layers

Layers don't require tilesets - they can represent any grid data:

```go
collisionLayer := tilemap.NewTileLayer(20, 15)
collisionLayer.Meta["name"] = "collision"
collisionLayer.Meta["collision"] = "true"

// 0 = passable, 1 = solid
collisionLayer.Data[0] = 1  // Solid tile at (0, 0)
```

## Example

Run the basic example:

```bash
go run examples/basic/main.go
```

This creates a sample map with:
- A ground layer with a checkerboard pattern
- A collision layer with border walls

## Design Goals

1. **Minimal core** - Only essential types, no assumptions about usage
2. **Plugin extensibility** - Features added through plugins, not core library
3. **WASM-friendly** - Simple types that cross WASM boundaries easily
4. **Metadata-driven** - Use `Meta` maps for flexible, custom properties
5. **No dependencies** - Only standard library

## Use Cases

- **Automapping** - Generate tile patterns based on rules (like Tiled's automapping)
- **Procedural generation** - Plugins can generate layers programmatically
- **Multi-layer systems** - Ground, objects, collision, biomes, etc.
- **Runtime editing** - Modify maps during gameplay
- **Cross-platform** - Same format works in Go, WASM, and other languages

## Non-Goals (for V1)

These may be added in future versions or via plugins:
- Multiple map orientations (isometric, hexagonal)
- Infinite maps
- Layer groups/hierarchy
- Parallax scrolling
- Built-in coordinate conversion
- Tileset image loading/rendering

