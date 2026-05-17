# Split from legacy docs/PLAN/PLAN.md: Tree Generation Source Of Truth

Source: deleted legacy `docs/PLAN/PLAN.md`, lines 56-71.

This fragment exists only as temporary source material while legacy docs are converted into PRDs/ADRs/context docs. Delete it once its content is converted or dismissed.

---

### 2. Tree as generation source of truth

Goal: make `tree` carry enough structured intent for downstream procedural plugins to consume without regenerating already-authored facts.

Remaining work:

- Add fixtures/integration tests showing authored `data.minimap` masks flowing from tree JSON through `plugins/minimap2` into tilemap output.

Decisions:

- `tree.Node.Data` MUST stay `map[string]string`.
- Plugin/view metadata MUST live inside `data`; no additional node properties beyond `parent` and `data`.
- Room-shape metadata for minimap work uses `data["minimap"]`.
- `data["minimap"]` stores a compact room-shape mask string: rows separated by `/`, `#` for occupied cells, and `.` for empty cells, parsed by `placement.ParseRoomShapeMask`.
- If a node has no `data["minimap"]` mask, `plugins/minimap2` uses its existing random room-shape chooser fallback.
