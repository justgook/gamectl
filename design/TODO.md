# Design System TODO

Checklist for completing the gamectl design system to improve overall appearance and consistency.

## 🔥 HIGH PRIORITY: Layout Components

The resize handles and split pane system currently use debug/placeholder styling and need proper design tokens.

### Resize Handle Component
- [ ] Create `tokens/component/resize-handle.json`
  - [ ] Default state (subtle, themed color)
  - [ ] Hover state (more visible)
  - [ ] Active/dragging state
  - [ ] Size/dimensions
  - [ ] Cursor styles per direction
  - [ ] Background color/pattern
  - [ ] Border/outline
  - [ ] Transition duration

### Corner Handle Component
- [ ] Create `tokens/component/corner-handle.json`
  - [ ] Size dimensions
  - [ ] Border radius (quarter-circle)
  - [ ] Colors per state (default, hover, active)
  - [ ] Cursor per direction (nw-resize, ne-resize, etc.)
  - [ ] Shadow/glow effects
  - [ ] Transition timing

### Split Pane Component
- [ ] Create `tokens/component/split-pane.json`
  - [ ] Gutter width/height
  - [ ] Gutter background color
  - [ ] Gutter hover state
  - [ ] Gutter active state
  - [ ] Collapsed state indicator
  - [ ] Drag handle styling within gutter
  - [ ] Minimum pane sizes

### Layout System Tokens
- [ ] Add to `tokens/global/spacing.json`:
  - [ ] Gutter default size
  - [ ] Handle thickness
  - [ ] Minimum panel dimensions
- [ ] Update `app.css` to use new tokens:
  - [ ] Remove hardcoded red backgrounds (lines 64-68, 70-118)
  - [ ] Replace with design token variables
  - [ ] Add proper cursor styles from tokens

---

## 🎯 Input/Form Components

Currently used in pipeline forms but lack design tokens.

### Text Input Component
- [ ] Create `tokens/component/text-input.json`
  - [ ] Background color
  - [ ] Border (default, focus, error)
  - [ ] Padding (vertical, horizontal)
  - [ ] Text color
  - [ ] Placeholder text color
  - [ ] Focus ring/glow
  - [ ] Disabled state
  - [ ] Error state
  - [ ] Border radius
  - [ ] Font style

### Range Slider Component
- [ ] Create `tokens/component/range-slider.json`
  - [ ] Track height
  - [ ] Track background (default, filled)
  - [ ] Thumb size
  - [ ] Thumb color (default, hover, active)
  - [ ] Thumb border
  - [ ] Thumb shadow
  - [ ] Focus ring
  - [ ] Value label styling
  - [ ] Disabled state

### Form Label Component
- [ ] Create `tokens/component/form-label.json`
  - [ ] Text color
  - [ ] Font size/weight
  - [ ] Spacing (margin-bottom)
  - [ ] Required indicator (color, symbol)
  - [ ] Helper text color/size
  - [ ] Error message styling

### Accordion/Details Component
- [ ] Create `tokens/component/accordion.json`
  - [ ] Summary background
  - [ ] Summary padding
  - [ ] Summary hover state
  - [ ] Summary font/color
  - [ ] Expanded/collapsed indicator
  - [ ] Arrow/chevron size and color
  - [ ] Content padding
  - [ ] Border between sections
  - [ ] Transition duration

---

## 🎨 Node Graph Components

Currently hardcoded in `view-nodegraph.js`. Need proper tokens.

### Node Component
- [ ] Create `tokens/component/node.json`
  - [ ] Dimensions (width, height, header height)
  - [ ] Border radius
  - [ ] Shadow/elevation
  - [ ] State colors:
    - [ ] Idle background
    - [ ] Ready background
    - [ ] Running background
    - [ ] Success background
    - [ ] Error background
  - [ ] Node type colors (header):
    - [ ] Input header
    - [ ] Plugin header
    - [ ] Output header
  - [ ] Selected state (border/glow)
  - [ ] Text colors
  - [ ] Padding

### Port Component
- [ ] Create `tokens/component/port.json`
  - [ ] Port circle size
  - [ ] Hit area radius (larger for interaction)
  - [ ] Colors:
    - [ ] Default (unconnected)
    - [ ] Connected
    - [ ] Hover target
  - [ ] Border style
  - [ ] Glow on hover
  - [ ] Port spacing (vertical)
  - [ ] Label font size/color
  - [ ] Label offset from port

### Connection Component
- [ ] Create `tokens/component/connection.json`
  - [ ] Line width
  - [ ] Line color (default)
  - [ ] Active connection color (during drag)
  - [ ] Curve control point offset
  - [ ] Shadow/glow
  - [ ] Hover state
  - [ ] Selection state

---

## 🌳 Tree/Minimap Components

Currently hardcoded in `view-tree.js`. Need tokenization.

### Tree Node Component
- [ ] Create `tokens/component/tree-node.json`
  - [ ] Dimensions (min width, padding)
  - [ ] Root node gradient (start, end)
  - [ ] Child node gradient (start, end)
  - [ ] Border radius
  - [ ] Shadow
  - [ ] Text colors:
    - [ ] Node name
    - [ ] Data entries
  - [ ] Spacing:
    - [ ] Horizontal spacing between levels
    - [ ] Vertical spacing between nodes
  - [ ] Button styles (expand/collapse):
    - [ ] Background
    - [ ] Border
    - [ ] Text
    - [ ] Hover state

### Tree Edge Component
- [ ] Create `tokens/component/tree-edge.json`
  - [ ] Line width
  - [ ] Gradient colors (start, end)
  - [ ] Shadow/glow
  - [ ] Curve control offset
  - [ ] Arrow size
  - [ ] Arrow color

---

## 🖥️ Canvas Components

### Tooltip Component
- [ ] Create `tokens/component/tooltip.json`
  - [ ] Background color (with alpha)
  - [ ] Text color
  - [ ] Padding
  - [ ] Border radius
  - [ ] Font size
  - [ ] Shadow
  - [ ] Z-index
  - [ ] Arrow/pointer size
  - [ ] Max width
  - [ ] Transition timing

### Canvas Overlay Controls
- [ ] Create `tokens/component/canvas-controls.json`
  - [ ] Container background (semi-transparent)
  - [ ] Container padding
  - [ ] Container border radius
  - [ ] Button spacing in group
  - [ ] Icon button size
  - [ ] Position offset from edges
  - [ ] Z-index
  - [ ] Backdrop blur

### Canvas Grid
- [ ] Create `tokens/component/canvas-grid.json`
  - [ ] Grid size (spacing)
  - [ ] Grid line color
  - [ ] Grid line width
  - [ ] Background color
  - [ ] Major grid lines (every N lines)
  - [ ] Major grid line color

---

## 📝 Console Component

### Console Log Entry
- [ ] Create `tokens/component/console.json`
  - [ ] Background color
  - [ ] Log level colors:
    - [ ] Info
    - [ ] Success
    - [ ] Warning
    - [ ] Error
  - [ ] Text color per level
  - [ ] Timestamp color/format
  - [ ] Font family (monospace)
  - [ ] Font size
  - [ ] Line height
  - [ ] Padding
  - [ ] Border between entries
  - [ ] Scrollbar styling

---

## 🎨 Semantic Color Tokens

Add to `tokens/semantic/color.json`:

### State Colors
- [ ] Add `success` color (positive states)
- [ ] Add `warning` color (caution states)
- [ ] Add `info` color (informational, distinct from accent)
- [ ] Add `processing` color (loading/running states)

### Canvas Colors
- [ ] Add `background.canvas` (main canvas background)
- [ ] Add `border.grid` (canvas grid lines)
- [ ] Add `background.selection` (selection overlay)
- [ ] Add `border.selection` (selection outline)

### Node Graph Colors
- [ ] Add `node.idle`, `node.ready`, `node.running`, `node.success`, `node.error`
- [ ] Add `connection.default`, `connection.active`, `connection.hover`
- [ ] Add `port.default`, `port.connected`, `port.hover`

---

## 📐 Typography Tokens

Add to `tokens/semantic/typography.json`:

- [ ] Add `code` style (monospace for console)
- [ ] Add `caption` style (small text, metadata)
- [ ] Add `button` style (button text weight/size)
- [ ] Add `icon-label` style (text next to icons)

---

## ⚡ Animation/Transition Tokens

### Create `tokens/global/transition.json`
- [ ] Duration values:
  - [ ] `fast` (100ms - instant feedback)
  - [ ] `default` (200ms - hover, focus)
  - [ ] `slow` (400ms - page transitions)
- [ ] Easing functions:
  - [ ] `standard` (ease-in-out)
  - [ ] `spring` (cubic-bezier with bounce)
  - [ ] `ease-in`
  - [ ] `ease-out`

---

## 🔧 Enhancement of Existing Components

### Button Component Enhancement
Update `tokens/component/button.json`:
- [ ] Add `success` variant (green, for run/play actions)
- [ ] Add `danger` variant (red, for delete/stop)
- [ ] Add `warning` variant (yellow/orange)
- [ ] Add `icon` variant (square, minimal padding)
- [ ] Add button group tokens:
  - [ ] Spacing between buttons in group
  - [ ] Border radius for first/last in group
  - [ ] Divider between grouped buttons

### Panel Component Enhancement
Update `tokens/component/panel.json`:
- [ ] Add `toolbar` section (action buttons area)
- [ ] Add `footer` section
- [ ] Add `draggable-header` styling (different cursor)
- [ ] Add `collapsed` state
- [ ] Add `minimized` state
- [ ] Add resize indicator

### Select Component Enhancement
Update `tokens/component/select.json`:
- [ ] Add `focus` state
- [ ] Add `disabled` state
- [ ] Add `option-group` styling (label style)
- [ ] Add `option` hover/selected states
- [ ] Add dropdown arrow color/size

---

## 📊 Global Token Enhancements

### Spacing Expansion
Update `tokens/global/spacing.json`:
- [ ] Add `scale-7: 32px`
- [ ] Add `scale-8: 48px`
- [ ] Add `scale-9: 64px`
- [ ] Add `scale-10: 80px`

### Border Tokens
Update `tokens/global/border.json`:
- [ ] Add `width.thin: 1px`
- [ ] Add `width.default: 2px`
- [ ] Add `width.thick: 3px`
- [ ] Add `radius.sharp: 0px`
- [ ] Add `radius.sm: 4px`
- [ ] Add `radius.md: 8px`
- [ ] Add `radius.lg: 12px`
- [ ] Add `radius.full: 9999px`

### Z-Index System
Create `tokens/global/z-index.json`:
- [ ] `canvas: 1` (base canvas layer)
- [ ] `overlay-controls: 100` (canvas overlay buttons)
- [ ] `tooltip: 1000` (tooltips)
- [ ] `modal: 2000` (modal dialogs)
- [ ] `notification: 3000` (toast notifications)

### Opacity Standards
Create `tokens/global/opacity.json`:
- [ ] `disabled: 0.5`
- [ ] `subtle: 0.7`
- [ ] `semi-transparent: 0.85`
- [ ] `overlay-backdrop: 0.9`

---

## 🎭 Icon System

### Icon Component
Create `tokens/component/icon.json`:
- [ ] Default size
- [ ] Small size
- [ ] Large size
- [ ] Color (inherit from parent)
- [ ] Spacing around icons (margin)
- [ ] Inline icon vertical alignment

---

## 📋 Additional Tasks

### Documentation
- [ ] Document all new tokens in design system showcase
- [ ] Add usage examples for each component
- [ ] Create migration guide from hardcoded values to tokens

### Refactoring
- [ ] Update `app.css` to use new layout component tokens
- [ ] Update `view-nodegraph.js` to use node graph tokens
- [ ] Update `view-tree.js` to use tree component tokens
- [ ] Remove all hardcoded color values from JS files
- [ ] Add CSS custom properties for all new tokens

### Testing
- [ ] Verify all components render correctly with new tokens
- [ ] Test responsive behavior with new spacing scales
- [ ] Test accessibility (focus states, contrast ratios)
- [ ] Cross-browser testing for new CSS properties

---

## 📈 Progress Tracking

**Total Tasks:** ~150+  
**Completed:** 0  
**In Progress:** 0  

Last Updated: 2025-11-25
