# Ecosystem documentation publishing

## Status

Draft — dedicated aggregate repository and released-version default confirmed; implementation details require clarification.

## Source material

- `docs/ideas/yoinking/2026-09-06-federated-project-unit-wikis.md`
- https://wiki.z0.lv
- `docs/README.md`
- `CONTEXT-MAP.md`

## Problem

Separately distributed Project Units and Hosts need locally owned documentation and a coherent public ecosystem entry point without separately maintained copies of the same content.

## Goals

- Keep documentation ownership with each Project Unit/Host repository.
- Publish individual documentation sites using the user's wiki engine.
- Provide a unified GAMS documentation site independently of runtime releases.

## Non-goals

- Add documentation aggregation behavior to the GAMS Runtime or Hosts.
- Change protected reference/styleguide content or editing rules.
- Publish every repository file automatically.

## Requirements

### Confirmed direction

- The aggregate wiki belongs in a dedicated `kkgams/docs` repository, not a runtime/Host repository.
- Individual Project Unit/Host repositories own their documentation sources.
- The intended publishing approach uses the wiki engine documented at https://wiki.z0.lv, per-repository GitHub Pages sites, and GitHub Actions to collect documentation for the aggregate site.
- Aggregated documentation is generated from repository-owned sources rather than separately maintained copies.
- The public wiki defaults to released versions, with each included Unit/Host's documentation pinned to its release tag rather than a development branch.
- Development documentation, if published, is clearly separated from released documentation.

### Proposed implementation sequence

1. Establish a documentation content layout and individual-site publishing workflow with the first extraction pilot.
2. Prove aggregation of pilot repositories into namespaced content with combined navigation.
3. Verify relative links, wiki links, images, and code includes in individual and aggregate sites.
4. Extend publishing to further extracted Units and Hosts.
5. Add ecosystem installation, composition, and showcase entry points to the aggregate site.

## Acceptance criteria

- Documentation can be updated beside its owning implementation and published individually.
- The aggregate site identifies each included repository and source ref.
- Included pages, links, assets, and navigation work under aggregate-site paths.
- The aggregate site is built and deployed without a GAMS runtime release.
- Inclusion and version selection are explicit; missing required sources fail the build visibly rather than silently disappearing.

## Open questions

- How are released documentation refs selected and updated across independently versioned Units and Hosts?
- Exact content roots, repository inclusion manifest, cross-repository linking convention, and navigation composition.
- Engine version pinning and any required engine changes; aggregation is not yet verified as an existing engine capability.
- Refresh triggers, permissions, and GitHub Pages destination.

## Related ADRs

- `docs/adr/0001-docs-architecture.md`
