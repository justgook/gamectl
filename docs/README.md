# GAMS Documentation

Current documentation is organised around these forms:

- `../CONTEXT-MAP.md` — multi-context glossary index for the current monorepo/prototype phase.
- `../CONTEXT.md` — short root overview pointing at context-specific glossaries.
- `docs/prd/` — product/technical requirements for a coherent capability or migration slice.
- `docs/adr/` — architectural decisions that are hard to reverse, surprising without context, and trade-off based.
- `docs/ideas/` — pre-decision idea inbox; source material for discussion, conversion, or dismissal.
- `docs/ideas/yoinking/` — competitive inspiration records.
- `docs/reference/` — canonical operational guides and reference material, including the GAMS View Development Guide.

Historical markdown source material lives in `docs/legacy/` and should be converted rather than extended.

## Conversion workflow

Use a `grill-with-docs` style loop for each legacy area:

1. Pick one bounded legacy area from `docs/legacy/INDEX.md` or `.scratch/docs-consolidation/issues/`.
2. Read the relevant legacy files and nearby code.
3. Extract domain terms into the relevant context `CONTEXT.md` as soon as they are resolved; use `CONTEXT-MAP.md` to choose the context.
4. Ask one sharp question at a time for ambiguous scope, terminology, requirements, or decisions.
5. Write or update one PRD under `docs/prd/` for desired behaviour and migration targets.
6. Create ADRs under `docs/adr/` only for decisions that meet the ADR threshold.
7. If the legacy file is fully converted, delete it from `docs/legacy/`; otherwise leave it in place and mark the corresponding PRD/ADR links in `docs/legacy/INDEX.md`.
8. Update `docs/legacy/INDEX.md` conversion counts/status before ending the session.

Do not bulk-copy legacy prose into current docs. Current docs should be smaller, sharper, and explicit about what is still unresolved.

## Definition of done for legacy conversion

A legacy area is converted when:

- relevant source files are listed in a PRD's `Source material` section;
- all accepted requirements and migration targets are captured in PRDs;
- hard-to-reverse trade-off decisions are captured in ADRs;
- resolved domain terms are in the relevant context glossary listed by `CONTEXT-MAP.md`;
- unresolved questions remain only in PRD `Open questions`, not hidden in legacy prose;
- fully covered or dismissed legacy files are removed from `docs/legacy/`;
- `docs/legacy/INDEX.md` links the legacy area to the new PRD/ADR/current docs and updates remaining/removed counts;
- the corresponding `.scratch/docs-consolidation/issues/*` issue is marked `ready-for-human`, `wontfix`, or otherwise updated with the conversion outcome.

## Idea and Yoinking workflow

Use `docs/ideas/` for ideas that are not yet requirements or decisions.

Use **Yoinking** records for competitive inspiration / strategic duplication / market-validated replication:

1. Capture the source or user-described inspiration under `docs/ideas/yoinking/`.
2. Use the project-local `yoinking` skill to grill the source into a record of what we like, dislike, might adapt, and should avoid.
3. Do not decide implementation in the Yoinking record.
4. Later, convert useful parts with `grill-with-docs` into `CONTEXT.md`, PRDs, and ADRs; or dismiss the idea with a reason.

An idea is done when it is either converted with links to current docs or dismissed with a reason.
