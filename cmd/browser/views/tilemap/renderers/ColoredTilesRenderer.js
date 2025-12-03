import { LayerRenderer } from './LayerRenderer.js'
import { generateHsluvColors } from '../../../util/colors.js'

/**
 * Default colored tiles renderer for basic tile layer visualization.
 * 
 * Renders tiles as colored rectangles using HSLuv color generation.
 * This is the fallback renderer (selector: "*") for layers without 
 * specific renderers.
 */
export class ColoredTilesRenderer extends LayerRenderer {

  constructor(options = {}) {
    super(options)
    
    // Generate color palette for tile rendering
    this.colors = generateHsluvColors(50)
    
    // Default tile dimensions (can be overridden by layer meta)
    this.defaultTileWidth = 40
    this.defaultTileHeight = 40
    
    // Responds to zoom events (colors may need re-rendering at different scales)
    this.respondsToZoom = false // Colors don't change with zoom
    this.respondsToResize = true
  }

  /**
   * Render colored tiles for the layer
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context to draw to
   * @param {Object} layer - Layer data with width, data, and optional meta
   * @param {Object} tilemap - Full tilemap data
   * @param {Object} viewport - Viewport transform matrix
   */
  render(ctx, layer, tilemap, viewport) {
    try {
      if (!layer || !Array.isArray(layer.data) || !layer.width) {
        return // Nothing to render
      }

      // Get tile dimensions from layer meta or use defaults
      const tileWidth = layer.meta?.tw || this.defaultTileWidth
      const tileHeight = layer.meta?.th || this.defaultTileHeight

      this._drawColoredTiles(ctx, tileWidth, tileHeight, layer.width, layer.data)
      
    } catch (error) {
      this.handleError(error, `ColoredTilesRenderer.render for layer with ${layer?.data?.length || 0} tiles`)
    }
  }

  /**
   * Update the color palette
   * @param {Array} newColors - Array of color strings
   */
  updateColors(newColors) {
    this.colors = newColors
    this.markDirty()
  }

  /**
   * Update default tile dimensions
   * @param {number} width - Default tile width
   * @param {number} height - Default tile height
   */
  updateDefaultTileSize(width, height) {
    this.defaultTileWidth = width
    this.defaultTileHeight = height
    this.markDirty()
  }

  // --- Private Methods ---

  /**
   * Draw colored tiles based on layer data
   * Extracted from original view-tilemap.js drawColoredTiles function
   * @private
   */
  _drawColoredTiles(ctx, tileWidth, tileHeight, layerWidth, data) {
    for (let i = 0; i < data.length; i++) {
      const tileValue = data[i]
      
      // Skip empty tiles (value 0)
      if (tileValue < 1) continue
      
      // Calculate tile position
      const x = (i % layerWidth) * tileWidth
      const y = Math.floor(i / layerWidth) * tileHeight
      
      // Get color for this tile value (with bounds checking)
      const colorIndex = tileValue % this.colors.length
      ctx.fillStyle = this.colors[colorIndex]
      
      // Draw tile rectangle
      ctx.fillRect(x, y, tileWidth, tileHeight)
    }
  }
}