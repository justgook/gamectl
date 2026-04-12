# View Rules

GAMS UI uses themeable semantic elements, classes, and attributes as a project UI vocabulary. This file is a compact lookup for the preferred combinations used when building or migrating views.

GAMS views and UI should be built only from the elements, slots, classes, and attributes documented here. UI HTML should not contain custom CSS, inline styling, or undocumented elements/patterns. Existing code that does so is legacy/deprecated and a target for rework.

## View layout

### Root

- view root - should stretch to the full Area.
- view custom element root should use `display: contents` so the semantic view children participate directly in the Area layout.

### Main element

Each view should contain exactly one main element.

- `article` - main view render element.
- `canvas` - main view render element when the view renders into canvas.
- `table` - main view render element when the view is primarily tabular.

### Optional elements

Optional elements should appear at most once per view.

- `aside` - optional side panel next to the main view render element.
- `footer` - optional bottom area for status, actions, pagination, or secondary controls.

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
- `label` - form field label.
- `form > footer` - actions area inside forms.
- `input[type="text"]` - standard single-line text input.
- `input[type="number"]` - numeric input.
- `input[type="url"]` - URL input.
- `input[type="search"]` - search input.
- `input[type="email"]` - email input.
- `input[type="password"]` - password input.
- `input[type="checkbox"]` - boolean/toggle form input.
- `select` - select/dropdown input.
- `textarea` - multiline text input.
- `output` - result or status text for form/view operations.

## Tables

- `table` - base element for tabular data in UI.
- `thead` - required table header section.
- `tbody` - required table body section.
- `tfoot` - optional table footer section.
- `tr` - table row.
- `th` - table header cell.
- `td` - table data cell.

## Data attributes

- `data-*` attributes are allowed for view/widget configuration, behavior flags, and internal DOM hooks.
- `data-*` attributes should not be used as the styling contract for browser2 UI.
- `data-element` - stable internal hook for structural subparts in views/widgets.
- `data-action` - stable internal hook for interactive controls/actions.
- `data-field` - stable internal hook for form fields and bindings.

## Custom / ARIA attributes

- `[aria-selected="true"]` - selected items, rows, and similar selectable UI records.
- `[role="tabpanel"]` - tab panel content region.
- `[role="tabpanel"][hidden]` - inactive tab panel content.

## Custom elements

Reusable custom UI elements should live in `cmd/browser2/widgets/`, one widget per file.

- `code-editor` - text area for code editing with highlight.
- `view-pagination` - generic pagination widget for paged views.
