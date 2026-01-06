/**
 * SkeletonEditor - Interaction logic for skeleton editing
 * 
 * Handles:
 * - Selection (click to select, shift+click for multi-select)
 * - Translation (drag joint to move bone)
 * - Rotation (drag tip to rotate bone)
 * - Creation (drag from tip to create child, drag on empty to create root)
 * - Deletion (delete key removes selected bones)
 */

import {
  computeWorldTransforms,
  findBoneAtPoint,
  angleBetweenPoints,
  worldToLocalAngle,
  normalizeAngle,
  distance,
  getDescendants,
  getChildren
} from './Bone.js'

// Editor modes
export const EditorMode = {
  SELECT: 'select',
  TRANSLATE: 'translate',
  ROTATE: 'rotate',
  CREATE: 'create'
}

/**
 * Create a new editor state
 */
export function createEditorState() {
  return {
    mode: EditorMode.SELECT,
    hoveredBone: null,
    hoveredPart: null,  // 'joint', 'tip', or 'bone'
    selectedBones: new Set(),

    // Drag state
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragBoneIndex: null,
    dragPart: null,

    // For rotation - store initial angle
    dragInitialAngle: 0,
    dragInitialBoneAngle: 0,

    // For creation
    createParentIndex: null,
    createStartX: 0,
    createStartY: 0,
    createEndX: 0,
    createEndY: 0,

    // Computed transforms (cached)
    transforms: []
  }
}

/**
 * Update hover state based on mouse position
 * 
 * @param {Object} state - Editor state
 * @param {Object} skeleton - Skeleton data
 * @param {number} worldX - Mouse X in world coordinates
 * @param {number} worldY - Mouse Y in world coordinates
 * @returns {boolean} True if state changed
 */
export function updateHover(state, skeleton, worldX, worldY) {
  if (!skeleton || state.isDragging) return false

  const hit = findBoneAtPoint(worldX, worldY, state.transforms)

  const prevHovered = state.hoveredBone
  const prevPart = state.hoveredPart

  if (hit) {
    // When hovering over a joint of a non-root bone, show parent bone as hovered
    let hoveredIndex = hit.index
    if (hit.part === 'joint') {
      const bone = skeleton.bones[hit.index]
      if (bone.parent !== null) {
        hoveredIndex = bone.parent
      }
    }

    state.hoveredBone = hoveredIndex
    state.hoveredPart = hit.part
  } else {
    state.hoveredBone = null
    state.hoveredPart = null
  }

  return state.hoveredBone !== prevHovered || state.hoveredPart !== prevPart
}

/**
 * Handle mouse down event
 * 
 * @param {Object} state - Editor state
 * @param {Object} skeleton - Skeleton data
 * @param {number} worldX - Mouse X in world coordinates
 * @param {number} worldY - Mouse Y in world coordinates
 * @param {boolean} shiftKey - Whether shift is held
 * @returns {Object} { changed: boolean, skeleton: Object }
 */
export function handleMouseDown(state, skeleton, worldX, worldY, shiftKey) {
  if (!skeleton) return { changed: false, skeleton }

  const hit = findBoneAtPoint(worldX, worldY, state.transforms)

  if (hit) {
    // Clicked on a bone
    let { index, part } = hit

    // Special case: zero-length root bone
    // When clicking on a zero-length root bone's tip, treat it as joint for translation
    const clickedBone = skeleton.bones[index]
    if (part === 'tip' && clickedBone.parent === null && clickedBone.l === 0) {
      part = 'joint'
    }

    // Determine which bone to select based on part clicked
    // When clicking a joint of a non-root bone, select the parent instead
    let selectIndex = index
    if (part === 'joint') {
      const bone = skeleton.bones[index]
      if (bone.parent !== null) {
        selectIndex = bone.parent
      }
    }

    // Handle selection
    if (shiftKey) {
      // Toggle selection
      if (state.selectedBones.has(selectIndex)) {
        state.selectedBones.delete(selectIndex)
      } else {
        state.selectedBones.add(selectIndex)
      }
    } else {
      // Single select (unless already selected for drag)
      if (!state.selectedBones.has(selectIndex)) {
        state.selectedBones.clear()
        state.selectedBones.add(selectIndex)
      }
    }

    // Start drag based on part
    // Note: selectIndex is the bone we selected (parent for joints), index is the hit bone
    state.isDragging = true
    state.dragStartX = worldX
    state.dragStartY = worldY
    state.dragBoneIndex = selectIndex  // Use selectIndex for consistency
    state.dragPart = part

    if (part === 'tip') {
      // Rotation mode - rotate the bone whose tip was clicked
      // For tips, selectIndex and index are the same
      state.mode = EditorMode.ROTATE
      const transform = state.transforms[selectIndex]
      state.dragInitialAngle = angleBetweenPoints(transform.worldX, transform.worldY, worldX, worldY)
      state.dragInitialBoneAngle = skeleton.bones[selectIndex].a
    } else if (part === 'joint') {
      // When clicking a joint, we operate on the bone we selected (parent for child joints)
      const bone = skeleton.bones[selectIndex]
      if (bone.parent === null) {
        // Root bone joint - translate the whole skeleton
        state.mode = EditorMode.TRANSLATE
      } else {
        // Non-root bone joint - rotate the parent bone (which is selectIndex)
        state.mode = EditorMode.ROTATE

        // Get pivot point (bone's joint, not its parent's)
        let pivotX, pivotY
        if (bone.parent === null) {
          pivotX = skeleton.x
          pivotY = skeleton.y
        } else {
          const parentTransform = state.transforms[bone.parent]
          pivotX = parentTransform.endX
          pivotY = parentTransform.endY
        }

        state.dragInitialAngle = angleBetweenPoints(pivotX, pivotY, worldX, worldY)
        state.dragInitialBoneAngle = bone.a
      }
    } else {
      // Clicked on bone body - just selection, no drag action
      state.isDragging = false
    }

    return { changed: true, skeleton }
  } else {
    // Clicked on empty space
    if (!shiftKey) {
      state.selectedBones.clear()
    }

    // Start creating a new root bone
    state.mode = EditorMode.CREATE
    state.isDragging = true
    state.createParentIndex = null
    state.createStartX = worldX
    state.createStartY = worldY
    state.createEndX = worldX
    state.createEndY = worldY

    return { changed: true, skeleton }
  }
}

/**
 * Handle mouse move event during drag
 * 
 * @param {Object} state - Editor state
 * @param {Object} skeleton - Skeleton data
 * @param {number} worldX - Mouse X in world coordinates
 * @param {number} worldY - Mouse Y in world coordinates
 * @returns {Object} { changed: boolean, skeleton: Object }
 */
export function handleMouseMove(state, skeleton, worldX, worldY) {
  if (!skeleton || !state.isDragging) return { changed: false, skeleton }

  switch (state.mode) {
    case EditorMode.TRANSLATE: {
      // Move skeleton origin (root bone)
      const dx = worldX - state.dragStartX
      const dy = worldY - state.dragStartY

      skeleton = {
        ...skeleton,
        x: skeleton.x + dx,
        y: skeleton.y + dy
      }

      state.dragStartX = worldX
      state.dragStartY = worldY

      // Recompute transforms
      state.transforms = computeWorldTransforms(skeleton)

      return { changed: true, skeleton }
    }

    case EditorMode.ROTATE: {
      const boneIndex = state.dragBoneIndex
      const bone = skeleton.bones[boneIndex]

      // Get pivot point (joint position)
      let pivotX, pivotY, parentWorldAngle
      if (bone.parent === null) {
        pivotX = skeleton.x
        pivotY = skeleton.y
        parentWorldAngle = 0
      } else {
        const parentTransform = state.transforms[bone.parent]
        pivotX = parentTransform.endX
        pivotY = parentTransform.endY
        parentWorldAngle = parentTransform.worldAngle
      }

      // Calculate new angle
      const currentAngle = angleBetweenPoints(pivotX, pivotY, worldX, worldY)
      const angleDelta = currentAngle - state.dragInitialAngle
      const newLocalAngle = normalizeAngle(state.dragInitialBoneAngle + angleDelta)

      // Update bone
      const newBones = [...skeleton.bones]
      newBones[boneIndex] = { ...bone, a: newLocalAngle }
      skeleton = { ...skeleton, bones: newBones }

      // Recompute transforms
      state.transforms = computeWorldTransforms(skeleton)

      return { changed: true, skeleton }
    }

    case EditorMode.CREATE: {
      state.createEndX = worldX
      state.createEndY = worldY
      return { changed: true, skeleton }
    }

    default:
      return { changed: false, skeleton }
  }
}

/**
 * Handle mouse up event
 * 
 * @param {Object} state - Editor state
 * @param {Object} skeleton - Skeleton data
 * @param {number} worldX - Mouse X in world coordinates
 * @param {number} worldY - Mouse Y in world coordinates
 * @returns {Object} { changed: boolean, skeleton: Object }
 */
export function handleMouseUp(state, skeleton, worldX, worldY) {
  if (!skeleton || !state.isDragging) {
    state.isDragging = false
    state.mode = EditorMode.SELECT
    return { changed: false, skeleton }
  }

  let changed = false

  if (state.mode === EditorMode.CREATE) {
    // Finish creating bone
    const length = distance(state.createStartX, state.createStartY, worldX, worldY)

    // Only create if dragged a meaningful distance
    if (length > 10) {
      const angle = angleBetweenPoints(state.createStartX, state.createStartY, worldX, worldY)

      if (state.createParentIndex === null) {
        // Creating a new root bone - but we should only have one root
        // Instead, move the skeleton origin and create from there
        if (skeleton.bones.length === 0 || skeleton.bones[0].parent !== null) {
          // No root exists, create one
          const newBone = {
            parent: null,
            a: angle,
            l: length
          }

          skeleton = {
            ...skeleton,
            x: state.createStartX,
            y: state.createStartY,
            bones: [newBone, ...skeleton.bones]
          }

          // Update parent indices for existing bones
          skeleton.bones = skeleton.bones.map((b, i) => {
            if (i === 0) return b
            return {
              ...b,
              parent: b.parent === null ? null : b.parent + 1
            }
          })

          changed = true
        }
      } else {
        // Creating child bone
        const parentTransform = state.transforms[state.createParentIndex]
        const parentWorldAngle = parentTransform.worldAngle
        const localAngle = worldToLocalAngle(angle, parentWorldAngle)

        const newBone = {
          parent: state.createParentIndex,
          a: localAngle,
          l: length
        }

        const newBones = [...skeleton.bones, newBone]
        const newIndex = newBones.length - 1

        // Add default name to props
        const newProps = { ...skeleton.props }
        newProps[newIndex] = { name: `bone_${newIndex}` }

        skeleton = { ...skeleton, bones: newBones, props: newProps }

        // Select the new bone
        state.selectedBones.clear()
        state.selectedBones.add(newIndex)

        changed = true
      }

      // Recompute transforms
      state.transforms = computeWorldTransforms(skeleton)
    }
  }

  // Reset drag state
  state.isDragging = false
  state.mode = EditorMode.SELECT
  state.dragBoneIndex = null
  state.dragPart = null
  state.createParentIndex = null

  return { changed, skeleton }
}

/**
 * Handle creating a child bone from a selected bone's tip
 * Called when user starts dragging from a bone tip
 * 
 * @param {Object} state - Editor state
 * @param {Object} skeleton - Skeleton data
 * @param {number} boneIndex - Parent bone index
 * @param {number} worldX - Start X in world coordinates
 * @param {number} worldY - Start Y in world coordinates
 */
export function startCreateChild(state, skeleton, boneIndex, worldX, worldY) {
  const transform = state.transforms[boneIndex]

  state.mode = EditorMode.CREATE
  state.isDragging = true
  state.createParentIndex = boneIndex
  state.createStartX = transform.endX
  state.createStartY = transform.endY
  state.createEndX = worldX
  state.createEndY = worldY
}

/**
 * Delete selected bones
 * 
 * @param {Object} state - Editor state
 * @param {Object} skeleton - Skeleton data
 * @returns {Object} { changed: boolean, skeleton: Object }
 */
export function deleteSelectedBones(state, skeleton) {
  if (!skeleton || state.selectedBones.size === 0) {
    return { changed: false, skeleton }
  }

  // Get all bones to delete (selected + their descendants)
  const toDelete = new Set(state.selectedBones)
  for (const index of state.selectedBones) {
    const descendants = getDescendants(index, skeleton.bones)
    descendants.forEach(d => toDelete.add(d))
  }

  // Don't allow deleting the root bone if it has children
  const rootIndex = skeleton.bones.findIndex(b => b.parent === null)
  if (toDelete.has(rootIndex)) {
    const rootChildren = getChildren(rootIndex, skeleton.bones)
    if (rootChildren.some(c => !toDelete.has(c))) {
      // Root has children that aren't being deleted - can't delete root
      toDelete.delete(rootIndex)
    }
  }

  if (toDelete.size === 0) {
    return { changed: false, skeleton }
  }

  // Build new bones array, remapping parent indices
  const indexMap = new Map() // old index -> new index
  const newBones = []
  const newProps = {}

  for (let i = 0; i < skeleton.bones.length; i++) {
    if (!toDelete.has(i)) {
      const newIndex = newBones.length
      indexMap.set(i, newIndex)

      const bone = skeleton.bones[i]
      const newParent = bone.parent === null ? null : indexMap.get(bone.parent)

      newBones.push({
        ...bone,
        parent: newParent
      })

      // Copy props with new index
      if (skeleton.props?.[i]) {
        newProps[newIndex] = skeleton.props[i]
      }
    }
  }

  skeleton = {
    ...skeleton,
    bones: newBones,
    props: newProps
  }

  // Clear selection
  state.selectedBones.clear()

  // Recompute transforms
  state.transforms = computeWorldTransforms(skeleton)

  return { changed: true, skeleton }
}

/**
 * Select all bones
 * 
 * @param {Object} state - Editor state
 * @param {Object} skeleton - Skeleton data
 */
export function selectAll(state, skeleton) {
  if (!skeleton) return

  state.selectedBones.clear()
  for (let i = 0; i < skeleton.bones.length; i++) {
    state.selectedBones.add(i)
  }
}

/**
 * Deselect all bones
 * 
 * @param {Object} state - Editor state
 */
export function deselectAll(state) {
  state.selectedBones.clear()
}

/**
 * Update transforms cache
 * 
 * @param {Object} state - Editor state
 * @param {Object} skeleton - Skeleton data
 */
export function updateTransforms(state, skeleton) {
  if (skeleton) {
    state.transforms = computeWorldTransforms(skeleton)
  } else {
    state.transforms = []
  }
}

/**
 * Get cursor style based on current state
 * 
 * @param {Object} state - Editor state
 * @returns {string} CSS cursor value
 */
export function getCursor(state) {
  if (state.isDragging) {
    switch (state.mode) {
      case EditorMode.TRANSLATE: return 'move'
      case EditorMode.ROTATE: return 'crosshair'
      case EditorMode.CREATE: return 'crosshair'
      default: return 'default'
    }
  }

  if (state.hoveredBone !== null) {
    switch (state.hoveredPart) {
      case 'joint': return 'move'
      case 'tip': return 'crosshair'
      case 'bone': return 'pointer'
      default: return 'default'
    }
  }

  return 'crosshair' // Default to crosshair for creating bones
}
