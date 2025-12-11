/**
 * TilemapEditor - Pure functional editor for tilemap data
 * 
 * Provides static methods to transform tilemap data without side effects.
 * Does not interact with event bus, cache, or SQL storage directly.
 */
export class TilemapEditor {
  /**
   * Paint tiles at specified indices across all layers
   * 
   * @param {Object} tilemap - Original tilemap data structure
   * @param {Array<number>} tileIndices - Array of tile indices (one per layer)
   * @returns {Object} New tilemap with painted tiles (sets value 1 at each index)
   */
  static paint(tilemap, tileIndices) {
    // Deep clone to avoid mutating original
    const newTilemap = JSON.parse(JSON.stringify(tilemap))

    tileIndices.forEach((tileIdx, layerIdx) => {
      // Skip if layer doesn't exist
      if (layerIdx >= newTilemap.layers.length) return

      const layer = newTilemap.layers[layerIdx]

      // Skip if tile index is out of bounds (silent ignore)
      if (tileIdx < 0 || tileIdx >= layer.data.length) return

      // Paint tile with value 1
      layer.data[tileIdx] = 1
    })

    return newTilemap
  }
}
