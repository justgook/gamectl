# PRDs

PRDs describe desired behaviour, scope, and acceptance criteria for a coherent GAMS capability or migration slice.

Use PRDs for requirements and plans. Use ADRs for hard-to-reverse decisions and `CONTEXT.md` for domain language.

## Filename

Use sequential numbering with a short slug:

- `0001-docs-consolidation.md`
- `0002-plugin-manager-runtime.md`

## Template

```md
# <Capability or migration slice>

## Status

Draft | Accepted | Superseded

## Source material

- `docs/legacy/...`

## Problem

What user/project problem are we solving?

## Goals

- ...

## Non-goals

- ...

## Requirements

- ...

## Acceptance criteria

- ...

## Open questions

- ...

## Related ADRs

- `docs/adr/NNNN-slug.md`
```

## Conversion rule

When converting legacy markdown, ask one question at a time when meaning is ambiguous. If code can answer the question, inspect code instead of asking.
