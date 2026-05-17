# game2

Odin game/plugin prototype used by GAMS.

## Editor Setup

This directory includes repo-local `ols.json` and `odinfmt.json` files for Odin tooling.

- Default OLS profile is `mac_native`, which matches local native development on macOS arm64 and the `make native` flow.
- Switch OLS to the `wasm` profile when working on the browser/plugin build (`main_wasm.odin`, `host/host_wasm.odin`) or when you want diagnostics closer to the `freestanding_wasm32` target used for `build.nosync/plugins/game2.wasm`.
- `odinfmt.json` sets the local formatting rules used for this package.

## Common Commands

```bash
make native
make native-run
make plugin
make web
make lint
```
