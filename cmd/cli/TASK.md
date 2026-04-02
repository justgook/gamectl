# CLI Task Handoff

## Current State

- Canonical UX is `gams run <plugin> <command> --input <value>`.
- Plugin resolution is registry-first from the SQLite DB.
- CLI boot flow already works for current runtime:
  - load `sql`
  - load DB file if present
  - migrate if needed
  - load enabled `global` plugins
  - load requested plugin explicitly, including `view` plugins
- `ng` currently has a placeholder CLI-safe export:
  - `gams run ng run --input default`
- This works today with the current `ng.wasm` build and current CLI runtime.

## Important Files

- `cmd/cli/app.go`
- `cmd/cli/run_command.go`
- `cmd/cli/plugins_command.go`
- `pkg/wasmhost/wasmhost.go`
- `third_party/wpm/sdk/internal/manager.go`
- `cmd/wasmtimeprobe/main.go`

## Current Runtime Situation

- The active CLI runtime is still based on the local `wpm/sdk` + Wazero path.
- That runtime works for:
  - `sql`
  - current global plugins
  - current placeholder `ng` build
- It does not accept the modern Lua-linked `ng.wasm` artifact:
  - Wazero fails with `invalid section order`
- Wasmtime can instantiate the modern Lua-linked `ng.wasm` artifact successfully.

## Proven Facts

- A standalone modern Lua wasm object can be built inside this repo:
  - `make ng-lua-modern`
- A standalone `ng.wasm` linked with:
  - `plugins/ng/main.c`
  - `plugins/ng/shim/wasm_setjmp_shim.c`
  - `plugins/ng/build/lua54-wasi-modern.o`
  is runnable under Wasmtime.
- Therefore the remaining blocker for the clean `ng` path is now the CLI backend, not Lua feasibility.

## Recommended Next Steps

1. Add a Wasmtime-backed runtime implementation in `pkg/wasmhost`.
2. Keep the public CLI UX unchanged.
3. Minimize churn by preserving the current `Runtime` API shape if possible.
4. Reuse existing host functions first:
   - `host.log`
   - `fs.*`
   - PDK env functions
   - temporary `ng_*` env stubs already explored in the local SDK
5. Prove these commands under the Wasmtime-backed runtime:
   - `gams run sql query --input "SELECT 1 AS ok"`
   - `gams run math add --input "a=5,b=3"`
   - `gams run ng run --input default`
6. After Wasmtime runtime works, switch `plugins/ng/plugin.mk` to the clean modern-Lua path documented in `plugins/ng/TASK.md`.

## Suggested Migration Order

1. Implement Wasmtime runtime in parallel to the current Wazero one.
2. Add a small runtime selection switch in CLI config or temporary code path.
3. Keep SQL/bootstrap behavior identical during migration.
4. Verify registry-driven plugin loading still works.
5. Only after runtime verification, switch active `ng` build to the modern-Lua artifact path.

## Known Caveats

- `cmd/wasmtimeprobe` is currently the proof tool for Wasmtime compatibility.
- Current working `ng.wasm` build still uses the temporary `NG_LUA_NO_UNWIND` path.
- The clean modern-Lua-linked `ng.wasm` is not active in `plugin.mk` yet because the CLI runtime backend has not been switched.

## Handy Commands

```bash
./build.nosync/gams run sql query --input 'SELECT 1 AS ok'
./build.nosync/gams run math add --input 'a=5,b=3'
./build.nosync/gams run ng run --input default
make ng-lua-modern
```

## Goal

Keep the UX stable and generic:

```bash
gams run <plugin> <command> --input <value>
```

The backend and plugin scope differences should stay internal.
