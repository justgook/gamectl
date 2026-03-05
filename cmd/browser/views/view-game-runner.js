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

    this._raf = 0
    this._eventOffsets = { ...FALLBACK_EVENT_OFFSETS }
    this._eventBufferPtr = 0
    this._eventFrameCount = 0

    this._resizeObserver = new ResizeObserver(() => {
      this._onResize()
    })
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.position = 'relative'
    this.style.overflow = 'hidden'

    if (!this.canvas.isConnected) {
      this.appendChild(this.canvas)
    }
    this._resizeObserver.observe(this)
    this._boot().catch((error) => {
      console.error('[game-runner] boot failed:', error)
    })
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect()

    if (this._raf) {
      cancelAnimationFrame(this._raf)
      this._raf = 0
    }

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
    this.glBridge = null
    this.gl = null
  }

  async _boot() {
    if (this.pluginHandle) return
    if (!window.pluginManager) {
      throw new Error('pluginManager is not available')
    }

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

    const importObject = {
      env: {
        js_canvas_width: () => this.canvas.width,
        js_canvas_height: () => this.canvas.height,
        js_webgl_framebuffer: () => 0,
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
    this._dispatchResized()
    this._startLoop()
  }

  _startLoop() {
    const tick = () => {
      this._raf = requestAnimationFrame(tick)
      try {
        this.exports?.frame?.()
      } catch (error) {
        console.error('[game-runner] frame failed:', error)
        if (this._raf) {
          cancelAnimationFrame(this._raf)
          this._raf = 0
        }
      }
    }
    this._raf = requestAnimationFrame(tick)
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

  onPointerDown(_e) { }
  onPointerMove(_e) { }
  onPointerUp(_e) { }
  onWheel(_e) { }
  onKeyDown(_e) { }
  onKeyUp(_e) { }
}
