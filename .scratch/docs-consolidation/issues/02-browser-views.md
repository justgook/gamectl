# Convert browser view legacy docs

Status: ready-for-human

## Source material

- `docs/reference/gams-view-development-guide.md` (converted from legacy `views/VIEW_RULES.md`)
- `docs/legacy/views/view-ng.md` — dismissed as outdated; future Project Unit PRD/ADR will be created in a separate session if needed.
- `docs/legacy/views/view-tilemap.md` — dismissed as outdated; future Project Unit PRD/ADR will be created in a separate session if needed.
- `docs/legacy/views/view-tilemap-api.md` — dismissed as outdated; future Project Unit PRD/ADR will be created in a separate session if needed.
- `docs/legacy/views/view-tilemap-design.md` — dismissed as outdated; future Project Unit PRD/ADR will be created in a separate session if needed.
- `docs/legacy/docs/PLAN/view-ng-branching.md` — dismissed as outdated; future Project Unit PRD/ADR will be created in a separate session if needed.
- `docs/legacy/docs/PLAN/view-vox.md` — dismissed as outdated; future Project Unit PRD/ADR will be created in a separate session if needed.
- `docs/legacy/docs/PLAN/widget-timeline.md` — dismissed as outdated; future Project Unit PRD/ADR will be created in a separate session if needed.
- `docs/legacy/split/docs/PLAN/PLAN/reusable-browser-widgets.md` — dismissed after preserving reusable-widget rule in `docs/reference/gams-view-development-guide.md`.
- `docs/legacy/split/docs/PLAN/PLAN/browser-generation-views.md` — dismissed as deprecated and deleted without conversion.

## Expected output

- Current Core View development guide extracted from shared rules.
- Outdated view-specific plans deleted without conversion; future Project Unit PRDs/ADRs will be created in separate focused sessions.
- `CONTEXT.md` updates for resolved view vocabulary.
- Conversion links/status in `docs/legacy/INDEX.md`.

## Comments

- Converted `docs/legacy/views/VIEW_RULES.md` into canonical `docs/reference/gams-view-development-guide.md` for Core View development.
- Resolved **Core View** in `docs/contexts/project-composition/CONTEXT.md`.
- Deleted outdated view-specific legacy plans without conversion per user decision.
- Deleted split fragment `reusable-browser-widgets.md` after preserving the rule that Core Views share reusable widgets in `docs/reference/gams-view-development-guide.md`.
- Deleted split fragment `browser-generation-views.md` as deprecated without conversion.
