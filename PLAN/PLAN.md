# GAMS Planning

GAMS is moving toward a plugin-driven CMS/toolkit where hosts stay thin and most behavior is exposed through singleton plugins, view plugins, and stable plugin-to-plugin contracts.

This document is the top-level planning index. Detailed plans can be split under `PLAN/singleton/`, `PLAN/view/`, and topic-specific files as work becomes concrete.

## Current Direction

- Prefer plugin-to-plugin calls over host-specific callbacks.
- Prefer `singleton` plugins for long-lived services and generators.
- Treat `instance` plugins as legacy/migration-only unless a concrete use case requires them.
- Migrate browser-rendered tools into first-class `view` plugins routed through `pluginManager`.
- Keep browser and CLI hosts thin; `cmd/browser` can make breaking internal changes while the runtime is being rebuilt.

## Planning Chunks

### 1. Tree as generation source of truth

Goal: make `tree` carry enough structured intent for downstream procedural plugins to consume without regenerating already-authored facts.

Near-term work:

- Define stable `node.data` keys for generation metadata.
- Finish `plugins/minimap2` support for reading a node `minimap` property and extracting the room shape from the tree instead of always choosing a generated shape.
- Decide the exact JSON shape for `data.minimap`.
  - Current implementation expects `data["minimap"]` to unmarshal into `placement.RoomShape`.
  - Candidate shape: array of `{ "x": number, "y": number }` cells relative to the room origin.
- Add examples/tests for trees with explicit room shapes.
- Keep generated defaults as a separate fallback only where generation is explicitly requested.

Open questions:

- Should `tree.Node.Data` stay `map[string]string`, or should richer typed metadata be introduced later?
- Should room shape live directly at `data.minimap`, or under a more explicit key such as `data.roomShape` / `data.minimap.roomShape` once tree metadata grows?

### 2. Minimap and room-shape generation

Goal: separate room graph/layout concerns from room content generation.

Near-term work:

- Treat `minimap2` as the active placement/layout path.
- Keep `minimap` as legacy unless needed for migration comparison.
- Ensure `minimap2` can:
  - read tree input through `fs`,
  - write tilemap output through `fs`,
  - preserve explicit room shapes from tree metadata,
  - generate missing room shapes only when requested/allowed.

Proposed logical split:

1. `treegen` or authoring plugin creates/edits the room tree.
2. `minimap2` converts tree + room-shape metadata into a room placement/tilemap.
3. Later room-content plugins fill each room interior using WFC/Markov/user-guided generation.

### 3. User-driven procedural room content generation

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

### 4. Mounts and storage protocols

Goal: make asset IO independent of local/http-only assumptions by introducing mount-backed paths and protocol-aware filesystem routing.

Needed capabilities:

- Multiple mounts with different protocols/backends.
- Stable logical asset paths that plugins can pass to `fs`.
- Backends such as:
  - local/dev files,
  - HTTP read-only assets,
  - WebDAV remote project storage,
  - OPFS browser-local project storage.

Proposed logical split:

1. `mounts` singleton plugin/service owns mount table and path resolution.
2. `fs` plugin routes `read`/`write`/`list`/etc. through resolved mounts.
3. Browser host provides only the minimal backend bridges needed for browser-only APIs such as OPFS.
4. CLI host provides local filesystem and optional WebDAV implementations.

Open questions:

- Path syntax: `res://`, `project://`, `opfs://`, `webdav://`, or mount-name prefixes such as `/project/...`?
- Which operations are required first: `read`, `write`, `list`, `stat`, `mkdir`, `delete`, `watch`?
- Should mounts be configured by project file, user settings, or runtime calls?

### 5. Reusable browser widgets

Goal: build embeddable UI widgets that views can reuse without hard-coding host/editor behavior.

Current widget plans:

- `PLAN/widget-layers.md` — Aseprite-inspired `layers-widget` for animation creation, sprite layering/compositing, and later skeleton animation.

### 6. Browser views for generation workflows

Goal: expose tree, minimap, and room generation through first-class view plugins instead of host-specific screens.

Candidate views:

- Tree authoring/inspection view.
- Minimap placement preview view.
- Room content generation view.
- Mount/storage configuration view.

View assumptions:

- Views should call plugins through `pluginManager` contracts.
- Views should not own core generation logic.
- Shared memory/direct plugin-owned state can be used for first-party browser UI where it is simpler than runtime-managed mirrored state.

## Suggested Implementation Order

1. Finalize `data.minimap` shape and add tree fixtures/examples for explicit room shapes.
2. Complete/verify `plugins/minimap2` extraction of room shape from tree metadata.
3. Define minimal `fs` + `mounts` protocol contract for `read`/`write` on named mounts.
4. Add a planning file for room generation research and summarize MarkovJunior/WFC findings there.
5. Prototype `roomgen` as a singleton plugin with a simple deterministic generator before committing to Markov/WFC integration.
6. Add `view-roomgen` once plugin contracts are stable enough for UI iteration.

## Requires Clarification

- Final tree metadata schema for procedural generation.
- Whether room shape should be minimap-specific or a generic room property.
- Mount path syntax and first required backend set.
- Whether MarkovJunior/WFC should become direct dependencies, ports, or design references only.
