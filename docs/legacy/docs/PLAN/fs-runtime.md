# Runtime and Virtual FS Interface

Status: **superseded as target architecture** by `PLAN/app-runtime-component-ui-spec.md`.

This file documents the previous app-side GAMS virtual FS/mount runtime direction. The new priority is to use WASI filesystem/preopens as the primary runtime filesystem model. Keep this file as historical context until the old implementation is removed or migrated.

Goal: make the Tauri/Rust host provide a small mandatory runtime boundary that JS, views, and plugins can use without depending on Tauri-specific APIs directly.

## Boundary Contract

The host boundary is byte-oriented:

```text
runtime.call(plugin: string, method: string, input: Uint8Array) -> Uint8Array
```

Encoding of `input` and `output` is owned by each plugin/method contract. Common conventions:

- raw file data returns raw bytes,
- paths are UTF-8 bytes,
- structured requests/responses are UTF-8 JSON bytes.

The JS wrapper may provide convenience helpers for strings/JSON, but the native command remains bytes in / bytes out.

## Mandatory Runtime Plugins

Rust/Tauri must provide at least:

- `runtime` — runtime inspection/basic host calls,
- `fs` — virtual filesystem router.

Driver-level plugins are exposed for diagnostics and future direct usage:

- `fs-http`,
- `fs-internal`,
- `fs-native`,
- `fs-webdav`.

Normal app/plugin code should call `fs`, not individual drivers.

## Initial FS Methods

```text
runtime.call("fs", "read", pathBytes)      -> file bytes
runtime.call("fs", "readText", pathBytes)  -> UTF-8 text bytes
runtime.call("fs", "write", jsonBytes)     -> empty bytes
runtime.call("fs", "writeText", jsonBytes) -> empty bytes
runtime.call("fs", "list", pathBytes)      -> JSON bytes
runtime.call("fs", "stat", pathBytes)      -> JSON bytes
runtime.call("fs", "exists", pathBytes)    -> JSON boolean bytes
runtime.call("fs", "mounts", emptyBytes)   -> JSON bytes
```

Paths use mount-prefix form during migration:

```text
demo/gams.json
internal/cache/foo.json
project/assets/player.png
```

## Mount Source

The Tauri runtime currently boots from the repository demo config:

```text
demo/gams.json
```

The config's `fs.mount` table initializes the virtual FS. Existing `http` manifest mounts are treated as local development file mappings when their URLs point into `/demo/...`.

## Open Items

- Add runtime mutation methods for `fs.mount` / `fs.unmount`.
- Implement remote HTTP loading for absolute `http://` / `https://` URLs.
- Implement WebDAV methods.
- Decide whether driver plugins should support full direct IO or remain diagnostics-only.
- Decide final path syntax before broad plugin migration.
