import { ViewCanvasBase } from "./view-canvas-base.js"
import { LayerRendererManager } from "./tilemap/LayerRendererManager.js"
import { GridRenderer } from "./tilemap/renderers/GridRenderer.js"
import { ColoredTilesRenderer } from "./tilemap/renderers/ColoredTilesRenderer.js"
import { DoorsRenderer } from "./tilemap/renderers/DoorsRenderer.js"
import { TilesetRenderer } from "./tilemap/renderers/TilesetRenderer.js"
import { parseCSVLines } from "../util/csv.js"

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

    // Initialize modular renderer system
    this.rendererManager = new LayerRendererManager()
    this._registerDefaultRenderers()
  }

  /**
   * Register default renderers for the tilemap system
   * @private
   */
  _registerDefaultRenderers() {
    // Grid renderer (auto-registered, renders first)
    this.rendererManager.registerGridRenderer(GridRenderer)
    
    // Layer-specific renderers (order matters - more specific first)
    this.rendererManager.registerRenderer('[type="doors"]', DoorsRenderer)
    this.rendererManager.registerRenderer('[meta.tileset]', TilesetRenderer)
    this.rendererManager.registerRenderer('*', ColoredTilesRenderer) // Fallback - always last

    // Debug output
    console.log('🎨 Tilemap renderer system initialized:', this.rendererManager.getDebugInfo())
  }

  /**
   * External API for registering custom renderers
   * @param {string} selector - CSS-like selector
   * @param {Function} rendererFactory - Renderer class/factory
   */
  registerRenderer(selector, rendererFactory) {
    return this.rendererManager.registerRenderer(selector, rendererFactory)
  }

  /**
   * External API for registering custom grid renderer
   * @param {Function} rendererFactory - Grid renderer class/factory
   */
  registerGridRenderer(rendererFactory) {
    return this.rendererManager.registerGridRenderer(rendererFactory)
  }

  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)
    if (name === TILEMAP_ATTR && oldVal !== newVal) {
      this.tilemapKey = newVal
      if (this.isConnected) this.loadAndDraw()
    }
  }

  // --- Abstract Methods Implementation ---

  async fetchData() {
    this.isDirty = true
    // Mark all renderers dirty on data reload
    this.rendererManager.markAllDirty()
    
    if (!window.pluginManager) {
      console.warn('Plugin manager not available.')
      return null
    }
    try {
      // Query tilemap from SQL storage
      const sqlQuery = `SELECT data FROM tilemap_storage WHERE name = '${this.tilemapKey}'`
      const result = await window.pluginManager.call('sql', 'query', sqlQuery)
      const csv = this.DE.decode(result.output)

      // Parse CSV to get JSON data
      const lines = parseCSVLines(csv.trim())
      if (lines.length < 2 || lines[1].length < 1) {
        console.warn(`Tilemap not found: ${this.tilemapKey}`)
        return null
      }

      const data = lines[1][0] // First column of second row
      return JSON.parse(data)
    } catch (error) {
      console.warn('Failed to get tilemap data:', error)
      return null
    }
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

  drawContent(ctx, data) {
    if (!data || !data.layers || !Array.isArray(data.layers) || data.layers.length === 0) {
      return;
    }
    if (this.isDirty) this._renderWithRendererManager(this.offCtx, data)
    ctx.drawImage(this.offscreen, 0, 0)
  }

  /**
   * Render using the modular renderer system
   * @private
   */
  _renderWithRendererManager(ctx, data, eventType = 'reload', eventData = null) {
    try {
      const canvas = ctx.canvas
      const { maxX: width, maxY: height } = this.calculateContentBounds(data)
      canvas.width = width
      canvas.height = height
      ctx.clearRect(0, 0, width, height)

      // Get viewport matrix for renderers
      const viewport = this.getViewportMatrix()

      // Use renderer manager to render all layers
      this.rendererManager.renderAll(ctx, data, viewport, eventType, eventData)

      this.isDirty = false
      
    } catch (error) {
      // Handle renderer errors with screen display
      this._displayRenderError(ctx, error)
      throw error // Re-throw to maintain STOP behavior
    }
  }

  /**
   * Display render error on canvas for debugging
   * @private
   */
  _displayRenderError(ctx, error) {
    const canvas = ctx.canvas
    
    // Clear canvas and show error
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('🔥 RENDER ERROR 🔥', canvas.width / 2, canvas.height / 2 - 20)
    ctx.font = '12px monospace'
    ctx.fillText(error.message, canvas.width / 2, canvas.height / 2 + 10)
    ctx.restore()
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

  // --- Event-Driven Rendering Overrides ---

  /**
   * Override zoom to mark dirty and trigger re-render
   */
  zoom(x, y, factor) {
    super.zoom(x, y, factor)
    this.isDirty = true // Mark dirty to force offscreen re-render
    this._triggerRendererEvent('zoom', { x, y, factor })
  }

  /**
   * Override onResize to mark dirty
   */
  onResize(width, height) {
    super.onResize(width, height)
    this.isDirty = true // Mark dirty to force offscreen re-render
    this._triggerRendererEvent('resize', { width, height })
  }

  /**
   * Override _onWheel to handle pan via mousewheel
   */
  _onWheel(e) {
    super._onWheel(e)
    // Mark dirty after any wheel event (zoom or pan)
    this.isDirty = true
    if (e.ctrlKey || e.metaKey) {
      this._triggerRendererEvent('zoom', { deltaY: e.deltaY })
    } else {
      this._triggerRendererEvent('pan', { deltaX: e.deltaX, deltaY: e.deltaY })
    }
  }

  /**
   * Override _onMouseMove to handle drag panning
   */
  _onMouseMove(e) {
    const wasDragging = this.isDragging
    super._onMouseMove(e)
    
    // Mark dirty if we were dragging (panning)
    if (wasDragging && this.isDragging) {
      this.isDirty = true
      this._triggerRendererEvent('pan', { isDragging: true })
    }
  }

  /**
   * Trigger renderer manager event for future extensibility
   * @private
   */
  _triggerRendererEvent(eventType, eventData = null) {
    if (!this.data || !this.rendererManager) return

    try {
      // For viewport changes, mark all renderers dirty
      const isViewportChange = ['zoom', 'pan', 'resize'].includes(eventType)
      
      if (isViewportChange) {
        this.rendererManager.markAllDirty()
      }

      // For now, rely on isDirty flag to trigger re-rendering in drawContent()
      // Future: implement selective renderer updates for hover events, etc.
      
    } catch (error) {
      console.error(`🔥 Event-driven render failed for ${eventType}:`, error)
    }
  }

}

// Old standalone functions removed - functionality now handled by modular renderers:
// - drawColoredTiles -> ColoredTilesRenderer
// - drawDoors -> DoorsRenderer  
// - createGridPattern/fillCanvasWithGrid -> GridRenderer
// - colors array -> ColoredTilesRenderer (internal)

