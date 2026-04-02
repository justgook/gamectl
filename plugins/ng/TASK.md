# NG Task Handoff

## Current State

- `ng` exposes a placeholder CLI-safe export:
  - `run`
- Current active `plugin.mk` still builds `ng.wasm` using vendored Lua sources directly.
- That active build uses the temporary fallback path:
  - `-DNG_LUA_NO_UNWIND`
- This active build works with the current CLI runtime.

## Important Files

- `plugins/ng/main.c`
- `plugins/ng/ng.h`
- `plugins/ng/plugin.mk`
- `plugins/ng/vendor/lua/ldo.c`
- `plugins/ng/vendor/lua/luaconf.h`
- `plugins/ng/scripts/build-lua-modern.sh`
- `plugins/ng/build/lua54-wasi-modern.a`
- `plugins/ng/build/lua54-wasi-modern.o`

## Proven Facts

1. The repo can now build a standalone modern Lua artifact:

```bash
make ng-lua-modern
```

This produces:

- `plugins/ng/build/lua54-wasi-modern.a`
- `plugins/ng/build/lua54-wasi-modern.o`

2. The modern Lua artifact is built with a modern wasm EH path using `zig cc`:

- `-mexception-handling`
- `-mmultivalue`
- `-mreference-types`
- `-mllvm -wasm-enable-sjlj`
- `-mllvm -wasm-use-legacy-eh=false`

3. A standalone `ng.wasm` linked from:

- `main.c`
- `shim/wasm_setjmp_shim.c`
- `lua54-wasi-modern.o`

was successfully instantiated and run under Wasmtime.

## Current Active Build vs Clean Build

### Active build now

- uses vendored Lua C sources directly in `plugin.mk`
- uses `NG_LUA_NO_UNWIND`
- works with current CLI runtime
- not the desired final solution

### Clean path proved but not activated

- build Lua first as standalone modern artifact
- link `ng` against that artifact
- this is the desired direction
- not active yet only because current CLI runtime backend still rejects the resulting wasm

## What Was Changed Already

### `ldo.c`

- supports two modes now:
  1. current fallback mode with `NG_LUA_NO_UNWIND`
  2. normal exception-based path used by the standalone Lua builder

### `luaconf.h`

- aligned closer to the working `odin-lua` variant
- restored C++-aware linkage macros needed for future integration work

### `ng.h`

- wrapped declarations with `extern "C"` guards for C++ safety

## Recommended Next Steps

1. Keep `make ng-lua-modern` as the source of truth for the clean Lua build.
2. Once CLI runtime is moved to Wasmtime, switch `plugin.mk` active build to:
   - `main.c`
   - `shim/wasm_setjmp_shim.c`
   - `plugins/ng/build/lua54-wasi-modern.o`
3. Remove `NG_LUA_NO_UNWIND` from the active build when that switch happens.
4. Reverify placeholder command:
   - `gams run ng run --input default`
5. Then implement the real `ng run` contract:
   - input: graph name
   - load graph from DB
   - execute
   - return structured result

## Known Runtime Result

- Clean modern-Lua-linked `ng.wasm`:
  - works under Wasmtime probe
  - does not work under current Wazero-backed CLI runtime

This means the remaining blocker is runtime backend compatibility, not Lua build feasibility.

## Suggested Clean `plugin.mk` Shape Later

Target direction:

- `PLUGIN_C_SOURCES := main.c shim/wasm_setjmp_shim.c lua54-wasi-modern.o`
- no direct vendored Lua source list in final link step
- keep Lua build as a distinct artifact target

## Handy Commands

Build current active `ng`:

```bash
make build.nosync/plugins/ng.wasm
```

Build clean standalone Lua artifact:

```bash
make ng-lua-modern
```

Current working placeholder command:

```bash
./build.nosync/gams run ng run --input default
```

## Goal

Move `ng` to a clean build pipeline where Lua is first produced as its own wasm object/archive, and `ng.wasm` links against that artifact instead of compiling vendored Lua sources inline.
