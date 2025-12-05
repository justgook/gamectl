/**
 * Base class for all layer renderers in the modular tilemap system.
 * 
 * Defines the interface that all renderers must implement:
 * - Event-driven dirty tracking
 * - Direct canvas access rendering
 * - Renderer-controlled re-rendering decisions
 */
export class LayerRenderer {

  /**
   * Constructor for base renderer
   * @param {Object} options - Renderer configuration options
   */
  constructor(options = {}) {
    this.isDirty = true
    this.options = { ...options }

    // Event responsiveness flags - subclasses should override
    this.respondsToZoom = false
    this.respondsToPan = false
    this.respondsToHover = false
    this.respondsToResize = true // Most renderers need to respond to resize
  }

  /**
   * Determine if this renderer needs to redraw based on event type
   * 
   * @param {string} eventType - Type of event: 'reload', 'zoom', 'pan', 'hover', 'resize'
   * @param {Object|null} layer - Layer data (null for grid renderer)
   * @param {Object} tilemap - Full tilemap data
   * @param {Object} eventData - Additional event-specific data
   * @returns {boolean} True if renderer should redraw
   */
  needsRedraw(eventType, layer, tilemap, eventData) {
    switch (eventType) {
      case 'reload':
        return true // Always redraw on data reload
      case 'zoom':
        return this.respondsToZoom || this.isDirty
      case 'pan':
        return this.respondsToPan || this.isDirty
      case 'hover':
        return this.respondsToHover || this.isDirty
      case 'resize':
        return this.respondsToResize || this.isDirty
      default:
        return this.isDirty
    }
  }

  /**
   * Render this layer to the canvas context
   * 
   * @param {CanvasRenderingContext2D} ctx - Canvas context to draw to
   * @param {Object|null} layer - Layer data (null for grid renderer)
   * @param {Object} tilemap - Full tilemap data
   * @param {Object} viewport - Viewport transform matrix from ViewCanvasBase
   * @throws {Error} Subclasses must implement this method
   */
  render(ctx, layer, tilemap, viewport) {
    throw new Error(`${this.constructor.name} must implement render() method`)
  }

  /**
   * Mark this renderer as dirty, forcing redraw on next render cycle
   */
  markDirty() {
    this.isDirty = true
  }

  /**
   * Mark this renderer as clean (usually called after successful render)
   */
  markClean() {
    this.isDirty = false
  }

  /**
   * Get the selector that this renderer responds to
   * Used for error reporting and debugging
   * @returns {string} CSS-like selector string
   */
  getSelector() {
    return this.options.selector || this.constructor.name
  }

  /**
   * Handle renderer errors with consistent error reporting
   * @param {Error} error - The error that occurred
   * @param {string} context - Additional context for the error
   */
  handleError(error, context = '') {
    const message = `🔥 RENDERER ERROR [${this.getSelector()}]: ${error.message}`
    const fullContext = context ? ` (Context: ${context})` : ''

    // Log angry error to console  
    console.error(`${message}${fullContext}`, error)

    // Re-throw to stop all rendering (as requested)
    throw new Error(`${message}${fullContext}`)
  }
}
