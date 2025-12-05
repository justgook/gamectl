import { LayerRenderer } from './LayerRenderer.js'

export class TilesetRenderer extends LayerRenderer {
  constructor(options = {}) {
    super(options)
    this.loading = false
    this.tileset = null
    this.render = (ctx, layer, tilemap, viewport) => this.loadTileset(ctx, layer, tilemap, viewport)
  }

  _render(ctx, layer, _tilemap, _viewport) {
    console.log("THE REAL RENDER")

    ctx.rect(20, 20, 150, 100);
    ctx.fillStyle = "red";
    ctx.fill();

    const tw = parseFloat(layer.meta?.tw) || this.defaultTileWidth
    const th = parseFloat(layer.meta?.th) || this.defaultTileHeight

    ctx.save()
    for (let i = 0; i < layer.data.length; i++) {
      const tileId = layer.data[i]

      // Skip empty tiles (ID 0)
      if (tileId === 0) continue

      // Calculate tile position in world coordinates
      const worldX = (i % layer.width) * tw
      const worldY = Math.floor(i / layer.width) * th

      this._renderTile(ctx, tileId, worldX, worldY)
    }
    ctx.restore()

  }

  needsRedraw(eventType, _layer, _tilemap, _eventData) {
    console.log("needsRedraw", eventType)

    return true
  }

  async loadTileset(_ctx, layer, _tilemap, _viewport) {
    this.render = () => { }

    this.loading = true
    const tilesetData = layer.meta.tileset
    const tileWidth = parseFloat(layer.meta?.tw) || this.defaultTileWidth
    const tileHeight = parseFloat(layer.meta?.th) || this.defaultTileHeight
    const img = new Image()

    // Wait for image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = tilesetData
    })

    const cols = Math.floor(img.width / tileWidth)
    this.loading = false
    this.tileset = {
      image: img,
      tileWidth,
      tileHeight,
      cols,
    }
    this.render = this._render.bind(this)
  }

  _renderTile(ctx, tileId, worldX, worldY) {
    const tilesetInfo = this.tileset
    const tileIndex = tileId - 1
    const srcX = (tileIndex % tilesetInfo.cols) * tilesetInfo.tileWidth
    const srcY = Math.floor(tileIndex / tilesetInfo.cols) * tilesetInfo.tileHeight

    ctx.drawImage(
      tilesetInfo.image,
      srcX, srcY, tilesetInfo.tileWidth, tilesetInfo.tileHeight,
      worldX, worldY, tilesetInfo.tileWidth, tilesetInfo.tileHeight,
    )
  }
}
