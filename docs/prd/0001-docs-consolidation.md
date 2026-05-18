# Documentation consolidation

## Status

Complete

## Source material

- Deleted legacy archive previously under `docs/legacy/`
- `.scratch/docs-consolidation/session-2026-05-17.md`

## Problem

GAMS had useful project knowledge spread across READMEs, TODO files, plans, specs, handoffs, and plugin-local notes. The repo needed a sharper documentation architecture so agents and humans can tell which information is source material, which requirements are current, which decisions are settled, and which terms are canonical.

## Goals

- Convert useful legacy documents into smaller current PRDs, ADRs, glossary entries, and reference docs.
- Dismiss or delete outdated legacy documents instead of preserving stale source material indefinitely.
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
- Local tracker files under `.scratch/docs-consolidation/` record the completed conversion/removal session.
- Agents must consult current PRDs, ADRs, reference docs, and context glossaries instead of legacy files.

## Acceptance criteria

- New documentation architecture is described in `docs/README.md`.
- Legacy conversion/removal status is visible in `.scratch/docs-consolidation/session-2026-05-17.md`.
- PRD and ADR formats are documented in `docs/prd/README.md` and `docs/adr/README.md`.
- The first ADR records the documentation architecture decision.
- Agent instructions point contributors at the current documentation workflow.

## Outcome

- Legacy migration is complete.
- `docs/legacy/` has been removed.
- Current docs live under `CONTEXT-MAP.md`, context `CONTEXT.md` files, `docs/prd/`, `docs/adr/`, `docs/reference/`, and `docs/ideas/`.
- Local completion notes live under `.scratch/docs-consolidation/`.

## Related ADRs

- `docs/adr/0001-docs-architecture.md`
