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
    this.defaultTileHeight = 40
    this.defaultTileWidth = 40
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
      ctx.fillStyle = this.colors[colorIndex]

      ctx.fillRect(x, y, tw, th)
    }
    ctx.restore()
  }
}
