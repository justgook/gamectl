# Convert image, layout, and generation plugin legacy docs

Status: complete

## Source material

- `docs/legacy/plugins/image/API.md` — discarded without conversion per user decision.
- `docs/legacy/TODO/image.comp.md` — discarded without conversion per user decision.
- `docs/legacy/docs/PLAN/image-comp.md` — discarded without conversion per user decision.
- `docs/legacy/plugins/layout.comp/README.md` — discarded without conversion per user decision.
- `docs/legacy/docs/PLAN/layout3.md` — discarded without conversion per user decision.
- `docs/legacy/plugins/markov/README.md` — discarded without conversion per user decision.
- `docs/legacy/docs/PLAN/markovjunior.md` — discarded without conversion per user decision.
- `docs/legacy/plugins/minimap/minimap/TREE_LAYOUT_IMPLEMENTATION.md` — discarded without conversion per user decision.
- `docs/prd/0007-minimap-component.md` (converted from minimap-related split fragments)
- `docs/legacy/split/docs/PLAN/PLAN/room-content-generation.md` — discarded as outdated/deprecated without conversion.
- `docs/legacy/split/docs/PLAN/PLAN/browser-generation-views.md` — dismissed as deprecated and deleted without conversion.

## Expected output

- PRDs for image processing, layout, Markov/generation, and minimap/tree layout slices.
- ADRs only for durable algorithm/API/runtime-boundary decisions.
- `CONTEXT.md` updates for resolved asset-processing vocabulary.
- Legacy source files were converted, dismissed, or deleted; `docs/legacy/` has been removed.

## Comments

- Converted minimap-related split fragments into `docs/prd/0007-minimap-component.md`.
- Resolved current name: `minimap2` is now **Minimap Component** / `minimap.comp`.
- Treated tree → minimap → room-content as an example composition, not canonical architecture.
- Discarded split fragment `room-content-generation.md` as outdated/deprecated without conversion.
- Discarded image/image.comp, layout, markov, and minimap legacy long doc without conversion per user decision.
