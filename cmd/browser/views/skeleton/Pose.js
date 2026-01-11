/**
 * Pose.js - Pose utilities for skeleton animation system
 * 
 * A pose represents a configuration of the skeleton as deltas from the bind pose.
 * Pose format: { x: number, y: number, angles: { [boneIndex]: angle } }
 * 
 * - x, y: root position offset from skeleton origin
 * - angles: sparse map of bone indices to absolute angles (only changed bones)
 */

/**
 * Create an empty pose (identical to bind pose)
 * @returns {Object} Empty pose
 */
export function createEmptyPose() {
  return {
    x: 0,
    y: 0,
    angles: {}
  }
}

/**
 * Clone a pose
 * @param {Object} pose - Pose to clone
 * @returns {Object} Cloned pose
 */
export function clonePose(pose) {
  return {
    x: pose.x,
    y: pose.y,
    angles: { ...pose.angles }
  }
}

/**
 * Check if a pose has any changes from bind pose
 * @param {Object} pose - Pose to check
 * @returns {boolean} True if pose has changes
 */
export function isPoseDirty(pose) {
  if (pose.x !== 0 || pose.y !== 0) return true
  return Object.keys(pose.angles).length > 0
}

/**
 * Apply pose to skeleton, returning a display-ready skeleton
 * This creates a new skeleton object with pose applied, without modifying original.
 * 
 * @param {Object} skeleton - Original skeleton data (bind pose)
 * @param {Object} pose - Pose to apply { x, y, angles }
 * @returns {Object} New skeleton with pose applied
 */
export function applyPose(skeleton, pose) {
  if (!skeleton || !pose) return skeleton

  // Create new bones array with pose angles applied
  const newBones = skeleton.bones.map((bone, index) => {
    const poseAngle = pose.angles[index]
    if (poseAngle !== undefined) {
      return { ...bone, a: poseAngle }
    }
    return bone
  })

  return {
    ...skeleton,
    x: skeleton.x + pose.x,
    y: skeleton.y + pose.y,
    bones: newBones
  }
}

/**
 * Extract pose from current skeleton state compared to bind pose
 * Returns only the differences (sparse angles map)
 * 
 * @param {Object} bindSkeleton - Original bind pose skeleton
 * @param {Object} currentSkeleton - Current skeleton state
 * @returns {Object} Pose representing the differences
 */
export function extractPose(bindSkeleton, currentSkeleton) {
  const pose = createEmptyPose()

  if (!bindSkeleton || !currentSkeleton) return pose

  // Extract root position delta
  pose.x = currentSkeleton.x - bindSkeleton.x
  pose.y = currentSkeleton.y - bindSkeleton.y

  // Extract angle deltas (only store changed angles)
  for (let i = 0; i < currentSkeleton.bones.length; i++) {
    const bindAngle = bindSkeleton.bones[i]?.a ?? 0
    const currentAngle = currentSkeleton.bones[i]?.a ?? 0

    // Only store if different (with small epsilon for floating point)
    if (Math.abs(currentAngle - bindAngle) > 0.001) {
      pose.angles[i] = currentAngle
    }
  }

  return pose
}

/**
 * Extract pose for specific bones only
 * 
 * @param {Object} bindSkeleton - Original bind pose skeleton
 * @param {Object} currentSkeleton - Current skeleton state
 * @param {Set|Array} boneIndices - Bone indices to extract
 * @returns {Object} Pose with only specified bones
 */
export function extractPoseForBones(bindSkeleton, currentSkeleton, boneIndices) {
  const pose = createEmptyPose()

  if (!bindSkeleton || !currentSkeleton) return pose

  const indices = boneIndices instanceof Set ? boneIndices : new Set(boneIndices)

  // Check if root is in selection (bone 0 typically)
  if (indices.has(0) || indices.has('root')) {
    pose.x = currentSkeleton.x - bindSkeleton.x
    pose.y = currentSkeleton.y - bindSkeleton.y
  }

  // Extract angles for selected bones only
  for (const i of indices) {
    if (typeof i !== 'number') continue
    if (i < 0 || i >= currentSkeleton.bones.length) continue

    const currentAngle = currentSkeleton.bones[i]?.a ?? 0
    pose.angles[i] = currentAngle
  }

  return pose
}

/**
 * Merge two poses, with pose2 taking precedence
 * 
 * @param {Object} pose1 - Base pose
 * @param {Object} pose2 - Overlay pose (takes precedence)
 * @returns {Object} Merged pose
 */
export function mergePoses(pose1, pose2) {
  return {
    x: pose2.x !== 0 ? pose2.x : pose1.x,
    y: pose2.y !== 0 ? pose2.y : pose1.y,
    angles: { ...pose1.angles, ...pose2.angles }
  }
}

/**
 * Interpolate between two poses
 * 
 * @param {Object} poseA - Start pose
 * @param {Object} poseB - End pose
 * @param {number} t - Interpolation factor (0-1)
 * @returns {Object} Interpolated pose
 */
export function interpolatePoses(poseA, poseB, t) {
  const result = createEmptyPose()

  // Interpolate root position
  result.x = poseA.x + (poseB.x - poseA.x) * t
  result.y = poseA.y + (poseB.y - poseA.y) * t

  // Collect all bone indices from both poses
  const allBones = new Set([
    ...Object.keys(poseA.angles),
    ...Object.keys(poseB.angles)
  ])

  // Interpolate angles
  for (const boneIndex of allBones) {
    const angleA = poseA.angles[boneIndex]
    const angleB = poseB.angles[boneIndex]

    if (angleA !== undefined && angleB !== undefined) {
      // Both poses have this bone - interpolate
      result.angles[boneIndex] = interpolateAngle(angleA, angleB, t)
    } else if (angleA !== undefined) {
      // Only poseA has this bone - use it (no interpolation target)
      result.angles[boneIndex] = angleA
    } else if (angleB !== undefined) {
      // Only poseB has this bone - use it
      result.angles[boneIndex] = angleB
    }
  }

  return result
}

/**
 * Interpolate between two angles, taking the shortest path
 * 
 * @param {number} a - Start angle in degrees
 * @param {number} b - End angle in degrees
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated angle
 */
export function interpolateAngle(a, b, t) {
  // Normalize to -180 to 180 range
  let diff = ((b - a + 180) % 360) - 180
  if (diff < -180) diff += 360

  return a + diff * t
}

/**
 * Update a single bone angle in a pose
 * 
 * @param {Object} pose - Pose to update
 * @param {number} boneIndex - Bone index to update
 * @param {number} angle - New angle value
 * @returns {Object} New pose with updated angle
 */
export function updatePoseAngle(pose, boneIndex, angle) {
  return {
    ...pose,
    angles: {
      ...pose.angles,
      [boneIndex]: angle
    }
  }
}

/**
 * Update root position in a pose
 * 
 * @param {Object} pose - Pose to update
 * @param {number} x - New x position
 * @param {number} y - New y position
 * @returns {Object} New pose with updated position
 */
export function updatePosePosition(pose, x, y) {
  return {
    ...pose,
    x,
    y
  }
}

/**
 * Get the angle for a bone from a pose, falling back to bind pose
 * 
 * @param {Object} skeleton - Bind pose skeleton
 * @param {Object} pose - Current pose
 * @param {number} boneIndex - Bone index
 * @returns {number} Angle for the bone
 */
export function getBoneAngle(skeleton, pose, boneIndex) {
  if (pose && pose.angles[boneIndex] !== undefined) {
    return pose.angles[boneIndex]
  }
  return skeleton.bones[boneIndex]?.a ?? 0
}

/**
 * Compare two poses for equality
 * 
 * @param {Object} pose1 - First pose
 * @param {Object} pose2 - Second pose
 * @returns {boolean} True if poses are equal
 */
export function posesEqual(pose1, pose2) {
  if (pose1.x !== pose2.x || pose1.y !== pose2.y) return false

  const keys1 = Object.keys(pose1.angles)
  const keys2 = Object.keys(pose2.angles)

  if (keys1.length !== keys2.length) return false

  for (const key of keys1) {
    if (Math.abs(pose1.angles[key] - pose2.angles[key]) > 0.001) {
      return false
    }
  }

  return true
}
