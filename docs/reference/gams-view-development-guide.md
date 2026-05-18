# GAMS View Development Guide

This is a protected GAMS styleguide. Do not edit, append, rename, or loosen this guide unless the user explicitly approves that styleguide change in the current task. If a Core View needs an undocumented UI pattern, propose the exact guide addition first and implement code only after approval.

This guide defines the supported UI vocabulary for **Core Views**: views provided and supported by the official GAMS development team.

Core Views use themeable semantic elements, classes, and attributes so they can be styled consistently by GAMS themes and behave as one coherent UI surface.

Core Views should be built only from the elements, slots, classes, and attributes documented here. Core View HTML should not contain custom CSS, inline styling, or undocumented elements/patterns. Existing code that does so is legacy/deprecated and a target for rework.

## View layout

### Root

- view root - should stretch to the full Area.
- view custom element root should use `display: contents` so the semantic view children participate directly in the Area layout.

### Main element

Each view should contain exactly one main element.

- `article` - main view render element.
- `canvas` - main view render element when the view renders into canvas.
- `table` - main view render element when the view is primarily tabular.
- `form` - main view render element when the view is primarily an editor, inspector, wizard, or other form-driven workflow.

### Optional elements

Optional elements should appear at most once per view.

- `aside` - optional side panel next to the main view render element.
- `footer` - optional bottom area for status, actions, pagination, or secondary controls.

### Header actions

- `header` - should not be used inside view HTML.
- `[slot="header-controls"]` - header tools/actions area for the view.
- Header controls should use grouped button clusters in this order when present: `file-actions`, tool/domain actions, `edit-actions`, `view-actions`, `config-actions`.
- `[role="buttongroup"][data-element="file-actions"]` - new/open/save/save-as/reload source actions.
- `[role="buttongroup"][data-element="tool-actions"]` - primary view-specific tools/actions.
- `[role="buttongroup"][data-element="edit-actions"]` - copy/cut/undo/redo and similar edit history actions.
- `[role="buttongroup"][data-element="view-actions"]` - viewport/display actions such as grid, zoom, fit, auto-arrange.
- `[role="buttongroup"][data-element="config-actions"]` - properties/settings actions.

### Popup flows

- popup opening/closing should go through `runtime.call('ui.popup', ...)` instead of directly reaching into `popup-manager` from a view.
- prefer dedicated popup views or existing reusable chooser/editor views over inline popup HTML assembled inside another view.
- when add/edit flows are mostly the same, prefer one popup view with a mode prop over near-duplicate popup views.
- reuse existing chooser/editor views such as `view-files`, `view-sql`, and `view-code` when they already fit the job.

## Intent

- `.accent` - primary/default emphasis for main actions and highlighted UI state.
- `.success` - successful/completed/confirmed-good state.
- `.warning` - caution, non-fatal problem, or risky action.
- `.danger` - error, destructive action, or invalid state.
- `.info` - informational or progress state.

## Button groups

- `[role="buttongroup"]` - grouped related buttons, especially compact toolbars and one-off action groups.
- `[role="buttongroup"] > button` - button inside a grouped toolbar.

## Form

- `form` - base element for grouped inputs and actions; default layout is column.
- `fieldset` - grouped subsection inside a form.
- `legend` - title/label for a `fieldset`.
- `label` - form field label.
- `form > footer` - actions area inside forms.
- `input[type="text"]` - standard single-line text input.
- `input[type="number"]` - numeric input.
- `input[type="url"]` - URL input.
- `input[type="search"]` - search input.
- `input[type="email"]` - email input.
- `input[type="password"]` - password input.
- `input[type="checkbox"]` - boolean/toggle form input.
- `input[type="file"]` - native file picker for upload/import actions; may be created hidden and triggered by a documented button.
- `button` - interactive action control.
- `select` - select/dropdown input.
- `option` - option item inside `select`.
- `optgroup` - grouped options inside `select`.
- `textarea` - multiline text input.
- `output` - result or status text for form/view operations.

## Text output

- `pre` - preformatted read-only text output for logs, console transcripts, and whitespace-sensitive textual results.

## File transfer helpers

- `a[download]` - temporary browser download trigger for exporting/downloading files; create programmatically and remove after activation.

## Icons

- `i` - icon element using Material Symbols.
- `button > i` - icon content inside button controls.

## Tables

- `table` - base element for tabular data in UI.
- `table[data-layout="separate"]` - separated-cell table layout for board-like or card-grid views where cells contain block content rather than compact row values.
- `caption` - optional table title/label when the table needs an intrinsic semantic heading.
- `thead` - required table header section.
- `tbody` - required table body section.
- `tfoot` - optional table footer section.
- `tr` - table row.
- `th` - table header cell.
- `td` - table data cell.

## Cards / app windows

GAMS themes may treat `blockquote` as an app-level card/window primitive rather than general prose quotation.

- `blockquote` - card/window block for compact record previews and dashboard items.
- `blockquote > header:first-child` - card/window title bar.
- `blockquote > p` - card/window body text.
- `blockquote > footer` - card/window metadata or secondary status area.
- `blockquote[data-draggable="true"]` - draggable card/window.
- `blockquote[aria-grabbed="true"]` - card/window currently being dragged.
- `blockquote[data-drag-ghost="true"]` - pointer-drag preview clone.

## Data attributes

- `data-*` attributes are allowed for view/widget configuration, behavior flags, and internal DOM hooks.
- `data-*` attributes should not be used as the styling contract for UI.
- `data-element` - stable internal hook for structural subparts in views/widgets.
- `data-action` - stable internal hook for interactive controls/actions.
- `data-field` - stable internal hook for form fields and bindings.
- `data-source` - initial source name to load when mounted. When omitted for a registry-created view, `ui.views.<tag>.defaultSource` from `gams.json` may provide the initial `data-source`.

## Tabs

Current tab vocabulary follows the legacy/browser theme selectors and should be refined after more browser usage.

- `[role="tablist"]` - tab button container; horizontally scrolls when tabs do not fit the parent width.
- `button[role="tab"]` - tab selector control; text should be concise and may ellipsize.
- `button[role="tab"][aria-selected="true"]` - active tab selector.
- `[role="tabpanel"]` - tab panel content region.
- `[role="tabpanel"][hidden]` - inactive tab panel content.

## Custom / ARIA attributes

- `[aria-selected="true"]` - selected items, rows, tabs, and similar selectable UI records.
- `[role="tabpanel"]` - tab panel content region.
- `[role="tabpanel"][hidden]` - inactive tab panel content.

## Custom elements

Core Views should share reusable custom UI elements instead of hard-coding duplicate host/editor behavior inside each view. Reusable custom UI elements live in `packages/widgets/`, one widget per file, and view code must import/request them by absolute browser path such as `/widgets/code-editor.js`.

- `code-editor` - text area for code editing with highlight.
- `view-pagination` - generic pagination widget for paged views.
- `widget-timeline` - reusable timeline widget for layers, frames, cels, and later tags.

## Timeline widget

- `widget-timeline` - root custom element.
- `article[data-element="timeline"]` - timeline body.
- `table[data-element="timeline-table"]` - layer/frame/cel grid.
- `thead[data-element="frame-header"]` - timeline controls and frame number header.
- `tr[data-element="timeline-topbar"]` - playback controls and tag space.
- `tr[data-element="timeline-index-row"]` - global layer actions and frame indexes.
- `[role="buttongroup"][data-element="playback-actions"]` - start/back/play-pause/forward/end controls.
- `[role="buttongroup"][data-element="timeline-add-actions"]` - add layer / add frame controls in the layer header cell.
- `output[data-element="timeline-tags"]` - placeholder/space for frame tags.
- `tbody[data-element="layer-rows"]` - layer and cel rows.
- `tr[aria-selected="true"]` - active layer row.
- `button[aria-pressed]` - active/toggle button state, including visibility and active cel buttons.
- `button[data-action="start"]` - first frame.
- `button[data-action="back"]` - previous frame.
- `button[data-action="play-pause"]` - play/pause timeline preview.
- `button[data-action="forward"]` - next frame.
- `button[data-action="end"]` - last frame.
- `button[data-action="toggle-all-visible"]` - show/hide all layers.
- `button[data-action="add-layer"]` - add a new layer.
- `button[data-action="add-frame"]` - add a new frame.
- `button[data-action="toggle-layer-visible"]` - show/hide one layer or group.
- `button[data-action="select-cel"]` - cel selector.
