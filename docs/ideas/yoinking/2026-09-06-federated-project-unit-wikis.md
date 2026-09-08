# Yoinking: Federated Project Unit wikis

Status: converted
Date: 2026-09-06
Source: https://wiki.z0.lv ; user-proposed per-repository GitHub Pages documentation and aggregate GAMS wiki

## Source summary

The user's wiki engine renders plain Markdown in the browser, with navigation from `_sidebar.md` and settings from `_config.md`. Its published guide describes a reusable `justgook/wiki` GitHub Action that assembles the runtime and content for static hosting. The user proposes individual Project Unit/Host sites and an aggregate site assembled by GitHub Actions from kkgams repositories.

## What we like

- Repository-owned Markdown documentation published without vendoring the wiki engine.
- Individual documentation sites alongside a unified ecosystem entry point.
- The same source content can serve local Unit documentation and the combined wiki.

## What we dislike / should avoid

- Proposed: avoid separately maintained copies of documentation in the aggregate repository.
- Proposed: avoid accidentally publishing internal material or mixing incompatible release documentation.

## GAMS adaptation hypotheses

- Each Project Unit/Host repository owns its documentation and can publish its own GitHub Pages wiki.
- A dedicated documentation site repository fetches declared repositories at recorded refs, namespaces their content, and builds combined navigation.
- Aggregate-site generation remains publication tooling rather than GAMS Runtime behavior.
- Establish the documentation layout with the first repository extraction pilot, then expand aggregation as Units move.

## Possible use in GAMS

- Users discover installation, Project composition, compatibility information, and Unit-specific guides through one site.
- Maintainers update documentation beside the implementation it describes.

## Risks / mismatches

- Aggregation support is a proposal, not a verified existing wiki-engine capability.
- Relative links, wiki links, code includes, images, and page identities must remain correct under namespaced paths.
- Local branding/config/sidebar files need explicit aggregate-site handling.
- Repository selection, content roots, release refs, refresh triggers, permissions, and missing-source failure behavior require definition.
- Internal PRDs/ADRs and protected reference documents retain their existing roles and editing rules; publishing does not authorize rewriting them.

## Open questions for grilling

- Resolved: aggregation belongs in the dedicated `kkgams/docs` repository rather than a runtime/Host repository.
- Resolved: public documentation defaults to released versions pinned by release tag; any development documentation is separate.
- Which content belongs in public sites, and how are cross-repository links declared?

## Conversion outcome

Converted to `docs/prd/0016-ecosystem-documentation.md`. The user confirmed a dedicated `kkgams/docs` aggregate repository. The user also confirmed released-version documentation as the default. Implementation details remain open; no repositories, workflows, or runtime changes have been created.
