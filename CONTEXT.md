# GAMS

GAMS is a plugin-driven CMS/toolkit for managing game assets, game data, and related workflows.

## Language

**GAMS**:
The Game Assets Management Tool, a CMS/toolkit for managing game assets and related workflows.
_Avoid_: gamectl when referring to the product; gamectl is the historical repository name.

**Plugin**:
A callable unit of behavior that exposes functions and can be loaded by a host or called by another plugin.
_Avoid_: module, extension, package when specifically referring to GAMS runtime units.

**Host**:
A runtime shell such as the browser UI or CLI that loads a project-defined GAMS composition and provides environment-specific integration.
_Avoid_: app, frontend, backend when the runtime shell boundary is what matters.

**Plugin Manager**:
The umbrella runtime service responsible for plugin registration/loading and plugin-to-plugin call routing.
_Avoid_: loader, registry, or router when referring to the full responsibility set.

**Plugin Registration/Loading**:
The Plugin Manager responsibility that discovers, validates, orders, and instantiates plugins for a host.
_Avoid_: call routing.

**Call Routing**:
The Plugin Manager responsibility that dispatches calls from hosts or plugins to registered plugin exports.
_Avoid_: loading.

**Singleton Plugin**:
A plugin with one logical runtime per host environment and the preferred model for new work.
_Avoid_: global plugin.

**Instance Plugin**:
A plugin runtime created by another plugin or view; a legacy migration pattern.
_Avoid_: child plugin unless describing ownership only.

**View Plugin**:
A browser-rendered plugin registered and routed through the plugin manager.
_Avoid_: special-case view, host callback view.

**Legacy Markdown**:
Pre-consolidation documentation archived under `docs/legacy/` for conversion into current PRDs, ADRs, and domain docs.
_Avoid_: canonical docs once converted material exists elsewhere.

**Yoinking**:
Competitive inspiration captured for possible GAMS adaptation before any implementation decision is made.
_Avoid_: requirement, decision, commitment.

**Yoinking Record**:
A pre-decision idea document describing an external inspiration source, what GAMS might learn from it, and how it could be adapted or dismissed.
_Avoid_: PRD, ADR, specification.

**Project Config**:
The project-owned declaration of the plugins, views, UI plugins, themes, scripts, presets, and configuration that make a GAMS project run as a specific tool.
_Avoid_: host config when the declaration belongs to the project.

**GAMS Runtime**:
The small orchestration layer responsible for plugin management and host integration, not for owning project-specific behavior.
_Avoid_: application when referring to the reusable runtime.

**Project**:
A configured GAMS workspace that declares its moving parts through Project Config and can be run by different Hosts.
_Avoid_: app, GAMS instance, GAMS application.

**GAMS Distribution Package**:
A separately distributed plugin, view, UI plugin, theme, script, preset, or related asset that can be referenced by Project Config.
_Avoid_: package when ambiguity with language package managers matters.

## Relationships

- A **Host** runs a **Project** by loading its **Project Config** through the **GAMS Runtime**.
- A **Host** uses **Plugin Registration/Loading** through the **Plugin Manager**.
- A **Plugin** may use **Call Routing** through the **Plugin Manager** to call another **Plugin**.
- A **View Plugin** is a **Plugin** that renders browser UI.
- A **Singleton Plugin** is the preferred target model for new **Plugins**.
- An **Instance Plugin** is legacy/migration-only unless explicitly clarified.
- **Legacy Markdown** is source material for PRDs, ADRs, and this glossary.
- A **Yoinking Record** may become source material for a PRD, ADR, or glossary update, or may be dismissed with a reason.
- A **Project Config** references **GAMS Distribution Packages** and local project configuration.

## Example dialogue

> **Dev:** "Should this browser view call back into the host directly?"
> **Domain expert:** "No. If it is first-party GAMS behavior, model it as a **View Plugin** and route plugin-to-plugin calls through the **Plugin Manager** unless a plan explicitly says otherwise."

## Flagged ambiguities

- "gamectl" is the historical repository name; use **GAMS** for the product/toolkit unless referring specifically to the repo.
