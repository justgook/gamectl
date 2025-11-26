import StyleDictionary from 'style-dictionary';
import { registerAtomicFormat } from './script/formats/atomic.js';
import { registerComponentsFormat } from './script/formats/components.js';

// ============================================
// REGISTER CUSTOM FORMATS
// ============================================

registerAtomicFormat(StyleDictionary);
registerComponentsFormat(StyleDictionary);

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
            return ['button', 'file-tree', 'list', 'panel', 'select', 'text-input', 'textarea', 'resize-handle', 'corner-handle'].includes(token.path[0]) ||
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
