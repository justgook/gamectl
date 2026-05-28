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

## MJIR v1 tracer format

The current committed v1 is still a tracer bullet, but it now supports root `<one>` pattern rules used by the first parity fixtures:

```text
magic:        4 bytes  "MJIR"
version:      u32      1
values-len:   u32
values:       bytes
op-count:     u32

# op 100, optional node kind marker (defaults to one if absent)
op:           u32      100
kind:         u32      1 = one, 2 = all, 3 = prl, 4 = markov container, 5 = sequence container,
                       6 = path, 7 = convolution
steps:        u32      child node step limit, 0 = unbounded/default

# op 101, union declaration, available to following pattern rules
op:           u32      101
symbol:       u8
values-len:   u32
values:       bytes

# op 102, end nested container marker
op:           u32      102

# op 103, field declaration for the current <one>/<all> node
op:           u32      103
for:          u8       target symbol whose potential is computed
recompute:    u32      0/1, matches field recompute attribute
essential:    u32      0/1, matches field essential attribute
to-len:       u32
to:           bytes    field to symbols, empty when from is used
from-len:     u32
from:         bytes    field from symbols, empty when to is used
on-len:       u32
on:           bytes    substrate symbols

# op 104, temperature for field/observation-guided rule choice on the current node
op:           u32      104
temperature:  f64

# op 105, observation declaration for the current node
op:           u32      105
value:        u8       observed symbol
from-len:     u32
from:         bytes    present-state replacement, empty means value
to-len:       u32
to:           bytes    future allowed symbols

# op 106, path node payload for the current <path> node
op:           u32      106
from-len:     u32
from:         bytes    start symbols
to-len:       u32
to:           bytes    finish symbols
on-len:       u32
on:           bytes    substrate symbols
color:        u8       output symbol
inertia:      u32      0/1
longest:      u32      0/1
edges:        u32      0/1
vertices:     u32      0/1

# op 107, convolution node payload for the current <convolution> node
op:           u32      107
neighborhood-len: u32
neighborhood: bytes    e.g. Moore/Neumann; empty uses original default behavior
periodic:     u32      0/1
rule-count:   u32
# repeated rule-count times:
input:        u8       input symbol
output:       u8       output symbol
probability:  f64      rule p, defaults to 1.0
values-len:   u32
values:       bytes    symbols counted in the convolution neighborhood
sum-len:      u32
sum:          bytes    accepted counts/ranges, e.g. "3", "5..8", "0,1,4..8"

# op 1, legacy one-cell replace
op:           u32      1
input:        u8       value index
output:       u8       value index

# op 2, pattern rule
op:           u32      2
input-width:  u32
input-height: u32
input-depth:  u32
output-width: u32
output-height:u32
output-depth: u32
probability:  f64      rule p, defaults to 1.0
symmetry-len: u32
symmetry:     bytes    MarkovJunior symmetry string, empty means default symmetries
input:        bytes    pattern symbols in MarkovJunior parse order
output:       bytes    pattern symbols in MarkovJunior parse order
```

Root `<one>` execution semantics use the current Odin `one` node helpers. `<one>` and `<all>` nodes also support resource-free `<field>` children through MJIR ops 103/104 for field-guided rule choice, non-search `<observe>` children through op 105 plus the existing backward-potential helpers, and `<path>` nodes through op 106 plus the existing path finder:

```text
expand pattern symmetries with append_rule_symmetries
initially collect every matching rule/location in scan order
repeat until max-steps or no match:
  choose a match index with MJRandom.Next(match-count)
  swap-remove that match
  if the rule still matches, apply it and add matches around changed cells
```

Root `<all>` uses the existing Odin `all` node loop: collect matches, shuffle with `MJRandom`, apply non-overlapping outputs per step, and rescan around changed cells.

Root `<prl>` uses the existing Odin parallel node loop: full scan each turn, apply probability `p` checks with `MJRandom.NextDouble`, stage output into a new state, then commit changed cells.

Simple root `<markov>` uses a container marker followed by child node markers/rules. It tries child nodes in order each outer step and applies the first child that changes, preserving persistent one-node match state for the currently supported fixtures.

Simple root `<sequence>` uses the same child marker representation. It runs the current child until its step limit is reached or it can no longer change, then advances to the next child. Nested child containers are delimited with `op = 102`; currently this is used for direct child `<markov>` containers in sequence fixtures. `<convolution>` nodes are encoded as kind `7` plus op `107`, then executed with the existing Odin convolution kernel and `MJRandom` probability checks.

This format is intentionally insufficient for full MarkovJunior. It proves:

- WIT list/u8 transport
- Odin object linked into a component via C wrapper
- deterministic run API
- GAMS e2e test path
- first golden parity fixtures: `Basic`, `Growth`, `MazeGrowth`, and `RegularSAW`

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
