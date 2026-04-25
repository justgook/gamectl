# minimap2

- kind: `singleton`
- status: `migration-needed`
- source: `plugins/minimap2`

## Description
Procedural minimap/tilemap generation plugin.

Current browser2 shape:
- loaded as a worker-side wasm plugin
- depends on raw wasm module import `random`
- reads source trees from `tree_storage` through routed `sql.query(...)`
- writes generated tilemaps to `tilemap_storage` through routed `sql.exec(...)`
- owns its SQL bootstrap via `__sql_init`
- does not call legacy `host.log`; browser2 has no generic `host` module

## Current API Surface
- `gen(json)`
- `__sql_init()`

## Notes
- `gen(json)` expects at least `{ "treeId": string, "mapId": string }`.
- `gen(json)` reads the named tree from `tree_storage`, generates a tilemap, and stores it under `mapId` in `tilemap_storage`.
- `__sql_init()` creates the `tilemap_storage` table.
- browser2 plugin config should load `sql` before `minimap2` because both the init hook and `gen(...)` use the routed SQL service.

## Todo
- [ ] document exact JSON input/output contract
- [ ] decide whether storage should remain inside `gen(...)` or split into generate vs persist calls later
- [ ] decide on routed logging/diagnostics service if generation logs are needed in browser2
