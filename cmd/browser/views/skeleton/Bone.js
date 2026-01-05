/**
 * Bone - Transform math and hit testing for skeleton bones
 * 
 * Coordinate system: Y increases upward (traditional 2D math)
 * Angles are in degrees, measured counter-clockwise from positive X axis
 * 
 * Each bone stores:
 * - parent: index of parent bone (null for root)
 * - a: local angle in degrees (relative to parent)
 * - l: length in pixels
 */

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/**
 * Compute world transforms for all bones in a skeleton
 * Returns array of { worldX, worldY, worldAngle, endX, endY } for each bone
 * 
 * @param {Object} skeleton - Skeleton data { x, y, bones: [...] }
 * @returns {Array} Array of world transforms indexed by bone index
 */
export function computeWorldTransforms(skeleton) {
  const { x: rootX, y: rootY, bones } = skeleton
  const transforms = new Array(bones.length)
  
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i]
    
    if (bone.parent === null) {
      // Root bone - use skeleton position
      const worldAngle = bone.a
      const angleRad = worldAngle * DEG_TO_RAD
      transforms[i] = {
        worldX: rootX,
        worldY: rootY,
        worldAngle: worldAngle,
        endX: rootX + Math.cos(angleRad) * bone.l,
        endY: rootY + Math.sin(angleRad) * bone.l
      }
    } else {
      // Child bone - inherit from parent
      const parentTransform = transforms[bone.parent]
      if (!parentTransform) {
        console.error(`Bone ${i} references parent ${bone.parent} which hasn't been computed yet. Bones must be ordered parent-first.`)
        continue
      }
      
      // Start at parent's end point
      const worldX = parentTransform.endX
      const worldY = parentTransform.endY
      
      // World angle = parent's world angle + local angle
      const worldAngle = parentTransform.worldAngle + bone.a
      const angleRad = worldAngle * DEG_TO_RAD
      
      transforms[i] = {
        worldX,
        worldY,
        worldAngle,
        endX: worldX + Math.cos(angleRad) * bone.l,
        endY: worldY + Math.sin(angleRad) * bone.l
      }
    }
  }
  
  return transforms
}

/**
 * Hit test a point against a bone (line segment)
 * 
 * @param {number} px - Point X in world coordinates
 * @param {number} py - Point Y in world coordinates
 * @param {Object} transform - Bone's world transform { worldX, worldY, endX, endY }
 * @param {number} threshold - Distance threshold for hit detection
 * @returns {boolean} True if point is within threshold of bone line
 */
export function hitTestBone(px, py, transform, threshold = 8) {
  const { worldX, worldY, endX, endY } = transform
  
  // Vector from start to end
  const dx = endX - worldX
  const dy = endY - worldY
  const lengthSq = dx * dx + dy * dy
  
  if (lengthSq === 0) {
    // Zero-length bone - just check distance to point
    const distSq = (px - worldX) ** 2 + (py - worldY) ** 2
    return distSq <= threshold * threshold
  }
  
  // Project point onto line segment
  const t = Math.max(0, Math.min(1, ((px - worldX) * dx + (py - worldY) * dy) / lengthSq))
  
  // Closest point on segment
  const closestX = worldX + t * dx
  const closestY = worldY + t * dy
  
  // Distance from point to closest point on segment
  const distSq = (px - closestX) ** 2 + (py - closestY) ** 2
  
  return distSq <= threshold * threshold
}

/**
 * Hit test a point against a bone's joint (start point circle)
 * 
 * @param {number} px - Point X in world coordinates
 * @param {number} py - Point Y in world coordinates
 * @param {Object} transform - Bone's world transform { worldX, worldY }
 * @param {number} radius - Joint circle radius
 * @returns {boolean} True if point is within joint circle
 */
export function hitTestJoint(px, py, transform, radius = 6) {
  const { worldX, worldY } = transform
  const distSq = (px - worldX) ** 2 + (py - worldY) ** 2
  return distSq <= radius * radius
}

/**
 * Hit test a point against a bone's tip (end point circle)
 * Used for rotation handle
 * 
 * @param {number} px - Point X in world coordinates
 * @param {number} py - Point Y in world coordinates
 * @param {Object} transform - Bone's world transform { endX, endY }
 * @param {number} radius - Tip circle radius
 * @returns {boolean} True if point is within tip circle
 */
export function hitTestTip(px, py, transform, radius = 6) {
  const { endX, endY } = transform
  const distSq = (px - endX) ** 2 + (py - endY) ** 2
  return distSq <= radius * radius
}

/**
 * Find bone at a given world position
 * Returns { index, part } where part is 'joint', 'tip', or 'bone'
 * 
 * @param {number} worldX - X in world coordinates
 * @param {number} worldY - Y in world coordinates
 * @param {Array} transforms - Array of world transforms
 * @param {Object} options - Hit test options { jointRadius, tipRadius, boneThreshold }
 * @returns {Object|null} { index, part } or null if no hit
 */
export function findBoneAtPoint(worldX, worldY, transforms, options = {}) {
  const { jointRadius = 6, tipRadius = 6, boneThreshold = 8 } = options
  
  // Check in reverse order (later bones drawn on top)
  for (let i = transforms.length - 1; i >= 0; i--) {
    const transform = transforms[i]
    if (!transform) continue
    
    // Check tip first (rotation handle - highest priority)
    if (hitTestTip(worldX, worldY, transform, tipRadius)) {
      return { index: i, part: 'tip' }
    }
    
    // Check joint (translation handle)
    if (hitTestJoint(worldX, worldY, transform, jointRadius)) {
      return { index: i, part: 'joint' }
    }
    
    // Check bone line
    if (hitTestBone(worldX, worldY, transform, boneThreshold)) {
      return { index: i, part: 'bone' }
    }
  }
  
  return null
}

/**
 * Calculate angle from one point to another
 * 
 * @param {number} fromX - Start X
 * @param {number} fromY - Start Y
 * @param {number} toX - End X
 * @param {number} toY - End Y
 * @returns {number} Angle in degrees
 */
export function angleBetweenPoints(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX) * RAD_TO_DEG
}

/**
 * Calculate the local angle for a bone given a desired world angle
 * 
 * @param {number} desiredWorldAngle - Target world angle in degrees
 * @param {number} parentWorldAngle - Parent's world angle in degrees (0 if root)
 * @returns {number} Local angle in degrees
 */
export function worldToLocalAngle(desiredWorldAngle, parentWorldAngle) {
  return desiredWorldAngle - parentWorldAngle
}

/**
 * Normalize angle to -180 to 180 range
 * 
 * @param {number} angle - Angle in degrees
 * @returns {number} Normalized angle
 */
export function normalizeAngle(angle) {
  while (angle > 180) angle -= 360
  while (angle < -180) angle += 360
  return angle
}

/**
 * Calculate distance between two points
 * 
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @returns {number} Distance
 */
export function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

/**
 * Get all descendant bone indices for a given bone
 * 
 * @param {number} boneIndex - Index of the bone
 * @param {Array} bones - Array of bone data
 * @returns {Array} Array of descendant indices (not including the bone itself)
 */
export function getDescendants(boneIndex, bones) {
  const descendants = []
  
  for (let i = 0; i < bones.length; i++) {
    if (i === boneIndex) continue
    
    // Walk up the parent chain to see if this bone descends from boneIndex
    let current = i
    while (current !== null) {
      const parent = bones[current].parent
      if (parent === boneIndex) {
        descendants.push(i)
        break
      }
      current = parent
    }
  }
  
  return descendants
}

/**
 * Get direct children of a bone
 * 
 * @param {number} boneIndex - Index of the bone
 * @param {Array} bones - Array of bone data
 * @returns {Array} Array of child indices
 */
export function getChildren(boneIndex, bones) {
  return bones
    .map((bone, i) => bone.parent === boneIndex ? i : -1)
    .filter(i => i !== -1)
}
