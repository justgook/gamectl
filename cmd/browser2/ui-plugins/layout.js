const ABI = {
  HEADER_I32: 15,
  AREA_I32: 5,
  HANDLE_I32: 5,
  MAX_PANELS: 16,
  MAX_HANDLES: 15,
  TRY_I32: 5,
}

function encodeResult(value) {
  return {
    returnCode: 0,
    output: new TextEncoder().encode(JSON.stringify(value ?? null)),
  }
}

function decodeBytes(bytes) {
  return new TextDecoder().decode(bytes)
}

function readI32String(result) {
  return Number(decodeBytes(result.output || new Uint8Array()))
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

export class ViewEmpty extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'
    this.style.display = 'grid'
    this.style.placeItems = 'center'
    this.style.minHeight = '100%'
    this.style.padding = '16px'
    this.style.color = 'var(--text-muted)'
    this.innerHTML = `
      <div style="text-align:center; display:grid; gap:8px;">
        <strong style="color:var(--text);">view-empty</strong>
        <span>placeholder content</span>
      </div>
    `
  }
}

export class ViewArea extends HTMLElement {
  static get observedAttributes() { return ['x', 'y', 'w', 'h', 'panel'] }

  constructor() {
    super()
    this._x = 0
    this._y = 0
    this._w = 0
    this._h = 0
    this._panel = 0
  }

  connectedCallback() {
    if (!this.dataset.ready) {
      this.dataset.ready = '1'
      this.style.position = 'absolute'
      this.innerHTML = `
        <header style="display:flex; align-items:center; justify-content:space-between; min-height:32px; padding:6px 10px; border-bottom:1px solid var(--border); color:var(--text-muted);">
          <strong data-role="title" style="font-size:12px;">view-empty</strong>
        </header>
        <article data-role="body" style="position:absolute; inset:33px 0 0 0; overflow:hidden;"></article>
      `
      this.ensureContent()
    }
    this.updateTitle()
    this._updatePosition()
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal)
    if (name === 'y') this._y = parseFloat(newVal)
    if (name === 'w') this._w = parseFloat(newVal)
    if (name === 'h') this._h = parseFloat(newVal)
    if (name === 'panel') this._panel = parseFloat(newVal)
    this._updatePosition()
    this.updateTitle()
  }

  ensureContent() {
    const body = this.querySelector('[data-role="body"]')
    if (!body) return
    if (!body.firstElementChild) {
      body.appendChild(document.createElement('view-empty'))
    }
  }

  updateTitle() {
    const title = this.querySelector('[data-role="title"]')
    if (title) title.textContent = `panel ${this._panel}`
  }

  _updatePosition() {
    this.style.left = `${this._x}px`
    this.style.top = `${this._y}px`
    this.style.width = `${this._w}px`
    this.style.height = `${this._h}px`
  }

  set x(v) { this.setAttribute('x', v) }
  set y(v) { this.setAttribute('y', v) }
  set w(v) { this.setAttribute('w', v) }
  set h(v) { this.setAttribute('h', v) }
  set panel(v) { this.setAttribute('panel', v) }
}

class Corner extends HTMLElement {}
class Handle extends HTMLElement {
  static get observedAttributes() { return ['x', 'y', 'w', 'h', 'panel'] }

  constructor() {
    super()
    this._x = 0
    this._y = 0
    this._w = 0
    this._h = 0
    this._panel = 0
  }

  connectedCallback() {
    this.style.position = 'absolute'
    this._updatePosition()
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal)
    if (name === 'y') this._y = parseFloat(newVal)
    if (name === 'w') this._w = parseFloat(newVal)
    if (name === 'h') this._h = parseFloat(newVal)
    if (name === 'panel') this._panel = parseFloat(newVal)
    this._updatePosition()
  }

  _updatePosition() {
    this.style.left = `${this._x}px`
    this.style.top = `${this._y}px`
    this.style.width = `${this._w}px`
    this.style.height = `${this._h}px`
  }

  set x(v) { this.setAttribute('x', v) }
  set y(v) { this.setAttribute('y', v) }
  set w(v) { this.setAttribute('w', v) }
  set h(v) { this.setAttribute('h', v) }
  set panel(v) { this.setAttribute('panel', v) }
}

export class UiLayout extends HTMLElement {
  constructor() {
    super()
    this.runtime = null
    this.buffer = null
    this.ptr = 0
    this.size = 0
    this.i32 = null
    this.handleSize = 12
    this.minPanelSize = 120
    this.content = new Map()
    this.contentCounter = 0
    this.handles = []
    this.lastGeneration = -1
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
    this.api = {
      refresh: async () => {
        await this.refresh()
        return encodeResult({ ok: true, generation: this.lastGeneration })
      },
      ping: async () => encodeResult({ ok: true, generation: this.lastGeneration }),
    }
    this.resizeObserver = new ResizeObserver(async (entries) => {
      if (!this.runtime) return
      for (const entry of entries) {
        if (entry.target !== this) continue
        const width = Math.max(64, Math.floor(entry.contentRect.width || 0))
        const height = Math.max(64, Math.floor(entry.contentRect.height || 0))
        if (!width || !height) continue
        if (!this.i32 || !header(this.i32).initialized) continue
        await this.runtime.call('layout', 'resize_screen', `${width},${height},${this.handleSize}`)
        await this.refresh()
      }
    })
  }

  connectedCallback() {
    this.style.position = 'fixed'
    this.style.inset = '0'
    this.style.display = 'block'
    this.style.overflow = 'hidden'
    this.style.background = 'var(--bg)'
    this.resizeObserver.observe(this)
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect()
    this.stopCornerPreview()
  }

  async bindRuntime(runtime) {
    this.runtime = runtime
    this.buffer = await runtime.memory('layout')
    this.size = readI32String(await runtime.call('layout', 'get_info_size', ''))
    this.ptr = readI32String(await runtime.call('layout', 'get_info_ptr', ''))
    this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))

    const width = Math.max(64, Math.floor(this.clientWidth || window.innerWidth || 0))
    const height = Math.max(64, Math.floor(this.clientHeight || window.innerHeight || 0))
    if (!header(this.i32).initialized) {
      await this.runtime.call('layout', 'init_screen', `${width},${height},${this.handleSize},${this.minPanelSize}`)
      this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))
    }
    await this.ensureAreaContentIds()
    this.render()
  }

  areaAt(index) {
    const base = ABI.HEADER_I32 + index * ABI.AREA_I32
    const v = this.i32
    return { x0: v[base], y0: v[base + 1], x1: v[base + 2], y1: v[base + 3], content: v[base + 4] }
  }

  handleAt(index) {
    const handleBase = ABI.HEADER_I32 + ABI.MAX_PANELS * ABI.AREA_I32
    const base = handleBase + index * ABI.HANDLE_I32
    const v = this.i32
    return { x0: v[base], y0: v[base + 1], x1: v[base + 2], y1: v[base + 3], content: v[base + 4] }
  }

  tryRect() {
    const base = ABI.HEADER_I32 + ABI.MAX_PANELS * ABI.AREA_I32 + ABI.MAX_HANDLES * ABI.HANDLE_I32
    const v = this.i32
    return { valid: v[base], x0: v[base + 1], y0: v[base + 2], x1: v[base + 3], y1: v[base + 4] }
  }

  async ensureAreaContentIds() {
    const h = header(this.i32)
    for (let areaId = 0; areaId < h.areaCount; areaId += 1) {
      const area = this.areaAt(areaId)
      if (area.content !== 0) continue
      const contentId = ++this.contentCounter
      await this.runtime.call('layout', 'set_area_content', `${areaId},${contentId}`)
    }
    this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))
  }

  ensureTryRect() {
    if (this.tryRectEl) return
    this.tryRectEl = document.createElement('div')
    this.tryRectEl.className = 'layout-try-rect'
    this.tryRectEl.style.display = 'none'
    this.appendChild(this.tryRectEl)
  }

  startCornerPreview(areaIndex, cornerIndex, x, y) {
    this.cornerDrag.active = true
    this.cornerDrag.areaIndex = areaIndex
    this.cornerDrag.cornerIndex = cornerIndex
    this.cornerDrag.x = x
    this.cornerDrag.y = y
    this.cornerDrag.lastX = Number.NaN
    this.cornerDrag.lastY = Number.NaN
    this.ensureTryRect()
    this.scheduleCornerTry()
  }

  updateCornerPreview(x, y) {
    if (!this.cornerDrag.active) return
    this.cornerDrag.x = x
    this.cornerDrag.y = y
    this.scheduleCornerTry()
  }

  scheduleCornerTry() {
    if (this.cornerDrag.raf !== 0) return
    this.cornerDrag.raf = requestAnimationFrame(async () => {
      this.cornerDrag.raf = 0
      if (!this.cornerDrag.active) return
      if (this.cornerDrag.x === this.cornerDrag.lastX && this.cornerDrag.y === this.cornerDrag.lastY) return
      await this.runtime.call('layout', 'try_corner', `${this.cornerDrag.areaIndex},${this.cornerDrag.cornerIndex},${this.cornerDrag.x},${this.cornerDrag.y}`)
      this.cornerDrag.lastX = this.cornerDrag.x
      this.cornerDrag.lastY = this.cornerDrag.y
      this.render()
    })
  }

  stopCornerPreview() {
    this.cornerDrag.active = false
    if (this.cornerDrag.raf !== 0) {
      cancelAnimationFrame(this.cornerDrag.raf)
      this.cornerDrag.raf = 0
    }
    if (this.tryRectEl) this.tryRectEl.style.display = 'none'
  }

  spawnHandle() {
    const node = document.createElement('view--handle')
    makeHandleDraggable(this, node, async (x, y) => {
      await this.runtime.call('layout', 'move_handle', `${node.getAttribute('panel')},${Math.floor(x)},${Math.floor(y)}`)
      await this.refresh()
    })
    this.handles.push(node)
    this.appendChild(node)
    return node
  }

  ensureChrome(areaId, contentId) {
    let chrome = this.content.get(contentId)
    if (chrome) return chrome
    chrome = document.createElement('view-area')
    chrome.panel = areaId
    this.addCorners(chrome, areaId)
    this.content.set(contentId, chrome)
    this.appendChild(chrome)
    return chrome
  }

  addCorners(node, areaId) {
    ;['nw', 'ne', 'se', 'sw'].forEach((c, cornerId) => {
      const s = document.createElement('view--corner')
      s.classList.add(c)
      makeCornerDraggable(this, s, async (x, y) => {
        const panel = Number.isFinite(Number(node.getAttribute('panel'))) ? Number(node.getAttribute('panel')) : areaId
        await this.runtime.call('layout', 'move_corner', `${panel},${cornerId},${Math.floor(x)},${Math.floor(y)}`)
        await this.ensureAreaContentIds()
        this.stopCornerPreview()
        await this.refresh()
      }, {
        onStart: (x, y) => {
          const panel = Number.isFinite(Number(node.getAttribute('panel'))) ? Number(node.getAttribute('panel')) : areaId
          this.startCornerPreview(panel, cornerId, x, y)
        },
        onMove: (x, y) => this.updateCornerPreview(x, y),
        onCancel: () => {
          this.stopCornerPreview()
          this.render()
        },
      })
      node.appendChild(s)
    })
  }

  render() {
    if (!this.i32) return
    const h = header(this.i32)
    const tr = this.tryRect()
    const activeContent = new Set()

    for (let areaId = 0; areaId < h.areaCount; areaId += 1) {
      const area = this.areaAt(areaId)
      const contentId = area.content || areaId + 1
      const node = this.ensureChrome(areaId, contentId)
      activeContent.add(contentId)
      node.x = area.x0
      node.y = area.y0
      node.w = area.x1 - area.x0
      node.h = area.y1 - area.y0
      node.panel = areaId
    }

    for (const [contentId, node] of [...this.content.entries()]) {
      if (activeContent.has(contentId)) continue
      node.remove()
      this.content.delete(contentId)
    }

    while (this.handles.length < h.handleCount) this.spawnHandle()
    for (let id = 0; id < h.handleCount; id += 1) {
      const item = this.handleAt(id)
      const node = this.handles[id]
      node.x = item.x0
      node.y = item.y0
      node.w = item.x1 - item.x0
      node.h = item.y1 - item.y0
      node.panel = id
    }
    for (let i = h.handleCount; i < this.handles.length; i += 1) this.handles[i]?.remove()
    this.handles.length = h.handleCount

    if (this.cornerDrag.active && tr.valid) {
      this.ensureTryRect()
      this.tryRectEl.style.display = 'block'
      this.tryRectEl.style.left = `${tr.x0}px`
      this.tryRectEl.style.top = `${tr.y0}px`
      this.tryRectEl.style.width = `${Math.max(1, tr.x1 - tr.x0)}px`
      this.tryRectEl.style.height = `${Math.max(1, tr.y1 - tr.y0)}px`
    } else if (this.tryRectEl) {
      this.tryRectEl.style.display = 'none'
    }

    this.lastGeneration = h.generation
  }

  async refresh() {
    if (!this.runtime) throw new Error('ui.layout is not bound to runtime')
    const nextPtr = readI32String(await this.runtime.call('layout', 'get_info_ptr', ''))
    if (nextPtr !== this.ptr || !this.i32) {
      this.ptr = nextPtr
      this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))
    }
    this.render()
  }
}

function makeCornerDraggable(host, handleEl, callback, options = {}) {
  handleEl.style.touchAction = 'none'
  handleEl.style.userSelect = 'none'
  let dragging = false
  let pointerId = null

  const toHostLocal = (clientX, clientY) => {
    const r = host.getBoundingClientRect()
    return { x: Math.floor(clientX - r.left), y: Math.floor(clientY - r.top) }
  }

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
  }

  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return
    const cur = toHostLocal(e.clientX, e.clientY)
    if (typeof options.onMove === 'function') options.onMove(cur.x, cur.y)
  }

  const onUp = (e) => {
    if (!dragging || e.pointerId !== pointerId) return
    dragging = false
    try { handleEl.releasePointerCapture(pointerId) } catch {}
    cleanup()
    const local = toHostLocal(e.clientX, e.clientY)
    callback(local.x, local.y)
  }

  const onCancel = (e) => {
    if (!dragging || e.pointerId !== pointerId) return
    dragging = false
    try { handleEl.releasePointerCapture(pointerId) } catch {}
    cleanup()
    if (typeof options.onCancel === 'function') options.onCancel()
  }

  handleEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    dragging = true
    pointerId = e.pointerId
    const start = toHostLocal(e.clientX, e.clientY)
    if (typeof options.onStart === 'function') options.onStart(start.x, start.y)
    handleEl.setPointerCapture(pointerId)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp, { passive: false })
    window.addEventListener('pointercancel', onCancel, { passive: false })
  })
}

function makeHandleDraggable(host, handleEl, callback) {
  handleEl.style.touchAction = 'none'
  handleEl.style.userSelect = 'none'
  let dragging = false
  let pointerId = null

  const toHostLocal = (clientX, clientY) => {
    const r = host.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return
    const local = toHostLocal(e.clientX, e.clientY)
    callback(local.x, local.y)
  }

  const onUp = (e) => {
    if (!dragging || e.pointerId !== pointerId) return
    dragging = false
    try { handleEl.releasePointerCapture(pointerId) } catch {}
    cleanup()
    const local = toHostLocal(e.clientX, e.clientY)
    callback(local.x, local.y)
  }

  handleEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    dragging = true
    pointerId = e.pointerId
    handleEl.setPointerCapture(pointerId)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp, { passive: false })
    window.addEventListener('pointercancel', onUp, { passive: false })
  })
}

if (!customElements.get('view-empty')) customElements.define('view-empty', ViewEmpty)
if (!customElements.get('view-area')) customElements.define('view-area', ViewArea)
if (!customElements.get('view--corner')) customElements.define('view--corner', Corner)
if (!customElements.get('view--handle')) customElements.define('view--handle', Handle)
if (!customElements.get('ui-layout')) customElements.define('ui-layout', UiLayout)
