# random

- kind: `singleton`
- status: `migration-needed`
- source: `plugins/random`

## Description
Raw wasm random number provider used by other wasm plugins through direct wasm imports.

## Current API Surface
- `setSeed(u32)`
- `seed() -> u32`
- `intn(u32) -> u32`
- `float64() -> f64`
- `float32() -> f32`
- `next() -> f32`

## Notes
- this plugin is currently useful even without PDK support because other wasm plugins such as `treegen` import it directly as wasm module `random`
- browser2 currently loads it under the module/plugin id `random` so wasm import resolution matches the source-level contract
- if browser/CLI later need routed request/response access from JS or PDK-only callers, a separate PDK-facing wrapper may still be useful

## Todo
- [ ] decide whether `random` itself should gain a routed/PDK-facing adapter later
- [ ] document deterministic seeding expectations across hosts
