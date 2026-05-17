# Legacy Markdown Archive

This directory contains pre-consolidation markdown documents moved from their original repo paths.

Purpose:

- preserve historical planning, design, API, TODO, and README material;
- make legacy source material explicit while the repo is converted into clearer PRDs, ADRs, and current docs;
- preserve each file's original relative path under `docs/legacy/` so references are easy to trace.

Do not treat files in this archive as canonical without checking whether they have already been converted into a PRD, ADR, or current operational documentation.

## Conversion status

- Initial archived markdown files: 45
- Removed from original legacy set after conversion/dismissal/splitting: 18
- Remaining original legacy markdown files: 27
- Temporary split reference fragments: 2 files
- Documentation architecture/consolidation is represented by `docs/prd/0001-docs-consolidation.md` and `docs/adr/0001-docs-architecture.md`.
- Runtime/plugin-manager conversion has started in `docs/prd/0002-runtime-plugin-manager.md`.
- Project Config conversion has started in `docs/prd/0003-project-config.md`.
- wRPC spike conversion is represented by `docs/prd/0004-wrpc-frontend-backend-spike.md`.
- Frontend view/UI Service bridge conversion is represented by `docs/prd/0005-frontend-view-and-ui-service-bridge.md`.
- CLI HTTP serve Host conversion is represented by `docs/prd/0006-cli-http-serve-host.md`.
- Minimap Component conversion is represented by `docs/prd/0007-minimap-component.md`.
- Core View development rules are represented by `docs/reference/gams-view-development-guide.md`.
- Local conversion issues live under `.scratch/docs-consolidation/issues/`.

### Removed from legacy this session

- `docs/VERSION.md` — converted to `docs/adr/0004-wit-interface-version-matching.md` and summarized in `docs/prd/0002-runtime-plugin-manager.md`.
- `docs/INDEX.md` — empty legacy index, dismissed as unnecessary after `docs/README.md` and this archive index were created.
- `TODO.md` — converted to `docs/ideas/legacy-notes-inbox.md`.
- `NOTES.md` — converted to `docs/ideas/legacy-notes-inbox.md`.
- `CLI_SERVE.md` — converted to future/post-v1 `docs/prd/0006-cli-http-serve-host.md`.
- `views/VIEW_RULES.md` — converted to canonical `docs/reference/gams-view-development-guide.md`.
- `views/view-ng.md` — dismissed as outdated; future Project Unit PRD/ADR will be created separately if needed.
- `docs/PLAN/view-ng-branching.md` — dismissed as outdated; future Project Unit PRD/ADR will be created separately if needed.
- `views/view-tilemap.md` — dismissed as outdated; future Project Unit PRD/ADR will be created separately if needed.
- `views/view-tilemap-api.md` — dismissed as outdated; future Project Unit PRD/ADR will be created separately if needed.
- `views/view-tilemap-design.md` — dismissed as outdated; future Project Unit PRD/ADR will be created separately if needed.
- `docs/PLAN/view-vox.md` — dismissed as outdated; future Project Unit PRD/ADR will be created separately if needed.
- `docs/PLAN/widget-timeline.md` — dismissed as outdated; future Project Unit PRD/ADR will be created separately if needed.
- `docs/PLAN/PLAN.md` — split into focused temporary fragments under `docs/legacy/split/docs/PLAN/PLAN/` and removed as an oversized source document.
- `docs/PLAN/app-runtime-todo.md` — converted to the migration backlog in `docs/prd/0002-runtime-plugin-manager.md`.
- `docs/PLAN/app-runtime-wrpc.md` — converted to `docs/prd/0004-wrpc-frontend-backend-spike.md`.
- `docs/PLAN/app-runtime-component-ui-spec.md` — converted to `docs/prd/0005-frontend-view-and-ui-service-bridge.md`.
- `docs/PLAN/fs-runtime.md` — converted to `docs/adr/0005-use-wasi-and-gams-fs-instead-of-host-virtual-fs.md`.
- `split/docs/PLAN/PLAN/runtime-and-project-config.md` — deleted after conversion into runtime/project-config PRDs and ADRs.
- `split/docs/PLAN/PLAN/implementation-order-and-clarifications.md` — runtime parts converted; generation leftovers moved to `split/docs/PLAN/PLAN/generation-leftovers.md`.
- `split/docs/PLAN/PLAN/reusable-browser-widgets.md` — deleted after preserving reusable-widget guidance in `docs/reference/gams-view-development-guide.md`.
- `split/docs/PLAN/PLAN/browser-generation-views.md` — dismissed as deprecated and deleted without conversion.
- `split/docs/PLAN/PLAN/tree-generation-source-of-truth.md` — converted into `docs/prd/0007-minimap-component.md` with broader pipeline treated as example only.
- `split/docs/PLAN/PLAN/minimap-room-shape-generation.md` — converted into `docs/prd/0007-minimap-component.md`; `minimap2` renamed to current `minimap.comp`.
- `split/docs/PLAN/PLAN/generation-leftovers.md` — minimap parts converted into `docs/prd/0007-minimap-component.md`; Markov/WFC items left to separate Project Unit sessions.

## Split reference fragments

These are temporary fragments created from oversized legacy documents. They should be deleted as soon as their content is converted or dismissed.

- `split/docs/PLAN/PLAN/README.md` — 16 lines — # Split fragments from legacy `docs/PLAN/PLAN.md`
- `split/docs/PLAN/PLAN/room-content-generation.md` — 48 lines — # Split from legacy docs/PLAN/PLAN.md: Room Content Generation

## Inventory

Total remaining original archived markdown files: 27

### Area README/source notes

- `cmd/app/wit/README.md` — 18 lines — # cmd/app WIT
- `examples/demo/game-runner/README.md` — 17 lines — # Game runner demo view
- `sdk/go/tilemap/README.md` — 157 lines — # wasm-tiled
- `tools/opr-import/README.md` — 71 lines — # OPR Import Tool

### Planning / design / TODO source material

- `TODO/image.comp.md` — 157 lines — # TODO: image.comp
- `docs/PLAN/image-comp.md` — 89 lines — # image.comp Plan
- `docs/PLAN/layout3.md` — 103 lines — # layout3 plan
- `docs/PLAN/markovjunior.md` — 212 lines — # MarkovJunior Plugin/View Plan

### Plugin docs and specs

- `plugins/ai_agent/DESIGN.md` — 367 lines — # ai_agent design
- `plugins/ai_agent/README.md` — 152 lines — # ai_agent
- `plugins/ai_agent/TODO.md` — 317 lines — # ai.agent TODO
- `plugins/ai_provider_mock/README.md` — 81 lines — # ai_provider_mock
- `plugins/automap/README.md` — 352 lines — # Automap
- `plugins/automap/SPEC.md` — 210 lines — # Automapping Metadata Specification
- `plugins/automap/TESTDATA.md` — 49 lines — # Automap Fixture Workflow
- `plugins/game2/README.md` — 21 lines — # game2
- `plugins/image/API.md` — 583 lines — # Image Plugin API
- `plugins/layout.comp/README.md` — 25 lines — # layout.comp
- `plugins/lua/README.md` — 148 lines — # lua plugin
- `plugins/lua.comp/README.md` — 67 lines — # lua.comp
- `plugins/markov/README.md` — 282 lines — # markov
- `plugins/math/README.md` — 115 lines — # Math Plugin
- `plugins/minimap/minimap/TREE_LAYOUT_IMPLEMENTATION.md` — 1611 lines — # Tree Layout Algorithm Implementation Guide
- `plugins/respack/README.md` — 53 lines — # respack wasm plugin (odin)
- `plugins/sql/README.md` — 457 lines — # SQL Plugin
- `plugins/sql-vec/README.md` — 462 lines — # SQL Vec Plugin

### Repo overview

- `README.md` — 111 lines — # GAMS - Game Asset Management System
