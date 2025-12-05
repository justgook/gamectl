import { TilemapSelector } from './TilemapSelector.js'

/**
 * Manages and coordinates all layer renderers in the tilemap system.
 * 
 * Features:
 * - Grid renderer runs first as "before all" global renderer
 * - Layer renderers run in layer order (0 to n)
 * - Selector-based renderer matching using CSS-like syntax
 * - Event-driven re-rendering with renderer-controlled dirty tracking
 * - Error handling with STOP behavior (no silent failures)
 */
export class LayerRendererManager {

  constructor() {
    // Special grid renderer (renders first, before all layers)
    this.gridRenderer = null
    this.gridRendererFactory = null

    // Layer-specific renderers
    this.rendererRegistrations = [] // Array of {selector, rendererFactory, instance}
  }

  /**
   * Register the grid renderer (auto-registered, renders first)
   * @param {Function} rendererFactory - Factory function/class for grid renderer
   */
  registerGridRenderer(rendererFactory) {
    this.gridRendererFactory = rendererFactory
    this.gridRenderer = new rendererFactory({ selector: 'grid' })
  }

  /**
   * Register a layer renderer with CSS-like selector
   * @param {string} selector - CSS-like selector: "#0", "[type='doors']", "*"
   * @param {Function} rendererFactory - Factory function/class for renderer
   */
  registerRenderer(selector, rendererFactory) {
    this.rendererRegistrations.push({
      selector,
      rendererFactory,
      instance: null
    })
  }

  /**
   * Find appropriate renderer for a layer using selector matching
   * @param {Object} layer - Layer data with meta properties
   * @param {Object} tilemap - Full tilemap (for index-based selectors)
   * @returns {Object|null} Renderer instance or null if no match
   */
  getRendererForLayer(layer, tilemap) {
    for (const registration of this.rendererRegistrations) {
      // Find layer index for index-based selectors
      const layerIndex = tilemap.layers.indexOf(layer)
      if (layerIndex === -1) continue

      // Create a temporary tilemap with single layer for testing
      const testTilemap = { layers: [layer] }

      // Test if selector matches this layer
      let matches = false
      if (registration.selector.startsWith('#')) {
        // Index-based selector - check if it matches layer index
        const targetIndex = parseInt(registration.selector.slice(1), 10)
        matches = (targetIndex === layerIndex)
      } else {
        // Attribute-based or wildcard selector
        matches = TilemapSelector.findLayer(testTilemap, registration.selector) !== null
      }

      if (matches) {
        // Lazy instantiation - create renderer instance if not exists
        if (!registration.instance) {
          registration.instance = new registration.rendererFactory({
            selector: registration.selector
          })
        }
        return registration.instance
      }
    }

    return null
  }

  /**
   * Render all layers with grid-first ordering and event-driven updates
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context to render to
   * @param {Object} tilemap - Full tilemap data with layers array
   * @param {Object} viewport - Viewport transform matrix
   * @param {string} eventType - Event type: 'reload', 'zoom', 'pan', 'hover', 'resize'
   * @param {Object} eventData - Additional event-specific data
   */
  renderAll(ctx, tilemap, viewport, eventType = 'reload', eventData = null) {
    try {
      // 1. Grid renderer first (global "before all")
      if (this.gridRenderer) {
        if (this.gridRenderer.needsRedraw(eventType, null, tilemap, eventData)) {
          this.gridRenderer.render(ctx, null, tilemap, viewport)
          this.gridRenderer.markClean()
        }
      }

      // 2. Layer renderers in layer order (0 to n)
      if (tilemap && Array.isArray(tilemap.layers)) {
        for (let i = 0; i < tilemap.layers.length; i++) {
          const layer = tilemap.layers[i]
          const renderer = this.getRendererForLayer(layer, tilemap)

          if (renderer) {
            if (renderer.needsRedraw(eventType, layer, tilemap, eventData)) {
              const result = renderer.render(ctx, layer, tilemap, viewport)

              if (typeof result?.then === "function") {
                console.log("pospone render")

                result.then(() => {
                  console.log("and now we render promise", ctx.canvas)
                  this.renderAll(ctx, tilemap, viewport, eventType = 'async_render')
                  ctx.rect(20, 20, 150, 100);
                  ctx.fillStyle = "blue";
                  ctx.fill();
                }
                )
              }
              renderer.markClean()
            }
          } else {
            // No renderer found for layer - this is a development error
            this._handleNoRendererError(layer, i)
          }
        }
      }

    } catch (error) {
      // Handle renderer errors with angry console output and screen display
      this._handleRenderingError(error, eventType)
    }
  }

  /**
   * Mark all renderers as dirty, forcing complete re-render
   */
  markAllDirty() {
    if (this.gridRenderer) {
      this.gridRenderer.markDirty()
    }

    for (const registration of this.rendererRegistrations) {
      if (registration.instance) {
        registration.instance.markDirty()
      }
    }
  }

  /**
   * Get debug info about registered renderers
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      gridRenderer: this.gridRenderer ? this.gridRenderer.constructor.name : null,
      layerRenderers: this.rendererRegistrations.map(reg => ({
        selector: reg.selector,
        factory: reg.rendererFactory.name,
        hasInstance: !!reg.instance
      }))
    }
  }

  // --- Private Error Handling ---

  /**
   * Handle case where no renderer is found for a layer
   * @private
   */
  _handleNoRendererError(layer, layerIndex) {
    const layerType = layer.meta?.type || 'unknown'
    const message = `🔥 NO RENDERER FOUND for layer ${layerIndex} (type: ${layerType})`

    console.error(message, {
      layer,
      layerIndex,
      registeredSelectors: this.rendererRegistrations.map(r => r.selector)
    })

    throw new Error(message)
  }

  /**
   * Handle rendering errors with angry output and screen display
   * @private  
   */
  _handleRenderingError(error, eventType) {
    const message = `🔥🔥🔥 TILEMAP RENDERING FAILED 🔥🔥🔥`

    // Angry console output
    console.error(`\n${message}`)
    console.error(`Event Type: ${eventType}`)
    console.error(`Error:`, error)
    console.error(`Stack:`, error.stack)

    // Try to display error on screen (if we have canvas context)
    // This will be handled by ViewTilemap when it catches the error

    // Re-throw to stop all rendering (STOP behavior as requested)
    throw new Error(`${message}: ${error.message}`)
  }
}
