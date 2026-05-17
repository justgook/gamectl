# cmd/app wRPC Investigation Plan

Status: **investigation / requires spike**.

## Motivation

Replace ad-hoc Tauri command/event payloads between `cmd/app/src` and `cmd/app/src-tauri` with a WIT-shaped RPC layer where possible. wRPC is attractive because it uses WIT identities and component-model value encoding instead of inventing another app-specific wire format.

## Findings

- wRPC is a Bytecode Alliance project for transport-agnostic WIT RPC.
- Rust support is strong:
  - `wrpc-transport` provides the core `Invoke`/`Serve` traits and framed transport.
  - `wrpc-runtime-wasmtime` has dynamic Wasmtime helpers for decoding wRPC/component-model bytes into `wasmtime::component::Val`, calling a `Func`, and encoding results.
  - `wrpc-transport-web` exists, but **GAMS should not use WebTransport for app frontend/backend IPC** because Tauri already provides direct JS -> Rust commands through `globalThis.__TAURI__.core.invoke`.
- JavaScript/browser support is sufficient for GAMS if views own their typed call encoding manually:
  - the upstream README lists static binding generators for Rust and Go, not JavaScript;
  - GAMS does not need generated JS bindings if each view knows which plugin functions it may call and encodes those arguments directly.
- wRPC standardizes the invocation framing/value encoding. For `cmd/app`, Tauri IPC should be treated as the carrier for wRPC bytes, not replaced by a local network transport.

## Implications for GAMS

A full immediate replacement of `runtime.invoke(...)` / `runtime.callView(...)` is risky because current `cmd/app` depends on dynamic component introspection and JSON<->Wasmtime `Val` conversion. wRPC is strongest when each side has static generated bindings for known WIT interfaces.

Recommended approach: start with a narrow tracer-bullet, then decide whether to expand.

## Candidate Architecture

### Backend-served API

Define a first-party app runtime WIT package, for example:

```wit
package gams:app-runtime@1.0.0;

interface host {
  record component-handle {
    handle: string,
    path: string,
    imports: list<string>,
    exports: list<string>,
  }

  add-plugins: func(paths: list<string>, reload: bool) -> result<list<component-handle>, string>;
  diagnostics: func() -> result<string, string>;

  // Transitional escape hatch while dynamic JS WIT bindings are absent.
  invoke-json: func(target: string, args-json: string) -> result<string, string>;
}

interface view {
  call: func(target: string, args: string) -> result<string, string>;
}
```

`invoke-json` is intentionally transitional. It lets the first wRPC spike reuse the existing Rust dynamic component invocation path while replacing only the frontend/backend envelope.

### Chosen Direction: Tauri IPC as the wRPC Carrier

Keep Tauri as the transport carrier, but make the payload wRPC-framed bytes. For the first spike, use one command per invocation:

```text
JS runtime_wrpc_call(Uint8Array request) -> Uint8Array response
```

The JS side will:

1. hard-code the WIT function it is calling;
2. encode the wRPC invocation header (`instance`, `name`) and component-model parameter bytes;
3. call `globalThis.__TAURI__.core.invoke('runtime_wrpc_call', { request })`;
4. decode component-model result bytes according to the same known WIT function.

The Rust side will:

1. decode the wRPC invocation header;
2. resolve the function through the existing runtime registry;
3. inspect the Wasmtime function type;
4. decode parameter bytes into `wasmtime::component::Val`;
5. call the loaded component function;
6. encode result `Val`s back as component-model bytes.

Pros:
- avoids local network/cert/WebTransport issues;
- fits current Tauri app shape;
- can be migrated incrementally;
- removes the current JSON/string argument protocol for JS -> Rust plugin calls.

Risks/limits:
- Tauri remains the byte carrier, so this is not a stock upstream transport implementation;
- the initial one-shot command should explicitly reject streams/resources/deferred paths until needed;
- Rust still needs dynamic decode/encode against Wasmtime `Type`s because GAMS loads arbitrary plugins at runtime.

## Recommended Spike

1. Keep existing Tauri commands/events intact.
2. Add a small JS example path in `cmd/app/src/core/runtime.js` behind an explicit experimental method, not used by default.
3. Add a new Rust command:

   ```rust
   #[tauri::command]
   async fn runtime_wrpc_call(request: Vec<u8>, runtime: tauri::State<'_, runtime::Runtime>) -> Result<Vec<u8>, String>
   ```

4. Implement `runtime.wrpcInvokeExperimental(requestBytes)` in JS as the raw byte call.
5. Implement one manually encoded JS example against a simple already-built component function, preferably `adder/add::add` or `fs/fs::read-text`.
6. Rust implementation options:
   - preferably reuse `wrpc-runtime-wasmtime` dynamic `read_value` / `ValEncoder` / `call` helpers if they fit the current synchronous runtime shape;
   - otherwise copy/adapt a minimal no-stream/no-resource dynamic decoder/encoder for the existing supported `Type`s.
7. Once the byte path works, make `runtime.invoke` a JS-side compatibility wrapper only if desired. New views can call typed JS helpers directly and avoid JSON.

## Acceptance Criteria for the Spike

- Frontend can call one loaded plugin function over wRPC bytes and receive a typed result.
- Failure is fail-fast and visible in the UI console.
- Existing `runtime.invoke(...)` path still works while the experiment is gated.
- The implementation uses Tauri IPC only as byte transport; there is no WebTransport/local server.
- The code makes clear which parts are standardized wRPC/component-model encoding and which parts are GAMS/Tauri carrier glue.

## Open Questions

- Should the one-shot Tauri command exchange use full wRPC framed-stream bytes, or a smaller app envelope containing `{instance, name, params}` where `params`/`results` use component-model value encoding?
- Can `wrpc-runtime-wasmtime` be integrated cleanly with the current sync `Store`, or should `cmd/app` enable Wasmtime async support?
- Should the initial MVP reject all resource/stream/future values explicitly?
- Should Rust -> JS `gams:runtime/runtime.call(target, string)` remain string-based for views, or later use a second typed/wRPC byte command/event bridge?
- Should `runtime.invoke` remain as a JSON compatibility wrapper over typed JS encoders, or be removed once views migrate?
