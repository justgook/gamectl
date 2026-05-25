# Issue tracker: Local Markdown

Implementation issues and PRDs for this repo live as markdown files in `.scratch/`.

Demo-visible issue-board cards live under `examples/demo/issues/`. Use them for demo/reference discussion cards, archived example follow-ups, and anything the browser issue board should show.

## Conventions

- One implementation feature per directory: `.scratch/<feature-slug>/`
- The implementation PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state for `.scratch` issues is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Demo issue-board cards are `examples/demo/issues/<slug>.md` with YAML frontmatter: `title`, `description`, `status`, and `tags`
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.
