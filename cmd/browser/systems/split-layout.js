let idCounter = 0
function genId(prefix) {
  return `${prefix}_${++idCounter}`
}

export class SplitLayout {
  constructor(width, height, handleW = 4, handleH = 4) {
    this.width = width
    this.height = height
    this.handleW = handleW
    this.handleH = handleH
    this.root = {
      type: "panel",
      id: genId("panel"),
      x: 0,
      y: 0,
      w: width,
      h: height
    }
  }

  // === Query =============================================================
  getPanel(id) {
    // TODO: add map to cache panels by id 
    let found = null
    this.walkBreak(this.root, node => {
      if (node.id === id && node.type === "panel") {
        found = node
        return true
      }
    })
    return found
  }

  getPanels() {
    const panels = []
    this.walk(this.root, node => {
      if (node.type === "panel") panels.push({ ...node })
    })
    return panels
  }

  getHandles() {
    const handles = []
    this.walk(this.root, node => {
      if (node.type === "split") {
        if (node.vertical) {
          handles.push({
            id: node.id,
            x: node.pos,
            y: this.getY(node),
            w: this.handleW,
            h: this.getH(node)
          })
        } else {
          handles.push({
            id: node.id,
            x: this.getX(node),
            y: node.pos,
            w: this.getW(node),
            h: this.handleH
          })
        }
      }
    })

    return handles
  }

  walk(node, fn) {
    fn(node)
    if (node.type === "split") {
      this.walk(node.left, fn)
      this.walk(node.right, fn)
    }
  }

  walkBreak(node, fn) {
    if (fn(node)) return

    if (node.type === "split") {
      if (this.walk(node.left, fn)) return
      if (this.walk(node.right, fn)) return
    }
  }

  // Helpers to compute bounding boxes of handles --------------------------

  getX(node) {
    if (node.type === "panel") return node.x
    if (node.vertical) return node.pos
    return this.getX(node.left)
  }
  getY(node) {
    if (node.type === "panel") return node.y
    if (!node.vertical) return node.pos
    return this.getY(node.left)
  }
  getW(node) {
    if (node.type === "panel") return node.w
    if (node.vertical) return this.handleW
    return Math.max(this.getW(node.left), this.getW(node.right))
  }
  getH(node) {
    if (node.type === "panel") return node.h
    if (!node.vertical) return this.handleH
    return Math.max(this.getH(node.left), this.getH(node.right))
  }

  // === Split =============================================================

  splitFromEast = (panelId, x) => {
    return this.split(panelId, true, x)
  }

  splitFromWest = (panelId, x) => {
    return this.split(panelId, true, x)
  }

  splitFromNorth = (panelId, y) => {
    return this.split(panelId, false, y)
  }

  splitFromSouth = (panelId, y) => {
    return this.split(panelId, false, y)
  }

  split(panelId, vertical, pos) {
    const handleId = genId("handle")
    const newPanel = { id: genId("panel"), x: 0, y: 0, w: 0, h: 0 }
    const found = this.replacePanel(this.root, panelId, panel => {
      if (vertical) {
        const left = {
          type: "panel",
          id: panel.id,
          x: panel.x,
          y: panel.y,
          w: pos - panel.x,
          h: panel.h
        }
        const right = {
          type: "panel",
          id: newPanel.id,
          x: pos + this.handleW,
          y: panel.y,
          w: panel.x + panel.w - (pos + this.handleW),
          h: panel.h
        }
        return {
          type: "split",
          id: handleId,
          vertical: true,
          pos,
          left,
          right
        }
      } else {
        const top = {
          type: "panel",
          id: newPanel.id,
          x: panel.x,
          y: panel.y,
          w: panel.w,
          h: pos - panel.y
        }
        const bottom = {
          type: "panel",
          id: panel.id,
          x: panel.x,
          y: pos + this.handleH,
          w: panel.w,
          h: panel.y + panel.h - (pos + this.handleH)
        }
        return {
          type: "split",
          id: handleId,
          vertical: false,
          pos,
          left: top,
          right: bottom
        }
      }
    })
    if (!found) throw new Error(`Panel ${panelId} not found`)
    return { newPanelId: newPanel.id, handleId }
  }

  replacePanel(node, id, fn) {
    if (node.type === "split") {
      return (
        this.replacePanel(node.left, id, fn) ||
        this.replacePanel(node.right, id, fn)
      )
    }
    if (node.id === id) {
      const newNode = fn(node)
      Object.assign(node, newNode) // Replace in-place
      return true
    }
    return false
  }

  // === Resize ============================================================
  resize(width, height) {
    this.width = width
    this.height = height
    this.recomputePanelBounds(this.root, 0, 0, width, height)
  }

  setHandlePosition(handleId, newX, newY) {
    const updated = this.updateSplitPosition(this.root, handleId, newX, newY)
    if (!updated) throw new Error(`Handle ${handleId} not found`)
  }

  updateSplitPosition(node, handleId, newX, newY) {
    if (node.type === "split") {
      if (node.id === handleId) {
        node.pos = node.vertical ? newX : newY
        this.recomputePanelBounds(this.root, 0, 0, this.width, this.height)
        return true
      }
      return (
        this.updateSplitPosition(node.left, handleId, newX, newY) ||
        this.updateSplitPosition(node.right, handleId, newX, newY)
      )
    }
    return false
  }

  recomputePanelBounds(node, x, y, w, h) {
    if (node.type === "panel") {
      node.x = x
      node.y = y
      node.w = w
      node.h = h
      return
    }
    if (node.vertical) {
      const leftW = node.pos - x
      const rightX = node.pos + this.handleW
      const rightW = x + w - rightX
      this.recomputePanelBounds(node.left, x, y, leftW, h)
      this.recomputePanelBounds(node.right, rightX, y, rightW, h)
    } else {
      const topH = node.pos - y
      const bottomY = node.pos + this.handleH
      const bottomH = y + h - bottomY
      this.recomputePanelBounds(node.left, x, y, w, topH)
      this.recomputePanelBounds(node.right, x, bottomY, w, bottomH)
    }
  }

  // === Utility ===========================================================

  findPanelAt(x, y) {
    return this.findAt(this.root, x, y)
  }

  findAt(node, x, y) {
    if (node.type === "panel") {
      return x >= node.x &&
        x < node.x + node.w &&
        y >= node.y &&
        y < node.y + node.h
        ? node.id
        : null
    }
    if (node.vertical) {
      if (x < node.pos) return this.findAt(node.left, x, y)
      if (x > node.pos + this.handleW) return this.findAt(node.right, x, y)
      return null // on handle
    } else {
      if (y < node.pos) return this.findAt(node.left, x, y)
      if (y > node.pos + this.handleH) return this.findAt(node.right, x, y)
      return null
    }
  }



  // === Merge =============================================================
  
  /**
   * Join fromPanel into toPanel (fromPanel disappears, toPanel expands)
   * This implements Blender-style panel merging with BST restructuring
   */
  join(fromPanelId, toPanelId) {
    // Find paths to both panels
    const pathFrom = this.findPath(this.root, fromPanelId)
    const pathTo = this.findPath(this.root, toPanelId)
    if (!pathFrom || !pathTo) {
      console.warn("One of panels not found")
      return false
    }

    // Find lowest common ancestor (LCA)
    const lca = this.findLCA(pathFrom, pathTo)
    if (!lca || lca.type !== "split") {
      console.warn("No direct split between panels")
      return false
    }

    // Determine which side contains which panel
    const fromInLeft = this.isNodeInSubtree(lca.left, fromPanelId)
    const fromNode = fromInLeft ? lca.left : lca.right
    const toNode = fromInLeft ? lca.right : lca.left

    // Handle different cases based on node types
    let replacement = null

    if (fromNode.type === "panel" && toNode.type === "panel") {
      // Case 1: Both are panels - simple merge
      // Just keep the toNode (winner panel)
      replacement = toNode
    } 
    else if (fromNode.type === "panel" && toNode.type === "split") {
      // Case 2: Panel merges into subtree
      // The entire subtree survives and expands
      replacement = toNode
    }
    else if (fromNode.type === "split" && toNode.type === "panel") {
      // Case 3: Panel from subtree merges into single panel
      // Need to extract fromPanel and keep its siblings
      replacement = this.extractAndRestructure(fromNode, fromPanelId, toNode, lca.vertical)
    }
    else {
      // Case 4: Panel from one subtree merges into another subtree
      // Extract fromPanel, keep siblings, toNode subtree survives
      replacement = this.extractAndRestructure(fromNode, fromPanelId, toNode, lca.vertical)
    }

    if (!replacement) {
      console.warn("Failed to create replacement structure")
      return false
    }

    // Replace LCA with the new structure
    if (lca === this.root) {
      this.root = replacement
    } else {
      this.replaceNode(this.root, lca.id, replacement)
    }

    // Recompute all bounds
    this.recomputePanelBounds(this.root, 0, 0, this.width, this.height)
    return true
  }

  /**
   * Find lowest common ancestor of two paths
   */
  findLCA(pathFrom, pathTo) {
    let lca = null
    for (let i = 0; i < Math.min(pathFrom.length, pathTo.length); i++) {
      if (pathFrom[i] === pathTo[i]) {
        lca = pathFrom[i]
      } else {
        break
      }
    }
    return lca
  }

  /**
   * Check if a panel exists in a subtree
   */
  isNodeInSubtree(node, panelId) {
    if (node.type === "panel") {
      return node.id === panelId
    }
    if (node.type === "split") {
      return this.isNodeInSubtree(node.left, panelId) || 
             this.isNodeInSubtree(node.right, panelId)
    }
    return false
  }

  /**
   * Extract a panel from a subtree and restructure with the winner node
   * This is the complex case where we need to:
   * 1. Remove fromPanel from the fromSubtree
   * 2. Keep the sibling panels
   * 3. Create new split structure with toNode and remaining panels
   */
  extractAndRestructure(fromSubtree, fromPanelId, toNode, originalSplitVertical) {
    // Find the fromPanel in the subtree and get its sibling
    const result = this.findAndExtractPanel(fromSubtree, fromPanelId)
    
    if (!result) {
      console.warn("Could not find panel in subtree")
      return null
    }

    const { sibling, removedPanel } = result

    // If there's no sibling, just return toNode (the entire fromSubtree was just one panel)
    if (!sibling) {
      return toNode
    }

    // Create a new split with toNode and the remaining sibling subtree
    // The new split orientation should be perpendicular to the original
    // This allows both toNode and sibling to expand in the merge direction
    // 
    // We need to set pos to match where the removed panel was
    // If original split was vertical, new split is horizontal, so pos should be Y
    // If original split was horizontal, new split is vertical, so pos should be X
    let pos
    if (!originalSplitVertical) {
      // New split is vertical (left-right)
      // Use the original X position of the removed panel as reference
      pos = removedPanel ? removedPanel.x + removedPanel.w : 100
    } else {
      // New split is horizontal (top-bottom)
      // Use the original Y position of the removed panel as reference  
      pos = removedPanel ? removedPanel.y + removedPanel.h : 100
    }

    const newSplit = {
      type: "split",
      id: genId("handle"),
      vertical: !originalSplitVertical, // Perpendicular!
      pos,
      left: toNode,
      right: sibling
    }

    return newSplit
  }

  /**
   * Find a panel in a subtree and extract it, returning its sibling
   * Returns: { sibling: node, removedPanel: node } or null
   */
  findAndExtractPanel(node, panelId) {
    if (node.type === "panel") {
      // Shouldn't happen - means we're trying to extract the root panel
      return null
    }

    if (node.type === "split") {
      const leftIsPanel = node.left.type === "panel"
      const rightIsPanel = node.right.type === "panel"

      // Check if the panel is a direct child
      if (leftIsPanel && node.left.id === panelId) {
        // Panel is on the left, return right sibling
        return { sibling: node.right, removedPanel: node.left }
      }
      if (rightIsPanel && node.right.id === panelId) {
        // Panel is on the right, return left sibling
        return { sibling: node.left, removedPanel: node.right }
      }

      // Panel is deeper in the tree - recurse
      if (this.isNodeInSubtree(node.left, panelId)) {
        // Panel is somewhere in left subtree
        const result = this.findAndExtractPanel(node.left, panelId)
        if (result && result.sibling) {
          // Now we need to reconstruct: right + extracted sibling
          return {
            sibling: {
              type: "split",
              id: node.id, // Reuse the split ID
              vertical: node.vertical,
              pos: node.pos,
              left: result.sibling,
              right: node.right
            },
            removedPanel: result.removedPanel
          }
        }
        return result
      } else {
        // Panel is somewhere in right subtree
        const result = this.findAndExtractPanel(node.right, panelId)
        if (result && result.sibling) {
          // Reconstruct: left + extracted sibling
          return {
            sibling: {
              type: "split",
              id: node.id, // Reuse the split ID
              vertical: node.vertical,
              pos: node.pos,
              left: node.left,
              right: result.sibling
            },
            removedPanel: result.removedPanel
          }
        }
        return result
      }
    }

    return null
  }

  findPath(node, panelId, path = []) {
    path.push(node)
    if (node.type === "panel" && node.id === panelId) return path
    if (node.type === "split") {
      const left = this.findPath(node.left, panelId, [...path])
      if (left) return left
      const right = this.findPath(node.right, panelId, [...path])
      if (right) return right
    }
    return null
  }

  replaceNode(node, targetId, newNode) {
    if (node.type === "split") {
      if (node.left.id === targetId) {
        node.left = newNode
        return true
      }
      if (node.right.id === targetId) {
        node.right = newNode
        return true
      }
      return this.replaceNode(node.left, targetId, newNode) ||
             this.replaceNode(node.right, targetId, newNode)
    }
    return false
  }
}
