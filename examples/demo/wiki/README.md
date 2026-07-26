# Imprint Zero Wiki

No-build Markdown GDD and knowledge base for Imprint Zero.

## Run

From this directory:

```sh
python3 -m http.server 8080
```

Open <http://localhost:8080>.

A local HTTP server is required because browsers do not allow `fetch()` to read Markdown reliably from `file://` URLs. There is no build, dependency install, or generated content.

## Authoring

- Pages are Markdown files under `content/`.
- Every page requires YAML frontmatter with a `title` and a status: `accepted`, `in-progress`, `todo`, or `reference`.
- Status marker blockquotes such as `> **Accepted** — ...`, `> **Open question** — ...`, and `> **Needs image** — ...` distinguish decided content from missing work inside a page.
- `content/_sidebar.md` defines navigation using Markdown headings and lists.
- Headings are section separators. A top-level list item with children becomes a collapsible category and must itself be a wiki link to a content page.
- `content/_config.md` defines the wiki title, description, and home page.
- Wiki links use `[[Page Name]]` or `[[target/path|Visible label]]`.
- A target is converted to a lowercase kebab-case file path. For example, `[[Gameplay/Core Loop]]` opens `content/gameplay/core-loop.md`.
- Footnotes use GFM syntax: reference with `[^label]` and define with `[^label]: Footnote text`.
- Formulas use LaTeX-style `$...$` inline or `$$` display delimiters and are rendered with KaTeX.
- Mermaid diagrams use fenced `mermaid` blocks:

  ````md
  ```mermaid
  flowchart LR
      Idea --> Prototype --> Decision
  ```
  ````

See [[Wiki/Diagrams]] in the running wiki for flowchart, sequence, and state-diagram examples.

### Include source code

Code includes use VuePress-compatible syntax. Paths are relative to the Markdown page and must remain inside `content/`:

```md
@[code](./examples/encounter-state.js)
@[code{11-21} javascript](./examples/encounter-state.js)
@[code{16-29} javascript{2,4-6}](./examples/encounter-state.js)
```

- `{11-21}` selects original source lines.
- `javascript` explicitly selects the highlighting language; otherwise it is inferred from the extension.
- `{2,4-6}` highlights lines relative to the displayed snippet.

See [[Wiki/Code Includes]] in the running wiki for rendered examples. The complete in-wiki authoring reference starts at [[Wiki/Overview]].

## Vendored browser libraries

The `vendor/` directory contains:

- Marked, js-yaml, Highlight.js, and its GitHub Dark theme copied from <https://github.com/justgook/justgook.github.io>.
- marked-footnote 1.4.0 from jsDelivr, with its MIT license in `vendor/marked-footnote.LICENSE`.
- KaTeX 0.16.22 and its fonts, with its MIT license in `vendor/katex/LICENSE`.
- marked-katex-extension 5.1.10, with its MIT license in `vendor/marked-katex.LICENSE`.
- Mermaid 11.12.0 from cdnjs, with its MIT license in `vendor/mermaid.LICENSE`.

Keeping these files local makes the wiki usable offline.
