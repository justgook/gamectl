# Convert image, layout, and generation plugin legacy docs

Status: ready-for-agent

## Source material

- `docs/legacy/plugins/image/API.md`
- `docs/legacy/TODO/image.comp.md`
- `docs/legacy/docs/PLAN/image-comp.md`
- `docs/legacy/plugins/layout.comp/README.md`
- `docs/legacy/docs/PLAN/layout3.md`
- `docs/legacy/plugins/markov/README.md`
- `docs/legacy/docs/PLAN/markovjunior.md`
- `docs/legacy/plugins/minimap/minimap/TREE_LAYOUT_IMPLEMENTATION.md`
- `docs/prd/0007-minimap-component.md` (converted from minimap-related split fragments)
- `docs/legacy/split/docs/PLAN/PLAN/room-content-generation.md`
- `docs/legacy/split/docs/PLAN/PLAN/browser-generation-views.md` — dismissed as deprecated and deleted without conversion.

## Expected output

- PRDs for image processing, layout, Markov/generation, and minimap/tree layout slices.
- ADRs only for durable algorithm/API/runtime-boundary decisions.
- `CONTEXT.md` updates for resolved asset-processing vocabulary.
- Conversion links/status in `docs/legacy/INDEX.md`.

## Comments

- Converted minimap-related split fragments into `docs/prd/0007-minimap-component.md`.
- Resolved current name: `minimap2` is now **Minimap Component** / `minimap.comp`.
- Treated tree → minimap → room-content as an example composition, not canonical architecture.
