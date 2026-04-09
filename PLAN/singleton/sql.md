# sql

- kind: `singleton`
- status: `requires-clarification`
- source: `plugins/sql`

## Description
Core storage/service candidate and the clearest current example of the preferred singleton direction.

## Current Observations
- Browser worker boot loads `sql` in phase 1 before the rest of the plugin registry is loaded.
- Browser views already treat it like a routed shared service via `window.pluginManager.call('sql', ...)`.
- CLI code also starts `sql` directly as a named runtime, which suggests the host-facing identity is already stable.
- The plugin exports a small command surface: `open`, `exec`, `query`, `dump`, `backup`, `load`, `restore`, `save_binary`, `load_binary`, `close`, `info`, `mem_stats`.

## Clarifications
- The likely target is **not** a view-local runtime. `sql` already behaves like a process-wide service per host.
- The main migration question is less about plugin kind and more about **contract/lifecycle**: when the database is opened, how long it lives, and how project-defined alternatives should override it.
- Other plugins/views should continue to rely on routed calls, not direct host-side SQLite knowledge.

## Notes
- This is a good reference plugin for the intended `singleton` direction.
- Even if implementation details change later, keeping a stable plugin contract here is strategically important.
- Browser and CLI should converge on the same logical contract even if boot order differs.

## Open Questions
- Is `open`/`close` intended to manage one global logical database per host, or should the long-term contract support named databases/sessions?
- Should browser-side persistence policy stay inside `sql`, or be delegated to separate storage plugins/services?
- What is the supported override story for project-defined SQL backends that still need to satisfy current views?

## Todo
- [ ] confirm whether `sql` already fits the singleton target model closely enough
- [ ] document current API surface and guarantees expected by other plugins/views
- [ ] decide whether browser/main-thread access should be routed only through plugin manager
- [ ] identify any migration needed for project-defined alternative SQL backends
- [ ] requires clarification
