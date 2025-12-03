import { LayerRenderer } from './LayerRenderer.js'

/**
 * Tileset renderer for layers that use external tileset images.
 * 
 * This is a stub implementation that will be expanded when tileset
 * support is added to the tilemap system.
 * 
 * Selector: [meta.tileset] - matches layers with tileset metadata
 */
export class TilesetRenderer extends LayerRenderer {

  constructor(options = {}) {
    super(options)
    
    // Default tile dimensions
    this.defaultTileWidth = 40
    this.defaultTileHeight = 40
    
    // Tileset rendering typically responds to zoom for crisp display
    this.respondsToZoom = true
    this.respondsToResize = true
    
    // Track loaded tilesets (for future implementation)
    this.loadedTilesets = new Map()
  }

  /**
   * Render tileset layer (stub implementation)
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context to draw to
   * @param {Object} layer - Layer data with tileset metadata
   * @param {Object} tilemap - Full tilemap data
   * @param {Object} viewport - Viewport transform matrix
   */
  render(ctx, layer, tilemap, viewport) {
    try {
      // For now, log that tileset rendering is not implemented
      // and render a placeholder
      
      console.warn('🎨 TilesetRenderer: Tileset rendering not yet implemented', {
        layer: layer,
        tilesetPath: layer.meta?.tileset
      })
      
      this._renderPlaceholder(ctx, layer)
      
    } catch (error) {
      this.handleError(error, `TilesetRenderer.render for tileset: ${layer?.meta?.tileset || 'unknown'}`)
    }
  }

  /**
   * Load tileset image (stub for future implementation)
   * @param {string} tilesetPath - Path to tileset image
   * @returns {Promise<HTMLImageElement>} Promise resolving to loaded image
   */
  async loadTileset(tilesetPath) {
    // TODO: Implement tileset loading
    console.log(`📋 TilesetRenderer: Would load tileset from ${tilesetPath}`)
    return null
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
   * Render placeholder for tileset layers
   * @private
   */
  _renderPlaceholder(ctx, layer) {
    if (!layer || !Array.isArray(layer.data) || !layer.width) {
      return
    }

    const tileWidth = layer.meta?.tw || this.defaultTileWidth
    const tileHeight = layer.meta?.th || this.defaultTileHeight
    const tilesetName = layer.meta?.tileset || 'unknown'

    // Render placeholder rectangles with tileset name
    ctx.save()
    ctx.strokeStyle = '#ff6b6b'
    ctx.fillStyle = 'rgba(255, 107, 107, 0.1)'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'

    for (let i = 0; i < layer.data.length; i++) {
      const tileValue = layer.data[i]
      
      if (tileValue < 1) continue
      
      const x = (i % layer.width) * tileWidth
      const y = Math.floor(i / layer.width) * tileHeight
      
      // Draw placeholder rectangle
      ctx.fillRect(x, y, tileWidth, tileHeight)
      ctx.strokeRect(x, y, tileWidth, tileHeight)
      
      // Draw tile ID in center
      ctx.fillStyle = '#ff6b6b'
      ctx.fillText(String(tileValue), x + tileWidth/2, y + tileHeight/2)
      ctx.fillStyle = 'rgba(255, 107, 107, 0.1)'
    }

    ctx.restore()
  }
}