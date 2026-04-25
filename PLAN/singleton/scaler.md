# scaler

- kind: `singleton`
- status: `migration-needed`
- source: `plugins/scaler`

## Description
Tilemap scaling plugin.

Current browser2 shape:
- loaded as a worker-side wasm plugin
- reads source tilemaps from `tilemap_storage` through routed `sql.query(...)`
- writes scaled tilemaps to `tilemap_storage` through routed `sql.exec(...)`
- owns its SQL bootstrap via `__sql_init`
- does not call legacy `host.log`; browser2 has no generic `host` module

## Current API Surface
- `scale(json)`
- `__sql_init()`

## Notes
- `scale(json)` expects at least `{ "inputMapId": string, "outputMapId": string, "scaleFactor": number }`.
- `scale(json)` optionally accepts `doorSizes` for custom door-layer scaling.
- `scale(json)` reads the named input tilemap from `tilemap_storage`, scales it, and stores it under `outputMapId` in `tilemap_storage`.
- `__sql_init()` creates the `tilemap_storage` table.
- browser2 plugin config already loads `sql` before `scaler` because both the init hook and `scale(...)` use the routed SQL service.

## Todo
- [ ] document exact JSON input/output contract
- [ ] decide whether storage should remain inside `scale(...)` or split into pure transform vs persist calls later
- [ ] decide on routed logging/diagnostics service if scaling logs are needed in browser2
