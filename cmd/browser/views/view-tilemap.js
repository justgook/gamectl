import { ViewCanvasBase } from "./view-canvas-base.js"
import { GridRenderer } from "./tilemap/renderers/GridRenderer.js"
import { ColoredTilesRenderer } from "./tilemap/renderers/ColoredTilesRenderer.js"
import { DoorsRenderer } from "./tilemap/renderers/DoorsRenderer.js"
import { TilesetRenderer } from "./tilemap/renderers/TilesetRenderer.js"
import { TilemapSelector } from './tilemap/TilemapSelector.js'
import { TilemapMenu } from './tilemap/menu.js'
import { bus } from "../systems/event-bus.js"

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
      if (this.isConnected) this.loadAndDraw()
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
  }

  connectedCallback() {
    super.connectedCallback()
    this.menu = new TilemapMenu()
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
    return `cache:read:SELECT data FROM tilemap_storage WHERE name = '${this.tilemapKey}'`
  }

  async fetchData() {
    bus.emit(this.sqlQuery().replace("cache:read:", "cache:load:"))

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
}


