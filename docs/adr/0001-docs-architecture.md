# Use PRDs, ADRs, and a domain glossary as the canonical documentation architecture

GAMS had accumulated planning notes, TODOs, READMEs, specs, and handoff documents in many locations, making it unclear which documents were canonical. We archived pre-consolidation markdown under `docs/legacy/`, made `CONTEXT.md` the glossary-only domain document, use `docs/prd/` for requirements and migration slices, and use `docs/adr/` only for hard-to-reverse architectural decisions so future agents convert legacy material instead of extending it in place.

## Consequences

- Legacy files preserve source material and original paths but are not canonical once converted.
- Conversion should follow a `grill-with-docs` loop: inspect legacy docs/code, resolve terminology into `CONTEXT.md`, ask one question at a time for ambiguity, then write focused PRDs/ADRs.
- ADRs remain intentionally small; PRDs carry most planning detail.
