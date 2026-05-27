# markov-junior.comp

Odin-backed MarkovJunior compute component for GAMS.

## Boundary

The component is intentionally pure for MVP:

- no `gams:fs` import
- no `wasi:filesystem` import yet
- no XML, PNG, or VOX file I/O inside the component
- deterministic `input -> output` execution through one exported WIT function

External tooling is responsible for compiling source assets into prepared inputs:

```text
MarkovJunior XML + resources -> MJIR + initial indexed grid -> markov-junior.comp -> final indexed grid
```

If file access is needed later, prefer standard `wasi:filesystem`; do not add `gams:fs`.

## Public API

See `wit/package.wit`.

Current MVP export:

```text
markov-junior/markov-junior::run(model-ir, initial-cells, config) -> result<grid, string>
```

`initial-cells` and result `cells` are indexed `u8` cell values. The `values` string maps each index to the original MarkovJunior symbol.

## MJIR MVP

The first checked-in MJIR format is a tracer-bullet format, not the final complete MarkovJunior IR. It exists to prove the component build, WIT call path, deterministic execution, and e2e test shape.

Little-endian byte layout:

```text
bytes[0..4]   "MJIR"
u32           version = 1
u32           values_len
u8[]          values UTF-8/symbol bytes
u32           rule_count = 1
u32           op = 1              # one-cell replace
u8            input_value_index
u8            output_value_index
```

Semantics for `op = 1` in the tracer implementation:

```text
repeat until max-steps or no match:
  replace the first cell equal to input_value_index with output_value_index
```

This is deliberately deterministic and minimal. The next step is to replace this tracer interpreter with a real MJIR executor matching the current Odin/C# model behavior.

## Test strategy

Short term:

1. e2e test calls the component through GAMS runtime.
2. Test verifies deterministic `model-ir + initial grid + config -> grid` behavior.

Migration strategy:

1. Build an external compiler from existing MarkovJunior XML/resources to MJIR.
2. Generate golden outputs from the existing Odin/C# runner for all models.
3. Run the same prepared inputs through `markov-junior.comp`.
4. Compare final grids byte-for-byte.
5. Only after parity is complete, improve internals and consider generic randomness via `wasi:random`.

## Build

From GAMS repo root:

```sh
make build.nosync/plugins/markov-junior.comp.wasm
```

Run e2e:

```sh
make markov-junior.comp-test
```

Run the first parity fixture against the original MarkovJunior Odin runner:

```sh
MARKOV_JUNIOR_REPO=/Users/gook/Repos/MarkovJunior node plugins/markov-junior.comp/test/parity-basic.mjs
```

`parity-basic.mjs` compiles `models/Basic.xml` into MJIR v1, runs the original Odin CLI for 10 steps, extracts the original seed from the generated filename, runs the component with the same seed/config, and compares final grid bytes.
