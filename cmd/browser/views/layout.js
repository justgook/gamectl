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
        this._resizePanel(child)
      } else if (child instanceof Handle) {
        this.handle
      }
    }
  }

  _resizeHandle(child) {
    const panel = this.layout.getPanel(panelAttr)
    child.x = panel.x
    child.y = panel.y
    child.w = panel.w
    child.h = panel.h
  }
  _resizePanel(child) {
    child.layout = this
    let panelAttr = child.getAttribute("panel")
    if (!panelAttr) {
      this._onChildAdded(child)
      panelAttr = child.getAttribute("panel")
    }
    const panel = this.layout.getPanel(panelAttr)
    child.x = panel.x
    child.y = panel.y
    child.w = panel.w
    child.h = panel.h
  }

  _onChildAdded(child) {
    console.log("_on")
    const from = child.getAttribute("from")
    const fn = {
      "s": this.layout.splitFromNorth,
      "w": this.layout.splitFromEast,
      "e": this.layout.splitFromWest,
      "n": this.layout.splitFromSouth,
    }[child.getAttribute("nesw")]
    const { newPanelId, handleId } = fn(from, parseFloat(child.getAttribute("p")))
    this._addHandle(handleId)
    const panel = this.layout.getPanel(newPanelId)
    child.setAttribute("panel", newPanelId)
    child.x = panel.x
    child.y = panel.y
    child.w = panel.w
    child.h = panel.h
    child.removeAttribute("from")
    child.removeAttribute("p")
    child.removeAttribute("nesw")
    this._onResized(this.clientWidth, this.clientHeight) // TODO: maybe resize only "from" and "newPanelId"

  }

  _addHandle(handleId) {
    const panel = this.layout.getHandles().find(({ id }) => handleId == id)
    if (!panel) {
      console.warn("remove handle??")
      return
    }

    const child = new Handle(panel, this)
    this.appendChild(child)
  }
}

class Handle extends HTMLElement {
  constructor(info, layout) {
    super()

    this.layout = layout
    this.handleId = info.id

    this.style.position = "absolute"
    this.style.left = info.x
    this.style.top = info.y
    this.style.width = info.w
    this.style.height = info.h
    this.vertical = info.h > info.w
  }

  connectedCallback() {
    const template = document.getElementById("view-handle")
    const content = template.content.cloneNode(true)
    const elm = content.querySelector(`[data-action="resize"]`)
    elm.addEventListener("drag", this._onDrag)
    // elm.addEventListener("dragstart", e => {
    //   const emptyImg = new Image();
    //   emptyImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4DwQMBAABvwFyP+zYJwAAAABJRU5ErkJggg==";
    //   e.dataTransfer.setDragImage(emptyImg, 0, 0);
    // });
    this.appendChild(content)
  }
  _onDrag = (event) => {
    this.layout.layout.setHandlePosition(this.handleId, event.clientX, event.clientY)
    this.style.position = "absolute"
    if (this.vertical) {
      this.style.left = event.clientX
    } else {
      this.style.top = event.clientY
    }
    this.layout.reset()
  }
}

customElements.define('view--handle', Handle)

