# Vox Preview / Renderer Plan

## Goal

Add a first-party browser preview for MagicaVoxel `.vox` assets as a `view-files` open subview, matching the `view-image` pattern: double-clicking/opening a `.vox` file opens a popup-backed view for that file.

Initial scope is a read-only asset preview, not an editor. Editing, palette authoring, animation, material rendering, save/export actions, and open/save file toolbar actions are out of scope until the renderer contract is stable. Minimal scene graph placement is supported only so MagicaVoxel/world-editor files can preview.

## Direction

- Add `view-vox` as a browser `view` plugin/custom element under `cmd/browser/view/view-vox.js`, shaped like `cmd/browser/view/view-image.js`.
- Treat it as a `view-files` subview: `view-files.resolveFileOpenTag()` maps `.vox` to `view-vox`, and `view-files.openFile()` passes `{ path }` through popup props.
- Keep browser host thin: file open routing stays in `demo/gams.json` / project config, and file bytes come from `fs.read`.
- Do not add a new singleton plugin for MVP unless another plugin needs parsed `.vox` data outside this view.
- Reuse existing `.vox` parsing knowledge from `plugins/markov/mj/vox.go`, but implement the browser preview parser in JS for direct rendering.
- Follow `docs/reference/gams-view-development-guide.md`: one main `canvas`, optional `aside` for metadata/render settings, optional `footer` for path/status.

## MVP Behavior

Implementation status: initial MVP files exist at `cmd/browser/view/view-vox.js` and `cmd/browser/util/vox/`.

`view-vox` should:

1. Accept `data-source` and popup `path`, same pattern as `view-image`.
2. Read bytes with `runtime.call('fs', 'read', path)`.
3. Parse minimal MagicaVoxel chunks:
   - header `VOX ` + version,
   - `MAIN`,
   - one or more model `SIZE` + `XYZI`,
   - optional `RGBA` palette,
   - extension data types needed by scene graph chunks: `STRING`, `DICT`, packed `ROTATION`,
   - minimal scene graph chunks `nTRN`, `nGRP`, and `nSHP` for model instance placement.
4. Render voxels to a canvas using an isometric/orthographic 2D projection.
5. Provide header controls matching `view-image` only:
   - reload,
   - zoom out,
   - zoom fit,
   - zoom in.
6. Navigation differs from normal 2D canvas previews: pointer/drag navigation rotates the model instead of panning the viewport. No panning for MVP.
7. Show footer status with model count, instance count, voxel count, palette source, and current file path.
8. Register `.vox` in `view-files.config.open` to open with `view-vox`.

## Rendering Approach

MVP should use `CanvasRenderingContext2D`, not WebGL/Three.js.

Recommended first renderer:

- Convert each voxel to `{ x, y, z, color }`.
- Sort draw order back-to-front based on current rotation.
- Draw visible top/left/right isometric faces with simple brightness adjustment.
- Use palette colors from `RGBA`; if absent, use MagicaVoxel default palette or a deterministic debug palette as a clearly marked temporary step.
- Fit bounds through `ViewCanvasBase` if practical, matching `view-image` zoom/pan behavior.

This is enough for small/medium asset previews and avoids introducing a general 3D runtime dependency before requirements are clear.

## Parser Notes

Existing Go parser at `plugins/markov/mj/vox.go` is intentionally minimal and stores palette indexes, not final RGBA colors. The browser parser should initially support the same core path plus palette decoding.

Keep a clear separation between:

1. **Base `.vox` preview support** — header/chunk walking plus `MAIN`, `SIZE`, `XYZI`, and `RGBA` needed to display simple voxel models.
2. **MagicaVoxel extension/world-editor support** — documented in `tmp/MagicaVoxel-file-format-vox-extension.txt`. Minimal scene graph support (`nTRN`, `nGRP`, `nSHP`) is implemented for preview placement. Material, layer, render, note, and palette-index-map chunks remain later work and should not be silently mixed into base preview semantics.

Important base `.vox` details to handle:

- `XYZI` color index is 1-based.
- `RGBA` contains 256 colors as RGBA bytes.
- Files may contain multiple models. If scene graph chunks are present, `nSHP` model ids determine rendered instances. If no scene graph exists, all models render at the origin as simple preview instances.
- Unknown chunks should be skipped using their declared content/children sizes, not treated as fatal unless chunk sizes are malformed.
- Scene graph chunks `nTRN`, `nGRP`, and `nSHP` are part of the extension/world-editor data. MVP support parses node ids, attributes, child links, model ids, first-frame translation, and packed rotation enough to place preview instances.

Extension chunks still to implement later from `tmp/MagicaVoxel-file-format-vox-extension.txt`:

- material/layer chunks: `MATL`, `LAYR`.
- render/camera chunks: `rOBJ`, `rCAM`.
- palette metadata chunks: `NOTE`, `IMAP`.

When extension support is added, keep it as a named parser layer/API surface, for example `decode(..., { extensions: true })` or a separate exported helper, so callers can distinguish simple model preview data from full MagicaVoxel world-editor scene data.

## UI Shape

Main structure:

```html
<canvas data-element="canvas"></canvas>
<footer data-element="footer">
  <output data-element="path"></output>
  <output data-element="status">Loading...</output>
</footer>
```

Optional later side panel:

```html
<aside data-element="inspector">
  <output data-field="dimensions"></output>
  <output data-field="voxels"></output>
  <output data-field="palette"></output>
</aside>
```

Header controls should use documented button groups from `docs/reference/gams-view-development-guide.md` and match `view-image`:

- `file-actions`: reload only
- `view-actions`: zoom out, zoom fit, zoom in

Do not add open/save/save-as/export buttons for MVP. Do not add rotate buttons for MVP; rotation is pointer/drag navigation.

## Integration Points

- `cmd/browser/util/vox/decode.js`: shared browser-side `.vox` decoder for `VOX `, `MAIN`, `SIZE`, `XYZI`, `RGBA`, and minimal `nTRN`/`nGRP`/`nSHP` scene graph placement.
- `cmd/browser/util/vox/encode.js`: shared browser-side minimal `.vox` encoder for generated or edited voxel assets.
- `cmd/browser/view/view-vox.js`: new preview implementation, following `view-image` conventions for `data-source`, popup `path`, reload, zoom controls, and footer path/status. It should not expose open/save file actions. It may reuse `ViewCanvasBase` zoom/fit pieces, but must disable/avoid panning because drag navigation rotates the model for MVP.
- `demo/gams.json`: add `view-vox` registration and `.vox` open mapping under `ui.views.view-files.config.open`.
- Demo assets: `demo/vox/preview.vox` is a simple base-format fixture for preview testing. Existing `.vox` files under `demo/res-markov/resources/...` are mounted and should preview through minimal `nTRN`/`nGRP`/`nSHP` scene graph support.
- Optional tests later: parser fixture based on a tiny generated `.vox` similar to `plugins/markov/mj/wfc_tile_test.go`.

## Later Extensions

- Promote parser to a singleton `vox` plugin if nodegraph, Markov tooling, conversion, or exporters need shared `.vox` decoding.
- Add WebGL renderer for large models, perspective camera, lighting, outlines, and picking.
- Expand scene graph support beyond MVP placement if needed: full transform composition, layers/hidden state, material chunks, and multi-frame scene transforms.
- Add export paths: screenshot PNG, mesh JSON/glTF, sprite sheet turntable, or tile/sprite thumbnails.
- Integrate with `view-markov` for inspecting `.vox` rule inputs/outputs.

## Open Questions

- Should MVP render only the first model or compose all models when multiple `SIZE`/`XYZI` pairs exist?
- Do we need exact MagicaVoxel default palette on day one, or is requiring/expecting `RGBA` acceptable for first-party assets?
- Should `.vox` previews be purely visual, or should selection/picking expose voxel coordinates and color indexes immediately?
- Is `view-vox` enough, or do upcoming nodegraph/Markov workflows need a shared `vox` singleton plugin from the start?
