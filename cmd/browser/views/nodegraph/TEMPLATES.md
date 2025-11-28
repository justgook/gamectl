# Node Templates System

## Overview

The node graph system now supports SQL-based templates for creating nodes. Templates are stored in a SQLite database and can be easily managed through SQL.

## How It Works

### 1. Database Initialization

On startup, the system:
1. Opens an in-memory SQLite database (via SQL plugin)
2. Fetches `/data/node-templates.sql`
3. Executes the migration to create schema and populate templates

### 2. Node Creation Flow

When user clicks **"+ Node"** button:

1. System queries database: `SELECT * FROM node_templates ORDER BY category, name`
2. Modal displays templates grouped by category
3. User selects a template (e.g., "Tree Generator")
4. System:
   - Parses the HTML template
   - Generates unique ID: `node_1`, `node_2`, etc.
   - Sets position (center of viewport)
   - Inserts into DOM
5. Node auto-registers via `connectedCallback()`
6. Node appears in canvas

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS node_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- Display name
  category TEXT,                   -- Group (input, plugin, util, output)
  description TEXT,                -- Optional description
  html_template TEXT NOT NULL      -- Pure HTML (no id/x/y)
);
```

## Template Format

Templates are **pure HTML** - no `id`, `x`, or `y` attributes (handled by nodegraph):

```html
<!-- ✅ Good: Pure configuration -->
<node-plugin plugin="treegen" function="gen" inputs="nodeCount" outputs="result"></node-plugin>

<!-- ❌ Bad: Don't include DOM specifics -->
<node-plugin id="treegen_1" x="100" y="200" plugin="treegen" function="gen"></node-plugin>
```

## Adding New Templates

Edit `/cmd/browser/data/node-templates.sql` and add:

```sql
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'My Custom Node',
  'custom',
  'Does something cool',
  '<node-plugin plugin="myplugin" function="myfunction" inputs="input1,input2" outputs="result"></node-plugin>'
);
```

Reload the page to see the new template.

## Implementation Details

### Files Changed

- `cmd/browser/data/node-templates.sql` - Migration file with templates
- `cmd/browser/index.html` - Database initialization + modal template
- `cmd/browser/views/view-nodegraph.js` - Node creation logic

### Key Methods

**In `ViewNodeGraph` class:**

- `addNodeMenu()` - Query templates and show modal
- `showTemplateSelector(templates)` - Display modal with template list
- `createNodeFromTemplate(html)` - Parse HTML, set id/x/y, insert to DOM
- `getCreationPosition()` - Calculate position (viewport center)
- `parseTemplatesCSV(csv)` - Parse SQL query results

### ID Generation

Simple incrementing counter:
```javascript
this.nodeIdCounter = 1
const nodeId = `node_${this.nodeIdCounter++}` // node_1, node_2, node_3...
```

## Benefits

✅ **Clean Separation**: Templates are data, NodeGraph handles presentation  
✅ **Easy to Edit**: Just SQL - no code changes needed  
✅ **Version Controlled**: SQL file in git  
✅ **Queryable**: Use SQL to filter/search templates  
✅ **Extensible**: Add custom categories, metadata, etc.

## Future Enhancements

- [ ] Search/filter in modal
- [ ] Keyboard shortcuts (e.g., `Ctrl+N` for quick add)
- [ ] Template editor UI (CRUD operations)
- [ ] Import/export template sets
- [ ] Template preview/screenshots
- [ ] User-defined custom templates
- [ ] Template marketplace/sharing
