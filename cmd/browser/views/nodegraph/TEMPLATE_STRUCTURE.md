# Template Structure Documentation

## HTML Template Hierarchy

All UI elements are defined as `<template>` elements in `index.html` - **zero inline DOM manipulation**.

### Template Structure

```
index.html
├── <template id="node-template-selector">     ← Modal container
│   └── [data-element="template-list"]         ← Container for categories
│
├── <template id="node-template-category">     ← Category section
│   ├── [data-element="category-name"]         ← "INPUT", "PLUGIN", etc.
│   └── [data-element="category-items"]        ← Container for items
│
└── <template id="node-template-item">         ← Individual template button
    ├── [data-element="template-name"]         ← "Number Input"
    └── [data-element="template-description"]  ← Optional description
```

## Usage Flow

```javascript
// 1. Clone modal template
const modal = document.getElementById('node-template-selector').content.cloneNode(true)

// 2. For each category:
const categoryElement = document.getElementById('node-template-category').content.cloneNode(true)
categoryElement.querySelector('[data-element="category-name"]').textContent = 'INPUT'

// 3. For each template in category:
const itemElement = document.getElementById('node-template-item').content.cloneNode(true)
itemElement.querySelector('[data-element="template-name"]').textContent = 'Number Input'
itemElement.querySelector('[data-element="template-description"]').textContent = 'User input...'

// 4. Assemble hierarchy
categoryItems.appendChild(itemElement)
templateList.appendChild(categoryElement)
document.body.appendChild(modal)
```

## Visual Rendering

```
┌─────────────────────────────────────┐
│ Select Node Template            × │  ← Modal header
├─────────────────────────────────────┤
│                                     │
│  INPUT                              │  ← Category (template-category)
│  ┌───────────────────────────────┐ │
│  │ Number Input                  │ │  ← Item (template-item)
│  │ User input for numeric values │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ Text Input                    │ │
│  │ User input for text           │ │
│  └───────────────────────────────┘ │
│                                     │
│  PLUGIN                             │  ← Category
│  ┌───────────────────────────────┐ │
│  │ Tree Generator                │ │  ← Item
│  │ Generate procedural tree      │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

## Template Definitions

### 1. Modal Container (`node-template-selector`)

```html
<template id="node-template-selector">
  <div data-element="modal-backdrop">
    <div class="panel">
      <div class="panel-header">
        Select Node Template
        <button data-action="close">×</button>
      </div>
      <div class="panel-content">
        <div data-element="template-list">
          <!-- Categories inserted here -->
        </div>
      </div>
    </div>
  </div>
</template>
```

**Key Elements:**
- `[data-element="modal-backdrop"]` - Full screen overlay (click to close)
- `[data-action="close"]` - Close button
- `[data-element="template-list"]` - Container for category sections

### 2. Category Section (`node-template-category`)

```html
<template id="node-template-category">
  <div>
    <h3 data-element="category-name"></h3>
    <div data-element="category-items">
      <!-- Template items inserted here -->
    </div>
  </div>
</template>
```

**Key Elements:**
- `[data-element="category-name"]` - Text set to category name (uppercase)
- `[data-element="category-items"]` - Container for template item buttons

### 3. Template Item (`node-template-item`)

```html
<template id="node-template-item">
  <button class="button-secondary" data-action="select-template">
    <strong data-element="template-name"></strong>
    <small data-element="template-description"></small>
  </button>
</template>
```

**Key Elements:**
- `[data-action="select-template"]` - Click handler attached here
- `[data-element="template-name"]` - Template display name
- `[data-element="template-description"]` - Optional description (removed if empty)

## Data Flow

```
SQL Database
    ↓
Query: SELECT name, category, description, html_template
    ↓
Parse CSV Results
    ↓
Group by Category
    ↓
For each category:
    Clone node-template-category
    Set category name
    For each template:
        Clone node-template-item
        Set name & description
        Attach click handler
        Append to category-items
    Append to template-list
    ↓
Display Modal
```

## Benefits of Template-Based Approach

✅ **Zero Inline Styles** - All styling in template definitions  
✅ **Zero createElement()** - Pure template cloning  
✅ **Clear HTML Structure** - Easy to see in index.html  
✅ **Easy to Modify** - Just edit template HTML  
✅ **Consistent Styling** - Design tokens in CSS  
✅ **Type Safety** - data-element selectors are clear and documented  

## Styling

All styles use CSS custom properties (design tokens):
- `var(--spacing-scale-1)` through `var(--spacing-scale-3)`
- `var(--font-size-sm)`
- `var(--color-semantic-text-secondary)`
- `var(--border-radius-sm)`

No magic numbers or inline styles in JavaScript!
