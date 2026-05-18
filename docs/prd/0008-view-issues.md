# View Issues Core View

## Status

Draft

## Source material

- User midnight idea captured in conversation on 2026-05-18.
- `docs/reference/gams-view-development-guide.md`
- `docs/prd/0003-project-config.md`
- `docs/prd/0005-frontend-view-and-ui-service-bridge.md`

## Problem

GAMS needs a simple project issue dashboard that treats issues as project-owned markdown files instead of depending on an external tracker or host-specific UI. The first version should feel like early Trello: configured columns, simple cards, and filesystem-backed content.

## Goals

- Provide a first-party `view-issues` Core View.
- Load issues from markdown files under `config.defaultSource`.
- Use markdown frontmatter as structured issue metadata.
- Render a board from configurable frontmatter filters.
- Sort cards through simple configured sort options.
- Keep the implementation host-thin and filesystem-backed through `gams:fs`.

## Non-goals

- No sidepanel in v1.
- No embedded custom views in v1.
- No general issue editing UI in v1; drag/drop only updates configured scalar frontmatter fields.
- No custom sort functions in v1.
- No recursive issue directory traversal in v1.

## Issue file format

Each issue is a markdown file with frontmatter:

```md
---
title: View issues board
description: short description that will be shown in card
status: open
tags: [idea, view]
---

Build a kanban-like issue board from markdown files.
```

Required frontmatter fields for v1:

- `title`: card heading.
- `description`: short card text.

Other fields are project-defined and become useful when referenced by `filter` or `sort` config.

## Project Config

`view-issues` uses `config.defaultSource`, matching the intended view-specific config placement for Project Config v1.

```json
{
  "views": {
    "issues": {
      "url": "builtin/views/view-issues.js",
      "label": "Issues",
      "group": "Project",
      "config": {
        "defaultSource": ".scratch/issues",
        "filter": {
          "status": ["open", "in-progress", "done"],
          "tags": ["idea", "plugin", "view"]
        },
        "sort": {
          "status": ["open", "in-progress", "done"],
          "mtime": "dsc",
          "ctime": "asc",
          "atime": "dsc"
        },
        "dnd": {
          "status": ["open", "in-progress", "done"]
        }
      }
    }
  }
}
```

The current prototype host still reads legacy `ui.views`; the view's config shape is intentionally aligned with Project Config v1 by putting `defaultSource` inside the view `config` object.

## Requirements

- `filter` is a config object whose keys are frontmatter fields and whose values are ordered arrays of rendered column values.
- The header filter selector lists filter keys only, for example `status` and `tags`.
- Selecting a filter renders one table column per configured value, in configured order.
- If an issue's selected filter value is missing or not listed in config, that issue is not rendered for that filter.
- Scalar frontmatter values render in one matching column.
- Array frontmatter values render in each matching configured column.
- `sort` is a config object whose keys populate the header sort selector.
- Sort values may be enum arrays, such as `status: ["open", "in-progress", "done"]`.
- Built-in filesystem sort keys are `mtime`, `ctime`, and `atime` with direction values `asc` or `dsc`.
- Built-in filesystem sort values come from `gams:fs` stat results.
- `dnd` is an optional config object whose keys reference configured filters and whose values list the columns that allow drag/drop moves.
- Drag/drop updates the selected scalar frontmatter field by rewriting the issue markdown through `gams:fs`.
- Drag/drop is active only when the selected filter key appears in `dnd`.
- The initial implementation uses `table[data-layout="separate"]` for the board.
- Each table cell may contain issue cards rendered as `blockquote[data-element="issue-card"]` with `blockquote > header` as the card/window title; GAMS uses HTML as app building blocks, so element choice follows the app/theme vocabulary rather than only general web-page semantics.

## Acceptance criteria

- `views/view-issues.js` registers a `view-issues` custom element.
- Example demo config includes `view-issues`.
- Example markdown issues exist under the configured source directory.
- `gams:fs` stat returns `mtime`, `ctime`, and `atime` fields usable by the view sort selector.

## Open questions

- None for the current v1 slice.
- Should descending sort config stay spelled `dsc`, or should a later config migration use `desc`?
- Should future versions support drag/drop for array fields such as `tags`, or should DnD stay scalar-field-only?
