import { ViewCanvasBase } from "./view-canvas-base.js"
import { LayerRendererManager } from "./tilemap/LayerRendererManager.js"
import { GridRenderer } from "./tilemap/renderers/GridRenderer.js"
import { ColoredTilesRenderer } from "./tilemap/renderers/ColoredTilesRenderer.js"
import { DoorsRenderer } from "./tilemap/renderers/DoorsRenderer.js"
import { TilesetRenderer } from "./tilemap/renderers/TilesetRenderer.js"
import { parseCSVLines } from "../util/csv.js"

export class ViewTilemap extends ViewCanvasBase {
  constructor() {
    super("view-tilemap")
    this.DE = new TextDecoder()
    this.tilemapKey = 'tileset_demo'
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

    const data = lines[1][0] // First column of second row
    return JSON.parse(data)
  }

  calculateContentBounds(data) {
    console.log("ViewTilemap::calculateContentBounds")
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

  drawContent(ctx, data) {
    console.log("ViewTilemap:drawContent")
  }
}
