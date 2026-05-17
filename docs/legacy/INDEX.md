# Legacy Markdown Archive

This directory contains pre-consolidation markdown documents moved from their original repo paths.

Purpose:

- preserve historical planning, design, API, TODO, and README material;
- make legacy source material explicit while the repo is converted into clearer PRDs, ADRs, and current docs;
- preserve each file's original relative path under `docs/legacy/` so references are easy to trace.

Do not treat files in this archive as canonical without checking whether they have already been converted into a PRD, ADR, or current operational documentation.

## Conversion status

- Documentation architecture/consolidation is now represented by `docs/prd/0001-docs-consolidation.md` and `docs/adr/0001-docs-architecture.md`.
- Remaining files below are source material for future conversion unless explicitly linked to a current PRD/ADR.
- Convert one bounded area at a time using the workflow in `docs/README.md`.
- Local conversion issues live under `.scratch/docs-consolidation/issues/`.
- Runtime/plugin-manager conversion has started in `docs/prd/0002-runtime-plugin-manager.md`.

## Inventory

Total archived markdown files: 45

### Area README/source notes

- `cmd/app/wit/README.md` — 18 lines — # cmd/app WIT
- `examples/demo/game-runner/README.md` — 17 lines — # Game runner demo view
- `sdk/go/tilemap/README.md` — 157 lines — # wasm-tiled
- `tools/opr-import/README.md` — 71 lines — # OPR Import Tool

### Cross-cutting docs

- `docs/INDEX.md` — 0 lines — (no heading)
- `docs/VERSION.md` — 214 lines — # GAMS WIT Interface Version Matching

### Planning / design / TODO source material

- `CLI_SERVE.md` — 214 lines — # Handoff: GAMS Wasmtime cache + CLI + `serve` validation
- `NOTES.md` — 15 lines — # Notes
- `TODO/image.comp.md` — 157 lines — # TODO: image.comp
- `TODO.md` — 8 lines — # TODO
- `docs/PLAN/PLAN.md` — 165 lines — # GAMS Planning
- `docs/PLAN/app-runtime-component-ui-spec.md` — 107 lines — # App Runtime, Components, UI Plugins, and Views
- `docs/PLAN/app-runtime-todo.md` — 225 lines — # cmd/app Runtime TODO
- `docs/PLAN/app-runtime-wrpc.md` — 125 lines — # cmd/app wRPC Investigation Plan
- `docs/PLAN/fs-runtime.md` — 78 lines — # Runtime and Virtual FS Interface
- `docs/PLAN/image-comp.md` — 89 lines — # image.comp Plan
- `docs/PLAN/layout3.md` — 103 lines — # layout3 plan
- `docs/PLAN/markovjunior.md` — 212 lines — # MarkovJunior Plugin/View Plan
- `docs/PLAN/view-ng-branching.md` — 205 lines — # view-ng Branch / Skip Flow Plan
- `docs/PLAN/view-vox.md` — 133 lines — # Vox Preview / Renderer Plan
- `docs/PLAN/widget-timeline.md` — 328 lines — # Timeline Widget Plan
- `views/VIEW_RULES.md` — 163 lines — # View Rules
- `views/view-ng.md` — 95 lines — # view-ng Rules
- `views/view-tilemap-api.md` — 521 lines — # view-tilemap State API
- `views/view-tilemap-design.md` — 301 lines — # view-tilemap Design
- `views/view-tilemap.md` — 219 lines — # view-tilemap Plan

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
