# Style Dictionary Implementation Guide

## Overview

This design system uses Style Dictionary to generate three types of CSS outputs:

1. **CSS Variables** (`variables.css`) - CSS custom properties for all tokens
2. **Atomic Utility Classes** (`atomic.css`) - Tailwind-style utility classes
3. **Component Classes** (`components.css`) - Pre-built component styles

## Token Structure

### 1. Foundation Tokens (`tokens/global/`)

These are the base design tokens that should be referenced by semantic tokens:

- **color.json** - Base color palette (simplified from `color.global.xxx` to `color.xxx`)
  ```json
  {
    "color": {
      "grey-900": { "$value": "#11151a" },
      "cyan-500": { "$value": "#00e5ff" }
    }
  }
  ```

- **spacing.json** - Base spacing scale
- **border.json** - Border radius and width tokens
- **font.json** - Typography foundation
- **shadow.json** - Shadow effects

### 2. Semantic Tokens (`tokens/semantic/`)

These give meaning to foundation tokens and should be used in components:

- **color.json** - Semantic colors like `background.panel`, `text.primary`
- **typography.json** - Semantic typography tokens

### 3. Component Tokens (`tokens/component/`)

Component-specific token definitions:

- **button.json** - Button component tokens with variants (primary, secondary)
- **panel.json**, **select.json**, **list.json**, **file-tree.json** - Other components

## Generated Outputs

### 1. CSS Variables (`build/css/variables.css`)

All tokens as CSS custom properties:

```css
:root {
  --color-grey-900: #11151a;
  --spacing-scale-3: 8px;
  --button-primary-background-default: var(--color-cyan-500);
}
```

### 2. Atomic Utility Classes (`build/css/atomic.css`)

Tailwind-style utility classes generated from foundation tokens:

**Color utilities:**
```css
.bg-grey-900 { background-color: var(--color-grey-900); }
.text-grey-900 { color: var(--color-grey-900); }
.border-grey-900 { border-color: var(--color-grey-900); }
```

**Spacing utilities:**
```css
.p-3 { padding: var(--spacing-scale-3); }
.px-3 { padding-left: var(--spacing-scale-3); padding-right: var(--spacing-scale-3); }
.py-3 { padding-top: var(--spacing-scale-3); padding-bottom: var(--spacing-scale-3); }
.m-3 { margin: var(--spacing-scale-3); }
.gap-3 { gap: var(--spacing-scale-3); }
```

**Border utilities:**
```css
.rounded-sm { border-radius: var(--border-radius-sm); }
.border { border-width: var(--border-width-default); }
.border-thick { border-width: var(--border-width-thick); }
```

### 3. Component Classes (`build/css/components.css`)

Pre-built component classes:

```css
.button {
  padding: var(--button-padding-v) var(--button-padding-h);
  border-radius: var(--button-border-radius);
  font: var(--button-font);
  border-style: solid;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-primary {
  background-color: var(--button-primary-background-default);
  color: var(--button-primary-text);
  border-color: var(--button-primary-border);
}

.button-primary:hover {
  background-color: var(--button-primary-background-hover);
}
```

## Usage Examples

### Using Atomic Classes

```html
<!-- Color utilities -->
<div class="bg-grey-900 text-cyan-500 border-grey-700">
  Content
</div>

<!-- Spacing utilities -->
<div class="p-3 m-5 gap-2">
  Content with padding, margin, and gap
</div>

<!-- Border utilities -->
<div class="rounded-sm border-thick border-cyan-500">
  Content with border
</div>
```

### Using Component Classes

```html
<!-- Primary button -->
<button class="button button-primary">
  Click me
</button>

<!-- Secondary button -->
<button class="button button-secondary">
  Secondary Action
</button>
```

### Using CSS Variables

```css
.custom-element {
  background-color: var(--color-grey-900);
  padding: var(--spacing-scale-3);
  border-radius: var(--border-radius-sm);
  color: var(--color-cyan-500);
}
```

## Building Tokens

Run the build command:

```bash
npm run build
```

This generates:
- `build/css/variables.css`
- `build/css/atomic.css`
- `build/css/components.css`
- `build/js/tokens.js`

## Configuration Details

The Style Dictionary configuration (`config.js`) includes:

### Custom Formats

1. **`css/atomic`** - Generates Tailwind-style utility classes
   - Filters out component and semantic tokens
   - Creates color utilities (bg-, text-, border-)
   - Creates spacing utilities (p-, m-, gap- with directional variants)
   - Creates border utilities (rounded-, border-)

2. **`css/components`** - Generates component classes
   - Only processes component tokens
   - Creates base component classes
   - Creates variant classes with hover states

### Filters

- **Atomic classes**: Includes only foundation tokens (color, spacing, border)
- **Components**: Includes only component-specific tokens

## Token Naming Convention

### Foundation Tokens
- `color-{name}` → `.bg-{name}`, `.text-{name}`, `.border-{name}`
- `spacing-scale-{n}` → `.p-{n}`, `.m-{n}`, `.gap-{n}`, etc.
- `border-radius-{size}` → `.rounded-{size}`
- `border-width-{size}` → `.border-{size}`

### Component Tokens
- `button-{property}` → Used in `.button` base class
- `button-{variant}-{property}` → Used in `.button-{variant}` classes

## Adding New Tokens

### Adding a New Color

1. Add to `tokens/global/color.json`:
   ```json
   {
     "color": {
       "blue-500": { "$value": "#0066ff" }
     }
   }
   ```

2. Rebuild: `npm run build`

3. Use generated utilities:
   ```html
   <div class="bg-blue-500 text-blue-500 border-blue-500">
   ```

### Adding a New Component

1. Create `tokens/component/my-component.json`:
   ```json
   {
     "my-component": {
       "background": {
         "$value": "{color.grey-900}",
         "$type": "color"
       },
       "padding": {
         "$value": "{spacing.scale-3}",
         "$type": "dimension"
       }
     }
   }
   ```

2. Update `config.js` format logic to handle the new component

3. Rebuild and use `.my-component` class

## Best Practices

1. **Always reference semantic tokens** in components, not foundation tokens directly
2. **Use atomic classes** for quick layouts and spacing
3. **Use component classes** for consistent, reusable components
4. **Use CSS variables** for custom one-off styles
5. **Keep foundation tokens simple** - they should be referenced, not changed often
6. **Document semantic meaning** in `$description` fields

## Migration Notes

### Changed Token Paths

The following token paths were simplified:

- `{color.global.grey-900}` → `{color.grey-900}`
- `{color.global.cyan-500}` → `{color.cyan-500}`

All semantic and component tokens have been updated to reference the new paths.
