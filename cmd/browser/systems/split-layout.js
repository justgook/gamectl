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
  join(fromPanelId, toPanelId) {
    const pathFrom = this.findPath(this.root, fromPanelId)
    const pathTo = this.findPath(this.root, toPanelId)
    if (!pathFrom || !pathTo) throw new Error("One of panels not found")

    // Find lowest common ancestor (LCA)
    let lca = null
    for (let i = 0; i < Math.min(pathFrom.length, pathTo.length); i++) {
      if (pathFrom[i] === pathTo[i]) lca = pathFrom[i]
      else break
    }

    if (!lca || lca.type !== "split") {
      console.warn("No direct split between panels")
      return false
    }

    // Determine sides
    const left = lca.left
    const right = lca.right

    let merged = null

    if (left.type === "panel" && left.id === fromPanelId && right.type === "panel" && right.id === toPanelId) {
      merged = this.mergePanels(lca, left, right)
    } else if (left.type === "panel" && left.id === toPanelId && right.type === "panel" && right.id === fromPanelId) {
      merged = this.mergePanels(lca, left, right)
    } else {
      console.warn("Panels are not directly adjacent")
      return false
    }

    // Replace LCA split node with the merged panel in its parent
    this.replaceNode(this.root, lca.id, merged)

    // Recompute bounds
    this.recomputePanelBounds(this.root, 0, 0, this.width, this.height)
    return true
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
      if (node.left.id === targetId) node.left = newNode
      else if (node.right.id === targetId) node.right = newNode
      else {
        this.replaceNode(node.left, targetId, newNode)
        this.replaceNode(node.right, targetId, newNode)
      }
    }
  }

  mergePanels(split, left, right) {
    if (split.vertical) {
      // Merge horizontally
      const x = Math.min(left.x, right.x)
      const y = left.y
      const w = left.w + this.handleW + right.w
      const h = left.h
      return { type: "panel", id: left.id, x, y, w, h }
    } else {
      // Merge vertically
      const x = left.x
      const y = Math.min(left.y, right.y)
      const w = left.w
      const h = left.h + this.handleH + right.h
      return { type: "panel", id: left.id, x, y, w, h }
    }
  }
}
