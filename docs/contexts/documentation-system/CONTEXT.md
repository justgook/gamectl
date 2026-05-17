# Documentation System

Documentation System covers legacy markdown conversion, PRDs, ADRs, Yoinking records, and documentation workflow.

## Language

**Legacy Markdown**:
Pre-consolidation documentation archived under `docs/legacy/` for conversion into current PRDs, ADRs, and domain docs.
_Avoid_: canonical docs once converted material exists elsewhere.

**Yoinking**:
Competitive inspiration captured for possible GAMS adaptation before any implementation decision is made.
_Avoid_: requirement, decision, commitment.

**Yoinking Record**:
A pre-decision idea document describing an external inspiration source, what GAMS might learn from it, and how it could be adapted or dismissed.
_Avoid_: PRD, ADR, specification.

## Relationships

- **Legacy Markdown** is source material for PRDs, ADRs, and this glossary.
- A **Yoinking Record** may become source material for a PRD, ADR, or glossary update, or may be dismissed with a reason.

## Example dialogue

> **Dev:** "Should I implement this Yoinking idea now?"
> **Domain expert:** "No. First convert the useful parts through grill-with-docs into a PRD/ADR or dismiss it with a reason."

## Flagged ambiguities

- Yoinking records are inspiration records, not implementation decisions.
