import { ViewCanvasBase } from "./view-canvas-base.js"
import { generateHsluvColors } from "../util/colors.js"

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
    if (this.isDirty) this._renderOffscreen(this.offCtx, data)
    ctx.drawImage(this.offscreen, 0, 0)
  }

  _renderOffscreen(ctx, data) {
    const canvas = ctx.canvas
    const { maxX: width, maxY: height } = this.calculateContentBounds(data)
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    fillCanvasWithGrid(ctx, this.tw, this.th, this.settings.grid.color, this.settings.grid.border)

    for (let i = 0; i < data.layers.length; i++) {
      const layer = data.layers[i]
      if (layer.meta?.type === "doors") {
        console.error("implement doors drawing")
      } else if (layer.meta?.tileset) {
        console.error("implement tileset drawing")
      } else {
        if (i == 1) {
          drawDoors(
            ctx,
            layer?.meta?.tw || this.tw,
            layer?.meta?.th || this.th,
            layer.width,
            layer.data,
          )
        } else drawColoredTiles(
          ctx,
          layer?.meta?.tw || this.tw,
          layer?.meta?.th || this.th,
          layer.width,
          layer.data,
        )
      }
    }

    this.isDirty = false
  }

  getHoverInfo(worldX, worldY, data) {
    if (!data || !data.layers || data.layers.length < 1) return null;

    const roomsLayer = data.layers[0]

    const mapW = roomsLayer.width;
    const tileW = this.tw;
    const tileH = this.th;

    // Convert world coordinates to tile coordinates
    const tileX = Math.floor(worldX / tileW);
    const tileY = Math.floor(worldY / tileH);
    const index = tileY * mapW + tileX;

    if (tileX < 0 || tileY < 0 || tileX >= mapW || index >= roomsLayer.data.length) return null;

    const tileValue = roomsLayer.data[index];
    if (tileValue === 0) return null; // Empty space

    // const metaKey = `${tileX}_${tileY}`;
    // const metaString = roomsLayer.meta[metaKey];
    // const doorMask = doorsLayer.data[index];

    let roomId = 'ROOM_' + tileValue;
    // if (metaString) {
    //   try {
    //     const meta = JSON.parse(metaString);
    //     roomId = meta.room || roomId;
    //   } catch (e) {
    //     // Ignore parse error
    //   }
    // }

    const doorsLayer = data.layers[1]
    const doorMask = doorsLayer?.data[index]
    const DoorNorth = 1, DoorEast = 2, DoorSouth = 4, DoorWest = 8;
    const doorText = doorMask ?
      [(doorMask & DoorNorth) && 'N',
      (doorMask & DoorEast) && 'E',
      (doorMask & DoorSouth) && 'S',
      (doorMask & DoorWest) && 'W']
        .filter(Boolean).join(', ') :
      'None';

    return `
      <div class="info-row"><span class="info-label">Room:</span> <span class="info-value">${roomId}</span></div>
      <div class="info-row"><span class="info-label">Position:</span> <span class="info-value">(${tileX}, ${tileY})</span></div>
      <div class="info-row"><span class="info-label">Doors:</span> <span class="info-value">${doorText}</span></div>
      <div class="info-row"><span class="info-label">index:</span> <span class="info-value">${index}</span></div>
    `;
  }

}

const colors = generateHsluvColors(50)


function drawColoredTiles(ctx, tw, th, w, data) {
  for (let i = 0; i < data.length; i++) {
    if (data[i] < 1) continue
    const x = i % w * tw
    const y = Math.floor(i / w) * th
    ctx.fillStyle = colors[data[i]]
    ctx.fillRect(x, y, tw, th)
  }
}

function drawDoors(ctx, tw, th, w, doorData) {
  const DoorNorth = 1, DoorEast = 2, DoorSouth = 4, DoorWest = 8;

  // Door styling
  const doorWidth = tw * 0.4;  // Door is 40% of tile width
  const doorDepth = 8;  // How "deep" the door looks
  const doorInset = 6;  // Distance from tile edge

  for (let i = 0; i < doorData.length; i++) {
    const doorMask = doorData[i];
    if (!doorMask) continue;

    const x = (i % w) * tw;
    const y = Math.floor(i / w) * th;
    const cx = x + tw / 2;
    const cy = y + th / 2;

    ctx.save();

    // North door
    if (doorMask & DoorNorth) {
      // Door frame (darker)
      ctx.fillStyle = '#654321';
      ctx.fillRect(cx - doorWidth / 2 - 2, y + doorInset, doorWidth + 4, doorDepth + 2);
      // Door (lighter brown)
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(cx - doorWidth / 2, y + doorInset + 1, doorWidth, doorDepth);
      // Door handle
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(cx + doorWidth / 3, y + doorInset + doorDepth / 2 - 1, 3, 3);
    }

    // East door
    if (doorMask & DoorEast) {
      // Door frame
      ctx.fillStyle = '#654321';
      ctx.fillRect(x + tw - doorInset - doorDepth - 2, cy - doorWidth / 2 - 2, doorDepth + 2, doorWidth + 4);
      // Door
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(x + tw - doorInset - doorDepth, cy - doorWidth / 2, doorDepth, doorWidth);
      // Door handle
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x + tw - doorInset - doorDepth / 2 - 1, cy + doorWidth / 3, 3, 3);
    }

    // South door
    if (doorMask & DoorSouth) {
      // Door frame
      ctx.fillStyle = '#654321';
      ctx.fillRect(cx - doorWidth / 2 - 2, y + th - doorInset - doorDepth - 2, doorWidth + 4, doorDepth + 2);
      // Door
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(cx - doorWidth / 2, y + th - doorInset - doorDepth, doorWidth, doorDepth);
      // Door handle
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(cx - doorWidth / 3 - 3, y + th - doorInset - doorDepth / 2 - 1, 3, 3);
    }

    // West door
    if (doorMask & DoorWest) {
      // Door frame
      ctx.fillStyle = '#654321';
      ctx.fillRect(x + doorInset, cy - doorWidth / 2 - 2, doorDepth + 2, doorWidth + 4);
      // Door
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(x + doorInset + 1, cy - doorWidth / 2, doorDepth, doorWidth);
      // Door handle
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x + doorInset + doorDepth / 2 - 1, cy - doorWidth / 3 - 3, 3, 3);
    }

    ctx.restore();
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

