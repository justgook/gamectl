# Project Config and Project Units

## Status

Draft

## Source material

- `docs/prd/0002-runtime-plugin-manager.md`
- `docs/adr/0003-project-config-owns-composition.md`
- `CONTEXT-MAP.md`
- `docs/contexts/project-composition/CONTEXT.md`
- `examples/demo/gams.json` (work-in-progress config source material)

## Problem

GAMS is moving toward a small runtime that only orchestrates and manages plugins, while each Project defines the tool it becomes through Project Config. Project Config needs a clear first version so Projects can declare their Project Units and later run across multiple hosts such as browser and CLI.

## Goals

- Define Project Config as the source of truth for Project composition.
- Support Project Units: theme, plugins, views, and UI Services.
- Include configuration for each Project Unit.
- Treat presets as part of view configuration, not top-level Project Config.
- Treat scripts as part of UI Service key/action configuration, not top-level Project Config.
- Support JSON Schema validation distributed with Project Units.
- Prepare for Project Units to be distributed as separate packages/downloadable instances and eventually separate repositories.

## Non-goals

- Do not specify the complete package manager/download mechanism yet.
- Do not require all Project Units to live in separate repositories during the prototype phase.
- Do not make host-specific boot code the long-term source of Project composition.

## Requirements

- Project Config v1 uses object maps keyed by Project-local ids, not arrays of entries, for all Project Unit collections including `plugins`, `views`, and `ui-services`.
- Project Config v1 flattens Project Unit sections to the top level, rather than nesting GUI sections under `ui`.
- Project Config v1 has top-level sections for:
  - `theme` as a single active theme object,
  - `plugins`,
  - `views`,
  - `ui-services`.
- A Project Unit is enabled by being present in Project Config; v1 does not need an `enabled` field.
- Project Unit entries use this initial core shape:

  ```json
  {
    "url": "plugins/fs.comp.wasm",
    "config": {}
  }
  ```

- Existing work-in-progress config examples also use fields such as `label`, `group`, `internal`, `defaultSource`, `runtime`, `role`, `deps`, and `memory`; v1 resolves these as follows:
  - View core-owned fields: `url`, `config`, `label`, `group`, `internal`.
  - View unit-owned config fields: `defaultSource` and other view-specific behavior.
  - Plugin core-owned fields for v1: `url` and `config` only.
  - Plugin `deps` are resolved from the WASM component itself, not Project Config.
  - Plugin `runtime`, `role`, and `memory` are removed from v1 Project Config.
- Core-owned entry fields are defined by the core Project Config schema.
- Unit-owned `config` shape is defined by the JSON Schema distributed with that Project Unit.
- Project Unit JSON Schemas validate against the same whole `gams.json`, so a unit can target paths such as `views.main.config`, `ui-services.keys.config`, or `theme.config` without owning the rest of the file.
- `theme.config` may be extended/validated by Project Units by schema only: a Project Unit schema may validate any part of `theme.config` it needs.
- This can create overlapping schema ownership, but v1 accepts that trade-off because GAMS is currently a one-person project and shared theme declarations give more value than strict conflict prevention.
- Per-view overrides, schema ownership declarations, and conflict validation are out of scope for v1.
- For example, `view-ng` can validate canvas-rendering theme fields that currently live under `view-ng.config.theme` in `examples/demo/gams.json`, and those fields may be reused by other views.
- The Project Config parser must reject duplicate object keys before schema validation.
- Each Project Unit may provide JSON Schema for validating its configuration.
- Hosts load Project Config and use the GAMS Runtime/Plugin Manager to load and orchestrate declared Project Units.
- The same Project Config should be usable by multiple hosts when those hosts support the declared Project Units.
- Prototype/dev-mode hardcoded loading is allowed only as a temporary bridge.
- Project Config v1 is JSON only.
- The default Project Config filename is `gams.json` in the Project root.
- Future hosts/runtimes should support starting with a different config path/name through arguments, flags, or equivalent host-specific launch configuration.

## Example v1 shape

```json
{
  "theme": {
    "url": "themes/the98.css",
    "config": {
      "canvas": {
        "clear": [0.043, 0.098, 0.133, 1],
        "text": [0.839, 0.925, 0.973, 1],
        "selection": [0.29, 0.78, 1.0, 1]
      }
    }
  },
  "plugins": {
    "fs": {
      "url": "builtin/plugins/fs.wasm",
      "config": {}
    },
    "sql": {
      "url": "builtin/plugins/sql-vec.wasm",
      "config": {}
    }
  },
  "views": {
    "view-ng": {
      "url": "views/view-ng.js",
      "label": "Nodegraph",
      "group": "Generation",
      "internal": false,
      "config": {
        "defaultSource": "assets.ng.json"
      }
    }
  },
  "ui-services": {
    "keys": {
      "url": "ui-services/keys.js",
      "config": {
        "bindings": [
          {
            "key": "mod+s",
            "script": "keys/save-active-view.lua",
            "allowInput": true
          },
          {
            "key": "escape",
            "script": "keys/escape.lua",
            "allowInput": false
          }
        ]
      }
    }
  }
}
```

## Acceptance criteria

- Project Composition vocabulary is captured under `docs/contexts/project-composition/CONTEXT.md`.
- Runtime PRD delegates Project Config details to this PRD.
- Future Project Config schema work uses **Project Unit** as the umbrella term.

## Open questions

- None for v1 documentation. Implementation and migration of `examples/demo/gams.json` start after legacy docs are converted/removed.
- How are Project Units addressed: local paths, package ids, URLs, registry ids, or a mix?
- Does Project Config validation happen host-side before loading any Project Units, or incrementally as schemas are discovered?

## Related ADRs

- `docs/adr/0003-project-config-owns-composition.md`
