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
- active tool/tile/category/layer
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

Open question: vendoring `yyjson` into `plugins/tilemap/` vs using a smaller custom serializer for phase 1. Mark this as implementation detail after the mock API is in place.

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

1. Tool state
   - active tool
   - active tile number
   - active category
2. Layers
   - layer list
   - active layer
   - hide/show
   - lock/unlock
   - solo
   - insert/delete/move controls
3. Selection / clipboard
   - selection bounds output
   - copy/cut/paste buttons
4. Map metadata
   - path
   - dimensions
   - dirty flag
   - undo/redo availability

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

### Step 2: mock WASM service

Create a new `plugins/tilemap/` service or wrap/adapt `plugins/stbte/`.

Recommended first step:

- create `plugins/tilemap/main.c`
- expose all final browser2 method names
- parse only minimal JSON needed for handles
- return mock `snapshot`
- maintain a tiny in-memory mock document state if simple
- add browser2 `gams.json` plugin entry as `tilemap`

### Step 3: HTML-only view

Create `cmd/browser2/views/view-tilemap.js`:

- no canvas yet
- header controls
- sidebar
- footer status
- call `runtime.call('tilemap', ...)`
- render mock snapshot
- replace app placeholder for `view-tilemap`

### Step 4: real backend state

Adapt `plugins/stbte` API internally with handle table:

- `handle -> stbte_tilemap*`
- method JSON args -> existing `stbte_*` calls
- `snapshot` reads state from structs/offset helpers

### Step 5: filesystem persistence

- add `open(path)` and `save(path)` through `fs`
- import/export existing tilemap JSON
- consider `yyjson` for preserving/updating dynamic fields

### Step 6: canvas

- shared memory descriptor
- rendering
- pointer interactions -> `apply`

## Acceptance For HTML-first Phase

- `tilemap` plugin is registered in browser2 and loadable.
- `view-tilemap` opens/creates a mock handle.
- Header controls call the final API method names.
- Sidebar renders snapshot layers/tool/selection/undo state.
- No legacy browser imports.
- No canvas code is required yet.
