# Split fragments from legacy `docs/PLAN/PLAN.md`

The original legacy `docs/PLAN/PLAN.md` was too broad to convert or delete as one unit. It has been deleted and replaced by focused temporary fragments in this directory.

Use these fragments only as source material while converting legacy docs into PRDs, ADRs, and context docs. Delete each fragment once covered or dismissed.

Fragments:

- `runtime-and-project-config.md` — deleted after conversion into `docs/prd/0002-runtime-plugin-manager.md`, `docs/prd/0003-project-config.md`, `docs/prd/0004-wrpc-frontend-backend-spike.md`, `docs/prd/0005-frontend-view-and-ui-service-bridge.md`, and related ADRs.
- `tree-generation-source-of-truth.md` — converted into `docs/prd/0007-minimap-component.md`; broader pipeline treated as example only.
- `minimap-room-shape-generation.md` — converted into `docs/prd/0007-minimap-component.md`; `minimap2` renamed to current `minimap.comp`.
- `room-content-generation.md` — source for room-generation/Yoinking/research PRD.
- `reusable-browser-widgets.md` — deleted after preserving reusable-widget guidance in `docs/reference/gams-view-development-guide.md`.
- `browser-generation-views.md` — dismissed as deprecated and deleted without conversion.
- `implementation-order-and-clarifications.md` — deleted after runtime items were converted and generation leftovers moved to `generation-leftovers.md`.
- `generation-leftovers.md` — minimap-specific parts converted into `docs/prd/0007-minimap-component.md`; Markov/WFC items left to separate Project Unit sessions.
