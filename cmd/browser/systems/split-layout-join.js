export function panelJoin(fromPanelId, toPanelId) {
  const fromPanel = this.getPanel(fromPanelId)
  const toPanel = this.getPanel(toPanelId)

  if (!fromPanel || !toPanel) {
    console.warn("Panel not found")
    return false
  }

  // Find the split that directly separates these panels
  const separatingSplit = findSeparatingSplit.call(this, fromPanelId, toPanelId)
  if (!separatingSplit) {
    console.warn("Panels are not adjacent")
    return false
  }

  // Determine which side of the split contains which panel
  const fromInLeft = isNodeInSubtree.call(this, separatingSplit.left, fromPanelId)
  const fromRegion = fromInLeft ? separatingSplit.left : separatingSplit.right
  const toRegion = fromInLeft ? separatingSplit.right : separatingSplit.left

  // Validate alignment: fromPanel must be aligned with toPanel
  if (!areRegionsAligned.call(this, fromPanel, toPanel, separatingSplit.vertical)) {
    console.warn("Panels are not properly aligned for merging")
    return false
  }

  // Determine the replacement structure
  let replacement

  if (fromRegion.type === "panel") {
    // Case 1: fromRegion is just the panel - simple replacement with toRegion
    replacement = toRegion
    this.panelCache.delete(fromPanelId)
  } else {
    // Case 2/3: fromRegion is a subtree - extract fromPanel, keep siblings
    const extracted = this.extractPanelFromSubtree(fromRegion, fromPanelId)

    if (!extracted || !extracted.sibling) {
      // No sibling means the entire subtree was just one panel
      replacement = toRegion
      this.panelCache.delete(fromPanelId)
    } else {
      // Sibling exists - create new split with toRegion and sibling
      // The new split should be oriented such that toRegion and sibling
      // can both expand in the merge direction
      //
      // If separating split was vertical, new split should be the same as
      // the extracted sibling's orientation (if it's a split) or horizontal
      // If separating split was horizontal, similar logic applies

      // For now, use the original separating split's orientation flipped
      // This allows both regions to expand properly
      const newSplitVertical = !separatingSplit.vertical

      replacement = {
        type: "split",
        id: genId("handle"),
        vertical: newSplitVertical,
        pos: newSplitVertical ? (this.width / 2) : (this.height / 2), // Will be recomputed
        left: fromInLeft ? toRegion : extracted.sibling,
        right: fromInLeft ? extracted.sibling : toRegion
      }

      this.panelCache.delete(fromPanelId)
    }
  }

  // Replace the separating split with the new structure
  if (separatingSplit === this.root) {
    this.root = replacement
  } else {
    replaceNode.call(this, this.root, separatingSplit.id, replacement)
  }

  // Recompute all bounds
  this.recomputePanelBounds(this.root, 0, 0, this.width, this.height)

  return true
}

/**
 * Extract a panel from a subtree, returning its sibling
 */
function extractPanelFromSubtree(node, panelId) {
  if (node.type === "panel") {
    return node.id === panelId ? { sibling: null } : null
  }

  if (node.type === "split") {
    // Check if panel is a direct child
    if (node.left.type === "panel" && node.left.id === panelId) {
      return { sibling: node.right }
    }
    if (node.right.type === "panel" && node.right.id === panelId) {
      return { sibling: node.left }
    }

    // Panel is deeper - recurse
    if (isNodeInSubtree.call(this, node.left, panelId)) {
      const result = this.extractPanelFromSubtree(node.left, panelId)
      if (result && result.sibling) {
        // Rebuild with extracted sibling and right child
        return {
          sibling: {
            type: "split",
            id: node.id,
            vertical: node.vertical,
            pos: node.pos,
            left: result.sibling,
            right: node.right
          }
        }
      }
      return result
    } else {
      const result = this.extractPanelFromSubtree(node.right, panelId)
      if (result && result.sibling) {
        // Rebuild with left child and extracted sibling
        return {
          sibling: {
            type: "split",
            id: node.id,
            vertical: node.vertical,
            pos: node.pos,
            left: node.left,
            right: result.sibling
          }
        }
      }
      return result
    }
  }

  return null
}

function isNodeInSubtree(node, panelId) {
  if (node.type === "panel") {
    return node.id === panelId
  }
  if (node.type === "split") {
    return isNodeInSubtree.call(this, node.left, panelId) ||
      isNodeInSubtree.call(this, node.right, panelId)
  }
  return false
}

/**
 * Get the bounding box of a node (panel or subtree)
 */
function getNodeBounds(node) {
  if (node.type === "panel") {
    return { x: node.x, y: node.y, w: node.w, h: node.h }
  }
  // For splits, calculate the bounding box that encompasses all child panels
  const leftBounds = this.getNodeBounds(node.left)
  const rightBounds = this.getNodeBounds(node.right)

  const minX = Math.min(leftBounds.x, rightBounds.x)
  const minY = Math.min(leftBounds.y, rightBounds.y)
  const maxX = Math.max(leftBounds.x + leftBounds.w, rightBounds.x + rightBounds.w)
  const maxY = Math.max(leftBounds.y + leftBounds.h, rightBounds.y + rightBounds.h)

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  }
}

function removePanelsFromCache(node) {
  if (node.type === "panel") {
    this.panelCache.delete(node.id)
  } else if (node.type === "split") {
    this.removePanelsFromCache(node.left)
    this.removePanelsFromCache(node.right)
  }
}

function findSeparatingSplit(fromPanelId, toPanelId) {
  const pathFrom = findPath.call(this, this.root, fromPanelId)
  const pathTo = findPath.call(this, this.root, toPanelId)

  if (!pathFrom || !pathTo) return null

  // Find lowest common ancestor
  let lca = null
  for (let i = 0; i < Math.min(pathFrom.length, pathTo.length); i++) {
    if (pathFrom[i] === pathTo[i]) {
      lca = pathFrom[i]
    } else {
      break
    }
  }

  return (lca && lca.type === "split") ? lca : null
}

function areRegionsAligned(fromBounds, toBounds, isVerticalSplit) {
  if (isVerticalSplit) {
    return fromBounds.y === toBounds.y
  } else {
    return fromBounds.x === toBounds.x
  }
}

function calculateExpandedBounds(fromBounds, toBounds, isVerticalSplit) {
  if (isVerticalSplit) {
    // Horizontal expansion (left-right merge)
    const minX = Math.min(fromBounds.x, toBounds.x)
    const maxX = Math.max(fromBounds.x + fromBounds.w, toBounds.x + toBounds.w)
    return {
      x: minX,
      y: toBounds.y,
      w: maxX - minX,
      h: toBounds.h
    }
  } else {
    // Vertical expansion (top-bottom merge)
    const minY = Math.min(fromBounds.y, toBounds.y)
    const maxY = Math.max(fromBounds.y + fromBounds.h, toBounds.y + toBounds.h)
    return {
      x: toBounds.x,
      y: minY,
      w: toBounds.w,
      h: maxY - minY
    }
  }
}


function findPath(node, panelId, path = []) {
  path.push(node)
  if (node.type === "panel" && node.id === panelId) return path
  if (node.type === "split") {
    const left = findPath.call(this, node.left, panelId, [...path])
    if (left) return left
    const right = findPath.call(this, node.right, panelId, [...path])
    if (right) return right
  }
  return null
}

function replaceNode(node, targetId, newNode) {
  if (node.type === "split") {
    if (node.left.id === targetId) {
      node.left = newNode
      return true
    }
    if (node.right.id === targetId) {
      node.right = newNode
      return true
    }
    return replaceNode.call(this, node.left, targetId, newNode) ||
      replaceNode.call(this, node.right, targetId, newNode)
  }
  return false
}
