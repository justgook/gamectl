import StyleDictionary from 'style-dictionary';

// ============================================
// CUSTOM FORMATS
// ============================================

/**
 * Atomic/Utility Classes Format
 * Creates Tailwind-style utility classes like:
 * .bg-grey-900 { background-color: var(--color-grey-900); }
 * .text-grey-900 { color: var(--color-grey-900); }
 * .p-3 { padding: var(--spacing-scale-3); }
 */
StyleDictionary.registerFormat({
  name: 'css/atomic',
  format: ({ dictionary }) => {
    const classes = [];

    dictionary.allTokens.forEach(token => {
      // Skip component tokens - they get their own format
      if (token.path[0] === 'button' || token.path[0].includes('component')) {
        return;
      }

      const cssVarName = token.name;

      // COLOR TOKENS
      if (token.$type === 'color' && token.path[0] === 'color') {
        const colorName = token.path.slice(1).join('-'); // e.g., grey-900, cyan-500

        // Background color utility
        classes.push(`.bg-${colorName} { background-color: var(--${cssVarName}); }`);

        // Text color utility
        classes.push(`.text-${colorName} { color: var(--${cssVarName}); }`);

        // Border color utility
        classes.push(`.border-${colorName} { border-color: var(--${cssVarName}); }`);
      }

      // SPACING TOKENS
      if (token.$type === 'dimension' && token.path[0] === 'spacing') {
        const scale = token.path[1].replace('scale-', ''); // e.g., 3, 5

        // Padding utilities
        classes.push(`.p-${scale} { padding: var(--${cssVarName}); }`);
        classes.push(`.px-${scale} { padding-left: var(--${cssVarName}); padding-right: var(--${cssVarName}); }`);
        classes.push(`.py-${scale} { padding-top: var(--${cssVarName}); padding-bottom: var(--${cssVarName}); }`);
        classes.push(`.pt-${scale} { padding-top: var(--${cssVarName}); }`);
        classes.push(`.pr-${scale} { padding-right: var(--${cssVarName}); }`);
        classes.push(`.pb-${scale} { padding-bottom: var(--${cssVarName}); }`);
        classes.push(`.pl-${scale} { padding-left: var(--${cssVarName}); }`);

        // Margin utilities
        classes.push(`.m-${scale} { margin: var(--${cssVarName}); }`);
        classes.push(`.mx-${scale} { margin-left: var(--${cssVarName}); margin-right: var(--${cssVarName}); }`);
        classes.push(`.my-${scale} { margin-top: var(--${cssVarName}); margin-bottom: var(--${cssVarName}); }`);
        classes.push(`.mt-${scale} { margin-top: var(--${cssVarName}); }`);
        classes.push(`.mr-${scale} { margin-right: var(--${cssVarName}); }`);
        classes.push(`.mb-${scale} { margin-bottom: var(--${cssVarName}); }`);
        classes.push(`.ml-${scale} { margin-left: var(--${cssVarName}); }`);

        // Gap utilities
        classes.push(`.gap-${scale} { gap: var(--${cssVarName}); }`);
      }

      // BORDER RADIUS TOKENS
      if (token.$type === 'dimension' && token.path[0] === 'border' && token.path[1] === 'radius') {
        const radiusName = token.path[2]; // e.g., sm, sharp
        classes.push(`.rounded-${radiusName} { border-radius: var(--${cssVarName}); }`);
      }

      // BORDER WIDTH TOKENS
      if (token.$type === 'dimension' && token.path[0] === 'border' && token.path[1] === 'width') {
        const widthName = token.path[2]; // e.g., default, thick
        const className = widthName === 'default' ? 'border' : `border-${widthName}`;
        classes.push(`.${className} { border-width: var(--${cssVarName}); }`);
      }
    });

    return `/* Atomic Utility Classes */\n/* Generated from Style Dictionary */\n\n${classes.join('\n')}`;
  }
});

/**
 * Helper: Map token path/name to CSS property
 */
function getCssProperty(pathSegment, tokenType) {
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
 * Generic Component Classes Format
 * Automatically handles all component structures:
 * - Flat components (select, panel base)
 * - Components with variants (button: primary, secondary)
 * - Components with sub-components (file-tree: item, panel: header/content)
 * - Components with states (hover, selected, default)
 */
StyleDictionary.registerFormat({
  name: 'css/components',
  format: ({ dictionary }) => {
    const componentGroups = {};

    // Group all tokens by component name
    dictionary.allTokens.forEach(token => {
      const componentName = token.path[0];

      // Skip non-component tokens
      if (!['button', 'file-tree', 'list', 'panel', 'select'].includes(componentName) &&
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

      // Generate base component class
      if (baseProps.length > 0) {
        const cssProps = generateCssProperties(baseProps, componentName);
        if (cssProps.length > 0) {
          cssOutput.push(`.${componentName} {`);
          cssProps.forEach(prop => cssOutput.push(`  ${prop}`));
          cssOutput.push(`}`);
        }
      }

      // Generate variant classes (e.g., .button-primary, .button-secondary)
      Object.entries(variants).forEach(([variantName, variantTokens]) => {
        const cssProps = generateCssProperties(variantTokens, componentName);
        const stateProps = extractStateProperties(variantTokens);

        // Base variant class
        cssOutput.push(`.${componentName}-${variantName} {`);
        cssProps.forEach(prop => cssOutput.push(`  ${prop}`));
        cssOutput.push(`}`);

        // State modifiers (e.g., :hover, :focus)
        Object.entries(stateProps).forEach(([state, props]) => {
          if (state !== 'default' && props.length > 0) {
            cssOutput.push(`.${componentName}-${variantName}:${state} {`);
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

/**
 * Generate CSS properties from tokens (excluding state-specific ones)
 */
function generateCssProperties(tokens, componentName) {
  const props = [];
  const processed = new Set();

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
    const cssProperty = getCssProperty(propertyName, token.$type);

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

  // Add common properties for interactive components
  if (componentName === 'button' || componentName === 'select') {
    if (!props.some(p => p.includes('cursor'))) {
      props.push('cursor: pointer;');
    }
    if (!props.some(p => p.includes('border-style'))) {
      props.push('border-style: solid;');
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
      const cssProperty = getCssProperty(propertyName, token.$type);

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

// ============================================
// CONFIGURATION
// ============================================

export default {
  "usesDtcg": true,
  "source": [
    "tokens/**/*.json"
  ],
  "platforms": {
    "css": {
      "transformGroup": "css",
      "buildPath": "build/css/",
      "files": [
        {
          "destination": "variables.css",
          "format": "css/variables",
          "options": {
            "outputReferences": true
          }
        },
        {
          "destination": "atomic.css",
          "format": "css/atomic",
          "filter": (token) => {
            // Only include base tokens (color, spacing, border)
            // Exclude component-specific tokens
            return !token.path[0].includes('button') &&
              !token.path[0].includes('component') &&
              !token.path[0].includes('semantic');
          }
        },
        {
          "destination": "components.css",
          "format": "css/components",
          "filter": (token) => {
            // Include all component tokens
            return ['button', 'file-tree', 'list', 'panel', 'select'].includes(token.path[0]) ||
              token.path[0].includes('component');
          }
        }
      ]
    },
    "js": {
      "transformGroup": "js",
      "buildPath": "build/js/",
      "files": [
        {
          "destination": "tokens.js",
          "format": "javascript/es6"
        }
      ]
    }
  }
}
