# treegen

- kind: `singleton`
- status: `migration-needed`
- source: `plugins/treegen`

## Description
Procedural tree generation plugin.

Current browser2 shape:
- loaded as a worker-side wasm plugin
- depends on raw wasm module import `random`
- stores generated trees through routed `sql.exec(...)`
- owns its SQL bootstrap via `__sql_init`

## Current API Surface
- `gen(json)`
- `__sql_init()`

## Notes
- `gen(json)` generates a tree and stores it in `tree_storage`
- `__sql_init()` creates the `tree_storage` table
- this is a good early example of the new plugin-owned bootstrap direction instead of centralized host migration files

## Todo
- [ ] document exact JSON input/output contract
- [ ] decide whether storage should remain inside `gen(...)` or split into generate vs persist calls later
- [ ] confirm long-term schema shape for `tree_storage`
