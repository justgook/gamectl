# Documentation System

Documentation System covers completed legacy markdown migration, PRDs, ADRs, Yoinking records, and documentation workflow.

## Language

**Legacy Markdown Migration**:
The completed cleanup effort that converted, dismissed, or deleted pre-consolidation markdown and removed `docs/legacy/`.
_Avoid_: active legacy archive.

**Yoinking**:
Competitive inspiration captured for possible GAMS adaptation before any implementation decision is made.
_Avoid_: requirement, decision, commitment.

**Yoinking Record**:
A pre-decision idea document describing an external inspiration source, what GAMS might learn from it, and how it could be adapted or dismissed.
_Avoid_: PRD, ADR, specification.

## Relationships

- **Legacy Markdown Migration** is complete; future documentation work should update current docs directly.
- A **Yoinking Record** may become source material for a PRD, ADR, or glossary update, or may be dismissed with a reason.

## Example dialogue

> **Dev:** "Should I implement this Yoinking idea now?"
> **Domain expert:** "No. First convert the useful parts through grill-with-docs into a PRD/ADR or dismiss it with a reason."

## Flagged ambiguities

- Yoinking records are inspiration records, not implementation decisions.
