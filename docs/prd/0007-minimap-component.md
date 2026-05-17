# minimap.comp Project Unit

## Status

Draft

## Source material

- `docs/legacy/split/docs/PLAN/PLAN/tree-generation-source-of-truth.md`
- `docs/legacy/split/docs/PLAN/PLAN/minimap-room-shape-generation.md`
- `docs/legacy/split/docs/PLAN/PLAN/generation-leftovers.md`
- `plugins/minimap.comp/wit/package.wit`
- `plugins/minimap.comp/main.go`
- `plugins/minimap.comp/placement/shape_mask.go`

## Problem

`minimap.comp` is the current minimap Project Unit. Some legacy planning still refers to `minimap2` and describes a broader tree/minimap/room-content generation pipeline. That pipeline is only an example composition; the current documentation should describe the `minimap.comp` Project Unit itself and avoid treating the example pipeline as canonical architecture.

## Goals

- Document `minimap.comp` as the current minimap component name.
- Preserve the current component contract at a high level: tree-shaped input to tilemap-shaped output.
- Preserve current room-shape metadata behavior as `minimap.comp` implementation/API behavior, not as a global generation pipeline rule.
- Treat broader room-content generation and Markov/WFC research as separate future Project Unit work.

## Non-goals

- Do not define a canonical tree → minimap → roomgen pipeline for all GAMS Projects.
- Do not document `minimap2` as the current component name.
- Do not decide future room-content generation architecture here.
- Do not decide whether MarkovJunior/WFC become dependencies, ports, or references.

## Requirements

- The current minimap Project Unit is named `minimap.comp`.
- `minimap.comp` accepts a tree-like input and returns a tilemap-like output through its WIT interface.
- `minimap.comp` may read room-shape metadata from node data.
- The current room-shape metadata key is `minimap`.
- The current room-shape mask format uses `/` between rows, `#` for occupied cells, and `.` for empty cells.
- Empty, ragged, invalid-character, empty-shape, or disconnected masks should be rejected clearly.
- If no room-shape metadata is present for a node, `minimap.comp` may choose a fallback room shape.
- Example compositions may feed authored tree metadata into `minimap.comp`, but that flow is not a required global GAMS pipeline.

## Open questions

- Should the node data map remain string-to-string long term, or is that only the current WIT shape for `minimap.comp`?
- Should the `minimap` metadata key be renamed or namespaced before stabilization?
- Should fallback room-shape choice become deterministic from an explicit seed?

## Related docs

- `docs/prd/0003-project-config.md`
