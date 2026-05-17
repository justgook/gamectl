# markov

`markov` is the GAMS MarkovJunior-compatible procedural generation service.

The public surface is **MarkovJunior XML**. Internally the plugin parses XML into a native Go/TinyGo runtime representation and runs as a WASM service plugin.

## Current Progress Snapshot

Status after the current implementation pass:

- **All unique upstream MarkovJunior model XML files parse locally.**
- Compatibility report currently shows:

```text
parsed=137 unsupported=0 uniqueModels=137
```

This means the plugin recognizes the model syntax and referenced resources well enough to parse the full upstream model set. It **does not yet mean output parity** with the original MarkovJunior runtime.

## Methods

### `run`

Runs a model from either `model` path or inline `modelXml`.

```json
{
  "model": "res://markov/models/Basic.xml",
  "modelXml": null,
  "width": 16,
  "height": 16,
  "depth": 1,
  "seed": 1,
  "steps": 50000,
  "initial": {
    "cells": "BBBB/BBBB/BBBB/BBBB"
  },
  "output": {
    "grid": "res://out/basic.markov-grid.json",
    "tilemap": "res://out/basic.tilemap.json"
  },
  "tileIds": {
    "B": 0,
    "W": 1
  }
}
```

Response:

```json
{
  "ok": true,
  "width": 16,
  "height": 16,
  "depth": 1,
  "values": "BW",
  "cells": "WWWW/WWWW/WWWW/WWWW",
  "stepsRun": 16,
  "changed": 16
}
```

If `output.grid` is set, the response JSON is written through `fs.write`. If `output.tilemap` is set, a GAMS tilemap is written using `tileIds`.

### `runModelEntry`

Runs an upstream-style entry from `models.xml`.

```json
{
  "modelsXml": "res://markov/models.xml",
  "name": "Basic",
  "occurrence": 0,
  "seed": 1,
  "steps": 1000,
  "output": {
    "grid": "res://out/Basic.grid.json"
  }
}
```

The plugin reads `modelsXml`, finds the named `<model>`, derives dimensions/settings, then loads `models/<name>.xml` beside the catalog path. `steps` overrides the catalog value when non-zero.

### `create` / `step` / `snapshot` / `destroy`

Creates an incremental in-memory runner for previews and animations.

```json
{
  "model": "markov/models/Basic.xml",
  "width": 60,
  "height": 60,
  "depth": 1,
  "seed": 1
}
```

`create` returns a handle and initial grid snapshot:

```json
{
  "ok": true,
  "handle": 1,
  "grid": {
    "ok": true,
    "width": 60,
    "height": 60,
    "depth": 1,
    "values": "BW",
    "cells": "BBBB/...",
    "stepsRun": 0,
    "changed": 0,
    "done": false
  }
}
```

Advance a session:

```json
{
  "handle": 1,
  "steps": 1
}
```

`snapshot` accepts `{ "handle": 1 }` and returns the current grid. `destroy` releases the session handle.

### `inspect`

Parses a model and returns basic metadata.

```json
{
  "model": "res://markov/models/Basic.xml"
}
```

## What Works Now

### General XML/runtime

- MarkovJunior XML as public format.
- XML root `values`, `origin`, `folder`.
- `models.xml` catalog parsing.
- `runModelEntry` for upstream-style model entries.
- Symbolic 2D grids.
- Basic symbolic 3D grids with MarkovJunior space-separated z-slices.
- Symbolic grid output encoding:
  - `/` separates rows.
  - spaces separate z-slices.
- Initial grid input through `initial.cells`.
- Optional grid JSON output through `output.grid`.
- Optional 2D tilemap output through `output.tilemap` + `tileIds`.

### Rules and branches

- Inline rule attributes on `one`, `all`, `prl`.
- Child `<rule in="..." out="..."/>` elements.
- `*` wildcard/no-op output cells.
- Input unions from `<union symbol="?" values="BR"/>`.
- `sequence`.
- `markov`.
- `one`.
- `all`.
- `prl`.

### File-backed rules

- 2D PNG rule resources.
- VOX rule resources.
- `file` glued input/output rules.
- `fin` / `fout` rules.
- `legend` mapping.
- rule `folder` resolution, including inside `map`.

### Procedural nodes

- 2D `path` with:
  - `from`
  - `to`
  - `on`
  - `color`
  - `inertia`
  - `longest`
  - `edges`
- 2D `convolution` with:
  - `VonNeumann`
  - `Moore`
  - `periodic`
  - `steps`
  - `values`
  - `sum`
  - `p`
- 3D `convolution` with:
  - `VonNeumann`
  - `NoCorners`
- Basic `map` with:
  - rational `scale`
  - map-local `values`
  - mapping rules
  - child nodes
- 2D `convchain` with:
  - PNG samples
  - `n`
  - `steps`
  - `temperature`
  - `on`
  - `black`
  - `white`
- Initial 2D overlap `wfc` with:
  - PNG samples
  - `n`
  - `periodicInput`
  - `tries`
  - constraints via child rules
  - child nodes
- Initial tile/VOX `wfc` with:
  - tileset XML
  - VOX tile loading
  - neighbor constraints
  - `periodic`
  - `overlap`
  - `overlapz`
  - constraints via child rules
  - child nodes

## What Still Needs Improvement

The remaining work is mostly **behavior/output parity**, not parser coverage.

Known gaps:

- Exact MarkovJunior PRNG parity.
- Exact MarkovJunior WFC entropy/seed/output behavior.
- Full tile WFC symmetry/action parity.
- Full `convchain` symmetry/PRNG parity.
- 3D `path` behavior.
- `observe`, inference, and search.
- Full branch/reset semantics for repeated `map` and WFC execution.
- Full symmetry transform support for all rule/node contexts.
- Output comparison fixtures against upstream generated images/voxels.
- Browser `view-markov` editor/runner UI.

## Validation Commands

Compatibility parser report:

```sh
go test -v ./plugins/markov/mj -run TestMarkovJuniorCompatibilityReport
```

Full unit tests:

```sh
go test ./plugins/markov/mj
```

Browser-style WASM e2e:

```sh
make markov-test
```

Build plugin:

```sh
make build.nosync/plugins/markov.wasm
```

## Development Target

Short term:

1. Keep all upstream models parsing.
2. Add targeted run fixtures for representative upstream models.
3. Compare generated symbolic/VOX/PNG outputs against original MarkovJunior where practical.

Long term:

- Run all models from `tmp/MarkovJunior/models.xml` with matching behavior or clearly documented intentional GAMS differences.
