# Yoinking Records

**Yoinking** is GAMS language for competitive inspiration: strategic duplication, market-validated replication, or adapting an external idea into the GAMS context.

A yoinking record captures the idea without deciding whether GAMS will implement it.

## Filename

Use:

```text
YYYY-MM-DD-short-source-or-idea.md
```

## Template

```md
# Yoinking: <source or idea>

Status: captured | discussed | converted | dismissed
Date: YYYY-MM-DD
Source: <URL, repo, product, video, article, or user-described source>

## Source summary

What the source is and what it appears to do.

## What we like

- ...

## What we dislike / should avoid

- ...

## GAMS adaptation hypotheses

- ...

## Possible use in GAMS

- Which user/workflow could benefit?
- Which plugin/view/runtime area might it touch?

## Risks / mismatches

- ...

## Open questions for grilling

- ...

## Conversion outcome

- Converted to: `docs/prd/...`, `docs/adr/...`, `CONTEXT.md#...`
- Or dismissed because: ...
```

## Rules

- Do not decide implementation in the yoinking record.
- Do not create ADRs from external inspiration alone; first adapt it to GAMS and identify the actual trade-off.
- After discussion, either convert the useful parts or dismiss with a reason.
