import { LayerRenderer } from './LayerRenderer.js'

/**
 * Grid renderer that draws background grid lines.
 * 
 * This is a special "global" renderer that:
 * - Renders first, before all layer renderers
 * - Doesn't depend on any specific layer data
 * - Has its own configuration separate from ViewTilemap
 * - Responds to zoom events (grid appearance changes with scale)
 */
export class GridRenderer extends LayerRenderer {

  constructor(options = {}) {
    super(options)
    
    // Grid-specific configuration (independent from ViewTilemap settings)
    this.config = {
      tileWidth: 40,
      tileHeight: 40,
      lineWidth: 1,
      color: '#ccc',
      ...options.grid // Allow override via options.grid
    }
    
    // Grid renderer responds to zoom and resize events
    this.respondsToZoom = true
    this.respondsToResize = true
  }

  /**
   * Render grid background
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context to draw to
   * @param {Object|null} layer - Always null for grid renderer
   * @param {Object} tilemap - Full tilemap data
   * @param {Object} viewport - Viewport transform matrix
   */
  render(ctx, layer, tilemap, viewport) {
    try {
      // Calculate content bounds for grid sizing
      const contentBounds = this._calculateContentBounds(tilemap)
      if (!contentBounds) return
      
      const { maxX: width, maxY: height } = contentBounds
      
      // Create and fill grid pattern
      this._fillCanvasWithGrid(ctx, width, height)
      
    } catch (error) {
      this.handleError(error, 'GridRenderer.render')
    }
  }

  /**
   * Update grid configuration
   * @param {Object} newConfig - New grid configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    this.markDirty()
  }

  // --- Private Methods ---

  /**
   * Calculate content bounds from tilemap data
   * @private
   */
  _calculateContentBounds(tilemap) {
    if (!tilemap || !Array.isArray(tilemap.layers) || tilemap.layers.length === 0) {
      return null
    }

    // Use same logic as ViewTilemap.calculateContentBounds but with our config
    const width = tilemap.layers.reduce((acc, layer) =>
      Math.max(layer.width * this.config.tileWidth, acc), 0)

    const height = tilemap.layers.reduce((acc, layer) => {
      const layerHeight = layer.data.length / layer.width * this.config.tileHeight
      return Math.max(layerHeight, acc)
    }, 0)

    return {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
    }
  }

  /**
   * Fill canvas with grid pattern
   * @private
   */
  _fillCanvasWithGrid(ctx, width, height) {
    const gridPattern = this._createGridPattern(ctx)
    ctx.fillStyle = gridPattern
    ctx.fillRect(0, 0, width, height)
  }

  /**
   * Create repeating grid pattern
   * @private
   */
  _createGridPattern(ctx) {
    const { tileWidth, tileHeight, color, lineWidth } = this.config
    
    // Create small tile canvas for pattern
    const tileCanvas = document.createElement('canvas')
    tileCanvas.width = tileWidth
    tileCanvas.height = tileHeight
    const tileCtx = tileCanvas.getContext('2d')
    
    // Draw grid lines on bottom and right edges
    tileCtx.fillStyle = color
    tileCtx.fillRect(0, tileHeight - lineWidth, tileWidth, lineWidth) // Bottom edge
    tileCtx.fillRect(tileWidth - lineWidth, 0, lineWidth, tileHeight) // Right edge
    
    return ctx.createPattern(tileCanvas, 'repeat')
  }
}