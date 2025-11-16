import { ViewCanvasBase } from "./view-canvas-base.js"
import { generateHsluvColors } from "../util/colors.js"
import { Hsluv } from "../util/hlsuv.js"

const DEFAULT_TILE_SIZE = 40;
const TILEMAP_ATTR = "data-key"
export class ViewTilemap extends ViewCanvasBase {
  static get observedAttributes() { return [...ViewCanvasBase.observedAttributes, TILEMAP_ATTR]; }

  constructor() {
    super("view-tilemap")
    this.tilemapKey = 'new_map'
    this.DE = new TextDecoder()


    // Create offscreen canvas here
    this.offscreen = document.createElement('canvas')
    this.offCtx = this.offscreen.getContext('2d')

    this.isDirty = true

    this.tw = DEFAULT_TILE_SIZE
    this.th = DEFAULT_TILE_SIZE
    this.settings = {
      grid: {
        border: 1,
        color: "#ccc"
      }
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)
    if (name === TILEMAP_ATTR) this.tilemapKey = newVal
  }

  // --- Abstract Methods Implementation ---

  async fetchData() {
    this.isDirty = true
    if (!window.pluginManager) {
      console.warn('Plugin manager not available.')
      return null
    }
    try {
      const result = await window.pluginManager.call('tilemap-storage', 'get', `{"id":"${this.tilemapKey}"}`)
      const data = this.DE.decode(result.output)
      return JSON.parse(data)
    } catch (error) {
      console.error('Failed to get minimap data:', error)
      return null
    }
  }

  calculateContentBounds(data) {
    return {
      minX: 0,
      minY: 0,
      maxX: 200,
      maxY: 200,
    }
  }

  drawContent(ctx, data) {
    if (this.isDirty) this._renderOffscreen(this.offCtx, data)
    ctx.drawImage(this.offscreen, 0, 0)
  }

  getHoverInfo(worldX, worldY, data) { }
  _renderOffscreen(ctx, data) {
    const canvas = ctx.canvas
    const { maxX: width, maxY: height } = this.calculateContentBounds(data)
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    fillCanvasWithGrid(ctx, this.tw, this.th, this.settings.grid.color, this.settings.grid.border)
    console.log(ctx.canvas === this.offscreen)

    data.layers.forEach(layer => {
      if (layer.meta?.type === "doors") {
        console.error("implement doors drawing")
      } else if (layer.meta?.tileset) {
        console.error("implement tileset drawing")
      } else {
        drawColoredTiles(
          ctx,
          layer?.meta?.tw || this.tw,
          layer?.meta?.th || this.th,
          layer.width,
          layer.data,
        )
      }
    })

    console.log("_renderOffscreen", data)

    this.isDirty = false
  }
}

function drawColoredTiles(ctx, tw, th, w, data) {
  const colors = generateHsluvColors(50)
  for (let i = 0; i < data.length; i++) {
    if (data[i] < 1) continue
    const x = i % w
    const y = Math.floor(i / w)
    ctx.fillStyle = colors[data[i]]
    ctx.fillRect(x, y, tw, th)
  }
}
/**
 * The "Factory" Function
 * Creates a reusable grid pattern from an off-screen canvas.
 *
 * @param {CanvasRenderingContext2D} ctx - The main canvas context (used to call createPattern).
 * @param {number} gridWidth - The width of a single grid cell.
 * @param {number} gridHeight - The height of a single grid cell.
 * @param {string} color - The color of the grid lines.
 * @param {number} [lineWidth=1] - The thickness of the grid lines.
 * @returns {CanvasPattern} A reusable pattern to be used with fillStyle.
 */
function createGridPattern(ctx, gridWidth, gridHeight, color, lineWidth = 1) {
  // 1. Create the off-screen "tile" canvas
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = gridWidth;
  tileCanvas.height = gridHeight;
  const tileCtx = tileCanvas.getContext('2d');

  // 2. Draw the single grid cell
  tileCtx.fillStyle = color;

  // --- The "Seamless" Trick ---
  // We only draw the bottom and right lines.
  // When tiled, the "bottom" of one tile meets the "top" (empty) 
  // of the tile below it, creating a perfect single line.

  // Draw the horizontal line (bottom)
  tileCtx.fillRect(0, gridHeight - lineWidth, gridWidth, lineWidth);
  // Draw the vertical line (right)
  tileCtx.fillRect(gridWidth - lineWidth, 0, lineWidth, gridHeight);

  // 3. Create the pattern
  // The main context (ctx) is used to create the pattern from the tile.
  return ctx.createPattern(tileCanvas, 'repeat');
}

/**
 * The "ClearRect" Function
 * Fills the *entire* canvas with a grid, just like clearing it.
 *
 * @param {CanvasRenderingContext2D} ctx - The main canvas context to fill.
 * @param {number} gridWidth - The width of a single grid cell.
 * @param {number} gridHeight - The height of a single grid cell.
 * @param {string} color - The color of the grid lines.
 * @param {number} [lineWidth=1] - The thickness of the grid lines.
 */
function fillCanvasWithGrid(ctx, gridWidth, gridHeight, color, lineWidth = 1) {
  // Get the main canvas dimensions
  const { width, height } = ctx.canvas;

  // Use our factory function to create the pattern
  const gridPattern = createGridPattern(ctx, gridWidth, gridHeight, color, lineWidth);

  // Set the fill style to our new pattern
  ctx.fillStyle = gridPattern;

  // Fill the entire canvas
  // This overwrites everything, just like clearRect
  ctx.fillRect(0, 0, width, height);
}

