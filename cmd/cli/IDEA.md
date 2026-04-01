# CLI Runtime Idea

## Goal

Add a third target at `cmd/cli` for a headless `gams` runtime.

This target should run the same core application model as the browser/native targets, but without any UI or view loading. Its main purpose is to run plugins from the command line, bootstrap the same database state, and serve as a real-world testbed for the `wpm` SDK/runtime.

## Naming

- Use `gams`, not `gamectl`
- Use `GAMS_` environment variable names only
- `gamectl` naming is considered legacy

## High-Level Direction

The current runtime split is:

- `cmd/browser` contains the real app runtime today
- `cmd/native` is a Wails wrapper around the browser runtime
- `cmd/cli` should become the first real Go-hosted runtime for the plugin system

The CLI should:

- use `cobra` for commands
- use `viper` for config loading and env binding
- use `pkg/wasmhost` as the repo-local runtime package
- reuse and improve `github.com/justgook/wpm` SDK where needed
- load and run only non-view plugins for now

## Why This Exists

The CLI is not only another entrypoint. It is intended to battle-test the Go SDK/runtime side of `wpm` in a real application.

That means:

- avoid building a second unrelated runtime directly in this repo
- prefer making `pkg/wasmhost` a thin app-facing layer over `wpm/sdk`
- if gaps are found, improve `wpm` and consume those improvements here

## Current Architecture Notes

Observed from the current repo:

- `cmd/native` embeds and serves `cmd/browser` plus `build.nosync/plugins/*.wasm`
- actual plugin execution currently happens in browser JavaScript
- filesystem host functions currently live in the browser plugin manager worker
- database bootstrap and migrations currently live in browser JavaScript
- plugin registry already distinguishes `global` and `view` scopes

Implication:

- `cmd/cli` cannot be a thin wrapper like `cmd/native`
- it needs its own Go-hosted wasm runtime and bootstrap flow

## Runtime Package

Use `pkg/wasmhost`.

Responsibilities:

- wrap `wpm/sdk`
- initialize the wasm runtime
- register host functions
- load wasm modules from configured paths
- expose plugin call helpers to the CLI layer
- preserve plugin-to-plugin calling behavior
- keep app-specific logic here, not inside generic SDK code

Non-goals for `pkg/wasmhost`:

- not a second ABI implementation if `wpm/sdk` can do the job
- not a UI/view loader

## Plugin Scope Policy

For the initial CLI version:

- load only plugins with `scope = 'global'`
- ignore plugins with `scope = 'view'`

This is intentional and temporary.

Future direction:

- add a mechanism to load and drive view plugins from the CLI
- possibly through a scripting layer
- Lua is one possible option already under consideration
- a target example for this later work is the `ng` plugin

## Config Model

The CLI should follow 12-factor style configuration:

- defaults
- config file
- environment variables
- flags

Config formats should be whatever `viper` supports, such as:

- YAML
- JSON
- TOML
- others supported by `viper`

All paths should come from config, including migrations.

Suggested shape:

```yaml
paths:
  plugins: build.nosync/plugins
  migrations: cmd/browser/data/migrations
  database: database.sqlite
  workdir: .

runtime:
  load_global_plugins: true
  save_database_on_exit: true

logging:
  level: info
```

Suggested environment names:

- `GAMS_PATHS_PLUGINS`
- `GAMS_PATHS_MIGRATIONS`
- `GAMS_PATHS_DATABASE`
- `GAMS_PATHS_WORKDIR`
- `GAMS_RUNTIME_LOAD_GLOBAL_PLUGINS`
- `GAMS_RUNTIME_SAVE_DATABASE_ON_EXIT`
- `GAMS_LOGGING_LEVEL`

## Database Bootstrap Requirements

The CLI must handle database bootstrap itself in Go.

Important rule:

- check whether the configured `database.sqlite` file exists before migration

Desired flow:

1. start wasm runtime
2. register host functions
3. load `sql.wasm`
4. open database via the SQL plugin
5. check whether configured database file exists
6. if it exists, load it
7. ensure `schema_version` exists
8. load migration index from configured migrations path
9. apply pending migrations only
10. save database when needed

The migrations path must be configurable and not hardcoded.

## Migration Source

The CLI should reuse the same migration assets already used by the browser app.

That means reusing:

- `cmd/browser/data/migrations/index.json`
- `cmd/browser/data/migrations/*.sql`

Reason:

- avoid schema drift between browser/native and CLI
- keep plugin/view registry and seeded data aligned

## Host Function Surface

Initial host functions should mirror the current browser worker surface as closely as useful.

Minimum expected modules/functions:

- `host.log`
- `fs.read`
- `fs.write`
- `fs.delete`
- `fs.exists`
- `fs.list`
- `fs.mkdir`
- `fs.rmdir`
- `fs.stat`

This should be enough to bootstrap the SQL plugin and support current global plugins.

## Initial CLI Commands

Initial command surface should stay small and prove the runtime first.

Candidate commands:

- `gams run <plugin> <function>`
- `gams plugins list`
- `gams db migrate`
- `gams config show`

The first milestone is not rich workflows. The first milestone is a correct reusable runtime.

## Input Modes To Decide Later

Still open for the first `run` command:

- raw string input
- file input
- stdin
- or support all three from the start

## Build And Repo Integration

Likely repo work:

- create `cmd/cli`
- add `cmd/cli/go.mod`
- wire Make targets for CLI build/run
- update README once the target is real

Potential later improvement:

- create a smaller shared embed package for CLI/native runtime assets if embedding is needed

## Risks And Constraints

Main technical risk:

- ensuring `wpm/sdk` matches the runtime behavior needed by the existing plugins

Areas to verify:

- WASI support needed by `sql.wasm`
- plugin-to-plugin calls
- multi-module load behavior and ordering
- compatibility with current ABI expectations from `pdk`
- filesystem path semantics in a native CLI environment

## Recommended Implementation Order

1. scaffold `cmd/cli` with Cobra and Viper
2. add config loading and `gams config show`
3. implement `pkg/wasmhost` on top of `wpm/sdk`
4. prove `sql.wasm` can load and open
5. implement database existence check and binary load/save
6. implement migration runner using configured migrations path
7. load enabled global plugins from DB registry
8. implement `gams run <plugin> <function>`
9. add tests around DB bootstrap and representative plugin calls

## Summary

`cmd/cli` should become a headless `gams` runtime that:

- shares the same plugin and database model as the browser/native app
- ignores view plugins for now
- uses `pkg/wasmhost`
- reuses and hardens `wpm/sdk`
- is configured entirely through 12-factor style config and `GAMS_` env vars
- checks for an existing database file before applying migrations

This document is the baseline for future implementation work.
