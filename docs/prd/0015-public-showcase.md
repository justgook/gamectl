# Public playable showcase

## Status

In progress — product direction confirmed; local one-room game, content pipeline, and desktop Project wiring implemented. Interactive browser/desktop walkthrough and release packaging remain unverified.

## Source material

- Planning conversation: publication under `github.com/kkgams`, independently distributed Project Units, and a standalone GAMS Runtime distribution.
- `docs/contexts/project-composition/CONTEXT.md`
- `docs/contexts/core-runtime/CONTEXT.md`
- `docs/prd/0003-project-config.md`
- `examples/demo/README.md`
- `examples/demo/game/`
- `plugins/game/`

## Problem

The current demo is a broad development workspace rather than a focused public introduction. GAMS needs a small, coherent game Project that demonstrates how authored content changes playable behavior, and later serves as a consumer of independently released Project Units.

## Goals

- Provide a small, complete playable game and an editable GAMS Project.
- Demonstrate an understandable author → package/export → play workflow.
- Establish a focused showcase before broad repository extraction/publication.

## Non-goals

- Showcase every Project Unit.
- Include combat in the initial game.
- Require native game exports for the first showcase release.
- Decide package addressing, repository boundaries, or the release Host in this PRD.

## Requirements

### Confirmed direction

- The game is a short top-down abandoned-station puzzle adventure, targeting roughly five minutes and 4–6 rooms.
- The core progression is restore power, unlock a route, recover an item, and escape.
- Switches, doors, and a small NPC/robot interaction provide a limited gameplay vocabulary.
- The exported game runs independently of GAMS and its editor.
- Browser-playable export is the first target; native exports may follow.
- Initial authoring uses the existing desktop Host on macOS. Windows/Linux authoring support and a browser-hosted editor are not launch requirements.
- The guided content-editing walkthrough does not require Odin, Zig, or Nix. Distribute a prebuilt game WASM and use GAMS to regenerate content packs and assemble the standalone export. Full game-source builds remain a developer workflow.
- The guided rule change must preserve the prebuilt game's decoder/schema contract; verify this before relying on content-only export.
- Visitors have two entry points: play the game, or open its Project and change it.
- The primary guided edit changes a door's unlock condition from restored power to carrying an access key.
- Author Director DSL text in GAMS's existing Code view (`view-code`). The visual Director view (`view-director`) was an experiment and is not a showcase dependency; do not integrate its separate JSON document format into this workflow.
- The walkthrough includes playing the original puzzle, editing the rule in GAMS, rebuilding/exporting, and observing the changed behavior.
- Object placement and sprite changes are secondary demonstrations, not the main proof of value.
- Procedural generation is optional, not necessary to complete the game.

### Proposed implementation sequence

1. Reuse selected infrastructure from `examples/demo/game`, not the older `plugins/game` triangle template. Source inspection found standalone web hosting, Director execution, rendering, and resource-pack loading, but no validated complete showcase. Build/runtime verification remains the first implementation checkpoint.
2. Create a clean Project alongside the existing development demo; keep current fixtures intact during development.
3. Build one complete door-rule edit → export → play slice before expanding to the full short game.
4. Complete the small game and guided walkthrough.
5. As distribution work proceeds, replace monorepo-local Unit dependencies with pinned released artifacts.
6. Promote the new Project to the public/default showcase only after clean-machine verification; explicitly retain or relocate development fixtures.

## One-room implementation plan

This is the proposed local implementation slice, not authorization for repository extraction or a promise that the existing game already supports it. Keep the old demo unchanged as a development/test workspace.

### Slice scope

- One enclosed room with a player, power switch, access key, and locked exit.
- Both the switch and key are reachable before unlocking the exit.
- Basic top-down movement and explicit interaction with nearby objects. A locked-door interaction is an expected gameplay outcome, not an invariant failure.
- Initial rule: interacting with the exit unlocks it only after power is restored.
- Guided edit: replace that condition with carrying the access key, leaving the unlock effect unchanged.
- Walking through the unlocked exit shows a simple completion state. Restart restores authored initial state; replay the edited export from a fresh state.
- Use original geometric placeholder visuals, distinct object labels, and visible power/key/door status. No NPC, combat, procedural generation, sound, polished art, or full animation-authoring pipeline is needed for this first slice. These exclusions do not remove the final game's broader requirements.

### 1. Verify and isolate the reusable foundation

- Use the root Nix/direnv environment for developer builds and tests. Toolchain-free authoring applies to visitors, not to developing the prebuilt game.
- Establish a baseline for the existing game web build and relevant Director tests; record pre-existing failures rather than treating source inspection as validation.
- Create a sibling Project, provisionally `examples/station-demo/`, containing its own `gams.json`, authored content, schema, scripts/graphs, game source, and export output. This path is a working name, not a final game/repository name.
- Reuse the Odin Director runtime, browser host/input/asset-loading bridge, and only the rendering/math pieces required by the room.
- Do not copy the current `World` wholesale: its frame loop, initialization, decoders, and pack loading contain platformer/combat/debug assumptions. Keep the small showcase gameplay separate from those systems.
- Pin Sokol bindings/shader tools for the new build instead of relying on downloads from `master`. Preserve third-party licenses.
- Do not use the external animation-directory symlink or require any existing `examples/demo/tmp` output.

**Checkpoint:** the new game renders its own room in an independently served web directory, using only declared inputs. Existing demo files remain intact.

### 2. Prove the Director-to-pack-to-game contract

- Author a small `.director` source with named player, power, key, and exit state. Use currently implemented simple entity/tag/link queries, not unimplemented language features.
- Keep game logic responsible for movement, proximity, interaction triggers, rendering, and collision. Director owns puzzle conditions and state changes.
- The game reports interaction to Director; the applied unlock change updates door appearance and collision consistently. Do not hardcode power-versus-key logic in Odin or JavaScript.
- Do not copy the current trigger code's unconditional `assert(result.matched)` into ordinary player interactions. A failed prerequisite is normal; malformed packed data or missing required bindings remains a loud failure.
- Resolve game-facing entity/property bindings from compiler symbol metadata during content generation and pack those bindings with the IR. Never bake compiler-assigned numeric IDs into the game: word IDs can change when source changes.
- Define a small showcase packing schema and decoder contract, reusing the implemented Director IR types. Do not inherit the current demo's enemy/dialogue configuration fields merely to satisfy its loader.
- Generate and compile the decoder during game development. The visitor's content-only build uses the fixed matching schema and does not regenerate game source or compile Odin.
- Compile and pack both rule variants, then execute each with the same decoder/game binary. Validate required bindings, schema compatibility, and field/range integrity before play; reject incompatible content rather than attempting fallback parsing.

**Checkpoint:** automated compiler → pack → decoder → Director tests distinguish both variants while using the same compiled game-side code.

### 3. Complete one-room gameplay

- Add simple top-down movement and room/closed-door collision. Reuse suitable primitives, not platformer movement rules.
- Add power-switch activation, key pickup, exit interaction, status feedback, completion, and restart.
- Keep the key reachable without power and power reachable without the key, so each condition can be tested independently.
- Render initial state and applied state changes consistently, including hiding a collected key and removing the unlocked door's blocking shape.
- Remove mandatory bullet, enemy, and unrelated pack loads from the new game path instead of supplying meaningless placeholder packs.

**Checkpoint:** both puzzle variants are playable; the rejected prerequisite leaves the door blocked, the correct prerequisite unlocks it, and restart clears progress.

### 4. Wire existing GAMS authoring surfaces

- Configure Files, Code, and Node Graph views plus their required supporting views and UI Services. Open the authored `.director` file through `view-code`; exclude experimental `view-director`.
- Reuse the existing graph compilation approach in `views/view-ng.js` and `examples/demo/ng/compile-graph.lua`, with an explicit inventory of the Lua compiler, presets, and shared frontend dependencies.
- Simplify `examples/demo/CYBERPUNK/director.ng.json` into a showcase-specific graph: read Director source → invoke `director-compiler` → derive required bindings → invoke `respack` → write content/export files.
- Keep orchestration in Project scripts/graphs and existing plugin calls, not a showcase-specific Host callback.
- Use existing documented UI patterns. Any new UI pattern requires separate styleguide approval before implementation.
- For the local slice, use the config shape the current Host actually supports and record it as migration work, not a competing public format. Migrate the Project and Host together to the agreed public Project Config contract before release; do not add compatibility shims to preserve the temporary shape.

**Checkpoint:** save the rule in Code view, run the graph, and receive an explicit success or source diagnostic. Invalid source must not produce or advertise a successful new export.

### 5. Make content-only export a complete workflow

- Ship the prebuilt freestanding game WASM and its browser JavaScript/HTML beside the Project's source; the exact release location is determined by distribution work.
- Provide an explicit Project-owned export action/graph target using existing filesystem/component calls. Verify required directory/copy/write operations; do not assume an existing one-click exporter.
- Assemble the prebuilt game, browser support files, fixed assets, and newly generated content into a standalone output directory. No engine compiler, shell-command bridge, remote service, or GAMS API may be required by that exported game.
- Validate all required inputs before completing export. A failed compile/pack/export is visible and must not be reported as success or confused with an older successful output.
- Serve the output using ordinary static HTTP hosting; opening via `file://` is not a requirement. Preview inside GAMS is optional and must not become a runtime dependency.
- Verify the game WASM checksum is unchanged between the two guided exports while the content pack changes.

**Checkpoint:** with Odin/Zig/Nix absent from the visitor workflow, GAMS produces both exports; each runs in a browser after GAMS is closed.

### Candidate local dependencies

- Components: `fs.comp`, `lua.comp`, `director-compiler.comp`, `respack.comp`.
- Primary Views: `view-files`, `view-code`, `view-ng`; inventory supporting views such as `view-ng-node` and file/popup editors from actual calls.
- Current shell services: context, keys, layout, toast, popup, tooltip; one theme and required base CSS/fonts/widgets/utilities.
- Explicit Project content: graph compiler/presets, rule source, packing schema and binding-generation logic, room data, prebuilt game/browser files, and original placeholder assets.
- World/tile/animation editors and image-processing components are added only when their corresponding authoring workflow is implemented. SQL, chat, generators, and the complete current demo plugin list are not presumed required.
- Local shared Unit installations/symlinks are acceptable for this development slice. The public release must use independently released Units and must not require the original monorepo; shared installations remain supported.

### Regression and release evidence

- Rule matrix: neither prerequisite; power only; key only; both prerequisites, for each source variant.
- Repeated interactions, blocked-door retry after obtaining the prerequisite, key pickup idempotence, completion, and restart.
- Invalid Director source returns useful diagnostics and does not yield a successful new export.
- Required binding/schema failures abort generation/loading visibly.
- Identical source and pinned tools produce deterministic content; source edits do not rely on stable numeric symbol IDs.
- Same prebuilt WASM successfully consumes both generated variants.
- Export is self-contained and works under a static site's subdirectory without GAMS APIs, external filesystem paths, or monorepo symlinks.
- Test compiler/runtime behavior with existing native/component test facilities and manually verify browser interaction/export initially; select any additional browser automation tooling separately.

**Slice exit gate:** one reproducible walkthrough, both rule variants verified, and an actual dependency/file list suitable for the first extraction pilot. Only then expand to the full 4–6-room game or begin broad repository migration.

## Local implementation evidence

- Working Project: `examples/station-demo/`; setup and guided edit instructions live in its `README.md`.
- Implemented standalone Odin/WebGL room, top-down movement, switch/key/exit interaction, Director-controlled unlocking, completion, and restart.
- Implemented named binding generation, fixed-schema packs for both prerequisites, and Files/Code/Node Graph desktop composition with a Project-owned content-only export graph.
- Verified locally: game web build; 8 game/decoder tests; 2 compiler-pack/game-loader integration tests including both prerequisite matrices; deterministic real-component compile/pack and generated-fixture drift checks.
- Integration tests now use the actual game loader, not only the schema-generated reference decoder. Added malformed-pack bounds/cycle/reference validation tests.
- The export graph was executed through the real runtime/plugin pipeline during integration, and static HTTP output was checked. This is not evidence of interactive desktop or browser play.
- Still required: visual/input verification in browser and GAMS, same-prebuilt-WASM browser execution of both variants, packaged toolchain-free visitor inputs, public dependency/config migration, and clean-machine validation. Local developer builds and native loader tests do not close those release gates.

## Acceptance criteria

- A visitor can play the browser export without installing or running GAMS.
- The short game has a reachable ending.
- A visitor can follow the documented door-rule edit and observe the changed unlock behavior in a new export without installing a native game compiler/toolchain.
- Both rule variants remain solvable; the walkthrough explains how to reach their respective prerequisites.
- The Project contains only showcase-relevant content with redistribution rights established for shipped assets and dependencies.
- Before public ecosystem launch, the Project can be set up with released dependencies without symlinks into the original monorepo.

## Open questions

- Which macOS versions and CPU architectures must the desktop Host support for the initial authoring walkthrough?
- Build/runtime verification of the selected game code and the exact minimal rendering/collision subset.
- Exact Code-view configuration, graph/export action wiring, and minimal room/Director packing schema.
- Exact Project Unit dependency list, art direction, game title, and hosting destination.

## Related ADRs

- `docs/adr/0003-project-config-owns-composition.md`
