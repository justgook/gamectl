# Layers Widget Plan

Goal: add a reusable browser widget for sprite/animation layers, copying Aseprite’s layer model and interaction vocabulary where it fits GAMS.

Reference: <https://www.aseprite.org/docs/layers/>

The widget should be embeddable by any browser view, especially animation creation, sprite layering/compositing, and later skeleton animation views. It should not own rendering or asset persistence; host views/plugins provide layer data, react to events, and call plugins for persistence/compositing.

## Target Element

Proposed custom element:

- `layers-widget` in `cmd/browser/widgets/layers-widget.js`

Why a widget, not a view:

- It is a reusable panel/control, not a full workspace.
- It should be usable inside `view-animation`, image/sprite editors, tile/sprite compositors, and future skeleton animation UI.
- It should communicate through attributes/properties/events, not assume a specific plugin or file format.

## Aseprite Features to Copy

Core layer row fields:

- layer name
- visible / hidden toggle
- locked / editable toggle
- continuous cel preference toggle
- selected/active layer
- layer type indicator
- cels/frames strip when used in animation/timeline contexts

Layer kinds:

- `background`: opaque, one per sprite/document, always bottom, not movable above normal layers
- `layer`: transparent raster/sprite layer, stackable and movable
- `group`: contains child layers and can collapse/expand
- `tilemap`: tilemap layer for tile-based animation/editing
- future: `skeleton` or `rig` layer kind if skeleton animation needs distinct behavior

Operations:

- add new transparent layer
- add group
- add tilemap layer
- rename layer
- duplicate/copy layer
- delete layer
- move/reorder layer
- toggle visible
- toggle locked
- toggle continuous
- select active layer
- expand/collapse group
- convert background ↔ transparent layer
- create layer from selection: planned integration point, owned by host editor/view

## Initial Scope

Phase 1 should implement only the reusable layer stack UI:

- render nested layers/groups
- select active layer
- rename layer
- toggle visible/locked/continuous
- add/delete/duplicate/reorder events
- drag or button-based reorder; if drag is too much, start with up/down buttons
- expose background constraints in UI

Phase 1 should not implement:

- actual pixel/cel storage
- compositing/rendering
- filesystem save/load
- skeleton animation semantics
- full timeline editing

Phase 2 adds optional frame/cel strip support:

- show frame columns beside layer names, matching the Aseprite screenshot/timeline idea
- select active cel `{ layerId, frame }`
- represent empty vs present cels
- support continuous-layer display hints
- leave cel creation/deletion as events handled by the embedding view/plugin

## Data Model

Widget input should be a plain JS object assigned as a property, not JSON-in-attribute for large documents.

```js
layersWidget.value = {
  activeLayerId: 'body',
  activeFrame: 0,
  frameCount: 12,
  showFrames: true,
  layers: [
    {
      id: 'shadow',
      name: 'Shadow',
      kind: 'layer',
      visible: true,
      locked: false,
      continuous: true,
      cels: [{ frame: 0 }, { frame: 1 }]
    },
    {
      id: 'character',
      name: 'Character',
      kind: 'group',
      visible: true,
      locked: false,
      collapsed: false,
      children: [
        { id: 'gun', name: 'Gun', kind: 'layer', visible: true, locked: false, continuous: true },
        { id: 'body', name: 'Body', kind: 'layer', visible: true, locked: false, continuous: true }
      ]
    },
    {
      id: 'background',
      name: 'Background',
      kind: 'background',
      visible: true,
      locked: false,
      continuous: true
    }
  ]
}
```

Rules:

- `id`, `name`, `kind`, `visible`, `locked`, and `continuous` are required for each layer.
- `children` is required for `kind: 'group'`.
- `children` is invalid for non-group layers.
- at most one `background` layer is allowed.
- `background`, when present, must be the bottom root layer.
- missing required data is an internal bug: fail loudly.

Open question: should layer order be top-to-bottom like Aseprite’s timeline display, or bottom-to-top like rendering order? Preferred: top-to-bottom in widget data, because that matches what users see and makes background-last explicit.

## Events / Embedding Contract

The widget should emit bubbling `CustomEvent`s. The widget requests changes; the embedding view owns data mutation and then reassigns `value`.

Proposed events:

- `layers-select`: `{ layerId }`
- `layers-select-cel`: `{ layerId, frame }`
- `layers-rename`: `{ layerId, name }`
- `layers-toggle-visible`: `{ layerId, visible }`
- `layers-toggle-locked`: `{ layerId, locked }`
- `layers-toggle-continuous`: `{ layerId, continuous }`
- `layers-add`: `{ parentId, kind, afterLayerId }`
- `layers-delete`: `{ layerId }`
- `layers-duplicate`: `{ layerId }`
- `layers-move`: `{ layerId, parentId, index }`
- `layers-collapse`: `{ layerId, collapsed }`
- `layers-convert-kind`: `{ layerId, kind }`

This keeps the widget reusable across animation, sprite, tilemap, and future skeleton views.

## DOM / View Rules Vocabulary

Implementation should follow `cmd/browser/VIEW_RULES.md` and preserve semantic/themed elements.

Recommended internal structure:

```html
<layers-widget>
  <article data-element="layers">
    <table data-element="layer-table">
      <thead>...</thead>
      <tbody>...</tbody>
    </table>
  </article>
  <footer data-element="layer-actions">
    <button data-action="add-layer"><i>add</i></button>
    <button data-action="add-group"><i>create_new_folder</i></button>
    <button data-action="duplicate"><i>content_copy</i></button>
    <button data-action="delete"><i>delete</i></button>
  </footer>
</layers-widget>
```

Expected additions to `VIEW_RULES.md` when implemented:

- `layers-widget` - reusable layer stack/timeline widget
- `button[aria-pressed]` - toggle buttons for visible/locked/continuous if not already documented
- `tr[aria-selected="true"]` - selected layer/cel row pattern

## UI Notes from Aseprite

Copyable behavior:

- eye icon for visibility
- lock icon for locked state
- linked/chain or repeated-dot icon for continuous cels
- layer kind icon before the name
- active layer/cel highlighted
- background layer visibly distinguished and fixed at bottom
- group rows can indent children and show collapsed state
- timeline/cel area can use compact frame-number columns like the screenshot

Do not copy one-off host behavior that belongs in an editor/view:

- drawing restrictions for locked layers should be enforced by the editing view/plugin, not by this widget alone
- layer movement/rendering/compositing belongs to the sprite/animation plugins
- selection-to-layer operations require editor selection state and should be host-owned

## Plugin Architecture Fit

Near term, this can be a browser-only widget.

Longer term contracts:

- `view-animation` uses `layers-widget` for frame animation authoring.
- Sprite/image compositing plugin owns persisted layer/cel data and render/composite operations.
- Tilemap layers route tile editing to tilemap plugins.
- Skeleton animation can either use `kind: 'skeleton'` or a separate track/layer widget once requirements are clearer.

Prefer plugin-to-plugin calls for persistence/compositing. The widget should not call `fs` or asset plugins directly.

## Implementation Order

1. Add `cmd/browser/widgets/layers-widget.js` with strict data validation and event emission.
2. Import it from `cmd/browser/app.js`.
3. Add base CSS tokens/styles in `cmd/browser/base.css`.
4. Update `cmd/browser/VIEW_RULES.md` with the new widget vocabulary.
5. Embed a demo/static instance into `view-animation` using the sample Shadow/Gun/Body/Background stack from the screenshot.
6. Add frame/cel strip support once the animation data shape is chosen.
7. Connect to an animation/sprite plugin contract for loading/saving and compositing.

## Requires Clarification

- Exact persisted asset schema for layered sprites/animations.
- Whether animation frames are globally indexed or can differ per layer/track.
- Whether `continuous` should mean Aseprite-like cel creation preference only, or also runtime interpolation/reuse behavior in GAMS.
- First skeleton-animation requirements and whether they fit a normal layer kind.
- Whether drag-and-drop reorder is required in phase 1 or button reorder is enough.
