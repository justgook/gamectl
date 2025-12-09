import { ViewCanvasBase } from "./view-canvas-base.js"
import { GridRenderer } from "./tilemap/renderers/GridRenderer.js"
import { ColoredTilesRenderer } from "./tilemap/renderers/ColoredTilesRenderer.js"
import { DoorsRenderer } from "./tilemap/renderers/DoorsRenderer.js"
import { TilesetRenderer } from "./tilemap/renderers/TilesetRenderer.js"
import { TilemapSelector } from './tilemap/TilemapSelector.js'
import { TilemapMenu } from './tilemap/menu.js'
import { bus } from "../systems/event-bus.js"
import { TilemapEditor } from "../systems/tilemap-editor.js"

function noop() { }

export class ViewTilemap extends ViewCanvasBase {
  static get observedAttributes() {
    return [...super.observedAttributes, 'data-key'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)
    if (name === 'data-key' && oldVal !== newVal) {
      this.tilemapKey = newVal
      this.unsubscibe()
      this.unsubscibe = bus.on(this.sqlQuery(), this.dataChanged)
    }
  }

  constructor() {
    super("view-tilemap")
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
  }

  connectedCallback() {
    super.connectedCallback()
    this.appendChild(this.menu)
    this.renders = []
    this.unsubscibe = bus.on(this.sqlQuery(), this.dataChanged)
  }

  disconnectedCallback() {
    this.unsubscibe()
  }

  dataChanged = (data) => {
    this.data = data
    this._prepareRenders(data)
    this.menu.title = this.tilemapKey
    this.menu.data = data

    // reimplementing fetchData
    this.contentBounds = this.calculateContentBounds(this.data)
    this.draw()
  }

  sqlQuery() {
    return `cache:changed:SELECT data FROM tilemap_storage WHERE name = '${this.tilemapKey}'`
  }

  async fetchData() {
    bus.emit(this.sqlQuery().replace("cache:changed:", "cache:load:"))

    return this.data
  }

  calculateContentBounds(data) {
    if (!data || !data.layers || !Array.isArray(data.layers) || data.layers.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const width = data.layers.reduce((acc, item) =>
      // TODO EXTRACT tileHeigt from level 
      Math.max(item.width * this.tw, acc)
      , 0)

    const height = data.layers.reduce((acc, item) =>
      // TODO EXTRACT tileHeigt from level 
      Math.max(item.data.length / item.width * this.th, acc)
      , 0)


    return {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
    }
  }

  drawContent(ctx, tilemap) {
    if (!this.data) { return }
    const viewport = this.getViewportMatrix()
    this.rendersBefore.map(rr => rr.render(ctx, null, tilemap, viewport))
    tilemap.layers.forEach((layer, i) => {
      const renderer = this.renders[i]
      const result = renderer.render(ctx, layer, tilemap, viewport)
      if (typeof result?.then !== "function") return
      result.then(() => { this.drawContent(ctx, tilemap) })
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
    const DEFAULT_TW = 40
    const DEFAULT_TH = 40

    return this.data.layers.map(layer => {
      const tw = parseFloat(layer.meta?.tw) || DEFAULT_TW
      const th = parseFloat(layer.meta?.th) || DEFAULT_TH

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
    const worldX = (e.clientX - rect.left - this.offsetX) / this.scale
    const worldY = (e.clientY - rect.top - this.offsetY) / this.scale

    const tileIndices = this._screenToTileIndices(worldX, worldY)

    // Skip if we're still on the same tile
    if (this._tileIndicesEqual(tileIndices, this.lastPaintedTile)) {
      return
    }

    this.lastPaintedTile = tileIndices

    // Paint and emit change event
    const newTilemap = TilemapEditor.paint(this.data, tileIndices)
    const sqlQuery = this.sqlQuery().replace('cache:changed:', '')
    bus.emit(`cache:changed:${sqlQuery}`, newTilemap)
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


