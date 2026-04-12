# AGENTS

This repository is **GAMS** — **Game Assets Management Tool** — a CMS for games, currently living in the `gamectl` repo.

## What GAMS Is
GAMS is a plugin-driven CMS/toolkit for managing game assets, game data, and related workflows. It has a browser UI, a CLI, and potentially other hosts, but the long-term goal is that most behavior lives in plugins instead of host-specific code.

In practice, the repo contains:
- WASM plugins for data processing, generation, storage, image/tile/sprite work, and runtime utilities
- browser views/editors for working with those plugins visually
- a `pluginManager` that routes calls between plugins

## How It Works
- Plugins expose callable functions.
- Hosts such as browser or CLI load/register plugins and provide the runtime shell.
- Browser views are being migrated from special-case handling into first-class plugins too.
- The main architectural direction is to let plugins call other plugins through stable contracts, instead of relying on ad-hoc host callbacks.

This repository is moving toward a unified `pluginManager` architecture.

## Core Direction
- Prefer **plugin-to-plugin** calls over special host callbacks.
- Keep **browser / CLI / native** hosts thin.
- Support **built-in and project-defined** plugins/views through the same registration model.
- Prefer **`singleton`** plugins for new work.
- Treat **`instance`** plugins as legacy / migration-only.
- Migrate browser-rendered views into first-class **`view`** plugins managed by `pluginManager`.

## Plugin Vocabulary
- **`singleton`**: one logical runtime per host environment; preferred target model.
- **`instance`**: plugin created by another plugin/view; legacy pattern to phase out.
- **`view`**: browser-rendered plugin that should be registered and routed through `pluginManager`.

## Important Planning Files
- `PLAN/PLAN.md` — overall strategy, vocabulary, and priority migration targets.
- `PLAN/singleton/*.md` — singleton plugins and singleton migration targets.
- `PLAN/instance/*.md` — legacy instance usages.
- `PLAN/view/*.md` — browser view migration targets.

## Current Priority Areas
- `ng` runtime / `view-nodegraph2`
- `layout`
- `sql`
- `cmd/browser2` worker-side runtime/bootstrap
- legacy `pluginManager.load(...)` view runtimes

## Guidance For AI Agents
- Read `PLAN/PLAN.md` before proposing architecture changes.
- When discussing a plugin, check whether it already has a file under `PLAN/`.
- Prefer updating planning docs with clear migration targets instead of assuming unfinished details.
- Treat `cmd/browser2` as a fresh-start host: breaking changes are acceptable there and backwards-compatibility shims should not be introduced unless explicitly planned.
- For browser2 planning/work, prefer worker-side setup/bootstrap for base plugins and document any main-thread bridge assumptions explicitly.
- For browser2 internal plugin↔ui shared-memory designs, prefer direct ownership by the participating plugin/view pair over runtime-managed mirrored state when possible. In particular, if a WASM plugin already has a suitable in-memory state layout, prefer sharing that linear memory directly with the UI instead of adding runtime-owned copy layers, headers, or protocol versioning unless there is a concrete need.
- Do not add API/protocol versioning or compatibility structure to internal first-party browser2 communication unless there is a real migration/interoperability requirement; browser2 is a fresh-start host owned as one codebase and can evolve in lockstep.
- Browser/base/theme CSS relies on semantic meaning of HTML tags in the existing browser UI. When migrating views from `cmd/browser` to `cmd/browser2`, preserve the original HTML structure/tags as much as possible instead of replacing them with arbitrary wrappers; tag choice is part of the styling contract here, even when it differs from conventional HTML semantics.
- For `cmd/browser2` view/UI work, follow `cmd/browser2/VIEW_RULES.md`. Treat it as the canonical ruleset for allowed elements, attributes, slots, and UI structure. Update it during development whenever the browser2 UI vocabulary/rules are clarified or extended.
- If a plugin’s target shape is unclear, mark it as **requires clarification** instead of over-specifying.
