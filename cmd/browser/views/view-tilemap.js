import { ViewCanvasBase } from "./view-canvas-base.js"
import { GridRenderer } from "./tilemap/renderers/GridRenderer.js"
import { ColoredTilesRenderer } from "./tilemap/renderers/ColoredTilesRenderer.js"
import { DoorsRenderer } from "./tilemap/renderers/DoorsRenderer.js"
import { TilesetRenderer } from "./tilemap/renderers/TilesetRenderer.js"
import { TilemapSelector } from './tilemap/TilemapSelector.js'
import { TilemapMenu } from './tilemap/menu.js'
import { bus } from "../systems/event-bus.js"
import { TilemapEditor } from "../systems/tilemap-editor.js"

// Default tile dimensions when not specified in layer.props
const DEFAULT_TILE_WIDTH = 16
const DEFAULT_TILE_HEIGHT = 16

function noop() { }

export class ViewTilemap extends ViewCanvasBase {
  static get viewMeta() { return { displayName: 'Tilemap', category: 'Canvas' } }

  static get observedAttributes() {
    return ['data-key'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'data-key' && oldVal !== newVal) {
      this.tilemapKey = newVal
      this.unsubscibe()
      this.unsubscibe = bus.on(`cache:changed:${this.getSelectQuery()}`, this.dataChanged)
    }
  }

  constructor() {
    super()
    this.DE = new TextDecoder()
    this.tilemapKey = 'new_map'
    this.rendersBefore = [new GridRenderer()]

    this.availableRenders = new Map()
    this.availableRenders.set('[type="doors"]', DoorsRenderer)
    this.availableRenders.set('[tileset]', TilesetRenderer)
    this.availableRenders.set('*', ColoredTilesRenderer) // Fallback - always last
    this.unsubscibe = noop
    this.menu = new TilemapMenu()

    // Painting state
    this.isPainting = false
    this.lastPaintedTile = null
    this.currentTileValue = 1
  }

  setupUI() {
    // Add menu
    this.appendChild(this.menu)

    // Create tooltip
    this.tileInfo = document.createElement('div')
    this.tileInfo.className = 'tooltip'
    this.tileInfo.setAttribute('data-tooltip', '')
    this.tileInfo.style.display = 'none'
    this.appendChild(this.tileInfo)
  }

  connectedCallback() {
    super.connectedCallback()
    this.renders = []
    this.unsubscibe = bus.on(`cache:changed:${this.getSelectQuery()}`, this.dataChanged)

    // Setup button handlers (query from header controls)
    const reloadBtn = this.queryHeaderControl('[data-action="reload"]')
    if (reloadBtn) {
      reloadBtn.onclick = () => this.fetchData()
    }

    const zoomInBtn = this.queryHeaderControl('[data-action="zoom-in"]')
    if (zoomInBtn) {
      zoomInBtn.onclick = () => this.zoomIn()
    }

    const zoomOutBtn = this.queryHeaderControl('[data-action="zoom-out"]')
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => this.zoomOut()
    }

    const zoomFitBtn = this.queryHeaderControl('[data-action="zoom-fit"]')
    if (zoomFitBtn) {
      zoomFitBtn.onclick = () => this.fitToContent()
    }

    const tileValueInput = this.queryHeaderControl('[data-action="tile-value"]')
    if (tileValueInput) {
      tileValueInput.oninput = (e) => {
        this.currentTileValue = parseInt(e.target.value, 10) || 0
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.unsubscibe()
  }

  dataChanged = (data) => {
    this.data = data
    this._prepareRenders(data)
    this.menu.title = this.tilemapKey
    this.menu.data = data

    this.contentBounds = this.calculateContentBounds(this.data)
    this.draw()
  }

  async fetchData() {
    bus.emit(`cache:load:${this.getSelectQuery()}`)

    return this.data
  }

  getSelectQuery() {
    return `SELECT data FROM tilemap_storage WHERE name = '${this.tilemapKey}'`
  }

  getInsertQueryFn() {
    return (name, escapedData) => {
      return `INSERT OR REPLACE INTO tilemap_storage (name, data) VALUES ('${name}', '${escapedData}')`
    }
  }

  calculateContentBounds(data) {
    if (!data || !data.layers || !Array.isArray(data.layers) || data.layers.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const width = data.layers.reduce((acc, item) => {
      const tw = parseFloat(item.props?.tw) || DEFAULT_TILE_WIDTH
      return Math.max(item.width * tw, acc)
    }, 0)

    const height = data.layers.reduce((acc, item) => {
      const th = parseFloat(item.props?.th) || DEFAULT_TILE_HEIGHT
      return Math.max((item.data.length / item.width) * th, acc)
    }, 0)

    return {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
    }
  }

  drawContent() {
    if (!this.data) { return }

    const ctx = this.ctx
    const tilemap = this.data
    const viewport = this.getViewportMatrix()
    this.rendersBefore.map(rr => rr.render(ctx, null, tilemap, viewport))
    tilemap.layers.forEach((layer, i) => {
      const renderer = this.renders[i]
      const result = renderer.render(ctx, layer, tilemap, viewport)
      if (typeof result?.then !== "function") return
      result.then(this.draw)
    })
  }

  _prepareRenders(tilemap) {
    const found = []
    for (let [key, value] of this.availableRenders) {
      TilemapSelector.findLayers(tilemap, key).map((layer) => {
        const index = tilemap.layers.indexOf(layer)
        if (!found[index]) found[index] = []
        found[index].push(value)
      })
    }

    this.renders = tilemap.layers.map((_layer, i) => new (found[i][0])())
  }

  // --- Painting Methods ---

  /**
   * Convert screen coordinates to tile indices for all layers
   * @param {number} worldX - X coordinate in world space
   * @param {number} worldY - Y coordinate in world space
   * @returns {Array<number>} Array of tile indices (one per layer)
   */
  _screenToTileIndices(worldX, worldY) {
    return this.data.layers.map(layer => {
      const tw = parseFloat(layer.props?.tw) || DEFAULT_TILE_WIDTH
      const th = parseFloat(layer.props?.th) || DEFAULT_TILE_HEIGHT

      const tileX = Math.floor(worldX / tw)
      const tileY = Math.floor(worldY / th)
      const tileIdx = tileY * layer.width + tileX

      return tileIdx
    })
  }

  /**
   * Check if two tile index arrays are equal
   * @param {Array<number>} a - First array
   * @param {Array<number>} b - Second array
   * @returns {boolean} True if arrays are equal
   */
  _tileIndicesEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false
    return a.every((val, i) => val === b[i])
  }

  /**
   * Handle painting at mouse position
   * @param {MouseEvent} e - Mouse event
   */
  _handlePaint(e) {
    if (!this.data) return

    const rect = this.canvas.getBoundingClientRect()

    // Get mouse position in CSS pixels relative to canvas
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top

    // Convert to canvas bitmap pixels (accounting for any CSS scaling)
    const bitmapX = (cssX * this.canvas.width) / rect.width
    const bitmapY = (cssY * this.canvas.height) / rect.height

    // Convert to world coordinates using viewport transform
    const worldX = (bitmapX - this.offsetX) / this.scale
    const worldY = (bitmapY - this.offsetY) / this.scale

    const tileIndices = this._screenToTileIndices(worldX, worldY)

    // Skip if we're still on the same tile
    if (this._tileIndicesEqual(tileIndices, this.lastPaintedTile)) {
      return
    }

    this.lastPaintedTile = tileIndices

    // Paint and emit change event
    const newTilemap = TilemapEditor.paint(this.data, tileIndices, this.currentTileValue)
    bus.emit(`cache:changed:${this.getSelectQuery()}`, newTilemap)
  }

  // Override parent class hooks for painting
  onCanvasMouseDown(e) {
    this.isPainting = true
    this._handlePaint(e)
  }

  onCanvasMouseMove(e) {
    if (this.isPainting) {
      this._handlePaint(e)
    }
  }

  onCanvasMouseUp(_e) {
    this.isPainting = false
    this.lastPaintedTile = null
  }
}

export default ViewTilemap


