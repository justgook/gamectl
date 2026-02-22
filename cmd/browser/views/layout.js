import { bus } from "../systems/event-bus.js"

const ABI = {
  HEADER_I32: 15,
  AREA_I32: 5,
  HANDLE_I32: 5,
  MAX_PANELS: 16,
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
  constructor() {
    super()
    this.handleSize = 20
    this.minPanelSize = 200
    this.content = new Map()
    this.contenCounter = 0
    this.handles = []

    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this) {
          const { width, height } = entry.contentRect
          this._onResized(width, height)
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
    this._resizeObserver.observe(this)

    const link = document.querySelector('link[data-theme-stylesheet]')
    this._themeObserver.observe(link, { attributes: true, attributeFilter: ['href'] })


    bus.on('plugin-manager:ready', () => {
      this._setup().then(this._scheduleHandleSizeSync).catch((error) => {
        console.error("[layout] boot failed:", error)
      })
    })
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect()
    this._themeObserver.disconnect()
  }


  _onResized = (w, h) => {
    if (!this.api) return
    this.api.resize_screen(w, h, this.handleSize)
    this.render()
  }

  _scheduleHandleSizeSync = () => {
    if (this._syncQueued) {
      return
    }

    this._syncQueued = true
    queueMicrotask(() => {
      this._syncQueued = false
      this.handleSize = parseFloat(getComputedStyle(this).getPropertyValue(HANDLE_SIZE_VAR) || 12)
      this.render()
    })
  }

  render = () => {
    const h = header(this.i32)
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
  }

  spawnHandle = () => {
    const node = document.createElement("view--handle")
    this.handles.push(node)
    this.appendChild(node)

    return node
  }
  spawnChrome = (node, areaId) => {
    const contentId = ++this.contenCounter
    this.api.set_area_content(areaId, contentId)
    const currentView = node.shadowRoot?.querySelector("slot:not([name])")?.assignedElements?.()[0] || null
    const viewTag = currentView ? currentView.tagName.toLowerCase() : "view-empty"
    const chrome = document.createElement("view-chrome")
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

  async _setup() {
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
    for (const [i, node] of this.querySelectorAll("view-chrome").entries()) {
      this.content.set(i, node)
      this._addCorners(node, i)
      console.warn("[layout] add parsing initial node", node)
    }
  }

  _addCorners = (node, areaID) => {
    ["nw", "ne", "se", "sw"].forEach((c, cornerId) => {
      const s = document.createElement("span")
      s.setAttribute("slot", c)
      makeCornerDraggable(this, s, (x, y) => {
        this.api.move_corner(areaID, cornerId, x, y)
        this.render()
      })
      node.appendChild(s)
    })
  }

}

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



function makeCornerDraggable(host, handleEl, callback) {
  // console.log("BBBBBB", corner, content_id)
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
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;

    // Optional: show visual drag feedback (purely cosmetic)
    const cur = toHostLocal(e.clientX, e.clientY);
    const dx = cur.x - startLocalX;
    const dy = cur.y - startLocalY;

    handleEl.style.transform = `translate(${dx}px, ${dy}px)`;
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

  handleEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();

    const start = toHostLocal(e.clientX, e.clientY);
    dragging = true;
    pointerId = e.pointerId;
    startLocalX = start.x;
    startLocalY = start.y;

    handleEl.setPointerCapture(pointerId);

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: false });
    window.addEventListener("pointercancel", onUp, { passive: false });
  });
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

