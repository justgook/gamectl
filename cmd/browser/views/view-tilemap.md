# view-tilemap Plan

This file records the intended browser plan for replacing legacy `cmd/browser/views/view-tilemap.js` with a fresh-start implementation split into a worker-side WASM tilemap service and a browser view.

Detailed follow-up docs:

- `cmd/browser/views/view-tilemap-design.md` — backend-driven stbte-like design and bootstrap order.
- `cmd/browser/views/view-tilemap-api.md` — method-by-method API, copied close to `plugins/stbte/` with a handle argument.

## Core Rules

1. `view-tilemap.js` is a **browser fresh-start view**.
2. It must not use the legacy browser event bus or cache events.
3. It must not recreate old `pluginManager.load(...)` per-view runtime ownership.
4. Tilemap document/state logic should live in one global worker-side plugin.
5. Browser UI code should own only rendering, interaction, camera, and header controls.
6. The view should follow `cmd/browser/VIEW_RULES.md`.
7. Required state/config should fail fast; do not add silent fallbacks for internal wiring bugs.
8. Prefer direct shared-memory ownership by the tilemap plugin/view pair over runtime-owned mirrored state.
9. Start with the minimal useful editor loop, then add advanced tools.

## Target Split

### Worker-side plugin: `tilemap`

Role: singleton service plugin loaded by browser runtime.

Owns:
- tilemap document handles
- map dimensions and layer metadata
- tile cell storage in WASM memory
- tile edit operations
- selection/clipboard/undo/redo if enabled
- load/save conversion between SQL JSON rows and internal memory
- validation of map/layer dimensions and supported value ranges

Does not own:
- canvas drawing
- DOM/UI controls
- camera/zoom/pan
- browser popups
- theme-specific rendering

Initial contract shape is documented in `view-tilemap-api.md`.

Important API direction:

- copy `plugins/stbte/` method shape as closely as practical
- add explicit `handle` to stateful calls
- use high-level `set_tool`, `set_active_tile`, `set_active_layer`, then `apply`
- do not make JS own brush/erase/selection/undo behavior
- backend owns "all the stuff happens" editor behavior
- normal persistence target is filesystem paths, not SQL rows

Potential phase-2 calls:
- `resize`, `insert_layer`, `delete_layer`, `move_layer`
- `fill_rect`, `erase`, `eyedropper`
- `select`, `copy`, `cut`, `paste`
- `undo`, `redo`
- `import_json`, `export_json`
- `set_layer_visible`, `set_layer_locked`, `set_active_layer`

Memory descriptor shape:

```json
{
  "handle": 1,
  "width": 32,
  "height": 32,
  "layerCount": 2,
  "tileWidth": 16,
  "tileHeight": 16,
  "format": "u16-layer-major",
  "dataPtr": 1234,
  "dataBytes": 4096
}
```

Recommended initial memory layout:

- `uint16` cells
- layer-major order: `index = layer * width * height + y * width + x`
- this matches the existing `plugins/stbte` logical store better than legacy JS array-of-layers rendering
- if 32-bit tile ids become required, explicitly change the format to `u32-layer-major`

## State Implementation Notes

Current browser prototype uses a private `TilemapState` class inside `cmd/browser/views/view-tilemap.js` instead of a temporary mock WASM plugin.

Planning choice:

- Keep UI/rendering in `ViewTilemap`.
- Keep tilemap/editor logic in `TilemapState` with method names close to the planned backend API.
- Do not register a browser `tilemap` WASM service until there is a concrete backend need.
- `plugins/stbte/` remains a useful reference for future advanced editing behavior.
- Avoid JSON round-trips for every paint/render frame when a real backend is introduced.

Open question / requires clarification:

- Should the plugin preserve full `pkg/tilemap` JSON `uint32` ids, or is `uint16` enough for the editor core?
- Should tileset image lookup/render metadata remain in SQL/tilemap props, or move to a separate asset/tileset plugin contract?

## View: `cmd/browser/views/view-tilemap.js`

Owns:
- custom element lifecycle
- canvas rendering
- camera/zoom/pan through `ViewCanvasBase`
- pointer-to-tile coordinate conversion
- header controls
- current tool/tile/layer UI state
- asking private `TilemapState` to mutate document state
- rendering from state snapshots

Does not own:
- SQL persistence details
- tilemap JSON normalization beyond strict validation of state/backend outputs
- global cache invalidation
- legacy tilemap editor mutations
- standalone data source events

Initial DOM structure:

```html
<canvas data-element="canvas"></canvas>
<footer>
  <output data-element="status"></output>
</footer>
```

Header controls via `createHeaderControlsElement()`:
- `input[type="number"][data-field="tile"]`
- `input[type="number"][data-field="layer"]`
- save
- reload/open
- zoom in
- zoom out
- zoom fit

Initial interactions:
- mouse drag paints current tile to current layer
- space + drag pans via `ViewCanvasBase`
- wheel pans; ctrl/cmd wheel zooms via `ViewCanvasBase`
- fit uses state snapshot bounds
- save calls `TilemapState.save` until filesystem persistence is wired

Rendering phase 1:
- draw grid
- draw colored tiles from cell values
- draw hovered tile outline
- draw active layer normally and non-active layers with lower alpha

Rendering phase 2:
- tileset image renderer from layer/map props
- doors/special overlay renderer
- layer visibility/lock controls
- palette/tileset chooser popup

## Persistence Model

Normal browser tilemap persistence should move to filesystem paths, matching the nodegraph direction.

The view should not build SQL strings. The current `TilemapState` prototype will later wire open/save to `fs` or be replaced internally by filesystem-backed state.

The existing SQL table can remain an import/export compatibility target for old generator workflows, but it should not be the default browser tilemap save path:

```sql
CREATE TABLE IF NOT EXISTS tilemap_storage (
  name TEXT PRIMARY KEY,
  data TEXT NOT NULL
)
```

## Migration From Legacy View

Legacy pieces to avoid:
- `bus.on('cache:changed:...')`
- `bus.emit('cache:load:...')`
- direct SQL strings in the view
- `TilemapEditor.paint(...)` in JS as source of truth
- inline CSS styles in header controls
- tooltip/menu DOM copied as-is from old browser view

Legacy behavior to keep conceptually:
- `data-key` / map name selection, but rename/validate contract if needed
- canvas view with grid
- save/reload/zoom controls
- simple numeric tile painting
- layer renderer selection as a later view-side rendering concern

## Implementation Phases

### Phase 0: state contract

- Keep `TilemapState` method names close to the planned backend API.
- Do not register a fake `tilemap` plugin during the browser UI prototype phase.
- Add backend/plugin registration only when there is a concrete implementation need.

### Phase 1: minimal state + minimal view

- Implement create/open/snapshot/save in private `TilemapState`.
- Implement `view-tilemap.js` HTML/sidebar/header shell first.
- Register/import the view in `cmd/browser/app.js` and replace the placeholder registry entry.
- Use strict assertions for required state snapshots.

### Phase 2: editor tools

- Add active layer controls.
- Add erase/eyedropper/fill.
- Add undo/redo if using/adapting `stbte` logical history.
- Add selection/copy/paste.

### Phase 3: visual parity

- Add tileset image rendering.
- Add doors/special overlays.
- Add layer list/inspector as `aside` if needed.
- Add chooser popup for opening maps, preferably reusing `view-sql` or a dedicated browser popup view.

## Acceptance Criteria For Phase 1

- Opening `view-tilemap` loads a named map through the worker-side `tilemap` plugin.
- Painting updates the plugin-owned memory and redraws without a full JSON reload.
- Save writes back to `tilemap_storage` through plugin-to-plugin `tilemap -> sql` calls.
- The view has no dependency on legacy `cmd/browser` modules.
- The view uses only documented browser UI structure/elements.
