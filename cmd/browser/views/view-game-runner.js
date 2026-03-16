import { toast } from "../systems/toast.js"
import { bus } from "../systems/event-bus.js"
import { parseCSVLines } from "../util/csv.js"
import { GLBridge } from "../util/gl-bridge.js"

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

const ACTION_BY_EVENT_NAME = new Map([
  ['game:action:left', ACTION_LEFT],
  ['game:action:right', ACTION_RIGHT],
  ['game:action:up', ACTION_UP],
  ['game:action:down', ACTION_DOWN],
  ['game:action:action1', ACTION_1],
  ['game:action:action2', ACTION_2],
])

const GAME_RUNNER_ASSET_SOURCES_TABLE = 'game_runner_asset_sources'

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeSqlString(value) {
  return String(value ?? '').replace(/'/g, "''")
}

function writeU64(view, offset, value) {
  const lo = value >>> 0
  const hi = Math.floor(value / 0x100000000) >>> 0
  view.setUint32(offset, lo, true)
  view.setUint32(offset + 4, hi, true)
}

function createAssetSources(entries = []) {
  return new Map([...entries])
}

export default class ViewGameRunner extends HTMLElement {
  static get viewMeta() {
    return { displayName: 'Game Runner', category: 'Canvas' }
  }

  static get keybindings() {
    return [
      { id: 'action-left', eventName: 'game:action:left', description: 'Move left', defaultKeys: 'a' },
      { id: 'action-right', eventName: 'game:action:right', description: 'Move right', defaultKeys: 'd' },
      { id: 'action-up', eventName: 'game:action:up', description: 'Move up', defaultKeys: 'w' },
      { id: 'action-down', eventName: 'game:action:down', description: 'Move down', defaultKeys: 's' },
      { id: 'action-1', eventName: 'game:action:action1', description: 'Primary action', defaultKeys: 'j' },
      { id: 'action-2', eventName: 'game:action:action2', description: 'Secondary action', defaultKeys: 'k' },
    ]
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
    this._pressedActions = new Set()
    this._actionByKey = new Map()
    this._unbindKeybindingChanged = null
    this._assetCache = new Map()
    this._assetSources = createAssetSources()
    this._textDecoder = new TextDecoder()
    this._headerControls = null
    this._assetBtn = null
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
    this._boundBlur = () => this._releaseAllActions()
    this._boundKeybindingsChanged = () => this._refreshActionBindings()
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
    this._refreshActionBindings()
    this._unbindKeybindingChanged = bus.on('keybindings:changed', this._boundKeybindingsChanged)
    this._resizeObserver.observe(this)
    this._initialize().catch((error) => {
      console.error('[game-runner] boot failed:', error)
    })
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect()
    this._unbindKeybindingChanged?.()
    this._unbindKeybindingChanged = null
    this._releaseAllActions()
    this.teardownInputHandlers()
    this._unmountHeaderControls()

    this._stopLoop()
    this._teardownPlugin()
  }

  async _initialize() {
    await this._loadAssetSourcesFromStorage()
    await this._boot()
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
    this._pressedActions.clear()

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

    const assetsBtn = document.createElement('button')
    assetsBtn.type = 'button'
    assetsBtn.setAttribute('aria-label', 'Asset Sources')
    assetsBtn.setAttribute('title', 'Asset Sources')
    assetsBtn.innerHTML = '<i aria-hidden="true">inventory_2</i>'
    assetsBtn.addEventListener('click', () => {
      this.showAssetSourcesPopup()
    })

    controls.appendChild(playPauseBtn)
    controls.appendChild(reloadBtn)
    controls.appendChild(assetsBtn)
    this.parentElement.appendChild(controls)

    this._headerControls = controls
    this._assetBtn = assetsBtn
    this._playPauseBtn = playPauseBtn
    this._reloadBtn = reloadBtn
    this._syncControlState()
  }

  _unmountHeaderControls() {
    if (this._headerControls?.parentElement) {
      this._headerControls.remove()
    }
    this._headerControls = null
    this._assetBtn = null
    this._playPauseBtn = null
    this._reloadBtn = null
  }

  _getAssetSourceEntries() {
    return Array.from(this._assetSources.entries()).map(([assetPath, source]) => ({ assetPath, source }))
  }

  async _loadAssetSourcesFromStorage() {
    if (!window.pluginManager) {
      this._assetSources = createAssetSources()
      return
    }

    try {
      const result = await window.pluginManager.call(
        'sql',
        'query',
        `SELECT asset_path, source FROM ${GAME_RUNNER_ASSET_SOURCES_TABLE} ORDER BY asset_path`
      )
      const csv = this._textDecoder.decode(result.output || new Uint8Array())
      const rows = parseCSVLines(csv.trim())
      const entries = []
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || []
        const assetPath = String(row[0] || '').trim()
        const source = String(row[1] || '').trim()
        if (!assetPath || !source) continue
        entries.push([assetPath, source])
      }

      this._assetSources = createAssetSources(entries)
    } catch (error) {
      console.warn('[game-runner] failed to load asset sources from storage:', error)
      this._assetSources = createAssetSources()
    }
  }

  async _saveAssetSourcesToStorage(entries) {
    const statements = ['BEGIN TRANSACTION', `DELETE FROM ${GAME_RUNNER_ASSET_SOURCES_TABLE}`]
    for (const entry of entries) {
      const assetPath = escapeSqlString(entry.assetPath)
      const source = escapeSqlString(entry.source)
      statements.push(
        `INSERT INTO ${GAME_RUNNER_ASSET_SOURCES_TABLE} (asset_path, source, updated_at) VALUES ('${assetPath}', '${source}', datetime('now'))`
      )
    }
    statements.push('COMMIT')
    await window.pluginManager.call('sql', 'exec', statements.join(';\n'))
  }

  showAssetSourcesPopup() {
    const popupManager = this.closest('popup-manager') || document.querySelector('popup-manager')
    if (!popupManager) {
      toast.error('Popup manager is not available.')
      return
    }

    const form = document.createElement('form')
    const draft = this._getAssetSourceEntries()
    if (draft.length === 0) {
      draft.push({ assetPath: '', source: '' })
    }

    const syncDraftFromForm = () => {
      const formData = new FormData(form)
      const assetPaths = formData.getAll('asset-path')
      const sources = formData.getAll('asset-source')
      draft.length = 0
      for (let i = 0; i < Math.max(assetPaths.length, sources.length); i++) {
        draft.push({
          assetPath: String(assetPaths[i] || ''),
          source: String(sources[i] || ''),
        })
      }
    }

    const renderForm = () => {
      form.innerHTML = `
        <p>Map game asset paths to local sources.</p>
        <fieldset>
          <legend>Asset sources</legend>
          <ul>
            ${draft.map((entry, index) => `
              <li>
                <input type="text" name="asset-path" value="${escapeAttribute(entry.assetPath)}" placeholder="/game/example.bin">
                <input type="text" name="asset-source" value="${escapeAttribute(entry.source)}" placeholder="local:/example/file.bin">
                <button type="submit" name="remove-entry-index" value="${index}" aria-label="Delete mapping ${index + 1}" title="Delete mapping"><i aria-hidden="true">delete</i></button>
              </li>
            `).join('')}
          </ul>
        </fieldset>
        <footer>
          <button type="submit" name="intent" value="add-entry"><i aria-hidden="true">add</i> Add mapping</button>
          <button type="submit" name="intent" value="save" class="accent">Save</button>
        </footer>
      `
    }

    const popup = popupManager.showPopup({
      title: 'Asset Sources',
      content: form,
      size: 'medium',
    })

    form.onsubmit = async (event) => {
      event.preventDefault()
      syncDraftFromForm()

      const submitter = event.submitter
      const formData = new FormData(form, submitter || undefined)
      const intent = formData.has('remove-entry-index')
        ? `remove-entry:${String(formData.get('remove-entry-index') || '')}`
        : String(formData.get('intent') || 'save')

      if (intent === 'add-entry') {
        draft.push({ assetPath: '', source: '' })
        renderForm()
        return
      }

      if (intent.startsWith('remove-entry:')) {
        const index = Number(intent.split(':')[1])
        draft.splice(index, 1)
        if (draft.length === 0) {
          draft.push({ assetPath: '', source: '' })
        }
        renderForm()
        return
      }

      const normalizedEntries = []
      const seenAssetPaths = new Set()
      for (const entry of draft) {
        const assetPath = String(entry.assetPath || '').trim()
        const source = String(entry.source || '').trim()
        if (!assetPath && !source) continue
        if (!assetPath || !source) {
          toast.error('Each asset mapping needs both a key and a value.')
          return
        }
        if (seenAssetPaths.has(assetPath)) {
          toast.error(`Duplicate asset path: ${assetPath}`)
          return
        }
        seenAssetPaths.add(assetPath)
        normalizedEntries.push({ assetPath, source })
      }

      try {
        await this._saveAssetSourcesToStorage(normalizedEntries)
        this._assetSources = createAssetSources(normalizedEntries.map(({ assetPath, source }) => [assetPath, source]))
        await this._reloadPlugin()
        toast.success('Saved asset sources.')
        popup.close()
      } catch (error) {
        toast.error(`Failed to save asset sources: ${String(error?.message || error)}`)
      }
    }

    renderForm()
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
    this.canvas.addEventListener('blur', this._boundBlur)
  }

  teardownInputHandlers() {
    this.canvas.removeEventListener('pointerdown', this._boundPointerDown)
    this.canvas.removeEventListener('pointermove', this._boundPointerMove)
    this.canvas.removeEventListener('pointerup', this._boundPointerUp)
    this.canvas.removeEventListener('wheel', this._boundWheel)
    this.canvas.removeEventListener('keydown', this._boundKeyDown)
    this.canvas.removeEventListener('keyup', this._boundKeyUp)
    this.canvas.removeEventListener('blur', this._boundBlur)
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

    const entries = Array.from(this._assetSources.entries())
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
      js_log: (level, tagPtr, tagLen, messagePtr, messageLen) => {
        const tag = this._readWasmUtf8(tagPtr, tagLen)
        const message = this._readWasmUtf8(messagePtr, messageLen)
        const prefix = tag ? `[${tag}]` : '[game2]'
        if ((level >>> 0) >= 3) {
          console.error(prefix, message)
        } else if ((level >>> 0) === 2) {
          console.warn(prefix, message)
        } else if ((level >>> 0) === 0) {
          console.debug(prefix, message)
        } else {
          console.info(prefix, message)
        }
      },

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
    if (typeof ex.event_offset_action_code === 'function') {
      offsets.action_code = Number(ex.event_offset_action_code())
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
    if (window.keybindingManager?.enabled) {
      return
    }

    const actionCode = this._actionByKey.get(this._normalizeKeyForBinding(e))
    if (!actionCode) return
    e.preventDefault()
    this._dispatchActionEvent(actionCode, true)
  }

  onKeyUp(e) {
    const actionCode = this._actionByKey.get(this._normalizeKeyForBinding(e))
    if (!actionCode) return
    e.preventDefault()
    this._dispatchActionEvent(actionCode, false)
  }

  _normalizeKeyForBinding(event) {
    const manager = window.keybindingManager
    if (manager && typeof manager.normalizeKey === 'function') {
      return manager.normalizeKey(event)
    }
    return event.key || null
  }

  _refreshActionBindings() {
    this._actionByKey.clear()

    const manager = window.keybindingManager
    if (!manager || typeof manager.getKeybindingCatalog !== 'function') {
      for (const binding of this.constructor.keybindings || []) {
        const actionCode = ACTION_BY_EVENT_NAME.get(binding.eventName)
        if (!actionCode || !binding.defaultKeys) continue
        this._actionByKey.set(binding.defaultKeys, actionCode)
      }
      return
    }

    const catalog = manager.getKeybindingCatalog()
    for (const binding of catalog) {
      if (binding.source !== 'game-runner') continue
      if (!binding.sourceEnabled || !binding.enabled || !binding.keys) continue
      const actionCode = ACTION_BY_EVENT_NAME.get(binding.eventName)
      if (!actionCode) continue
      this._actionByKey.set(binding.keys, actionCode)
    }
  }

  _dispatchActionEvent(actionCode, isDown) {
    if (!this.memory || !this.exports || typeof this.exports.event !== 'function') {
      return
    }
    if (typeof this.exports.get_event_buffer !== 'function') {
      return
    }

    if (isDown) {
      if (this._pressedActions.has(actionCode)) return
      this._pressedActions.add(actionCode)
    } else {
      if (!this._pressedActions.has(actionCode)) return
      this._pressedActions.delete(actionCode)
    }

    const eventPtr = this._getEventBufferPtr()
    if (!eventPtr) return

    const view = new DataView(this.memory.buffer)
    const o = this._eventOffsets || FALLBACK_EVENT_OFFSETS
    writeU64(view, eventPtr + o.frame_count, this._eventFrameCount++)
    view.setUint32(eventPtr + o.type, isDown ? EVENT_TYPE_ACTION_DOWN : EVENT_TYPE_ACTION_UP, true)
    view.setUint32(eventPtr + o.action_code, actionCode, true)
    this.exports.event(eventPtr)
  }

  _releaseAllActions() {
    if (this._pressedActions.size === 0) return
    for (const actionCode of Array.from(this._pressedActions)) {
      this._dispatchActionEvent(actionCode, false)
    }
  }

  handleKeybinding(eventName) {
    const actionCode = ACTION_BY_EVENT_NAME.get(eventName)
    if (!actionCode) return false
    this._dispatchActionEvent(actionCode, true)
    return true
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
