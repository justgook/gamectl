# Split from legacy docs/PLAN/PLAN.md: Room Content Generation

Source: deleted legacy `docs/PLAN/PLAN.md`, lines 86-126.

This fragment exists only as temporary source material while legacy docs are converted into PRDs/ADRs/context docs. Delete it once its content is converted or dismissed.

---

### 4. User-driven procedural room content generation

Goal: create new plugins/views for interactive procedural generation where the user can guide, lock, regenerate, and inspect room content.

Potential plugins/views:

- `roomgen` singleton plugin: room content generation service.
- `view-roomgen` browser view: user-facing room generation/editor UI.
- Optional helper plugins for specific algorithms after research:
  - MarkovJunior-inspired rewriting/generative grammar plugin.
  - WaveFunctionCollapse-inspired tile constraint solver plugin.

Research targets:

- <https://github.com/mxgmn/MarkovJunior>
- <https://github.com/mxgmn/WaveFunctionCollapse>

Research questions:

- Which parts are useful for room interior generation vs. global map generation?
- How should samples/rules/constraints be represented as game assets?
- Can generated output be deterministic from a seed and tree node id?
- What should be user-lockable: tiles, regions, exits, entities, constraints, or generated tags?
- Should WFC/Markov logic be ported to Go/WASM, called as an external tool, or represented as data consumed by a smaller first-party solver?

Initial contract idea:

```json
{
  "tree": "res://world/tree.json",
  "node": 12,
  "roomShape": [{ "x": 0, "y": 0 }],
  "constraints": {
    "exits": [],
    "lockedTiles": [],
    "theme": "dungeon"
  },
  "out": "res://world/rooms/12.tilemap.json"
}
```
