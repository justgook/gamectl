import { ViewCanvasBase } from "./view-canvas-base.js"

// Door bit masks
const DoorNorth = 1;
const DoorEast = 2;
const DoorSouth = 4;
const DoorWest = 8;

// Door color
const DOOR_COLOR = '#ffffff'; // White

// Enhanced hash function for better distribution
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Generate a distinct color using HSL color space for better distribution
function generateDistinctColor(roomId, index = 0) {
  if (!roomId) return '#1e1e1e'; // Dark background for empty space

  const hash = hashString(roomId + index);

  // Use golden ratio to distribute hues evenly
  const goldenRatio = 0.618033988749;
  const hue = ((hash * goldenRatio) % 1) * 360;

  // Vary saturation and lightness for additional distinction
  const saturationVariations = [70, 85, 95];
  const lightnessVariations = [45, 60, 75];

  const satIndex = hash % saturationVariations.length;
  const lightIndex = Math.floor(hash / saturationVariations.length) % lightnessVariations.length;

  const saturation = saturationVariations[satIndex];
  const lightness = lightnessVariations[lightIndex];

  return `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`;
}

// Cache colors for performance and consistency
const colorCache = new Map();

// Helper to get a color based on a string ID with caching
function getRoomColor(roomId) {
  if (!roomId) return '#1e1e1e'; // Dark background for empty space

  if (colorCache.has(roomId)) {
    return colorCache.get(roomId);
  }

  const color = generateDistinctColor(roomId);
  colorCache.set(roomId, color);
  return color;
}

// Default tile size for minimap visualization
const TILE_SIZE = 40;

export class ViewMinimap extends ViewCanvasBase {
  constructor() {
    super("view-minimap")
    this.tilemapKey = 'new_map'
    this.DE = new TextDecoder()
  }

  // --- Abstract Methods Implementation ---

  async fetchData() {
    if (!window.pluginManager) {
      console.warn('Plugin manager not available.')
      return null
    }
    try {
      const result = await window.pluginManager.call('tilemap-storage', 'get', `{"id":"${this.tilemapKey}"}`)
      const data = this.DE.decode(result.output)
      return JSON.parse(data)
    } catch (error) {
      // console.error('Failed to get minimap data:', error)
      return null
    }
  }

  calculateContentBounds(data) {
    if (!data || !data.layers || data.layers.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const roomsLayer = data.layers.find(l => l.meta.name === 'rooms');
    if (!roomsLayer) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const mapW = roomsLayer.width;
    const mapH = roomsLayer.data.length / mapW;

    // Assuming the map starts at (0, 0) and extends to (mapW, mapH)
    return {
      minX: 0,
      minY: 0,
      maxX: mapW * TILE_SIZE,
      maxY: mapH * TILE_SIZE,
    };
  }

  drawContent(ctx, data) {
    if (!data || !data.layers || data.layers.length < 2) {
      return;
    }

    const roomsLayer = data.layers.find(l => l.meta.name === 'rooms');
    const doorsLayer = data.layers.find(l => l.meta.name === 'doors');

    if (!roomsLayer || !doorsLayer) {
      return;
    }

    const mapW = roomsLayer.width;
    const mapH = roomsLayer.data.length / mapW;
    const tileW = TILE_SIZE;
    const tileH = TILE_SIZE;

    // 1. Draw Rooms Layer
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const index = y * mapW + x;
        const tileValue = roomsLayer.data[index];

        if (tileValue > 0) {
          // Get room ID from meta
          const metaKey = `${x}_${y}`;
          const metaString = roomsLayer.meta[metaKey];

          let roomId = null;
          if (metaString) {
            try {
              const meta = JSON.parse(metaString);
              roomId = meta.room;
            } catch (e) {
              // console.error("Failed to parse room meta:", metaString, e);
            }
          }

          ctx.fillStyle = getRoomColor(roomId);
          ctx.fillRect(x * tileW, y * tileH, tileW, tileH);

          // Optional: Draw a border to distinguish tiles
          ctx.strokeStyle = '#111111';
          ctx.lineWidth = 1 / this.scale; // Scale line width
          ctx.strokeRect(x * tileW, y * tileH, tileW, tileH);
        }
      }
    }

    // 2. Draw Doors Layer
    ctx.strokeStyle = DOOR_COLOR;
    ctx.lineWidth = 2 / this.scale; // Scale line width

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const index = y * mapW + x;
        const doorMask = doorsLayer.data[index];

        if (doorMask > 0) {
          const x0 = x * tileW;
          const y0 = y * tileH;
          const x1 = (x + 1) * tileW;
          const y1 = (y + 1) * tileH;
          const midX = x0 + tileW / 2;
          const midY = y0 + tileH / 2;

          // Door size (e.g., 1/3 of the tile edge)
          const doorSizeW = tileW / 3;
          const doorSizeH = tileH / 3;

          ctx.beginPath();

          // North Door (1)
          if (doorMask & DoorNorth) {
            ctx.moveTo(midX - doorSizeW / 2, y0);
            ctx.lineTo(midX + doorSizeW / 2, y0);
          }
          // East Door (2)
          if (doorMask & DoorEast) {
            ctx.moveTo(x1, midY - doorSizeH / 2);
            ctx.lineTo(x1, midY + doorSizeH / 2);
          }
          // South Door (4)
          if (doorMask & DoorSouth) {
            ctx.moveTo(midX - doorSizeW / 2, y1);
            ctx.lineTo(midX + doorSizeW / 2, y1);
          }
          // West Door (8)
          if (doorMask & DoorWest) {
            ctx.moveTo(x0, midY - doorSizeH / 2);
            ctx.lineTo(x0, midY + doorSizeH / 2);
          }

          ctx.stroke();
        }
      }
    }
  }

  getHoverInfo(worldX, worldY, data) {
    if (!data || !data.layers || data.layers.length < 2) return null;

    const roomsLayer = data.layers.find(l => l.meta.name === 'rooms');
    const doorsLayer = data.layers.find(l => l.meta.name === 'doors');
    if (!roomsLayer || !doorsLayer) return null;

    const mapW = roomsLayer.width;
    const tileW = TILE_SIZE;
    const tileH = TILE_SIZE;

    // Convert world coordinates to tile coordinates
    const tileX = Math.floor(worldX / tileW);
    const tileY = Math.floor(worldY / tileH);
    const index = tileY * mapW + tileX;

    if (tileX < 0 || tileY < 0 || tileX >= mapW || index >= roomsLayer.data.length) return null;

    const tileValue = roomsLayer.data[index];
    if (tileValue === 0) return null; // Empty space

    const metaKey = `${tileX}_${tileY}`;
    const metaString = roomsLayer.meta[metaKey];
    const doorMask = doorsLayer.data[index];

    let roomId = 'Unknown';
    if (metaString) {
      try {
        const meta = JSON.parse(metaString);
        roomId = meta.room || roomId;
      } catch (e) {
        // Ignore parse error
      }
    }

    const doorText = doorMask ?
      [(doorMask & DoorNorth) && 'N',
      (doorMask & DoorEast) && 'E',
      (doorMask & DoorSouth) && 'S',
      (doorMask & DoorWest) && 'W'].filter(Boolean).join(', ') :
      'None';

    return `
      <div class="info-row"><span class="info-label">Room:</span> <span class="info-value">${roomId}</span></div>
      <div class="info-row"><span class="info-label">Position:</span> <span class="info-value">(${tileX}, ${tileY})</span></div>
      <div class="info-row"><span class="info-label">Doors:</span> <span class="info-value">${doorText}</span></div>
    `;
  }
}
