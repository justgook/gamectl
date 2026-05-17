# PRD: Documentation consolidation issue tracker

Status: ready-for-agent

Canonical PRD: `docs/prd/0001-docs-consolidation.md`

This local tracker breaks the legacy markdown conversion into bounded, agent-grabbable slices. Each issue should use the `grill-with-docs` style loop described in `docs/README.md`:

1. read relevant legacy docs and nearby code;
2. update `CONTEXT.md` for resolved domain terms;
3. ask one question at a time for remaining ambiguity, with a recommended answer;
4. write/update a focused PRD under `docs/prd/`;
5. create ADRs only when the ADR threshold is met;
6. update `docs/legacy/INDEX.md` with conversion links.
