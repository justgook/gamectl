# GameCtl Design Tokens

Design tokens for the GameCtl project, using the **DTCG (Design Token Community Group)** standard format.

## Overview

This directory contains design tokens organized in a hierarchical structure:

```
tokens/
├── global/          # Foundation tokens (colors, spacing, typography, etc.)
├── semantic/        # Semantic/theme tokens that reference global tokens
└── component/       # Component-specific tokens
```

## Quick Start

### Install Dependencies

```bash
npm install
```

### Build Tokens

```bash
npm run build              # Build tokens to CSS and JS
npm run build:verbose      # Build with detailed output
```

### View Example

Open `example.html` in your browser to see all tokens in action.

## Token Structure

### Global Tokens (Foundation)

These are the primitive values that should not be used directly in components:

- **Colors** - Base color palette (black, greys, cyan, red, yellow)
- **Spacing** - Spacing scale (0-6)
- **Typography** - Font families, sizes, weights, line-heights
- **Border** - Border radius and width
- **Shadow** - Shadow effects

### Semantic Tokens

These tokens give meaning to global tokens and should be used in components:

- **Background colors** - default, panel, interactive states, accent
- **Text colors** - primary, secondary, accent, on-accent, danger
- **Border colors** - default, interactive, danger
- **Typography styles** - body, headings (composite tokens)

### Component Tokens

Component-specific tokens that reference semantic tokens:

- **Button** - padding, radius, primary/secondary variants
- **Panel** - background, border, header, content
- **Select** - input/dropdown styling
- **List** - list item styling
- **File Tree** - tree component styling

## DTCG Format Features

✅ Uses `$value` instead of `value`  
✅ Explicit `$type` declarations  
✅ `$description` fields for documentation  
✅ Clean reference syntax: `{token.path}` (no `.value` suffix)  
✅ Composite types for shadows and typography  
✅ Forward-compatible with DTCG-aware design tools

## Output

Build generates tokens in multiple formats:

- `build/css/variables.css` - CSS custom properties (CSS variables)
- `build/js/tokens.js` - JavaScript/ES6 module

## Usage Examples

### CSS

```css
@import 'build/css/variables.css';

.button {
  background: var(--button-primary-background-default);
  color: var(--button-primary-text);
  padding: var(--button-padding-v) var(--button-padding-h);
  border-radius: var(--button-border-radius);
}

.button:hover {
  background: var(--button-primary-background-hover);
  box-shadow: var(--shadow-glow-accent);
}
```

### JavaScript

```javascript
import tokens from './build/js/tokens.js';

const styles = {
  backgroundColor: tokens.color.semantic.background.panel,
  color: tokens.color.semantic.text.primary,
  padding: tokens.spacing.scale4
};
```

## Color Palette

- **Black/Greys** - Dark theme backgrounds (#05080a → #2d3741)
- **Cyan** - Primary accent color (#00e5ff, #80f2ff, #a6f5ff)
- **Red** - Danger/error states (#ff3b30)
- **Yellow** - Warning states (#ffcc00)

## Typography

- **UI Font** - Roboto, sans-serif (body text, UI elements)
- **Display Font** - Orbitron, sans-serif (headings, tech aesthetic)

## Build Configuration

Tokens are built using [Style Dictionary](https://styledictionary.com/). Configuration is in `config.json`.

## Migration

These tokens were migrated from legacy Style Dictionary v3 format to DTCG standard on November 8, 2025. See `MIGRATION_SUMMARY.md` for details.

## Resources

- [Style Dictionary Docs](https://styledictionary.com)
- [DTCG Specification](https://tr.designtokens.org/format/)
- [Example Page](./example.html)
