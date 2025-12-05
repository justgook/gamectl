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
}
