const ABI = {
  HEADER_I32: 15,
  AREA_I32: 5,
  HANDLE_I32: 5,
  MAX_PANELS: 16,
  MAX_HANDLES: 15,
  TRY_I32: 5,
}

const ERR = {
  0: 'ok',
  1: 'not_initialized',
  2: 'invalid_arg',
  3: 'invalid_handle',
  4: 'invalid_area',
  5: 'invalid_corner',
  6: 'out_of_bounds',
  7: 'min_size',
  8: 'not_implemented',
  9: 'capacity',
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

function decodeInput(input) {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return new TextDecoder().decode(input)
  if (ArrayBuffer.isView(input)) {
    return new TextDecoder().decode(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
  }
  return String(input ?? '')
}

function parseLayoutInput(input) {
  if (typeof input === 'string') return input
  if (input == null) return ''
  if (typeof input === 'object' && !(input instanceof Uint8Array) && !ArrayBuffer.isView(input)) {
    if (typeof input.layout === 'string') return input.layout
    return String(input.layoutMarkup || '')
  }
  const text = decodeInput(input)
  if (!text) return ''
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'string') return parsed
    if (parsed && typeof parsed.layout === 'string') return parsed.layout
    if (parsed && typeof parsed.layoutMarkup === 'string') return parsed.layoutMarkup
  } catch { }
  return text
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
    this.style.display = 'grid'
    this.style.placeItems = 'center'
    this.style.minHeight = '100%'
    this.style.padding = '16px'
    this.style.color = 'var(--text-muted)'
    const label = this.getAttribute('data-view-label') || 'Empty'
    const tag = this.getAttribute('data-view-tag') || 'view-empty'
    this.innerHTML = `
      <div style="text-align:center; display:grid; gap:8px;">
        <strong style="color:var(--text);">${label}</strong>
        <span>${tag}</span>
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
    this._selectorReady = false

    const shadowRoot = this.attachShadow({ mode: 'open' })
    shadowRoot.innerHTML = `<link rel="stylesheet" href="reset.css">
      <link rel="stylesheet" href="base.css">
      <header part="header">
        <select part="view-select" name="view" data-action="select-view" class="view-selector"></select>
        <slot name="header-controls"></slot>
      </header>
      <main><slot></slot></main>`
  }

  connectedCallback() {
    this.setupViewSelector()
    this._updatePosition()
    this.refreshViewSelector()
    ensureThemeStylesheetLink(this.shadowRoot)

    // Set position style
    this.style.position = "absolute"
  }

  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'x') this._x = parseFloat(newVal)
    if (name === 'y') this._y = parseFloat(newVal)
    if (name === 'w') this._w = parseFloat(newVal)
    if (name === 'h') this._h = parseFloat(newVal)
    if (name === 'panel') this._panel = parseFloat(newVal)
    this._updatePosition()
  }

  set x(v) { this.setAttribute('x', v) }
  set y(v) { this.setAttribute('y', v) }
  set w(v) { this.setAttribute('w', v) }
  set h(v) { this.setAttribute('h', v) }
  set panel(v) { this.setAttribute('panel', v) }

  get x() { return this._x; }
  get y() { return this._y; }
  get w() { return this._w; }
  get h() { return this._h; }
  get panel() { return this._panel; }

  getCurrentView() {
    return this.shadowRoot.querySelector('slot:not([name])')?.assignedElements?.()[0] || this.firstElementChild || null
  }

  getCurrentViewTag() {
    const currentView = this.getCurrentView()
    if (!currentView) return 'view-empty'
    return currentView.getAttribute('data-view-tag') || currentView.tagName.toLowerCase()
  }

  requireOwner() {
    if (!this.owner) {
      throw new Error('view-area owner is not set')
    }
    return this.owner
  }

  setView(viewNode) {
    const currentView = this.getCurrentView()
    if (currentView) this.replaceChild(viewNode, currentView)
    else this.appendChild(viewNode)
    this.refreshViewSelector()
  }

  switchView(viewTag) {
    const owner = this.requireOwner()
    const newView = owner.createView(viewTag)
    this.setView(newView)
  }

  setupViewSelector() {
    if (this._selectorReady) return
    this._selectorReady = true
    const select = this.shadowRoot.querySelector('[data-action="select-view"]')
    select.addEventListener('change', (event) => {
      if (event.target.value) this.switchView(event.target.value)
    })
  }

  refreshViewSelector() {
    const select = this.shadowRoot.querySelector('[data-action="select-view"]')
    if (!select) return

    const currentTag = this.getCurrentViewTag()
    const options = new Map()
    options.set('view-empty', 'view-empty')
    options.set(currentTag, currentTag)

    const owner = this.requireOwner()
    for (const view of owner.listViews()) {
      options.set(view.tag, view.label || view.tag)
    }

    select.innerHTML = ''
    for (const [tag, label] of options.entries()) {
      const option = document.createElement('option')
      option.value = tag
      option.textContent = label
      select.appendChild(option)
    }
    select.value = currentTag
  }

  _updatePosition() {
    this.style.left = `${this._x}px`
    this.style.top = `${this._y}px`
    this.style.width = `${this._w}px`
    this.style.height = `${this._h}px`
  }
}

class Corner extends HTMLElement { }

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

  set x(v) { this.setAttribute('x', v) }
  set y(v) { this.setAttribute('y', v) }
  set w(v) { this.setAttribute('w', v) }
  set h(v) { this.setAttribute('h', v) }
  set panel(v) { this.setAttribute('panel', v) }

  get x() { return this._x; }
  get y() { return this._y; }
  get w() { return this._w; }
  get h() { return this._h; }
  get panel() { return this._panel; }

  _updatePosition() {
    this.style.left = `${this._x}px`
    this.style.top = `${this._y}px`
    this.style.width = `${this._w}px`
    this.style.height = `${this._h}px`
  }
}

export class UiLayout extends HTMLElement {
  constructor() {
    super()
    this.runtime = null
    this.viewRegistry = new Map()
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
      load: async (input) => {
        await this.load(parseLayoutInput(input))
        return encodeResult({ ok: true, generation: this.lastGeneration })
      },
    }
    this.resizeObserver = new ResizeObserver(async (entries) => {
      if (!this.runtime) return
      for (const entry of entries) {
        if (entry.target !== this) continue
        const width = Math.max(64, Math.floor(entry.contentRect.width || 0))
        const height = Math.max(64, Math.floor(entry.contentRect.height || 0))
        if (!width || !height) continue
        if (!this.i32 || !header(this.i32).initialized) continue
        await this.resizeScreen(width, height, this.handleSize)
        await this.refresh()
      }
    })
  }

  connectedCallback() {
    this.style.isolation = "isolate"
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
      await this.initScreen(width, height, this.handleSize, this.minPanelSize)
      this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))
    }
    await this.ensureAreaContentIds()
    this.render()
  }

  async callLayout(method, input = '') {
    if (!this.runtime) throw new Error('ui.layout is not bound to runtime')
    return await this.runtime.call('layout', method, input)
  }

  async callLayoutCode(method, input = '') {
    const result = await this.callLayout(method, input)
    const code = Number(result?.returnCode || 0)
    if (code !== 0) {
      throw new Error(`${method} failed: ${ERR[code] || code}`)
    }
    return result
  }

  async initScreen(width, height, handleSize, minPanelSize) {
    await this.callLayoutCode('init_screen', `${width},${height},${handleSize},${minPanelSize}`)
  }

  async resizeScreen(width, height, handleSize) {
    await this.callLayoutCode('resize_screen', `${width},${height},${handleSize}`)
  }

  clampPoint(x, y, inclusiveMax = false) {
    if (!this.i32) {
      return { x: Math.floor(x), y: Math.floor(y) }
    }
    const h = header(this.i32)
    const maxX = inclusiveMax ? h.screenW : Math.max(0, h.screenW - 1)
    const maxY = inclusiveMax ? h.screenH : Math.max(0, h.screenH - 1)
    return {
      x: Math.max(0, Math.min(maxX, Math.floor(x))),
      y: Math.max(0, Math.min(maxY, Math.floor(y))),
    }
  }

  async moveHandle(handleIndex, x, y) {
    const p = this.clampPoint(x, y, true)
    await this.callLayoutCode('move_handle', `${handleIndex},${p.x},${p.y}`)
  }

  async moveCorner(areaIndex, cornerIndex, x, y) {
    const p = this.clampPoint(x, y, false)
    await this.callLayoutCode('move_corner', `${areaIndex},${cornerIndex},${p.x},${p.y}`)
  }

  async tryCorner(areaIndex, cornerIndex, x, y) {
    const p = this.clampPoint(x, y, false)
    await this.callLayout('try_corner', `${areaIndex},${cornerIndex},${p.x},${p.y}`)
  }

  async setAreaContent(areaIndex, contentId) {
    await this.callLayoutCode('set_area_content', `${areaIndex},${contentId}`)
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

  normalizeViewRegistry(registry) {
    if (registry instanceof Map) return new Map(registry)
    return new Map(Object.entries(registry || {}))
  }

  setViewRegistry(registry) {
    this.viewRegistry = this.normalizeViewRegistry(registry)
    for (const chrome of this.content.values()) {
      chrome.refreshViewSelector?.()
    }
  }

  getViewEntry(tag) {
    return this.viewRegistry.get(tag) || null
  }

  listViews() {
    return [...this.viewRegistry.entries()].map(([tag, entry]) => ({
      tag,
      label: entry?.label || tag,
    }))
  }

  createView(tag, attrs = {}, innerHTML = '') {
    const entry = this.getViewEntry(tag)
    const viewNode = typeof entry?.create === 'function'
      ? entry.create({ tag, attrs, innerHTML, layout: this })
      : document.createElement(tag)
    for (const [name, value] of Object.entries(attrs || {})) {
      if (name === 'setup') continue
      if (!viewNode.hasAttribute?.(name)) viewNode.setAttribute?.(name, value)
    }
    if (innerHTML && !viewNode.innerHTML) viewNode.innerHTML = innerHTML
    return viewNode
  }

  instantiateView(spec) {
    const viewNode = this.createView(spec.tag, spec.attrs || {}, spec.innerHTML || '')
    for (const [name, value] of Object.entries(spec.attrs || {})) {
      if (name === 'setup') continue
      viewNode.setAttribute(name, value)
    }
    viewNode.innerHTML = spec.innerHTML || ''
    return viewNode
  }

  cloneViewNode(node) {
    const clone = this.createView(node.tagName.toLowerCase())
    for (const attr of Array.from(node.attributes || [])) {
      clone.setAttribute(attr.name, attr.value)
    }
    clone.innerHTML = node.innerHTML || ''
    return clone
  }

  createChromeForViewNode(viewNode, areaId, contentId) {
    const chrome = document.createElement('view-area')
    chrome.owner = this
    chrome.panel = areaId
    chrome.appendChild(viewNode)
    chrome.refreshViewSelector()
    this.addCorners(chrome, areaId)
    this.content.set(contentId, chrome)
    this.appendChild(chrome)
    return chrome
  }

  async createChromeForViewSpec(spec, areaId) {
    const contentId = ++this.contentCounter
    await this.setAreaContent(areaId, contentId)
    const viewNode = this.instantiateView(spec)
    return this.createChromeForViewNode(viewNode, areaId, contentId)
  }

  async ensureAreaContentIds() {
    const h = header(this.i32)
    const seen = new Set()
    const pendingClones = []

    for (let areaId = 0; areaId < h.areaCount; areaId += 1) {
      const area = this.areaAt(areaId)
      const duplicate = area.content !== 0 && seen.has(area.content)
      if (area.content === 0 || duplicate) {
        const nextContentId = ++this.contentCounter
        await this.setAreaContent(areaId, nextContentId)
        if (duplicate) {
          pendingClones.push({
            oldContentId: area.content,
            newContentId: nextContentId,
            areaId,
          })
        }
      } else {
        seen.add(area.content)
        if (area.content > this.contentCounter) this.contentCounter = area.content
      }
    }

    this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))

    for (const cloneInfo of pendingClones) {
      const sourceChrome = this.content.get(cloneInfo.oldContentId)
      const sourceView = sourceChrome?.getCurrentView?.() || sourceChrome?.firstElementChild || null
      const cloneView = sourceView ? this.cloneViewNode(sourceView) : document.createElement('view-empty')
      this.createChromeForViewNode(cloneView, cloneInfo.areaId, cloneInfo.newContentId)
    }
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
      await this.tryCorner(this.cornerDrag.areaIndex, this.cornerDrag.cornerIndex, this.cornerDrag.x, this.cornerDrag.y)
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
      await this.moveHandle(node.panel, x, y)
      await this.refresh()
    })
    this.handles.push(node)
    this.appendChild(node)
    return node
  }

  ensureChrome(areaId, contentId) {
    let chrome = this.content.get(contentId)
    if (chrome) return chrome
    chrome = this.createChromeForViewNode(this.createView('view-empty'), areaId, contentId)
    return chrome
  }

  addCorners(node, areaId) {
    if (node.dataset.cornersReady) return
    node.dataset.cornersReady = '1'
      ;['nw', 'ne', 'se', 'sw'].forEach((c, cornerId) => {
        const s = document.createElement('view--corner')
        s.classList.add(c)
        makeCornerDraggable(this, s, async (x, y) => {
          const panel = Number.isFinite(Number(node.getAttribute('panel'))) ? Number(node.getAttribute('panel')) : areaId
          await this.moveCorner(panel, cornerId, x, y)
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

  parseSetup(setup, index) {
    const parts = String(setup).split(':')
    if (parts.length !== 3) throw new Error(`layout child ${index}: invalid setup format '${setup}'`)

    const [targetText, axis, percentText] = parts
    const target = Number.parseInt(targetText, 10)
    const percent = Number.parseInt(percentText, 10)

    if (!Number.isInteger(target) || target < 0) throw new Error(`layout child ${index}: invalid target '${targetText}'`)
    if (axis !== 'v' && axis !== 'h') throw new Error(`layout child ${index}: invalid axis '${axis}'`)
    if (!Number.isInteger(percent) || percent <= 0 || percent >= 100) {
      throw new Error(`layout child ${index}: invalid percent '${percentText}'`)
    }

    return { target, axis, percent: 100 - percent }
  }

  splitPointForArea(area, axis, percent) {
    const width = area.x1 - area.x0
    const height = area.y1 - area.y0
    const splitX = area.x0 + Math.floor(width * (percent / 100))
    const splitY = area.y0 + Math.floor(height * (percent / 100))

    if (axis === 'h') {
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

  async load(layoutData) {
    if (!this.runtime) throw new Error('layout manager is not initialized')
    const markup = String(layoutData || '').trim()
    if (!markup) throw new Error('layout markup is required')

    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(`<layout>${markup}</layout>`, 'text/xml')
    const parseError = xmlDoc.querySelector('parsererror')
    if (parseError) {
      throw new Error(`invalid layout markup: ${parseError.textContent?.trim() || 'parse error'}`)
    }

    const sourceSpecs = xmlDoc.childNodes[0].childNodes
    const specs = [...sourceSpecs]
      .filter((n) => n.nodeType === 1)
      .map((n) => ({
        tag: n.tagName,
        attrs: Object.fromEntries([...n.attributes].map((attr) => [attr.name, attr.value])),
        innerHTML: n.innerHTML || '',
      }))

    if (specs.length === 0) throw new Error('root view must be defined')
    if (specs[0].attrs.setup) throw new Error('layout child 0: root view cannot define setup')

    this.stopCornerPreview()
    this.replaceChildren()
    this.content.clear()
    this.handles.length = 0
    this.tryRectEl = null
    this.contentCounter = 0

    const width = Math.max(64, Math.floor(this.clientWidth || window.innerWidth || 0))
    const height = Math.max(64, Math.floor(this.clientHeight || window.innerHeight || 0))
    await this.initScreen(width, height, this.handleSize, this.minPanelSize)
    this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))

    await this.createChromeForViewSpec(specs[0], 0)
    this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))

    for (let i = 1; i < specs.length; i += 1) {
      const spec = specs[i]
      const { setup } = spec.attrs
      if (!setup) throw new Error(`layout child ${i}: missing setup`)

      const { target, axis, percent } = this.parseSetup(setup, i)
      const areaCount = header(this.i32).areaCount
      if (target >= areaCount) throw new Error(`layout child ${i}: target ${target} is out of range`)

      const area = this.areaAt(target)
      const newPanel = areaCount
      const split = this.splitPointForArea(area, axis, percent)

      await this.moveCorner(target, split.corner, split.x, split.y)
      this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))
      await this.createChromeForViewSpec(spec, newPanel)
      this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))
    }

    this.render()
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
      node.refreshViewSelector?.()
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
    const nextPtr = readI32String(await this.callLayout('get_info_ptr', ''))
    if (nextPtr !== this.ptr || !this.i32) {
      this.ptr = nextPtr
    }
    this.i32 = new Int32Array(this.buffer, this.ptr, Math.floor(this.size / 4))
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
    try { handleEl.releasePointerCapture(pointerId) } catch { }
    cleanup()
    const local = toHostLocal(e.clientX, e.clientY)
    callback(local.x, local.y)
  }

  const onCancel = (e) => {
    if (!dragging || e.pointerId !== pointerId) return
    dragging = false
    try { handleEl.releasePointerCapture(pointerId) } catch { }
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
    try { handleEl.releasePointerCapture(pointerId) } catch { }
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


const THEME_SELECTOR = 'link[data-theme-stylesheet]'

export function getThemeStylesheetSource() {
  return document.getElementById('theme-stylesheet')
    || document.querySelector(`head ${THEME_SELECTOR}`)
    || document.querySelector(THEME_SELECTOR)
}

export function ensureThemeStylesheetLink(root, { insertAfter = 'link[href="base.css"]' } = {}) {
  if (!root?.querySelector) return null

  const source = getThemeStylesheetSource()
  if (!source) return null

  let target = root.querySelector(THEME_SELECTOR)
  const sourceHref = source.getAttribute('href')

  if (target) {
    if (sourceHref && target.getAttribute('href') !== sourceHref) {
      target.setAttribute('href', sourceHref)
    }
    return target
  }

  target = source.cloneNode(false)
  target.removeAttribute('id')
  target.setAttribute('data-theme-stylesheet', '')

  const anchor = root.querySelector(insertAfter)
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(target, anchor.nextSibling)
    return target
  }

  if (typeof root.prepend === 'function') {
    root.prepend(target)
  }

  return target
}


if (!customElements.get('view-empty')) customElements.define('view-empty', ViewEmpty)
if (!customElements.get('view-area')) customElements.define('view-area', ViewArea)
if (!customElements.get('view--corner')) customElements.define('view--corner', Corner)
if (!customElements.get('view--handle')) customElements.define('view--handle', Handle)
if (!customElements.get('ui-layout')) customElements.define('ui-layout', UiLayout)




