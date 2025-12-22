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
    this.colors = generateHsluvColors(100)
    this.defaultTileHeight = 16
    this.defaultTileWidth = 16
  }

  /**
   * Calculate contrast color (black or white) for a given background color.
   * @param {string} hexColor - Background color in hex format
   * @returns {string} - Either '#000000' or '#ffffff'
   */
  getContrastColor(hexColor) {
    // Remove # if present
    const hex = hexColor.replace('#', '')
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Calculate relative luminance (ITU-R BT.709)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    // Return black for light backgrounds, white for dark backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff'
  }

  render(ctx, layer, _tilemap, _viewport) {
    const tw = parseFloat(layer.props?.tw) || this.defaultTileWidth
    const th = parseFloat(layer.props?.th) || this.defaultTileHeight
    const layerWidth = layer.width
    for (let i = 0; i < layer.data.length; i++) {
      const tileValue = layer.data[i]
      if (!tileValue) continue

      const x = (i % layerWidth) * tw
      const y = Math.floor(i / layerWidth) * th

      const colorIndex = tileValue % this.colors.length
      const tileColor = this.colors[colorIndex]
      ctx.fillStyle = tileColor

      ctx.fillRect(x, y, tw, th)

      // Draw tile ID in center with contrast color
      const textColor = this.getContrastColor(tileColor)
      ctx.fillStyle = textColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      // Set font size based on tile size (60% of tile height)
      const fontSize = Math.floor(th * 0.6)
      ctx.font = `${fontSize}px monospace`
      
      ctx.fillText(tileValue.toString(), x + tw / 2, y + th / 2)
    }
  }
}
