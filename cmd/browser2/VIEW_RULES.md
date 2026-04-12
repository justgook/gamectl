# View Rules

GAMS UI uses themeable semantic elements, classes, and attributes as a project UI vocabulary. This file is a compact lookup for the preferred combinations used when building or migrating views.

GAMS views and UI should be built only from the elements, slots, classes, and attributes documented here. UI HTML should not contain custom CSS, inline styling, or undocumented elements/patterns. Existing code that does so is legacy/deprecated and a target for rework.

## View layout

### Root

- view root - should stretch to the full Area and use `flex: 1`.

### Main element

- each view should contain exactly one main element.
- `main` - main view render element.
- `canvas` - main view render element when the view renders into canvas.
- `table` - main view render element when the view is primarily tabular.

### Optional elements

- `aside` - optional side panel next to the main view render element.
- `footer` - optional bottom area for status, actions, pagination, or secondary controls.
- optional elements should appear at most once per view.

### Header actions

- `header` - should not be used inside view HTML.
- `[slot="header-controls"]` - header tools/actions area for the view.

## Intent

- `.accent` - primary/default emphasis for main actions and highlighted UI state.
- `.success` - successful/completed/confirmed-good state.
- `.warning` - caution, non-fatal problem, or risky action.
- `.danger` - error, destructive action, or invalid state.
- `.info` - informational or progress state.

## Form

- `form` - base element for grouped inputs and actions; default layout is column.
- `form > footer` - actions area inside forms.
- `input[type="text"]` - standard single-line text input.
- `input[type="number"]` - numeric input.
- `input[type="url"]` - URL input.
- `input[type="search"]` - search input.
- `input[type="email"]` - email input.
- `input[type="password"]` - password input.
- `select` - select/dropdown input.
- `textarea` - multiline text input.
- `fieldset` - grouped form section with border.
- `legend` - fieldset label/title.

## Structure

- `section` - grouped UI block inside a view, editor, or layout.

## Tables

- `table` - base element for tabular data in UI.
- `thead` - required table header section.
- `tbody` - required table body section.
- `tfoot` - optional table footer section.
- `tr` - table row.
- `th` - table header cell.
- `td` - table data cell.

## Custom / ARIA attributes

- `[aria-selected="true"]` - selected items, rows, and similar selectable UI records.

## Custom elements

- `code-editor` - text area for code editing with highlight.
