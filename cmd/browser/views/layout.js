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
    const handles = this.layout.getHandles()
    // const panels = this.layout.getPanels()
    const toRemove = []

    for (const child of Array.from(this.children)) {
      if (child instanceof View) {
        this._resizePanel(child)
      } else if (child instanceof Handle) {
        const panel = handles.find(({ id }) => id === child.panel)
        if (panel) {
          this._resizeHandle(child, panel)
        } else {
          toRemove.push(child)
        }
      }
    }
    toRemove.forEach(a => a.remove())
  }

  _resizeHandle(child, panel) {
    if (!panel) return
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
      panelAttr = child.panel
    }
    const panel = this.layout.getPanel(panelAttr)
    child.x = panel.x
    child.y = panel.y
    child.w = panel.w
    child.h = panel.h
  }

  _onChildAdded(child) {
    const from = child.getAttribute("from")
    const nesw = child.getAttribute("nesw")

    // If child already has a panel attribute, it's already positioned (e.g., from view switching)
    if (!from || !nesw) {
      console.warn("Child added without required split attributes (from, nesw), skipping split logic")
      return
    }

    const fn = {
      "s": this.layout.splitFromNorth,
      "w": this.layout.splitFromEast,
      "e": this.layout.splitFromWest,
      "n": this.layout.splitFromSouth,
    }[nesw]


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
  static get observedAttributes() { return ['x', 'y', 'w', 'h', 'panel']; }

  constructor(panel, layout) {
    super()
    this.layout = layout
    this.panel = panel.id
    this.setAttribute("panel", panel.id)
    this._x = 0
    this._y = 0
    this._w = 0
    this._h = 0
    this.style.position = "absolute"
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
  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal);
    if (name === 'y') this._y = parseFloat(newVal);
    if (name === 'w') this._w = parseFloat(newVal);
    if (name === 'h') this._h = parseFloat(newVal);
    if (name === 'panel') this.panel = newVal

    this._updatePosition()
  }

  set x(v) { this._x = v; this._updatePosition(); }
  set y(v) { this._y = v; this._updatePosition(); }
  get x() { return this._x; }
  get y() { return this._y; }

  set w(v) { this._w = v; this._updatePosition(); }
  set h(v) { this._h = v; this._updatePosition(); }
  get w() { return this._w; }
  get h() { return this._h; }

  _updatePosition() {
    this.style.left = this._x + 'px';
    this.style.top = this._y + 'px';
    this.style.width = this._w + 'px';
    this.style.height = this._h + 'px';
  }

  _onDrag = (event) => {
    this.layout.layout.setHandlePosition(this.panel, event.clientX, event.clientY)
    this.layout.reset()
  }
}

customElements.define('view--handle', Handle)

