# lua.comp

Lua plugin for the `cmd/app` Wasm component-model runtime.

## WIT

Exports `gams:lua/lua@1.0.0`:

- `run(source: string) -> result<string, string>`

Imports:

- `gams:runtime/runtime@1.0.0` for blocking host/UI calls from Lua.
- native WASI filesystem interfaces for `require(...)` module loading.

It intentionally does **not** import `gams:fs`; that proxy is for frontend filesystem access.

## Lua API

```lua
host.call(target, ...)
host.raw_call(target, args_json)
fs.read_text(path)
fs.read(path) -- alias for read_text
```

`host.call` maps to `gams:runtime/runtime.call(target, args_json)` and blocks until the host/frontend responds. It JSON-encodes all arguments after `target` as an argument array, decodes the JSON response, unwraps `{ ok = value }`, and raises a Lua error for `{ err = message }` or transport failures. Those errors are regular Lua errors and can be handled with `pcall`.

`host.raw_call` exposes the underlying string protocol directly.

`fs.read_text` reads a text file from the component's WASI preopens and returns it as a Lua string. Missing or unreadable files raise a Lua error.

Example:

```lua
function main()
  return host.call("fs/fs::read-text", "ng/run.lua")
end
```

## Return value

`main()` is the script entrypoint.

- string return values are returned directly
- `nil` is returned as `null`
- non-string values are JSON encoded, including booleans, numbers, arrays, and objects

Example:

```lua
function main()
  return { answer = 42, ok = true }
end
```

returns:

```json
{"answer":42,"ok":true}
```

## Build

```bash
make build.nosync/plugins/lua.comp.wasm
```
