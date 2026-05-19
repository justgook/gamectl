# GAMS Demo Project

This folder is a sample GAMS Project. It contains a `gams.json` Project Config, example assets, scripts, views, generated output, and issue markdown files used by the demo UI.

## Try it

From the repository root:

```sh
make app-run
```

The app starts with `examples/demo` as the project workspace by default.

## What is in here?

- `gams.json` — Project Config declaring views, UI services, key bindings, and demo-specific settings.
- `issues/` — markdown issue cards used by `view-issues`.
- `ng/` — node-graph scripts and visual assets.
- `tilemap/` — tilemap example assets.
- `vox/` — MagicaVoxel preview asset.
- `keys/` — Lua scripts used by configured key bindings.
- `tmp/` and `output/` — generated/demo output files.

## Markdown preview

Markdown files (`*.md`) open with the demo Markdown view from `view-files`. Double-click this file in the Files view to preview it rendered as Markdown.

## Notes

Some folders are symlinks back to repository-level Project Units, such as `views`, `themes`, and `ui-plugins`, so this demo can use the local development versions.
