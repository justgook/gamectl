import { GLBridge } from "../util/gl-bridge.js"

const FALLBACK_EVENT_OFFSETS = {
  frame_count: 0,
  type: 8,
  window_width: 256,
  window_height: 260,
  framebuffer_width: 264,
  framebuffer_height: 268,
}

const EVENT_TYPE_RESIZED = 14

const GAME_ASSET_SOURCES = {
  '/game/clear-color.rgb': 'local:/example/floor-16x16.png'
}

function writeU64(view, offset, value) {
  const lo = value >>> 0
  const hi = Math.floor(value / 0x100000000) >>> 0
  view.setUint32(offset, lo, true)
  view.setUint32(offset + 4, hi, true)
}

export default class ViewGameRunner extends HTMLElement {
  static get viewMeta() {
    return { displayName: 'Game Runner', category: 'Canvas' }
  }

  constructor() {
    super()
    this.canvas = document.createElement('canvas')
    this.canvas.style.display = 'block'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'

    this.gl = null
    this.glBridge = null

    this.pluginHandle = null
    this.exports = null
    this.memory = null
    this.isPaused = false
    this.enableInputBridge = false

    this._raf = 0
    this._eventOffsets = { ...FALLBACK_EVENT_OFFSETS }
    this._eventBufferPtr = 0
    this._eventFrameCount = 0
    this._assetCache = new Map()
    this._textDecoder = new TextDecoder()
    this._headerControls = null
    this._playPauseBtn = null
    this._reloadBtn = null

    this._resizeObserver = new ResizeObserver(() => {
      this._onResize()
    })

    this._boundPointerDown = (e) => this.onPointerDown(e)
    this._boundPointerMove = (e) => this.onPointerMove(e)
    this._boundPointerUp = (e) => this.onPointerUp(e)
    this._boundWheel = (e) => this.onWheel(e)
    this._boundKeyDown = (e) => this.onKeyDown(e)
    this._boundKeyUp = (e) => this.onKeyUp(e)
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.position = 'relative'
    this.style.overflow = 'hidden'
    this.style.flex = 1

    if (!this.canvas.isConnected) {
      this.appendChild(this.canvas)
    }
    this._mountHeaderControls()
    this.setupInputHandlers()
    this._resizeObserver.observe(this)
    this._boot().catch((error) => {
      console.error('[game-runner] boot failed:', error)
    })
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect()
    this.teardownInputHandlers()
    this._unmountHeaderControls()

    this._stopLoop()
    this._teardownPlugin()
  }

  async _boot() {
    if (this.pluginHandle) return
    if (!window.pluginManager) {
      throw new Error('pluginManager is not available')
    }

    await this._preloadAssets()

    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      depth: true,
      stencil: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })

    if (!gl) {
      this.textContent = 'WebGL2 not supported'
      return
    }

    this.gl = gl
    this._resizeCanvas()
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)

    this.glBridge = new GLBridge(gl, null)
    const glImports = this.glBridge.createImportObject()
    const assetImports = this._createAssetImports()

    const importObject = {
      env: {
        js_canvas_width: () => this.canvas.width,
        js_canvas_height: () => this.canvas.height,
        js_webgl_framebuffer: () => 0,
        ...assetImports,
        ...glImports,
      },
    }

    this.pluginHandle = await window.pluginManager.load({
      name: 'game',
      importObject,
    })

    this.exports = this.pluginHandle.exports
    this.memory = this.pluginHandle.memory || this.exports?.memory || null
    this.glBridge.memory = this.memory

    this._eventOffsets = this._resolveEventOffsets()
    this._eventBufferPtr = 0
    this._eventFrameCount = 0

    if (typeof this.exports?.init !== 'function' || typeof this.exports?.frame !== 'function') {
      throw new Error('plugin exports must include init() and frame()')
    }

    this.exports.init()
    this.isPaused = false
    this._syncControlState()
    this._dispatchResized()
    this._startLoop()
  }

  _startLoop() {
    this._stopLoop()
    const tick = () => {
      this._raf = requestAnimationFrame(tick)
      try {
        if (!this.isPaused) {
          this.exports?.frame?.()
        }
      } catch (error) {
        console.error('[game-runner] frame failed:', error)
        this._stopLoop()
      }
    }
    this._raf = requestAnimationFrame(tick)
  }

  _stopLoop() {
    if (this._raf) {
      cancelAnimationFrame(this._raf)
      this._raf = 0
    }
  }

  _teardownPlugin() {
    try {
      this.exports?.cleanup?.()
    } catch (error) {
      console.warn('[game-runner] cleanup failed:', error)
    }

    if (this.pluginHandle) {
      window.pluginManager.unload(this.pluginHandle)
      this.pluginHandle = null
    }

    this.exports = null
    this.memory = null
    this._assetCache.clear()
    this.glBridge = null
    this.gl = null
  }

  async _reloadPlugin() {
    this._stopLoop()
    this._teardownPlugin()
    this._eventBufferPtr = 0
    this._eventFrameCount = 0
    await this._boot()
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControls) return

    const controls = document.createElement('div')
    controls.setAttribute('slot', 'header-controls')
    controls.style.display = 'flex'
    controls.style.gap = '6px'
    controls.style.alignItems = 'center'

    const playPauseBtn = document.createElement('button')
    playPauseBtn.type = 'button'
    playPauseBtn.setAttribute('aria-label', 'Pause')
    playPauseBtn.setAttribute('title', 'Pause')
    playPauseBtn.innerHTML = '<i aria-hidden="true">pause</i>'
    playPauseBtn.addEventListener('click', () => {
      this.isPaused = !this.isPaused
      this._syncControlState()
    })

    const reloadBtn = document.createElement('button')
    reloadBtn.type = 'button'
    reloadBtn.setAttribute('aria-label', 'Reload')
    reloadBtn.setAttribute('title', 'Reload')
    reloadBtn.innerHTML = '<i aria-hidden="true">refresh</i>'
    reloadBtn.addEventListener('click', () => {
      this._reloadPlugin().catch((error) => {
        console.error('[game-runner] reload failed:', error)
      })
    })

    controls.appendChild(playPauseBtn)
    controls.appendChild(reloadBtn)
    this.parentElement.appendChild(controls)

    this._headerControls = controls
    this._playPauseBtn = playPauseBtn
    this._reloadBtn = reloadBtn
    this._syncControlState()
  }

  _unmountHeaderControls() {
    if (this._headerControls?.parentElement) {
      this._headerControls.remove()
    }
    this._headerControls = null
    this._playPauseBtn = null
    this._reloadBtn = null
  }

  _syncControlState() {
    if (this._playPauseBtn) {
      const isPaused = this.isPaused
      this._playPauseBtn.setAttribute('aria-label', isPaused ? 'Resume' : 'Pause')
      this._playPauseBtn.setAttribute('title', isPaused ? 'Resume' : 'Pause')
      this._playPauseBtn.innerHTML = isPaused
        ? '<i aria-hidden="true">play_arrow</i>'
        : '<i aria-hidden="true">pause</i>'
    }
  }

  setupInputHandlers() {
    this.canvas.tabIndex = 0
    this.canvas.addEventListener('pointerdown', this._boundPointerDown)
    this.canvas.addEventListener('pointermove', this._boundPointerMove)
    this.canvas.addEventListener('pointerup', this._boundPointerUp)
    this.canvas.addEventListener('wheel', this._boundWheel, { passive: true })
    this.canvas.addEventListener('keydown', this._boundKeyDown)
    this.canvas.addEventListener('keyup', this._boundKeyUp)
  }

  teardownInputHandlers() {
    this.canvas.removeEventListener('pointerdown', this._boundPointerDown)
    this.canvas.removeEventListener('pointermove', this._boundPointerMove)
    this.canvas.removeEventListener('pointerup', this._boundPointerUp)
    this.canvas.removeEventListener('wheel', this._boundWheel)
    this.canvas.removeEventListener('keydown', this._boundKeyDown)
    this.canvas.removeEventListener('keyup', this._boundKeyUp)
  }

  _onResize() {
    const gl = this.gl
    const { cssW, cssH, fbW, fbH } = this._resizeCanvas()
    if (gl) {
      gl.viewport(0, 0, fbW, fbH)
    }
    this._dispatchResized(cssW, cssH, fbW, fbH)
  }

  _resizeCanvas() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 4))
    const cssW = Math.max(1, Math.floor(this.clientWidth || 0))
    const cssH = Math.max(1, Math.floor(this.clientHeight || 0))
    const fbW = Math.max(1, Math.floor(cssW * dpr))
    const fbH = Math.max(1, Math.floor(cssH * dpr))

    if (this.canvas.width !== fbW) this.canvas.width = fbW
    if (this.canvas.height !== fbH) this.canvas.height = fbH

    return { cssW, cssH, fbW, fbH, dpr }
  }

  async _preloadAssets() {
    this._assetCache.clear()

    const entries = Object.entries(GAME_ASSET_SOURCES)
    if (entries.length === 0) {
      return
    }

    await Promise.all(entries.map(async ([assetPath, source]) => {
      try {
        const result = await window.pluginManager.call('fs', 'read', source)
        if (result.returnCode !== 0) {
          const message = this._textDecoder.decode(result.output || new Uint8Array())
          console.warn(`[game-runner] failed to preload ${assetPath} from ${source}: ${message}`)
          return
        }

        const bytes = result.output instanceof Uint8Array
          ? result.output
          : new Uint8Array(result.output)
        this._assetCache.set(assetPath, bytes)
      } catch (error) {
        console.warn(`[game-runner] failed to preload ${assetPath} from ${source}:`, error)
      }
    }))
  }

  _readWasmUtf8(ptr, len) {
    if (!this.memory) return ''

    const start = Number(ptr) >>> 0
    const size = Number(len) >>> 0
    if (size === 0) return ''

    const end = start + size
    if (end > this.memory.buffer.byteLength) {
      return ''
    }

    return this._textDecoder.decode(new Uint8Array(this.memory.buffer, start, size))
  }

  _createAssetImports() {
    return {
      game_asset_size: (pathPtr, pathLen) => {
        const path = this._readWasmUtf8(pathPtr, pathLen)
        if (!path) return -1

        const bytes = this._assetCache.get(path)
        if (!bytes) return -1
        return bytes.byteLength
      },

      game_asset_read: (pathPtr, pathLen, dstPtr, dstCap) => {
        if (!this.memory) return -1

        const path = this._readWasmUtf8(pathPtr, pathLen)
        if (!path) return -1

        const bytes = this._assetCache.get(path)
        if (!bytes) return -1

        const dst = Number(dstPtr) >>> 0
        const cap = Number(dstCap) >>> 0
        if (cap < bytes.byteLength) return -2

        const end = dst + bytes.byteLength
        if (end > this.memory.buffer.byteLength) return -3

        new Uint8Array(this.memory.buffer, dst, bytes.byteLength).set(bytes)
        return bytes.byteLength
      },
    }
  }

  _resolveEventOffsets() {
    const offsets = { ...FALLBACK_EVENT_OFFSETS }
    const ex = this.exports
    if (!ex) return offsets

    if (typeof ex.event_offset_window_width === 'function') {
      offsets.window_width = Number(ex.event_offset_window_width())
    }
    if (typeof ex.event_offset_window_height === 'function') {
      offsets.window_height = Number(ex.event_offset_window_height())
    }
    if (typeof ex.event_offset_framebuffer_width === 'function') {
      offsets.framebuffer_width = Number(ex.event_offset_framebuffer_width())
    }
    if (typeof ex.event_offset_framebuffer_height === 'function') {
      offsets.framebuffer_height = Number(ex.event_offset_framebuffer_height())
    }

    return offsets
  }

  _getEventBufferPtr() {
    if (!this.exports || typeof this.exports.get_event_buffer !== 'function') return 0
    if (!this.memory) return 0
    if (!this._eventBufferPtr) {
      this._eventBufferPtr = Number(this.exports.get_event_buffer())
    }
    return this._eventBufferPtr
  }

  _dispatchResized(cssW = Math.max(1, Math.floor(this.clientWidth || 0)), cssH = Math.max(1, Math.floor(this.clientHeight || 0)), fbW = this.canvas.width, fbH = this.canvas.height) {
    if (!this.exports || typeof this.exports.event !== 'function') return
    if (!this.memory) return
    if (typeof this.exports.get_event_buffer !== 'function') return

    const eventPtr = this._getEventBufferPtr()
    if (!eventPtr) return

    const view = new DataView(this.memory.buffer)
    const o = this._eventOffsets || FALLBACK_EVENT_OFFSETS

    writeU64(view, eventPtr + o.frame_count, this._eventFrameCount++)
    view.setUint32(eventPtr + o.type, EVENT_TYPE_RESIZED, true)
    view.setInt32(eventPtr + o.window_width, cssW, true)
    view.setInt32(eventPtr + o.window_height, cssH, true)
    view.setInt32(eventPtr + o.framebuffer_width, fbW, true)
    view.setInt32(eventPtr + o.framebuffer_height, fbH, true)

    this.exports.event(eventPtr)
  }

  onPointerDown(e) {
    this._sendHostEventExample(4, (view, ptr) => {
      view.setFloat32(ptr + 32, e.offsetX, true)
      view.setFloat32(ptr + 36, e.offsetY, true)
      view.setInt32(ptr + 28, e.button ?? 0, true)
    })
  }

  onPointerMove(e) {
    this._sendHostEventExample(7, (view, ptr) => {
      view.setFloat32(ptr + 32, e.offsetX, true)
      view.setFloat32(ptr + 36, e.offsetY, true)
    })
  }

  onPointerUp(e) {
    this._sendHostEventExample(5, (view, ptr) => {
      view.setFloat32(ptr + 32, e.offsetX, true)
      view.setFloat32(ptr + 36, e.offsetY, true)
      view.setInt32(ptr + 28, e.button ?? 0, true)
    })
  }

  onWheel(e) {
    this._sendHostEventExample(6, (view, ptr) => {
      view.setFloat32(ptr + 48, e.deltaX || 0, true)
      view.setFloat32(ptr + 52, e.deltaY || 0, true)
    })
  }

  onKeyDown(e) {
    this._sendHostEventExample(1, (view, ptr) => {
      view.setUint32(ptr + 12, e.keyCode || 0, true)
      view.setUint32(ptr + 16, e.key?.codePointAt?.(0) || 0, true)
      view.setUint32(ptr + 20, e.repeat ? 1 : 0, true)
    })
  }

  onKeyUp(e) {
    this._sendHostEventExample(2, (view, ptr) => {
      view.setUint32(ptr + 12, e.keyCode || 0, true)
      view.setUint32(ptr + 16, e.key?.codePointAt?.(0) || 0, true)
      view.setUint32(ptr + 20, e.repeat ? 1 : 0, true)
    })
  }

  _sendHostEventExample(eventType, writeFields) {
    if (!this.memory || !this.exports || typeof this.exports.event !== 'function') {
      return
    }
    if (typeof this.exports.get_event_buffer !== 'function') {
      return
    }

    const eventPtr = this._getEventBufferPtr()
    if (!eventPtr) return

    const view = new DataView(this.memory.buffer)
    writeU64(view, eventPtr + FALLBACK_EVENT_OFFSETS.frame_count, this._eventFrameCount++)
    view.setUint32(eventPtr + FALLBACK_EVENT_OFFSETS.type, eventType, true)
    writeFields(view, eventPtr)

    // Disabled by default: this is example host->WASM event wiring.
    // Remove the guard when full input bridge is ready.
    if (this.enableInputBridge) {
      this.exports.event(eventPtr)
    }
  }
}
