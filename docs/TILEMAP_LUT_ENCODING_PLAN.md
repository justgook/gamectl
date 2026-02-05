# Tilemap LUT Encoding Plan

## Overview

Add tilemap encoding to the game building pipeline. This converts tilemaps from the database into:
1. **Reduced tilesets** - Only tiles actually used, deduplicated across all maps
2. **LUT images** - Lookup tables where each pixel represents a tile index
3. **Binary data (opcode 3)** - Tilemap metadata for the game engine

## Current State

### Existing Infrastructure
- **Tiled example** (`tmp/tiled/tiled-to-lut.mjs`): Complete reference implementation
- **Game10 engine** (`tmp/game10/`): Has tilemap shader and manager, but not connected to data loading
- **Nodegraph** (`cmd/browser/index.html`): Already has atlas and animation encoding nodes
- **Tilemap storage**: SQL table `tilemap_storage` with JSON tilemap data

### Binary Format Reference
Current opcodes in game10:
- Opcode 0: Entity
- Opcode 1: Atlas UVs
- Opcode 2: Animations
- Opcode 3: Position component (will be moved to opcode 4)

## Target Binary Format

### Opcode 3: Tilemap Layer

```
[opcode: u16 = 3]
[position_x: f32]          // World X position
[position_y: f32]          // World Y position  
[tile_size_x: f32]         // Tile width in pixels
[tile_size_y: f32]         // Tile height in pixels
[tileset_uv_index: u32]    // Index into atlas UVs for reduced tileset
[lut_uv_index: u32]        // Index into atlas UVs for this layer's LUT
[map_width: u32]           // Width in tiles
[map_height: u32]          // Height in tiles
```

Total: 2 + 4×4 + 4×4 = **34 bytes per tilemap layer**

### LUT Image Format
- Each pixel is a 32-bit RGBA value encoding the tile's new ID
- Dimensions match tilemap dimensions (e.g., 32×24 map = 32×24 pixel LUT)
- Tile ID 0 = empty/transparent

## Implementation Tasks

### Phase 1: Node Pipeline (Browser/JS)

- [x] **1.1** Create node: "SQL: Get Tilemaps" - Query tilemaps from database
- [x] **1.2** Create node: "Extract Tiles" - Deduplicate tiles, group by size, remap IDs
- [x] **1.3** Create node: "Build Tilesets" - Create reduced tileset images from extracted tiles
- [x] **1.4** Create node: "Build LUTs" - Create LUT image for each tilemap layer
- [x] **1.5** Create node: "Build Tilemap Binary" - Encode opcode 3 data
- [x] **1.6** Integrate with existing atlas pipeline - Pack tilesets and LUTs into atlas (packTilesets function added to sprite-pack plugin)

### Phase 2: Game Engine (Odin)

- [x] **2.1** Move position component to opcode 4 in bytecode.odin
- [x] **2.2** Add `decode_tilemap` proc for opcode 3
- [x] **2.3** Add TilemapLayer struct to World and storage for decoded tilemaps
- [ ] **2.4** Connect decoded tilemaps to `Tilemap_Manager` for rendering
- [ ] **2.4** Verify tilemap rendering works with new data

### Phase 3: Integration & Testing

- [ ] **3.1** Test with sample tilemaps from database
- [ ] **3.2** Verify tile deduplication works correctly
- [ ] **3.3** Verify LUT rendering in game
- [ ] **3.4** Test multiple tile sizes (16×16 and 32×32)

## Node Pipeline Architecture

```
┌─────────────────────┐
│ SQL: Get Tilemaps   │  Query tilemaps from tilemap_storage
│ (node-code)         │
└──────────┬──────────┘
           │ tilemaps: [{name, layers, ...}]
           ▼
┌─────────────────────┐
│ Extract Tiles       │  Deduplicate tiles, group by size
│ (node-code)         │  Track original → new ID mapping
└──────────┬──────────┘
           │ extractedData: {
           │   tilesBySize: Map<"WxH", Map<key, tile>>
           │   tilemapsWithNewIds: [...]
           │ }
           ▼
┌─────────────────────┐
│ Build Tilesets      │  Create reduced tileset images per size
│ (node-code)         │  Returns images ready for packing
└──────────┬──────────┘
           │ tilesetImages: [{size, imageData, cols, rows}]
           ▼
┌─────────────────────┐
│ Build LUTs          │  Create LUT image for each map layer
│ (node-code)         │  Each pixel = tile newId (32-bit RGBA)
└──────────┬──────────┘
           │ lutImages: [{mapName, layerIndex, imageData, w, h}]
           ▼
┌─────────────────────┐
│ Pack All Images     │  Pack tilesets + LUTs + sprites into atlas
│ (sprite-pack)       │  Returns placements with UV coords
└──────────┬──────────┘
           │ packResult: {placements, atlasW, atlasH}
           ▼
┌─────────────────────┐
│ Build Tilemap Binary│  Encode opcode 3 for each layer
│ (node-code)         │  Reference UV indices from pack result
└──────────┬──────────┘
           │ tilemapBinary: base64
           ▼
┌─────────────────────┐
│ Combine Binary      │  Merge: atlas UVs + animations + tilemaps
│ (node-code)         │
└─────────────────────┘
```

## Key Algorithms

### Tile Deduplication

```javascript
// Deduplication key format
const key = `${tilesetPath}:${originalTileId}:${tileW}:${tileH}`

// Group by tile size
const tilesBySize = new Map()  // "16x16" → Map<key, {id, newId, pixels, ...}>

// New IDs are sequential per size group, starting from 1
// ID 0 is reserved for empty tiles
```

### LUT Pixel Writing

```javascript
function writePixel32(view, x, y, width, tileId) {
  const offset = 4 * (width * y + x)
  view.setUint32(offset, tileId, false)  // Big-endian for RGBA
}
```

### Tileset Image Creation

```javascript
// Calculate grid dimensions for reduced tileset
const tileCount = uniqueTiles.size
const cols = Math.ceil(Math.sqrt(tileCount))
const rows = Math.ceil(tileCount / cols)
const imageW = cols * tileW
const imageH = rows * tileH

// Place tiles at positions based on newId
// newId 1 → position (0, 0)
// newId 2 → position (1, 0)
// etc.
```

## File Changes

| File | Change | Status |
|------|--------|--------|
| `cmd/browser/index.html` | Add 7 new node blocks for tilemap pipeline | Done |
| `plugins/sprite-pack/main.go` | Add `packTilesets` function for packing tilesets + LUTs | Done |
| `tmp/game10/src/game/bytecode.odin` | Add `decode_tilemap` for opcode 3, move position to opcode 4 | Done |
| `tmp/game10/src/game/world.odin` | Add `TilemapLayer` struct and `tilemaps` storage | Done |
| `tmp/game10/src/game/render.odin` | Render tilemaps from world data | Pending |

## Notes

- Tileset images can be read from storage paths OR base64 encoded in tilemap data
- Multiple tile sizes result in multiple reduced tilesets (one per size)
- Each tilemap layer gets its own LUT image and binary record
- The game engine uses UV indices to look up actual UV coordinates from the atlas
- Little-endian byte order for compatibility with x86/ARM

## References

- Tiled LUT example: `tmp/tiled/tiled-to-lut.mjs`
- Game10 tilemap manager: `tmp/game10/src/game/render/tilemap/tilemap.odin`
- Existing atlas nodes: `cmd/browser/index.html` (lines 689-926)
- bytes() helper: `cmd/browser/util/dataview.js`
