# Project Composition

Project Composition covers Projects, Project Config, Project Units, distribution packages, config schemas, themes, views, UI Services, presets, and scripts.

## Language

**Project**:
A configured GAMS workspace that declares its moving parts through Project Config and can be run by different Hosts.
_Avoid_: app, GAMS instance, GAMS application.

**Project Config**:
The project-owned JSON `gams.json` declaration of Project Units and their configuration that make a Project run as a specific tool.
_Avoid_: host config when the declaration belongs to the Project; standalone scripts/presets as top-level Project Config categories; YAML/TOML for v1.

**Project Unit**:
A theme, plugin, view, or UI Service that can be referenced by Project Config and may provide its own configuration schema.
_Avoid_: component because WASM components already use that term; asset because GAMS manages game assets.

**UI Service**:
A singleton GUI-host service that provides UI-facing behavior such as key bindings, actions, scripts, context menus, layout helpers, toast notifications, or popup services.
_Avoid_: UI plugin, frontend plugin, view service.

**Core View**:
A View provided and supported by the official GAMS development team, expected to follow the GAMS View Development Guide so themes can style Core Views consistently.
_Avoid_: builtin view when the important distinction is official support and UI vocabulary compliance.

**Minimap Component**:
The current minimap Project Unit, named `minimap.comp`, that converts tree-shaped room structure input into tilemap-shaped minimap output.
_Avoid_: minimap2 when referring to the current Project Unit.

**Project Unit Styleguide**:
A protected reference guide that defines supported development patterns for an official GAMS Project Unit family.
_Avoid_: suggestion or example when the guide is normative for first-party code.

**GAMS Distribution Package**:
A separately distributed Project Unit or related asset/config schema that can be referenced by Project Config.
_Avoid_: package when ambiguity with language package managers matters; top-level scripts/presets.

## Relationships

- A **Project Config** references **Project Units**, **GAMS Distribution Packages**, and local project configuration.
- **Project Config** uses top-level Project Unit sections and object maps keyed by Project-local ids so Project Unit schemas can validate stable paths in the same `gams.json`.
- The default **Project Config** file is `gams.json` in the **Project** root; alternate config paths are a future host/runtime launch feature.
- `theme` is a single active theme object in **Project Config** v1.
- `theme.config` may be extended and validated by Project Units by schema only; v1 does not require ownership declarations for theme subtrees.
- Presets belong to view configuration, not top-level **Project Config**.
- Scripts belong to UI Service key/action configuration, not top-level **Project Config**.
- View `label`, `group`, and `internal` are host-facing metadata; view `defaultSource` belongs to view-specific configuration.
- Plugin Project Config entries use only `url` and `config` in v1; dependencies come from WASM component imports/exports.
- A **Project** can be run by different Hosts when those Hosts support the Project Units it declares.
- A **Core View** is a first-party **Project Unit** and should follow the GAMS View Development Guide.
- A **Minimap Component** may participate in example generation compositions, but those compositions are not mandatory global Project architecture.
- A **Project Unit Styleguide** is normative for official GAMS Project Units it covers and should only change with explicit approval.

## Example dialogue

> **Dev:** "Is this preset a top-level Project Config section?"
> **Domain expert:** "No. Presets belong to the specific view configuration, for example `view-ng`, and may be distributed separately from the main GAMS distribution."

## Flagged ambiguities

- "moving parts" is resolved as **Project Units**.
- "ui-plugin" is resolved as **UI Service**; old code/paths may still use `ui-plugins` during migration.
- Use **Project**, not "GAMS instance", for the configured tool/workspace.
