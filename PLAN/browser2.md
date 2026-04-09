# browser2 Migration Host Plan

## Purpose
`cmd/browser2` is the clean browser-host entrypoint for the new plugin architecture.

It should be treated as a fresh-start host:
- breaking changes are acceptable
- backwards compatibility with `cmd/browser` internals is not required
- legacy compatibility shims should not be copied forward by default

It should be used to prove the target model incrementally:
- WASM plugins and JS plugins are both first-class
- plugins call each other through one routed PDK-style contract
- the host stays responsible for loading, placement, routing, and environment bindings only
- browser-specific UI/services migrate out of ad-hoc globals into JS plugins/services

`browser2` is **not** intended to be a quick rewrite of `cmd/browser`.
It is a controlled migration host where we can bring features across in the right order.

---

## Non-Goals For The First Stage
At the beginning, `browser2` does **not** need:
- backwards compatibility layers for old browser bootstrap/config behavior
- full visual parity with `cmd/browser`
- all existing views
- all existing browser shell features
- native embedding integration
- production web packaging

The first goal is to establish the new runtime and bootstrap model correctly.

---

## Core Questions browser2 Must Answer

1. How are JS plugins registered and called?
2. How are WASM plugins registered and called?
3. How does a caller invoke a plugin without caring whether the target is JS or WASM?
4. How does a WASM plugin call a JS plugin through the host?
5. What is the minimal browser bootstrap order needed to get a real app runtime online?
6. How do browser-only services like toast/dialog fit into plugin routing instead of globals?

---

## Phase 1 File Structure

```txt
cmd/browser2/
  app.js

  core/
    setup.js
    bootstrap.js
    runtime.js
    worker-runtime.js

  builtin/
    fs-opfs/
      index.js
      worker-*.js
    fs-webdav/
      index.js
      worker-*.js
```

### Structure Intent

#### `app.js`
Thin entrypoint only.
Responsibilities:
- start browser2
- call setup/bootstrap
- create the runtime singleton
- render minimal placeholder/status UI

#### `core/setup.js`
Worker-side bootstrap setup resolver.
Responsibilities:
- run inside the worker runtime
- return base setup before `fs` is available
- decide which `fs` provider to load first
- after `fs` is enabled, resolve where `sql` should come from
- remain deterministic and override-friendly via bootstrap config passed from main thread

#### `core/bootstrap.js`
Ordered boot sequencing.
Responsibilities:
- run explicit bootstrap phases
- keep phase order readable in one place
- avoid leaking bootstrap flow into `app.js` or `runtime.js`

#### `core/runtime.js`
Main-thread runtime facade + proxy.
Responsibilities:
- own the singleton runtime instance
- expose the small public API: `init`, `register`, `call`
- export `setupResult` after initialization
- create the worker runtime
- register main-thread plugin/view endpoints callable from the worker
- coordinate the bridge between main thread and worker runtime

#### `core/worker-runtime.js`
Actual worker-side plugin runtime.
Responsibilities:
- own worker-side plugin loading and calling
- run `setup.js`
- host core/base plugins like `fs` and later `sql`
- bridge worker calls to registered main-thread plugin/view endpoints

#### `builtin/fs-opfs/` and `builtin/fs-webdav/`
Swappable built-in filesystem providers.
Responsibilities:
- expose the same routed `fs` contract
- hide backend-specific implementation details
- keep backend-specific workers local to each provider

### Phase 1 Goal Of This Structure
This structure is only meant to get the new deterministic bootstrap online.
It does not yet require:
- full view migration
- DB-driven dynamic plugin loading
- native integration
- production packaging

## First Milestone
A minimal but real `browser2` runtime should be able to:

1. boot the host
2. initialize filesystem access
3. load the mandatory `sql` plugin
4. initialize the database / migrations
5. read registry/config state from SQL
6. load additional plugins in declared order
7. load at least one JS-side service/plugin
8. prove one cross-runtime call path
   - JS -> WASM
   - WASM -> JS

That is the first meaningful checkpoint.

---

## Bootstrap Order

## Asymmetric Runtime Mechanism

Browser2 should use an asymmetric runtime bridge:

- `runtime.init()` is called once on the main thread
- `runtime.call(pluginId, method, input)` from the main thread is async
- `runtime.register(...)` registers main-thread endpoints
- worker-side setup and plugin loading happen inside `core/worker-runtime.js`
- worker-side plugins should eventually see sync plugin-call semantics
- calls from worker-side plugins to main-thread views/services cross an async bridge, but are planned to use Atomics-backed synchronization for plugin-side sync behavior

This means:
- `setup.js` belongs on the worker side
- `fs` belongs on the worker side
- `sql` belongs on the worker side
- view/main-thread plugins should be registered as endpoints through `runtime.register(...)`
- `setup-view.js` should configure view-side/bootstrap-side main-thread plugins separately


### Stage 0 — host boot
The browser host starts the runtime proxy, which creates the worker runtime/router.

Needed pieces:
- plugin registry abstraction
- runtime placement rules
- JS plugin loader
- WASM plugin loader
- cross-runtime call router
- environment bindings for each runtime type

Output of this stage:
- a host that can register/call plugins, even if only a tiny built-in set exists at first

### Stage 1 — filesystem (`fs`) first
Filesystem should be the first mandatory capability in the worker runtime.

Reason:
- later bootstrap depends on reading/writing persistent state
- SQL binary load/save depends on it
- plugin/view discovery may depend on it later

Expected shape:
- `fs` is available immediately after host boot
- browser host provides the concrete backend integration
- plugin callers see it as a normal plugin contract

Questions to settle:
- how worker-side JS plugins are normalized relative to WASM plugins
- what the minimal contract is for bootstrap (`exists`, `read`, `write`, maybe `readdir`, `mkdir`)
- how worker-side sync call semantics will be finalized across JS and WASM plugins

Recommendation for first implementation:
- keep `fs` as the first built-in/mandatory routed capability in the worker runtime
- make it callable through the same plugin call path as normal plugins
- define provider selection in `core/setup.js`
- pass bootstrap config from main thread to worker setup
- avoid legacy fallback keys or compatibility behavior in the new host

### Stage 2 — `sql` second
After `fs`, load `sql` as the first mandatory WASM plugin.

Reason:
- it is the current source of registry/config/migration state
- it already behaves like a routed service
- much of the current bootstrap expects SQL-backed registries

Expected shape:
- host loads `sql` before reading plugin/view registries
- `sql` becomes the first real proof of browser2 WASM plugin loading
- browser2 can then run DB initialization/migrations using only `fs` + `sql`

Minimum success condition:
- `browser2` can call `sql.open`
- load/save database binary through `fs`
- run migrations
- query seeded registry tables

### Stage 3 — migrations / database initialization
Once `fs` + `sql` are live:
- open database
- load binary DB if present
- otherwise run migrations
- ensure schema/version tracking exists
- save DB when needed

At this stage, the current migration system can be reused conceptually, even if implementation moves.

Important design point:
- migration logic itself does not need to be host-specific app glue forever
- but for the first `browser2` milestone it is acceptable to keep migration orchestration in browser bootstrap code

### Stage 4 — plugin registry loading
After SQL is ready:
- query plugin registry
- resolve runtime type / placement
- load plugins in deterministic order

Needed additions compared with current `cmd/browser`:
- registry likely needs to know more than name/url
- runtime kind should become explicit (`wasm` / `js`)
- browser-only JS services/plugins should be registrable alongside WASM plugins
- mandatory/built-in plugins may still be bootstrapped before DB-driven loading

### Stage 5 — JS service/plugin loading
Before full views, load one or more small JS plugins/services to prove the model.

Best first candidates:
- `service.toast`
- `service.dialog`
- a tiny test plugin like `view.debug` or `service.echo`

Why:
- small surface area
- proves JS plugin registration/calls
- proves that browser-only concerns can move behind plugin contracts

### Stage 6 — first vertical integration slice
After basic runtime exists, migrate one small but real end-to-end feature.

Suggested order:
1. `service.toast`
2. `service.dialog`
3. one debug/test JS plugin callable from host and WASM
4. then larger targets like `ng` or `layout`

---

## Components That Need To Exist In browser2

### 1. unified registry model
The host needs one registry model that can represent:
- built-in mandatory capabilities
- WASM plugins
- JS plugins
- maybe later views as a JS-plugin subtype/role

Minimum fields likely needed:
- plugin id/name
- runtime kind: `wasm` or `js`
- role: service/view/other
- source/url/module info
- load timing / phase
- enabled flag
- scope/host constraints if needed

### 2. JS plugin registration/call contract
We need a concrete answer for how a JS plugin looks to the router.

Minimum requirements:
- stable plugin id
- named callable functions
- async-friendly call interface
- same conceptual request/response contract as PDK calls
- a place for lifecycle hooks if needed

Open question:
- exact PDK ABI compatibility vs same logical call model

Recommendation:
- same logical call contract first
- keep implementation ergonomic in JS

### 3. WASM plugin call bridge
We need the same ability current browser host approximates today, but generalized.

Meaning:
- a WASM plugin must be able to call any routed plugin by id/function
- target may be JS or WASM
- host/router handles dispatch

This is the core proof point of the new architecture.

### 4. built-in mandatory capabilities
For first boot we should explicitly allow a small built-in set:
- `fs`
- maybe internal host/router service if needed
- `sql` loaded immediately after `fs`

### 5. deterministic bootstrap phases
`browser2` should keep boot stages simple and explicit.

Recommended early phases:
1. host/router init
2. built-in `fs`
3. mandatory `sql`
4. DB/migrations
5. registry-driven plugin loading
6. registry-driven JS service/view loading
7. app-ready signal

---

## Migration Topics / Work Breakdown

### Topic A — host/router foundation
Need to migrate or rebuild:
- base plugin router
- runtime placement rules
- cross-runtime call bridge
- minimal error/reporting behavior

Deliverable:
- a host that can call registered JS and WASM plugins uniformly

### Topic B — filesystem bootstrap
Need to migrate or define:
- OPFS/WebDAV selection
- browser2 `fs` call surface
- startup configuration handling
- persistence guarantees needed by SQL bootstrap

Deliverable:
- `fs` works as the first mandatory routed capability

### Topic C — SQL bootstrap
Need to migrate:
- mandatory `sql` load in browser worker/runtime
- open/load/save DB path
- migration manager integration or replacement
- schema bootstrap

Deliverable:
- browser2 boots into a queryable SQL-backed registry state

### Topic D — registry redesign
Need to define:
- how JS plugins are represented in registry
- how WASM plugins are represented in registry
- whether views stay in a separate registry or become a plugin role in one registry

Open question:
- separate tables during migration vs one unified registry later

Recommendation:
- allow migration with separate registries initially if it speeds progress
- but document unified target clearly

### Topic E — browser-only service migration
Need to identify browser globals/ad-hoc helpers that should become JS plugins/services:
- toast
- dialog/popup
- maybe layout shell pieces
- maybe keybinding/focus services later

Deliverable:
- at least one browser-only service callable through plugin routing

### Topic F — first feature migration pattern
Need one agreed migration recipe:
1. define plugin/service contract
2. add routed implementation in browser2
3. adapt one caller
4. verify JS <-> WASM calls
5. remove special-case glue only after new path works

This pattern should be documented and reused for `ng`, `layout`, `game`, `stbte`, etc.

---

## Suggested First Concrete Implementation Order

### Step 1
Keep `cmd/browser2/server.go` minimal and stable.

### Step 2
Create browser2 host bootstrap with no real app UI yet.

### Step 3
Bring up routed `fs` first.

### Step 4
Bring up mandatory `sql` second.

### Step 5
Run migrations and prove DB-backed registry loading.

### Step 6
Load one tiny JS service plugin, preferably `service.toast` or `service.echo`.

### Step 7
Prove a cross-runtime call:
- JS host/plugin calls WASM plugin
- WASM plugin calls JS service/plugin

### Step 8
Only after that, choose the first larger migration target:
- likely `ng`
- maybe `layout`

---

## Open Design Questions

### 1. Is `fs` a true plugin or a host-built-in routed capability?
Early answer can be pragmatic, but it should still use the same call path from the caller perspective.

### 2. Should JS views and JS services share one registry?
Likely yes in the long term, with role metadata.

### 3. Do we keep separate plugin and view tables during migration?
Probably acceptable short-term if it reduces risk.

### 4. How do optional callback/notifier targets behave?
Example:
- `ng.run({ graph: "x", notifier: "view.ng" })`

Need rules for:
- missing target
- no-op behavior
- error handling
- capability discovery

### 5. What is the minimum lifecycle API for JS plugins?
Need to decide whether we need hooks like:
- register
- init
- mount/unmount
- dispose
or whether callable functions are enough for the first stage.

---

## Current Minimal Implementation

Implemented first scaffolding in `cmd/browser2/`:
- `app.js` calls the singleton runtime `init()` and then uses the public runtime facade
- `core/runtime.js` bridges async main-thread calls into the worker runtime and allows registration of main-thread plugin/view endpoints
- `core/worker-runtime.js` owns the actual worker-side runtime and runs `setup.js`
- `core/setup.js` now runs in the worker and owns the first staged setup flow:
  - resolve initial `fs` provider from bootstrap config
  - load selected `fs` plugin in the worker runtime
  - query post-`fs` next-step info
- `builtin/fs-opfs/index.js` exists as the first real JS plugin provider with copied sync worker/Atomics-backed filesystem behavior
- `builtin/fs-webdav/index.js` exists as a second filesystem provider using the same API shape and worker pattern
- `core/bootstrap.js` and `core/worker-runtime.js` exist as phase-1 scaffolding

Current phase-1 behavior:
- `browser.fs` in localStorage can select `fs.opfs` or `fs.webdav`
- browser2 is intentionally using fresh config keys and fresh bootstrap behavior rather than compatibility shims
- main thread passes bootstrap config into the worker runtime
- worker-side setup loads `fs` first and exposes it through capability alias `fs`
- `fs` already follows the copied browser filesystem API shape (`read`, `write`, `remove`, `exists`, `list`, `mkdir`, `rmdir`, `stat`)
- provider implementations use `SharedArrayBuffer` + `Atomics` + dedicated workers for sync semantics
- `setup-view.js` now registers mock main-thread plugin/view endpoints for worker-side calls
- the first Atomics-backed worker → main-thread synchronous bridge path now exists for plugin-side calls into registered main-thread endpoints
- the same `runtime.call` host-module shape can now be invoked directly from main thread for bridge emulation/testing
- worker-side setup now loads `sql.default`, exposes it through capability alias `sql`, and calls `sql.open()`
- a debug `echo` WASM plugin is available to exercise main → worker → WASM → main flow
- migrations and DB restore/load are the next step after SQL bootstrap

## Recommended Immediate Next Tasks
- [x] define browser2 bootstrap file structure
- [x] create first minimal JS plugin runtime scaffold
- [x] create first staged `setup.js` flow for `fs`
- [x] define minimal built-in `fs` contract for bootstrap
- [x] wire mandatory `sql` load after `fs` in the worker runtime
- [ ] adapt or reimplement migration bootstrap on top of `fs` + `sql`
- [x] prove one JS service/plugin endpoint call path
- [ ] document first end-to-end migration recipe

---

## Success Criteria For Early browser2
`browser2` is successful early if it can:
- boot with explicit phases
- expose `fs` through routed calls
- load `sql`
- initialize and query the database
- load at least one JS plugin/service
- prove at least one WASM -> JS call path
- do all that without reintroducing special-case feature-specific host glue
