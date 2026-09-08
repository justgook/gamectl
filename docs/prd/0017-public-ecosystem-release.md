# Public ecosystem release and repository extraction

## Status

Draft — overall direction and incremental launch gate confirmed; repository boundaries and implementation details require clarification.

## Source material

- Publication planning conversation: move GAMS into `https://github.com/kkgams`, split Project Units into repositories, and distribute the main engine independently.
- `CONTEXT-MAP.md`
- `docs/contexts/core-runtime/CONTEXT.md`
- `docs/contexts/project-composition/CONTEXT.md`
- `docs/prd/0002-runtime-plugin-manager.md`
- `docs/prd/0003-project-config.md`
- `docs/prd/0015-public-showcase.md`
- `docs/prd/0016-ecosystem-documentation.md`
- https://github.com/kkgams/plugin-js

## Problem

GAMS needs a coherent public installation, composition, and documentation experience rather than publication of the current development monorepo as-is. Repository extraction must not make the first usable release depend on migrating every experimental or unrelated Unit.

## Goals

- Publish under the `kkgams` GitHub organization.
- Move toward independently buildable and distributed Project Unit repositories.
- Distribute the GAMS Runtime and supported Host independently of game-specific Projects.
- Deliver a complete first public slice: desktop authoring Host, playable showcase, released dependencies, installation workflow, and documentation.

## Non-goals

- Require every Project Unit to be extracted before the first public launch.
- Require a browser-hosted editor or native game export for the showcase launch.
- Assume every Project Unit is a WASM component.
- Implement a full package manager before proving release consumption.

## Requirements

### Confirmed direction

- Create the new showcase before broad repository migration; its agreed scope is defined in PRD 0015.
- WASM plugins should be separately downloadable component artifacts, following the existing `kkgams/plugin-js` GHCR publishing approach where appropriate.
- The first public launch is incremental: standalone desktop Host, showcase dependencies, download workflow, and documentation must work end-to-end. Remaining Units can be extracted afterward.
- Initial desktop Host support is macOS only. Windows and Linux support are deferred and do not block the first release.
- The reusable GAMS Runtime and desktop Host initially share `kkgams/gams`, with a clear internal separation between orchestration and host-specific integration. Project Units and the showcase have separate repositories. This avoids cross-repository runtime/Host coordination during the first release; a future CLI Host should reuse the same runtime.
- Public documentation uses the dedicated `kkgams/docs` aggregate and released-version defaults defined in PRD 0016.
- The user handles authenticated GitHub operations and permissions. Local preparation may include reviewable scripts and workflows; credentials need not be shared with the assistant.
- Initial desktop launch is configuration-file based: start GAMS from the Project folder, preopen that folder, and load its `gams.json`. System-menu Open Project/Create Project workflows are deferred, not first-release requirements.
- Plugins and Views may be installed in a shared local folder and reused across Projects. Installation need not copy all artifacts into each Project. External paths must be accessible through explicit supported preopens; retain the existing supported shared-directory/symlink workflow rather than assuming arbitrary absolute paths bypass preopen checks.
- Wasmtime compiled component caches are generated locally per machine, not published as portable plugin artifacts. Different Projects on the same machine should be able to reuse the cache for compatible shared plugins.
- The guided showcase workflow ships a prebuilt game WASM and regenerates content packs without requiring Odin, Zig, or Nix; source builds remain available separately.

### Cache configuration — v1.0.0 scope

- Do not add a compiled-component cache setting to `gams.json` for v1.0.0. Use the existing `GAMS_WASMTIME_CACHE_DIR` override and default per-user application cache. A Project Config cache setting is deferred as a possible later feature.
- Existing Host setup uses `GAMS_WASMTIME_CACHE_DIR` when supplied, otherwise the Tauri application cache directory plus `wasmtime-components`. Root Make targets explicitly supply a development cache directory.
- Current cache entries are keyed by canonical source path inside a manually named Wasmtime/config/OS/architecture directory and considered fresh using source/cache modification times. Shared canonical plugin paths can reuse entries; identical bytes installed at different paths do not currently deduplicate.
- Before public release, verify cache compatibility/invalidation and ownership. Serialized compiled components are trusted native-code artifacts: do not accept downloaded or untrusted cache contents, and do not expose the cache as a plugin-writable preopen.
- A future Project Config cache setting would require the Host to read it before loading even the base filesystem component; that bootstrap change is outside v1.0.0 scope.

### Proposed order and gates

1. **Showcase vertical slice:** assess existing game code, create a clean Project alongside the development demo, and prove door-rule editing through standalone browser export.
2. **Boundary inventory:** identify showcase dependencies, public contracts, shared code/build dependencies, schemas, licenses, and proposed repository/artifact identities. Mark unclear boundaries explicitly.
3. **Distribution contract:** define versioning, artifact layouts, installation paths, reproducible selection, compatibility checks, and local-development overrides. Define non-WASM Unit packaging separately.
4. **Extraction pilots:** independently build/publish/download one showcase WASM dependency, then one non-WASM Unit. Establish per-repository documentation and validate aggregation with these pilots.
5. **Standalone runtime/Host distribution:** prepare `kkgams/gams` with internally separated runtime and desktop Host, remove monorepo/demo path assumptions, and prove opening an external Project.
6. **First-release dependency extraction:** migrate the remaining showcase-required Units in dependency order, finish the game/walkthrough, and replace development symlinks with released artifacts.
7. **Public launch:** verify a clean-machine installation and complete walkthrough; publish release documentation, showcase, installation instructions, and ecosystem entry points.
8. **Remaining migration:** extract additional Units incrementally and decide the original repository's long-term role or archival after consumers have migrated.

## Acceptance criteria

- A user can install the supported desktop Host and set up the showcase using released artifacts without access to the original monorepo.
- The guided edit produces a changed, independently browser-playable game.
- First-release Units have independent builds, tests, release artifacts, usage documentation, and redistribution licensing established.
- Downloaded versions and documentation refs are explicit and reproducible.
- The runtime supports the external showcase Project without project-specific composition hardcoded into the release Host.
- Missing or incompatible required dependencies fail visibly.
- Unextracted Units do not block launch unless the first-release workflow requires them.

## Open questions

- Supported macOS versions and CPU architectures, and associated signing/distribution requirements.
- Internal runtime/Host module boundaries within `kkgams/gams`; the engine is not automatically a Project Unit under the current glossary.
- Exact showcase dependency list and extraction pilot selection.
- Package identity versus WIT interface versioning, non-WASM packaging, dependency pinning, and installation tooling. `wkg` is documented by `plugin-js`; the complete GAMS setup workflow is not yet specified.
- Trusted-cache ownership and compatibility/invalidation checks. Project Config cache-directory syntax and precedence are deferred beyond v1.0.0.
- Shared WIT, SDK, utility, widget, and build-tool ownership after extraction.
- Repository history preservation, transfer versus extraction mechanics, and final disposition of `justgook/gamectl`.

## Related ADRs

- `docs/adr/0003-project-config-owns-composition.md`
- `docs/adr/0004-wit-interface-version-matching.md`
