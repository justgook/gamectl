# MarkovJunior Plugin/View Plan

## Goal

Create a first-party GAMS procedural generation plugin inspired by `tmp/MarkovJunior` and a browser view for authoring/running models against a target output grid.

The initial GAMS use case is room/content generation: a view sends a model plus grid dimensions/initial cells/constraints to a singleton service plugin, and the plugin returns a generated grid/tilemap.

## Repository Findings

Source investigated: `tmp/MarkovJunior`.

- License: MIT (`tmp/MarkovJunior/LICENSE`), suitable for source-porting with attribution.
- Runtime language: C# (`tmp/MarkovJunior/source/*.cs`). Current GAMS WASM plugin path is Go/TinyGo, C/Zig, Odin, or JS plugin. Direct C# reuse is not a natural browser plugin fit.
- Main entry flow:
  - `models.xml` lists model name, size, seeds, rendering options.
  - `models/<name>.xml` is loaded as the actual model.
  - `Interpreter.Load(root, MX, MY, MZ)` creates a `Grid` and node tree.
  - `Interpreter.Run(seed, steps, gif)` clears the grid, runs nodes, yields final or intermediate states.
- Core grid model:
  - `values="BRGUY"` defines the symbol alphabet; first symbol is the cleared/default cell.
  - grid state is a flat byte array of symbol indexes with dimensions `MX/MY/MZ`.
  - rules use symbolic strings with `/` as y separator and spaces as z separator.
- Node types in MarkovJunior:
  - rule nodes: `one`, `all`, `prl`
  - branches: `sequence`, `markov`
  - advanced nodes: `path`, `map`, `convolution`, `convchain`, `wfc` tile/overlap
- The most useful MVP for GAMS room interiors is the small rule-rewrite core: grid + rules + symmetry + `one/all/prl` + `sequence/markov` + deterministic seed.
- Advanced MarkovJunior features should be treated as later extensions unless a concrete roomgen model needs them.

## Direction

Do not embed the original C# runtime directly. Build `plugins/markov` as a singleton WASM plugin by porting MarkovJunior behavior into a GAMS-native runtime. Keep the browser view thin and route all generation through `pluginManager`.

Current language recommendation: prefer Go/TinyGo for the first compatibility pass unless TinyGo/XML/runtime constraints become blocking. C or Odin may be better later for performance/control, but Go is likely fastest for copying the C# object model, parsing XML, and comparing behavior against upstream models.

Reasons:

- Keeps CLI/browser/native hosts thin.
- Makes the data contract GAMS-native and easy for other plugins/views to call.
- Avoids depending on an external process or C# runtime in the browser.
- Go maps/classes/interfaces translate the C# source shape more directly than C.
- XML compatibility is a priority for comparing against upstream MarkovJunior models.

## Initial Plugin Contract

Plugin id: `markov`.

Implemented first methods:

- `run` — run a MarkovJunior XML model from `model` path or inline `modelXml`.
- `inspect` — parse a model and return values/origin/features.

Planned compatibility methods:

- `runModelEntry` — read upstream-style `models.xml` entry by name, then run the referenced model with its declared size/settings.
- `validate` — parse and return unsupported features/errors without generation.
- `runSteps` — bounded debug/preview frames for the browser view.
- `compare` — compare against fixture output for compatibility testing.

Current `run` input:

```json
{
  "model": "res://procgen/models/DungeonGrowth.xml",
  "modelXml": null,
  "width": 32,
  "height": 18,
  "depth": 1,
  "seed": 12345,
  "steps": 50000,
  "initial": {
    "cells": "BBBB/BBBB/BBBB"
  },
  "locks": [
    { "x": 0, "y": 8, "z": 0, "value": "D" }
  ],
  "output": {
    "grid": "res://world/rooms/12.markov-grid.json",
    "tilemap": "res://world/rooms/12.tilemap.json"
  },
  "tileIds": { "B": 0, "W": 1, "R": 2, "D": 3 }
}
```

Notes:

- `model` is the normal path mode for project assets; `modelXml`/inline model is useful for tests and editor preview.
- `initial.cells` is optional; when omitted, the plugin clears to the first `values` symbol and optionally applies model `origin`.
- `locks` are planned GAMS additions, not original MarkovJunior behavior. They let room exits, walls, or authored tiles survive generation.
- `output.grid` writes symbolic generated grid JSON. `output.tilemap` optionally writes a GAMS tilemap using `tileIds`.
- First implementation supports 2D only (`depth: 1`) and fails loudly on unsupported node/features.

Proposed output:

```json
{
  "ok": true,
  "width": 32,
  "height": 18,
  "depth": 1,
  "values": "BWRD",
  "cells": "...symbol rows...",
  "stepsRun": 348,
  "changed": 221
}
```

If `output.grid` or `output.tilemap` is present, the plugin writes through `fs`.

## Model Asset Format

Use the default MarkovJunior XML format as the public/import format for now.

Reasons:

- Upstream `models/*.xml`, `resources/rules/*`, samples, tilesets, and `models.xml` become direct compatibility fixtures.
- We can compare GAMS output against upstream behavior model-by-model.
- "Can run all upstream models" is a concrete completion target.

Internally, the plugin can parse XML into native structs/IR. A later JSON authoring format can be added after compatibility is proven, but should not block XML support.

## View Plan

View id/tag: `view-markov`.

Responsibilities:

- Load/save a MarkovJunior `.xml` model asset through `fs`.
- Provide form controls for width, height, seed, steps, output paths, and tile symbol mapping.
- Provide a text/code editor area for the model XML initially.
- Run `runtime.call('markov', 'run', input)`.
- Preview returned symbolic grid on a canvas or generated tilemap through existing tilemap view integration.
- Offer lock/edit tools later: paint locked cells, place exits, rerun with same/next seed.

Follow `cmd/browser/VIEW_RULES.md`: one `form` or `canvas` main element, optional `aside` for model/settings, `footer` for run/status actions, header controls registered through the view plugin mechanism.

## Implementation Phases

### Phase 1: Planning fixture and core data types

- Add `plugins/markov` with Go structs for model/input/output.
- Add parser for symbolic patterns (`/` rows, optional future z separators).
- Add tests for pattern parsing, rule matching, and rule application.
- No browser view yet.

### Phase 2: Deterministic 2D rewrite MVP

- Implement grid state as `[]byte` plus symbol table.
- Implement rule matching with bounds checks.
- Implement `one`, `all`, `prl`, `sequence`, and `markov` enough to run small models.
- Use existing `random` plugin import style or TinyGo-compatible deterministic local PRNG if the runtime contract allows.
- Export `gen` and read/write assets through `fs`, like `minimap2`.
- Add an e2e test with a small fixed model and seed.

### Phase 3: Tilemap output

- Convert symbols to a GAMS `tilemap.TileMap` layer using a caller-provided `tileIds` map.
- Support room shape masks and exits as initial/locked cells.
- Integrate with `minimap2`/future roomgen pipelines.

### Phase 4: Browser view

- Add `cmd/browser/view/view-markov.js`.
- Register view in `demo/gams.json` and expose plugin `markov`.
- Let users edit model JSON, set dimensions/seed/output, run, and preview result.

### Phase 5: Optional MarkovJunior feature ports

Only add these when needed by actual project models:

- symmetry transforms beyond identity/basic rotations/reflections
- `path`
- `convolution`
- `wfc`
- file-backed rules (`fin`, `fout`, `file`) and PNG import
- 3D grids/VOX output
- inference/search/observe

## Open Questions

- Should `plugins/roomgen` become the high-level room service that calls `markov`, or should `markov` be called directly by `view-markov` and nodegraph pipelines?
- Do we want XML import compatibility in the plugin, or only in tooling/view?
- What is the first real room model we want to support: dungeon rooms, platformer geometry, caves, or entity placement?
- Which symbols and tile IDs should become the canonical demo mapping?
