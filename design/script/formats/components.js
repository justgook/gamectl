/**
 * Helper: Map token path/name to CSS property
 */
function getCssProperty(pathSegment, tokenType, fullPath) {
  const mappings = {
    'background': 'background-color',
    'text': 'color',
    'border': 'border-color',
    'border-radius': 'border-radius',
    'border-width': 'border-width',
    'padding': 'padding',
    'padding-v': 'padding-top-bottom',
    'padding-h': 'padding-left-right',
    'font': 'font',
    'font-size': 'font-size',
    'indent': 'padding-left',
  };

  // Check if this is a nested border property (e.g., border.color, border.width)
  if (fullPath && fullPath.length >= 2) {
    const parentSegment = fullPath[fullPath.length - 2];
    if (parentSegment === 'border') {
      if (pathSegment === 'color') return 'border-color';
      if (pathSegment === 'width') return 'border-width';
    }
  }

  return mappings[pathSegment] || pathSegment;
}

/**
 * Helper: Check if a path segment is a state modifier
 */
function isState(segment) {
  return ['default', 'hover', 'active', 'focus', 'selected', 'disabled'].includes(segment);
}

/**
 * Helper: Check if a path segment is a variant
 */
function isVariant(segment, componentTokens) {
  // Check if this segment has background/text/border children (typical variant pattern)
  const token = componentTokens.find(t => t.path.includes(segment));
  if (!token) return false;

  const childPaths = componentTokens
    .filter(t => t.path[0] === token.path[0] && t.path[1] === segment)
    .map(t => t.path[2]);

  return childPaths.some(p => ['background', 'text', 'border'].includes(p));
}

/**
 * Helper: Check if a path segment is a sub-component (like 'item', 'header', 'content')
 */
function isSubComponent(segment) {
  return ['item', 'header', 'content', 'icon'].includes(segment);
}

/**
 * Generate CSS properties from tokens (excluding state-specific ones)
 */
function generateCssProperties(tokens, componentName, isBaseComponent = false) {
  const props = [];
  const processed = new Set();
  let hasBorderWidth = false;

  tokens.forEach(token => {
    const path = token.path;
    const lastSegment = path[path.length - 1];
    const secondLast = path.length > 1 ? path[path.length - 2] : null;

    // Skip state-specific tokens (handled separately)
    if (isState(lastSegment) && lastSegment !== 'default') {
      return;
    }

    // Skip if we've already processed this property
    const propKey = path.slice(1).join('-');
    if (processed.has(propKey)) {
      return;
    }
    processed.add(propKey);

    // Handle 'default' state - use it for base property
    let propertyName = secondLast;
    if (lastSegment === 'default') {
      propertyName = secondLast;
    } else if (!isState(lastSegment)) {
      propertyName = lastSegment;
    }

    // Map to CSS property
    const cssProperty = getCssProperty(propertyName, token.$type, path);

    // Track if we have border-width
    if (cssProperty === 'border-width') {
      hasBorderWidth = true;
    }

    // Generate CSS
    if (cssProperty === 'padding-top-bottom') {
      props.push(`padding-top: var(--${token.name});`);
      props.push(`padding-bottom: var(--${token.name});`);
    } else if (cssProperty === 'padding-left-right') {
      props.push(`padding-left: var(--${token.name});`);
      props.push(`padding-right: var(--${token.name});`);
    } else {
      props.push(`${cssProperty}: var(--${token.name});`);
    }
  });

  // Add border-style: solid if border-width is present
  if (hasBorderWidth && !props.some(p => p.includes('border-style'))) {
    props.push('border-style: solid;');
  }

  // Add common properties for interactive components (only for base component, not variants)
  if (isBaseComponent && (componentName === 'button' || componentName === 'select')) {
    if (!props.some(p => p.includes('cursor'))) {
      props.push('cursor: pointer;');
    }
    if (!props.some(p => p.includes('transition'))) {
      props.push('transition: all 0.2s ease;');
    }
  }

  return props;
}

/**
 * Extract state-specific properties (hover, selected, etc.)
 */
function extractStateProperties(tokens) {
  const stateProps = {
    default: [],
    hover: [],
    active: [],
    focus: [],
    selected: [],
    disabled: []
  };

  tokens.forEach(token => {
    const path = token.path;
    const lastSegment = path[path.length - 1];
    const secondLast = path.length > 1 ? path[path.length - 2] : null;

    // Check if this is a state token
    if (isState(lastSegment)) {
      const state = lastSegment;
      const propertyName = secondLast;
      const cssProperty = getCssProperty(propertyName, token.$type, path);

      if (cssProperty === 'padding-top-bottom') {
        stateProps[state].push(`padding-top: var(--${token.name});`);
        stateProps[state].push(`padding-bottom: var(--${token.name});`);
      } else if (cssProperty === 'padding-left-right') {
        stateProps[state].push(`padding-left: var(--${token.name});`);
        stateProps[state].push(`padding-right: var(--${token.name});`);
      } else {
        stateProps[state].push(`${cssProperty}: var(--${token.name});`);
      }
    }
  });

  return stateProps;
}

/**
 * Element-to-Component Mapping
 * Maps component tokens to HTML element selectors for automatic styling
 */
const ELEMENT_MAPPINGS = {
  'button': {
    selector: 'button',
    defaultVariant: 'primary', // button without classes gets primary styling
    variantSelector: 'button:not([class*="button-"])'
  },
  'select': {
    selector: 'select'
  },
  'text-input': {
    selector: 'input[type="text"], input[type="number"], input[type="email"], input[type="password"], input[type="url"], input[type="search"]'
  },
  'textarea': {
    selector: 'textarea'
  }
};

/**
 * Generic Component Classes Format
 * Automatically handles all component structures:
 * - Flat components (select, panel base)
 * - Components with variants (button: primary, secondary)
 * - Components with sub-components (file-tree: item, panel: header/content)
 * - Components with states (hover, selected, default)
 * - Element selectors (button, select, input, textarea) for automatic styling
 */
export function registerComponentsFormat(StyleDictionary) {
  StyleDictionary.registerFormat({
    name: 'css/components',
    format: ({ dictionary }) => {
      const componentGroups = {};

      // Group all tokens by component name
      dictionary.allTokens.forEach(token => {
        const componentName = token.path[0];

        // Skip non-component tokens
        if (!['button', 'file-tree', 'list', 'panel', 'select', 'text-input', 'textarea'].includes(componentName) &&
          !componentName.includes('component')) {
          return;
        }

        if (!componentGroups[componentName]) {
          componentGroups[componentName] = [];
        }
        componentGroups[componentName].push(token);
      });

      const cssOutput = [];

      // Process each component
      Object.entries(componentGroups).forEach(([componentName, tokens]) => {
        cssOutput.push(`/* ${componentName.toUpperCase()} Component */`);

        // Organize tokens by structure
        const baseProps = [];
        const variants = {};
        const subComponents = {};

        tokens.forEach(token => {
          const path = token.path;

          // Base properties (direct children of component)
          if (path.length === 2) {
            baseProps.push(token);
          }
          // Variants (e.g., button.primary, button.secondary)
          else if (path.length >= 3 && isVariant(path[1], tokens)) {
            const variantName = path[1];
            if (!variants[variantName]) {
              variants[variantName] = [];
            }
            variants[variantName].push(token);
          }
          // Sub-components (e.g., file-tree.item, panel.header)
          else if (path.length >= 3 && isSubComponent(path[1])) {
            const subName = path[1];
            if (!subComponents[subName]) {
              subComponents[subName] = [];
            }
            subComponents[subName].push(token);
          }
        });

        // Generate base component class (with optional element selector)
        if (baseProps.length > 0) {
          const cssProps = generateCssProperties(baseProps, componentName, true);
          if (cssProps.length > 0) {
            const elementMapping = ELEMENT_MAPPINGS[componentName];
            if (elementMapping && elementMapping.selector) {
              // Generate combined selector: .component, element
              cssOutput.push(`.${componentName},`);
              cssOutput.push(`${elementMapping.selector} {`);
            } else {
              // Generate class-only selector
              cssOutput.push(`.${componentName} {`);
            }
            cssProps.forEach(prop => cssOutput.push(`  ${prop}`));
            cssOutput.push(`}`);
          }
        }

        // Generate variant classes (e.g., .button-primary, .button-secondary)
        Object.entries(variants).forEach(([variantName, variantTokens]) => {
          const cssProps = generateCssProperties(variantTokens, componentName);
          const stateProps = extractStateProperties(variantTokens);
          const elementMapping = ELEMENT_MAPPINGS[componentName];

          // Check if this is the default variant for element styling
          const isDefaultVariant = elementMapping && elementMapping.defaultVariant === variantName;
          
          if (isDefaultVariant && elementMapping.variantSelector) {
            // Generate combined selector for default variant: .component-variant, element:not([class*="component-"])
            cssOutput.push(`.${componentName}-${variantName},`);
            cssOutput.push(`${elementMapping.variantSelector} {`);
          } else {
            // Generate class-only selector
            cssOutput.push(`.${componentName}-${variantName} {`);
          }
          cssProps.forEach(prop => cssOutput.push(`  ${prop}`));
          cssOutput.push(`}`);

          // State modifiers (e.g., :hover, :focus)
          Object.entries(stateProps).forEach(([state, props]) => {
            if (state !== 'default' && props.length > 0) {
              if (isDefaultVariant && elementMapping.variantSelector) {
                // Generate combined state selector for default variant
                cssOutput.push(`.${componentName}-${variantName}:${state},`);
                cssOutput.push(`${elementMapping.variantSelector}:${state} {`);
              } else {
                cssOutput.push(`.${componentName}-${variantName}:${state} {`);
              }
              props.forEach(prop => cssOutput.push(`  ${prop}`));
              cssOutput.push(`}`);
            }
          });
        });

        // Generate sub-component classes (e.g., .file-tree-item, .panel-header)
        Object.entries(subComponents).forEach(([subName, subTokens]) => {
          const cssProps = generateCssProperties(subTokens, componentName);
          const stateProps = extractStateProperties(subTokens);

          // Base sub-component class
          cssOutput.push(`.${componentName}-${subName} {`);
          cssProps.forEach(prop => cssOutput.push(`  ${prop}`));
          cssOutput.push(`}`);

          // State modifiers
          Object.entries(stateProps).forEach(([state, props]) => {
            if (state !== 'default' && props.length > 0) {
              cssOutput.push(`.${componentName}-${subName}:${state} {`);
              props.forEach(prop => cssOutput.push(`  ${prop}`));
              cssOutput.push(`}`);
            }
          });
        });

        cssOutput.push(''); // Empty line between components
      });

      return `/* Component Classes */\n/* Generated from Style Dictionary */\n\n${cssOutput.join('\n')}`;
    }
  });
}
