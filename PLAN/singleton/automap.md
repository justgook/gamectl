# automap

- kind: `singleton`
- status: `migration-needed`
- source: `plugins/automap`

## Description
Tilemap automapping plugin.

Current browser2 shape:
- loaded as a worker-side wasm plugin
- reads rules/input/output tilemaps from `tilemap_storage` through routed `sql.query(...)`
- writes transformed tilemaps to `tilemap_storage` through routed `sql.exec(...)`
- owns its SQL bootstrap via `__sql_init`
- does not call legacy `host.log`; browser2 has no generic `host` module

## Current API Surface
- `automap(json)`
- `__sql_init()`

## Notes
- `automap(json)` expects `{ "rulesMapId": string, "inputMapId": string, "outputMapId": string }`.
- `automap(json)` reads the named rules and input tilemaps from `tilemap_storage`, applies the rules, and stores the result under `outputMapId` in `tilemap_storage`.
- `__sql_init()` creates the `tilemap_storage` table.
- browser2 plugin config loads `sql` before `automap` because both the init hook and `automap(...)` use the routed SQL service.

## Todo
- [ ] document exact JSON input/output contract
- [ ] decide whether storage should remain inside `automap(...)` or split into pure transform vs persist calls later
- [ ] decide on routed logging/diagnostics service if automap logs are needed in browser2
