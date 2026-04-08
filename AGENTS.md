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
- legacy `pluginManager.load(...)` view runtimes

## Guidance For AI Agents
- Read `PLAN/PLAN.md` before proposing architecture changes.
- When discussing a plugin, check whether it already has a file under `PLAN/`.
- Prefer updating planning docs with clear migration targets instead of assuming unfinished details.
- If a plugin’s target shape is unclear, mark it as **requires clarification** instead of over-specifying.
