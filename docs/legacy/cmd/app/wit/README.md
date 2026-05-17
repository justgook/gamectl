# cmd/app WIT

This folder is the Tauri app host WIT workspace.

- First-party runtime WIT source: `/wit/runtime/package.wit`
- App host declaration: `app.wit`
- Fetched dependencies: `wit/deps/`
- WKG config/lock: `../wkg.toml`, `../wkg.lock`

Fetch/update deps from `cmd/app`:

```sh
wkg wit fetch
```

`wkg.toml` overrides `gams:runtime` to the repository-local `/wit/runtime` package and fetches registry packages such as `wasi:filesystem` into `cmd/app/wit/deps`.

The current Rust bootstrap uses `wasmtime_wasi::p2::add_to_linker_sync` as the predefined WASIp2 implementation, so filesystem WIT is real and resolvable here but not generated into Rust yet.
