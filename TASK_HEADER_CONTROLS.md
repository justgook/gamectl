# Header Controls UX Consistency Task

## Goal

Unify header toolbar UX across all `view-*` components so controls feel predictable and consistent:

- same order of actions
- same icon style and semantics
- same enable/disable behavior
- no ad-hoc accent/success/danger coloring for routine header actions

This task focuses on controls rendered into the `header-controls` slot of `view-chrome`.

---

## UX Rules (Target Standard)

### 1) Visual style

- Header actions are neutral buttons by default.
- Do not use `class="accent"`, `class="success"`, `class="danger"` for normal header actions.
- Use shared separators only:
  - `<span role="separator" aria-hidden="true"></span>`
- Avoid inline style in header controls.

### 2) Accessibility and semantics

- Every icon-only button must have both `aria-label` and `title`.
- Use one icon pattern for headers: `<i aria-hidden="true">...</i>`.
- Toggle buttons use `aria-pressed` (and active visual state).

### 3) Behavior

- If action cannot be executed now, button is `disabled`.
- Do not rely on warning toast/alert as the first feedback for unavailable actions.
- Button enabled state must update immediately after relevant state changes (selection, load, etc).

### 4) Order (canonical)

Apply groups left-to-right where relevant:

1. open/load/import
2. create/add/new
3. save/export
4. run/play/stop
5. edit/duplicate
6. delete/clear (destructive)
7. refresh/reload/reset
8. zoom group (`zoom-out`, `zoom-fit`, `zoom-in`) at the far right

If a group is not relevant for a view, skip it.

### 5) Icon consistency (recommended mappings)

- load/open: `folder_open`
- add/new: `add` (or context-specific variant when needed)
- save: `save`
- run: `play_arrow`
- stop: `stop`
- edit: `edit`
- delete: `delete`
- clear: `clear_all` or `delete_sweep` (pick one meaning and keep consistent)
- refresh/reload: `refresh`
- fit: `fit_screen`
- zoom in: `zoom_in`
- zoom out: `zoom_out`

---

## Global/Shared Work

- [ ] Add shared helper/style conventions for header toolbars (avoid per-view inline styles).
- [ ] Add common helper for state sync pattern (e.g. `syncHeaderControlsState()` per view).
- [ ] Keep `header-controls` slot layout consistent in base styles/themes.

Files to review:

- `cmd/browser/base.css`
- `cmd/browser/views/view-canvas-base.js`
- `cmd/browser/views/view-layout.js`
- `cmd/browser/themes/neon.css`

---

## Per-View Fix List

### Node Graph (legacy)

File: `cmd/browser/views/view-nodegraph.js`

- [ ] Remove header intent classes (`success`, `accent`).
- [ ] Reorder buttons to canonical order.
- [ ] Disable `edit` when no focused node.
- [ ] Evaluate disable condition for `run`/`save` when graph state is invalid.

### Node Graph 2

File: `cmd/browser/views/view-nodegraph2.js`

- [ ] Remove header intent classes (`success`, `accent`).
- [ ] Reorder buttons to canonical order.
- [ ] Keep and verify existing disabled state sync for `edit`/`delete`.

### Tree

File: `cmd/browser/views/view-tree.js`

- [ ] Remove `accent` class from header save button.
- [ ] Confirm order aligns with canonical groups (`save`, `reload`, zoom group).

### Tilemap

File: `cmd/browser/views/view-tilemap.js`

- [ ] Remove `accent` class from header save button.
- [ ] Replace inline styled tile input with class-based style (no inline in header).
- [ ] Confirm order aligns with canonical groups.

### Skeleton

File: `cmd/browser/views/view-skeleton.js`

- [ ] Remove `accent` class from header save button.
- [ ] Replace inline separators with semantic separator element.
- [ ] Verify toggle button semantics for labels (`aria-pressed`).

### Timeline

File: `cmd/browser/views/view-timeline.js`

- [ ] Replace inline separators with semantic separators.
- [ ] Disable `add-key` when no tracks selected or no working pose.
- [ ] Disable `delete-key` when no keyframes selected.
- [ ] Normalize play button icon markup to `<i>` pattern.

### Game Runner

File: `cmd/browser/views/view-game-runner.js`

- [ ] Remove inline style-based toolbar layout; use shared classes.
- [ ] Disable `reload` while reload is in progress.
- [ ] Keep play/pause semantics and labels synchronized.

### Files

File: `cmd/browser/views/view-files.js`

- [ ] Disable `delete` when nothing selected.
- [ ] Disable `download` unless selected item is a file.
- [ ] Keep create/upload actions enabled only when valid for current mode.

### SQL Table

File: `cmd/browser/views/view-sql-table.js`

- [ ] Disable `delete` when no selected row or no primary key value.
- [ ] Confirm header action order (`refresh`, `insert`, `delete`).

### SQL Tables

File: `cmd/browser/views/view-sql-tables.js`

- [ ] Confirm order/style consistency (`refresh`, `new-table`).
- [ ] Ensure neutral button styling in header.

### Animation Editor

File: `cmd/browser/views/view-animation-editor.js`

- [ ] Remove header intent classes (`accent`) from `new` and `save`.
- [ ] Keep header order consistent (`load`, `new`, `save`, then settings inputs).
- [ ] Ensure disabled state for save when validation preconditions are not met (optional if expensive).

### OPR Unit Builder

File: `cmd/browser/views/view-opr-unit-builder.js`

- [ ] Remove `accent` class from header export button.
- [ ] Disable `random-unit` when no army selected.
- [ ] Disable `export-json` when no unit selected.

### Tile Extractor

File: `cmd/browser/views/tile-extractor/view-tile-extractor.js`

- [ ] Disable `reload` when no source image loaded.
- [ ] Confirm `load/reload/zoom` order and icon consistency.

### Sprite Extractor

File: `cmd/browser/views/sprite-extractor/view-sprite-extractor.js`

- [ ] Disable `reload` when no source image loaded.
- [ ] Confirm `load/reload/zoom` order and icon consistency.

### Sprite Packer

File: `cmd/browser/views/sprite-packer/view-sprite-packer.js`

- [ ] Replace inline separator with semantic separator.
- [ ] Disable `clear` when there are no loaded sprites.
- [ ] Confirm add/clear/zoom order and icon consistency.

---

## Acceptance Criteria

- [ ] Header controls across `view-*` follow a shared order pattern.
- [ ] No routine header actions use intent color classes.
- [ ] Unavailable actions are visibly disabled (not just rejected on click).
- [ ] Separators and icon markup are consistent.
- [ ] No inline styles remain in header control templates.

---

## Suggested Execution Order

1. Shared CSS + base conventions
2. Canvas-based views (`view-canvas-base` descendants)
3. Non-canvas views with custom header mount logic
4. Final pass for disabled-state behavior and keyboard parity
