# markov-junior.comp TODO

This tracks the parity-first migration of MarkovJunior into a pure GAMS WASM component.

## Current rules

- [x] No `gams:fs` import.
- [x] No filesystem access in the component MVP.
- [x] XML/resources are compiled outside the component.
- [x] Component input is `MJIR + initial-cells + run-config`.
- [x] Deterministic seed behavior uses existing `MJRandom`.
- [ ] Keep original Odin/C# outputs as parity goldens before internal improvements.

## Part 1 — component scaffold and pure API

- [x] Create `plugins/markov-junior.comp/` scaffold.
- [x] Copy Odin port into `markov_junior/` package.
- [x] Add WIT API: `run(model-ir, initial-cells, config) -> result<grid, string>`.
- [x] Add C WIT wrapper around Odin exports.
- [x] Add Odin core exports.
- [x] Build `build.nosync/plugins/markov-junior.comp.wasm` in `nix develop`.

## Part 2 — reusable XML → MJIR compiler

- [x] Add `compiler/xml-to-mjir.mjs` reusable module.
- [x] Make `test/mjir-v1.mjs` re-export compiler helpers for compatibility.
- [x] Support root `<one>` with inline `values`, `in`, `out`, `origin`, `symmetry`.
- [x] Support multi-cell 2D/3D pattern parsing syntax (`/` rows, space-separated layers).
- [x] Fix attribute parsing so `in` does not match `origin`.
- [x] Add compiler unit tests independent of the component runtime.
- [x] Support child `<rule>` elements under root `<one>`, `<all>`, and `<prl>`.
- [x] Support rule probability `p` for stochastic rules.
- [x] Support `<union>` declarations.
- [ ] Decide how to represent unsupported children like `<field>` in MJIR.

## Part 3 — MJIR v1 executor

- [x] Implement legacy `op = 1` one-cell rule.
- [x] Implement `op = 2` pattern rule with dimensions and symmetry string.
- [x] Build native Odin `Rule`s from MJIR pattern bytes.
- [x] Expand symmetries via existing Odin helpers.
- [x] Run existing Odin `one` node match/apply loop with `MJRandom`.
- [x] Add MJIR node support for root `all` inline-pattern models.
- [x] Add MJIR node support for root `prl` models.
- [x] Add simple root `<markov>` container semantics for supported child nodes.
- [x] Add simple root `<sequence>` container semantics for supported child nodes.
- [ ] Add resource-free representation for fields/observations/WFC data.

## Part 4 — parity fixtures

### Passing root `<one>` fixtures

- [x] `Basic.xml`
- [x] `Growth.xml`
- [x] `GrowthContraction.xml`
- [x] `GrowthWalk.xml`
- [x] `IrregularMazeGrowth.xml`
- [x] `IrregularSAW.xml`
- [x] `MazeGrowth.xml`
- [x] `MazeTrail.xml`
- [x] `RainbowGrowth.xml`
- [x] `RegularSAW.xml`
- [x] `SelfAvoidingWalk.xml`
- [x] `StrangeGrowth.xml`
- [x] `Trail.xml`

### Passing root `<all>` inline fixtures

- [x] `ParallelGrowth.xml`
- [x] `ParallelMazeGrowth.xml`
- [x] `PutLs.xml`
- [x] `NestedGrowth.xml`

### Passing root `<prl>` fixtures

- [x] `ForestFire.xml`

### Passing root `<markov>` fixtures

- [x] `Backtracker.xml`
- [x] `Digger.xml`
- [x] `MazeBacktracker.xml`
- [x] `NoDeadEnds.xml`
- [x] `PutColoredLs.xml`
- [x] `RegularSAWRestart.xml`
- [x] `SAWRestart.xml`

### Passing root `<sequence>` fixtures

- [x] `BasicDungeonGrowth.xml`
- [x] `Cycles.xml`
- [x] `DualRetraction.xml`
- [x] `GrowthCompetition.xml`
- [x] `LoopGrowth.xml`
- [x] `Noise.xml`
- [x] `Push.xml`
- [x] `River.xml`
- [x] `SmoothTrail.xml`
- [x] `StochasticVoronoi.xml`
- [x] `StrangeDungeon.xml`
- [x] `Voronoi.xml`

### Next candidate fixtures

- [x] Root `<all>` with child `<rule>` elements: `NestedGrowth.xml`.
- [x] Union-backed sequence model: `BasicDungeonGrowth.xml`.
- [ ] Unlisted/no-config root `<one>` model: `RandomWalk.xml` (needs explicit config or fixture metadata).
- [ ] Root `<one>` with child `<field>`: `CentralSAW.xml` (needs field decision/support or explicit unsupported-model test).
- [x] Root `<all>` inline-rule models.
- [x] Root `<prl>` child-rule models.
- [x] Simple `<sequence>` models composed of supported child nodes.
- [x] Simple `<markov>` models composed of supported child nodes.

## Part 5 — test and docs hygiene

- [x] Component e2e test through GAMS runtime.
- [x] Parity test invokes original MarkovJunior Odin CLI and compares final grid bytes.
- [x] `README.md` documents pure boundary, build, and parity command.
- [x] `MJIR.md` documents current v1 tracer layout and semantics.
- [x] Add this `TODO.md` continuation tracker.
- [x] Split root-one parity into `parity-root-one.mjs`; keep `parity-basic.mjs` as compatibility shim.
- [x] Add CLI filtering/replay flags: `--model`, `--models`, `--runs`, `--steps`.
- [x] Add deterministic fuzz/replay script with printed seeds: `fuzz-root-one.mjs`.
- [x] Add fixture discovery/filtering so unsupported models are reported clearly (`test/discover-supported.mjs`).
- [ ] Add CI-friendly parity mode that can skip if original MarkovJunior repo is absent.

## Commands

From `/Users/gook/Repos/gams3`:

```sh
nix develop -c make build.nosync/plugins/markov-junior.comp.wasm
nix develop -c make markov-junior.comp-test
node plugins/markov-junior.comp/test/compiler.mjs
nix develop -c node plugins/markov-junior.comp/test/parity-basic.mjs
nix develop -c node plugins/markov-junior.comp/test/parity-root-one.mjs --model=Basic --runs=2 --steps=10
nix develop -c node plugins/markov-junior.comp/test/parity-root-all.mjs --runs=1 --steps=10
nix develop -c node plugins/markov-junior.comp/test/parity-root-prl.mjs --runs=1 --steps=10
nix develop -c node plugins/markov-junior.comp/test/parity-root-markov.mjs --runs=1 --steps=10
nix develop -c node plugins/markov-junior.comp/test/parity-root-sequence.mjs --runs=1 --steps=10
node plugins/markov-junior.comp/test/discover-supported.mjs --show-unsupported
nix develop -c node plugins/markov-junior.comp/test/fuzz-root-one.mjs --model=Basic --runs=10 --steps=10
nix develop -c node plugins/markov-junior.comp/test/fuzz-root-one.mjs --model=Basic --runs=1 --steps=10 --seed=12345
```

## Latest status

Root `<one>`, `<all>`, `<prl>`, simple root `<markov>`, and simple root `<sequence>` fixtures listed above pass byte-for-byte against the original Odin runner for 10 steps using the seed emitted in the original output filename. Fuzz/replay testing also verifies deterministic component output for random or explicit seeds and prints reproduction commands on failure.
