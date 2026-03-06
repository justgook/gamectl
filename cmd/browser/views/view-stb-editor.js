import { toast } from '../systems/toast.js'
import { parseCSVLines } from '../util/csv.js'
import { decode as decodeQOI } from '../util/qoi/decode.js'

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default class ViewStbEditor extends HTMLElement {
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
    this.defaultSourceTileSize = 16
    this.tileSize = 16
    this.sourceTileSize = 16
    this.mapWidth = 20
    this.mapHeight = 15
    this.layers = 3
    this.currentTool = 1
    this.selectedLayer = -1
    this.selectedTilesetFilter = -1
    this.showGrid = true
    this.hoverX = -1
    this.hoverY = -1

    this.offsets = {}
    this.tileSprites = new Map()
    this.layerNames = []
    this.tileSets = []
    this.fallbackTileCount = 64

    this.dragStartX = -1
    this.dragStartY = -1
    this.dragEndX = -1
    this.dragEndY = -1
    this.showDragPreview = false

    this.view = {
      scale: 1,
      dragX: 0,
      dragY: 0,
      minScale: 0.35,
      maxScale: 5
    }

    this.boundHandleWindowResize = this.handleWindowResize.bind(this)
    this.boundViewportWheel = null
    this.boundCanvasMouseDown = null
    this.boundCanvasMouseMove = null
    this.boundCanvasMouseLeave = null
    this.boundCanvasMouseUp = null
    this.boundCanvasContextMenu = null
    this.boundCanvasElement = null
    this._headerControlsElement = null
    this._storagePopup = null
    this.loadedMapName = ''
  }

  connectedCallback() {
    this.renderLayout()
    this._mountHeaderControls()
    this.init().then(() => {
      this.loadDefaultDemoMap().catch((err) => {
        console.warn('[stb-editor] default map load skipped:', err)
      })
    }).catch((err) => {
      this.log(`Initialization failed: ${err.message}`)
      console.error(err)
    })
  }

  disconnectedCallback() {
    if (this._storagePopup) {
      this._storagePopup.close()
      this._storagePopup = null
    }
    this.cleanup()
    this._unmountHeaderControls()
  }

  _mountHeaderControls() {
    if (!this.parentElement) return

    const headerControls = document.createElement('div')
    headerControls.setAttribute('slot', 'header-controls')
    headerControls.innerHTML = `
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
    `

    this._headerControlsElement = headerControls
    this.parentElement.appendChild(headerControls)
  }

  _unmountHeaderControls() {
    if (this._headerControlsElement?.parentElement) {
      this._headerControlsElement.remove()
      this._headerControlsElement = null
    }
  }

  headerControl(id) {
    return this._headerControlsElement?.querySelector(`[data-id="${id}"]`) || null
  }

  headerControlButtons(selector) {
    if (!this._headerControlsElement) return []
    return [...this._headerControlsElement.querySelectorAll(selector)]
  }

  async init() {
    try {
      this.log('Initializing editor...')

      const memory = new WebAssembly.Memory({
        initial: 288,
        maximum: 512,
        shared: true
      })

      this.plugin = await window.pluginManager.load({
        name: 'stbte',
        importObject: { env: { memory } }
      })

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

      await this.defineTilesFromAtlases()

      this.setupUI()
      this.setupLayers()
      this.setupTilesetTabs()
      this.setupTiles()
      this.updateMetadata()
      this.setupViewportControls()
      this.resizeCanvasToMap()
      this.renderMap()
      this.resetViewToFit()

      this.log(`Ready. ${this.tileSprites.size} tile sprites loaded.`)
    } catch (err) {
      this.log(`Error: ${err.message}`)
      throw err
    }
  }

  cleanup() {
    if (this.boundCanvasMouseUp) {
      window.removeEventListener('mouseup', this.boundCanvasMouseUp)
      this.boundCanvasMouseUp = null
    }

    if (this.boundCanvasElement) {
      if (this.boundCanvasMouseDown) {
        this.boundCanvasElement.removeEventListener('mousedown', this.boundCanvasMouseDown)
        this.boundCanvasMouseDown = null
      }
      if (this.boundCanvasMouseMove) {
        this.boundCanvasElement.removeEventListener('mousemove', this.boundCanvasMouseMove)
        this.boundCanvasMouseMove = null
      }
      if (this.boundCanvasMouseLeave) {
        this.boundCanvasElement.removeEventListener('mouseleave', this.boundCanvasMouseLeave)
        this.boundCanvasMouseLeave = null
      }
      if (this.boundCanvasContextMenu) {
        this.boundCanvasElement.removeEventListener('contextmenu', this.boundCanvasContextMenu)
        this.boundCanvasContextMenu = null
      }
      this.boundCanvasElement = null
    }

    if (this.boundViewportWheel) {
      this.el('map-viewport')?.removeEventListener('wheel', this.boundViewportWheel)
      this.boundViewportWheel = null
    }

    window.removeEventListener('resize', this.boundHandleWindowResize)

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

    if (this.plugin) {
      window.pluginManager.unload(this.plugin)
      this.plugin = null
    }
  }

  renderLayout() {
    this.innerHTML = `
      <section data-id="map-viewport">
        <canvas data-id="tilemap" width="640" height="480" style="transform-origin: 0 0;"></canvas>
      </section>

      <aside data-id="sidepanel">
          <fieldset>
            <legend>Metadata</legend>
            <dl data-id="meta"></dl>
          </fieldset>

          <fieldset>
            <legend>Layers</legend>
            <div data-id="layers"></div>
          </fieldset>

          <fieldset>
            <legend>Tiles</legend>
            <div data-id="tile-tabs" role="tablist" aria-label="Tilesets"></div>
            <div data-id="tiles" role="tabpanel" id="stb-tiles-panel"></div>
          </fieldset>

          <fieldset>
            <legend>Output</legend>
            <pre class="info-block" data-id="output">Loading WASM...</pre>
          </fieldset>
      </aside>
    `
  }

  el(id) {
    return this.querySelector(`[data-id="${id}"]`)
  }

  log(message) {
    const output = this.el('output')
    output.textContent += `${message}\n`
    output.scrollTop = output.scrollHeight
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
    let nextTileId = 0
    const tileSets = this.tileSets.length > 0 ? this.tileSets : [{ name: 'generated' }]

    for (let tileSetIndex = 0; tileSetIndex < tileSets.length; tileSetIndex++) {
      const tileSet = tileSets[tileSetIndex]
      let image
      let cols
      let rows

      const isGeneratedOnly = !tileSet?.file

      try {
        image = await this.loadTilesetImage(tileSet.file)
        cols = Math.max(1, Math.floor(image.width / this.sourceTileSize))
        rows = Math.max(1, Math.floor(image.height / this.sourceTileSize))
      } catch (err) {
        const generated = this.generateFallbackTileset(tileSetIndex, nextTileId, this.getFallbackTilesetCount(tileSet, tileSets.length))
        image = generated.image
        cols = generated.cols
        rows = generated.rows
        this.log(`Generated fallback tileset for ${this.deriveTilesetName(tileSet)}`)
        if (!isGeneratedOnly) console.warn('[stb-editor] tileset fallback:', err)
      }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const tileId = nextTileId++
          this.exports.stbte_define_tile(this.tilemap, tileId, 0xFF, tileSetIndex + 1)
          this.tileSprites.set(tileId, {
            image,
            sx: x * this.sourceTileSize,
            sy: y * this.sourceTileSize,
            sw: this.sourceTileSize,
            sh: this.sourceTileSize,
            tilesetIndex: tileSetIndex
          })
        }
      }
      this.log(`Loaded ${tileSet.file || this.deriveTilesetName(tileSet)} (${cols * rows} tiles)`) 
    }

    this.exports.stbte_set_active_tile(this.tilemap, 0)
  }

  getFallbackTilesetCount(tileSet, totalTileSets) {
    const explicit = Math.max(0, Number(tileSet?.count) || 0)
    if (explicit > 0) return explicit
    if (totalTileSets === 1) return Math.max(1, this.fallbackTileCount)
    return Math.max(1, Math.ceil(this.fallbackTileCount / totalTileSets))
  }

  generateFallbackTileset(tileSetIndex, startTileId, tileCount) {
    const count = Math.max(1, tileCount)
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
    const rows = Math.max(1, Math.ceil(count / cols))
    const canvas = document.createElement('canvas')
    canvas.width = cols * this.sourceTileSize
    canvas.height = rows * this.sourceTileSize
    const ctx = canvas.getContext('2d')

    ctx.imageSmoothingEnabled = false
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${Math.max(8, Math.floor(this.sourceTileSize * 0.42))}px monospace`

    for (let i = 0; i < count; i++) {
      const x = (i % cols) * this.sourceTileSize
      const y = Math.floor(i / cols) * this.sourceTileSize
      const hue = (tileSetIndex * 61 + i * 37) % 360

      ctx.fillStyle = `hsl(${hue} 55% 48%)`
      ctx.fillRect(x, y, this.sourceTileSize, this.sourceTileSize)
      ctx.fillStyle = `hsl(${(hue + 22) % 360} 65% 30%)`
      ctx.fillRect(x + 1, y + 1, this.sourceTileSize - 2, this.sourceTileSize - 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.strokeRect(x + 0.5, y + 0.5, this.sourceTileSize - 1, this.sourceTileSize - 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(startTileId + i + 1), x + this.sourceTileSize / 2, y + this.sourceTileSize / 2)
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

  setupUI() {
    this.headerControlButtons('[data-tool]').forEach((btn) => {
      btn.onclick = () => {
        this.currentTool = parseInt(btn.dataset.tool, 10)
        this.exports.stbte_set_tool(this.tilemap, this.currentTool)
        this.updateControlStates()
        this.updateMetadata()
      }
    })

    this.headerControl('undo-btn').onclick = () => {
      this.exports.stbte_undo(this.tilemap)
      this.postAction()
    }

    this.headerControl('redo-btn').onclick = () => {
      this.exports.stbte_redo(this.tilemap)
      this.postAction()
    }

    this.headerControl('cut-btn').onclick = () => {
      this.exports.stbte_cut(this.tilemap)
      this.postAction()
    }

    this.headerControl('copy-btn').onclick = () => {
      this.exports.stbte_copy(this.tilemap)
      this.updateMetadata()
      this.log('Copied selection')
    }

    this.headerControl('paste-btn').onclick = () => {
      const cx = Math.floor(this.mapWidth / 2)
      const cy = Math.floor(this.mapHeight / 2)
      this.exports.stbte_paste(this.tilemap, cx, cy)
      this.postAction()
    }

    this.headerControl('clear-btn').onclick = () => {
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
      this.updateControlStates()
      this.updateMetadata()
    }

    this.headerControl('fit-btn').onclick = () => {
      this.resetViewToFit()
    }

    this.updateControlStates()
    this.setupCanvasInput()
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

  setupViewportControls() {
    const viewport = this.el('map-viewport')
    this.boundViewportWheel = (e) => {
      e.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const layerX = e.clientX - rect.left
      const layerY = e.clientY - rect.top

      if (e.ctrlKey || e.metaKey) {
        const prevScale = this.view.scale
        const zoomAmount = -e.deltaY * 0.0015
        const nextScale = this.clamp(prevScale * (1 + zoomAmount), this.view.minScale, this.view.maxScale)
        const relX = (layerX - this.view.dragX) / prevScale
        const relY = (layerY - this.view.dragY) / prevScale
        this.view.scale = nextScale
        this.view.dragX = layerX - relX * nextScale
        this.view.dragY = layerY - relY * nextScale
      } else {
        this.view.dragX -= e.deltaX
        this.view.dragY -= e.deltaY
      }

      this.applyViewTransform()
      this.updateMetadata()
    }
    viewport.addEventListener('wheel', this.boundViewportWheel, { passive: false })

    window.addEventListener('resize', this.boundHandleWindowResize)
  }

  handleWindowResize() {
    this.applyViewTransform()
  }

  applyViewTransform() {
    const canvas = this.el('tilemap')
    const s = this.view.scale
    canvas.style.transform = `matrix(${s}, 0, 0, ${s}, ${this.view.dragX}, ${this.view.dragY})`
  }

  resizeCanvasToMap() {
    const canvas = this.el('tilemap')
    if (!canvas) return
    const width = Math.max(1, this.mapWidth * this.tileSize)
    const height = Math.max(1, this.mapHeight * this.tileSize)
    canvas.width = width
    canvas.height = height
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  resetViewToFit() {
    const viewport = this.el('map-viewport')
    const viewportWidth = Math.max(1, viewport.clientWidth)
    const viewportHeight = Math.max(1, viewport.clientHeight)
    const mapW = this.mapWidth * this.tileSize
    const mapH = this.mapHeight * this.tileSize
    const fitScaleX = viewportWidth / mapW
    const fitScaleY = viewportHeight / mapH
    const fitScale = this.clamp(Math.min(fitScaleX, fitScaleY), this.view.minScale, this.view.maxScale)
    this.view.scale = fitScale
    this.view.dragX = Math.round((viewportWidth - mapW * fitScale) / 2)
    this.view.dragY = Math.round((viewportHeight - mapH * fitScale) / 2)
    this.applyViewTransform()
    this.updateMetadata()
  }

  postAction() {
    this.renderMap()
    this.updateMetadata()
    this.setupLayers()
    const undoBtn = this.headerControl('undo-btn')
    const redoBtn = this.headerControl('redo-btn')
    if (undoBtn) undoBtn.disabled = !this.canUndo()
    if (redoBtn) redoBtn.disabled = !this.canRedo()
  }

  setupCanvasInput() {
    const canvas = this.el('tilemap')
    this.boundCanvasElement = canvas
    let isDragging = false
    let areaDrag = false

    const isAreaDrag = (e) => this.currentTool === 0 || (e.shiftKey && (this.currentTool === 1 || this.currentTool === 2))

    const eventToCell = (e) => {
      const canvasRect = canvas.getBoundingClientRect()
      const pixelX = (e.clientX - canvasRect.left) * (canvas.width / Math.max(1, canvasRect.width))
      const pixelY = (e.clientY - canvasRect.top) * (canvas.height / Math.max(1, canvasRect.height))
      return {
        x: Math.floor(pixelX / this.tileSize),
        y: Math.floor(pixelY / this.tileSize)
      }
    }

    this.boundCanvasMouseDown = (e) => {
      const { x, y } = eventToCell(e)
      if (!this.isInsideMap(x, y)) return
      isDragging = true
      this.dragStartX = x
      this.dragStartY = y

      if (isAreaDrag(e)) {
        areaDrag = true
        this.dragEndX = x
        this.dragEndY = y
        this.showDragPreview = true
        this.renderMap()
        return
      }

      areaDrag = false
      this.showDragPreview = false
      this.exports.stbte_apply(this.tilemap, x, y, x, y)
      this.postAction()
    }
    canvas.addEventListener('mousedown', this.boundCanvasMouseDown)

    this.boundCanvasMouseMove = (e) => {
      const { x, y } = eventToCell(e)
      this.hoverX = x
      this.hoverY = y
      this.updateMetadata()

      if (!isDragging || !this.isInsideMap(x, y)) return

      if (areaDrag) {
        this.dragEndX = x
        this.dragEndY = y
        this.renderMap()
        return
      }

      if (this.currentTool === 1 || this.currentTool === 2) {
        this.exports.stbte_apply(this.tilemap, x, y, x, y)
        this.renderMap()
        this.updateMetadata()
      }
    }
    canvas.addEventListener('mousemove', this.boundCanvasMouseMove)

    this.boundCanvasMouseLeave = () => {
      this.hoverX = -1
      this.hoverY = -1
      this.updateMetadata()
    }
    canvas.addEventListener('mouseleave', this.boundCanvasMouseLeave)

    const onMouseUp = (e) => {
      if (isDragging && areaDrag) {
        const { x, y } = eventToCell(e)
        const ex = this.clamp(x, 0, this.mapWidth - 1)
        const ey = this.clamp(y, 0, this.mapHeight - 1)
        this.exports.stbte_apply(this.tilemap, this.dragStartX, this.dragStartY, ex, ey)
        this.showDragPreview = false
        this.postAction()
      }
      isDragging = false
      areaDrag = false
    }

    this.boundCanvasMouseUp = onMouseUp
    window.addEventListener('mouseup', onMouseUp)

    this.boundCanvasContextMenu = (e) => e.preventDefault()
    canvas.addEventListener('contextmenu', this.boundCanvasContextMenu)
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
      })
      const lBtn = this.makeLayerToggle('lock', locked, () => {
        this.exports.stbte_set_layer_locked(this.tilemap, i, locked ? 0 : 1)
        this.setupLayers()
        this.renderMap()
      })
      const sBtn = this.makeLayerToggle('visibility', isSolo, () => {
        this.exports.stbte_set_solo_layer(this.tilemap, isSolo ? -1 : i)
        this.setupLayers()
        this.renderMap()
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

    const tileCount = this.getNumTiles()
    const tilesPtr = this.readTilemap(this.offsets.tm_tiles, 'i32')
    const currentTileIdx = this.getCurrentTile()
    const groups = new Map()
    const showGroups = this.tileSets.length > 1 && this.selectedTilesetFilter === -1

    for (let i = 0; i < tileCount; i++) {
      const tileBase = tilesPtr + (i * this.offsets.sizeof_tileinfo)
      const tileId = new DataView(this.memory.buffer, tileBase + this.offsets.tileinfo_id, 2).getUint16(0, true)
      const tileCategory = new DataView(this.memory.buffer, tileBase + this.offsets.tileinfo_category_id, 2).getUint16(0, true)

      if (this.selectedTilesetFilter !== -1 && tileCategory !== this.selectedTilesetFilter) continue

      if (!groups.has(tileCategory)) {
        const grid = document.createElement('div')
        if (showGroups) {
          const tileset = this.tileSets[tileCategory - 1]
          const section = document.createElement('section')
          const title = document.createElement('h4')
          title.textContent = this.deriveTilesetName(tileset)
          section.appendChild(title)
          section.appendChild(grid)
          container.appendChild(section)
        } else {
          container.appendChild(grid)
        }
        groups.set(tileCategory, grid)
      }

      const btn = document.createElement('button')
      if (i === currentTileIdx) btn.classList.add('active')
      btn.title = `Tile ${tileId}`

      const preview = this.makeTilePreview(tileId)
      btn.appendChild(preview)

      const idTag = document.createElement('span')
      idTag.textContent = tileId
      btn.appendChild(idTag)

      btn.addEventListener('click', () => {
        this.exports.stbte_set_active_tile(this.tilemap, i)
        this.setupTiles()
        this.updateMetadata()
      })

      groups.get(tileCategory).appendChild(btn)
    }
  }

  setupTilesetTabs() {
    const container = this.el('tile-tabs')
    container.innerHTML = ''

    if (this.tileSets.length <= 1) {
      container.style.display = 'none'
      this.selectedTilesetFilter = -1
      return
    }

    container.style.display = 'flex'
    container.style.gap = '6px'
    container.style.marginBottom = '8px'
    container.style.overflow = 'hidden'

    const entries = [
      { id: -1, label: 'all' },
      ...this.tileSets.map((tileSet, index) => ({ id: index + 1, label: this.deriveTilesetName(tileSet) }))
    ]

    for (const entry of entries) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = entry.label
      btn.title = entry.label
      btn.setAttribute('role', 'tab')
      btn.setAttribute('aria-controls', 'stb-tiles-panel')
      btn.setAttribute('aria-selected', this.selectedTilesetFilter === entry.id ? 'true' : 'false')
      btn.style.maxWidth = '110px'
      btn.style.whiteSpace = 'nowrap'
      btn.style.overflow = 'hidden'
      btn.style.textOverflow = 'ellipsis'
      if (this.selectedTilesetFilter === entry.id) btn.classList.add('active')
      btn.onclick = () => {
        this.selectedTilesetFilter = entry.id
        this.setupTilesetTabs()
        this.setupTiles()
      }
      container.appendChild(btn)
    }
  }

  makeTilePreview(tileId) {
    const canvas = document.createElement('canvas')
    canvas.width = this.sourceTileSize
    canvas.height = this.sourceTileSize
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    const sprite = this.tileSprites.get(tileId)

    if (sprite) {
      ctx.drawImage(sprite.image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, 0, 0, this.sourceTileSize, this.sourceTileSize)
    } else {
      ctx.fillStyle = '#243042'
      ctx.fillRect(0, 0, this.sourceTileSize, this.sourceTileSize)
      ctx.fillStyle = '#f0f6fc'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(tileId), this.sourceTileSize / 2, this.sourceTileSize / 2)
    }

    return canvas
  }

  updateMetadata() {
    const toolNames = ['Select', 'Brush', 'Erase', 'Eyedropper']
    const meta = {
      map: `${this.mapWidth} x ${this.mapHeight}`,
      layers: String(this.layers),
      tool: toolNames[this.currentTool] || String(this.currentTool),
      tileIndex: String(this.getCurrentTile()),
      tilesLoaded: String(this.getNumTiles()),
      tilesets: String(this.tileSets.length),
      activeLayer: this.selectedLayer === -1 ? 'All editable' : (this.layerNames[this.selectedLayer] || `Layer ${this.selectedLayer + 1}`),
      hover: this.isInsideMap(this.hoverX, this.hoverY) ? `${this.hoverX}, ${this.hoverY}` : '-',
      undo: this.canUndo() ? 'yes' : 'no',
      redo: this.canRedo() ? 'yes' : 'no',
      grid: this.showGrid ? 'on' : 'off',
      selection: this.readUI(this.offsets.ui_has_selection, 'i32') ? 'yes' : 'no',
      zoom: `${Math.round(this.view.scale * 100)}%`,
      drag: `${Math.round(this.view.dragX)}, ${Math.round(this.view.dragY)}`
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
    if (undoBtn) undoBtn.disabled = !this.canUndo()
    if (redoBtn) redoBtn.disabled = !this.canRedo()
  }

  renderMap() {
    const canvas = this.el('tilemap')
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false

    ctx.fillStyle = '#070d14'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

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

    if (this.showDragPreview) {
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
      ctx.lineWidth = 2
      ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2)
      ctx.lineWidth = 1
    }
  }

  encodeTopLevelProps() {
    const props = {}

    if (this.tileSets.length > 0) props.tilesets = JSON.stringify(this.tileSets)
    props.tileSize = String(this.tileSize)
    props.sourceTileSize = String(this.sourceTileSize)

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
    const isLegacyFormat = parsedTileSets.length === 0
    return {
      mapWidth,
      mapHeight,
      layers: layers.length,
      tileSize: isLegacyFormat ? this.defaultTileSize : Math.max(1, Number(props.tileSize) || this.defaultTileSize),
      sourceTileSize: isLegacyFormat ? this.defaultSourceTileSize : Math.max(1, Number(props.sourceTileSize) || this.defaultSourceTileSize),
      tileSets: parsedTileSets.length > 0 ? parsedTileSets : [{ name: 'generated' }],
      layerNames: layers.map((layer, index) => isLegacyFormat ? `layer ${index + 1}` : String(layer?.props?.name || `layer ${index + 1}`)),
      fallbackTileCount: Math.max(1, maxTileId || this.fallbackTileCount)
    }
  }

  async applyLoadedTilemap(tilemap) {
    const config = this.buildLoadConfig(tilemap)

    this.cleanup()
    this.mapWidth = config.mapWidth
    this.mapHeight = config.mapHeight
    this.layers = config.layers
    this.tileSize = config.tileSize
    this.sourceTileSize = config.sourceTileSize
    this.tileSets = config.tileSets
    this.layerNames = config.layerNames
    this.fallbackTileCount = config.fallbackTileCount
    this.tileSprites = new Map()
    this.selectedLayer = -1
    this.selectedTilesetFilter = -1
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
}
