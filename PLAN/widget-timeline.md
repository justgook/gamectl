# Timeline Widget Plan

Goal: add a reusable browser widget for sprite/animation timelines, copying Aseprite’s timeline/layer model and interaction vocabulary where it fits GAMS.

References:

- <https://www.aseprite.org/docs/timeline/>
- <https://www.aseprite.org/docs/layers/>

The widget should be embeddable by any browser view, especially animation creation, sprite layering/compositing, and later skeleton animation views. It should not own rendering or asset persistence; host views/plugins provide a JS model/controller object and call plugins for persistence/compositing.

## Target Element

Proposed custom element:

- `gams-timeline` in `cmd/browser/widgets/timeline.js`

Name rationale:

- Aseprite’s full component is the Timeline: it shows layers, frames, cels, and later tags.
- `layers` is only the left-side stack within the timeline.
- Calling the reusable component `Timeline` leaves room for animation/frame workflows without renaming later.

Why a widget, not a view:

- It is a reusable panel/control, not a full workspace.
- It should be usable inside `view-animation`, image/sprite editors, tile/sprite compositors, and future skeleton animation UI.
- It should communicate through a JS property model/controller object, not DOM events, and must not assume a specific plugin or file format.

## Aseprite Features to Copy

Timeline scope:

- left layer stack
- top frame header
- cel grid at layer/frame intersections
- active frame and active cel
- frame operations: add, move, copy, delete
- cel operations: move, copy, delete
- tags/loop sections later
- preferences/config controls later, e.g. first-frame numbering

Core layer row fields:

- layer name
- visible / hidden toggle
- locked / editable toggle
- continuous cel preference toggle
- selected/active layer
- layer type indicator
- cels/frames grid

Layer kinds:

- `layer`: generic leaf row/layer, stackable and movable
- `group`: contains child layers and can collapse/expand

Intentional simplification:

- Do not implement Aseprite’s special `background` layer rules.
- Backgrounds can be represented as normal `layer` entries named/background-tagged by the embedding view if needed.
- Tilemap, skeleton, rig, sprite, image, and other editor/plugin-specific subtypes should be represented as normal `layer` entries at the widget level for now.
- If subtype-specific behavior is needed later, the embedding view/plugin can keep subtype metadata outside the widget contract or add optional display metadata without changing core timeline operations.
- This avoids one-off ordering/movement/opacity/type constraints without clear benefit for GAMS.

Operations:

- add new transparent layer
- add group
- rename layer
- duplicate/copy layer
- delete layer
- move/reorder layer
- toggle visible
- toggle locked
- toggle continuous
- select active layer
- expand/collapse group
- create layer from selection: planned integration point, owned by host editor/view
- add/move/copy/delete frames
- move/copy/delete cels
- add/focus tags and loop sections later

## Initial Scope

Phase 1 should implement the reusable timeline shell with a practical layer stack:

- render nested layers/groups
- render frame header and optional cel grid when `model.showFrames` is true
- select active layer
- select active frame/cel
- rename layer
- toggle visible/locked/continuous
- add/delete/duplicate/reorder layers through the supplied model/controller object
- add/delete/duplicate/reorder frames through the supplied model/controller object if frame controls are enabled
- drag or button-based reorder; if drag is too much, start with up/down buttons
- avoid special background constraints; all drawable layers use the same movement/stacking rules

Phase 1 should not implement:

- actual pixel/cel storage
- compositing/rendering
- filesystem save/load
- skeleton animation semantics
- persisted full timeline editing

Phase 2 deepens frame/cel behavior:

- richer cel operations beyond selection
- represent empty vs present cels
- support continuous-layer display hints
- frame move/copy operations
- cel move/copy operations
- tags/loop sections
- first-frame-number configuration hooks
- leave cel creation/deletion as model/controller operations handled by the embedding view/plugin

## Data Model / Controller Prop

Widget input should be a JS object assigned as a property, not JSON-in-attribute for large documents and not DOM events for interaction. The embedding view may provide a plain object, a class instance, or a `Proxy` with custom setters/getters. Those setters/getters are the integration triggers for the embedding view.

Proposed property:

```js
timeline.model = timelineModel
```

Minimal model shape:

```js
const timelineModel = {
  get activeLayerId() { return state.activeLayerId },
  set activeLayerId(layerId) {
    state.activeLayerId = layerId
    view.renderPreview()
  },

  get activeFrame() { return state.activeFrame },
  set activeFrame(frame) {
    state.activeFrame = frame
    view.renderPreview()
  },

  get frameCount() { return state.frameCount },
  get showFrames() { return state.showFrames },
  get layers() { return state.layers },
  get tags() { return state.tags },
  get firstFrameNumber() { return state.firstFrameNumber },

  renameLayer(layerId, name) {},
  setLayerVisible(layerId, visible) {},
  setLayerLocked(layerId, locked) {},
  setLayerContinuous(layerId, continuous) {},
  setLayerCollapsed(layerId, collapsed) {},
  addLayer({ parentId, kind, afterLayerId }) {},
  deleteLayer(layerId) {},
  duplicateLayer(layerId) {},
  moveLayer({ layerId, parentId, index }) {},
  convertLayerKind({ layerId, kind }) {},
  selectCel({ layerId, frame }) {},
  addFrame({ afterFrame }) {},
  deleteFrame(frame) {},
  duplicateFrame(frame) {},
  moveFrame({ frame, index }) {},
  copyCel({ fromLayerId, fromFrame, toLayerId, toFrame }) {},
  moveCel({ fromLayerId, fromFrame, toLayerId, toFrame }) {},
  deleteCel({ layerId, frame }) {}
}
```

Example backing state:

```js
const state = {
  activeLayerId: 'body',
  activeFrame: 0,
  frameCount: 12,
  showFrames: true,
  firstFrameNumber: 1,
  tags: [],
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
      kind: 'layer',
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
- missing required data is an internal bug: fail loudly.

Open question: should layer order be top-to-bottom like Aseprite’s timeline display, or bottom-to-top like rendering order? Preferred: top-to-bottom in widget data, because that matches what users see.

## Embedding Contract

The widget should call the supplied `model` object directly. It should not dispatch layer-operation events. This keeps integration explicit and lets the embedding view decide how setters/getters trigger preview redraws, plugin calls, dirty-state changes, undo stacks, or persistence.

Interaction mapping:

- selecting a layer sets `model.activeLayerId = layerId`
- selecting a cel calls `model.selectCel({ layerId, frame })` or sets `model.activeLayerId` + `model.activeFrame`
- renaming calls `model.renameLayer(layerId, name)`
- visibility toggle calls `model.setLayerVisible(layerId, visible)`
- lock toggle calls `model.setLayerLocked(layerId, locked)`
- continuous toggle calls `model.setLayerContinuous(layerId, continuous)`
- add layer/group calls `model.addLayer({ parentId, kind, afterLayerId })`
- delete calls `model.deleteLayer(layerId)`
- duplicate calls `model.duplicateLayer(layerId)`
- reorder calls `model.moveLayer({ layerId, parentId, index })`
- group expand/collapse calls `model.setLayerCollapsed(layerId, collapsed)`
- group/layer conversion, if supported, calls `model.convertLayerKind({ layerId, kind })`
- add/delete/duplicate/reorder frame controls call `model.addFrame(...)`, `model.deleteFrame(...)`, `model.duplicateFrame(...)`, `model.moveFrame(...)`
- cel copy/move/delete controls call `model.copyCel(...)`, `model.moveCel(...)`, `model.deleteCel(...)`

After each model operation, the widget should re-render from `model.layers`, `model.activeLayerId`, and related getters. If a model operation is async because it calls a plugin, the embedding view should expose that explicitly through the model method and decide when to refresh the widget.

## DOM / View Rules Vocabulary

Implementation should follow `cmd/browser/VIEW_RULES.md` and preserve semantic/themed elements.

Recommended internal structure:

```html
<gams-timeline>
  <article data-element="timeline">
    <table data-element="timeline-table">
      <thead data-element="frame-header">...</thead>
      <tbody data-element="layer-rows">...</tbody>
    </table>
  </article>
  <footer data-element="timeline-actions">
    <button data-action="add-layer"><i>add</i></button>
    <button data-action="add-group"><i>create_new_folder</i></button>
    <button data-action="add-frame"><i>note_add</i></button>
    <button data-action="duplicate"><i>content_copy</i></button>
    <button data-action="delete"><i>delete</i></button>
  </footer>
</gams-timeline>
```

Expected additions to `VIEW_RULES.md` when implemented:

- `gams-timeline` - reusable timeline widget for layers, frames, cels, and tags
- `button[aria-pressed]` - toggle buttons for visible/locked/continuous if not already documented
- `tr[aria-selected="true"]` - selected layer/cel row pattern

## UI Notes from Aseprite

Copyable behavior:

- eye icon for visibility
- lock icon for locked state
- linked/chain or repeated-dot icon for continuous cels
- generic layer/group icon before the name
- active layer/cel highlighted
- group rows can indent children and show collapsed state
- timeline/cel area can use compact frame-number columns like the screenshot

Do not copy one-off host behavior that belongs in an editor/view:

- drawing restrictions for locked layers should be enforced by the editing view/plugin, not by this widget alone
- layer movement/rendering/compositing belongs to the sprite/animation plugins
- selection-to-layer operations require editor selection state and should be host-owned

## Plugin Architecture Fit

Near term, this can be a browser-only widget.

Longer term contracts:

- `view-animation` uses `gams-timeline` for frame animation authoring.
- Sprite/image compositing plugin owns persisted layer/cel data and render/composite operations.
- Tilemap, skeleton, rig, sprite, and image-specific semantics stay in the embedding view/plugin; at the widget level they are all normal `layer` rows unless a later requirement justifies extending the contract.

Prefer plugin-to-plugin calls for persistence/compositing. The widget should not call `fs` or asset plugins directly.

## Implementation Order

1. Add `cmd/browser/widgets/timeline.js` with strict data/model validation and direct model/controller calls.
2. Import it from `cmd/browser/app.js`.
3. Add base CSS tokens/styles in `cmd/browser/base.css`.
4. Update `cmd/browser/VIEW_RULES.md` with the new widget vocabulary.
5. Embed a demo/static instance into `view-animation` using the sample Shadow/Gun/Body/Background stack from the screenshot, with Background represented as a normal layer.
6. Add frame/cel strip support once the animation data shape is chosen.
7. Connect to an animation/sprite plugin contract for loading/saving and compositing.

## Requires Clarification

- Exact persisted asset schema for layered sprites/animations.
- Whether animation frames are globally indexed or can differ per layer/track.
- Whether `continuous` should mean Aseprite-like cel creation preference only, or also runtime interpolation/reuse behavior in GAMS.
- Whether future subtype display metadata is needed, or whether all editor/plugin-specific meanings can remain outside the widget contract.
- Whether drag-and-drop reorder is required in phase 1 or button reorder is enough.
