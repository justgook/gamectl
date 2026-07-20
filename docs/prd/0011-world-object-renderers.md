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
- The World Editor owns selection outlines, position anchors, dragging, and draw order.
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

## Acceptance criteria

- A world object without a renderer match remains a point.
- A rectangle object renders at its world position and can be selected and dragged through its rectangle bounds.
- Fit-to-content includes custom renderer bounds.
- Renderer modules initialize before world loading and dispose with their World Editor.
- Ambiguous matches and malformed renderer contracts fail loudly.

## Open questions

- None for the initial browser-only renderer contract.

## Related ADRs

- `docs/adr/0003-project-config-owns-composition.md`
