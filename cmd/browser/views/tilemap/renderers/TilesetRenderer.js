import { LayerRenderer } from './LayerRenderer.js'
import { decode as decodeQOI } from '../../../util/qoi/decode.js'

export class TilesetRenderer extends LayerRenderer {
  constructor(options = {}) {
    super(options)
    this.loading = false
    this.tileset = null
    this.render = (ctx, layer, tilemap, viewport) => this.loadTileset(ctx, layer, tilemap, viewport)
  }

  _render(ctx, layer, _tilemap, _viewport) {
    const tw = parseFloat(layer.props?.tw) || this.defaultTileWidth
    const th = parseFloat(layer.props?.th) || this.defaultTileHeight

    for (let i = 0; i < layer.data.length; i++) {
      const tileId = layer.data[i]

      // Skip empty tiles (ID 0)
      if (tileId === 0) continue

      // Calculate tile position in world coordinates
      const worldX = (i % layer.width) * tw
      const worldY = Math.floor(i / layer.width) * th

      this._renderTile(ctx, tileId, worldX, worldY)
    }
  }

  async loadTileset(_ctx, layer, _tilemap, _viewport) {
    this.render = () => { }

    this.loading = true
    const tilesetData = layer.props.tileset
    const tileWidth = parseFloat(layer.props?.tw) || this.defaultTileWidth
    const tileHeight = parseFloat(layer.props?.th) || this.defaultTileHeight

    let img

    // Check if tileset is a file path (not a data URI or URL)
    if (tilesetData && !tilesetData.startsWith('data:') && !tilesetData.startsWith('http')) {
      // Load from file system using FS plugin
      img = await this._loadImageFromFile(tilesetData)
    } else {
      // Load from URL or data URI
      img = await this._loadImageFromUrl(tilesetData)
    }

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

  /**
   * Load an image from a file path using the FS plugin
   * @param {string} path - File path to the image
   * @returns {Promise<ImageBitmap>} Loaded image
   */
  async _loadImageFromFile(path) {
    const result = await window.pluginManager.call('fs', 'read', path)
    if (result.returnCode !== 0) {
      throw new Error(`Failed to read tileset file: ${new TextDecoder().decode(result.output)}`)
    }

    const data = result.output
    let imageData

    // Check for QOI magic bytes
    if (data.length >= 4 && data[0] === 0x71 && data[1] === 0x6f && data[2] === 0x69 && data[3] === 0x66) {
      // Decode QOI format
      const decoded = decodeQOI(data.buffer)
      imageData = new ImageData(
        new Uint8ClampedArray(decoded.data.buffer),
        decoded.width,
        decoded.height
      )
    } else {
      // Assume PNG or other standard format
      const blob = new Blob([data], { type: 'image/png' })
      const bitmap = await createImageBitmap(blob)
      return bitmap
    }

    return createImageBitmap(imageData)
  }

  /**
   * Load an image from a URL or data URI
   * @param {string} src - URL or data URI
   * @returns {Promise<HTMLImageElement>} Loaded image
   */
  async _loadImageFromUrl(src) {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = src
    })
    return img
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
