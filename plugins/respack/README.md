# respack wasm plugin (odin)

This Odin module exposes a minimal respack writer surface so we can plug the JS/Go

1. `init` — accepts a schema JSON blob as input. Replaces any existing writer
   state, stores the schema bytes (bounded by 256 KB), and resets all slots.
2. `write` — accepts JSON of the form `{"slot": N, "payload": <any JSON value>}`.
   The slot index is validated against the schema `data` array and the payload
   JSON is copied into an internal arena (2 MB capacity). Rewrites reuse the
   previous slot buffer where possible.
3. `dump` — emits a compact binary blob with a small header + slot table +
   encoded payload bytes for written slots.
4. `generate_odin` — emits an Odin decoder source file for the currently loaded
   schema. Pass the desired package name as the input string.

Example usage from the browser runtime:

```js
// Parse schema JSON and initialize the writer
await pluginManager.call('respack', 'init', JSON.stringify(schema));

// Write payloads into schema slots
await pluginManager.call('respack', 'write', JSON.stringify({
  slot: 0,
  payload: { name: 'demo-level', spawns: [] }
}));

// Dump encoded bytes and generate an Odin decoder for the schema
const result = await pluginManager.call('respack', 'dump');
const decoderSource = await pluginManager.call('respack', 'generate_odin', 'main');
```

Limits in this first phase:

- Schema `data` arrays may define up to 512 slots (over that we reject init).
- Schema JSON must be <= 256 KB to fit the static buffer.
- Payload arena budget is 2 MB; writing beyond that returns `"payload storage exhausted"`.
- Current end-to-end coverage lives in `plugins/respack/test/e2e.mjs`. It builds
  the WASM plugin, writes a fixture payload, dumps bytes, generates an Odin
  decoder, and runs that decoder with native Odin to validate the round-trip.
- The current encoder/decoder path is intentionally small and deterministic; the
  first supported end-to-end slice focuses on named types, aliases, structs,
  primitive scalars, strings, arrays, vectors, and generated slot readers.

The implementation lives in `plugins/respack/main.odin` with helpers under
`plugins/respack/pdk` (env ABI helpers) and `plugins/respack/jsmn` (a tiny JSON
tokenizer inspired by jsmn).
