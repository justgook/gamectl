import { runtime, unwrap } from "/core/runtime.js"
import { require } from "/util/require.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"

const FALLBACK_EVENT_OFFSETS = {
  frame_count: 0,
  type: 8,
  action_code: 40,
  window_width: 256,
  window_height: 260,
  framebuffer_width: 264,
  framebuffer_height: 268,
}

const EVENT_TYPE_RESIZED = 14
const EVENT_TYPE_ACTION_DOWN = 100
const EVENT_TYPE_ACTION_UP = 101

const ACTION_UP = 1
const ACTION_RIGHT = 2
const ACTION_DOWN = 3
const ACTION_LEFT = 4
const ACTION_1 = 5
const ACTION_2 = 6

const ACTION_BY_KEY = new Map([
  ["w", ACTION_UP],
  ["arrowup", ACTION_UP],
  ["d", ACTION_RIGHT],
  ["arrowright", ACTION_RIGHT],
  ["s", ACTION_DOWN],
  ["arrowdown", ACTION_DOWN],
  ["a", ACTION_LEFT],
  ["arrowleft", ACTION_LEFT],
  ["j", ACTION_1],
  ["z", ACTION_1],
  ["k", ACTION_2],
  ["x", ACTION_2],
])

const textDecoder = new TextDecoder()

function writeU64(view, offset, value) {
  const lo = value >>> 0
  const hi = Math.floor(value / 0x100000000) >>> 0
  view.setUint32(offset, lo, true)
  view.setUint32(offset + 4, hi, true)
}

function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("view-game-runner config is required")
  if (typeof config.wasm !== "string" || config.wasm.length === 0)
    throw new Error("view-game-runner config.wasm is required")
  if (typeof config.glBridge !== "string" || config.glBridge.length === 0)
    throw new Error("view-game-runner config.glBridge is required")
  const assetSources = config.assetSources
  if (
    typeof assetSources !== "object" ||
    assetSources == null ||
    Array.isArray(assetSources)
  )
    throw new Error("view-game-runner config.assetSources must be an object")
  for (const [assetPath, source] of Object.entries(assetSources)) {
    if (typeof assetPath !== "string" || assetPath.length === 0)
      throw new Error(
        "view-game-runner assetSources keys must be non-empty strings",
      )
    if (typeof source !== "string" || source.length === 0)
      throw new Error(
        `asset source for '${assetPath}' must be a non-empty string`,
      )
  }
  return {
    wasm: config.wasm,
    glBridge: config.glBridge,
    assetSources,
    pointerEvents: config.pointerEvents === true,
  }
}

async function readProjectFileBytes(path) {
  const bytes = unwrap(await runtime.invoke("fs/fs::read-file", path), path)
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
}

export class ViewGameRunner extends HTMLElement {
  constructor() {
    super()
    this.runtime = runtime
    this.canvas = null
    this.gl = null
    this.glBridge = null
    this.instance = null
    this.exports = null
    this.memory = null
    this.isPaused = false
    this.enablePointerBridge = false

    this._raf = 0
    this._eventOffsets = { ...FALLBACK_EVENT_OFFSETS }
    this._eventBufferPtr = 0
    this._eventFrameCount = 0
    this._pressedActions = new Set()
    this._assetCache = new Map()
    this._headerControls = null
    this._playPauseBtn = null
    this._resizeObserver = new ResizeObserver(() => this._onResize())

    this._boundPointerDown = (event) => this.onPointerDown(event)
    this._boundPointerMove = (event) => this.onPointerMove(event)
    this._boundPointerUp = (event) => this.onPointerUp(event)
    this._boundWheel = (event) => this.onWheel(event)
    this._boundKeyDown = (event) => this.onKey(event, true)
    this._boundKeyUp = (event) => this.onKey(event, false)
  }

  connectedCallback() {
    this.style.display = "contents"
    this.innerHTML = '<canvas data-element="canvas"></canvas>'
    this.canvas = this.querySelector('canvas[data-element="canvas"]')
    if (!(this.canvas instanceof HTMLCanvasElement))
      throw new Error("view-game-runner missing canvas")

    this.canvas.style.display = "block"
    this.canvas.style.width = "100%"
    this.canvas.style.height = "100%"
    this.canvas.style.minWidth = "0"
    this.canvas.style.minHeight = "0"
    this.canvas.style.maxWidth = "100%"
    this.canvas.style.maxHeight = "100%"
    this.canvas.style.justifySelf = "stretch"
    this.canvas.style.alignSelf = "stretch"
    this.canvas.style.touchAction = "none"
    this.canvas.tabIndex = 0

    this._mountHeaderControls()
    this._setupInputHandlers()
    this._resizeObserver.observe(this.parentElement || this.canvas)
    registerViewPlugin(this, {
      run: async () => {
        this.isPaused = false
        this._syncControlState()
        return { ok: { paused: this.isPaused } }
      },
      reload: async () => {
        await this.reload()
        return { ok: true }
      },
    })

    this._boot().catch((error) => {
      console.error("[game-runner] boot failed:", error)
      void this._toast(
        "error",
        `Game runner boot failed: ${String(error?.message || error)}`,
      )
    })
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect()
    this._releaseAllActions()
    this._teardownInputHandlers()
    this._unmountHeaderControls()
    this._stopLoop()
    this._teardownWasm()
    void unregisterViewPlugin(this)
  }

  async reload() {
    this._stopLoop()
    this._teardownWasm()
    this._eventBufferPtr = 0
    this._eventFrameCount = 0
    await this._boot()
  }

  async _boot() {
    if (this.instance) return
    const config = normalizeConfig(this.config || this.viewConfig?.config)
    this.enablePointerBridge = config.pointerEvents
    await this._preloadAssets(config.assetSources)

    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      depth: true,
      stencil: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    })
    if (!gl) throw new Error("WebGL2 is not supported")

    this.gl = gl
    this._resizeCanvas()
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)

    const { GLBridge } = await require(config.glBridge)
    this.glBridge = new GLBridge(gl, null)

    const wasmBytes = await readProjectFileBytes(config.wasm)

    const importObject = {
      env: {
        js_canvas_width: () => this.canvas.width,
        js_canvas_height: () => this.canvas.height,
        js_webgl_framebuffer: () => 0,
        ...this._createAssetImports(),
        ...this.glBridge.createImportObject(),
      },
    }

    const instantiated = await WebAssembly.instantiate(wasmBytes, importObject)
    this.instance = instantiated.instance || instantiated
    this.exports = this.instance.exports
    this.memory = this.exports.memory
    if (!(this.memory instanceof WebAssembly.Memory))
      throw new Error("game wasm must export memory")
    this.glBridge.memory = this.memory

    this._eventOffsets = this._resolveEventOffsets()
    this._eventBufferPtr = 0
    this._eventFrameCount = 0
    this._pressedActions.clear()

    if (typeof this.exports.init !== "function")
      throw new Error("game wasm must export init()")
    if (typeof this.exports.frame !== "function")
      throw new Error("game wasm must export frame()")

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
      if (this.isPaused) return
      try {
        this.exports.frame()
      } catch (error) {
        console.error("[game-runner] frame failed:", error)
        this._stopLoop()
        void this._toast(
          "error",
          `Game frame failed: ${String(error?.message || error)}`,
        )
      }
    }
    this._raf = requestAnimationFrame(tick)
  }

  _stopLoop() {
    if (!this._raf) return
    cancelAnimationFrame(this._raf)
    this._raf = 0
  }

  _teardownWasm() {
    if (this.exports && typeof this.exports.cleanup === "function")
      this.exports.cleanup()
    this.instance = null
    this.exports = null
    this.memory = null
    this.glBridge = null
    this.gl = null
    this._assetCache.clear()
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControls) return
    const controls = document.createElement("div")
    controls.setAttribute("slot", "header-controls")
    controls.setAttribute("role", "buttongroup")
    controls.dataset.element = "tool-actions"

    const playPauseBtn = document.createElement("button")
    playPauseBtn.type = "button"
    playPauseBtn.addEventListener("click", () => {
      this.isPaused = !this.isPaused
      this._syncControlState()
    })

    const reloadBtn = document.createElement("button")
    reloadBtn.type = "button"
    reloadBtn.setAttribute("aria-label", "Reload")
    reloadBtn.setAttribute("title", "Reload")
    reloadBtn.innerHTML = '<i aria-hidden="true">refresh</i>'
    reloadBtn.addEventListener("click", () => {
      this.reload().catch((error) => {
        console.error("[game-runner] reload failed:", error)
        void this._toast(
          "error",
          `Game runner reload failed: ${String(error?.message || error)}`,
        )
      })
    })

    controls.appendChild(playPauseBtn)
    controls.appendChild(reloadBtn)
    this.parentElement.appendChild(controls)
    this._headerControls = controls
    this._playPauseBtn = playPauseBtn
    this._syncControlState()
  }

  _unmountHeaderControls() {
    if (this._headerControls?.parentElement) this._headerControls.remove()
    this._headerControls = null
    this._playPauseBtn = null
  }

  _syncControlState() {
    if (!this._playPauseBtn) return
    this._playPauseBtn.setAttribute(
      "aria-label",
      this.isPaused ? "Resume" : "Pause",
    )
    this._playPauseBtn.setAttribute("title", this.isPaused ? "Resume" : "Pause")
    this._playPauseBtn.innerHTML = this.isPaused
      ? '<i aria-hidden="true">play_arrow</i>'
      : '<i aria-hidden="true">pause</i>'
  }

  _setupInputHandlers() {
    this.canvas.addEventListener("pointerdown", this._boundPointerDown)
    this.canvas.addEventListener("pointermove", this._boundPointerMove)
    this.canvas.addEventListener("pointerup", this._boundPointerUp)
    this.canvas.addEventListener("pointerleave", this._boundPointerUp)
    this.canvas.addEventListener("wheel", this._boundWheel, { passive: true })
    this.canvas.addEventListener("keydown", this._boundKeyDown)
    this.canvas.addEventListener("keyup", this._boundKeyUp)
  }

  _teardownInputHandlers() {
    if (!(this.canvas instanceof HTMLCanvasElement)) return
    this.canvas.removeEventListener("pointerdown", this._boundPointerDown)
    this.canvas.removeEventListener("pointermove", this._boundPointerMove)
    this.canvas.removeEventListener("pointerup", this._boundPointerUp)
    this.canvas.removeEventListener("pointerleave", this._boundPointerUp)
    this.canvas.removeEventListener("wheel", this._boundWheel)
    this.canvas.removeEventListener("keydown", this._boundKeyDown)
    this.canvas.removeEventListener("keyup", this._boundKeyUp)
  }

  _onResize() {
    const gl = this.gl
    const { cssW, cssH, fbW, fbH } = this._resizeCanvas()
    if (gl) gl.viewport(0, 0, fbW, fbH)
    this._dispatchResized(cssW, cssH, fbW, fbH)
  }

  _resizeCanvas() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 4))
    const rect = this.canvas.getBoundingClientRect()
    const cssW = Math.max(
      1,
      Math.floor(rect.width || this.canvas.clientWidth || 1),
    )
    const cssH = Math.max(
      1,
      Math.floor(rect.height || this.canvas.clientHeight || 1),
    )
    const fbW = Math.max(1, Math.floor(cssW * dpr))
    const fbH = Math.max(1, Math.floor(cssH * dpr))
    if (this.canvas.width !== fbW) this.canvas.width = fbW
    if (this.canvas.height !== fbH) this.canvas.height = fbH
    return { cssW, cssH, fbW, fbH, dpr }
  }

  async _preloadAssets(assetSources) {
    this._assetCache.clear()
    const entries = Object.entries(assetSources)
    await Promise.all(
      entries.map(async ([assetPath, source]) => {
        this._assetCache.set(assetPath, await readProjectFileBytes(source))
      }),
    )
  }

  _readWasmUtf8(ptr, len) {
    const start = Number(ptr) >>> 0
    const size = Number(len) >>> 0
    if (size === 0) return ""
    const end = start + size
    if (end > this.memory.buffer.byteLength)
      throw new Error("game wasm utf8 read out of bounds")
    return textDecoder.decode(new Uint8Array(this.memory.buffer, start, size))
  }

  _createAssetImports() {
    return {
      js_log: (level, tagPtr, tagLen, messagePtr, messageLen) => {
        const tag = this._readWasmUtf8(tagPtr, tagLen)
        const message = this._readWasmUtf8(messagePtr, messageLen)
        const prefix = tag ? `[${tag}]` : "[game]"
        if (level >>> 0 >= 3) console.error(prefix, message)
        else if (level >>> 0 === 2) console.warn(prefix, message)
        else if (level >>> 0 === 0) console.debug(prefix, message)
        else console.info(prefix, message)
      },
      game_asset_size: (pathPtr, pathLen) => {
        const path = this._readWasmUtf8(pathPtr, pathLen)
        const bytes = this._assetCache.get(path)
        return bytes ? bytes.byteLength : -1
      },
      game_asset_read: (pathPtr, pathLen, dstPtr, dstCap) => {
        const path = this._readWasmUtf8(pathPtr, pathLen)
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
    if (typeof ex.event_offset_window_width === "function")
      offsets.window_width = Number(ex.event_offset_window_width())
    if (typeof ex.event_offset_action_code === "function")
      offsets.action_code = Number(ex.event_offset_action_code())
    if (typeof ex.event_offset_window_height === "function")
      offsets.window_height = Number(ex.event_offset_window_height())
    if (typeof ex.event_offset_framebuffer_width === "function")
      offsets.framebuffer_width = Number(ex.event_offset_framebuffer_width())
    if (typeof ex.event_offset_framebuffer_height === "function")
      offsets.framebuffer_height = Number(ex.event_offset_framebuffer_height())
    return offsets
  }

  _getEventBufferPtr() {
    if (typeof this.exports.get_event_buffer !== "function") return 0
    if (!this._eventBufferPtr)
      this._eventBufferPtr = Number(this.exports.get_event_buffer())
    return this._eventBufferPtr
  }

  _dispatchResized(
    cssW = Math.max(
      1,
      Math.floor(this.canvas.getBoundingClientRect().width || 1),
    ),
    cssH = Math.max(
      1,
      Math.floor(this.canvas.getBoundingClientRect().height || 1),
    ),
    fbW = this.canvas.width,
    fbH = this.canvas.height,
  ) {
    if (!this.exports || typeof this.exports.event !== "function") return
    const eventPtr = this._getEventBufferPtr()
    if (!eventPtr) return
    const view = new DataView(this.memory.buffer)
    const o = this._eventOffsets
    writeU64(view, eventPtr + o.frame_count, this._eventFrameCount++)
    view.setUint32(eventPtr + o.type, EVENT_TYPE_RESIZED, true)
    view.setInt32(eventPtr + o.window_width, cssW, true)
    view.setInt32(eventPtr + o.window_height, cssH, true)
    view.setInt32(eventPtr + o.framebuffer_width, fbW, true)
    view.setInt32(eventPtr + o.framebuffer_height, fbH, true)
    this.exports.event(eventPtr)
  }

  onKey(event, isDown) {
    const actionCode = ACTION_BY_KEY.get(String(event.key || "").toLowerCase())
    if (!actionCode) return
    event.preventDefault()
    event.stopPropagation()
    this._dispatchActionEvent(actionCode, isDown)
  }

  onPointerDown(event) {
    this.canvas.focus()
    this.canvas.setPointerCapture(event.pointerId)
    this._sendHostEvent(4, (view, ptr) => {
      view.setFloat32(ptr + 32, event.offsetX, true)
      view.setFloat32(ptr + 36, event.offsetY, true)
      view.setInt32(ptr + 28, event.button ?? 0, true)
    })
  }

  onPointerMove(event) {
    this._sendHostEvent(7, (view, ptr) => {
      view.setFloat32(ptr + 32, event.offsetX, true)
      view.setFloat32(ptr + 36, event.offsetY, true)
    })
  }

  onPointerUp(event) {
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId)
    this._sendHostEvent(5, (view, ptr) => {
      view.setFloat32(ptr + 32, event.offsetX, true)
      view.setFloat32(ptr + 36, event.offsetY, true)
      view.setInt32(ptr + 28, event.button ?? 0, true)
    })
  }

  onWheel(event) {
    this._sendHostEvent(6, (view, ptr) => {
      view.setFloat32(ptr + 48, event.deltaX || 0, true)
      view.setFloat32(ptr + 52, event.deltaY || 0, true)
    })
  }

  _dispatchActionEvent(actionCode, isDown) {
    if (!this.exports || typeof this.exports.event !== "function") return
    const eventPtr = this._getEventBufferPtr()
    if (!eventPtr) return
    if (isDown) {
      if (this._pressedActions.has(actionCode)) return
      this._pressedActions.add(actionCode)
    } else {
      if (!this._pressedActions.has(actionCode)) return
      this._pressedActions.delete(actionCode)
    }
    const view = new DataView(this.memory.buffer)
    const o = this._eventOffsets
    writeU64(view, eventPtr + o.frame_count, this._eventFrameCount++)
    view.setUint32(
      eventPtr + o.type,
      isDown ? EVENT_TYPE_ACTION_DOWN : EVENT_TYPE_ACTION_UP,
      true,
    )
    view.setUint32(eventPtr + o.action_code, actionCode, true)
    this.exports.event(eventPtr)
  }

  _releaseAllActions() {
    for (const actionCode of Array.from(this._pressedActions))
      this._dispatchActionEvent(actionCode, false)
  }

  _sendHostEvent(eventType, writeFields) {
    if (!this.enablePointerBridge) return
    if (!this.exports || typeof this.exports.event !== "function") return
    const eventPtr = this._getEventBufferPtr()
    if (!eventPtr) return
    const view = new DataView(this.memory.buffer)
    writeU64(
      view,
      eventPtr + FALLBACK_EVENT_OFFSETS.frame_count,
      this._eventFrameCount++,
    )
    view.setUint32(eventPtr + FALLBACK_EVENT_OFFSETS.type, eventType, true)
    writeFields(view, eventPtr)
    this.exports.event(eventPtr)
  }

  async _toast(method, message) {
    await this.runtime.call(`ui.toast.${method}`, String(message))
  }
}

if (!customElements.get("view-game-runner")) {
  customElements.define("view-game-runner", ViewGameRunner)
}
