# Design System Showcase

A lightweight, Storybook-inspired showcase for the design system built with plain HTML and minimal JavaScript. Features a collapsible sidebar navigation with file-tree style organization.

## Structure

```
example/
├── index.html          # Overview and introduction page
├── tokens.html         # All design tokens (colors, typography, spacing, etc.)
├── components.html     # Interactive component library
├── showcase.css        # Shared styles and navigation
└── README.md          # This file
```

## Features

- **Storybook-like UI** - Left sidebar navigation with collapsible categories
- **File-tree navigation** - Hierarchical organization of tokens and components
- **Minimal JavaScript** - Only for sidebar collapse/expand functionality
- **Anchor navigation** - Deep-link to specific sections (e.g., `#colors`, `#buttons`)
- **Live examples** - All components are interactive with hover states
- **Token documentation** - Visual showcase of all design tokens
- **Component library** - Complete component examples with code references
- **DTCG standard** - All tokens follow the Design Tokens Community Group format
- **Responsive design** - Adapts to different screen sizes

## Pages

### index.html
Overview page with introduction to the design system and quick links to other sections.

### tokens.html
Comprehensive display of all design tokens:
- Color palette (global and semantic)
- Typography scale and samples
- Spacing scale visualization
- Border styles and radii
- Shadow effects

### components.html
Interactive component showcase:
- Buttons (primary, secondary variants)
- Panels (with headers and content)
- Select inputs
- Lists (with hover states)
- File tree (with indentation and selection)
- Composition examples

## Usage

1. Build the design tokens:
   ```bash
   make tokens
   ```

2. Open any HTML file in a browser:
   ```bash
   open example/index.html
   ```

3. Navigate between pages using the top navigation bar

## Updating

When you update design tokens in the `tokens/` directory:

1. Rebuild tokens: `make tokens`
2. Refresh your browser to see changes
3. All examples automatically use the new token values

## Adding New Pages

To add a new showcase page:

1. Create `example/your-page.html`
2. Include the CSS files:
   ```html
   <link rel="stylesheet" href="../build/css/variables.css">
   <link rel="stylesheet" href="showcase.css">
   ```
3. Add the navigation header:
   ```html
   <nav class="nav-header">
     <div class="nav-title">Design System Showcase</div>
     <div class="nav-links">
       <a href="index.html" class="nav-link">Overview</a>
       <a href="tokens.html" class="nav-link">Tokens</a>
       <a href="components.html" class="nav-link">Components</a>
       <a href="your-page.html" class="nav-link active">Your Page</a>
     </div>
   </nav>
   ```
4. Add your content inside `<main class="main-content">`

## Benefits Over Storybook

- **Zero build time** - Just open HTML files directly in browser
- **No dependencies** - No node_modules for the showcase itself
- **Minimal JavaScript** - ~20 lines for sidebar interaction
- **Simple to maintain** - Plain HTML and CSS
- **Instant load** - No JavaScript bundles or compilation
- **Easy to customize** - Edit HTML/CSS directly
- **Version control friendly** - Clean diffs, no generated code
- **Similar UX** - Familiar sidebar navigation and organization

## Browser Support

Works in all modern browsers that support CSS custom properties (CSS variables):
- Chrome/Edge 49+
- Firefox 31+
- Safari 9.1+
