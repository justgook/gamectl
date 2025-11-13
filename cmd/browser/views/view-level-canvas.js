import { ViewCanvasBase } from "./view-canvas-base.js"

// Default tile size for level visualization (can be larger than minimap)
const TILE_SIZE = 64;

// Simple color palette for different level elements
const LEVEL_COLORS = {
  TERRAIN: '#2c3e50', // Dark blue/gray
  ENTITY: '#e74c3c', // Red
  CONNECTION: '#2ecc71', // Green
  DEFAULT: '#34495e', // Darker blue/gray
};

/**
 * Level Visualizer View Component.
 * Displays detailed level data (terrain, entities, connections) using a canvas.
 */
export class ViewLevelCanvas extends ViewCanvasBase {
  constructor() {
    super("view-level-canvas")
    this.tilemapKey = 'level' // Key for level data storage
    this.DE = new TextDecoder()
  }

  // --- Abstract Methods Implementation ---

  async fetchData() {
    if (!window.pluginManager) {
      console.warn('Plugin manager not available.')
      return null
    }
    try {
      // Assuming 'tilemap-storage' is used for all tile-based data, 
      // but using a different ID for the full level.
      const result = await window.pluginManager.call('tilemap-storage', 'get', `{"id":"${this.tilemapKey}"}`)
      const data = this.DE.decode(result.output)
      return JSON.parse(data)
    } catch (error) {
      // console.warn('Failed to get level data:', error)
      // Return a mock structure if data is missing for initial testing
      return {
        layers: [{
          meta: { name: 'terrain' },
          width: 10,
          data: Array(100).fill(1),
        }],
        bounds: { minX: 0, minY: 0, maxX: 9, maxY: 9 }
      }
    }
  }

  calculateContentBounds(data) {
    if (!data || !data.layers || data.layers.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    const terrainLayer = data.layers.find(l => l.meta.name === 'terrain');
    if (!terrainLayer) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const mapW = terrainLayer.width;
    const mapH = terrainLayer.data.length / mapW;

    // Assuming the map starts at (0, 0) and extends to (mapW, mapH)
    return {
      minX: 0,
      minY: 0,
      maxX: mapW * TILE_SIZE,
      maxY: mapH * TILE_SIZE,
    };
  }

  drawContent(ctx, data) {
    if (!data || !data.layers || data.layers.length === 0) {
      return;
    }

    const terrainLayer = data.layers.find(l => l.meta.name === 'terrain');
    if (!terrainLayer) {
      return;
    }

    const mapW = terrainLayer.width;
    const mapH = terrainLayer.data.length / mapW;
    const tileW = TILE_SIZE;
    const tileH = TILE_SIZE;

    // Draw Grid (for debugging/structure)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / this.scale;
    for (let y = 0; y <= mapH; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * tileH);
      ctx.lineTo(mapW * tileW, y * tileH);
      ctx.stroke();
    }
    for (let x = 0; x <= mapW; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tileW, 0);
      ctx.lineTo(x * tileW, mapH * tileH);
      ctx.stroke();
    }

    // 1. Draw Terrain Layer
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const index = y * mapW + x;
        const tileValue = terrainLayer.data[index];
        
        if (tileValue > 0) {
          // Simple color based on tile value (e.g., 1=ground, 2=water)
          ctx.fillStyle = tileValue === 1 ? LEVEL_COLORS.TERRAIN : LEVEL_COLORS.DEFAULT;
          ctx.fillRect(x * tileW, y * tileH, tileW, tileH);
        }
      }
    }

    // 2. Draw Entities (Placeholder)
    ctx.fillStyle = LEVEL_COLORS.ENTITY;
    ctx.font = `${12 / this.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Example: Draw an entity at (5, 5)
    const entityX = 5;
    const entityY = 5;
    ctx.fillRect(entityX * tileW + tileW * 0.4, entityY * tileH + tileH * 0.4, tileW * 0.2, tileH * 0.2);
    ctx.fillStyle = 'white';
    ctx.fillText('E', entityX * tileW + tileW / 2, entityY * tileH + tileH / 2);
  }

  getHoverInfo(worldX, worldY, data) {
    if (!data || !data.layers || data.layers.length === 0) return null;

    const terrainLayer = data.layers.find(l => l.meta.name === 'terrain');
    if (!terrainLayer) return null;

    const mapW = terrainLayer.width;
    const tileW = TILE_SIZE;
    const tileH = TILE_SIZE;

    // Convert world coordinates to tile coordinates
    const tileX = Math.floor(worldX / tileW);
    const tileY = Math.floor(worldY / tileH);
    const index = tileY * mapW + tileX;

    if (tileX < 0 || tileY < 0 || tileX >= mapW || index >= terrainLayer.data.length) return null;

    const tileValue = terrainLayer.data[index];
    if (tileValue === 0) return null; // Empty space

    // Placeholder info
    const terrainType = tileValue === 1 ? 'Ground' : 'Unknown';

    return `
      <div class="info-row"><span class="info-label">Tile:</span> <span class="info-value">Level Tile</span></div>
      <div class="info-row"><span class="info-label">Position:</span> <span class="info-value">(${tileX}, ${tileY})</span></div>
      <div class="info-row"><span class="info-label">Terrain:</span> <span class="info-value">${terrainType}</span></div>
    `;
  }
}