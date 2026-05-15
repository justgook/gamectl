# GAMS Planning

GAMS is moving toward a plugin-driven CMS/toolkit where hosts stay thin and most behavior is exposed through WASM components, singleton services, view plugins, and stable WIT contracts.

This document is the top-level planning index. Detailed plans live under `docs/PLAN/`.

## Current Direction

Top priority: follow `PLAN/app-runtime-todo.md`.

Current task area: integrate `gams:fs` into the app startup flow after the initial topological loading/version-compatible wiring pass for `runtime.addPlugins(paths)`. Version matching rules are documented in `docs/VERSION.md`.

Current runtime direction:

- `cmd/app` is the primary host runtime for both desktop UI mode and Tauri CLI/subcommand mode.
- `cmd/cli` is only an experiment/source of patterns; do not maintain it as a second runtime.
- Use real WIT/component interfaces as stable plugin APIs.
- Do not require universal byte-oriented `export call(method, bytes)` plugin exports.
- Load components through `runtime.addPlugins(paths)` without caller-defined plugin ids.
- Use `runtime.invoke(target, args)` for frontend calls into registered WIT exports.
- Keep real WASI available to WASM components.
- Use the `gams:fs` proxy component for frontend/app filesystem operations instead of raw frontend `wasi:filesystem` wrappers.
- Support singleton `ui.plugins` with WIT-shaped APIs later.
- Support dynamic multi-instance `ui.views` later through `gams:runtime/runtime.call(view-id, string)`.
- Prefer plugin-to-plugin/component-to-component calls over host-specific callbacks.
- Treat legacy `instance` plugins as migration-only unless a concrete use case requires them.

## Priority Plans

1. `PLAN/app-runtime-todo.md` — active `cmd/app` runtime TODO; current focus is `gams:fs` app-flow integration.
2. `PLAN/app-runtime-wrpc.md` — investigation plan for replacing frontend/backend Tauri command/event payloads with wRPC where appropriate.
3. `PLAN/app-runtime-component-ui-spec.md` — background architecture summary; active checklist moved to TODO file.
4. `PLAN/fs-runtime.md` — historical/superseded app-side virtual FS plan.

## Planning Chunks

### 1. cmd/app Runtime

Detailed active plan: `PLAN/app-runtime-todo.md`.

Current next task:

- Ensure `plugins/fs.wasm` is loaded in the app flow and frontend filesystem helpers use `gams:fs`.

Remaining major runtime work:

- Load/verify `plugins/fs.wasm` in the app flow and route frontend filesystem helpers through `gams:fs`.
- Spike wRPC for frontend/backend communication if `PLAN/app-runtime-wrpc.md` open questions are resolved.
- Expand JSON ↔ WIT value conversion.
- Implement blocking `gams:runtime/runtime.call` bridge to frontend views.
- Implement singleton WIT-shaped frontend `ui.plugins`.
- Decide project bootstrap/config loading.
- Implement real Tauri CLI subcommands on the same runtime.

### 2. Tree as generation source of truth

Goal: make `tree` carry enough structured intent for downstream procedural plugins to consume without regenerating already-authored facts.

Remaining work:

- Add fixtures/integration tests showing authored `data.minimap` masks flowing from tree JSON through `plugins/minimap2` into tilemap output.

Decisions:

- `tree.Node.Data` MUST stay `map[string]string`.
- Plugin/view metadata MUST live inside `data`; no additional node properties beyond `parent` and `data`.
- Room-shape metadata for minimap work uses `data["minimap"]`.
- `data["minimap"]` stores a compact room-shape mask string: rows separated by `/`, `#` for occupied cells, and `.` for empty cells, parsed by `placement.ParseRoomShapeMask`.
- If a node has no `data["minimap"]` mask, `plugins/minimap2` uses its existing random room-shape chooser fallback.

### 3. Minimap and room-shape generation

Goal: separate room graph/layout concerns from room content generation.

Remaining work:

- Keep `minimap` as legacy unless needed for migration comparison.

Proposed logical split:

1. `treegen` or authoring plugin creates/edits the room tree.
2. `minimap2` converts tree + room-shape metadata into a room placement/tilemap.
3. Later room-content plugins fill each room interior using WFC/Markov/user-guided generation.

### 4. User-driven procedural room content generation

Goal: create new plugins/views for interactive procedural generation where the user can guide, lock, regenerate, and inspect room content.

Potential plugins/views:

- `roomgen` singleton plugin: room content generation service.
- `view-roomgen` browser view: user-facing room generation/editor UI.
- Optional helper plugins for specific algorithms after research:
  - MarkovJunior-inspired rewriting/generative grammar plugin.
  - WaveFunctionCollapse-inspired tile constraint solver plugin.

Research targets:

- <https://github.com/mxgmn/MarkovJunior>
- <https://github.com/mxgmn/WaveFunctionCollapse>

Research questions:

- Which parts are useful for room interior generation vs. global map generation?
- How should samples/rules/constraints be represented as game assets?
- Can generated output be deterministic from a seed and tree node id?
- What should be user-lockable: tiles, regions, exits, entities, constraints, or generated tags?
- Should WFC/Markov logic be ported to Go/WASM, called as an external tool, or represented as data consumed by a smaller first-party solver?

Initial contract idea:

```json
{
  "tree": "res://world/tree.json",
  "node": 12,
  "roomShape": [{ "x": 0, "y": 0 }],
  "constraints": {
    "exits": [],
    "lockedTiles": [],
    "theme": "dungeon"
  },
  "out": "res://world/rooms/12.tilemap.json"
}
```

### 5. Reusable browser widgets

Goal: build embeddable UI widgets that views can reuse without hard-coding host/editor behavior.

Current widget plans:

- `PLAN/widget-timeline.md` — Aseprite-inspired `widget-timeline` widget for animation creation, sprite layering/compositing, frames/cels, and later skeleton animation.

### 6. Browser views for generation workflows

Goal: expose tree, minimap, and room generation through first-class view plugins instead of host-specific screens.

Candidate views:

- Tree authoring/inspection view.
- Minimap placement preview view.
- Room content generation view.

View assumptions:

- Views should call plugins through runtime/plugin contracts.
- Views should not own core generation logic.
- Shared memory/direct plugin-owned state can be used for first-party browser UI where it is simpler than runtime-managed mirrored state.

## Suggested Implementation Order

1. Ensure `plugins/fs.wasm` is loaded in app flow and frontend filesystem diagnostics use `gams:fs`.
2. Expand JSON ↔ WIT conversion for structured types.
3. Implement blocking WASM → frontend dynamic view calls.
4. Implement singleton WIT-shaped `ui.plugins`.
5. Decide project bootstrap/config loading.
6. Add minimap2 tree fixture/integration tests for authored `data.minimap` masks.
7. Continue room generation research/prototyping.

## Requires Clarification

- Project root/bootstrap config source for `cmd/app`.
- Exact JS representation for complex WIT values.
- Whether MarkovJunior/WFC should become direct dependencies, ports, or design references only.
