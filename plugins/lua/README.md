# lua plugin

Minimal Lua execution plugin for GAMS.

## Contract

Exports:

- `init`
- `run`

Main use:

```js
runtime.call("lua", "run", `
function main()
  output = { answer = 42 }
end
`)
```

`run` behavior:

1. creates a fresh Lua state
2. opens a small safe standard-library set
3. injects `host` and `json`
4. executes the provided Lua source
5. calls global `main()` if it exists
6. reads global `output`
7. returns `json.encode(output)` as plugin output

If `output` is unset, the result is `null`.

## Injected globals

### `host.call(moduleName, functionName, input?)`

Calls another plugin through PDK sync plugin calls.

Example:

```lua
function main()
  local text = host.call("fs", "read", "/project/data.json")
  output = { text = text }
end
```

`host.awaitCall(...)` is currently an alias of `host.call(...)`.

### `json.encode(value)`

Encodes Lua values to JSON.

Supported:

- `nil` -> `null`
- booleans
- numbers
- strings
- arrays (`{1,2,3}` style contiguous integer keys from 1)
- objects (string-keyed tables)

### `json.decode(text)`

Decodes JSON into Lua values.

Example:

```lua
function main()
  local doc = json.decode('{"name":"demo","items":[1,2,true,null]}')
  output = {
    name = doc.name,
    second = doc.items[2],
    third = doc.items[3],
    fourth_is_nil = doc.items[4] == nil,
  }
end
```

## `require(...)`

The plugin enables Lua `require(...)` backed by `fs.read`.

Lookup order:

1. exact module name
2. exact module name + `.lua`
3. dots converted to slashes
4. dots converted to slashes + `.lua`

Examples:

```lua
local util = require("/project/scripts/util")
local other = require("game.helpers.math")
```

Normal `package.loaded` caching is preserved.

## Opened Lua libraries

- base
- coroutine
- table
- string
- math
- utf8
- package

Not opened:

- `io`
- `os`
- native C module loading

## Build

```bash
make build.nosync/plugins/lua.wasm
```

## Test

```bash
node ./plugins/lua/test/e2e.mjs
```

The e2e test respawns Node with `--experimental-wasm-exnref` because the current Lua WASM build uses WebAssembly exception-handling features.
