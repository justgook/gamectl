import { toast } from '../systems/toast.js'
import { parseCSVLines } from '../util/csv.js'
import { decode as decodeQOI } from '../util/qoi/decode.js'
import { ViewFiles } from './view-files.js'
import { ViewCanvasBase } from './view-canvas-base.js'

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default class ViewStbEditor extends ViewCanvasBase {
  static get viewMeta() {
    return { displayName: 'STB Tilemap Editor', category: 'Tiles' }
  }

  constructor() {
    super()

    this.plugin = null
    this.wasm = null
    this.memory = null
    this.exports = null
    this.tilemap = 0
    this.uiPtr = 0

    this.defaultTileSize = 16
    this.tileSize = 16
    this.mapWidth = 20
    this.mapHeight = 15
    this.layers = 3
    this.currentTool = 1
    this.selectedLayer = -1
    this.selectedTilesetFilter = null
    this.showGrid = true
    this.hoverX = -1
    this.hoverY = -1

    this.offsets = {}
    this.tileSprites = new Map()
    this.layerNames = []
    this.tileSets = []
    this.fallbackTileCount = 64
    this.paletteTileCount = 64

    this.dragStartX = -1
    this.dragStartY = -1
    this.dragEndX = -1
    this.dragEndY = -1
    this.showDragPreview = false

    this.autoFitOnLoad = false
    this.mapCanvas = null
    this.mapCtx = null
    this.isToolDragging = false
    this.isAreaDragging = false
    this.boundWindowMouseUp = this.handleWindowMouseUp.bind(this)
    this.boundCanvasContextMenu = this.handleCanvasContextMenu.bind(this)
    this._initToken = 0
    this._storagePopup = null
    this.loadedMapName = ''
  }

  connectedCallback() {
    super.connectedCallback()
    this.bindEditorControls()
    const initToken = ++this._initToken
    this.init(initToken).then(() => {
      if (!this.isInitActive(initToken)) return
      this.loadDefaultDemoMap().catch((err) => {
        if (!this.isInitActive(initToken)) return
        console.warn('[stb-editor] default map load skipped:', err)
      })
    }).catch((err) => {
      if (!this.isInitActive(initToken)) return
      this.log(`Initialization failed: ${err.message}`)
      console.error(err)
    })
  }

  disconnectedCallback() {
    if (this._storagePopup) {
      this._storagePopup.close()
      this._storagePopup = null
    }
    this._initToken += 1
    this.cleanup()
    super.disconnectedCallback()
  }

  createHeaderControlsElement() {
    const controls = document.createElement('div')
    controls.innerHTML = `
      <div role="buttongroup" aria-label="Editing tools">
        <button data-tool="1" title="Brush tool" aria-label="Brush tool">
          <i aria-hidden="true">brush</i>
        </button>
        <button data-tool="0" title="Select tool" aria-label="Select tool">
          <i aria-hidden="true">select</i>
        </button>
        <button data-tool="2" title="Erase tool" aria-label="Erase tool">
          <i aria-hidden="true">ink_eraser</i>
        </button>
        <button data-tool="3" title="Eyedropper tool" aria-label="Eyedropper tool">
          <i aria-hidden="true">colorize</i>
        </button>
      </div>
      <span role="separator" aria-hidden="true"></span>
      <button data-id="undo-btn" title="Undo" aria-label="Undo">
        <i aria-hidden="true">undo</i>
      </button>
      <button data-id="redo-btn" title="Redo" aria-label="Redo">
        <i aria-hidden="true">redo</i>
      </button>
      <button data-id="cut-btn" title="Cut" aria-label="Cut">
        <i aria-hidden="true">content_cut</i>
      </button>
      <button data-id="copy-btn" title="Copy" aria-label="Copy">
        <i aria-hidden="true">content_copy</i>
      </button>
      <button data-id="paste-btn" title="Paste" aria-label="Paste">
        <i aria-hidden="true">content_paste</i>
      </button>
      <button data-id="clear-btn" title="Clear map" aria-label="Clear map">
        <i aria-hidden="true">delete_sweep</i>
      </button>
      <button data-id="save-btn" title="Save tilemap" aria-label="Save tilemap">
        <i aria-hidden="true">save</i>
      </button>
      <button data-id="load-btn" title="Load tilemap" aria-label="Load tilemap">
        <i aria-hidden="true">folder_open</i>
      </button>
      <span role="separator" aria-hidden="true"></span>
      <button data-id="grid-btn" title="Toggle grid" aria-label="Toggle grid">
        <i aria-hidden="true">grid_on</i>
      </button>
      <button data-id="fit-btn" title="Fit map to viewport" aria-label="Fit map to viewport">
        <i aria-hidden="true">fit_screen</i>
      </button>
      <button data-id="settings-btn" title="Map settings" aria-label="Map settings">
        <i aria-hidden="true">settings</i>
      </button>
    `
    return controls
  }

  headerControl(id) {
    return this.queryHeaderControl(`[data-id="${id}"]`)
  }

  headerControlButtons(selector) {
    const root = this._headerControlsElement
    if (!root) return []
    return [...root.querySelectorAll(selector)]
  }

  isInitActive(initToken) {
    return this.isConnected && initToken === this._initToken
  }

  async init(initToken = this._initToken) {
    try {
      this.log('Initializing editor...')
      this.ensureMapCanvas()
      this.canvas.removeEventListener('contextmenu', this.boundCanvasContextMenu)
      this.canvas.addEventListener('contextmenu', this.boundCanvasContextMenu)
      window.removeEventListener('mouseup', this.boundWindowMouseUp)
      window.addEventListener('mouseup', this.boundWindowMouseUp)

      const memory = new WebAssembly.Memory({
        initial: 288,
        maximum: 512,
        shared: true
      })

      this.plugin = await window.pluginManager.load({
        name: 'stbte',
        importObject: { env: { memory } }
      })
      if (!this.isInitActive(initToken)) throw new Error('Editor detached during initialization')

      this.wasm = this.plugin.instance
      this.memory = memory
      this.exports = this.plugin.exports

      this.loadOffsets()

      this.tilemap = this.exports.stbte_create(
        this.mapWidth,
        this.mapHeight,
        this.layers,
        this.tileSize,
        this.tileSize,
        1024
      )

      if (!this.tilemap) {
        throw new Error('stbte_create returned null pointer')
      }

      await this.ensureTilesetCounts()
      await this.defineTilesFromAtlases()
      if (!this.isInitActive(initToken)) throw new Error('Editor detached during initialization')

      this.setupLayers()
      this.setupTilesetTabs()
      this.setupTiles()
      this.updateMetadata()
      this.contentBounds = this.calculateContentBounds()
      this.renderMap()
      this.fitToContent()

      this.log(`Ready. ${this.tileSprites.size} tile sprites loaded.`)
    } catch (err) {
      this.cleanup()
      this.log(`Error: ${err.message}`)
      throw err
    }
  }

  cleanup() {
    if (this.canvas) {
      this.canvas.removeEventListener('contextmenu', this.boundCanvasContextMenu)
    }
    window.removeEventListener('mouseup', this.boundWindowMouseUp)

    try {
      if (this.exports && this.tilemap) {
        this.exports.stbte_destroy(this.tilemap)
      }
    } catch (err) {
      console.warn('[stb-editor] destroy failed:', err)
    }

    this.tilemap = 0
    this.uiPtr = 0
    this.exports = null
    this.memory = null
    this.wasm = null
    this.mapCtx = null
    this.mapCanvas = null
    this.isToolDragging = false
    this.isAreaDragging = false

    if (this.plugin) {
      window.pluginManager.unload(this.plugin)
      this.plugin = null
    }
  }

  setupUI() {
    this.sidePanel = document.createElement('aside')

    this.sidePanel.innerHTML = `
          <fieldset>
            <legend>Layers</legend>
            <div data-id="layers"></div>
          </fieldset>

          <fieldset>
            <legend>Tiles</legend>
            <div data-id="tile-tabs" role="tablist" aria-label="Tilesets">
            <button>new</button>
          </div>
            <div data-id="tiles" role="tabpanel" id="stb-tiles-panel"></div>
          </fieldset>

          <fieldset>
            <legend>Metadata</legend>
            <dl data-id="meta" style="display: grid; grid-template-columns: auto auto;"></dl>
          </fieldset>

          <fieldset>
            <legend>Output</legend>
            <pre style="overflow:auto" data-id="output">Loading WASM...</pre>
          </fieldset>
    `
    this.appendChild(this.sidePanel)
  }

  el(id) {
    return this.querySelector(`[data-id="${id}"]`)
  }


  log(message) {
    const output = this.el('output')
    output.textContent += `${message}\n`
    output.scrollTop = output.scrollHeight
  }

  ensureMapCanvas() {
    if (this.mapCanvas && this.mapCtx) return
    if (typeof OffscreenCanvas !== 'function') {
      toast.error('OffscreenCanvas is required for the STB editor.')
      throw new Error('OffscreenCanvas is not available')
    }

    this.mapCanvas = new OffscreenCanvas(1, 1)
    this.mapCtx = this.mapCanvas.getContext('2d')
    this.mapCtx.imageSmoothingEnabled = false
  }

  _onResized() {
    if (!this.canvas) return

    const sidepanelWidth = Math.round(this.sidePanel.getBoundingClientRect().width)
    const width = Math.max(0, Math.round(this.clientWidth) - sidepanelWidth)
    const height = Math.round(this.clientHeight)
    if (width <= 0 || height <= 0) return
    if (this.canvas.width === width && this.canvas.height === height) return

    this.canvas.width = width
    this.canvas.height = height
    this.draw()
    this._tryAutoFit()
  }

  calculateContentBounds() {
    return {
      minX: 0,
      minY: 0,
      maxX: Math.max(1, this.mapWidth * this.tileSize),
      maxY: Math.max(1, this.mapHeight * this.tileSize)
    }
  }

  drawContent(ctx) {
    if (!this.mapCanvas) return

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.mapCanvas, 0, 0)

    if (this.showDragPreview) {
      this.drawDragPreview(ctx)
    }
  }

  zoom(x, y, factor) {
    super.zoom(x, y, factor)
    this.updateMetadata()
  }

  fitToContent() {
    const didFit = super.fitToContent()
    this.updateMetadata()
    return didFit
  }

  loadOffsets() {
    const names = [
      'stbte_offset_tilemap_max_x', 'stbte_offset_tilemap_max_y',
      'stbte_offset_tilemap_num_layers', 'stbte_offset_tilemap_num_tiles',
      'stbte_offset_tilemap_cur_tile', 'stbte_offset_tilemap_cur_layer',
      'stbte_offset_tilemap_solo_layer', 'stbte_offset_tilemap_cur_category',
      'stbte_offset_tilemap_background_tile', 'stbte_offset_tilemap_num_categories',
      'stbte_offset_tilemap_data', 'stbte_offset_tilemap_tiles',
      'stbte_offset_tilemap_layerinfo', 'stbte_offset_tilemap_undo_available',
      'stbte_offset_tilemap_redo_available', 'stbte_offset_layer_hidden',
      'stbte_offset_layer_locked', 'stbte_offset_tileinfo_id',
      'stbte_offset_tileinfo_layermask', 'stbte_offset_tileinfo_category_id',
      'stbte_offset_ui_tool', 'stbte_offset_ui_has_selection',
      'stbte_offset_ui_has_copy'
    ]

    names.forEach((name) => {
      this.offsets[name.replace('stbte_offset_', '').replace('tilemap_', 'tm_')] = this.exports[name]()
    })

    this.offsets.sizeof_layer = this.exports.stbte_sizeof_layer()
    this.offsets.sizeof_tileinfo = this.exports.stbte_sizeof_tileinfo()
    this.offsets.max_map_x = this.exports.stbte_max_map_x()
    this.offsets.max_layers = this.exports.stbte_max_layers()
    this.uiPtr = this.exports.stbte_ui_ptr()
  }

  async defineTilesFromAtlases() {
    this.tileSprites = new Map()

    const tileSetRanges = this.getTilesetRanges()
    let nextTileId = 0

    for (let tileSetIndex = 0; tileSetIndex < tileSetRanges.length; tileSetIndex++) {
      const entry = tileSetRanges[tileSetIndex]
      const tileSet = entry.tileSet
      let image
      let cols
      let rows

      try {
        image = await this.loadTilesetImage(tileSet.file)
        cols = Math.max(1, Math.floor(image.width / this.tileSize))
        rows = Math.max(1, Math.floor(image.height / this.tileSize))
      } catch (err) {
        const generated = this.generateFallbackTileset(tileSetIndex, entry.startTileId, entry.count)
        image = generated.image
        cols = generated.cols
        rows = generated.rows
        this.log(`Generated fallback tileset for ${this.deriveTilesetName(tileSet)}`)
        console.warn('[stb-editor] tileset fallback:', err)
      }

      for (let y = 0; y < rows && nextTileId < entry.endTileId; y++) {
        for (let x = 0; x < cols && nextTileId < entry.endTileId; x++) {
          const tileId = nextTileId++
          this.tileSprites.set(tileId, {
            image,
            sx: x * this.tileSize,
            sy: y * this.tileSize,
            sw: this.tileSize,
            sh: this.tileSize,
            tilesetIndex: tileSetIndex
          })
        }
      }

      this.log(`Loaded ${tileSet.file || this.deriveTilesetName(tileSet)} (${entry.count} tiles)`)
    }

    const restRange = this.getRestRange()
    if (restRange) {
      const generated = this.generateFallbackTileset(this.tileSets.length, restRange.startTileId, restRange.count)
      let tileId = restRange.startTileId
      for (let y = 0; y < generated.rows && tileId < restRange.endTileId; y++) {
        for (let x = 0; x < generated.cols && tileId < restRange.endTileId; x++) {
          this.tileSprites.set(tileId, {
            image: generated.image,
            sx: x * this.tileSize,
            sy: y * this.tileSize,
            sw: this.tileSize,
            sh: this.tileSize,
            tilesetIndex: -1
          })
          tileId += 1
        }
      }
      if (this.tileSets.length === 0) {
        this.log(`Generated fallback tileset (${restRange.count} tiles)`)
      } else {
        this.log(`Generated rest tiles (${restRange.count} tiles)`)
      }
    }

    this.defineFlatWasmTilePalette()
    this.exports.stbte_set_active_tile(this.tilemap, 0)
  }

  defineFlatWasmTilePalette() {
    const paletteCount = Math.max(1, this.getPaletteTileCount())
    const layerMask = this.layers >= 31 ? 0x7FFFFFFF : ((1 << this.layers) - 1)
    for (let tileId = 0; tileId < paletteCount; tileId++) {
      this.exports.stbte_define_tile(this.tilemap, tileId, layerMask, 0)
    }
  }

  getPaletteTileCount() {
    const coveredCount = this.getTilesetCoverageCount()
    return Math.max(1, this.paletteTileCount, this.fallbackTileCount, coveredCount)
  }

  getTilesetCoverageCount() {
    return this.tileSets.reduce((sum, tileSet) => sum + Math.max(0, Number(tileSet?.count) || 0), 0)
  }

  getTilesetRanges() {
    return this.getTilesetRangesFor(this.tileSets)
  }

  getTilesetRangesFor(tileSets) {
    let nextTileId = 0
    return tileSets.map((tileSet, index) => {
      const count = Math.max(0, Number(tileSet?.count) || 0)
      const entry = {
        key: `tileset:${index}`,
        kind: 'tileset',
        index,
        tileSet,
        label: this.deriveTilesetName(tileSet),
        startTileId: nextTileId,
        endTileId: nextTileId + count,
        count
      }
      nextTileId += count
      return entry
    }).filter((entry) => entry.count > 0)
  }

  getRestRange() {
    const coveredCount = this.getTilesetCoverageCount()
    const paletteCount = this.getPaletteTileCount()
    if (paletteCount <= coveredCount) return null
    return {
      key: 'rest',
      kind: 'rest',
      label: this.tileSets.length > 0 ? 'rest' : 'tiles',
      startTileId: coveredCount,
      endTileId: paletteCount,
      count: paletteCount - coveredCount
    }
  }

  getTilePaletteTabs() {
    const tabs = this.getTilesetRanges()
    const restRange = this.getRestRange()
    if (restRange && this.tileSets.length > 0) tabs.push(restRange)
    return tabs
  }

  getSelectedTileTab() {
    const tabs = this.getTilePaletteTabs()
    if (tabs.length === 0) return null
    return tabs.find((entry) => entry.key === this.selectedTilesetFilter) || tabs[0]
  }

  async ensureTilesetCounts(forceRecompute = false, tileSize = this.tileSize) {
    for (const tileSet of this.tileSets) {
      if (!forceRecompute && (Number(tileSet?.count) || 0) > 0) continue
      try {
        tileSet.count = await this.inferTilesetCount(tileSet.file, tileSize)
      } catch (_err) {
        tileSet.count = 1
      }
    }
    this.paletteTileCount = Math.max(this.paletteTileCount, this.getTilesetCoverageCount(), this.fallbackTileCount)
  }

  generateFallbackTileset(tileSetIndex, startTileId, tileCount) {
    const count = Math.max(1, tileCount)
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
    const rows = Math.max(1, Math.ceil(count / cols))
    const canvas = document.createElement('canvas')
    canvas.width = cols * this.tileSize
    canvas.height = rows * this.tileSize
    const ctx = canvas.getContext('2d')

    ctx.imageSmoothingEnabled = false
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${Math.max(8, Math.floor(this.tileSize * 0.42))}px monospace`

    for (let i = 0; i < count; i++) {
      const x = (i % cols) * this.tileSize
      const y = Math.floor(i / cols) * this.tileSize
      const hue = (tileSetIndex * 61 + i * 37) % 360

      ctx.fillStyle = `hsl(${hue} 55% 48%)`
      ctx.fillRect(x, y, this.tileSize, this.tileSize)
      ctx.fillStyle = `hsl(${(hue + 22) % 360} 65% 30%)`
      ctx.fillRect(x + 1, y + 1, this.tileSize - 2, this.tileSize - 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.strokeRect(x + 0.5, y + 0.5, this.tileSize - 1, this.tileSize - 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(startTileId + i + 1), x + this.tileSize / 2, y + this.tileSize / 2)
    }

    return { image: canvas, cols, rows }
  }

  deriveTilesetName(tileSet) {
    const explicit = String(tileSet?.name || '').trim()
    if (explicit) return explicit

    const file = String(tileSet?.file || '').trim()
    const base = file.split('/').pop() || file
    return base.replace(/\.[^.]+$/, '') || 'tileset'
  }

  async loadTilesetImage(file) {
    const source = String(file || '').trim()
    if (!source) throw new Error('Missing tileset file')
    if (source.startsWith('data:') || source.startsWith('http://') || source.startsWith('https://')) {
      return this.loadImageFromUrl(source)
    }
    return this.loadImageFromFile(source)
  }

  async loadImageFromFile(path) {
    const result = await window.pluginManager.call('fs', 'read', path)
    if (result.returnCode !== 0) {
      throw new Error(`Failed to read tileset file: ${new TextDecoder().decode(result.output)}`)
    }

    const data = result.output || new Uint8Array()
    if (data.length >= 4 && data[0] === 0x71 && data[1] === 0x6f && data[2] === 0x69 && data[3] === 0x66) {
      const decoded = decodeQOI(data.buffer)
      const imageData = new ImageData(
        new Uint8ClampedArray(decoded.data.buffer),
        decoded.width,
        decoded.height
      )
      return createImageBitmap(imageData)
    }

    const blob = new Blob([data], { type: 'image/png' })
    return createImageBitmap(blob)
  }

  loadImageFromUrl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
      img.src = src
    })
  }

  readTilemap(offset, type = 'i32') {
    const view = new DataView(this.memory.buffer, this.tilemap + offset)
    if (type === 'i8') return view.getInt8(0)
    if (type === 'i16') return view.getInt16(0, true)
    return view.getInt32(0, true)
  }

  readUI(offset, type = 'i32') {
    const view = new DataView(this.memory.buffer, this.uiPtr + offset)
    if (type === 'i8') return view.getInt8(0)
    if (type === 'i16') return view.getInt16(0, true)
    return view.getInt32(0, true)
  }

  getNumTiles() { return this.readTilemap(this.offsets.tm_num_tiles, 'i32') }
  getNumCategories() { return this.readTilemap(this.offsets.tm_num_categories, 'i32') }
  getCurrentCategory() { return this.readTilemap(this.offsets.tm_cur_category, 'i32') }
  getCurrentTile() { return this.readTilemap(this.offsets.tm_cur_tile, 'i32') }
  canUndo() { return this.readTilemap(this.offsets.tm_undo_available, 'i8') !== 0 }
  canRedo() { return this.readTilemap(this.offsets.tm_redo_available, 'i8') !== 0 }

  bindEditorControls() {
    this.headerControlButtons('[data-tool]').forEach((btn) => {
      btn.onclick = () => {
        if (!this.exports || !this.tilemap) return
        this.currentTool = parseInt(btn.dataset.tool, 10)
        this.exports.stbte_set_tool(this.tilemap, this.currentTool)
        this.updateControlStates()
        this.updateMetadata()
      }
    })

    this.headerControl('undo-btn').onclick = () => {
      if (!this.exports || !this.tilemap) return
      this.exports.stbte_undo(this.tilemap)
      this.postAction()
    }

    this.headerControl('redo-btn').onclick = () => {
      if (!this.exports || !this.tilemap) return
      this.exports.stbte_redo(this.tilemap)
      this.postAction()
    }

    this.headerControl('cut-btn').onclick = () => {
      if (!this.exports || !this.tilemap) return
      this.exports.stbte_cut(this.tilemap)
      this.postAction()
    }

    this.headerControl('copy-btn').onclick = () => {
      if (!this.exports || !this.tilemap) return
      this.exports.stbte_copy(this.tilemap)
      this.updateMetadata()
      this.log('Copied selection')
    }

    this.headerControl('paste-btn').onclick = () => {
      if (!this.exports || !this.tilemap) return
      const cx = Math.floor(this.mapWidth / 2)
      const cy = Math.floor(this.mapHeight / 2)
      this.exports.stbte_paste(this.tilemap, cx, cy)
      this.postAction()
    }

    this.headerControl('clear-btn').onclick = () => {
      if (!this.exports || !this.tilemap) return
      this.exports.stbte_clear(this.tilemap)
      this.postAction()
    }

    this.headerControl('save-btn').onclick = () => {
      this.showSaveTilemapPopup().catch((err) => {
        this.log(`Save failed: ${err.message}`)
        console.error('[stb-editor] save failed:', err)
      })
    }

    this.headerControl('load-btn').onclick = () => {
      this.showLoadTilemapPopup().catch((err) => {
        this.log(`Load failed: ${err.message}`)
        console.error('[stb-editor] load failed:', err)
      })
    }

    this.headerControl('grid-btn').onclick = () => {
      this.showGrid = !this.showGrid
      this.renderMap()
      this.draw()
      this.updateControlStates()
      this.updateMetadata()
    }

    this.headerControl('fit-btn').onclick = () => {
      this.fitToContent()
      this.updateMetadata()
    }

    this.headerControl('settings-btn').onclick = () => {
      this.showMapSettingsPopup().catch((err) => {
        this.log(`Settings update failed: ${err.message}`)
        console.error('[stb-editor] settings failed:', err)
      })
    }

    this.updateControlStates()
  }

  updateControlStates() {
    this.headerControlButtons('[data-tool]').forEach((btn) => {
      const isActive = parseInt(btn.dataset.tool, 10) === this.currentTool
      btn.classList.toggle('active', isActive)
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false')
    })

    const gridBtn = this.headerControl('grid-btn')
    if (gridBtn) {
      gridBtn.classList.toggle('active', this.showGrid)
      gridBtn.setAttribute('aria-pressed', this.showGrid ? 'true' : 'false')
    }
  }

  postAction() {
    this.renderMap()
    this.draw()
    this.updateMetadata()
    this.setupLayers()
    this.setupTilesetTabs()
    this.setupTiles()
    const undoBtn = this.headerControl('undo-btn')
    const redoBtn = this.headerControl('redo-btn')
    if (undoBtn) undoBtn.disabled = !this.canUndo()
    if (redoBtn) redoBtn.disabled = !this.canRedo()
  }

  saveData() {
    return this.showSaveTilemapPopup()
  }

  isAreaDragEvent(e) {
    return this.currentTool === 0 || (e.shiftKey && (this.currentTool === 1 || this.currentTool === 2))
  }

  getWorldPosition(e) {
    const rect = this.canvas.getBoundingClientRect()
    const bitmapX = (e.clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width))
    const bitmapY = (e.clientY - rect.top) * (this.canvas.height / Math.max(1, rect.height))
    return {
      x: (bitmapX - this.offsetX) / this.scale,
      y: (bitmapY - this.offsetY) / this.scale
    }
  }

  eventToCell(e) {
    const { x, y } = this.getWorldPosition(e)
    return {
      x: Math.floor(x / this.tileSize),
      y: Math.floor(y / this.tileSize)
    }
  }

  onCanvasMouseDown(e) {
    if (e.button !== 0) return
    if (!this.exports || !this.tilemap) return

    const { x, y } = this.eventToCell(e)
    if (!this.isInsideMap(x, y)) return

    this.isToolDragging = true
    this.dragStartX = x
    this.dragStartY = y

    if (this.isAreaDragEvent(e)) {
      this.isAreaDragging = true
      this.dragEndX = x
      this.dragEndY = y
      this.showDragPreview = true
      this.draw()
      return
    }

    this.isAreaDragging = false
    this.showDragPreview = false
    this.exports.stbte_apply(this.tilemap, x, y, x, y)
    this.postAction()
  }

  onCanvasMouseMove(e) {
    const { x, y } = this.eventToCell(e)
    this.hoverX = x
    this.hoverY = y
    this.updateMetadata()

    if (!this.isToolDragging || !this.isInsideMap(x, y) || !this.exports || !this.tilemap) return

    if (this.isAreaDragging) {
      this.dragEndX = x
      this.dragEndY = y
      this.draw()
      return
    }

    if (this.currentTool === 1 || this.currentTool === 2) {
      this.exports.stbte_apply(this.tilemap, x, y, x, y)
      this.renderMap()
      this.draw()
      this.updateMetadata()
    }
  }

  onCanvasMouseUp(e) {
    this.finishCanvasDrag(e)
  }

  handleWindowMouseUp(e) {
    this.finishCanvasDrag(e)
  }

  finishCanvasDrag(e) {
    if (this.isToolDragging && this.isAreaDragging && this.exports && this.tilemap) {
      const { x, y } = this.eventToCell(e)
      const ex = this.clamp(x, 0, this.mapWidth - 1)
      const ey = this.clamp(y, 0, this.mapHeight - 1)
      this.exports.stbte_apply(this.tilemap, this.dragStartX, this.dragStartY, ex, ey)
      this.showDragPreview = false
      this.postAction()
    }

    this.isToolDragging = false
    this.isAreaDragging = false
  }

  _onMouseLeave() {
    super._onMouseLeave()
    this.hoverX = -1
    this.hoverY = -1
    this.updateMetadata()
  }

  handleCanvasContextMenu(e) {
    e.preventDefault()
  }

  isInsideMap(x, y) {
    return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight
  }

  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
  }

  setupLayers() {
    const container = this.el('layers')
    container.innerHTML = ''

    for (let i = this.layers - 1; i >= 0; i--) {
      const layerOffset = this.tilemap + this.offsets.tm_layerinfo + (i * this.offsets.sizeof_layer)
      const hidden = new DataView(this.memory.buffer, layerOffset + this.offsets.layer_hidden, 4).getInt32(0, true) !== 0
      const locked = new DataView(this.memory.buffer, layerOffset + this.offsets.layer_locked, 4).getInt32(0, true) !== 0
      const soloLayer = this.readTilemap(this.offsets.tm_solo_layer, 'i32')
      const isSolo = soloLayer === i

      const row = document.createElement('div')
      row.setAttribute('role', 'buttongroup')
      row.setAttribute('aria-label', `${this.layerNames[i] || `Layer ${i + 1}`} controls`)
      row.style.display = 'flex'
      row.style.width = '100%'

      const name = document.createElement('button')
      if (this.selectedLayer === i) name.classList.add('active')
      name.textContent = this.layerNames[i] || `Layer ${i + 1}`
      name.style.flex = '1'
      name.style.justifyContent = 'flex-start'
      name.addEventListener('click', () => {
        this.selectedLayer = this.selectedLayer === i ? -1 : i
        this.exports.stbte_set_active_layer(this.tilemap, this.selectedLayer)
        this.setupLayers()
        this.updateMetadata()
      })
      row.appendChild(name)

      const hBtn = this.makeLayerToggle('visibility_off', hidden, () => {
        this.exports.stbte_set_layer_hidden(this.tilemap, i, hidden ? 0 : 1)
        this.setupLayers()
        this.renderMap()
        this.draw()
      })
      const lBtn = this.makeLayerToggle('lock', locked, () => {
        this.exports.stbte_set_layer_locked(this.tilemap, i, locked ? 0 : 1)
        this.setupLayers()
        this.renderMap()
        this.draw()
      })
      const sBtn = this.makeLayerToggle('visibility', isSolo, () => {
        this.exports.stbte_set_solo_layer(this.tilemap, isSolo ? -1 : i)
        this.setupLayers()
        this.renderMap()
        this.draw()
      })

      row.appendChild(hBtn)
      row.appendChild(lBtn)
      row.appendChild(sBtn)
      container.appendChild(row)
    }
  }

  makeLayerToggle(label, on, click) {
    const btn = document.createElement('button')
    if (on) btn.classList.add('active')
    btn.title = label
    btn.innerHTML = `<i>${label}</i>`
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      click()
    })
    return btn
  }

  setupTiles() {
    const container = this.el('tiles')
    container.innerHTML = ''

    const tileCount = this.getPaletteTileCount()
    const currentTileIdx = this.getCurrentTile()
    const selectedTab = this.getSelectedTileTab()
    const grid = document.createElement('div')
    grid.style.cssText = 'display:grid; grid-template-columns:auto auto auto auto'
    container.appendChild(grid)

    let startTileId = 0
    let endTileId = tileCount
    if (selectedTab) {
      startTileId = selectedTab.startTileId
      endTileId = selectedTab.endTileId
    }

    for (let tileId = startTileId; tileId < endTileId; tileId++) {
      const tileIndex = tileId

      const btn = document.createElement('button')
      btn.style.cssText = "aspect-ratio:1"
      if (tileIndex === currentTileIdx) btn.classList.add('active')
      btn.title = `Tile ${tileId}`

      const preview = this.makeTilePreview(tileId)
      btn.appendChild(preview)

      const idTag = document.createElement('span')
      idTag.textContent = tileId
      btn.appendChild(idTag)

      btn.addEventListener('click', () => {
        this.exports.stbte_set_active_tile(this.tilemap, tileIndex)
        this.setupTiles()
        this.updateMetadata()
      })

      grid.appendChild(btn)
    }
  }

  setupTilesetTabs() {
    const container = this.el('tile-tabs')
    container.innerHTML = ''

    container.style.display = 'flex'
    container.style.gap = '6px'
    container.style.marginBottom = '8px'
    container.style.overflow = 'hidden'
    container.style.alignItems = 'center'

    const entries = this.getTilePaletteTabs()
    if (entries.length === 0) {
      this.selectedTilesetFilter = null
    }
    if (entries.length > 0 && !entries.some((entry) => entry.key === this.selectedTilesetFilter)) {
      this.selectedTilesetFilter = entries[0].key
    }

    for (const entry of entries) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = entry.label
      btn.title = entry.label
      btn.setAttribute('role', 'tab')
      btn.setAttribute('aria-controls', 'stb-tiles-panel')
      btn.setAttribute('aria-selected', this.selectedTilesetFilter === entry.key ? 'true' : 'false')
      btn.style.maxWidth = '110px'
      btn.style.whiteSpace = 'nowrap'
      btn.style.overflow = 'hidden'
      btn.style.textOverflow = 'ellipsis'
      if (this.selectedTilesetFilter === entry.key) btn.classList.add('active')
      btn.onclick = () => {
        this.selectedTilesetFilter = entry.key
        this.setupTilesetTabs()
        this.setupTiles()
      }
      container.appendChild(btn)
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.title = 'Add tileset'
    addBtn.setAttribute('aria-label', 'Add tileset')
    addBtn.innerHTML = '<i aria-hidden="true">add</i>'
    addBtn.onclick = () => {
      this.showAddTilesetPopup().catch((err) => {
        toast.error(`Failed to add tileset: ${String(err?.message || err)}`)
      })
    }
    container.appendChild(addBtn)
  }

  makeTilePreview(tileId) {
    const canvas = document.createElement('canvas')
    canvas.width = this.tileSize
    canvas.height = this.tileSize
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    const sprite = this.tileSprites.get(tileId)

    if (sprite) {
      ctx.drawImage(sprite.image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, 0, 0, this.tileSize, this.tileSize)
    } else {
      ctx.fillStyle = '#243042'
      ctx.fillRect(0, 0, this.tileSize, this.tileSize)
      ctx.fillStyle = '#f0f6fc'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(tileId), this.tileSize / 2, this.tileSize / 2)
    }

    return canvas
  }

  updateMetadata() {
    const toolNames = ['Select', 'Brush', 'Erase', 'Eyedropper']
    const meta = {
      map: `${this.mapWidth} x ${this.mapHeight}`,
      layers: String(this.layers),
      tool: toolNames[this.currentTool] || String(this.currentTool),
      tileIndex: this.exports ? String(this.getCurrentTile()) : '-',
      tilesLoaded: this.exports ? String(this.getNumTiles()) : '0',
      tilesets: String(this.tileSets.length),
      activeLayer: this.selectedLayer === -1 ? 'All editable' : (this.layerNames[this.selectedLayer] || `Layer ${this.selectedLayer + 1}`),
      hover: this.isInsideMap(this.hoverX, this.hoverY) ? `${this.hoverX}, ${this.hoverY}` : '-',
      undo: this.exports && this.canUndo() ? 'yes' : 'no',
      redo: this.exports && this.canRedo() ? 'yes' : 'no',
      grid: this.showGrid ? 'on' : 'off',
      selection: this.exports && this.uiPtr ? (this.readUI(this.offsets.ui_has_selection, 'i32') ? 'yes' : 'no') : 'no',
      zoom: `${Math.round(this.scale * 100)}%`,
      drag: `${Math.round(this.offsetX)}, ${Math.round(this.offsetY)}`
    }

    const root = this.el('meta')
    root.innerHTML = ''
    for (const [key, value] of Object.entries(meta)) {
      const dt = document.createElement('dt')
      dt.textContent = key
      const dd = document.createElement('dd')
      dd.textContent = value
      root.appendChild(dt)
      root.appendChild(dd)
    }

    this.updateControlStates()

    const undoBtn = this.headerControl('undo-btn')
    const redoBtn = this.headerControl('redo-btn')
    if (undoBtn) undoBtn.disabled = !(this.exports && this.canUndo())
    if (redoBtn) redoBtn.disabled = !(this.exports && this.canRedo())
  }

  renderMap() {
    if (!this.mapCanvas || !this.mapCtx || !this.tilemap || !this.memory) return

    const width = Math.max(1, this.mapWidth * this.tileSize)
    const height = Math.max(1, this.mapHeight * this.tileSize)
    if (this.mapCanvas.width !== width || this.mapCanvas.height !== height) {
      this.mapCanvas.width = width
      this.mapCanvas.height = height
      this.mapCtx = this.mapCanvas.getContext('2d')
      this.mapCtx.imageSmoothingEnabled = false
    }

    const ctx = this.mapCtx
    ctx.imageSmoothingEnabled = false

    ctx.fillStyle = '#070d14'
    ctx.fillRect(0, 0, this.mapCanvas.width, this.mapCanvas.height)

    const dataOffset = this.tilemap + this.offsets.tm_data
    const maxX = this.offsets.max_map_x
    const maxLayers = this.offsets.max_layers
    const soloLayer = this.readTilemap(this.offsets.tm_solo_layer, 'i32')

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const px = x * this.tileSize
        const py = y * this.tileSize

        ctx.fillStyle = ((x + y) % 2 === 0) ? '#0d1320' : '#0a101a'
        ctx.fillRect(px, py, this.tileSize, this.tileSize)

        for (let layer = 0; layer < this.layers; layer++) {
          const layerOffset = this.tilemap + this.offsets.tm_layerinfo + (layer * this.offsets.sizeof_layer)
          const hidden = new DataView(this.memory.buffer, layerOffset + this.offsets.layer_hidden, 4).getInt32(0, true) !== 0
          if (hidden) continue
          if (soloLayer >= 0 && layer !== soloLayer) continue

          const idx = (y * maxX + x) * maxLayers + layer
          const tileId = new Int16Array(this.memory.buffer, dataOffset + idx * 2, 1)[0]
          if (tileId < 0) continue

          const sprite = this.tileSprites.get(tileId)
          if (sprite) {
            ctx.drawImage(
              sprite.image,
              sprite.sx,
              sprite.sy,
              sprite.sw,
              sprite.sh,
              px,
              py,
              this.tileSize,
              this.tileSize
            )
          } else {
            ctx.fillStyle = '#385574'
            ctx.fillRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4)
          }
        }

        if (this.showGrid) {
          ctx.strokeStyle = '#1f2a38'
          ctx.strokeRect(px, py, this.tileSize, this.tileSize)
        }
      }
    }
  }

  drawDragPreview(ctx) {
    const ax0 = Math.min(this.dragStartX, this.dragEndX)
    const ay0 = Math.min(this.dragStartY, this.dragEndY)
    const ax1 = Math.max(this.dragStartX, this.dragEndX)
    const ay1 = Math.max(this.dragStartY, this.dragEndY)
    const px = ax0 * this.tileSize
    const py = ay0 * this.tileSize
    const pw = (ax1 - ax0 + 1) * this.tileSize
    const ph = (ay1 - ay0 + 1) * this.tileSize
    ctx.fillStyle = 'rgba(88, 166, 255, 0.16)'
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.95)'
    ctx.lineWidth = 2 / Math.max(this.scale, 0.0001)
    ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2)
    ctx.lineWidth = 1 / Math.max(this.scale, 0.0001)
  }

  encodeTopLevelProps() {
    const props = {}

    if (this.tileSets.length > 0) props.tilesets = JSON.stringify(this.tileSets)
    props.tileSize = String(this.tileSize)

    return props
  }

  exportTilemapData() {
    const layers = []

    for (let layer = 0; layer < this.layers; layer++) {
      const data = []
      for (let y = 0; y < this.mapHeight; y++) {
        for (let x = 0; x < this.mapWidth; x++) {
          const tileId = this.exports.stbte_get_tile_id(this.tilemap, x, y, layer)
          data.push(tileId < 0 ? 0 : tileId + 1)
        }
      }

      layers.push({
        width: this.mapWidth,
        data,
        props: {
          name: this.layerNames[layer] || `layer ${layer + 1}`
        }
      })
    }

    return {
      layers,
      props: this.encodeTopLevelProps()
    }
  }

  parseJsonProp(props, key, fallback) {
    const raw = props?.[key]
    if (!raw) return fallback

    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : fallback
    } catch (_err) {
      return fallback
    }
  }

  buildLoadConfig(tilemap) {
    const layers = Array.isArray(tilemap?.layers) ? tilemap.layers : []
    if (layers.length === 0) {
      throw new Error('Tilemap has no layers')
    }

    let mapWidth = 0
    let mapHeight = 0
    let maxTileId = 0
    for (const layer of layers) {
      const width = Math.max(0, Number(layer?.width) || 0)
      if (width <= 0) continue
      mapWidth = Math.max(mapWidth, width)
      const data = Array.isArray(layer?.data) ? layer.data : []
      mapHeight = Math.max(mapHeight, Math.ceil(data.length / width))
      for (const value of data) {
        maxTileId = Math.max(maxTileId, Math.max(0, Number(value) || 0))
      }
    }

    if (mapWidth <= 0 || mapHeight <= 0) {
      throw new Error('Tilemap has invalid dimensions')
    }

    const props = tilemap?.props || {}
    const parsedTileSets = this.parseJsonProp(props, 'tilesets', [])
    const hasModernSizing = props.tileSize != null
    const isLegacyFormat = !hasModernSizing
    return {
      mapWidth,
      mapHeight,
      layers: layers.length,
      tileSize: isLegacyFormat ? this.defaultTileSize : Math.max(1, Number(props.tileSize) || this.defaultTileSize),
      tileSets: parsedTileSets,
      layerNames: layers.map((layer, index) => isLegacyFormat ? `layer ${index + 1}` : String(layer?.props?.name || `layer ${index + 1}`)),
      fallbackTileCount: Math.max(1, maxTileId || this.fallbackTileCount),
      paletteTileCount: Math.max(1, maxTileId || this.fallbackTileCount, parsedTileSets.reduce((sum, tileSet) => sum + Math.max(0, Number(tileSet?.count) || 0), 0))
    }
  }

  async applyLoadedTilemap(tilemap) {
    const config = this.buildLoadConfig(tilemap)

    this.cleanup()
    this.mapWidth = config.mapWidth
    this.mapHeight = config.mapHeight
    this.layers = config.layers
    this.tileSize = config.tileSize
    this.tileSets = config.tileSets
    this.layerNames = config.layerNames
    this.fallbackTileCount = config.fallbackTileCount
    this.paletteTileCount = config.paletteTileCount
    this.tileSprites = new Map()
    this.selectedLayer = -1
    this.selectedTilesetFilter = null
    this.currentTool = 1
    this.hoverX = -1
    this.hoverY = -1
    this.showDragPreview = false

    await this.init()
    this.exports.stbte_clear(this.tilemap)

    tilemap.layers.forEach((layer, layerIndex) => {
      const width = Number(layer?.width) || 0
      const data = Array.isArray(layer?.data) ? layer.data : []
      if (width <= 0) return

      data.forEach((value, index) => {
        const x = index % width
        const y = Math.floor(index / width)
        if (!this.isInsideMap(x, y)) return

        const encoded = Number(value) || 0
        const tileId = encoded <= 0 ? -1 : encoded - 1
        this.exports.stbte_set_tile(this.tilemap, x, y, layerIndex, tileId)
      })
    })

    this.postAction()
  }

  async rebuildEditorFromCurrentState() {
    const editorState = this.captureEditorState()
    const snapshot = this.exportTilemapData()
    const loadedMapName = this.loadedMapName
    await this.applyLoadedTilemap(snapshot)
    this.loadedMapName = loadedMapName
    this.restoreEditorState(editorState)
  }

  captureEditorState() {
    const layers = []
    if (this.exports && this.tilemap && this.memory) {
      for (let i = 0; i < this.layers; i++) {
        const layerOffset = this.tilemap + this.offsets.tm_layerinfo + (i * this.offsets.sizeof_layer)
        layers.push({
          hidden: new DataView(this.memory.buffer, layerOffset + this.offsets.layer_hidden, 4).getInt32(0, true) !== 0,
          locked: new DataView(this.memory.buffer, layerOffset + this.offsets.layer_locked, 4).getInt32(0, true) !== 0
        })
      }
    }

    return {
      currentTool: this.currentTool,
      currentTile: this.exports ? this.getCurrentTile() : 0,
      selectedLayer: this.selectedLayer,
      selectedTilesetFilter: this.selectedTilesetFilter,
      soloLayer: this.exports ? this.readTilemap(this.offsets.tm_solo_layer, 'i32') : -1,
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      showGrid: this.showGrid,
      layers
    }
  }

  restoreEditorState(state) {
    if (!state || !this.exports || !this.tilemap) return

    this.currentTool = state.currentTool
    this.showGrid = state.showGrid
    this.selectedLayer = state.selectedLayer
    this.selectedTilesetFilter = state.selectedTilesetFilter
    this.exports.stbte_set_tool(this.tilemap, this.currentTool)
    this.exports.stbte_set_active_layer(this.tilemap, this.selectedLayer)

    state.layers.forEach((layer, index) => {
      if (index >= this.layers) return
      this.exports.stbte_set_layer_hidden(this.tilemap, index, layer.hidden ? 1 : 0)
      this.exports.stbte_set_layer_locked(this.tilemap, index, layer.locked ? 1 : 0)
    })
    this.exports.stbte_set_solo_layer(this.tilemap, state.soloLayer)

    const maxTileIndex = Math.max(0, this.getPaletteTileCount() - 1)
    const currentTile = this.clamp(state.currentTile, 0, maxTileIndex)
    this.exports.stbte_set_active_tile(this.tilemap, currentTile)

    this.scale = state.scale
    this.offsetX = state.offsetX
    this.offsetY = state.offsetY

    this.renderMap()
    this.setupLayers()
    this.setupTilesetTabs()
    this.setupTiles()
    this.draw()
    this.updateMetadata()
  }

  async inferTilesetCount(file, tileSize = this.tileSize) {
    const image = await this.loadTilesetImage(file)
    const cols = Math.max(1, Math.floor(image.width / tileSize))
    const rows = Math.max(1, Math.floor(image.height / tileSize))
    return cols * rows
  }

  async addTileset(tileSet) {
    const normalizedFile = String(tileSet?.file || '').trim()
    if (!normalizedFile) throw new Error('Tileset file is required')

    const count = Math.max(1, Number(tileSet?.count) || await this.inferTilesetCount(normalizedFile))
    const nextTileSet = {
      name: String(tileSet?.name || '').trim(),
      file: normalizedFile,
      count
    }

    this.tileSets.push(nextTileSet)
    this.paletteTileCount = Math.max(this.paletteTileCount, this.getTilesetCoverageCount(), this.fallbackTileCount)
    this.selectedTilesetFilter = `tileset:${this.tileSets.length - 1}`
    await this.rebuildEditorFromCurrentState()
  }

  transformTilemapTileIds(tilemap, transformTileId) {
    return {
      ...tilemap,
      layers: (tilemap.layers || []).map((layer) => ({
        ...layer,
        props: layer?.props ? { ...layer.props } : layer?.props,
        data: (layer?.data || []).map((value) => {
          const encoded = Number(value) || 0
          if (encoded <= 0) return 0
          return transformTileId(encoded - 1) + 1
        })
      })),
      props: tilemap?.props ? { ...tilemap.props } : tilemap?.props
    }
  }

  resizeExportedTilemap(tilemap, nextWidth, nextHeight) {
    const width = Math.max(1, Number(nextWidth) || 1)
    const height = Math.max(1, Number(nextHeight) || 1)

    return {
      ...tilemap,
      layers: (tilemap.layers || []).map((layer) => {
        const previousWidth = Math.max(1, Number(layer?.width) || width)
        const previousData = Array.isArray(layer?.data) ? layer.data : []
        const nextData = new Array(width * height).fill(0)
        const previousHeight = Math.max(0, Math.ceil(previousData.length / previousWidth))
        const copyWidth = Math.min(previousWidth, width)
        const copyHeight = Math.min(previousHeight, height)

        for (let y = 0; y < copyHeight; y++) {
          for (let x = 0; x < copyWidth; x++) {
            nextData[y * width + x] = Number(previousData[y * previousWidth + x]) || 0
          }
        }

        return {
          ...layer,
          props: layer?.props ? { ...layer.props } : layer?.props,
          width,
          data: nextData
        }
      }),
      props: tilemap?.props ? { ...tilemap.props } : tilemap?.props
    }
  }

  async applyMapSettings({ tileSize, mapWidth, mapHeight }) {
    const nextTileSize = Math.max(1, Number(tileSize) || this.tileSize)
    const nextMapWidth = Math.max(1, Number(mapWidth) || this.mapWidth)
    const nextMapHeight = Math.max(1, Number(mapHeight) || this.mapHeight)
    const isSame = nextTileSize === this.tileSize && nextMapWidth === this.mapWidth && nextMapHeight === this.mapHeight
    if (isSame) return false

    const editorState = this.captureEditorState()
    const nextTileSets = this.tileSets.map((tileSet) => ({ ...tileSet }))
    const previousTileSets = this.tileSets
    this.tileSets = nextTileSets
    await this.ensureTilesetCounts(true, nextTileSize)
    let snapshot = this.exportTilemapData()
    snapshot = this.resizeExportedTilemap(snapshot, nextMapWidth, nextMapHeight)
    snapshot.props = snapshot.props || {}
    snapshot.props.tileSize = String(nextTileSize)
    if (nextTileSets.length > 0) {
      snapshot.props.tilesets = JSON.stringify(nextTileSets)
    } else {
      delete snapshot.props.tilesets
    }

    const loadedMapName = this.loadedMapName
    this.tileSets = previousTileSets
    await this.applyLoadedTilemap(snapshot)
    this.loadedMapName = loadedMapName
    this.restoreEditorState(editorState)
    return true
  }

  async applyTilesetMutation(nextTileSets, transformTileId, nextSelectedFilter = null) {
    const editorState = this.captureEditorState()
    const snapshot = this.transformTilemapTileIds(this.exportTilemapData(), transformTileId)
    snapshot.props = snapshot.props || {}
    if (nextTileSets.length > 0) {
      snapshot.props.tilesets = JSON.stringify(nextTileSets)
    } else {
      delete snapshot.props.tilesets
    }
    const loadedMapName = this.loadedMapName
    this.tileSets = nextTileSets
    await this.applyLoadedTilemap(snapshot)
    this.loadedMapName = loadedMapName
    editorState.selectedTilesetFilter = nextSelectedFilter
    this.restoreEditorState(editorState)
  }

  async moveTileset(fromIndex, direction) {
    const toIndex = fromIndex + direction
    if (fromIndex < 0 || fromIndex >= this.tileSets.length) return
    if (toIndex < 0 || toIndex >= this.tileSets.length) return

    const nextTileSets = [...this.tileSets]
    const [movedTileSet] = nextTileSets.splice(fromIndex, 1)
    nextTileSets.splice(toIndex, 0, movedTileSet)

    const oldRanges = this.getTilesetRangesFor(this.tileSets)
    const newRanges = this.getTilesetRangesFor(nextTileSets)
    const oldCoverage = oldRanges.reduce((sum, entry) => sum + entry.count, 0)

    const transformTileId = (tileId) => {
      if (tileId >= oldCoverage) return tileId
      for (const newEntry of newRanges) {
        const oldEntry = oldRanges.find((entry) => entry.tileSet === newEntry.tileSet)
        if (!oldEntry) continue
        if (tileId >= oldEntry.startTileId && tileId < oldEntry.endTileId) {
          return newEntry.startTileId + (tileId - oldEntry.startTileId)
        }
      }
      return tileId
    }

    await this.applyTilesetMutation(nextTileSets, transformTileId, `tileset:${toIndex}`)
  }

  async deleteTileset(index) {
    if (index < 0 || index >= this.tileSets.length) return

    const nextTileSets = this.tileSets.filter((_, tileSetIndex) => tileSetIndex !== index)
    const oldRanges = this.getTilesetRangesFor(this.tileSets)
    const newRanges = this.getTilesetRangesFor(nextTileSets)
    const oldCoverage = oldRanges.reduce((sum, entry) => sum + entry.count, 0)
    const newCoverage = newRanges.reduce((sum, entry) => sum + entry.count, 0)
    const removedEntry = oldRanges[index]

    const transformTileId = (tileId) => {
      for (const newEntry of newRanges) {
        const oldEntry = oldRanges.find((entry) => entry.tileSet === newEntry.tileSet)
        if (!oldEntry) continue
        if (tileId >= oldEntry.startTileId && tileId < oldEntry.endTileId) {
          return newEntry.startTileId + (tileId - oldEntry.startTileId)
        }
      }

      if (removedEntry && tileId >= removedEntry.startTileId && tileId < removedEntry.endTileId) {
        return newCoverage + (tileId - removedEntry.startTileId)
      }

      if (tileId >= oldCoverage) {
        return newCoverage + (removedEntry?.count || 0) + (tileId - oldCoverage)
      }

      return tileId
    }

    const nextSelectedFilter = nextTileSets.length > 0
      ? `tileset:${Math.max(0, Math.min(index, nextTileSets.length - 1))}`
      : null

    await this.applyTilesetMutation(nextTileSets, transformTileId, nextSelectedFilter)
  }

  async saveTilemap(name) {
    const cleanName = String(name || '').trim()
    if (!cleanName) return

    const payload = this.exportTilemapData()
    const json = JSON.stringify(payload)
    const escapedName = cleanName.replace(/'/g, "''")
    const escapedJson = json.replace(/'/g, "''")
    const sql = `INSERT OR REPLACE INTO tilemap_storage (name, data) VALUES ('${escapedName}', '${escapedJson}')`

    await window.pluginManager.call('sql', 'exec', sql)
    this.loadedMapName = cleanName
    this.log(`Saved tilemap: ${cleanName}`)
  }

  async listStoredTilemaps() {
    const result = await window.pluginManager.call('sql', 'query', 'SELECT name FROM tilemap_storage ORDER BY name')
    const csv = new TextDecoder().decode(result.output || new Uint8Array())
    const rows = csv.trim() ? parseCSVLines(csv.trim()) : []
    return rows.slice(1).map((row) => String(row?.[0] || '').trim()).filter(Boolean)
  }

  async loadTilemap(name) {
    const cleanName = String(name || '').trim()
    if (!cleanName) return

    const escapedName = cleanName.replace(/'/g, "''")
    const result = await window.pluginManager.call('sql', 'query', `SELECT data FROM tilemap_storage WHERE name = '${escapedName}'`)
    const payloadCsv = new TextDecoder().decode(result.output || new Uint8Array())
    const payloadRows = payloadCsv.trim() ? parseCSVLines(payloadCsv.trim()) : []
    if (payloadRows.length < 2 || payloadRows[1].length < 1) {
      throw new Error(`Tilemap not found: ${cleanName}`)
    }

    const tilemap = JSON.parse(payloadRows[1][0])
    await this.applyLoadedTilemap(tilemap)
    this.loadedMapName = cleanName
    this.log(`Loaded tilemap: ${cleanName}`)
  }

  async loadDefaultDemoMap() {
    if (this.loadedMapName) return
    await this.loadTilemap('default')
  }

  _trackStoragePopup(popup) {
    if (this._storagePopup && this._storagePopup !== popup) {
      this._storagePopup.close()
    }

    this._storagePopup = popup
    popup.addEventListener('popup-closing', () => {
      if (this._storagePopup === popup) {
        this._storagePopup = null
      }
    }, { once: true })
    return popup
  }

  async showSaveTilemapPopup() {
    const popupManager = this.closest('popup-manager') || document.querySelector('popup-manager')
    if (!popupManager) {
      toast.error('Popup manager is not available.')
      return
    }

    const names = await this.listStoredTilemaps()
    const form = document.createElement('form')
    form.innerHTML = `
      <label>
        Tilemap name
        <input type="text" name="tilemap-name" placeholder="Enter tilemap name" value="${escapeAttribute(names[0] || 'stb_map')}" required>
      </label>
      <footer>
        <button type="submit" class="accent">Save</button>
      </footer>
    `

    const popup = this._trackStoragePopup(popupManager.showPopup({
      title: 'Save tilemap',
      content: form,
      size: 'small'
    }))

    form.onsubmit = async (event) => {
      event.preventDefault()
      const formData = new FormData(form)
      const name = String(formData.get('tilemap-name') || '').trim()
      if (!name) return

      try {
        await this.saveTilemap(name)
        toast.success(`Saved tilemap "${name}".`)
        popup.close()
      } catch (error) {
        toast.error(`Failed to save tilemap: ${String(error?.message || error)}`)
      }
    }
  }

  async showLoadTilemapPopup() {
    const popupManager = this.closest('popup-manager') || document.querySelector('popup-manager')
    if (!popupManager) {
      toast.error('Popup manager is not available.')
      return
    }

    let names = []
    try {
      names = await this.listStoredTilemaps()
    } catch (error) {
      toast.error(`Failed to load saved tilemap list: ${String(error?.message || error)}`)
      return
    }

    const content = document.createElement('div')
    if (!names.length) {
      content.innerHTML = '<p>No saved tilemaps yet.</p>'
    } else {
      content.innerHTML = names.map((name) => `
        <button type="button" data-name="${escapeAttribute(name)}">
          <strong>${escapeAttribute(name)}</strong>
        </button>
      `).join('')
    }

    const popup = this._trackStoragePopup(popupManager.showPopup({
      title: 'Load tilemap',
      content,
      size: 'medium'
    }))

    content.querySelectorAll('button[data-name]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = String(btn.getAttribute('data-name') || '')
        if (!name) return

        try {
          await this.loadTilemap(name)
          toast.success(`Loaded tilemap "${name}".`)
          popup.close()
        } catch (error) {
          toast.error(`Failed to load tilemap: ${String(error?.message || error)}`)
        }
      })
    })
  }

  async showAddTilesetPopup() {
    const popupManager = this.closest('popup-manager') || document.querySelector('popup-manager')
    if (!popupManager) {
      toast.error('Popup manager is not available.')
      return
    }

    const form = document.createElement('form')
    const list = document.createElement('div')
    form.innerHTML = `
      <label>
        Tileset file
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" name="tileset-file" placeholder="/path/to/tileset.qoi or URL/data URI" required style="flex:1;">
          <button type="button" name="choose-tileset-file">Browse</button>
        </div>
      </label>
      <label>
        Name
        <input type="text" name="tileset-name" placeholder="Optional display name">
      </label>
      <section>
        <h4 style="margin:0 0 8px 0;">Tilesets</h4>
      </section>
      <footer>
        <button type="submit" class="accent"><i aria-hidden="true">add</i> Add tileset</button>
      </footer>
    `
    const listSection = form.querySelector('section')
    listSection?.appendChild(list)

    const popup = this._trackStoragePopup(popupManager.showPopup({
      title: 'Add tileset',
      content: form,
      size: 'small'
    }))

    const fileInput = form.querySelector('input[name="tileset-file"]')
    const chooseBtn = form.querySelector('button[name="choose-tileset-file"]')
    const renderTilesetList = () => {
      if (!list) return
      if (this.tileSets.length === 0) {
        list.innerHTML = '<p style="margin:0; opacity:0.7;">No tilesets yet. Add one to replace the leading part of the fallback palette.</p>'
        return
      }

      list.innerHTML = this.tileSets.map((tileSet, index) => `
        <div data-tileset-index="${index}" style="display:grid; grid-template-columns:minmax(0,1fr) auto auto auto; gap:8px; align-items:center; margin-bottom:8px;">
          <div style="min-width:0;">
            <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeAttribute(this.deriveTilesetName(tileSet))}</strong>
            <small style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:0.7;">${escapeAttribute(String(tileSet.file || ''))}</small>
          </div>
          <button type="button" data-action="move-up" title="Move up" aria-label="Move up" ${index === 0 ? 'disabled' : ''}><i aria-hidden="true">arrow_upward</i></button>
          <button type="button" data-action="move-down" title="Move down" aria-label="Move down" ${index === this.tileSets.length - 1 ? 'disabled' : ''}><i aria-hidden="true">arrow_downward</i></button>
          <button type="button" data-action="delete" title="Delete tileset" aria-label="Delete tileset"><i aria-hidden="true">delete</i></button>
        </div>
      `).join('')

      list.querySelectorAll('button[data-action]').forEach((button) => {
        button.addEventListener('click', async () => {
          const row = button.closest('[data-tileset-index]')
          const index = Number(row?.getAttribute('data-tileset-index'))
          if (!Number.isInteger(index)) return

          try {
            if (button.dataset.action === 'move-up') {
              await this.moveTileset(index, -1)
            } else if (button.dataset.action === 'move-down') {
              await this.moveTileset(index, 1)
            } else if (button.dataset.action === 'delete') {
              await this.deleteTileset(index)
            }
            renderTilesetList()
          } catch (error) {
            toast.error(`Failed to update tilesets: ${String(error?.message || error)}`)
          }
        })
      })
    }

    chooseBtn?.addEventListener('click', async () => {
      try {
        const result = await ViewFiles.choose({
          title: 'Select Tileset',
          filter: '*.png,*.qoi,*.jpg,*.jpeg,*.gif,*.bmp',
          root: '/'
        })
        if (!result?.path) return
        fileInput.value = result.path
      } catch (error) {
        toast.error(`Failed to choose tileset: ${String(error?.message || error)}`)
      }
    })
    renderTilesetList()

    form.onsubmit = async (event) => {
      event.preventDefault()
      const formData = new FormData(form)
      const file = String(formData.get('tileset-file') || '').trim()
      const name = String(formData.get('tileset-name') || '').trim()
      if (!file) return

      try {
        await this.addTileset({ file, name })
        fileInput.value = ''
        const nameInput = form.querySelector('input[name="tileset-name"]')
        if (nameInput) nameInput.value = ''
        renderTilesetList()
        toast.success(`Added tileset "${name || file}".`)
      } catch (error) {
        toast.error(`Failed to add tileset: ${String(error?.message || error)}`)
      }
    }
  }

  async showMapSettingsPopup() {
    const popupManager = this.closest('popup-manager') || document.querySelector('popup-manager')
    if (!popupManager) {
      toast.error('Popup manager is not available.')
      return
    }

    const form = document.createElement('form')
    form.innerHTML = `
      <label>
        Tile size
        <input type="number" name="tile-size" min="1" step="1" value="${escapeAttribute(String(this.tileSize))}" required>
      </label>
      <label>
        Level width
        <input type="number" name="map-width" min="1" step="1" value="${escapeAttribute(String(this.mapWidth))}" required>
      </label>
      <label>
        Level height
        <input type="number" name="map-height" min="1" step="1" value="${escapeAttribute(String(this.mapHeight))}" required>
      </label>
      <footer>
        <button type="submit" class="accent"><i aria-hidden="true">save</i> Apply</button>
      </footer>
    `

    const popup = this._trackStoragePopup(popupManager.showPopup({
      title: 'Map settings',
      content: form,
      size: 'small'
    }))

    form.onsubmit = async (event) => {
      event.preventDefault()
      const formData = new FormData(form)
      const tileSize = Math.max(1, Number(formData.get('tile-size')) || this.tileSize)
      const mapWidth = Math.max(1, Number(formData.get('map-width')) || this.mapWidth)
      const mapHeight = Math.max(1, Number(formData.get('map-height')) || this.mapHeight)

      try {
        const changed = await this.applyMapSettings({ tileSize, mapWidth, mapHeight })
        if (changed) {
          toast.success(`Updated map settings to ${mapWidth}x${mapHeight} at ${tileSize}px.`)
        }
        popup.close()
      } catch (error) {
        toast.error(`Failed to update map settings: ${String(error?.message || error)}`)
      }
    }
  }
}
