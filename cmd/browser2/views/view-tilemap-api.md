# view-tilemap / tilemap WASM API

This is the browser2 tilemap service API target.

Goal: keep the API as close as practical to `plugins/stbte/`, but make document ownership explicit by adding a `handle` argument to every stateful operation.

## Plugin

- plugin id: `tilemap`
- runtime: worker-side WASM singleton
- view: `cmd/browser2/views/view-tilemap.js`
- primary state owner: `tilemap` plugin
- UI state owner: view only where it is purely visual/camera-related

## Call Encoding

Browser2 runtime calls plugin methods by name. Each method receives JSON input and returns either:

- empty output for status-only calls
- JSON output for getters/snapshots/descriptors

Return code convention:

- `0`: success
- non-zero: failure, output is an error message

Internal C/WASM implementation may call functions named like stbte exports, but the browser2 plugin API should expose method names without the `stbte_` prefix where possible.

## Handles

Every opened/created map receives a positive integer handle.

```json
{ "handle": 1 }
```

Handle `0` is invalid.

The plugin owns all handle tables and map/editor state. The view never stores raw map pointers as authoritative state.

## Constants

Tools match `plugins/stbte/main.c`:

```js
TOOL_SELECT = 0
TOOL_BRUSH = 1
TOOL_ERASE = 2
TOOL_EYEDROPPER = 3
TOOL_PASTE = 4
```

## Lifecycle

### `create`

Equivalent to `stbte_create`, but returns a handle.

Input:

```json
{
  "width": 32,
  "height": 32,
  "layers": 2,
  "spacingX": 16,
  "spacingY": 16,
  "maxTiles": 1024,
  "name": "maps/new.tilemap.json"
}
```

Output:

```json
{
  "handle": 1,
  "memory": {
    "format": "stbte-y-x-layer-i16",
    "dataPtr": 1234,
    "dataBytes": 1048576,
    "width": 32,
    "height": 32,
    "layers": 2,
    "spacingX": 16,
    "spacingY": 16
  }
}
```

### `destroy`

Equivalent to `stbte_destroy`.

Input:

```json
{ "handle": 1 }
```

### `open`

Loads a tilemap file from the filesystem and creates a handle.

Input:

```json
{ "path": "maps/world.tilemap.json" }
```

Output: same as `create`.

Notes:

- This replaces the old SQL-first model.
- SQL import can remain a one-shot migration/import command later, not the normal save path.

### `save`

Writes the current map to the filesystem.

Input:

```json
{ "handle": 1, "path": "maps/world.tilemap.json" }
```

If `path` is omitted later, the plugin may use the document path attached by `open/create`, but phase 1 should require explicit path to stay fail-fast.

## Map Structure

### `clear`

Equivalent to `stbte_clear`.

Input:

```json
{ "handle": 1 }
```

### `set_dimensions`

Equivalent to `stbte_set_dimensions`.

Input:

```json
{ "handle": 1, "width": 64, "height": 64 }
```

### `resize_map`

Equivalent to `stbte_resize_map`; returns status.

Input:

```json
{ "handle": 1, "width": 64, "height": 64 }
```

### `insert_layer`

Equivalent to `stbte_insert_layer`.

Input:

```json
{ "handle": 1, "index": 1 }
```

### `delete_layer`

Equivalent to `stbte_delete_layer`.

Input:

```json
{ "handle": 1, "index": 1 }
```

### `move_layer`

Equivalent to `stbte_move_layer`.

Input:

```json
{ "handle": 1, "from": 0, "to": 2 }
```

## Tool State

### `set_tool`

Equivalent to `stbte_set_tool`.

Input:

```json
{ "handle": 1, "tool": 1 }
```

### `get_tool`

Equivalent to `stbte_get_tool`.

Input:

```json
{ "handle": 1 }
```

Output:

```json
{ "tool": 1 }
```

## Active Tile / Brush

### `set_active_tile`

Equivalent to `stbte_set_active_tile`.

Input:

```json
{ "handle": 1, "tile": 42 }
```

### `get_active_tile_id`

Equivalent to `stbte_get_active_tile_id`.

Input:

```json
{ "handle": 1 }
```

Output:

```json
{ "tile": 42 }
```

## Layers

### `set_layer_hidden`

Equivalent to `stbte_set_layer_hidden`.

Input:

```json
{ "handle": 1, "layer": 0, "hidden": true }
```

### `set_layer_locked`

Equivalent to `stbte_set_layer_locked`.

Input:

```json
{ "handle": 1, "layer": 0, "locked": true }
```

### `set_active_layer`

Equivalent to `stbte_set_active_layer`.

Input:

```json
{ "handle": 1, "layer": 0 }
```

Use `layer: -1` for all layers, matching stbte behavior.

### `set_solo_layer`

Equivalent to `stbte_set_solo_layer`.

Input:

```json
{ "handle": 1, "layer": 0 }
```

Use `layer: -1` for no solo layer.

## Tile Definitions / Tilesets

### `define_tile`

Equivalent to `stbte_define_tile`, but browser2 should not expose stbte categories in the view UI. Tileset/palette presentation is a view concern layered over tile ids.

Input:

```json
{ "handle": 1, "id": 42, "layermask": 3 }
```

## Selection / Clipboard

### `set_selection`

Equivalent to `stbte_set_selection`.

Input:

```json
{ "handle": 1, "x0": 1, "y0": 2, "x1": 8, "y1": 9 }
```

### `clear_selection`

Equivalent to `stbte_clear_selection`.

Input:

```json
{ "handle": 1 }
```

### `copy`

Equivalent to `stbte_copy`.

Input:

```json
{ "handle": 1 }
```

### `cut`

Equivalent to `stbte_cut`.

Input:

```json
{ "handle": 1 }
```

### `paste`

Equivalent to `stbte_paste`.

Input:

```json
{ "handle": 1, "x": 4, "y": 6 }
```

## Undo / Redo

### `undo`

Equivalent to `stbte_undo`.

Input:

```json
{ "handle": 1 }
```

### `redo`

Equivalent to `stbte_redo`.

Input:

```json
{ "handle": 1 }
```

## Tile Interaction

### `apply`

Equivalent to `stbte_apply`.

This is the main view interaction call. The view sets tool/active tile/active layer first, then calls `apply` for a cell or region. Brush, erase, selection, eyedropper, and paste behavior happens in the backend.

Input:

```json
{ "handle": 1, "x0": 4, "y0": 7, "x1": 4, "y1": 7 }
```

## Raw Tile Data

### `set_tile`

Equivalent to `stbte_set_tile`.

Input:

```json
{ "handle": 1, "x": 4, "y": 7, "layer": 0, "tile": 42 }
```

This is for import/tools/debug. Normal painting should use `set_active_tile` + `apply`.

### `get_tile_id`

Equivalent to `stbte_get_tile_id`.

Input:

```json
{ "handle": 1, "x": 4, "y": 7, "layer": 0 }
```

Output:

```json
{ "tile": 42 }
```

### `set_background_tile`

Equivalent to `stbte_set_background_tile`.

Input:

```json
{ "handle": 1, "tile": 0 }
```

## Metadata / UI Snapshot

### `snapshot`

Returns data needed by header/sidebar/footer without reading internal struct offsets from JS.

Input:

```json
{ "handle": 1 }
```

Output:

```json
{
  "handle": 1,
  "path": "maps/world.tilemap.json",
  "dirty": false,
  "width": 32,
  "height": 32,
  "layers": [
    { "index": 0, "name": "Layer 0", "hidden": false, "locked": false }
  ],
  "activeLayer": 0,
  "soloLayer": -1,
  "tool": 1,
  "activeTile": 42,
  "hasSelection": false,
  "hasClipboard": false,
  "canUndo": false,
  "canRedo": false,
  "memory": {
    "format": "stbte-y-x-layer-i16",
    "dataPtr": 1234,
    "dataBytes": 1048576,
    "width": 32,
    "height": 32,
    "layers": 1,
    "spacingX": 16,
    "spacingY": 16
  }
}
```

Phase-1 mock can return stable sample values here before real map memory is wired.

Tilesets are intentionally not part of this WASM API. They are client-side helper/representation data for selecting numeric tile ids. Tilemap persistence/WASM edit state remains numeric tile ids only.

## Filesystem Format

Normal save/load target should be a file, not SQL.

Initial file format can preserve the existing `pkg/tilemap` shape:

```json
{
  "layers": [
    {
      "width": 32,
      "data": [0, 1, 2],
      "props": { "name": "Layer 0", "tw": "16", "th": "16" }
    }
  ],
  "props": { "name": "world" }
}
```

Backend import/export maps this JSON into stbte memory and back.

## Dynamic JSON Updates

`yyjson` is a good candidate for backend-side JSON mutation/import/export once persistence is implemented.

Intended use:

- parse tilemap file into a mutable document
- update changed fields/layers during save/export
- preserve unknown props where possible
- avoid hand-written fragile JSON string manipulation

Do not put JSON patching logic in the view.

## Bootstrap Mock Scope

The first `tilemap` WASM can implement all method names above but return mock/synthetic state:

- `create/open` returns handle `1`
- `snapshot` returns fixed dimensions/layers/tools
- setters return success and update only trivial in-memory fields if cheap
- `save` returns success without writing, or returns a clear `not implemented` until filesystem wiring starts

The purpose of the mock is to unblock view header/sidebar development against the final API.
