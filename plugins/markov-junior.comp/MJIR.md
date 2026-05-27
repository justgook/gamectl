# MJIR plan

MJIR is the prepared, deterministic input format for `markov-junior.comp`.

## Goal

Move format/resource handling out of the WASM component:

```text
XML/models.xml/resources/png/vox/etc. -> external compiler -> MJIR
MJIR + initial grid + run config -> deterministic final grid
```

The component should be a compute kernel. That makes it easy to regression-test against current C#/Odin outputs and later optimize internals without changing observable behavior.

## Compatibility target

For migration, every existing MarkovJunior model should have a fixture:

```text
model name
seed
width/height/depth
max steps
initial grid, if any
compiled MJIR
golden final grid from current implementation
```

The component passes migration when each fixture produces the same final grid bytes.

## MVP v1 tracer format

The current committed v1 is only a tracer bullet for one-cell replacement:

```text
magic:       4 bytes  "MJIR"
version:     u32      1
values-len:  u32
values:      bytes
rule-count:  u32      1
op:          u32      1 = one-cell replace
input:       u8       value index
output:      u8       value index
```

Execution semantics for `op = 1` match the current Odin `one` node for a one-cell rule:

```text
initially collect every matching cell in scan order
repeat until max-steps or no match:
  choose a match index with MJRandom.Next(match-count)
  swap-remove that match
  replace input_value_index with output_value_index
```

This format is intentionally insufficient for full MarkovJunior. It proves:

- WIT list/u8 transport
- Odin object linked into a component via C wrapper
- deterministic run API
- GAMS e2e test path
- first golden parity fixture: `models/Basic.xml` for a fixed seed and 10 steps

## Future real MJIR sections

Likely sections:

```text
header
symbol table / values
union definitions
initial-grid constraints or metadata
node table
rule table
pattern table
field / observation data
WFC model data, after external preprocessing
resource blobs, if any are still needed as raw decoded data
```

Important: future MJIR should encode all stochastic decisions in a way that preserves current deterministic seed behavior before any RNG improvements are attempted.
