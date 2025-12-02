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
| `rule_target_layer` | `string` | Name of the actual target layer in working map (e.g., "Ground", "Walls", etc.) |

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
