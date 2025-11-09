import { SplitLayout } from "../systems/split-layout.js"

import { View } from "./view.js"
export class LayoutParent extends HTMLElement {
  constructor() {
    super()
    this.layout = new SplitLayout(
      100, 100,
      parseFloat(this.getAttribute('handle-width')),
      parseFloat(this.getAttribute('handle-height')),
    )

    this._delme_id = "panel_1"

    this._observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof View) {
            this._onChildAdded(node)
          }
        }
      }
    })

    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this) {
          const { width, height } = entry.contentRect
          this._onResized(width, height)
        }
      }
    })
  }

  connectedCallback() {
    this._observer.observe(this, { childList: true })
    this._resizeObserver.observe(this)
  }

  disconnectedCallback() {
    this._observer.disconnect()
    this._resizeObserver.disconnect()
  }

  reset() {
    this._onResized(this.clientWidth, this.clientHeight) // TODO resize only "from" and "newPanelId"
  }

  _onResized(width, height) {
    this.layout.resize(width, height)

    for (const child of this.children) {
      if (child instanceof View) {
        this._resizeChild(child)
      }
    }
  }

  _resizeChild(child) { // TODO: move to _onResized
    child.layout = this
    const panel = this.layout.getPanel(child.getAttribute("panel"))
    child.x = panel.x
    child.y = panel.y
    child.w = panel.w
    child.h = panel.h
  }

  _onChildAdded(child) {
    const from = child.getAttribute("from")
    const fn = {
      "n": this.layout.splitFromNorth,
      "e": this.layout.splitFromEast,
      "w": this.layout.splitFromWest,
      "s": this.layout.splitFromSouth,
    }[child.getAttribute("nesw")]
    const { newPanelId, handleId } = fn(from, parseFloat(child.getAttribute("p")))
    const panel = this.layout.getPanel(newPanelId)
    child.setAttribute("panel", newPanelId)
    child.x = panel.x
    child.y = panel.y
    child.w = panel.w
    child.h = panel.h
    child.removeAttribute("from")
    child.removeAttribute("y")
    child.removeAttribute("nesw")
    this._onResized(this.clientWidth, this.clientHeight) // TODO resize only "from" and "newPanelId"
  }
}

