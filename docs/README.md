# GAMS Documentation

Current documentation is organised around these forms:

- `../CONTEXT-MAP.md` — multi-context glossary index for the current monorepo/prototype phase.
- `../CONTEXT.md` — short root overview pointing at context-specific glossaries.
- `docs/prd/` — product/technical requirements for a coherent capability or migration slice.
- `docs/adr/` — architectural decisions that are hard to reverse, surprising without context, and trade-off based.
- `docs/ideas/` — pre-decision idea inbox; source material for discussion, conversion, or dismissal.
- `docs/ideas/yoinking/` — competitive inspiration records.
- `docs/reference/` — protected canonical operational guides and styleguides, including the GAMS View Development Guide.

Legacy markdown migration is complete. Historical source files under `docs/legacy/` were converted, dismissed, or deleted; `docs/legacy/` no longer exists. Future documentation work should update current docs directly instead of recreating a legacy archive.

## Documentation workflow

Use a `grill-with-docs` style loop for substantial documentation or architecture work:

1. Read `CONTEXT-MAP.md`, the relevant context glossary, and nearby code.
2. Read current PRDs/ADRs that touch the area.
3. Extract domain terms into the relevant context `CONTEXT.md` as soon as they are resolved; use `CONTEXT-MAP.md` to choose the context.
4. Ask one sharp question at a time for ambiguous scope, terminology, requirements, or decisions.
5. Write or update one PRD under `docs/prd/` for desired behaviour and migration targets.
6. Create ADRs under `docs/adr/` only for decisions that meet the ADR threshold.

Do not bulk-copy old prose into current docs. Current docs should be smaller, sharper, and explicit about what is still unresolved.

## Idea and Yoinking workflow

Use `docs/ideas/` for ideas that are not yet requirements or decisions.

Use **Yoinking** records for competitive inspiration / strategic duplication / market-validated replication:

1. Capture the source or user-described inspiration under `docs/ideas/yoinking/`.
2. Use the project-local `yoinking` skill to grill the source into a record of what we like, dislike, might adapt, and should avoid.
3. Do not decide implementation in the Yoinking record.
4. Later, convert useful parts with `grill-with-docs` into `CONTEXT.md`, PRDs, and ADRs; or dismiss the idea with a reason.

An idea is done when it is either converted with links to current docs or dismissed with a reason.
