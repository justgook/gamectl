# respack wasm plugin (odin)

This Odin module exposes a minimal respack writer surface so we can plug the JS/Go

1. `init` — accepts a schema JSON blob as input. Replaces any existing writer
   state, stores the schema bytes (bounded by 256 KB), and resets all slots.
2. `write` — accepts JSON of the form `{"slot": N, "payload": <any JSON value>}`.
   The slot index is validated against the schema `data` array and the payload
   JSON is copied into an internal arena (2 MB capacity). Rewrites reuse the
   previous slot buffer where possible.
3. `dump` — placeholder for the future binary encoder. It currently returns an
   error message so the host can verify the symbol exists without producing
   output yet.

Example usage from the browser runtime:

```js
// Parse schema JSON and initialize the writer
await pluginManager.call('respack', 'init', JSON.stringify(schema));

// Write payloads into schema slots
await pluginManager.call('respack', 'write', JSON.stringify({
  slot: 0,
  payload: { name: 'demo-level', spawns: [] }
}));

// Dump is not implemented yet but the entry point exists for future work
const result = await pluginManager.call('respack', 'dump');
console.log(new TextDecoder().decode(result.output)); // "dump not implemented yet"
```

Limits in this first phase:

- Schema `data` arrays may define up to 512 slots (over that we reject init).
- Schema JSON must be <= 256 KB to fit the static buffer.
- Payload arena budget is 2 MB; writing beyond that returns `"payload storage exhausted"`.
- No schema validation or binary encoding yet — we just capture JSON blobs and
  track slot metadata so later phases can do zero-copy encoding.

The implementation lives in `plugins/respack/main.odin` with helpers under
`plugins/respack/pdk` (env ABI helpers) and `plugins/respack/jsmn` (a tiny JSON
tokenizer inspired by jsmn).
