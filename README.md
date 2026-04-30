# GAMS - Game Asset Management System

GAMS (Game Asset Management System) is a browser-based tooling workbench for game assets, similar in spirit to a CMS but focused on game development workflows.
It combines a modular UI (views), a runtime WebAssembly plugin system, SQLite-backed state, and integrated file access so you can manage, transform, and test assets without leaving the tool.

## What It Includes

- Browser IDE shell served from `cmd/browser/`
- Dynamic WASM plugin loading (Go, C, Zig, Odin)
- SQL-first runtime state and configuration via the `sql` plugin
- File system abstraction with OPFS and WebDAV backends
- Built-in views for node graphs, files, tilemap tooling, SQL tables/console, settings, and AI assistance
- Pipeline-oriented workflow with mounted demo assets and example pipelines

## Key Capabilities

- **Integrated game runner**: test assets directly in a running game context without switching tools.
- **SQLite support**: structured local data storage for settings, registries, pipelines, and asset metadata.
- **Flexible filesystem layer**:
  - **OPFS (Origin Private File System)**: browser-native persistent storage scoped to your app origin; fast and local-first.
  - **WebDAV**: network filesystem protocol over HTTP; useful for working with remote/shared storage from the same UI.

## Architecture At A Glance

- **Frontend app**: `cmd/browser/app.js` boots the theme, filesystem provider, plugin runtime, and default layout
- **Plugin runtime**: `cmd/browser/core/` handles plugin calls, worker orchestration, filesystem mounts, and host bridges
- **Views/widgets**: `cmd/browser/views/` and `cmd/browser/widgets/` provide the browser UI surface
- **Bootstrap config**: `cmd/browser/core/gams.json` defines built-in mounts and first-party plugin registrations
- **WASM outputs**: compiled to `build.nosync/plugins/*.wasm`

## Requirements

For full local development/build:

- Go (see `go.mod` for version)
- GNU Make
- TinyGo (for Go-based WASM plugins)
- Zig (for C/Zig-based WASM plugins)
- Odin (for Odin-based WASM plugins)

## Quick Start

```bash
make browser-run
```

Then open:

- `http://localhost:8080`

This command compiles plugins, builds the browser server, and starts the local IDE.

## Common Commands

```bash
# Build plugins only
make plugins-release

# Build browser server + plugins
make browser

# Run local browser IDE server
make browser-run

# Run the Wails desktop wrapper
make native-dev

# Build the Wails desktop wrapper
make native-build

# Create production-ready web folder in build.nosync/web
make web

# Clean build artifacts
make clean
```

## Repository Layout

- `cmd/browser/` - browser application, core runtime, views, widgets, themes, and demo assets
- `cmd/native/` - Wails desktop wrapper around the browser application
- `plugins/` - WASM plugins in mixed languages (Go/C/Zig/Odin)
- `pkg/` - shared Go packages (tilemap, tree, utilities, qoi)
- `tools/` - standalone helper tools (for example `opr-import`)
- `example/` - sample resources and test assets
- `NOTES.md` - personal/experimental notes backlog

## Native Wrapper

The desktop app lives in `cmd/native/` and embeds the existing browser shell from `cmd/browser/` together with the built WASM plugins from `build.nosync/plugins/`.

Use:

```bash
make native-dev
make native-dev-inspector
make native-build
make native-build-debug
```

Both targets build plugins first. The Wails app keeps the current browser storage model, so OPFS and WebDAV continue to work unchanged inside the desktop webview.

On macOS, the native targets explicitly use the Xcode toolchain via `xcrun` for `clang`, `clang++`, and `SDKROOT`, which avoids linker issues when the shell default compiler comes from another toolchain manager.

The desktop wrapper also serves the app from a fixed loopback origin instead of Wails' custom `wails://` origin, because the plugin runtime needs `SharedArrayBuffer` and cross-origin isolation. If that port is already in use, override it with `GAMS_NATIVE_ADDR`, for example `GAMS_NATIVE_ADDR=127.0.0.1:39473 make native-dev`.

If the desktop app gets stuck during boot, use `make native-dev-inspector` to start it with the Web Inspector open on launch, or `make native-build-debug` for a packaged debug build. The app menu now includes `View -> Reload` on `Cmd+R` and `View -> Open Inspector` on `Cmd+Option+I`, so you can refresh the app and reopen the inspector after closing it. Boot-time JS errors also surface on the splash screen in a small diagnostics panel.

## Notes

Idea backlog and exploratory links live in `NOTES.md`.
