# Character card image assets

Character pages reference these files directly. Replace an image **in place with the same filename** to update the wiki without editing Markdown or HTML.

## File contract

Each Character directory contains:

- `portrait.svg` — Character-level institutional portrait; `800 × 1000` view box.
- `sprite.svg` — Character-level in-game presentation; `960 × 540` view box.
- `<specialization>-portrait.svg` — Specialization portrait; `800 × 1000` view box.
- `<specialization>-sprite.svg` — Specialization in-game presentation; `960 × 540` view box.

The current SVGs are replaceable visual placeholders. Keep the existing path, filename, view box/aspect ratio, and accessible `<title>`/`<desc>` when replacing them. A final SVG may embed raster artwork if the source art pipeline requires it.
