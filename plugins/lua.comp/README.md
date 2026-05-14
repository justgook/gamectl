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
host.call(target, args?)
```

`host.call` maps directly to `gams:runtime/runtime.call(target, args)` and blocks until the host/frontend responds.

Example:

```lua
function main()
  local result = host.call("ui.toast.confirm", '{"message":"Continue?"}')
  return json.decode(result).ok
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
