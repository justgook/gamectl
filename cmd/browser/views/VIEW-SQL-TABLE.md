# view-sql-table

A CastleDB-inspired SQL-driven table view component for displaying and editing database data.

## Usage

```html
<view-sql-table
  data-query="SELECT * FROM items LIMIT :limit OFFSET :offset"
  data-count-query="SELECT COUNT(*) FROM items"
  data-table="items"
  data-page-size="20"
  data-column-types='{"icon": "image-base64", "stackable": "boolean"}'
></view-sql-table>
```

## Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-query` | Yes | SQL SELECT query with `:limit` and `:offset` placeholders for pagination |
| `data-count-query` | No | SQL query returning total row count (enables pagination info) |
| `data-table` | No | Table name for INSERT/UPDATE/DELETE operations |
| `data-page-size` | No | Rows per page (default: 20) |
| `data-column-types` | No | JSON object mapping column names to types |

## Query Placeholders

The component replaces these placeholders in your queries:

| Placeholder | Description |
|-------------|-------------|
| `:limit` | Number of rows to fetch (from `data-page-size`) |
| `:offset` | Row offset based on current page |

## Column Types

Columns are auto-detected from query results, but you can override with `data-column-types`:

| Type | Description | Auto-detect |
|------|-------------|-------------|
| `text` | Plain text (default) | Any string |
| `number` | Right-aligned numeric | Numeric strings |
| `boolean` | Checkbox display | `0`, `1`, `true`, `false` |
| `image-base64` | Renders base64 as `<img>` | PNG/JPEG/GIF/WebP signatures |
| `image-url` | Renders URL as `<img>` | Must be explicitly set |

### Auto-detection

The component detects image types by their base64 signature:
- PNG: starts with `iVBOR`
- JPEG: starts with `/9j/`
- GIF: starts with `R0lGOD`
- WebP: starts with `UklGR`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Double-click` | Edit cell |
| `Enter` | Commit edit |
| `Escape` | Cancel edit |
| `Tab` | Move to next cell (while editing) |
| `Shift+Tab` | Move to previous cell (while editing) |
| `Insert` or `Ctrl+N` | Insert new row |
| `Ctrl+Delete` | Delete selected row |
| `Ctrl+R` | Refresh data |

## Editing

### Inline Editing
Double-click any cell to edit. Press Enter to save or Escape to cancel.

### Insert Row
Click the "+ Row" button or press Insert. New rows are added with default/empty values.

### Delete Row
1. Click the row number to select the row
2. Press Ctrl+Delete
3. Confirm the deletion

### Requirements for Editing
- `data-table` attribute must be set for INSERT/UPDATE/DELETE to work
- The table should have a primary key column named `id` (auto-detected)

## Examples

### Basic Table
```html
<view-sql-table
  data-query="SELECT * FROM biomes LIMIT :limit OFFSET :offset"
  data-count-query="SELECT COUNT(*) FROM biomes"
  data-table="biomes"
></view-sql-table>
```

### Table with Images
```html
<view-sql-table
  data-query="SELECT id, name, price, icon FROM items LIMIT :limit OFFSET :offset"
  data-count-query="SELECT COUNT(*) FROM items"
  data-table="items"
  data-column-types='{"icon": "image-base64"}'
></view-sql-table>
```

### Read-only View (no table attribute)
```html
<view-sql-table
  data-query="SELECT name, COUNT(*) as count FROM items GROUP BY rarity LIMIT :limit OFFSET :offset"
></view-sql-table>
```

### Custom Page Size
```html
<view-sql-table
  data-query="SELECT * FROM items LIMIT :limit OFFSET :offset"
  data-count-query="SELECT COUNT(*) FROM items"
  data-table="items"
  data-page-size="50"
></view-sql-table>
```

## Adding to View Selector

To add a new table configuration to the view selector dropdown, update these files:

### 1. index.html - Add option
```html
<optgroup label="Data">
  <option value="view-sql-table" data-config="my-table">My Table</option>
</optgroup>
```

### 2. chrome.js - Add config
```javascript
const configs = {
  'my-table': {
    'data-query': 'SELECT * FROM my_table LIMIT :limit OFFSET :offset',
    'data-count-query': 'SELECT COUNT(*) FROM my_table',
    'data-table': 'my_table',
    'data-page-size': '20'
  }
}
```

## CSS Classes

The component uses these CSS classes (defined in `app.css`):

| Class | Element |
|-------|---------|
| `.sql-table` | Main table element |
| `.sql-table-container` | Scrollable table wrapper |
| `.sql-table-toolbar` | Top toolbar |
| `.sql-table-footer` | Bottom bar with pagination |
| `.sql-table-pagination` | Pagination controls |
| `.sql-table-status` | Status text |
| `.sql-table-row-num` | Row number column |
| `.sql-table-cell-*` | Cell type variants |
| `.sql-table-image` | Image elements |
| `.sql-table-edit-input` | Edit mode input |
| `.sql-table-edit-textarea` | Edit mode textarea |

## Future Enhancements

Planned features (not yet implemented):
- Column sorting
- Column filtering
- Reference columns with lookups
- Tooltip/detail queries on hover
- Drag-and-drop row reordering
- Column resizing
- Export to CSV/JSON
