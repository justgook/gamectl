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

export class LayoutManager extends HTMLElement {
  constructor() {
    super()
    this.handleSize = 20
    this.minPanelSize = 200
    this.content = new Map()
    this.counter = 0

    this._observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.tagName === 'VIEW-CHROME') {
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

    this._themeObserver = new MutationObserver(() => {
      this._scheduleHandleSizeSync()
    })

  }

  connectedCallback() {
    this._observer.observe(this, { childList: true })
    this._resizeObserver.observe(this)
    bus.on('plugin-manager:ready', () => {
      this._setup().then(this.render).catch((error) => {
        console.error("[layout] boot failed:", error)
      })
    })
  }

  _onChildAdded() {
    console.log("_onChildAdded")
  }

  _onResized = (w, h) => {
    if (!this.api) return
    this.api.resize_screen(w, h, this.handleSize)
    this.render()
  }

  _scheduleHandleSizeSync() {
    console.log("_scheduleHandleSizeSync")
  }

  render = () => {
    const h = header(this.i32)
    for (let i = 0; i < h.handleCount; i += 1) { console.log("[layout] render handle") }
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
    }
    wasContent.forEach(c => {
      this.removeChild(this.content.get(c))
      this.content.delete(c)
    })
    console.log("WAS CONTENT", wasContent, h)

  }

  spawnChrome = (node, areaId) => {
    const contentId = ++this.counter
    this.api.set_area_content(areaId, contentId)
    const currentView = node.shadowRoot?.querySelector("slot:not([name])")?.assignedElements?.()[0] || null
    const viewTag = currentView ? currentView.tagName.toLowerCase() : "view-empty"
    const chrome = document.createElement("view-chrome")
    chrome.appendChild(document.createElement(viewTag))
    this.content.set(contentId, chrome)
    this._addCorners(chrome, areaId)
    this.appendChild(chrome)
    // chrome.setAttribute("panel", areaId)
    chrome.panel = areaId
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
      console.log(node.querySelectorAll("ne"))
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

