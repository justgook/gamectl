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
    this.panelCache = new Map()
    this.root = {
      type: "panel",
      id: genId("panel"),
      x: 0,
      y: 0,
      w: width,
      h: height
    }
    this.panelCache.set(this.root.id, this.root)
  }

  // === Query =============================================================
  getPanel(id) {
    return this.panelCache.get(id) || null
  }

  getHandle(id) {
    this.walkBreak(this.root, node => {
      if (node.type === "handle") panels.push({ ...node })
    })
    return this.panelCache.get(id) || null
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
    if (fn(node)) return true

    if (node.type === "split") {
      if (this.walkBreak(node.left, fn)) return true
      if (this.walkBreak(node.right, fn)) return true
    }
    return false
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
    return this.split(panelId, true, x, false)
  }

  splitFromWest = (panelId, x) => {
    return this.split(panelId, true, x, true)
  }

  splitFromNorth = (panelId, y) => {
    return this.split(panelId, false, y, true)
  }

  splitFromSouth = (panelId, y) => {
    return this.split(panelId, false, y, false)
  }

  split(panelId, vertical, pos, reverse = false) {
    const handleId = genId("handle")
    const newPanelId = genId("panel")

    const found = this.replacePanel(this.root, panelId, panel => {
      if (vertical) {
        if (!reverse) {
          // EAST: new panel on right
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
            id: newPanelId,
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
          // WEST: new panel on left
          const left = {
            type: "panel",
            id: newPanelId,
            x: panel.x,
            y: panel.y,
            w: pos - panel.x,
            h: panel.h
          }
          const right = {
            type: "panel",
            id: panel.id,
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
        }
      } else {
        if (!reverse) {
          // SOUTH: new panel below
          const top = {
            type: "panel",
            id: panel.id,
            x: panel.x,
            y: panel.y,
            w: panel.w,
            h: pos - panel.y
          }
          const bottom = {
            type: "panel",
            id: newPanelId,
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
        } else {
          // NORTH: new panel above
          const top = {
            type: "panel",
            id: newPanelId,
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
      }
    })

    if (!found) throw new Error(`Panel ${panelId} not found`)
    return { newPanelId, handleId }
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

      // Update cache: remove old panel reference if it becomes a split
      if (newNode.type === "split") {
        this.panelCache.delete(id)
        // Add new panel nodes to cache
        if (newNode.left.type === "panel") {
          this.panelCache.set(newNode.left.id, newNode.left)
        }
        if (newNode.right.type === "panel") {
          this.panelCache.set(newNode.right.id, newNode.right)
        }
      }

      Object.assign(node, newNode) // Replace in-place
      return true
    }
    return false
  }

  // === Remove ============================================================
  remove(panelId) {
    const removed = this.removePanelRecursive(null, this.root, panelId)
    if (!removed) throw new Error(`Panel ${panelId} not found`)
    this.panelCache.delete(panelId)
    this.recomputePanelBounds(this.root, 0, 0, this.width, this.height)
  }

  removePanelRecursive(parent, node, panelId) {
    if (node.type === "split") {
      if (node.left.type === "panel" && node.left.id === panelId) {
        const promoted = node.right
        if (!parent) {
          this.root = promoted
        } else {
          if (parent.left === node) parent.left = promoted
          else if (parent.right === node) parent.right = promoted
        }

        if (promoted.type === "panel") this.panelCache.set(promoted.id, promoted)
        return true
      }

      if (node.right.type === "panel" && node.right.id === panelId) {
        const promoted = node.left
        if (!parent) {
          this.root = promoted
        } else {
          if (parent.left === node) parent.left = promoted
          else if (parent.right === node) parent.right = promoted
        }

        if (promoted.type === "panel") this.panelCache.set(promoted.id, promoted)
        return true
      }

      if (this.removePanelRecursive(node, node.left, panelId)) return true
      if (this.removePanelRecursive(node, node.right, panelId)) return true
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
}
