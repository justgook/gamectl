/**
 * Atomic/Utility Classes Format
 * Creates Tailwind-style utility classes like:
 * .bg-grey-900 { background-color: var(--color-grey-900); }
 * .text-grey-900 { color: var(--color-grey-900); }
 * .p-3 { padding: var(--spacing-scale-3); }
 */
export function registerAtomicFormat(StyleDictionary) {
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
}
