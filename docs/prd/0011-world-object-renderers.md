# World Object Renderers

## Status

Draft

## Source material

- `views/view-world.js`
- `packages/util/view-canvas-base.js`
- `docs/reference/gams-view-development-guide.md`
- `docs/contexts/project-composition/CONTEXT.md`
- `docs/prd/0003-project-config.md`

## Problem

The World Editor initially represents every World Object as a point. Projects need browser-only rendering for project-specific object types without putting those representations into authored World Object data or hard-coding every type into the Core View.

## Goals

- Let each Project configure browser-only World Object Renderers for the World Editor.
- Select renderers through exact matches against ordinary World Object properties.
- Keep authored object data independent from renderer implementation modules.
- Preserve World Editor ownership of ordering, selection, hit testing, positioning, and viewport behavior.
- Support renderer-specific asynchronous resource preparation while keeping canvas drawing synchronous.

## Non-goals

- Do not make World Object Renderers a top-level Project Unit category.
- Do not route `CanvasRenderingContext2D` through the Plugin Manager.
- Do not support WASM renderers in this slice.
- Do not compose multiple custom renderers for one object.
- Do not persist renderer instances or editor selection state in world data.

## Requirements

- World Object Renderers are declared under `view-world.config.renderers` as an object map keyed by Project-local renderer id.
- Every renderer declaration contains:
  - a non-empty `url`,
  - a non-empty `match` object whose values are strings,
  - a `config` object passed to the renderer factory.
- Every matcher entry compares one World Object property by exact string equality; multiple entries use logical AND.
- No custom match uses the built-in point renderer.
- Exactly one custom match replaces the built-in point renderer.
- Multiple custom matches for one object are an error.
- All configured renderer modules are loaded when a World Editor initializes.
- Every module exports `createWorldObjectRenderer({ config })`.
- The factory creates one renderer instance per World Editor instance.
- Every renderer instance implements:
  - `prepare(objects)` as an asynchronous resource-preparation operation,
  - `draw(ctx, object, frame)` as a synchronous canvas operation,
  - `bounds(object)` returning a local-space AABB,
  - `dispose()` for renderer-owned cleanup.
- After a world opens or its object/property set changes, every renderer receives its complete matching object set through `prepare()`, including an empty array when it has no matches.
- Renderer preparation completes before the affected snapshot is drawn.
- Position-only changes do not trigger renderer preparation.
- Before `draw()`, the World Editor saves canvas state and translates the context to the object's world-space `x`/`y`; it restores canvas state afterward.
- Renderer bounds use object-local coordinates and must have finite values and positive width and height.
- The World Editor uses translated renderer bounds for fit-to-content and hit testing.
- The World Editor owns selection outlines, position anchors, dragging, hover tooltips, and draw order.
- Hovering a rendered object requests a read-only tip through the `ui.tooltip` UI Service, tracks the renderer's screen-space bounds, and displays at most the first ten object properties.
- Objects are drawn in stored side-panel order.
- Renderer failures are fail-fast; malformed configuration, ambiguous matches, invalid bounds, and invalid renderer interfaces are not silently ignored.

## Initial vertical slice

The demo Project config registers a rectangle renderer matched by:

```json
{
  "render": "rectangle"
}
```

A matching object requires string properties for positive numeric `width` and `height`, plus a valid CSS `color`.

The demo rectangle, sprite, and tilemap renderers accept an optional `config.origin` tuple. Its two finite values are normalized X/Y positions from `0` through `1` within the rendered bounds: `[0, 0]` is top-left, `[0.5, 0.5]` is center, and `[0, 1]` is bottom-left. The World Object's `x`/`y` position identifies that origin point. Omitting `origin` preserves the top-left default.

The demo Project also registers a sprite renderer matched by:

```json
{
  "render": "sprite"
}
```

When a matching object has a `url` property, the renderer loads that project file. If `width` and `height` are both absent, it draws the image at its natural dimensions; if provided together, they override the rendered dimensions. Providing only one dimension is invalid. QOI, PNG, JPEG, WebP, GIF, and BMP sources are supported. When the `url` property is absent, the renderer draws a rectangle using required positive numeric `width` and `height` string properties and a valid CSS `color` string property.

The demo Project also registers a tilemap renderer matched by:

```json
{
  "render": "tilemap"
}
```

A matching object requires a non-empty `tilemap` property containing a project-relative tilemap path. Shared tilemap utilities validate the document, load its tilesets, and rasterize visible layers to an offscreen canvas. The World Object Renderer caches that raster by tilemap path and draws it at the object's world position.

Tilemap storage parsing, tileset loading, generated fallback tiles, and layer rasterization live in `packages/util/tilemap-render.js`. The Tilemap Editor reuses that lower-level functionality while retaining editor-only background, grid, layer emphasis, bounds, selection, and editing behavior.

## Acceptance criteria

- A world object without a renderer match remains a point.
- A rectangle object renders at its world position and can be selected and dragged through its rectangle bounds.
- A sprite object with `url` renders the referenced image at natural dimensions.
- A sprite object without `url` renders its configured rectangle.
- Demo renderer origins offset drawing, bounds, hit testing, selection, and fit-to-content while preserving the World Object's stored position.
- Sprite resources are cached by URL and released when no matching object uses them or when the renderer is disposed.
- A tilemap object renders all stored tilemap layers through an offscreen canvas at its world position.
- Tilemap rasters are cached by tilemap path and discarded when unused or disposed.
- The Tilemap Editor and tilemap World Object Renderer share storage parsing, tileset loading, and tile-layer rasterization.
- Fit-to-content includes custom renderer bounds.
- Hovering any point, rectangle, sprite, or tilemap object shows no more than ten property rows through `ui.tooltip`.
- Renderer modules initialize before world loading and dispose with their World Editor.
- Ambiguous matches and malformed renderer contracts fail loudly.

## Open questions

- None for the initial browser-only renderer contract.

## Related ADRs

- `docs/adr/0003-project-config-owns-composition.md`
