# Automap TinyGo/WIT ABI panic investigation

Date: 2026-05-20
Repo: GAMS / `gamectl`
Area: `cmd/app/src-tauri/src/runtime/mod.rs`, `plugins/automap.comp`

## Symptom

Original app error looked like runtime/Tauri task failure:

```text
runtime invoke task failed: task N panicked with message "BUG: current thread is not a host thread"
```

After runtime fix, app no longer blocks itself. Remaining failure is component trap:

```text
calling gams:lua/lua@1.0.0::run: error while executing at wasm backtrace: ...
```

Direct automap repro can show:

```text
panic: runtime error: unsafe.Slice/String: len out of range
calling gams:automap/automap@1.0.0::apply: error while executing at wasm backtrace: ...
```

## Runtime bug found and fixed

Path:

```text
Lua/benchmark component -> gams:runtime/runtime.call -> automap component
```

Old behavior:

1. nested component call inside `call_runtime_target()` trapped;
2. runtime converted that trap into WIT `result::err`;
3. Wasmtime tried to lower that normal result after nested trap;
4. Wasmtime component host-task state was invalid;
5. panic:

```text
BUG: current thread is not a host thread
```

Fix in `cmd/app/src-tauri/src/runtime/mod.rs`:

- added `RuntimeCallError::{Returned, Trap}`;
- recoverable routing/JSON/native-shell errors still lower to WIT `result::err`;
- nested component `Func::call` traps propagate as host trap via `wasmtime::Error`, not WIT result.

Regression test:

```text
nested_automap_component_trap_does_not_panic_runtime_call_host_task
```

Run:

```bash
cd cmd/app/src-tauri
cargo test nested_automap_component_trap_does_not_panic_runtime_call_host_task -- --ignored --nocapture
```

Expected: pass. It may print automap/TinyGo panic lines, but must not contain:

```text
BUG: current thread is not a host thread
```

## Dependency check

Wasmtime deps already latest at investigation time:

```text
wasmtime = 44.0.1
wasmtime-wasi = 44.0.1
wasmtime-wasi-http = 44.0.1
```

`cargo update -p wasmtime -p wasmtime-wasi -p wasmtime-wasi-http` produced no Wasmtime update.

## Automap component bug isolated

Automap component source:

```text
plugins/automap.comp
```

WIT shape:

```wit
record tile-layer {
    width: u32,
    data: list<u32>,
    props: list<tuple<string, string>>,
}

record tile-map {
    layers: list<tile-layer>,
    props: list<tuple<string, string>>,
}

apply: func(rules: tile-map, input: tile-map, target: option<tile-map>) -> result<tile-map, string>;
```

Input that fails:

- rules from `examples/demo/pipe/edge.rules.map.json`;
- input map with 2 layers;
- each layer `data: list<u32>` length around 18k+;
- default repro uses `168 * 152 = 25536` entries per layer.

Direct ignored test:

```text
automap_component_accepts_structured_tilemaps_without_abi_panic
```

Run:

```bash
cd cmd/app/src-tauri
cargo test automap_component_accepts_structured_tilemaps_without_abi_panic -- --ignored --nocapture
```

Min-size probing used env vars during investigation:

```bash
GAMS_AUTOMAP_REPRO_WIDTH=134 GAMS_AUTOMAP_REPRO_HEIGHT=134 \
  cargo test automap_component_accepts_structured_tilemaps_without_abi_panic -- --ignored --nocapture

GAMS_AUTOMAP_REPRO_WIDTH=135 GAMS_AUTOMAP_REPRO_HEIGHT=135 \
  cargo test automap_component_accepts_structured_tilemaps_without_abi_panic -- --ignored --nocapture
```

Observed:

- `134x134` passed;
- `135x135` failed;
- threshold depends on shape/content, but failure correlates with large nested `list<u32>` in multi-layer record.

## Critical isolation result

Throwaway TinyGo component repro was created under `.scratch/tinygo-list-repro` during investigation, then removed.

It exported:

```wit
echo-u32: func(values: list<u32>) -> list<u32>;
make-u32: func(len: u32) -> list<u32>;
echo-map: func(value: tile-map) -> tile-map;
make-map: func(width: u32, len: u32) -> tile-map;
```

Findings:

- `list<u32> -> list<u32>` alone: OK up to 100k.
- `tile-map` with one layer: OK.
- `tile-map` with two layers, each with large `list<u32>`: fails around `len >= 15581` per layer.
- failure backtrace in repro included symbol names:

```text
panic: runtime error: unsafe.Slice/String: len out of range
main!(go.bytecodealliance.org/cm.list[uint32]).Slice[uint32]
main!scratch/tinygo-list-repro/internal/gams/tinygo-list-repro/repro.wasmexport_EchoMap
```

Meaning: panic happens while TinyGo/WIT binding reads nested `cm.List[uint32]`, before automap algorithm matters.

## Native Go check

Temporary native Go test called `AutomapApplyToTarget` with same large synthetic input.

Result: passed.

Meaning:

```text
automap algorithm OK in native Go
TinyGo/WIT ABI boundary bad
```

## Current diagnosis

Root remaining bug:

```text
TinyGo + go.bytecodealliance.org/cm + wit-bindgen-go ABI bug for nested records containing multiple large list<u32> fields.
```

Not likely:

- Tauri `spawn_blocking` thread issue;
- Wasmtime dep old version;
- automap algorithm logic bug;
- plain large string/list return size issue.

## Recommended next step

Do not patch around TinyGo ABI bug in runtime.

Rewrite `automap.comp` in non-TinyGo component target.

User priority order:

1. Odin
2. C
3. MoonBit
4. Rust

Practical repo tooling currently has C component path support in root `Makefile` via `wit-bindgen c` + `wasm32-wasip2-clang`. Odin/MoonBit tooling not confirmed present. So next practical target: C rewrite/prototype, unless user provides Odin/MoonBit component toolchain.

## Useful commands

Runtime checks:

```bash
cd cmd/app/src-tauri
cargo fmt --check
cargo test --lib runtime::tests::lua_component_runs_script_and_calls_runtime -- --nocapture
cargo test nested_automap_component_trap_does_not_panic_runtime_call_host_task -- --ignored --nocapture
cargo test --lib runtime::tests -- --nocapture --test-threads=1
```

Automap direct failure:

```bash
cd cmd/app/src-tauri
cargo test automap_component_accepts_structured_tilemaps_without_abi_panic -- --ignored --nocapture
```

Automap native Go tests:

```bash
cd plugins/automap.comp
go test ./...
```
