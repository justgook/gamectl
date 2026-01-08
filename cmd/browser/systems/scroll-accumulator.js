/**
 * ScrollAccumulator
 * 
 * Utility for handling aggressive scroll acceleration (common on Mac trackpads).
 * Accumulates scroll delta and triggers discrete "tick" events when threshold is reached.
 * 
 * Usage:
 *   const accumulator = new ScrollAccumulator({
 *     threshold: 120,      // pixels of delta needed per tick
 *     resetDelay: 400,     // ms of inactivity before resetting accumulator
 *     onTick: (direction) => { ... }  // direction: 1 for up/zoom-in, -1 for down/zoom-out
 *   })
 *   
 *   element.addEventListener('wheel', (e) => {
 *     e.preventDefault()
 *     accumulator.add(e.deltaY)
 *   })
 *   
 *   // Or with inversion:
 *   accumulator.add(-e.deltaY)
 */
export class ScrollAccumulator {
  /**
   * @param {Object} options
   * @param {number} [options.threshold=120] - Pixels of accumulated delta to trigger one tick
   * @param {number} [options.resetDelay=400] - Ms of inactivity before resetting accumulator
   * @param {(direction: number) => void} options.onTick - Called with 1 (positive/up) or -1 (negative/down)
   */
  constructor(options = {}) {
    this._threshold = options.threshold ?? 120
    this._resetDelay = options.resetDelay ?? 400
    this._onTick = options.onTick ?? (() => { })

    this._accumulator = 0
    this._resetTimeout = null
  }

  /**
   * Add scroll delta to the accumulator.
   * Triggers tick(s) when threshold is reached.
   * Only one tick per call maximum to prevent jarring multi-step jumps.
   * 
   * @param {number} delta - The scroll delta (typically e.deltaY, negate for inversion)
   */
  add(delta) {
    this._accumulator += delta

    // Reset decay timer
    if (this._resetTimeout !== null) {
      clearTimeout(this._resetTimeout)
    }
    this._resetTimeout = setTimeout(() => {
      this._accumulator = 0
      this._resetTimeout = null
    }, this._resetDelay)

    // Check if threshold reached (only trigger one tick per call)
    if (this._accumulator >= this._threshold) {
      this._accumulator -= this._threshold
      this._onTick(1)
    } else if (this._accumulator <= -this._threshold) {
      this._accumulator += this._threshold
      this._onTick(-1)
    }
  }

  /**
   * Get current accumulated delta (for debugging/visualization)
   * @returns {number}
   */
  get accumulated() {
    return this._accumulator
  }

  /**
   * Get progress toward next tick (0 to 1, negative for opposite direction)
   * @returns {number}
   */
  get progress() {
    return this._accumulator / this._threshold
  }

  /**
   * Reset the accumulator immediately
   */
  reset() {
    this._accumulator = 0
    if (this._resetTimeout !== null) {
      clearTimeout(this._resetTimeout)
      this._resetTimeout = null
    }
  }

  /**
   * Update configuration
   * @param {Object} options
   */
  configure(options) {
    if (options.threshold !== undefined) this._threshold = options.threshold
    if (options.resetDelay !== undefined) this._resetDelay = options.resetDelay
    if (options.onTick !== undefined) this._onTick = options.onTick
  }

  /**
   * Cleanup - call when done with the accumulator
   */
  dispose() {
    this.reset()
    this._onTick = () => { }
  }
}
