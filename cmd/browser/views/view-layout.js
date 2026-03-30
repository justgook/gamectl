import { bus } from "../systems/event-bus.js"
import { ensureThemeStylesheetLink, getThemeStylesheetSource } from "../systems/theme-stylesheet.js"

const ABI = {
  HEADER_I32: 15,
  AREA_I32: 5,
  HANDLE_I32: 5,
  MAX_PANELS: 16,
  MAX_HANDLES: 15,
  TRY_I32: 5,
}

const ERR = {
  0: "ok",
  1: "not_initialized",
  2: "invalid_arg",
  3: "invalid_handle",
  4: "invalid_area",
  5: "invalid_corner",
  6: "out_of_bounds",
  7: "min_size",
  8: "not_implemented",
  9: "capacity",
}

const HANDLE_SIZE_VAR = "--resize-handle-size"


export class LayoutManager extends HTMLElement {
  static get keybindings() {
    return [
      { id: 'open-settings', eventName: 'app:settings', description: 'Open settings', defaultKeys: '<C-,>' },
      { id: 'save', eventName: 'file:save', description: 'Save current work', defaultKeys: '<C-s>' },
      { id: 'reload', eventName: 'app:reload', description: 'Reload application', defaultKeys: '<C-r>' },
      { id: 'close-popup', eventName: 'popup:close', description: 'Close top popup', defaultKeys: '<Esc>' }
    ]
  }

  constructor() {
    super()
    this.handleSize = 12
    this.minPanelSize = 200
    this.content = new Map()
    this.contenCounter = 0
    this.handles = []
    this.width = 0
    this.height = 0
    this._setupPromise = null
    this.tryRectEl = null
    this.cornerDrag = {
      active: false,
      areaIndex: -1,
      cornerIndex: -1,
      x: 0,
      y: 0,
      lastX: Number.NaN,
      lastY: Number.NaN,
      raf: 0,
    }

    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this) {
          const { width, height } = entry.contentRect
          this.width = width
          this.height = height
          this._onResized()
        }
      }
    })

    this._themeObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'href') {
          this._scheduleHandleSizeSync()
        }
      }
    })
  }

  connectedCallback() {
    const initialLayout = this.innerHTML
    this.innerHTML = ""


    this._resizeObserver.observe(this)

    const link = getThemeStylesheetSource()
    if (link) {
      this._themeObserver.observe(link, { attributes: true, attributeFilter: ['href'] })
    }

    bus.on('plugin-manager:ready', async () => {
      if (this._setupPromise) {
        return
      }

      this._setupPromise = this._setup(initialLayout)
      await this._setupPromise
      this._scheduleHandleSizeSync()
    })
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect()
    this._themeObserver.disconnect()
    this._stopCornerPreview()
  }


  _onResized = () => {
    if (!this.api) return
    this.api.resize_screen(this.width, this.height, this.handleSize)
    this.render()
  }

  _scheduleHandleSizeSync = () => {
    if (this._syncQueued || !this.api) {
      return
    }

    this._syncQueued = true
    queueMicrotask(() => {
      this._syncQueued = false

      const newSize = parseFloat(getComputedStyle(this).getPropertyValue(HANDLE_SIZE_VAR)) || 12
      if (newSize !== this.handleSize) {
        this.handleSize = newSize
        this.api.resize_screen(this.width, this.height, this.handleSize)
      }

      this.render()
    })
  }

  render = () => {
    const h = header(this.i32)
    const tr = this.tryRect()
    const dupe = new Set()
    const wasContent = new Set(this.content.keys())

    for (let areaId = 0; areaId < h.areaCount; areaId += 1) {
      const area = this.areaAt(areaId);
      let node = this.content.get(area.content)
      if (dupe.has(area.content)) { node = this.spawnChrome(node, areaId) }
      dupe.add(area.content)
      wasContent.delete(area.content)
      node.x = area.x0
      node.y = area.y0
      node.w = area.x1 - area.x0
      node.h = area.y1 - area.y0
      node.panel = areaId
    }

    wasContent.forEach(c => {
      this.removeChild(this.content.get(c))
      this.content.delete(c)
    })

    // HANDLES
    while (this.handles.length < h.handleCount) { this.spawnHandle() }
    for (let id = 0; id < h.handleCount; id++) {
      const area = this.handleAt(id);
      const node = this.handles[id]; // guaranteed to exist

      node.x = area.x0;
      node.y = area.y0;
      node.w = area.x1 - area.x0;
      node.h = area.y1 - area.y0;
      node.panel = id;
    }

    for (let i = h.handleCount; i < this.handles.length; i++) { this.handles[i]?.remove() }
    this.handles.length = h.handleCount

    if (this.cornerDrag.active && tr.valid) {
      this._ensureTryRect()
      this.tryRectEl.style.display = "block"
      this.tryRectEl.style.left = `${tr.x0}px`
      this.tryRectEl.style.top = `${tr.y0}px`
      this.tryRectEl.style.width = `${Math.max(1, tr.x1 - tr.x0)}px`
      this.tryRectEl.style.height = `${Math.max(1, tr.y1 - tr.y0)}px`
    } else if (this.tryRectEl) {
      this.tryRectEl.style.display = "none"
    }
  }

  tryRect() {
    const base = ABI.HEADER_I32 + ABI.MAX_PANELS * ABI.AREA_I32 + ABI.MAX_HANDLES * ABI.HANDLE_I32
    const v = this.i32
    return {
      valid: v[base + 0],
      x0: v[base + 1],
      y0: v[base + 2],
      x1: v[base + 3],
      y1: v[base + 4],
    }
  }

  spawnHandle = () => {
    const node = document.createElement("view--handle")
    makeHandleDraggable(this, node, (x, y) => {
      this.api.move_handle(node.panel, x, y)
      this.render()
    })
    this.handles.push(node)
    this.appendChild(node)

    return node
  }
  spawnChrome = (node, areaId) => {
    const contentId = ++this.contenCounter
    this.api.set_area_content(areaId, contentId)
    const currentView = node.shadowRoot?.querySelector("slot:not([name])")?.assignedElements?.()[0] || null
    const viewTag = currentView ? currentView.tagName.toLowerCase() : "view-empty"
    const chrome = document.createElement("view-area")
    chrome.appendChild(document.createElement(viewTag))
    this.content.set(contentId, chrome)
    this._addCorners(chrome, areaId)
    this.appendChild(chrome)

    return chrome
  }

  areaAt(index) {
    const base = ABI.HEADER_I32 + index * ABI.AREA_I32
    const v = this.i32
    return {
      x0: v[base + 0],
      y0: v[base + 1],
      x1: v[base + 2],
      y1: v[base + 3],
      content: v[base + 4],
    }
  }

  handleAt(index) {
    const handleBase = ABI.HEADER_I32 + ABI.MAX_PANELS * ABI.AREA_I32
    const base = handleBase + index * ABI.HANDLE_I32
    const v = this.i32
    return {
      x0: v[base + 0],
      y0: v[base + 1],
      x1: v[base + 2],
      y1: v[base + 3],
      content: v[base + 4],
    }
  }

  _parseSetup(setup, index) {
    const parts = String(setup).split(":")
    if (parts.length !== 3) {
      throw new Error(`layout child ${index}: invalid setup format '${setup}'`)
    }

    const [targetText, axis, percentText] = parts
    const target = Number.parseInt(targetText, 10)
    const percent = Number.parseInt(percentText, 10)

    if (!Number.isInteger(target) || target < 0) {
      throw new Error(`layout child ${index}: invalid target '${targetText}'`)
    }

    if (axis !== "v" && axis !== "h") {
      throw new Error(`layout child ${index}: invalid axis '${axis}'`)
    }

    if (!Number.isInteger(percent) || percent <= 0 || percent >= 100) {
      throw new Error(`layout child ${index}: invalid percent '${percentText}'`)
    }

    return { target, axis, percent }
  }

  _viewSpecFromNode(node, index) {
    const tag = node.tagName.toLowerCase()
    if (!tag.startsWith("view-")) {
      throw new Error(`layout child ${index}: expected a view-* element, got '${tag}'`)
    }

    const attrs = {}
    for (const attr of node.attributes) {
      attrs[attr.name] = attr.value
    }

    return {
      tag,
      attrs,
      innerHTML: node.innerHTML,
    }
  }

  _initialLayoutSpecsFromMarkup(markup) {
    const template = document.createElement("template")
    template.innerHTML = markup

    const nodes = Array.from(template.content.children).filter((node) => {
      const tag = node.tagName.toLowerCase()
      return tag.startsWith("view-") && tag !== "view-area" && tag !== "view--handle" && tag !== "view--corner"
    })

    return nodes.map((node, index) => this._viewSpecFromNode(node, index))
  }

  _instantiateView(spec) {
    const viewNode = document.createElement(spec.tag)
    for (const [name, value] of Object.entries(spec.attrs)) {
      if (name === "setup") continue
      viewNode.setAttribute(name, value)
    }
    // viewNode.innerHTML = spec.innerHTML
    return viewNode
  }

  _createChromeForViewSpec(spec, areaId) {
    const contentId = ++this.contenCounter
    const err = this.api.set_area_content(areaId, contentId)
    if (err !== 0) {
      throw new Error(`set_area_content failed: ${ERR[err] || err}`)
    }

    const viewNode = this._instantiateView(spec)

    const chrome = document.createElement("view-area")
    chrome.appendChild(viewNode)
    this.content.set(contentId, chrome)
    this._addCorners(chrome, areaId)
    this.appendChild(chrome)
    return chrome
  }

  _splitPointForArea(area, axis, percent) {
    const width = area.x1 - area.x0
    const height = area.y1 - area.y0
    const splitX = area.x0 + Math.floor(width * (percent / 100))
    const splitY = area.y0 + Math.floor(height * (percent / 100))

    if (axis === "h") {
      return {
        corner: 0,
        x: splitX,
        y: Math.min(area.y1 - 1, area.y0 + 1),
      }
    }

    return {
      corner: 0,
      x: Math.min(area.x1 - 1, area.x0 + 1),
      y: splitY,
    }
  }

  load(layoutData) {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(`<layout>${layoutData}</layout>`, "text/xml");
    const sourceSpecs = xmlDoc.childNodes[0].childNodes
    const specs = [...sourceSpecs]
      .filter(n => n.nodeType === 1) // ELEMENT_NODE
      .map(n => ({
        tag: n.tagName,
        attrs: Object.fromEntries(
          [...n.attributes].map(attr => [attr.name, attr.value])
        )
      }))
    if (specs.length === 0) {
      throw new Error("root view must be defined")
    }

    if (specs[0].attrs.setup) {
      throw new Error("layout child 0: root view cannot define setup")
    }

    this.handles.length = 0
    this.tryRectEl = null
    this.contenCounter = 0

    this._createChromeForViewSpec(specs[0], 0)

    for (let i = 1; i < specs.length; i += 1) {
      const spec = specs[i]
      const { setup } = spec.attrs
      if (!setup) {
        throw new Error(`layout child ${i}: missing setup`)
      }

      const { target, axis, percent } = this._parseSetup(setup, i)
      const areaCount = header(this.i32).areaCount
      if (target >= areaCount) {
        throw new Error(`layout child ${i}: target ${target} is out of range`)
      }

      const area = this.areaAt(target)
      const newPanel = areaCount
      const split = this._splitPointForArea(area, axis, percent)

      const err = this.api.move_corner(target, split.corner, split.x, split.y)

      if (err !== 0) {
        throw new Error(`layout child ${i}: move_corner failed: ${ERR[err] || err}`)
      }

      this._createChromeForViewSpec(spec, newPanel)
    }

    this.render()
  }

  async _setup(initialLayout) {
    this.memory = new WebAssembly.Memory({
      initial: 288,
      maximum: 512,
      shared: true,
    })

    this.plugin = await window.pluginManager.load({
      name: "layout",
      importObject: { env: { memory: this.memory } },
    })

    this.api = this.plugin.exports
    this.dataPtr = this.api.get_info_ptr()
    this.i32 = new Int32Array(this.memory.buffer, this.dataPtr)

    const width = Math.max(64, Math.floor(this.clientWidth || 0))
    const height = Math.max(64, Math.floor(this.clientHeight || 0))
    const err = this.api.init_screen(width, height, this.handleSize, this.minPanelSize)
    if (err !== 0) {
      throw new Error(`init_screen failed: ${ERR[err] || err}`)
    }

    this.load(initialLayout)
  }

  _addCorners = (node, areaID) => {
    ["nw", "ne", "se", "sw"].forEach((c, cornerId) => {
      // const node = this
      const s = document.createElement("view--corner")
      s.classList.add(c)
      // s.setAttribute("slot", c)
      makeCornerDraggable(this, s, (x, y) => {
        const panel = Number.isFinite(node.panel) ? node.panel : areaID
        this.api.move_corner(panel, cornerId, x, y)
        this._stopCornerPreview()
        this.render()
      }, {
        onStart: (x, y) => {
          const panel = Number.isFinite(node.panel) ? node.panel : areaID
          this._startCornerPreview(panel, cornerId, x, y)
        },
        onMove: (x, y) => {
          this._updateCornerPreview(x, y)
        },
        onCancel: () => {
          this._stopCornerPreview()
          this.render()
        },
      })
      node.appendChild(s)
    })
  }

  _ensureTryRect = () => {
    if (this.tryRectEl) return
    this.tryRectEl = document.createElement("div")
    this.tryRectEl.className = "layout-try-rect"
    this.tryRectEl.style.display = "none"
    this.appendChild(this.tryRectEl)
  }

  _startCornerPreview = (areaIndex, cornerIndex, x, y) => {
    this.cornerDrag.active = true
    this.cornerDrag.areaIndex = areaIndex
    this.cornerDrag.cornerIndex = cornerIndex
    this.cornerDrag.x = x
    this.cornerDrag.y = y
    this.cornerDrag.lastX = Number.NaN
    this.cornerDrag.lastY = Number.NaN
    this._ensureTryRect()
    this._scheduleCornerTry()
  }

  _updateCornerPreview = (x, y) => {
    if (!this.cornerDrag.active) return
    this.cornerDrag.x = x
    this.cornerDrag.y = y
    this._scheduleCornerTry()
  }

  _scheduleCornerTry = () => {
    if (this.cornerDrag.raf !== 0) return
    this.cornerDrag.raf = requestAnimationFrame(() => {
      this.cornerDrag.raf = 0
      if (!this.cornerDrag.active) return
      if (this.cornerDrag.x === this.cornerDrag.lastX && this.cornerDrag.y === this.cornerDrag.lastY) {
        return
      }

      this.api.try_corner(
        this.cornerDrag.areaIndex,
        this.cornerDrag.cornerIndex,
        this.cornerDrag.x,
        this.cornerDrag.y,
      )
      this.cornerDrag.lastX = this.cornerDrag.x
      this.cornerDrag.lastY = this.cornerDrag.y
      this.render()
    })
  }

  _stopCornerPreview = () => {
    this.cornerDrag.active = false
    if (this.cornerDrag.raf !== 0) {
      cancelAnimationFrame(this.cornerDrag.raf)
      this.cornerDrag.raf = 0
    }
    if (this.tryRectEl) {
      this.tryRectEl.style.display = "none"
    }
  }

  handleKeybinding(eventName) {
    switch (eventName) {
      case 'app:settings': {
        const chromes = document.querySelectorAll('view-area')
        let target = chromes[0] || null
        const active = document.activeElement

        for (const chrome of chromes) {
          if (active && chrome.contains(active)) {
            target = chrome
            break
          }
        }

        if (target) {
          target.switchView('view-settings')
        }
        return true
      }
      case 'file:save':
        bus.emit('file:save')
        return true
      case 'app:reload':
        window.location.reload()
        return true
      case 'popup:close': {
        const popupManager = document.querySelector('popup-manager')
        if (popupManager && typeof popupManager.closeTopPopup === 'function') {
          popupManager.closeTopPopup()
          return true
        }
        return false
      }
      default:
        return false
    }
  }

}

class Corner extends HTMLElement { }
customElements.define('view--corner', Corner)

class Handle extends HTMLElement {
  static get observedAttributes() { return ['x', 'y', 'w', 'h', 'panel']; }
  constructor() {
    super();
    this._x = 0;
    this._y = 0;
    this._w = 0;
    this._h = 0;
    this._panel = 0;
  }

  connectedCallback() {
    this.style.position = "absolute"
    this._updatePosition()
  }

  disconnectedCallback() {
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal)
    if (name === 'y') this._y = parseFloat(newVal)
    if (name === 'w') this._w = parseFloat(newVal)
    if (name === 'h') this._h = parseFloat(newVal)
    if (name === 'panel') this._panel = parseFloat(newVal)


    this._updatePosition();
  }

  set x(v) { this.setAttribute('x', v); }
  set y(v) { this.setAttribute('y', v); }
  set w(v) { this.setAttribute('w', v); }
  set h(v) { this.setAttribute('h', v); }
  set panel(v) { this.setAttribute('panel', v); }

  get x() { return this._x; }
  get y() { return this._y; }
  get w() { return this._w; }
  get h() { return this._h; }
  get panel() { return this._panel; }

  _updatePosition() {
    this.style.left = this._x + 'px';
    this.style.top = this._y + 'px';
    this.style.width = this._w + 'px';
    this.style.height = this._h + 'px';
  }
}
customElements.define('view--handle', Handle)

function makeCornerDraggable(host, handleEl, callback, options = {}) {
  handleEl.style.touchAction = "none";
  handleEl.style.userSelect = "none";

  let dragging = false;
  let pointerId = null;
  let startLocalX = 0;
  let startLocalY = 0;


  // Choose a coordinate reference. Often the layout root / host is best.
  // Here we use the custom element instance (`this`) as the local space.

  const toHostLocal = (clientX, clientY) => {
    const r = host.getBoundingClientRect();
    return { x: Math.floor(clientX - r.left), y: Math.floor(clientY - r.top) };
  };

  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
  };

  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const cur = toHostLocal(e.clientX, e.clientY);
    if (typeof options.onMove === "function") {
      options.onMove(cur.x, cur.y)
    }

  };

  const onUp = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;

    dragging = false;

    try { handleEl.releasePointerCapture(pointerId); } catch { }
    cleanup();

    // const client = { x: e.clientX, y: e.clientY };
    const local = toHostLocal(e.clientX, e.clientY);

    callback(local.x, local.y)
    handleEl.style.transform = "translate(0px, 0px)";
  };

  const onCancel = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;

    dragging = false;
    try { handleEl.releasePointerCapture(pointerId); } catch { }
    cleanup();
    handleEl.style.transform = "translate(0px, 0px)";

    if (typeof options.onCancel === "function") {
      options.onCancel()
    }
  }

  handleEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();

    const start = toHostLocal(e.clientX, e.clientY);
    dragging = true;
    pointerId = e.pointerId;
    startLocalX = start.x;
    startLocalY = start.y;

    if (typeof options.onStart === "function") {
      options.onStart(start.x, start.y)
    }

    handleEl.setPointerCapture(pointerId);

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: false });
    window.addEventListener("pointercancel", onCancel, { passive: false });
  });
}

function makeHandleDraggable(host, handleEl, callback) {
  handleEl.style.touchAction = "none"
  handleEl.style.userSelect = "none"

  let dragging = false
  let pointerId = null

  const toHostLocal = (clientX, clientY) => {
    const r = host.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  const cleanup = () => {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
  }

  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return

    const local = toHostLocal(e.clientX, e.clientY)
    callback(local.x, local.y)
  }

  const onUp = (e) => {
    if (!dragging || e.pointerId !== pointerId) return

    dragging = false
    try { handleEl.releasePointerCapture(pointerId) } catch { }
    cleanup()

    const local = toHostLocal(e.clientX, e.clientY)
    callback(local.x, local.y)
  }

  handleEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return

    e.preventDefault()

    dragging = true
    pointerId = e.pointerId
    handleEl.setPointerCapture(pointerId)

    window.addEventListener("pointermove", onMove, { passive: false })
    window.addEventListener("pointerup", onUp, { passive: false })
    window.addEventListener("pointercancel", onUp, { passive: false })
  })
}


function header(v) {
  return {
    initialized: v[0],
    screenW: v[1],
    screenH: v[2],
    maxPanels: v[3],
    maxHandles: v[4],
    areaCount: v[5],
    handleCount: v[6],
    lastError: v[7],
    generation: v[8],
    lastAction: v[9],
    lastIndex: v[10],
    lastX: v[11],
    lastY: v[12],
    handleHalfSize: v[13],
    minPanelSize: v[14],
  }
}


export class ViewChrome extends HTMLElement {
  static get observedAttributes() { return ['x', 'y', 'w', 'h', 'panel'] }

  constructor() {
    super();
    this._x = 0;
    this._y = 0;
    this._w = 0;
    this._h = 0;
    this._panel = 0;

    // The shadow DOM
    const shadowRoot = this.attachShadow({ mode: "open" })
    shadowRoot.innerHTML = `<link rel="stylesheet" href="reset.css">
      <link rel="stylesheet" href="base.css">
      <header part="header">
        <select part="view-select" name="view" data-action="select-view" class="view-selector"></select>
        <slot name="header-controls"></slot>
      </header>
      <article><slot></slot></article>`
  }

  connectedCallback() {
    const content = this.shadowRoot
    ensureThemeStylesheetLink(this.shadowRoot)
    if (typeof window.__syncThemeStylesheetToRoot === 'function') {
      window.__syncThemeStylesheetToRoot(this.shadowRoot)
    }
    this._setupViewSelector(content)

    // Set position style
    this.style.position = "absolute"
    this._updatePosition()
  }

  disconnectedCallback() {
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal)
    if (name === 'y') this._y = parseFloat(newVal)
    if (name === 'w') this._w = parseFloat(newVal)
    if (name === 'h') this._h = parseFloat(newVal)
    if (name === 'panel') this._panel = parseFloat(newVal)


    this._updatePosition();
  }

  set x(v) { this.setAttribute('x', v); }
  set y(v) { this.setAttribute('y', v); }
  set w(v) { this.setAttribute('w', v); }
  set h(v) { this.setAttribute('h', v); }
  set panel(v) { this.setAttribute('panel', v); }

  get x() { return this._x; }
  get y() { return this._y; }
  get w() { return this._w; }
  get h() { return this._h; }
  get panel() { return this._panel; }

  _updatePosition() {
    this.style.left = this._x + 'px';
    this.style.top = this._y + 'px';
    this.style.width = this._w + 'px';
    this.style.height = this._h + 'px';
  }

  /**
   * Switch to a different view type
   * @param {string} viewTag - Tag name of new view (e.g., 'view-nodegraph')
   */
  switchView(viewTag) {
    const currentView = this.shadowRoot.querySelector('slot:not([name])').assignedElements()[0] || null

    // Create new view
    const newView = document.createElement(viewTag)

    // Replace in DOM
    if (currentView) {
      this.replaceChild(newView, currentView)
    } else {
      this.appendChild(newView)
    }
  }

  _setupViewSelector(content) {
    const select = content.querySelector('[data-action="select-view"]');

    // Populate from view registry if ready, otherwise wait for the event
    if (window.viewLoader && window.viewLoader.registry.size > 0) {
      this._populateViewSelector(select)
    }

    bus.on('views:registry-ready', () => {
      this._populateViewSelector(select)
    })

    select.addEventListener("change", (event) => {
      this.switchView(event.target.value);
    });
  }

  /**
   * Populate the view selector dropdown from the ViewLoader registry
   * Groups views by category into optgroup elements
   */
  _populateViewSelector(select) {
    const currentView = this.shadowRoot.querySelector('slot:not([name])').assignedElements()[0] || null
    const currentTag = currentView ? currentView.tagName.toLowerCase() : null

    // Clear existing options
    select.innerHTML = ''

    // Get grouped views from the registry
    const groups = window.viewLoader.getGroupedViews()

    // Define a preferred category order
    const categoryOrder = ['Canvas', 'OPR', 'Data', 'Utilities', 'Sprites', 'Tiles', 'Animation', 'System']

    // Sort groups: known categories first in order, then any others alphabetically
    const sortedCategories = [...groups.keys()].sort((a, b) => {
      const ia = categoryOrder.indexOf(a)
      const ib = categoryOrder.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })

    for (const category of sortedCategories) {
      const views = groups.get(category)
      const optgroup = document.createElement('optgroup')
      optgroup.label = category

      for (const view of views) {
        const option = document.createElement('option')
        option.value = view.tag
        option.textContent = view.displayName
        optgroup.appendChild(option)
      }

      select.appendChild(optgroup)
    }

    // Restore current selection
    if (currentTag) {
      select.value = currentTag
    }
  }

}

customElements.define('view-area', ViewChrome);
