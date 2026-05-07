# markov

`markov` is the GAMS MarkovJunior-compatible procedural generation service.

The public surface is MarkovJunior XML. Internally the plugin parses XML into a native runtime representation.

## Methods

### `run`

Runs a model.

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

Either `model` or `modelXml` is required.

Current implementation supports 2D only (`depth` omitted or `1`). `modelXml` is useful for tests and editor previews. `model` reads through `fs.read`.

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

If `output.grid` is set, the same response JSON is written through `fs.write`. If `output.tilemap` is set, a GAMS tilemap is written using `tileIds`.

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

### `inspect`

Parses a model and returns basic metadata.

```json
{
  "model": "res://markov/models/Basic.xml"
}
```

Response:

```json
{
  "ok": true,
  "values": "BW",
  "origin": false,
  "features": {
    "one": true,
    "rules": true
  }
}
```

## Compatibility status

Implemented now:

- XML root with `values` and `origin`
- inline rule attributes on `one`, `all`, `prl`
- child `<rule in="..." out="..."/>` elements
- 2D PNG file-backed rules with `file`, `fin`, `fout`, `legend`, and `folder`
- input unions from `<union symbol="?" values="BR"/>`
- `sequence`
- `markov`
- `models.xml` catalog parsing and `runModelEntry`
- 2D `path` node with `from`, `to`, `on`, `color`, `inertia`, `longest`, and `edges`
- 2D `convolution` node with `VonNeumann` and `Moore` neighborhoods, `periodic`, `steps`, `values`, `sum`, and `p`
- 2D symbolic grid row encoding
- `*` wildcard/no-op output cells

Not implemented yet:

- symmetry transforms
- full MarkovJunior symmetry behavior for file-backed rules
- `observe`, inference, search
- 3D `path` vertices behavior
- `map`
- 3D `convolution` neighborhoods such as `NoCorners`
- `convchain`
- `wfc`
- 3D grids and `.vox` file-backed rules

## Development target

Use upstream MarkovJunior models as compatibility fixtures. The long-term completion target is: all models in `tmp/MarkovJunior/models.xml` can be parsed and run with matching behavior or documented intentional GAMS output differences.

Current local compatibility report is available through:

```sh
go test -v ./plugins/markov/mj -run TestMarkovJuniorCompatibilityReport
```

At the first pass this reports how many unique upstream models parse and groups unsupported blockers.

Browser-style WASM e2e can be run with:

```sh
make markov-test
```
