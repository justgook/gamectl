# Imprint Zero Wiki

Project-owned content and presentation for the Imprint Zero GDD. The reusable no-build wiki runtime comes from the `repos/wiki` Git submodule.

## Checkout

From the GAMS repository root:

```sh
git submodule update --init repos/wiki
```

The runtime files in this directory are relative symlinks into that checkout:

- `app.js`
- `index.html`
- `style.css`
- `vendor/`

This project owns `content/`, `custom.css`, and `favicon.svg`. The runtime repository's own `content/` contains its deployed **Wiki guide** demo and is intentionally not imported here.

## Run

From this directory:

```sh
python3 -m http.server 8080
```

Open <http://localhost:8080>.

A local HTTP server is required because browsers do not allow `fetch()` to read Markdown reliably from `file://` URLs. There is no build or dependency installation.

## Authoring

- Pages are Markdown files under `content/`.
- Every page requires YAML frontmatter with a `title` and a status: `accepted`, `in-progress`, `todo`, or `reference`.
- `content/_sidebar.md` defines navigation using Markdown headings, lists, and wiki links.
- `content/_config.md` defines the wiki title, description, and home page.
- Wiki links use `[[Page Name]]` or `[[target/path|Visible label]]`.
- Required images must be embedded as image files. Use an explicit placeholder image when the final asset is unavailable.
- Footnotes use GFM `[^label]` syntax.
- Formulas use KaTeX `$...$` or `$$...$$` delimiters.
- Mermaid diagrams use fenced `mermaid` blocks.
- Code includes use VuePress-compatible `@[code](path)` syntax and must stay inside `content/`.

See the **Wiki guide** in the `repos/wiki` checkout or its GitHub Pages deployment for the complete authoring reference and rendered examples.
