/**
 * JavaScript port of Go tilemap selector system from pkg/tilemap/selector.go
 * 
 * Supports CSS-like selector syntax:
 *   - Index selectors: "#0", "#1", "#2" (0-based layer index)
 *   - Attribute selectors: "[key=\"value\"]", "[key]", "[key!=\"value\"]"
 *   - Wildcard selector: "*" (first available layer)
 */
export class TilemapSelector {

  /**
   * Find first layer matching the selector
   * @param {Object} tilemap - Tilemap object with layers array
   * @param {string} selector - CSS-like selector string
   * @returns {Object|null} First matching layer or null
   */
  static findLayer(tilemap, selector) {
    if (!tilemap || !Array.isArray(tilemap.layers) || tilemap.layers.length === 0) {
      return null
    }

    selector = selector.trim()

    if (selector === "*") {
      // Wildcard: match first available layer
      return tilemap.layers[0]
    }

    if (selector.startsWith("#")) {
      // Index selector: #0, #1, #2
      return this._findLayerByIndex(tilemap, selector)
    }

    if (selector.startsWith("[") && selector.endsWith("]")) {
      // Attribute selector: [key="value"], [key], [key!="value"]
      const attrExpr = selector.slice(1, -1)
      return this._findLayerByAttribute(tilemap, attrExpr)
    }

    // Invalid selector format
    return null
  }

  /**
   * Find all layers matching the selector
   * @param {Object} tilemap - Tilemap object with layers array 
   * @param {string} selector - CSS-like selector string
   * @returns {Array} Array of matching layers (empty if no matches)
   */
  static findLayers(tilemap, selector) {
    if (!tilemap || !Array.isArray(tilemap.layers) || tilemap.layers.length === 0) {
      return []
    }

    selector = selector.trim()
    const matches = []

    if (selector === "*") {
      // Wildcard: match all layers
      return [...tilemap.layers]
    }

    if (selector.startsWith("#")) {
      // Index selector: single match only
      const layer = this._findLayerByIndex(tilemap, selector)
      if (layer) matches.push(layer)
    } else if (selector.startsWith("[") && selector.endsWith("]")) {
      // Attribute selector: find all matching layers
      const attrExpr = selector.slice(1, -1)
      for (const layer of tilemap.layers) {
        if (this._matchesAttribute(layer, attrExpr)) {
          matches.push(layer)
        }
      }
    }

    return matches
  }

  /**
   * Check if tilemap has any layer matching the selector
   * @param {Object} tilemap - Tilemap object with layers array
   * @param {string} selector - CSS-like selector string
   * @returns {boolean} True if at least one match found
   */
  static hasLayerWithSelector(tilemap, selector) {
    return this.findLayer(tilemap, selector) !== null
  }

  /**
   * Count how many layers match the selector
   * @param {Object} tilemap - Tilemap object with layers array
   * @param {string} selector - CSS-like selector string  
   * @returns {number} Number of matching layers
   */
  static countLayersWithSelector(tilemap, selector) {
    return this.findLayers(tilemap, selector).length
  }

  // --- Private Methods ---

  /**
   * Find layer by numeric index (#0, #1, etc.)
   * @private
   */
  static _findLayerByIndex(tilemap, selector) {
    const indexStr = selector.slice(1) // Remove '#' prefix
    const idx = parseInt(indexStr, 10)

    if (isNaN(idx) || idx < 0 || idx >= tilemap.layers.length) {
      return null
    }

    return tilemap.layers[idx]
  }

  /**
   * Find first layer matching an attribute expression
   * @private
   */
  static _findLayerByAttribute(tilemap, attrExpr) {
    for (const layer of tilemap.layers) {
      if (this._matchesAttribute(layer, attrExpr)) {
        return layer
      }
    }
    return null
  }

  /**
   * Check if a layer matches an attribute expression
   * @private
   */
  static _matchesAttribute(layer, attrExpr) {
    if (!layer.props || typeof layer.props !== 'object') {
      return false
    }

    attrExpr = attrExpr.trim()

    if (attrExpr.includes("!=")) {
      // Negated attribute: [key!="value"]
      return this._matchesNegatedAttribute(layer, attrExpr)
    } else if (attrExpr.includes("=")) {
      // Exact attribute: [key="value"]
      return this._matchesExactAttribute(layer, attrExpr)
    } else {
      // Key exists: [key]
      const key = attrExpr.trim()
      return Object.prototype.hasOwnProperty.call(layer.props, key)
    }
  }

  /**
   * Check [key="value"] pattern
   * @private
   */
  static _matchesExactAttribute(layer, attrExpr) {
    const parts = attrExpr.split("=", 2)
    if (parts.length !== 2) {
      return false
    }

    const key = parts[0].trim()
    let value = parts[1].trim()

    // Remove quotes if present
    value = value.replace(/^["']|["']$/g, '')

    return layer.props[key] === value
  }

  /**
   * Check [key!="value"] pattern  
   * @private
   */
  static _matchesNegatedAttribute(layer, attrExpr) {
    const parts = attrExpr.split("!=", 2)
    if (parts.length !== 2) {
      return false
    }

    const key = parts[0].trim()
    let value = parts[1].trim()

    // Remove quotes if present
    value = value.replace(/^["']|["']$/g, '')

    // If key doesn't exist, treat as not equal to any value
    if (!Object.prototype.hasOwnProperty.call(layer.props, key)) {
      return true
    }

    return layer.props[key] !== value
  }
}
