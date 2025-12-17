# Automapping Metadata Specification

## Overview
This specification defines metadata properties for custom tilemap automapping systems. Properties can be set at the map level (global behavior) or layer level (rule-specific behavior).

## Map-Level Properties (set in `map.Meta`)

### Global Behavior Flags
| Property | Type | Description |
|----------|------|-------------|
| `rule_MatchOutsideMap` | `bool` | Allow matching even if rule region extends outside map bounds |
| `rule_OverflowBorder` | `bool` | Treat out-of-bounds area as repetition of nearest in-bounds tile |
| `rule_WrapBorder` | `bool` | Treat map as wrapping (toroidal) when matching beyond edges |
| `rule_NoOverlappingOutput` | `bool` | Disallow outputs from the same rule to overlap each other |
| `rule_MatchInOrder` | `bool` | Apply each rule immediately when matched (so later rules see earlier outputs) |
| `rule_DeleteTiles` | `bool` | Erase tiles in input-regions before applying output |

### Special Matcher Tiles
Define custom tile-IDs with special matching semantics. Each property maps to a tile-ID in your tilemap data.

| Property | Value Type | Description |
|----------|------------|-------------|
| `rule_Empty` | `tileID` | Matcher for "empty cell" (when used as output, erases tile) |
| `rule_NonEmpty` | `tileID` | Matcher for "any non-empty tile" |
| `rule_Other` | `tileID` | Matcher for "any tile not used by this rule's input on that layer" |
| `rule_Ignore` | `tileID` | "Ignore this cell" — used to connect disconnected parts of a rule |
| `rule_Negate` | `tileID` | Invert matching condition at this cell (makes input like inputnot here) |

## Layer-Level Properties (set in `layer.Meta`)

### Basic Layer Identification
| Property | Type | Description |
|----------|------|-------------|
| `rule_role` | `"input"` \| `"output"` | Whether this layer is input or output for the rule |
| `rule_target_layer` | `selector` | CSS-like selector for target layer matching |

### Target Layer Selectors

Layer targeting uses CSS-like selectors to match layers in target/output tilemaps without requiring layer names.

| Selector Format | Example | Description |
|-----------------|---------|-------------|
| `[key="value"]` | `[name="walls"]` | Match layer where meta key equals value |
| `[key]` | `[collision]` | Match layer that has meta key (any value) |
| `[key!="value"]` | `[type!="background"]` | Match layer where meta key ≠ value |
| `#index` | `#0`, `#1`, `#2` | Match layer by index (0-based) |
| `*` | `*` | Match any layer (first available) |

#### Selector Examples

**Index-based targeting:**
```json
{
  "rule_role": "input",
  "rule_target_layer": "#0"
}
```
Matches the first layer (index 0) in the target tilemap.

**Metadata-based targeting:**
```json
{
  "rule_role": "input", 
  "rule_target_layer": "[collision=\"solid\"]"
}
```
Matches any layer where `meta.collision == "solid"`.

**Existence-based targeting:**
```json
{
  "rule_role": "output",
  "rule_target_layer": "[decorative]"
}
```
Matches any layer that has a `decorative` metadata key (any value).

**Negation targeting:**
```json
{
  "rule_role": "input",
  "rule_target_layer": "[type!=\"background\"]" 
}
```
Matches any layer where `meta.type != "background"`.

**Wildcard targeting:**
```json
{
  "rule_role": "output",
  "rule_target_layer": "*"
}
```
Matches the first available layer in the target tilemap.

### Input Layer Properties
| Property | Type | Description |
|----------|------|-------------|
| `rule_input_index` | `string` (optional) | Index for grouping alternate input-layers (for "any-of" semantics) |
| `rule_input_not` | `bool` (optional) | If `true`: invert the input (match where target layer ≠ given pattern) |
| `rule_layer_AutoEmpty` | `bool` (optional) | For input/inputnot: treat empty cells as explicit empty (not ignore) |
| `rule_layer_IgnoreHorizontalFlip` | `bool` (optional) | Allow matching also on horizontally flipped versions of pattern |
| `rule_layer_IgnoreVerticalFlip` | `bool` (optional) | Allow vertical flip matching (if implemented) |
| `rule_layer_IgnoreDiagonalFlip` | `bool` (optional) | Allow diagonal/rotated matching (if implemented) |

### Output Layer Properties
| Property | Type | Description |
|----------|------|-------------|
| `rule_output_index` | `string` (optional) | Index to group output variants (for random choice among variants) |
| `rule_output_Probability` | `float` (optional) | Relative probability weight for this variant when randomly chosen |

## Optional / Per-Rule Metadata
These properties can be set as map-level defaults or overridden per rule (if implementing region-specific options).

| Property | Type | Description |
|----------|------|-------------|
| `rule_ModX` | `int` | Apply rule every N tiles in X direction (modulo) |
| `rule_ModY` | `int` | Apply rule every N tiles in Y direction |
| `rule_OffsetX` | `int` | X-offset applied in combination with ModX |
| `rule_OffsetY` | `int` | Y-offset applied in combination with ModY |
| `rule_Probability` | `float` | Chance (0.0–1.0) that rule applies even if input matches |
| `rule_Disabled` | `bool` | If `true` — skip this rule (disable without removing) |

## Usage Notes
- **Map-level properties** affect global automapping behavior
- **Layer-level properties** describe input/output layers in rule-maps
- Special matcher tiles are defined via map-level `rule_… ⇒ tile-ID` mappings
- Properties marked as "optional" can be omitted if not needed
- **Layer selectors** use CSS-like syntax to target layers without requiring layer names

## Example Rule Configuration

### Complete Rules Tilemap Example

```json
{
  "meta": {
    "rule_MatchOutsideMap": "false",
    "rule_Empty": "0",
    "rule_NonEmpty": "999",
    "rule_Probability": "1.0"
  },
  "layers": [
    {
      "width": 3,
      "data": [1, 1, 0, 1, 0, 0, 0, 0, 0],
      "meta": {
        "rule_role": "input",
        "rule_target_layer": "[collision=\"solid\"]",
        "rule_input_index": "0"
      }
    },
    {
      "width": 3, 
      "data": [10, 0, 0, 0, 0, 0, 0, 0, 0],
      "meta": {
        "rule_role": "output",
        "rule_target_layer": "#0",
        "rule_output_Probability": "1.0"
      }
    }
  ]
}
```

This rule:
- Matches L-shaped patterns (`1,1,0 / 1,0,0 / 0,0,0`) in layers with `collision="solid"`
- Places corner tile (ID 10) at the corner position in the first layer of the output map
- Uses special tile 0 for empty matching and 999 for non-empty matching

### Selector Best Practices

1. **Use index selectors for predictable output**: `#0`, `#1` for layers you know exist
2. **Use metadata selectors for semantic targeting**: `[collision="solid"]`, `[type="walls"]`  
3. **Use existence selectors for optional layers**: `[decorative]` matches any layer with decorative metadata
4. **Use negation for exclusion**: `[type!="background"]` avoids background layers
5. **Use wildcard for fallback**: `*` as last resort when any layer will do

### Multi-Layer Rules

Rules can have multiple input/output layers with different selectors:

```json
{
  "layers": [
    {
      "meta": {
        "rule_role": "input",
        "rule_target_layer": "[collision=\"solid\"]",
        "rule_input_index": "walls"
      }
    },
    {
      "meta": {
        "rule_role": "input", 
        "rule_target_layer": "[type=\"water\"]",
        "rule_input_index": "water"
      }
    },
    {
      "meta": {
        "rule_role": "output",
        "rule_target_layer": "[decorative]",
        "rule_output_index": "decoration"
      }
    }
  ]
}
```

This matches patterns involving both solid walls and water, outputting decorative elements.
