import { ViewCanvasBase } from "./view-canvas-base.js"
import { GridRenderer } from "./tilemap/renderers/GridRenderer.js"
import { ColoredTilesRenderer } from "./tilemap/renderers/ColoredTilesRenderer.js"
import { DoorsRenderer } from "./tilemap/renderers/DoorsRenderer.js"
import { TilesetRenderer } from "./tilemap/renderers/TilesetRenderer.js"
import { parseCSVLines } from "../util/csv.js"
import { TilemapSelector } from './tilemap/TilemapSelector.js'
import { TilemapMenu } from './tilemap/menu.js'


export class ViewTilemap extends ViewCanvasBase {
  static get observedAttributes() {
    return [...super.observedAttributes, 'data-key'];
  }
  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)
    if (name === 'data-key' && oldVal !== newVal) {
      this.tilemapKey = newVal
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
  }

  connectedCallback() {
    super.connectedCallback()
    this.menu = new TilemapMenu()
    this.appendChild(this.menu)
    this.renders = []
  }

  async fetchData() {
    const sqlQuery = `SELECT data FROM tilemap_storage WHERE name = '${this.tilemapKey}'`
    const result = await window.pluginManager.call('sql', 'query', sqlQuery)
    console.log("fetchData::result", result)
    const csv = this.DE.decode(result.output)

    // Parse CSV to get JSON data
    const lines = parseCSVLines(csv.trim())
    if (lines.length < 2 || lines[1].length < 1) {
      console.warn(`Tilemap not found: ${this.tilemapKey}`)
      return null
    }

    const data = JSON.parse(lines[1][0]) // First column of second row
    console.log(data)
    this._prepareRenders(data)
    this.menu.title = this.tilemapKey
    this.menu.data = data
    return data
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
    console.log("ViewTilemap:drawContent")
    const viewport = this.getViewportMatrix()
    this.rendersBefore.map(rr => rr.render(ctx, null, tilemap, viewport))
    tilemap.layers.forEach((layer, i) => {
      const renderer = this.renders[i]
      const result = renderer.render(ctx, layer, tilemap, viewport)
      if (typeof result?.then !== "function") return
      console.log("pospone render")
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


