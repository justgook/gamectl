# View Rules

UI uses themeable semantic elements, classes, and attributes as a project UI vocabulary. This file is a compact lookup for the preferred combinations used when building or migrating views.

Views and UI should be built only from the elements, slots, classes, and attributes documented here. UI HTML should not contain custom CSS, inline styling, or undocumented elements/patterns. Existing code that does so is legacy/deprecated and a target for rework.

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

### Popup flows

- popup opening/closing should go through `runtime.call('ui.popup', ...)` instead of directly reaching into `popup-manager` from a view.
- prefer dedicated popup views or existing reusable chooser/editor views over inline popup HTML assembled inside another view.
- when add/edit flows are mostly the same, prefer one popup view with a mode prop over near-duplicate popup views.
- reuse existing chooser views such as `view-sql` when they already fit the job.

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
- `button` - interactive action control.
- `select` - select/dropdown input.
- `option` - option item inside `select`.
- `optgroup` - grouped options inside `select`.
- `textarea` - multiline text input.
- `output` - result or status text for form/view operations.

## Text output

- `pre` - preformatted read-only text output for logs, console transcripts, and whitespace-sensitive textual results.

## Icons

- `i` - icon element using Material Symbols.
- `button > i` - icon content inside button controls.

## Tables

- `table` - base element for tabular data in UI.
- `caption` - optional table title/label when the table needs an intrinsic semantic heading.
- `thead` - required table header section.
- `tbody` - required table body section.
- `tfoot` - optional table footer section.
- `tr` - table row.
- `th` - table header cell.
- `td` - table data cell.

## Data attributes

- `data-*` attributes are allowed for view/widget configuration, behavior flags, and internal DOM hooks.
- `data-*` attributes should not be used as the styling contract for UI.
- `data-element` - stable internal hook for structural subparts in views/widgets.
- `data-action` - stable internal hook for interactive controls/actions.
- `data-field` - stable internal hook for form fields and bindings.

## Tabs

Current tab vocabulary follows the legacy/browser theme selectors and should be refined after more browser2 usage.

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

Reusable custom UI elements should live in `cmd/browser2/widgets/`, one widget per file.

- `code-editor` - text area for code editing with highlight.
- `view-pagination` - generic pagination widget for paged views.
