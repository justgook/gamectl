# Context Map

GAMS currently lives in one repository, but the domain should be documented as multiple contexts because the long-term direction is to split Project Units into separate repositories/packages.

## Contexts

- [Core Runtime](./docs/contexts/core-runtime/CONTEXT.md) — GAMS Runtime, hosts, Plugin Manager, plugin registration/loading, call routing, and WIT interface compatibility.
- [Project Composition](./docs/contexts/project-composition/CONTEXT.md) — Projects, Project Config, Project Units, distribution packages, config schemas, themes, views, UI Services, presets, and scripts.
- [Documentation System](./docs/contexts/documentation-system/CONTEXT.md) — legacy markdown conversion, PRDs, ADRs, Yoinking records, and documentation workflow.

## Relationships

- **Project Composition → Core Runtime**: Project Config declares Project Units; Core Runtime loads and orchestrates them.
- **Core Runtime → Project Composition**: hosts run Projects by loading their Project Config through the GAMS Runtime.
- **Documentation System → Core Runtime / Project Composition**: legacy docs and Yoinking records are converted into context-specific glossary entries, PRDs, and ADRs.

## Repository split direction

When Project Units move into separate repositories, each repository should own its local context docs and ADRs. This root context map remains the cross-context index for the current monorepo/prototype phase.
