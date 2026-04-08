# Plugin Migration Plan

## Goal
Unify runtime architecture around `pluginManager` with explicit plugin kinds and a shared vocabulary. The preferred long-term direction is to keep host apps thin and move behavior into plugins that can be swapped per project.

The main design rule for the target architecture is:

- prefer **plugin-to-plugin** calls over special host callbacks
- keep **browser / CLI / native** hosts as thin as possible
- allow **built-in and project-defined** plugins/views to be registered through the same model
- move as much logic as possible toward `singleton` plugins

## Plugin Kinds

### 1. `singleton`
A plugin with one logical process/runtime per host environment.

- Examples: `sql`, `image`, `treegen`, `random`
- Preferred default for new development
- Should be the target shape for most runtime logic
- Can live in worker/browser/native/cli hosts as long as the contract stays stable

### 2. `instance`
A plugin instance created by another plugin or by a browser view.

- Current example pattern: `pluginManager.load(...)` returning a dedicated WASM instance
- Treat as legacy / transitional
- Existing usages can remain while migrating, but new work should avoid expanding this pattern
- Long-term goal is to replace these with `singleton` or `view` plugins plus routed calls/shared state where needed

### 3. `view`
A plugin rendered in the browser UI and managed through `pluginManager` rather than special-case view boot logic.

- Browser-facing
- May expose callable functions to other plugins via the same plugin routing model
- May publish shared state / notifications where needed
- Should migrate from current custom handling to first-class plugin registration

## Strategy

1. Prefer `singleton` plugins for new capabilities.
2. Freeze the spread of new `instance` plugins.
3. Migrate browser-rendered views into `view` plugins registered in `pluginManager`.
4. Replace ad-hoc host bridges with explicit plugin-to-plugin contracts.
5. Allow project-defined plugins/views to override built-in ones through the same registry model.
6. Treat browser-side services such as layout, notifications, and view-facing APIs as first-class plugins instead of special host functions.

## Vocabulary

### plugin routing
A call path where the caller addresses another plugin by name and function, without needing to know whether the target runs in worker, main thread, CLI, or native host.

### browser service plugin
A plugin registered on the browser main thread that can be called through the same plugin manager routing model as worker-side plugins.

### migration target
The intended final shape for a capability, even if the current implementation still uses a legacy path.

### transitional duplicate entries
The same logical capability may appear in more than one plan folder while migrating.

Example:
- `PLAN/instance/ng.md` = current legacy instance usage
- `PLAN/singleton/ng.md` = desired long-term singleton target

This duplication is intentional while the migration is still being discussed and staged.

## Status Vocabulary

- `done` — already matches the intended model closely enough for now
- `migration-needed` — exists, but should be moved to the target model
- `legacy` — supported temporarily, but should shrink over time
- `requires-clarification` — needs discussion before planning concrete migration steps

## Checklist Conventions

- `[ ]` not started
- `[x]` done
- Keep todos short and discussion-friendly
- If details are missing, add `requires clarification`

## Priority Discussion Targets

| Area | Current plan file | Why it matters now |
| --- | --- | --- |
| Node graph runtime | `PLAN/instance/ng.md` | Main-thread freeze and legacy instance-style runtime |
| Node graph browser view | `PLAN/view/view-nodegraph2.md` | High-value browser view migration target |
| Layout service | `PLAN/instance/layout.md`, `PLAN/view/view-layout.md`, `PLAN/singleton/layout.md` | Likely browser service plugin and core routing example |
| SQL | `PLAN/singleton/sql.md` | Important singleton baseline and likely long-term core service |
| Legacy runtime-loaded views | `PLAN/instance/stbte.md`, `PLAN/instance/game.md` | Existing examples of direct `pluginManager.load(...)` usage |

## Current Structure

- `PLAN/singleton/*.md` — singleton plugins and singleton migration targets
- `PLAN/instance/*.md` — legacy instance plugins / current instance-style usages
- `PLAN/view/*.md` — browser view plugins and view migration targets

This plan is intentionally lightweight. Each plugin file is a discussion anchor and can be expanded later with architecture notes, API contracts, and migration steps.