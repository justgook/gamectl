# Sprite Tools Implementation Plan

Implementation plan for sprite and image processing tools, inspired by [ShoeBox](http://renderhjs.net/shoebox/) but designed for gamectl's plugin-based architecture.

---

## Progress Tracker

### Phase 1: Foundation (P0)
- [x] 1.1 QOI codec in Go for WASM plugins (existing: `pkg/qoi/`)
- [x] 1.2 `image-process` plugin - core image manipulation
- [x] 1.3 FS integration for image storage in plugins (existing: `fs` host functions)

### Phase 2: Sprite Detection (P1)
- [x] 2.1 `sprite-detect` plugin - blob detection algorithm
- [x] 2.2 `view-sprite-extractor` - interactive extraction UI
- [ ] 2.3 File handler for viewing extracted sprites

### Phase 3: Atlas Packing (P1)
- [x] 3.1 `sprite-pack` plugin - bin packing algorithm
- [ ] 3.2 `view-sprite-packer` - atlas creation UI
- [ ] 3.3 Atlas metadata format and export

### Phase 4: Tile Tools (P2)
- [ ] 4.1 `tile-detect` plugin - tile detection/deduplication
- [ ] 4.2 `view-tile-extractor` - tilemap extraction UI
- [ ] 4.3 Integration with existing tilemap system

### Phase 5: Pivot Editor (P3)
- [ ] 5.1 `view-pivot-editor` - sprite pivot editing UI
- [ ] 5.2 Pivot metadata integration with sprites

### Phase 6: Bitmap Fonts (P4 - Future)
- [ ] 6.1 `view-bitmap-font` - font creation UI
- [ ] 6.2 AngelCode .fnt format export

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Views (JS)                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  sprite-    │ │  sprite-    │ │   tile-     │   ...     │
│  │  extractor  │ │   packer    │ │  extractor  │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
└─────────┼───────────────┼───────────────┼───────────────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                    WASM Plugins (Go)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   sprite-   │ │   sprite-   │ │    tile-    │           │
│  │   detect    │ │    pack     │ │   detect    │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │                   │
│         └───────────────┴───────────────┘                   │
│                         │                                   │
│                  ┌──────┴──────┐                           │
│                  │   image-    │                           │
│                  │   process   │                           │
│                  └──────┬──────┘                           │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │    FS (via host)    │  │   SQL (metadata)    │          │
│  │  - PNG input        │  │  - sprite regions   │          │
│  │  - QOI storage      │  │  - atlas layout     │          │
│  │  - atlas output     │  │  - pivot points     │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## WASM Plugins

### 1. `image-process` (P0 - Foundation)

Core image manipulation utilities used by all other plugins.

**Location:** `plugins/image-process/`

**Exported Functions:**

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `decode` | `{path}` | `{data, w, h, channels}` | Decode PNG/QOI from FS |
| `encode` | `{data, w, h, path, format}` | `{success}` | Encode to QOI and save to FS |
| `combine` | `{images: [{path, x, y}], output: {w, h, path}}` | `{success}` | Combine multiple images into one |
| `split` | `{path, regions: [{x, y, w, h, outputPath}]}` | `{success}` | Split image into multiple files |
| `crop` | `{path, rect: {x, y, w, h}, outputPath}` | `{success}` | Crop image to bounds |
| `cropAlpha` | `{path, outputPath}` | `{x, y, w, h}` | Crop to non-transparent bounds, return offset |
| `pad` | `{path, padding, outputPath}` | `{success}` | Add padding around image |
| `extrude` | `{path, size, outputPath}` | `{success}` | Extrude edge pixels |

**Go Package Structure:**
```
plugins/image-process/
├── main.go                 # WASM exports
├── imageprocess/           # Core logic (testable)
│   ├── decode.go          # PNG decoding
│   ├── encode.go          # QOI encoding
│   ├── combine.go         # Image composition
│   ├── crop.go            # Cropping operations
│   └── transform.go       # Pad, extrude, etc.
└── qoi/                    # QOI codec
    ├── decode.go
    └── encode.go
```

---

### 2. `sprite-detect` (P1)

Blob detection and connected component analysis.

**Location:** `plugins/sprite-detect/`

**Exported Functions:**

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `detect` | `{path, minSize, mergeOverlapping}` | `{sprites: [{x, y, w, h, pixels}]}` | Find connected non-transparent regions |
| `detectGrid` | `{path, cellW, cellH, skipEmpty}` | `{cells: [{x, y, w, h, isEmpty}]}` | Grid-based sprite detection |

**Algorithm (detect):**
1. Load image via `image-process.decode`
2. Create visited bitmap
3. Scan left-to-right, top-to-bottom for non-transparent pixels
4. Flood-fill each unvisited non-transparent pixel
5. Calculate bounding box for each connected region
6. Filter by minSize
7. Optionally merge overlapping bounding boxes
8. Sort by position (top-to-bottom, left-to-right)

---

### 3. `sprite-pack` (P1)

Bin packing algorithm for texture atlases.

**Location:** `plugins/sprite-pack/`

**Exported Functions:**

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `pack` | `{sprites: [{path, name}], options, outputPath}` | `{placements, atlasW, atlasH}` | Pack sprites into atlas |

**Options:**
```json
{
  "padding": 2,
  "extrude": 1,
  "powerOfTwo": true,
  "maxSize": 4096,
  "cropAlpha": true,
  "algorithm": "maxrects"
}
```

**Output (placements):**
```json
[
  {
    "name": "sprite1",
    "x": 0, "y": 0,           
    "w": 32, "h": 32,         
    "frameX": 5, "frameY": 3, 
    "frameW": 42, "frameH": 38
  }
]
```
- `x, y, w, h` - Position and size in atlas (after crop)
- `frameX, frameY, frameW, frameH` - Original frame info (before crop)

**Algorithm (MaxRects):**
1. Load all sprites, optionally crop alpha
2. Sort by area (largest first)
3. Initialize free rectangle list with atlas size
4. For each sprite:
   - Find best-fit free rectangle
   - Place sprite
   - Split free rectangle
   - Remove overlapping free rectangles
5. Grow atlas if needed (within maxSize)
6. Composite final image using `image-process.combine`

---

### 4. `tile-detect` (P2)

Tile extraction and deduplication from images.

**Location:** `plugins/tile-detect/`

**Exported Functions:**

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `detectSize` | `{path, minSize, maxSize}` | `{tileW, tileH, confidence}` | Auto-detect tile dimensions |
| `extract` | `{path, tileW, tileH, outputDir}` | `{tilebank, tilemap}` | Extract unique tiles + map |

**Output:**
- `tilebank`: Array of unique tile paths + hashes
- `tilemap`: 2D array of tile indices (compatible with existing tilemap format)

**Algorithm (extract):**
1. Load image
2. Divide into grid cells
3. Hash each cell (color histogram or pixel hash)
4. Deduplicate by hash
5. Save unique tiles to outputDir
6. Generate tilemap indices

---

## Views

### 1. `view-sprite-extractor` (P1)

Interactive sprite detection and extraction.

**Location:** `cmd/browser/views/sprite-extractor/`

**Features:**
- Drag-drop image to detect sprites
- Adjustable parameters (min size, merge overlapping)
- Click to select/deselect sprites
- Inline rename detected sprites
- Canvas overlay showing bounding boxes
- Export selected sprites to individual files or pack to atlas

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `data-source` | string | Source image path |
| `data-output-dir` | string | Output directory for extracted sprites |

**UI Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [Header: Sprite Extractor]              [Export] [Pack] │
├────────────────────────────────┬────────────────────────┤
│                                │ Parameters:            │
│                                │ ├ Min Size: [__4__]    │
│     Canvas Preview             │ ├ Merge: [x]           │
│     (pan/zoom)                 │ └ Crop Alpha: [x]      │
│     - shows source image       │                        │
│     - overlay bounding boxes   │ Detected Sprites:      │
│     - click to select          │ ├ [x] sprite_001 32x32 │
│                                │ ├ [x] sprite_002 16x16 │
│                                │ └ [ ] sprite_003 8x8   │
└────────────────────────────────┴────────────────────────┘
```

---

### 2. `view-sprite-packer` (P1)

Interactive texture atlas creation.

**Location:** `cmd/browser/views/sprite-packer/`

**Features:**
- Add sprites from file browser or drag-drop
- Reorder sprites (affects packing)
- Configure packing options
- Live preview of packed atlas
- Export atlas image + metadata JSON

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `data-sprites` | string | Comma-separated sprite paths or directory |
| `data-output` | string | Output atlas path |

**UI Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [Header: Sprite Packer]                   [Pack] [Save] │
├────────────────────────────────┬────────────────────────┤
│                                │ Input Sprites:         │
│                                │ ├ sprite_001.png [x]   │
│     Atlas Preview              │ ├ sprite_002.png [x]   │
│     (pan/zoom)                 │ └ [+ Add Sprites]      │
│     - shows packed result      │                        │
│     - hover to highlight       │ Options:               │
│                                │ ├ Padding: [__2__]     │
│                                │ ├ Power of 2: [x]      │
│                                │ ├ Max Size: [4096]     │
│                                │ └ Extrude: [__1__]     │
│                                │                        │
│                                │ Result: 256x128        │
└────────────────────────────────┴────────────────────────┘
```

---

### 3. `view-tile-extractor` (P2)

Extract tilemap and tilebank from screenshots.

**Location:** `cmd/browser/views/tile-extractor/`

**Features:**
- Drag-drop game screenshot
- Auto-detect or manual tile size
- Preview grid overlay
- Highlight duplicate tiles (same color)
- Export tilebank + tilemap

**Attributes:**
| Attribute | Type | Description |
|-----------|------|-------------|
| `data-source` | string | Source screenshot path |
| `data-output-dir` | string | Output directory |

---

### 4. `view-pivot-editor` (P3)

Edit sprite pivot/registration points.

**Location:** `cmd/browser/views/pivot-editor/`

**Features:**
- Load sprite sheet or individual sprites
- Click to set pivot point
- Batch operations (center, bottom-center, custom)
- Preview animation with current pivots
- Export pivot metadata

---

## Data Flow Examples

### Sprite Extraction Flow

```
User drops PNG on view-sprite-extractor
           │
           ▼
┌─────────────────────────────────────────────┐
│ view-sprite-extractor                       │
│ 1. Save dropped file to FS temp location    │
│ 2. Call sprite-detect.detect(path, opts)    │
│ 3. Render overlay with bounding boxes       │
│ 4. User selects/renames sprites             │
│ 5. On Export: call image-process.split()    │
└─────────────────────────────────────────────┘
           │
           ▼
     sprites saved to output directory
```

### Atlas Packing Flow

```
User adds sprites to view-sprite-packer
           │
           ▼
┌─────────────────────────────────────────────┐
│ view-sprite-packer                          │
│ 1. Collect sprite paths                     │
│ 2. Call sprite-pack.pack(paths, opts)       │
│ 3. Display preview of packed atlas          │
│ 4. On Save: atlas already saved by plugin   │
│ 5. Save metadata JSON alongside             │
└─────────────────────────────────────────────┘
           │
           ▼
     atlas.qoi + atlas.json saved
```

---

## Storage Strategy

### File System (via host)
- **Input:** PNG files (dropped or selected)
- **Working:** Temporary files during processing
- **Output:** QOI images (sprites, atlases, tilebanks)

### SQL (metadata only)
- Sprite regions and names
- Atlas layouts (placements)
- Pivot points
- Tilemap data (indices, not tile images)

### Example Metadata (stored in SQL or JSON file)

**Atlas Metadata (`atlas.json`):**
```json
{
  "image": "atlas.qoi",
  "width": 256,
  "height": 128,
  "sprites": [
    {
      "name": "player_idle",
      "x": 0, "y": 0, "w": 32, "h": 32,
      "frameX": 0, "frameY": 0, "frameW": 32, "frameH": 32,
      "pivot": { "x": 0.5, "y": 1.0 }
    },
    {
      "name": "player_run_01",
      "x": 32, "y": 0, "w": 30, "h": 32,
      "frameX": 1, "frameY": 0, "frameW": 32, "frameH": 32,
      "pivot": { "x": 0.5, "y": 1.0 }
    }
  ]
}
```

---

## Pipeline Integration

Views can be used as processing nodes in nodegraph:

```json
{
  "id": "extract-sprites",
  "type": "sprite-extractor",
  "inputs": {
    "source": "assets/spritesheet.png"
  },
  "outputs": {
    "sprites": "build/sprites/"
  },
  "config": {
    "minSize": 4,
    "mergeOverlapping": true,
    "cropAlpha": true
  }
}
```

```json
{
  "id": "pack-atlas",
  "type": "sprite-packer",
  "inputs": {
    "sprites": "build/sprites/"
  },
  "outputs": {
    "atlas": "build/atlas.qoi",
    "metadata": "build/atlas.json"
  },
  "config": {
    "padding": 2,
    "powerOfTwo": true,
    "maxSize": 2048
  }
}
```

---

## Implementation Notes

### QOI in Go (for WASM)

Need to implement or port QOI codec to Go for use in WASM plugins:
- Encode: RGBA → QOI bytes
- Decode: QOI bytes → RGBA

Reference: https://qoiformat.org/qoi-specification.pdf

### PNG Decoding in Go WASM

Use standard `image/png` package - should work in WASM environment.

### FS Host Functions

Plugins access filesystem via host imports:
```go
//go:wasmimport fs read
func fsRead(pathPtr, pathLen uint32) uint64

//go:wasmimport fs write  
func fsWrite(pathPtr, pathLen, dataPtr, dataLen uint32) uint32
```

### Memory Considerations

For large images (4096x4096 = 64MB RGBA):
- Process in chunks if needed
- Release memory between operations
- Consider streaming for combine operations

---

## Next Steps

1. **Start with Phase 1.1:** Implement QOI codec in Go
2. **Phase 1.2:** Create `image-process` plugin with basic decode/encode
3. **Phase 1.3:** Verify FS host function integration
4. **Then Phase 2:** Build sprite detection and extraction UI

---

## References

- [ShoeBox](http://renderhjs.net/shoebox/) - Original inspiration
- [QOI Specification](https://qoiformat.org/qoi-specification.pdf)
- [MaxRects Algorithm](http://clb.confined.space/files/RectangleBinPack.pdf)
- [Connected Component Labeling](https://en.wikipedia.org/wiki/Connected-component_labeling)
