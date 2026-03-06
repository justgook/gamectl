# GAMS - Game Asset Management System

GAMS (Game Asset Management System) is a browser-based tooling workbench for game assets, similar in spirit to a CMS but focused on game development workflows.
It combines a modular UI (views), a runtime WebAssembly plugin system, SQLite-backed state, and integrated file access so you can manage, transform, and test assets without leaving the tool.

## What It Includes

- Browser IDE shell served from `cmd/browser/`
- Dynamic WASM plugin loading (Go, C, Zig, Odin)
- SQL-first runtime state and configuration via the `sql` plugin
- Built-in game runner view to test assets directly in-game from inside GAMS
- File system abstraction with OPFS and WebDAV backends
- Built-in views for node graphs, files, tilemap/sprite tooling, SQL tables/console, settings, and game runner
- Pipeline-oriented workflow with seeded example pipelines

## Key Capabilities

- **Integrated game runner**: test assets directly in a running game context without switching tools.
- **SQLite support**: structured local data storage for settings, registries, pipelines, and asset metadata.
- **Flexible filesystem layer**:
  - **OPFS (Origin Private File System)**: browser-native persistent storage scoped to your app origin; fast and local-first.
  - **WebDAV**: network filesystem protocol over HTTP; useful for working with remote/shared storage from the same UI.

## Architecture At A Glance

- **Frontend app**: `cmd/browser/app.js` boots in phases (filesystem, DB migrations, plugins, then views)
- **Plugin runtime**: `cmd/browser/systems/plugin-manager/` handles plugin calls and worker orchestration
- **View loader**: `cmd/browser/systems/view-loader.js` loads enabled views from registry
- **Registry + persistence**: SQL migrations in `cmd/browser/data/migrations/` define plugin/view registries, settings, and seeded data
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

# Create production-ready web folder in build.nosync/web
make web

# Clean build artifacts
make clean
```

## Repository Layout

- `cmd/browser/` - browser application, views, systems, migrations, static assets
- `plugins/` - WASM plugins in mixed languages (Go/C/Zig/Odin)
- `pkg/` - shared Go packages (tilemap, tree, utilities, qoi)
- `tools/` - standalone helper tools (for example `opr-import`)
- `example/` - sample resources and test assets
- `NOTES.md` - personal/experimental notes backlog

## Notes

Idea backlog and exploratory links live in `NOTES.md`.
