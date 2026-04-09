# Plugin Migration Plan

## Goal
Move GAMS toward a unified plugin architecture where hosts stay thin and application behavior lives behind explicit plugin contracts.

The target direction is:

- plugins call other plugins by name through a shared PDK-style contract
- callers should not need to know whether the target plugin is implemented in WASM or JS
- browser / CLI / native hosts are responsible for loading, placement, routing, and environment bindings
- browser UI concerns should migrate out of special host glue and into JS plugins
- runtime logic should migrate out of view-owned instances and into routed plugins

## Target Architecture

### Two first-class plugin runtimes

#### 1. `wasm` plugins
Run in:
- browser worker, when the host is browser
- WASM runtime in CLI/native hosts

Best suited for:
- core logic
- portable runtime behavior
- processing pipelines
- storage/query engines
- execution services

Examples today:
- `sql`
- `ng`
- `layout` runtime
- image/tile/sprite/data plugins

#### 2. `js` plugins
Run in:
- browser host runtime, typically main thread

Best suited for:
- views/editors
- DOM/UI behavior
- browser-only integrations
- browser-side services like notifications, dialogs, layout shell, focus, clipboard, etc.

Examples of likely target shapes:
- `view.ng`
- `view.sql-console`
- `service.toast`
- `service.dialog`
- `service.layout-shell`

## Core Rule
A plugin should call another plugin by plugin name/id and function name only.

At PDK level, the caller should not care whether the target is:
- WASM or JS
- worker-side or main-thread-side
- built-in or project-defined
- different across hosts or even different per runtime configuration

That choice belongs to the host/runtime registry and routing layer.

## One-Sentence Vision
GAMS should support two first-class plugin runtimes — WASM and JS — both addressable through the same PDK-style call model, with the host responsible only for loading, placement, and routing, while plugins implement application behavior by calling each other through explicit contracts.

## Contract Model
The default interaction model should be request/response plugin calls.

Example:
- `sql.query(...)`
- `layout.split(...)`
- `ng.run(...)`

Calls may also be used for notification-like behavior when the target is a JS/browser plugin.

Example:
- `ng.run({ graph: "x", notifier: "view.ng" })`
- runtime-side code can call the configured notifier plugin during execution
- toast/dialog behavior can also move behind plugin calls instead of special host helpers

Important constraint:
- core runtime behavior must still work when browser-only JS plugins are absent
- JS notifier/view integration is additive, not a hard dependency for core WASM logic

## Host Responsibilities
Hosts should do only the following:

## Runtime Call Model

The browser host should use an asymmetric call model:

- main thread → runtime worker calls are **asynchronous**
- worker-side plugin → plugin calls are intended to be **synchronous** inside the runtime
- worker-side plugin → main-thread view/service calls cross an async bridge, but should present sync semantics to plugins via Atomics-backed coordination

This implies:
- setup/bootstrap for base plugins should live on the worker side
- core/base plugins such as `fs` and `sql` should be initialized in the worker runtime
- main-thread views/services should be registered as callable endpoints on the runtime bridge rather than treated as the canonical plugin host


1. discover and register plugins
2. load WASM and JS plugin implementations
3. place plugins in the right runtime
   - WASM -> worker/runtime
   - JS -> browser host runtime
4. route calls between plugins
   - JS -> JS
   - JS -> WASM
   - WASM -> JS
   - WASM -> WASM
5. provide environment bindings
   - DOM/browser APIs only to JS plugins
   - WASI/PDK/runtime APIs to WASM plugins
6. provide configuration, lifecycle boot, and optional capability lookup

Hosts should not keep accumulating feature-specific logic for graph execution, layout semantics, notifications, dialogs, or view-specific runtime ownership.

## Migration Principles

### 0. Fresh start for the new browser host
`cmd/browser2` should be treated as a fresh-start host.

That means:
- breaking changes are acceptable during early browser2 work
- backwards compatibility with the old browser host is **not** a goal inside browser2
- do not carry legacy naming, compatibility shims, or fallback behavior forward unless they are explicitly chosen as part of the new architecture
- prefer clean contracts and deterministic bootstrap over transitional glue


### 1. Stop spreading view-owned runtimes
New work should avoid direct `pluginManager.load(...)` from browser views as the canonical ownership model for runtime state.

### 2. Prefer explicit plugin contracts over host callbacks
If a plugin needs another capability, it should call that capability through the routing layer instead of depending on an ad-hoc host bridge.

### 3. Treat JS views as plugins, not special cases
A browser-rendered view should be a JS plugin with an explicit identity and callable surface where needed.

### 4. Browser services can also be JS plugins
Not everything browser-side is a view. Toasts, dialogs, layout shell logic, and similar concerns can live as JS service plugins.

### 5. Keep runtime logic portable where possible
WASM plugins should keep their core behavior independent from browser-only JS plugins.

### 6. Migrate in layers
For each priority area:
- define target contract
- add routed path
- adapt current caller/view
- remove legacy direct instance path

## Current Migration Vocabulary
The current plan folders still use migration vocabulary:

- `PLAN/singleton/*.md`
- `PLAN/instance/*.md`
- `PLAN/view/*.md`

This remains useful while refactoring, even though the long-term runtime vocabulary is moving toward:
- implementation runtime: `wasm` / `js`
- role: `service` / `view`
- lifecycle: shared service / document-scoped / legacy instance

## Status Vocabulary

- `done` — already matches the intended model closely enough for now
- `migration-needed` — exists, but should be moved to the target model
- `legacy` — supported temporarily, but should shrink over time
- `requires-clarification` — needs discussion before planning concrete migration steps

## Priority Architecture Targets

### `sql`
Target:
- routed WASM service plugin
- shared contract across browser and CLI

### `ng`
Target:
- routed WASM runtime/service plugin
- browser editor as JS plugin
- optional notifier target, e.g. `ng.run({ graph: "x", notifier: "view.ng" })`

### `layout`
Target:
- routed service contract for layout state/operations
- browser shell / DOM handling moved behind JS plugin boundaries

### notifications / dialogs
Target:
- browser-only concerns exposed through JS service plugins instead of special host globals

## Staged Refactor Plan

### Phase 0 — align target architecture
- [ ] clean up `PLAN/` around WASM + JS plugin model
- [ ] document host responsibilities vs plugin responsibilities
- [ ] define first migration rules for notifier/service calls

### Phase 1 — create fresh browser host entrypoint
- [ ] add `cmd/browser2` as a clean migration host
- [ ] keep server/bootstrap shape aligned with `cmd/browser`
- [ ] start with minimal placeholder UI
- [ ] migrate plugins/views incrementally instead of rewriting everything in-place

### Phase 2 — define common plugin calling shape
- [ ] define how JS plugins are registered and called through the same routing model
- [ ] define how WASM plugins call JS plugins
- [ ] define optional target/config patterns like notifier plugin ids

### Phase 3 — migrate priority services
- [ ] `sql` contract/lifecycle cleanup
- [ ] `ng` service + JS view split
- [ ] `layout` service + JS shell split
- [ ] toast/dialog services as JS plugins

### Phase 4 — migrate views off legacy runtime ownership
- [ ] migrate `view-nodegraph2`
- [ ] migrate layout shell integration
- [ ] migrate `stbte` and `game-runner`
- [ ] remove legacy `pluginManager.load(...)` ownership where replaced

## Current Observations Worth Keeping In Mind

- `sql` is already close to the intended routed-service model.
- `ng` and `layout` already look like important architecture test cases because current code mixes runtime logic with browser ownership.
- Browser views already have a registry, but browser shell/runtime wiring is still inconsistent.
- `cmd/browser2` is a good place to prove the new model incrementally without requiring an all-at-once rewrite of `cmd/browser`.

This plan is intentionally lightweight, but the target direction should now be read as: unify around explicit plugin contracts, with WASM and JS as first-class runtime types and host-specific routing hidden behind the plugin system.
