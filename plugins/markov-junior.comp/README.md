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

The first checked-in MJIR format is a tracer-bullet format, not the final complete MarkovJunior IR. It exists to prove the component build, WIT call path, deterministic execution, and e2e/parity test shape.

`compiler/xml-to-mjir.mjs` is the reusable XML→MJIR entry point. It currently supports root `<one>`, `<all>`, `<prl>`, simple root `<markov>`, and simple root `<sequence>` models with inline `in`/`out` patterns or child `<rule>` patterns, `<union>` declarations, `values`, `origin`, `symmetry`, child `steps`, and rule probability `p` attributes. It emits MJIR v1 pattern rules (`op = 2`), union declarations (`op = 101`), plus node/container markers (`op = 100`) when needed, and prepares initial indexed grids outside the component.

The component expands symmetries with the existing Odin rule helpers and runs the current Odin `one` / `all` / `prl` node matching/apply loops with `MJRandom`, preserving deterministic seed behavior for the supported models.

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

Run e2e and compiler unit tests:

```sh
make markov-junior.comp-test
node plugins/markov-junior.comp/test/compiler.mjs
```

Run the parity fixtures against the original MarkovJunior Odin runner:

```sh
MARKOV_JUNIOR_REPO=/Users/gook/Repos/MarkovJunior node plugins/markov-junior.comp/test/parity-root-one.mjs
```

`parity-root-one.mjs` compiles the currently supported root `<one>` inline-pattern fixtures (`Basic`, `Growth`, `GrowthContraction`, `GrowthWalk`, `IrregularMazeGrowth`, `IrregularSAW`, `MazeGrowth`, `MazeTrail`, `RainbowGrowth`, `RegularSAW`, `SelfAvoidingWalk`, `StrangeGrowth`, `Trail`) into MJIR v1, runs the original Odin CLI, extracts seeds from generated filenames, runs the component with the same seed/config, and compares final grid bytes. `parity-root-all.mjs` does the same for root `<all>` fixtures (`ParallelGrowth`, `ParallelMazeGrowth`, `PutLs`, `NestedGrowth`). `parity-root-prl.mjs` covers root `<prl>` fixtures (`ForestFire`). `parity-root-markov.mjs` covers simple root `<markov>` fixtures (`Backtracker`, `Digger`, `MazeBacktracker`, `NoDeadEnds`, `PutColoredLs`, `RegularSAWRestart`, `SAWRestart`). `parity-root-sequence.mjs` covers simple root `<sequence>` fixtures (`BacktrackerCycle`, `BasicBrickWall`, `BasicDungeonGrowth`, `Cycles`, `DualRetraction`, `Flowers`, `Forest`, `GrowthCompetition`, `HamiltonianPaths`, `LoopGrowth`, `Noise`, `NystromDungeon`, `Push`, `River`, `SmoothTrail`, `StochasticVoronoi`, `StrangeDungeon`, `Texture`, `Voronoi`). `parity-basic.mjs` remains as a compatibility shim.

Useful replay/fuzz commands:

```sh
node plugins/markov-junior.comp/test/parity-root-one.mjs --model=Basic --runs=2 --steps=10
node plugins/markov-junior.comp/test/parity-root-all.mjs --runs=1 --steps=10
node plugins/markov-junior.comp/test/parity-root-prl.mjs --runs=1 --steps=10
node plugins/markov-junior.comp/test/parity-root-markov.mjs --runs=1 --steps=10
node plugins/markov-junior.comp/test/parity-root-sequence.mjs --runs=1 --steps=10
node plugins/markov-junior.comp/test/discover-supported.mjs --show-unsupported
node plugins/markov-junior.comp/test/fuzz-root-one.mjs --model=Basic --runs=10 --steps=10
node plugins/markov-junior.comp/test/fuzz-root-one.mjs --model=Basic --runs=1 --steps=10 --seed=12345
```

The fuzz script runs the component twice for each model/seed, checks deterministic replay and grid invariants, and prints every seed so failures can be reproduced with `--model`, `--steps`, and `--seed`.
