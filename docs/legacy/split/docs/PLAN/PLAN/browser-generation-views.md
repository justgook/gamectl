# Split from legacy docs/PLAN/PLAN.md: Browser Generation Views

Source: deleted legacy `docs/PLAN/PLAN.md`, lines 135-150.

This fragment exists only as temporary source material while legacy docs are converted into PRDs/ADRs/context docs. Delete it once its content is converted or dismissed.

---

### 6. Browser views for generation workflows

Goal: expose tree, minimap, and room generation through first-class view plugins instead of host-specific screens.

Candidate views:

- Tree authoring/inspection view.
- Minimap placement preview view.
- Room content generation view.

View assumptions:

- Views should call plugins through runtime/plugin contracts.
- Views should not own core generation logic.
- Shared memory/direct plugin-owned state can be used for first-party browser UI where it is simpler than runtime-managed mirrored state.
