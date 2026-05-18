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
- `CONTEXT-MAP.md` — multi-context domain glossary index for GAMS.
- `CONTEXT.md` — root overview pointing at context-specific glossaries.
- `docs/README.md` — current documentation architecture and legacy conversion workflow.
- `docs/prd/` — current requirements and migration slices.
- `docs/adr/` — accepted architectural decisions.
- `docs/ideas/` — pre-decision idea inbox, including Yoinking records for competitive inspiration.
- `docs/legacy/INDEX.md` — inventory and conversion queue for archived markdown moved from original repo paths.

## Current Priority Areas
- Runtime / Plugin Manager migration (`docs/prd/0002-runtime-plugin-manager.md`)
- Project Config v1 (`docs/prd/0003-project-config.md`)
- Project Unit conversion planning, one focused PRD/ADR session per unit when needed

## Guidance For AI Agents
- Before proposing architecture changes, read `CONTEXT-MAP.md`, the relevant context glossary, and current PRDs/ADRs for that area. Use `docs/legacy/INDEX.md` only to find unconverted source material.
- When discussing a plugin, check whether it already has a legacy file under `docs/legacy/docs/PLAN/` or `docs/legacy/plugins/`.
- Prefer converting legacy planning notes into clear PRDs/ADRs with migration targets instead of extending archived documents.
- For documentation conversion, use the `grill-with-docs` style loop: read the legacy docs and nearby code, resolve glossary terms into the relevant context `CONTEXT.md` listed by `CONTEXT-MAP.md`, ask one sharp question at a time for ambiguity, write/update a focused PRD, and create ADRs only for hard-to-reverse trade-off decisions.
- For external inspiration, use project-local skill `.pi/skills/yoinking/SKILL.md` to create Yoinking records under `docs/ideas/yoinking/`; do not treat them as implementation decisions until converted through `grill-with-docs`.
- Treat `cmd/browser` as a fresh-start host: breaking changes are acceptable there and backwards-compatibility shims should not be introduced unless explicitly planned.
- For browser planning/work, prefer worker-side setup/bootstrap for base plugins and document any main-thread bridge assumptions explicitly.
- Browser/base/theme CSS relies on semantic meaning of HTML tags in the current browser UI. Preserve the original HTML structure/tags as much as possible instead of replacing them with arbitrary wrappers; tag choice is part of the styling contract here, even when it differs from conventional HTML semantics.
- For Core View development, follow `docs/reference/gams-view-development-guide.md`. Core Views are official GAMS-supported views and must use the documented semantic UI vocabulary so themes can style them consistently.
- Browser/internal app code should use a **strict fail-fast style**. Do not add graceful fallbacks, defensive optional behavior, best-effort recovery, or silent defaulting for required internal data/config/state. If required data is missing or malformed, treat it as a bug and fail loudly.
- In particular for first-party browser JS/plugins/views: do not write code like "if config is missing, continue with {}", broad `try/catch` that hides invariant violations, optional chaining for elements/state that must exist, or fallback parsing paths that silently accept invalid internal data. Required values should be assumed present and should throw immediately when violated.
- Reserve structured error returns / recoverable handling for true runtime outcomes that are expected as part of agent/tool/model behavior, not for internal wiring/config bugs.
- If a plugin’s target shape is unclear, mark it as **requires clarification** instead of over-specifying.
- Use the root Nix flake / direnv environment for repository tooling. Run `direnv allow` once, then prefer commands like `make app-check`, `make app-run`, `make app-build-release`, and `make app-bundle-release` from the loaded environment. Without direnv, use `nix develop --command make app-check` (or the corresponding make target). Tauri/Cargo output is placed under top-level `$(TAURI_APP_TARGET_DIR)` / `build.nosync/app/target` by default.

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-role label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout: start at root `CONTEXT-MAP.md`, then read the relevant context `CONTEXT.md`, PRDs, and ADRs. See `docs/agents/domain.md`.
