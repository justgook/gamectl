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
 * Component Classes Format
 * Creates component classes like:
 * .button { ... }
 * .button-primary { ... }
 */
StyleDictionary.registerFormat({
  name: 'css/components',
  format: ({ dictionary }) => {
    const components = {};

    // Group tokens by component
    dictionary.allTokens.forEach(token => {
      if (token.path[0] === 'button') {
        const component = 'button';
        if (!components[component]) {
          components[component] = {
            base: {},
            variants: {}
          };
        }

        // Base button properties (not nested in variants)
        if (['padding-v', 'padding-h', 'border-radius', 'font'].includes(token.path[1])) {
          components[component].base[token.path[1]] = token;
        }

        // Variant-specific properties
        if (token.path[1] === 'primary' || token.path[1] === 'secondary') {
          const variant = token.path[1];
          if (!components[component].variants[variant]) {
            components[component].variants[variant] = [];
          }
          components[component].variants[variant].push(token);
        }
      }
    });

    // Generate CSS classes
    const cssClasses = [];

    Object.entries(components).forEach(([componentName, { base, variants }]) => {
      // Base component class
      const baseProps = [];
      if (base['padding-v'] && base['padding-h']) {
        baseProps.push(`  padding: var(--${base['padding-v'].name}) var(--${base['padding-h'].name});`);
      }
      if (base['border-radius']) {
        baseProps.push(`  border-radius: var(--${base['border-radius'].name});`);
      }
      if (base['font']) {
        baseProps.push(`  font: var(--${base['font'].name});`);
      }
      baseProps.push(`  border-style: solid;`);
      baseProps.push(`  cursor: pointer;`);
      baseProps.push(`  transition: all 0.2s ease;`);

      cssClasses.push(`.${componentName} {\n${baseProps.join('\n')}\n}`);

      // Variant classes
      Object.entries(variants).forEach(([variantName, tokens]) => {
        const variantProps = [];

        tokens.forEach(token => {
          const property = token.path[2]; // e.g., background, text, border

          if (property === 'background') {
            if (token.path[3] === 'default') {
              variantProps.push(`  background-color: var(--${token.name});`);
            }
          } else if (property === 'text') {
            variantProps.push(`  color: var(--${token.name});`);
          } else if (property === 'border') {
            variantProps.push(`  border-color: var(--${token.name});`);
          }
        });

        // Add hover states
        cssClasses.push(`.${componentName}-${variantName} {\n${variantProps.join('\n')}\n}`);

        // Add hover class
        const hoverToken = tokens.find(t => t.path[2] === 'background' && t.path[3] === 'hover');
        if (hoverToken) {
          cssClasses.push(`.${componentName}-${variantName}:hover {\n  background-color: var(--${hoverToken.name});\n}`);
        }
      });
    });

    return `/* Component Classes */\n/* Generated from Style Dictionary */\n\n${cssClasses.join('\n\n')}`;
  }
});

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
            // Only include component tokens
            return token.path[0] === 'button' || token.path[0].includes('component');
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
