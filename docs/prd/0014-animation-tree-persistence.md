# Animation Tree persistence

## Status

Accepted

## Context

- `docs/contexts/project-composition/CONTEXT.md`
- `docs/prd/0013-animation-transition-conditions.md`
- `views/view-animation-tree.js`
- `packages/util/animation-tree.js`

## Problem

The Animation Tree editor always starts from an in-memory prototype document. Its New, Open, Save, Save As, and Reload controls are disabled, so authored Animation Trees, Animation Parameters, and transition conditions cannot be stored or reopened.

## Goals

- Persist complete Animation Tree documents through the existing filesystem and file-picker services.
- Enable every file action already present in the Animation Tree header.
- Preserve strict Animation Tree validation at filesystem boundaries.
- Keep failed reads, parsing, validation, and writes from replacing the current valid document.

## Non-goals

- A storage envelope, file-format version field, or migration framework.
- Requiring or enforcing a filename extension.
- Unsaved-change confirmation prompts.
- Autosave, external file watching, conflict detection, or recovery files.
- Runtime evaluation of Animation Trees.

## Requirements

### Stored document

- A file contains the Animation Tree document directly as JSON, without an outer envelope.
- `.anim.json` is the suggested naming convention, not a required suffix.
- Save As accepts any file path and does not append, replace, or reject suffixes.
- Save As does not derive or change the document's internal `name` from the selected filename.
- JSON is written with two-space indentation and a trailing newline.

### Source identity

- The active filesystem path is exposed as the view's `data-source` attribute.
- The shared View source-state mechanism restores the most recently active `data-source` when a new Animation Tree view has no explicit source, and the editor opens that restored document after connection setup.
- Successful Open and Save As update `data-source`.
- Save and Reload reuse the active `data-source`.
- New clears `data-source` and creates an unsaved in-memory document.
- Save invokes Save As when no active source exists.
- Reload is disabled while no active source exists.

### File actions

- New creates a new Animation Tree with a State Machine root, required Start and End nodes, no authored states or transitions, and no Animation Parameters.
- Open selects one arbitrary file and replaces the current document only after successful read, JSON parse, and strict Animation Tree validation.
- Save validates and writes the current complete Animation Tree to its active source.
- Save As selects an arbitrary target, validates and writes the document, then adopts that path as the active source.
- Reload rereads the active source and replaces the current document only after successful parse and validation.
- New, Open, and Reload discard current edits without confirmation.
- New, Open, Save, Save As, and Reload remain blocked while an invalid inline editor draft is active.

### Replacement and failures

- Successful New, Open, and Reload return navigation to the root Animation Node, clear graph selection and transient interactions, and reset undo/redo history.
- A malformed JSON file or structurally invalid Animation Tree reports an error and leaves the current document unchanged.
- A failed write reports an error and does not adopt a new source path.
- Successful operations report status and toast feedback.

## Acceptance criteria

- All five Animation Tree file-action buttons are enabled appropriately and invoke working editor methods.
- New produces the required empty in-memory document; Save routes it through Save As.
- Open and Save As use unrestricted file selection while suggesting `.anim.json` for a new filename.
- Saved JSON round-trips Animation Parameters and transition conditions without an envelope.
- Open, Save As, and source restoration keep `data-source` synchronized, and a newly mounted view reopens its last active document.
- Reload is unavailable without a source and reloads the current source when available.
- Invalid external data and filesystem failures preserve the current document and report an error.
- Persistence behavior has focused model and DOM-contract coverage.

## Related ADRs

None. These are local editor and storage-format decisions; the direct JSON shape can be extended through a future focused migration decision if required.
