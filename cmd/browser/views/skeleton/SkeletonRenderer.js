/**
 * SkeletonRenderer - Canvas rendering for skeleton bones
 * 
 * Renders bones as simple lines with circle joints
 * Supports visual states: default, hovered, selected
 * 
 * Note: Canvas Y is inverted (Y increases downward) but our skeleton
 * uses Y increasing upward. The view handles the flip via ctx.scale(1, -1)
 */

// Colors for different bone states
const COLORS = {
  bone: {
    default: '#6b7280',      // gray-500
    hovered: '#3b82f6',      // blue-500
    selected: '#f59e0b',     // amber-500
  },
  joint: {
    default: '#9ca3af',      // gray-400
    hovered: '#60a5fa',      // blue-400
    selected: '#fbbf24',     // amber-400
    fill: '#1f2937',         // gray-800
  },
  tip: {
    default: '#6b7280',      // gray-500
    hovered: '#3b82f6',      // blue-500
    selected: '#f59e0b',     // amber-500
  },
  origin: '#ef4444',         // red-500 - skeleton origin marker
  grid: '#374151',           // gray-700
}

// Sizes
const JOINT_RADIUS = 5
const TIP_RADIUS = 4
const BONE_WIDTH = 2
const ORIGIN_SIZE = 8

/**
 * Render the entire skeleton
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} skeleton - Skeleton data
 * @param {Array} transforms - Computed world transforms
 * @param {Object} state - Editor state { hoveredBone, selectedBones, hoveredPart }
 */
export function renderSkeleton(ctx, skeleton, transforms, state = {}) {
  const { hoveredBone, selectedBones = new Set(), hoveredPart } = state
  
  // Draw origin marker
  renderOrigin(ctx, skeleton.x, skeleton.y)
  
  // Draw bones (lines first, then joints on top)
  for (let i = 0; i < transforms.length; i++) {
    const transform = transforms[i]
    if (!transform) continue
    
    const isHovered = hoveredBone === i
    const isSelected = selectedBones.has(i)
    
    renderBoneLine(ctx, transform, isHovered, isSelected)
  }
  
  // Draw joints and tips on top
  for (let i = 0; i < transforms.length; i++) {
    const transform = transforms[i]
    if (!transform) continue
    
    const bone = skeleton.bones[i]
    const isHovered = hoveredBone === i
    const isSelected = selectedBones.has(i)
    
    // Only draw joint for root bone or if it's the hovered/selected bone
    // Child bones share their joint with parent's tip
    if (bone.parent === null || isHovered || isSelected) {
      renderJoint(ctx, transform, isHovered && hoveredPart === 'joint', isSelected)
    }
    
    // Draw tip (rotation handle) if bone has length
    if (bone.l > 0) {
      renderTip(ctx, transform, isHovered && hoveredPart === 'tip', isSelected)
    }
  }
}

/**
 * Render skeleton origin marker
 */
function renderOrigin(ctx, x, y) {
  ctx.save()
  ctx.strokeStyle = COLORS.origin
  ctx.lineWidth = 2
  
  // Cross marker
  ctx.beginPath()
  ctx.moveTo(x - ORIGIN_SIZE, y)
  ctx.lineTo(x + ORIGIN_SIZE, y)
  ctx.moveTo(x, y - ORIGIN_SIZE)
  ctx.lineTo(x, y + ORIGIN_SIZE)
  ctx.stroke()
  
  // Small circle
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.stroke()
  
  ctx.restore()
}

/**
 * Render a bone line
 */
function renderBoneLine(ctx, transform, isHovered, isSelected) {
  const { worldX, worldY, endX, endY } = transform
  
  // Determine color based on state
  let color = COLORS.bone.default
  if (isSelected) color = COLORS.bone.selected
  else if (isHovered) color = COLORS.bone.hovered
  
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = isSelected ? BONE_WIDTH + 1 : BONE_WIDTH
  ctx.lineCap = 'round'
  
  ctx.beginPath()
  ctx.moveTo(worldX, worldY)
  ctx.lineTo(endX, endY)
  ctx.stroke()
  
  ctx.restore()
}

/**
 * Render a joint circle (at bone start)
 */
function renderJoint(ctx, transform, isHovered, isSelected) {
  const { worldX, worldY } = transform
  
  // Determine colors based on state
  let strokeColor = COLORS.joint.default
  if (isSelected) strokeColor = COLORS.joint.selected
  else if (isHovered) strokeColor = COLORS.joint.hovered
  
  ctx.save()
  
  // Fill
  ctx.fillStyle = COLORS.joint.fill
  ctx.beginPath()
  ctx.arc(worldX, worldY, JOINT_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  
  // Stroke
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = isSelected ? 2 : 1.5
  ctx.stroke()
  
  ctx.restore()
}

/**
 * Render a tip circle (at bone end - rotation handle)
 */
function renderTip(ctx, transform, isHovered, isSelected) {
  const { endX, endY } = transform
  
  // Determine color based on state
  let color = COLORS.tip.default
  if (isSelected) color = COLORS.tip.selected
  else if (isHovered) color = COLORS.tip.hovered
  
  ctx.save()
  
  // Filled circle for tip
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(endX, endY, TIP_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.restore()
}

/**
 * Render a grid for reference
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} bounds - { minX, minY, maxX, maxY }
 * @param {number} gridSize - Grid cell size in world units
 */
export function renderGrid(ctx, bounds, gridSize = 50) {
  const { minX, minY, maxX, maxY } = bounds
  
  ctx.save()
  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 0.5
  
  // Vertical lines
  const startX = Math.floor(minX / gridSize) * gridSize
  for (let x = startX; x <= maxX; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, minY)
    ctx.lineTo(x, maxY)
    ctx.stroke()
  }
  
  // Horizontal lines
  const startY = Math.floor(minY / gridSize) * gridSize
  for (let y = startY; y <= maxY; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(minX, y)
    ctx.lineTo(maxX, y)
    ctx.stroke()
  }
  
  // Axis lines (thicker)
  ctx.strokeStyle = '#4b5563' // gray-600
  ctx.lineWidth = 1
  
  // X axis
  if (minY <= 0 && maxY >= 0) {
    ctx.beginPath()
    ctx.moveTo(minX, 0)
    ctx.lineTo(maxX, 0)
    ctx.stroke()
  }
  
  // Y axis
  if (minX <= 0 && maxX >= 0) {
    ctx.beginPath()
    ctx.moveTo(0, minY)
    ctx.lineTo(0, maxY)
    ctx.stroke()
  }
  
  ctx.restore()
}

/**
 * Render bone name labels
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} skeleton - Skeleton data
 * @param {Array} transforms - Computed world transforms
 * @param {number} scale - Current viewport scale (for font sizing)
 */
export function renderLabels(ctx, skeleton, transforms, scale = 1) {
  ctx.save()
  
  // Scale font inversely so it stays readable at any zoom
  const fontSize = Math.max(10, Math.min(14, 12 / scale))
  ctx.font = `${fontSize}px sans-serif`
  ctx.fillStyle = '#9ca3af'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  
  for (let i = 0; i < transforms.length; i++) {
    const transform = transforms[i]
    if (!transform) continue
    
    const props = skeleton.props?.[i]
    const name = props?.name || `bone_${i}`
    
    // Position label near the middle of the bone
    const midX = (transform.worldX + transform.endX) / 2
    const midY = (transform.worldY + transform.endY) / 2
    
    // Offset slightly
    ctx.fillText(name, midX + 8, midY)
  }
  
  ctx.restore()
}

/**
 * Render a preview bone during creation
 * 
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} startX - Start X in world coordinates
 * @param {number} startY - Start Y in world coordinates
 * @param {number} endX - End X in world coordinates
 * @param {number} endY - End Y in world coordinates
 */
export function renderPreviewBone(ctx, startX, startY, endX, endY) {
  ctx.save()
  
  // Dashed line
  ctx.strokeStyle = '#60a5fa' // blue-400
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])
  ctx.lineCap = 'round'
  
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.stroke()
  
  // Start circle
  ctx.setLineDash([])
  ctx.fillStyle = '#1f2937'
  ctx.beginPath()
  ctx.arc(startX, startY, JOINT_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#60a5fa'
  ctx.stroke()
  
  // End circle
  ctx.fillStyle = '#60a5fa'
  ctx.beginPath()
  ctx.arc(endX, endY, TIP_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  
  ctx.restore()
}
