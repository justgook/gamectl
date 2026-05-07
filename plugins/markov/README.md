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
- `sequence`
- `markov`
- 2D symbolic grid row encoding
- `*` wildcard/no-op output cells

Not implemented yet:

- symmetry transforms
- unions beyond `*`
- rule files: `file`, `fin`, `fout`, `legend`, rule folders
- `observe`, inference, search
- `path`
- `map`
- `convolution`
- `convchain`
- `wfc`
- 3D grids

## Development target

Use upstream MarkovJunior models as compatibility fixtures. The long-term completion target is: all models in `tmp/MarkovJunior/models.xml` can be parsed and run with matching behavior or documented intentional GAMS output differences.
