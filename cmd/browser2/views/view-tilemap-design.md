# view-tilemap Design

Fresh-start browser2 tilemap editor design.

Companion API doc: `cmd/browser2/views/view-tilemap-api.md`.

## Direction

Use an stbte-like backend-driven editor model:

- The view sets editor state: active tool, active tile, active layer, selection, etc.
- The view sends high-level interactions such as `apply(x0, y0, x1, y1)`.
- The backend decides what happens based on current tool/state.
- Undo/redo, selection, clipboard, layer locking/visibility, and tile edits are backend responsibilities.

This keeps the browser view thin and avoids recreating tile editing logic in JS.

## Components

### WASM plugin: `tilemap`

Worker-side singleton service.

Responsibilities:

- handle table for open tilemap documents
- stbte-like map/editor state
- active tool/tile/layer
- selection and clipboard
- undo/redo
- layer structure mutations
- tile definitions and layermasks
- filesystem load/save
- import/export between file JSON and internal stbte memory
- later: dynamic JSON updates with `yyjson` or equivalent

Phase-1 bootstrap:

- implement the final method names
- return mock/synthetic data
- keep the API stable for the view
- no real canvas/memory rendering dependency required yet

### View: `view-tilemap.js`

Main-thread browser custom element.

Responsibilities:

- header controls
- sidebar/tool UI
- footer/status UI
- canvas rendering later
- camera/zoom/pan later through `ViewCanvasBase`
- converting pointer events to tile coordinates later
- calling backend API methods
- rendering backend snapshot state

Non-responsibilities:

- SQL strings
- filesystem write/read implementation
- tile mutation algorithms
- undo/redo stacks
- selection/copy/paste data structures
- JSON import/export logic

## Persistence Direction

Move normal tilemap persistence from SQL to filesystem, matching the nodegraph direction.

Target user flow:

- open a `.tilemap.json` file through file chooser / `view-files`
- edit through `tilemap` handle
- save back to the same path
- save-as to a different path

SQL compatibility can be handled later as explicit import/export migration tooling, not the primary browser2 tilemap path.

## JSON Handling

The existing tilemap JSON shape should remain a useful interchange format:

```json
{
  "layers": [
    { "width": 32, "data": [0, 1, 2], "props": { "name": "Layer 0" } }
  ],
  "props": { "name": "world" }
}
```

For real backend save/load, consider `yyjson` for mutable JSON updates:

- preserve map/layer props not understood by the editor
- update only known changed fields
- avoid manual string concatenation
- keep JSON manipulation in WASM/backend, not in the view

Open question: vendoring `yyjson` into the eventual tilemap backend vs using a smaller custom serializer. This is deferred until the client-side state prototype settles.

## Initial UI Scope: HTML First

Build the UI shell before canvas editing.

### Header controls

Allowed via `createHeaderControlsElement()` and `[slot="header-controls"]`:

- open
- save
- save-as
- reload
- tool buttons:
  - select
  - brush
  - erase
  - eyedropper
  - paste
- undo
- redo
- zoom in/out/fit later

Use documented elements from `VIEW_RULES.md`:

- `button`
- `button > i`
- `input[type="number"]`
- `select`
- `option`
- `output`

No inline CSS.

### Sidebar

Use one optional `aside`.

Suggested sidebar sections:

1. Layers
   - layer list
   - table row selection
   - click toggles a layer in/out of selection
   - hide/show
   - lock/unlock
   - insert/delete/move controls
2. Tilesets
   - client-side helper only; not part of WASM state/snapshot/persistence
   - each tab represents one loaded tileset image file, named without extension
   - current client mock names: `dungeon_floor`, `dungeon_walls`, `forest_overgrowth`
   - each image is split into a grid by tile size
   - clicking a placeholder cell calls `set_active_tile` with the numeric tile id
   - tilemap persistence/WASM edit state remains numbers only
3. History
   - renders the current `UndoHistory.toArray()` state from `cmd/browser2/util/undo.js`
   - undo/redo and history-state jumping use tilemap history state
4. Map metadata
   - path
   - dimensions
   - dirty flag

### Main element

Phase 1 HTML-first placeholder:

```html
<article data-element="summary"></article>
<aside data-element="sidebar"></aside>
<footer><output data-element="status"></output></footer>
```

Canvas phase later changes main element to:

```html
<canvas data-element="canvas"></canvas>
<aside data-element="sidebar"></aside>
<footer><output data-element="status"></output></footer>
```

Because `VIEW_RULES.md` says each view should contain exactly one main element, do not keep both `article` and `canvas` in the final view.

## Backend Interaction Pattern

1. View opens/creates a document.
2. Backend returns `{ handle, memory? }`.
3. View calls `snapshot(handle)` to render header/sidebar/footer.
4. User changes controls:
   - `set_tool`
   - `set_active_tile`
   - `set_active_layer`
   - `set_layer_hidden`
   - etc.
5. View calls `snapshot(handle)` again.
6. Canvas phase: pointer edit calls `apply(handle, x0, y0, x1, y1)`.
7. View redraws from memory/snapshot.

Do not mirror backend editor state in JS except for transient UI interaction state like hover tile or camera.

## Canvas Phase

After HTML shell works:

- subclass/use `ViewCanvasBase`
- read tile data from backend memory descriptor
- draw grid
- draw colored cells first
- add tileset rendering later
- pointer drag calls backend `apply`
- backend tool state determines brush/erase/select/eyedropper/paste behavior

## Sidepanel Rules

- Use `aside`; no custom CSS/inline styles.
- Preserve semantic browser2 UI tags.
- Use `data-element`, `data-action`, and `data-field` hooks.
- Keep rendering deterministic from `snapshot`.
- Missing required DOM/snapshot fields should throw immediately.

## Bootstrap Order

### Step 1: API documentation

Done in `view-tilemap-api.md`.

### Step 2: client-side state prototype

Status: bootstrapped.

- `cmd/browser2/views/view-tilemap.js` contains a private `TilemapState` class.
- `TilemapState` owns mock tilemap/editor state while the view owns DOM/rendering only.
- `create/open/save/snapshot` and layer/tool/history methods are kept close to the planned backend API names.
- The temporary `plugins/tilemap/` mock WASM plugin was removed.
- `cmd/browser2/core/gams.json` no longer registers a tilemap WASM plugin.

Next backend step after UI shell: replace `TilemapState` internals with real tilemap state/persistence while preserving the view-facing method shape.

### Step 3: HTML-only view

Status: bootstrapped.

- `cmd/browser2/views/view-tilemap.js` exists.
- It has no canvas yet.
- It extends `ViewCanvasBase` and renders `canvas`, sidebar, and footer status.
- It marks selected tool buttons with `[aria-selected="true"]` and `.accent`.
- It disables undo/redo buttons from state snapshot `canUndo` / `canRedo`.
- It calls private `TilemapState` methods with the final planned API shape.
- It renders mock `snapshot` state.
- `cmd/browser2/app.js` imports the view and replaces the placeholder registry entry.

### Step 4: real backend/state

Replace `TilemapState` internals with the chosen real implementation:

- filesystem-backed tilemap JSON persistence
- tile numbers as authoritative edit data
- optional later stbte/tilemap backend for advanced editing operations
- `snapshot` remains the view-facing state projection

### Step 5: filesystem persistence

- add `open(path)` and `save(path)` through `fs`
- import/export existing tilemap JSON
- consider `yyjson` for preserving/updating dynamic fields

### Step 6: canvas

Status: placeholder canvas wired and renderer classes split inside the single view file.

- `view-tilemap.js` now extends `cmd/browser2/util/view-canvas-base.js`.
- Zoom/pan/fit use the shared canvas base behavior.
- Header zoom buttons call `zoomIn`, `zoomOut`, and `fitToContent`.
- Open uses a `ui.popup` with `view-sql` in chooser mode against `tilemap_storage`; the popup options are isolated in `createOpenTilemapPopupOptions()` so replacing the chooser content with `view-files mode:chooser` later is a one-method content swap.
- Current drawing is a simple 2D canvas render from `TilemapState.snapshot()` tile data.
- `view-tilemap.js` owns the internal render helpers because each `view-*.js` must be deployment-contained:
  - `TilemapRender` draws the main map canvas from a snapshot plus view-owned selection/grid/camera data.
  - `TilesetRender` draws client-side tileset picker canvases and maps clicks to tile ids.
- `TilemapState` now uses `cmd/browser2/util/undo.js` for command history.
- The sidebar History table renders `UndoHistory.toArray()` state, including current state and parent index for non-linear branches.
- Future advanced rendering should replace/extend `TilemapRender` with a WebGL path for large maps, mipmaps, lookup tables, shaders, etc.

## Acceptance For Current Prototype Phase

- `view-tilemap` opens/creates a mock handle through private `TilemapState`.
- Header controls call the final state method shape.
- Sidebar renders snapshot layers/tilesets/history state.
- Canvas renders a placeholder map and supports base zoom/pan/fit.
- No legacy browser imports.
