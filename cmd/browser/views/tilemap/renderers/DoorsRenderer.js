import { LayerRenderer } from './LayerRenderer.js'

/**
 * Doors renderer for layers containing door mask data.
 * 
 * Renders doors as visual door elements on tiles using bit mask data:
 * - DoorNorth = 1, DoorEast = 2, DoorSouth = 4, DoorWest = 8
 * 
 * Selector: [type="doors"] (changed from hardcoded layer index)
 */
export class DoorsRenderer extends LayerRenderer {

  constructor(options = {}) {
    super(options)

    // Door bit mask constants
    this.DoorNorth = 1
    this.DoorEast = 2
    this.DoorSouth = 4
    this.DoorWest = 8

    // Default tile dimensions (can be overridden by layer props)
    this.defaultTileWidth = 40
    this.defaultTileHeight = 40

    // Door visual configuration
    this.doorConfig = {
      widthRatio: 0.4,    // Door is 40% of tile width
      depth: 8,           // How "deep" the door looks
      inset: 1,           // Distance from tile edge
      frameColor: '#654321',
      doorColor: '#8B4513',
      handleColor: '#FFD700',
      ...options.doors    // Allow override via options.doors
    }

    // Doors don't need to respond to zoom/pan (they're part of the world)
    this.respondsToZoom = false
    this.respondsToResize = true
  }

  /**
   * Render doors for the layer
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context to draw to
   * @param {Object} layer - Layer data with door mask data
   * @param {Object} tilemap - Full tilemap data 
   * @param {Object} viewport - Viewport transform matrix
   */
  render(ctx, layer, tilemap, viewport) {
    try {
      if (!layer || !Array.isArray(layer.data) || !layer.width) {
        return // Nothing to render
      }

      // Get tile dimensions from layer props or use defaults
      const tileWidth = layer.props?.tw || this.defaultTileWidth
      const tileHeight = layer.props?.th || this.defaultTileHeight

      this._drawDoors(ctx, tileWidth, tileHeight, layer.width, layer.data)

    } catch (error) {
      this.handleError(error, `DoorsRenderer.render for layer with ${layer?.data?.length || 0} door masks`)
    }
  }

  /**
   * Update door visual configuration
   * @param {Object} newConfig - New door configuration
   */
  updateDoorConfig(newConfig) {
    this.doorConfig = { ...this.doorConfig, ...newConfig }
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
   * Draw doors based on layer door mask data
   * Extracted from original view-tilemap.js drawDoors function
   * @private
   */
  _drawDoors(ctx, tileWidth, tileHeight, layerWidth, doorData) {
    const doorWidth = tileWidth * this.doorConfig.widthRatio
    const { depth, inset, frameColor, doorColor, handleColor } = this.doorConfig

    for (let i = 0; i < doorData.length; i++) {
      const doorMask = doorData[i]
      if (!doorMask) continue

      const x = (i % layerWidth) * tileWidth
      const y = Math.floor(i / layerWidth) * tileHeight
      const cx = x + tileWidth / 2
      const cy = y + tileHeight / 2

      ctx.save()

      // North door
      if (doorMask & this.DoorNorth) {
        this._drawDoor(ctx, {
          frameX: cx - doorWidth / 2 - 2,
          frameY: y + inset,
          frameW: doorWidth + 4,
          frameH: depth + 2,
          doorX: cx - doorWidth / 2,
          doorY: y + inset + 1,
          doorW: doorWidth,
          doorH: depth,
          handleX: cx + doorWidth / 3,
          handleY: y + inset + depth / 2 - 1
        })
      }

      // East door
      if (doorMask & this.DoorEast) {
        this._drawDoor(ctx, {
          frameX: x + tileWidth - inset - depth - 2,
          frameY: cy - doorWidth / 2 - 2,
          frameW: depth + 2,
          frameH: doorWidth + 4,
          doorX: x + tileWidth - inset - depth,
          doorY: cy - doorWidth / 2,
          doorW: depth,
          doorH: doorWidth,
          handleX: x + tileWidth - inset - depth / 2 - 1,
          handleY: cy + doorWidth / 3
        })
      }

      // South door  
      if (doorMask & this.DoorSouth) {
        this._drawDoor(ctx, {
          frameX: cx - doorWidth / 2 - 2,
          frameY: y + tileHeight - inset - depth - 2,
          frameW: doorWidth + 4,
          frameH: depth + 2,
          doorX: cx - doorWidth / 2,
          doorY: y + tileHeight - inset - depth,
          doorW: doorWidth,
          doorH: depth,
          handleX: cx - doorWidth / 3 - 3,
          handleY: y + tileHeight - inset - depth / 2 - 1
        })
      }

      // West door
      if (doorMask & this.DoorWest) {
        this._drawDoor(ctx, {
          frameX: x + inset,
          frameY: cy - doorWidth / 2 - 2,
          frameW: depth + 2,
          frameH: doorWidth + 4,
          doorX: x + inset + 1,
          doorY: cy - doorWidth / 2,
          doorW: depth,
          doorH: doorWidth,
          handleX: x + inset + depth / 2 - 1,
          handleY: cy - doorWidth / 3 - 3
        })
      }

      ctx.restore()
    }
  }

  /**
   * Draw individual door with frame and handle
   * @private
   */
  _drawDoor(ctx, coords) {
    const { frameColor, doorColor, handleColor } = this.doorConfig

    // Door frame (darker)
    ctx.fillStyle = frameColor
    ctx.fillRect(coords.frameX, coords.frameY, coords.frameW, coords.frameH)

    // Door (lighter brown)
    ctx.fillStyle = doorColor
    ctx.fillRect(coords.doorX, coords.doorY, coords.doorW, coords.doorH)

    // Door handle
    ctx.fillStyle = handleColor
    ctx.fillRect(coords.handleX, coords.handleY, 3, 3)
  }
}
