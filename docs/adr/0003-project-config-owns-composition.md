# Project config owns long-term GAMS composition

During development, built-in base plugins such as `gams:fs` may be hardcoded into host bootstrap so the runtime can move quickly. Long term, GAMS will be a small orchestration/plugin-management runtime and each project config will define the moving parts that make that project its own tool: plugins, views, UI plugins, themes, scripts, presets, and per-plugin/view configuration, runnable by different hosts such as browser and CLI.
