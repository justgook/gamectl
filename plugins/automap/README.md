# Automap

Automap places, replaces, and erases tiles by matching rules against a tilemap. It is inspired by Tiled's Automapping workflow, but uses GAMS' native `tilemap.TileMap` JSON format and metadata properties instead of TMX/TMJ layer-name conventions.

This plugin intentionally keeps the newer, cleaner Automapping model and leaves out legacy/deprecated Tiled behavior such as `regions` layers and object-layer output.

> Based on the concepts documented in the Tiled Automapping manual: <https://doc.mapeditor.org/en/stable/manual/automapping/>.

## What Automap Does

A **rules map** describes patterns to find and output to write. Automap scans an **input map** for each rule. When a rule matches, Automap writes its output into the target/output map.

Typical uses:

- replace rough tiles with decorated variants
- add cliff, wall, edge, or corner tiles around shapes
- erase generated details when source terrain changes
- generate collision, foreground, decoration, or helper layers from semantic layers

## Plugin API

The WASM export is:

```json
{
  "rulesMap": "maps/rules.tilemap.json",
  "inputMap": "maps/level-source.tilemap.json",
  "outputMap": "maps/level-output.tilemap.json"
}
```

- `rulesMap` — filesystem tilemap JSON path containing automap rules.
- `inputMap` — filesystem tilemap JSON path used for matching.
- `outputMap` — filesystem tilemap JSON path receiving output.

If `inputMap == outputMap`, the map is updated in-place. If they differ, Automap creates a fresh output map using the input map's root properties, but not its layers, then writes generated layers into it.

Tilemaps are read and written through the `fs` plugin as native GAMS tilemap JSON files.

## Tilemap Format

Automap uses `pkg/tilemap`:

```json
{
  "props": {
    "rule_NonEmpty": "1027",
    "rule_Empty": "1028"
  },
  "layers": [
    {
      "width": 3,
      "data": [1, 1, 0, 1, 0, 0, 0, 0, 0],
      "props": {
        "rule_role": "input",
        "rule_target_layer": "#0"
      }
    }
  ]
}
```

Layer height is derived from `len(data) / width`. Tile ID `0` is the normal empty cell.

## Setting Up a Rules Map

A rules map is a normal GAMS tilemap with:

- one or more layers whose `props.rule_role` is `"input"`
- one or more layers whose `props.rule_role` is `"output"`
- `props.rule_target_layer` on every rule layer

Every contiguous region of non-zero tiles across the rule layers is one rule. Connectivity is 8-way, so diagonal touching counts as connected. Leave at least one empty-cell gap between separate rules.

Rules are extracted in reading order:

1. smaller Y first
2. then smaller X

All rules are matched against the same prepared input map before outputs are applied. Later rules can overwrite earlier rule output, but rule matching does not currently see output from previous rules.

## Layer Targeting

Instead of Tiled's `input_Ground` / `output_Ground` layer names, Automap uses selectors in `rule_target_layer`.

| Selector | Example | Meaning |
|---|---|---|
| `#index` | `#0`, `#1` | Match layer by zero-based index. |
| `[key="value"]` | `[name="Ground"]` | Match first layer whose property equals value. |
| `[key]` | `[collision]` | Match first layer that has the property. |
| `[key!="value"]` | `[type!="background"]` | Match first layer whose property is absent or different. |
| `*` | `*` | Match the first layer. |

For input layers, a missing target layer is treated as an empty dummy layer. For output layers, Automap creates enough layers to satisfy an index selector like `#2`, or creates a new layer when no matching metadata layer exists.

## Defining Inputs

Input layers define what a rule searches for.

Required layer properties:

```json
{
  "rule_role": "input",
  "rule_target_layer": "#0"
}
```

Optional properties:

| Property | Type | Meaning |
|---|---:|---|
| `rule_input_index` | string | Groups input layers. Layers with the same target selector and same index contribute alternate matchers at the same cells. Different indices are separate required condition groups in the current implementation. |
| `rule_input_not` | bool | Inverts this input layer's matches. |
| `rule_ModX` | int | Match only every N tiles on X. |
| `rule_ModY` | int | Match only every N tiles on Y. |
| `rule_OffsetX` | int | Offset for `rule_ModX`. |
| `rule_OffsetY` | int | Offset for `rule_ModY`. |

Multiple input layers with the same target selector and same `rule_input_index` are combined as alternatives per cell. This lets a single rule match any of several tile values at the same position. Different input indices currently behave as additional required condition groups, not as Tiled-style top-level OR alternatives.

Example: match either grass tile `1` or flower tile `2` at the same source position:

```json
{
  "layers": [
    {
      "width": 1,
      "data": [1],
      "props": { "rule_role": "input", "rule_target_layer": "#0", "rule_input_index": "ground" }
    },
    {
      "width": 1,
      "data": [2],
      "props": { "rule_role": "input", "rule_target_layer": "#0", "rule_input_index": "ground" }
    }
  ]
}
```

## Defining Outputs

Output layers define what is written when a rule matches.

Required layer properties:

```json
{
  "rule_role": "output",
  "rule_target_layer": "#0"
}
```

Optional properties:

| Property | Type | Meaning |
|---|---:|---|
| `rule_output_index` | string | Groups randomized output variants. |
| `rule_output_Probability` | float | Relative probability weight for that output variant. |

Outputs with no `rule_output_index` always apply. Outputs with an index are variants: each rule match chooses one weighted variant, then applies only layers in that chosen variant.

Non-rule layer properties on output layers are copied to the target layer. Rule-specific properties such as `rule_role`, `rule_target_layer`, `rule_output_index`, and `rule_output_Probability` are not copied.

### Random Output Example

```json
{
  "layers": [
    {
      "width": 1,
      "data": [1],
      "props": { "rule_role": "input", "rule_target_layer": "#0" }
    },
    {
      "width": 1,
      "data": [10],
      "props": { "rule_role": "output", "rule_target_layer": "#0", "rule_output_index": "rock", "rule_output_Probability": "0.5" }
    },
    {
      "width": 1,
      "data": [11],
      "props": { "rule_role": "output", "rule_target_layer": "#0", "rule_output_index": "grass", "rule_output_Probability": "4" }
    }
  ]
}
```

Here tile `11` is chosen eight times as often as tile `10` because the weights are `4` and `0.5`.

## Special Tiles

Special tiles are configured on the rules map root `props`. The values are tile IDs from your rules tileset.

| Property | Meaning in input | Meaning in output |
|---|---|---|
| `rule_Empty` | Match an empty cell (`0`). | Write `0`, erasing the target cell. |
| `rule_NonEmpty` | Match any non-empty cell. | Writes that configured tile ID if used as normal output. |
| `rule_Other` | Match a tile different from all non-special tiles used by the same input group. Empty matches only when the group does not explicitly use `rule_Empty`. | Writes that configured tile ID if used as normal output. |
| `rule_Ignore` | Always match; useful to connect disconnected rule parts. It can bind the reference tile used by `rule_Different` / `rule_Same`. | Writes that configured tile ID if used as normal output. |
| `rule_Negate` | Invert the match result at this cell. | Writes that configured tile ID if used as normal output. |
| `rule_Different` | Match any tile whose value is different from the first reference tile bound earlier in the same input group. Empty (`0`) counts as different by default. | Writes that configured tile ID if used as normal output. |
| `rule_Same` | Match any tile whose value equals the first reference tile bound earlier in the same input group. | Writes that configured tile ID if used as normal output. |

Example special tile configuration:

```json
{
  "props": {
    "rule_NonEmpty": "1027",
    "rule_Empty": "1028",
    "rule_Other": "1029",
    "rule_Ignore": "1030",
    "rule_Negate": "1031",
    "rule_Different": "1032",
    "rule_Same": "1033"
  }
}
```

`demo/tilemap/rules.qoi` contains an existing visual rules tile asset that can be used as a source for these special tiles. If this README later needs visible icons, prefer either splitting that asset into documented tile IDs or replacing it with small first-party SVG icons.

## Map-Level Properties

Set these on the rules map root `props`.

| Property | Type | Default | Meaning |
|---|---:|---:|---|
| `rule_MatchOutsideMap` | bool | `false` | Allow matching when the rule region extends beyond the map. Outside cells are empty unless another border mode is enabled. |
| `rule_OverflowBorder` | bool | `false` | Implies `rule_MatchOutsideMap`; outside cells repeat the nearest edge tile. |
| `rule_WrapBorder` | bool | `false` | Implies `rule_MatchOutsideMap`; the map wraps around like a torus. Takes precedence over overflow. |
| `rule_NoOverlappingOutput` | bool | `false` | Prevent outputs from the same rule from writing the same target cell twice. |
| `rule_DeleteTiles` | bool | `false` | Clear the matched input region on selected output layers before writing output. Prefer `rule_Empty` output for explicit erasing. |
| `rule_ModX` | int | `1` | Default X modulo constraint. |
| `rule_ModY` | int | `1` | Default Y modulo constraint. |
| `rule_OffsetX` | int | `0` | Default X modulo offset. |
| `rule_OffsetY` | int | `0` | Default Y modulo offset. |
| `rule_Probability` | float | `1.0` | Chance a matching rule applies. `0` disables all matches; `1` always applies. |

## Rule Extraction Details

A rule's origin is the top-left coordinate of all connected tiles across its input and output layers. All tile positions are normalized relative to that origin.

A rule must contain at least one input layer tile and at least one output layer tile. A connected region with only inputs or only outputs is an error.

## Edge Matching

When `rule_MatchOutsideMap` is false, any rule cell that would read outside the map fails.

When enabled, Automap pads the working input map by the maximum rule size minus one. Output is cropped back to the original size after applying rules.

Modes:

1. `rule_MatchOutsideMap=true` — padding is empty.
2. `rule_OverflowBorder=true` — padding copies nearest edge tiles.
3. `rule_WrapBorder=true` — padding wraps from the opposite side.

## Minimal Complete Example

Rules map:

```json
{
  "props": {
    "rule_NonEmpty": "1027",
    "rule_Empty": "1028"
  },
  "layers": [
    {
      "width": 2,
      "data": [1027, 1027, 0, 0],
      "props": { "rule_role": "input", "rule_target_layer": "#0" }
    },
    {
      "width": 2,
      "data": [7, 8, 0, 0],
      "props": { "rule_role": "output", "rule_target_layer": "#0" }
    }
  ]
}
```

Input map:

```json
{
  "layers": [
    { "width": 3, "data": [1, 2, 0, 0, 0, 0, 0, 0, 0] }
  ]
}
```

Result:

```json
{
  "layers": [
    { "width": 3, "data": [7, 8, 0, 0, 0, 0, 0, 0, 0] }
  ]
}
```

## Differences From Tiled Automapping

Supported concepts:

- contiguous rule regions
- input and output layers
- same-index alternate input matchers
- randomized output variants
- special tiles: Empty, NonEmpty, Other, Ignore, Negate, Different, Same
- matching outside map bounds, overflow borders, and wrap borders
- no-overlap output
- delete matched input region

Different by design:

- Uses metadata properties, not layer names like `input_Ground`.
- Uses CSS-like layer selectors, not only named target layers.
- Uses native GAMS tilemap JSON, not TMX/TMJ as the runtime format.
- Does not support legacy `regions` layers.
- Does not support object-layer output/deletion.
- Does not currently implement Tiled's `MatchInOrder`; matches are collected before outputs are applied.
- Different `rule_input_index` values are currently additional required condition groups rather than Tiled-style top-level OR alternatives.
- Does not currently implement layer flip-ignore matching or Tiled object-layer `rule_options` rectangles.

## Tests and Fixtures

Golden fixtures compare this implementation against Tiled-generated output.

```sh
cd plugins/automap
go test .
```

Regenerate fixtures:

```sh
cd plugins/automap
make generate-fixtures
```

See [`TESTDATA.md`](./TESTDATA.md) for fixture workflow details.
