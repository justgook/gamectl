---
title: Scope and Non-goals
summary: Accepted development boundaries and unresolved limits for the smallest coherent release.
eyebrow: Production
status: in-progress
---

## Development boundary

> **Accepted** — The existing technical proof of concept does not define the game, feature set, or architecture. Existing code and assets may be reused only when the new design calls for them; replacing them carries no design penalty.

> **Accepted** — Tool development and technology demonstrations are outside the scope of this GDD and knowledge base.

## Structural scope

> **Accepted** — The game is a single-player PC 2D side-scrolling run-and-gun action platformer built as an authored campaign. One locally controlled character is deployed at a time. Gamepad is the primary design input, with fully remappable keyboard support required.

> **Accepted** — Replayability comes from character differences, mastery, discoveries, alternate routes, shortcuts, and selected post-death choices—not procedural level generation.

## First releasable game

> **Accepted** — Target a compact 3–5 hour first successful completion. Replay value should come from character differences, alternate routes, Memory Imprints, discoveries, and mastery rather than filler.

> **In progress** — The release should contain a small playable cast, a complete authored campaign, persistent progress, and enough character-specific variation to justify replay.

> **Open question** — What exact character, location, boss, and progression budgets can fulfill that promise?

## Non-goals

- Procedurally generated levels.
- Equal structural weight for action-platformer, Metroidvania, roguelite, and Soulslike conventions.
- Preserving proof-of-concept systems that do not serve the new game.
- Cooperative or competitive multiplayer requirements for the first release.
- Console certification, mobile, touch controls, or mouse-dependent play as first-release requirements.
- A large cast designed before two characters prove meaningful gameplay contrast.
- Lore, content volume, or progression breadth used to compensate for a weak representative encounter.

## Third-party asset boundary

> **Accepted** — The CraftPix Cyberpunk Platformer collection may provide starting and potentially shippable game art, but it does not constrain the game to its complete catalogue or prevent later modification and replacement.

> **Accepted** — Licensed source and modified art files must not be committed to the public repository. They remain under the git-ignored `examples/demo/game/assets.private/craftpix/` directory. Only distribution forms allowed by the applicable license may be published.

## Missing production limits

> **TODO** — Set provisional budgets for characters, locations, bosses, enemies, abilities, weapons, narrative, animation, music, and effects after the representative encounter is validated.

> **Needs example** — Define one “release-complete” route through a single location to establish the expected density of combat, traversal, discovery, and presentation.
