/**
 * Animation Data Model
 * 
 * Structure:
 * {
 *   spritesheet: string,    // Path or URL to spritesheet image
 *   tileWidth: number,      // Tile width in pixels
 *   tileHeight: number,     // Tile height in pixels
 *   frames: [
 *     { tileId: number, duration: number, flip: number },  // duration in ms, flip 0-7
 *   ],
 *   loop: boolean           // Whether animation loops
 * }
 * 
 * Flip flags (matches Tiled TMX format and Odin game engine):
 * Bit 0 = Horizontal flip, Bit 1 = Vertical flip, Bit 2 = Anti-diagonal flip
 *   FLIP_NONE = 0  - No transformation
 *   FLIP_H    = 1  - Horizontal flip
 *   FLIP_V    = 2  - Vertical flip
 *   FLIP_HV   = 3  - Horizontal + Vertical (180° rotation)
 *   FLIP_D    = 4  - Anti-diagonal flip (transpose)
 *   FLIP_DH   = 5  - Anti-diagonal + Horizontal (90° CW)
 *   FLIP_DV   = 6  - Anti-diagonal + Vertical (90° CCW)
 *   FLIP_DHV  = 7  - Anti-diagonal + H + V
 * 
 * Note: Animation identity is determined by (spritesheet, frames[0].tileId)
 * The starting frame serves as the unique identifier within a spritesheet.
 */

// Flip constants
export const FLIP_NONE = 0
export const FLIP_H = 1
export const FLIP_V = 2
export const FLIP_HV = 3
export const FLIP_D = 4
export const FLIP_DH = 5
export const FLIP_DV = 6
export const FLIP_DHV = 7

// Flip labels for UI display
export const FLIP_LABELS = ['None', 'H', 'V', 'HV', 'D', 'DH', 'DV', 'DHV']

/**
 * Create a new empty animation
 * @returns {Object} Empty animation object
 */
export function createAnimation() {
  return {
    spritesheet: '',
    tileWidth: 16,
    tileHeight: 16,
    frames: [],
    loop: true
  }
}

/**
 * Clone an animation (deep copy)
 * @param {Object} animation - Animation to clone
 * @returns {Object} Cloned animation
 */
export function cloneAnimation(animation) {
  return {
    ...animation,
    frames: animation.frames.map(f => ({ ...f }))
  }
}

/**
 * Add a frame to animation
 * @param {Object} animation - Animation object
 * @param {number} tileId - Tile ID from spritesheet
 * @param {number} duration - Frame duration in ms
 * @param {number} [flip] - Flip flags (0-7)
 * @param {number} [index] - Insert position (default: end)
 * @returns {Object} Updated animation
 */
export function addFrame(animation, tileId, duration = 100, flip = 0, index = -1) {
  const frame = { tileId, duration, flip }
  const frames = [...animation.frames]
  
  if (index < 0 || index >= frames.length) {
    frames.push(frame)
  } else {
    frames.splice(index, 0, frame)
  }
  
  return { ...animation, frames }
}

/**
 * Remove a frame from animation
 * @param {Object} animation - Animation object
 * @param {number} index - Frame index to remove
 * @returns {Object} Updated animation
 */
export function removeFrame(animation, index) {
  const frames = animation.frames.filter((_, i) => i !== index)
  return { ...animation, frames }
}

/**
 * Remove multiple frames from animation
 * @param {Object} animation - Animation object
 * @param {Set<number>} indices - Set of frame indices to remove
 * @returns {Object} Updated animation
 */
export function removeFrames(animation, indices) {
  const frames = animation.frames.filter((_, i) => !indices.has(i))
  return { ...animation, frames }
}

/**
 * Update frame duration
 * @param {Object} animation - Animation object
 * @param {number} index - Frame index
 * @param {number} duration - New duration in ms
 * @returns {Object} Updated animation
 */
export function updateFrameDuration(animation, index, duration) {
  const frames = animation.frames.map((f, i) => 
    i === index ? { ...f, duration } : f
  )
  return { ...animation, frames }
}

/**
 * Update duration for multiple frames
 * @param {Object} animation - Animation object
 * @param {Set<number>} indices - Set of frame indices
 * @param {number} duration - New duration in ms
 * @returns {Object} Updated animation
 */
export function updateFramesDuration(animation, indices, duration) {
  const frames = animation.frames.map((f, i) => 
    indices.has(i) ? { ...f, duration } : f
  )
  return { ...animation, frames }
}

/**
 * Update flip for a single frame
 * @param {Object} animation - Animation object
 * @param {number} index - Frame index
 * @param {number} flip - New flip value (0-7)
 * @returns {Object} Updated animation
 */
export function updateFrameFlip(animation, index, flip) {
  const frames = animation.frames.map((f, i) => 
    i === index ? { ...f, flip: flip & 7 } : f
  )
  return { ...animation, frames }
}

/**
 * Update flip for multiple frames
 * @param {Object} animation - Animation object
 * @param {Set<number>} indices - Set of frame indices
 * @param {number} flip - New flip value (0-7)
 * @returns {Object} Updated animation
 */
export function updateFramesFlip(animation, indices, flip) {
  const frames = animation.frames.map((f, i) => 
    indices.has(i) ? { ...f, flip: flip & 7 } : f
  )
  return { ...animation, frames }
}

/**
 * Toggle a flip bit for multiple frames
 * @param {Object} animation - Animation object
 * @param {Set<number>} indices - Set of frame indices
 * @param {number} bit - Bit to toggle (1=H, 2=V, 4=D)
 * @returns {Object} Updated animation
 */
export function toggleFramesFlipBit(animation, indices, bit) {
  const frames = animation.frames.map((f, i) => 
    indices.has(i) ? { ...f, flip: ((f.flip || 0) ^ bit) & 7 } : f
  )
  return { ...animation, frames }
}

/**
 * Reorder frames (move frame from one position to another)
 * @param {Object} animation - Animation object
 * @param {number} fromIndex - Source index
 * @param {number} toIndex - Destination index
 * @returns {Object} Updated animation
 */
export function reorderFrame(animation, fromIndex, toIndex) {
  const frames = [...animation.frames]
  const [removed] = frames.splice(fromIndex, 1)
  frames.splice(toIndex, 0, removed)
  return { ...animation, frames }
}

/**
 * Calculate total animation duration
 * @param {Object} animation - Animation object
 * @returns {number} Total duration in ms
 */
export function getTotalDuration(animation) {
  return animation.frames.reduce((sum, f) => sum + f.duration, 0)
}

/**
 * Get frame at a specific time (for playback)
 * @param {Object} animation - Animation object
 * @param {number} timeMs - Time in milliseconds
 * @returns {{ frame: Object, index: number } | null} Frame and index, or null if no frames
 */
export function getFrameAtTime(animation, timeMs) {
  if (animation.frames.length === 0) return null
  
  const totalDuration = getTotalDuration(animation)
  if (totalDuration === 0) return { frame: animation.frames[0], index: 0 }
  
  // Handle looping
  let t = animation.loop ? timeMs % totalDuration : Math.min(timeMs, totalDuration)
  
  let accumulated = 0
  for (let i = 0; i < animation.frames.length; i++) {
    accumulated += animation.frames[i].duration
    if (t < accumulated) {
      return { frame: animation.frames[i], index: i }
    }
  }
  
  // Return last frame if at end
  const lastIndex = animation.frames.length - 1
  return { frame: animation.frames[lastIndex], index: lastIndex }
}

/**
 * Validate animation data
 * @param {Object} animation - Animation to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAnimation(animation) {
  const errors = []
  
  if (!animation.spritesheet) {
    errors.push('Animation must have a spritesheet')
  }
  
  if (!animation.tileWidth || animation.tileWidth < 1) {
    errors.push('Tile width must be at least 1')
  }
  
  if (!animation.tileHeight || animation.tileHeight < 1) {
    errors.push('Tile height must be at least 1')
  }
  
  if (!Array.isArray(animation.frames)) {
    errors.push('Frames must be an array')
  } else if (animation.frames.length === 0) {
    errors.push('Animation must have at least one frame')
  } else {
    for (let i = 0; i < animation.frames.length; i++) {
      const f = animation.frames[i]
      if (typeof f.tileId !== 'number' || f.tileId < 0) {
        errors.push(`Frame ${i}: invalid tileId`)
      }
      if (typeof f.duration !== 'number' || f.duration < 1) {
        errors.push(`Frame ${i}: duration must be at least 1ms`)
      }
      if (f.flip !== undefined && (typeof f.flip !== 'number' || f.flip < 0 || f.flip > 7)) {
        errors.push(`Frame ${i}: flip must be 0-7`)
      }
    }
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Get the starting frame tileId (used as animation identity)
 * @param {Object} animation - Animation object
 * @returns {number|null} The tileId of the first frame, or null if no frames
 */
export function getStartFrame(animation) {
  if (!animation.frames || animation.frames.length === 0) {
    return null
  }
  return animation.frames[0].tileId
}
