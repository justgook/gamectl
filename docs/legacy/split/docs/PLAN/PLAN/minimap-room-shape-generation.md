# Split from legacy docs/PLAN/PLAN.md: Minimap Room Shape Generation

Source: deleted legacy `docs/PLAN/PLAN.md`, lines 72-85.

This fragment exists only as temporary source material while legacy docs are converted into PRDs/ADRs/context docs. Delete it once its content is converted or dismissed.

---

### 3. Minimap and room-shape generation

Goal: separate room graph/layout concerns from room content generation.

Remaining work:

- Keep `minimap` as legacy unless needed for migration comparison.

Proposed logical split:

1. `treegen` or authoring plugin creates/edits the room tree.
2. `minimap2` converts tree + room-shape metadata into a room placement/tilemap.
3. Later room-content plugins fill each room interior using WFC/Markov/user-guided generation.
