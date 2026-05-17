# Documentation consolidation

## Status

Draft

## Source material

- `docs/legacy/INDEX.md`
- `docs/legacy/README.md`
- `docs/legacy/docs/PLAN/PLAN.md`
- all files listed in `docs/legacy/INDEX.md`

## Problem

GAMS has useful project knowledge spread across READMEs, TODO files, plans, specs, handoffs, and plugin-local notes. The repo needs a sharper documentation architecture so agents and humans can tell which information is source material, which requirements are current, which decisions are settled, and which terms are canonical.

## Goals

- Preserve all legacy markdown source material under `docs/legacy/`.
- Convert legacy documents into smaller current PRDs, ADRs, and glossary entries.
- Make the conversion process compatible with `grill-with-docs`: one ambiguity at a time, code exploration before asking when possible, and inline updates to `CONTEXT.md`/ADRs as decisions crystallise.
- Avoid treating archived legacy markdown as canonical after its contents are converted.

## Non-goals

- Do not rewrite all legacy documents in one pass.
- Do not create ADRs for every historical note.
- Do not bulk-copy legacy prose into current docs.

## Requirements

- `CONTEXT.md` contains only domain terminology and relationships.
- `docs/prd/` contains numbered PRDs for coherent capabilities or migration slices.
- `docs/adr/` contains numbered ADRs for hard-to-reverse, surprising, trade-off-based decisions.
- `docs/legacy/INDEX.md` inventories archived markdown, tracks conversion/removal counts, and serves as the conversion queue.
- Agents must consult legacy files as source material until a corresponding PRD/ADR/current doc exists.

## Acceptance criteria

- New documentation architecture is described in `docs/README.md`.
- Legacy conversion/removal status is visible in `docs/legacy/INDEX.md`.
- PRD and ADR formats are documented in `docs/prd/README.md` and `docs/adr/README.md`.
- The first ADR records the documentation architecture decision.
- Agent instructions point contributors at the conversion workflow.

## Open questions

- Which legacy area should be converted first: plugin manager/runtime, browser views, SQL, layout, image, AI agent, or another slice?
- Should completed legacy conversions be marked directly in `docs/legacy/INDEX.md`, or tracked as local markdown issues under `.scratch/docs-consolidation/`?

## Related ADRs

- `docs/adr/0001-docs-architecture.md`
