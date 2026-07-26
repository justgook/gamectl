---
title: Using This Wiki
summary: Authoring reference and examples for the no-build Markdown wiki itself, kept separate from the game documentation.
eyebrow: Wiki guide
status: reference
---

This section documents the wiki engine and its authoring features. It is intentionally separate from the game-design and production sections above it.

## What the wiki provides

- Markdown pages loaded directly in the browser without a build step.
- Hash-based navigation, shareable links to page sections, and nested collapsible sidebar categories.
- `[[Wiki links]]` between pages.
- YAML frontmatter with enforced page statuses: accepted, in-progress, todo, or reference.
- Visually distinct document markers for accepted decisions, open work, questions, evidence, and missing artifacts.
- Syntax-highlighted fenced code blocks.
- Mermaid diagrams authored inside Markdown.
- Source files included as code blocks, with ranges and highlighted lines.

## Guide pages

- [[Wiki/Markdown Authoring|Markdown and navigation]] explains pages, metadata, links, and sidebar structure.
- [[Wiki/Markdown Cheat Sheet|Markdown cheat sheet]] demonstrates common text, list, table, quote, and code syntax.
- [[Wiki/Formulas|Formula examples]] documents LaTeX-style inline and display math rendered with KaTeX.
- [[Wiki/Diagrams|Diagram examples]] documents Mermaid syntax with rendered examples.
- [[Wiki/Code Includes|Code include examples]] documents whole-file inclusion, source ranges, and highlighted lines.

## Run locally

From `examples/demo/wiki`:

```sh
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). A local HTTP server is required because the browser fetches Markdown and included source files at runtime.

## Boundary

Pages under **Start here**, **Game design**, and **Production** describe the game. Pages under **Wiki guide** describe this documentation tool. Example source files used only by this guide live under `content/wiki/examples/`.
