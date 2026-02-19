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

    this.tileSize = 32
    this.sourceTileSize = 16
    this.mapWidth = 20
    this.mapHeight = 15
    this.layers = 3
    this.currentTool = 1
    this.selectedLayer = -1
    this.selectedCategory = -1
    this.showGrid = true
    this.hoverX = -1
    this.hoverY = -1

    this.offsets = {}
    this.tileSprites = new Map()
    this.categoryNames = ['Floor', 'Walls']
    this.layerNames = ['Ground', 'Mid', 'Top']
    this.tileSets = [
      { file: 'floor-16x16.png', categoryId: 1 },
      { file: 'walls_low-16x16.png', categoryId: 2 }
    ]

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
    this.boundCanvasMouseUp = null
    this._headerControlsElement = null

    this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.renderLayout()
    this._mountHeaderControls()
    this.init().catch((err) => {
      this.log(`Initialization failed: ${err.message}`)
      console.error(err)
    })
  }

  disconnectedCallback() {
    this.cleanup()
    this._unmountHeaderControls()
  }

  _mountHeaderControls() {
    const viewTag = this.tagName.toLowerCase()
    const template = document.getElementById(viewTag)

    if (template && this.parentElement) {
      const content = template.content.cloneNode(true)
      const headerControls = content.querySelector('[slot="header-controls"]')

      if (headerControls) {
        this._headerControlsElement = headerControls
        this.parentElement.appendChild(headerControls)
      }
    }
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
      this.setupCategories()
      this.setupTiles()
      this.updateMetadata()
      this.setupViewportControls()
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
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --stb-bg: #0d1117;
          --stb-panel: #161b22;
          --stb-panel-2: #1f2630;
          --stb-line: #30363d;
          --stb-text: #c9d1d9;
          --stb-muted: #8b949e;
          --stb-accent: #2f81f7;
          --stb-accent-soft: #1f6feb;
          display: block;
          width: 100%;
          height: 100%;
          color: var(--stb-text);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          background: radial-gradient(circle at top left, #132236, var(--stb-bg) 50%);
        }

        * { box-sizing: border-box; }

        .app {
          height: 100%;
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 12px;
          padding: 10px;
        }

        .workspace {
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .panel {
          border: 1px solid var(--stb-line);
          border-radius: 10px;
          background: #10161f;
        }

        .canvas-shell {
          flex: 1;
          min-height: 0;
          border: 1px solid var(--stb-line);
          border-radius: 10px;
          background: linear-gradient(180deg, #0e131b, #0a0f16);
          padding: 10px;
        }

        .map-viewport {
          position: relative;
          width: 100%;
          height: 100%;
          border: 1px solid #263243;
          border-radius: 8px;
          background: #080d14;
          overflow: hidden;
        }

        .tilemap {
          position: absolute;
          left: 0;
          top: 0;
          border: 1px solid #34404f;
          background: #06090f;
          image-rendering: pixelated;
          cursor: crosshair;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
          transform-origin: 0 0;
        }

        .sidebar {
          background: linear-gradient(180deg, var(--stb-panel), var(--stb-panel-2));
          border: 1px solid var(--stb-line);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .panel {
          padding: 10px;
        }

        .panel h2 {
          margin: 0 0 8px;
          font-size: 12px;
          color: #f0f6fc;
          letter-spacing: 0.02em;
        }

        button {
          background: #21262d;
          color: var(--stb-text);
          border: 1px solid var(--stb-line);
          border-radius: 7px;
          padding: 6px 10px;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        button:hover {
          background: #2b3340;
          border-color: #3b4552;
        }

        button.active {
          background: linear-gradient(180deg, var(--stb-accent), var(--stb-accent-soft));
          color: #fff;
          border-color: #2569c8;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .layers {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .layer-row {
          display: grid;
          grid-template-columns: 1fr auto auto auto;
          gap: 6px;
          align-items: center;
          background: #151c25;
          border: 1px solid #232d39;
          border-radius: 8px;
          padding: 6px;
        }

        .layer-row.is-selected {
          border-color: #376fb9;
          box-shadow: inset 0 0 0 1px #214a82;
        }

        .layer-name {
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tog {
          min-width: 28px;
          padding: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .tog.is-on {
          background: #1f3d25;
          color: #9be9a8;
          border-color: #2f6b3d;
        }

        .categories {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tile-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
          max-height: 210px;
          overflow: auto;
          padding-right: 2px;
        }

        .tile-btn {
          position: relative;
          border: 1px solid #2c3643;
          border-radius: 6px;
          width: 42px;
          height: 42px;
          padding: 0;
          background: #0f1520;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tile-btn canvas {
          width: 36px;
          height: 36px;
          image-rendering: pixelated;
        }

        .tile-btn.active {
          border-color: #58a6ff;
          box-shadow: inset 0 0 0 1px #2f81f7;
        }

        .tile-id {
          position: absolute;
          right: 2px;
          bottom: 1px;
          font-size: 9px;
          color: #f0f6fc;
          background: rgba(0, 0, 0, 0.55);
          border-radius: 4px;
          padding: 0 3px;
          line-height: 1.3;
          pointer-events: none;
        }

        .meta {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 4px 10px;
          font-size: 12px;
          align-items: baseline;
        }

        .meta dt { color: var(--stb-muted); }
        .meta dd { margin: 0; color: #f0f6fc; }

        .output {
          margin: 0;
          font-size: 11px;
          color: #93a1b1;
          background: #0b1017;
          border: 1px solid #202b3a;
          border-radius: 8px;
          padding: 8px;
          max-height: 120px;
          overflow: auto;
          white-space: pre-wrap;
        }

        @media (max-width: 1080px) and (orientation: portrait) {
          .app {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr auto;
          }
        }
      </style>

      <div class="app">
        <main class="workspace">
          <div class="canvas-shell">
            <div class="map-viewport" data-id="map-viewport">
              <canvas class="tilemap" data-id="tilemap" width="640" height="480"></canvas>
            </div>
          </div>
        </main>

        <aside class="sidebar">
          <section class="panel">
            <h2>Metadata</h2>
            <dl class="meta" data-id="meta"></dl>
          </section>

          <section class="panel">
            <h2>Layers</h2>
            <div class="layers" data-id="layers"></div>
          </section>

          <section class="panel">
            <h2>Categories</h2>
            <div class="categories" data-id="categories"></div>
          </section>

          <section class="panel">
            <h2>Tiles</h2>
            <div class="tile-grid" data-id="tiles"></div>
          </section>

          <section class="panel">
            <h2>Output</h2>
            <pre class="output" data-id="output">Loading WASM...</pre>
          </section>
        </aside>
      </div>
    `
  }

  el(id) {
    return this.shadowRoot.querySelector(`[data-id="${id}"]`)
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
    let nextTileId = 1
    let firstFloorTile = -1

    for (const tileSet of this.tileSets) {
      const image = await this.loadImage(new URL(`../example/${tileSet.file}`, import.meta.url).toString())
      const cols = Math.floor(image.width / this.sourceTileSize)
      const rows = Math.floor(image.height / this.sourceTileSize)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const tileId = nextTileId++
          this.exports.stbte_define_tile(this.tilemap, tileId, 0xFF, tileSet.categoryId)
          this.tileSprites.set(tileId, {
            image,
            sx: x * this.sourceTileSize,
            sy: y * this.sourceTileSize,
            sw: this.sourceTileSize,
            sh: this.sourceTileSize
          })
          if (tileSet.categoryId === 1 && firstFloorTile === -1) {
            firstFloorTile = tileId
          }
        }
      }
      this.log(`Loaded ${tileSet.file} (${cols * rows} tiles)`)
    }

    if (firstFloorTile !== -1) {
      this.exports.stbte_set_background_tile(this.tilemap, firstFloorTile)
    }

    this.exports.stbte_set_active_tile(this.tilemap, 0)
  }

  loadImage(src) {
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
    this.headerControlButtons('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentTool = parseInt(btn.dataset.tool, 10)
        this.exports.stbte_set_tool(this.tilemap, this.currentTool)
        this.updateControlStates()
        this.updateMetadata()
      })
    })

    this.headerControl('undo-btn')?.addEventListener('click', () => {
      this.exports.stbte_undo(this.tilemap)
      this.postAction()
    })

    this.headerControl('redo-btn')?.addEventListener('click', () => {
      this.exports.stbte_redo(this.tilemap)
      this.postAction()
    })

    this.headerControl('cut-btn')?.addEventListener('click', () => {
      this.exports.stbte_cut(this.tilemap)
      this.postAction()
    })

    this.headerControl('copy-btn')?.addEventListener('click', () => {
      this.exports.stbte_copy(this.tilemap)
      this.updateMetadata()
      this.log('Copied selection')
    })

    this.headerControl('paste-btn')?.addEventListener('click', () => {
      const cx = Math.floor(this.mapWidth / 2)
      const cy = Math.floor(this.mapHeight / 2)
      this.exports.stbte_paste(this.tilemap, cx, cy)
      this.postAction()
    })

    this.headerControl('clear-btn')?.addEventListener('click', () => {
      this.exports.stbte_clear(this.tilemap)
      this.postAction()
    })

    this.headerControl('grid-btn')?.addEventListener('click', () => {
      this.showGrid = !this.showGrid
      this.renderMap()
      this.updateControlStates()
      this.updateMetadata()
    })

    this.headerControl('fit-btn')?.addEventListener('click', () => {
      this.resetViewToFit()
    })

    this.updateControlStates()
    this.setupCanvasInput()
  }

  updateControlStates() {
    this.headerControlButtons('.tool-btn').forEach((btn) => {
      const isActive = parseInt(btn.dataset.tool, 10) === this.currentTool
      btn.classList.toggle('button-primary', isActive)
      btn.classList.toggle('button-secondary', !isActive)
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false')
    })

    const gridBtn = this.headerControl('grid-btn')
    if (gridBtn) {
      gridBtn.classList.toggle('button-primary', this.showGrid)
      gridBtn.classList.toggle('button-secondary', !this.showGrid)
      gridBtn.setAttribute('aria-pressed', this.showGrid ? 'true' : 'false')
    }
  }

  setupViewportControls() {
    const viewport = this.el('map-viewport')
    viewport.addEventListener('wheel', (e) => {
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
    }, { passive: false })

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

  resetViewToFit() {
    const viewport = this.el('map-viewport')
    const mapW = this.mapWidth * this.tileSize
    const mapH = this.mapHeight * this.tileSize
    const fitScaleX = viewport.clientWidth / mapW
    const fitScaleY = viewport.clientHeight / mapH
    const fitScale = this.clamp(Math.min(fitScaleX, fitScaleY), this.view.minScale, this.view.maxScale)
    this.view.scale = fitScale
    this.view.dragX = Math.round((viewport.clientWidth - mapW * fitScale) / 2)
    this.view.dragY = Math.round((viewport.clientHeight - mapH * fitScale) / 2)
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
    let isDragging = false
    let areaDrag = false

    const isAreaDrag = (e) => this.currentTool === 0 || (e.shiftKey && (this.currentTool === 1 || this.currentTool === 2))

    const eventToCell = (e) => {
      const viewportRect = this.el('map-viewport').getBoundingClientRect()
      const localX = e.clientX - viewportRect.left
      const localY = e.clientY - viewportRect.top
      const worldX = (localX - this.view.dragX) / this.view.scale
      const worldY = (localY - this.view.dragY) / this.view.scale
      return {
        x: Math.floor(worldX / this.tileSize),
        y: Math.floor(worldY / this.tileSize)
      }
    }

    canvas.addEventListener('mousedown', (e) => {
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
    })

    canvas.addEventListener('mousemove', (e) => {
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
    })

    canvas.addEventListener('mouseleave', () => {
      this.hoverX = -1
      this.hoverY = -1
      this.updateMetadata()
    })

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

    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
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
      row.className = `layer-row${this.selectedLayer === i ? ' is-selected' : ''}`

      const name = document.createElement('div')
      name.className = 'layer-name'
      name.textContent = this.layerNames[i] || `Layer ${i + 1}`
      name.addEventListener('click', () => {
        this.selectedLayer = this.selectedLayer === i ? -1 : i
        this.exports.stbte_set_active_layer(this.tilemap, this.selectedLayer)
        this.setupLayers()
        this.updateMetadata()
      })
      row.appendChild(name)

      const hBtn = this.makeLayerToggle('H', hidden, () => {
        this.exports.stbte_set_layer_hidden(this.tilemap, i, hidden ? 0 : 1)
        this.setupLayers()
        this.renderMap()
      })
      const lBtn = this.makeLayerToggle('L', locked, () => {
        this.exports.stbte_set_layer_locked(this.tilemap, i, locked ? 0 : 1)
        this.setupLayers()
        this.renderMap()
      })
      const sBtn = this.makeLayerToggle('S', isSolo, () => {
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
    btn.className = `tog${on ? ' is-on' : ''}`
    btn.title = label
    btn.textContent = label
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      click()
    })
    return btn
  }

  setupCategories() {
    const container = this.el('categories')
    container.innerHTML = ''

    this.exports.stbte_set_active_category(this.tilemap, this.selectedCategory)
    const categoryCount = this.getNumCategories()

    const allBtn = document.createElement('button')
    allBtn.className = this.selectedCategory === -1 ? 'active' : ''
    allBtn.textContent = 'All'
    allBtn.addEventListener('click', () => {
      this.selectedCategory = -1
      this.exports.stbte_set_active_category(this.tilemap, -1)
      this.setupCategories()
      this.setupTiles()
      this.updateMetadata()
    })
    container.appendChild(allBtn)

    for (let i = 0; i < categoryCount; i++) {
      const btn = document.createElement('button')
      btn.className = this.selectedCategory === i ? 'active' : ''
      btn.textContent = this.categoryNames[i] || `Category ${i + 1}`
      btn.addEventListener('click', () => {
        this.selectedCategory = i
        this.exports.stbte_set_active_category(this.tilemap, i)
        this.setupCategories()
        this.setupTiles()
        this.updateMetadata()
      })
      container.appendChild(btn)
    }
  }

  setupTiles() {
    const container = this.el('tiles')
    container.innerHTML = ''

    const tileCount = this.getNumTiles()
    const activeCategory = this.getCurrentCategory()
    const tilesPtr = this.readTilemap(this.offsets.tm_tiles, 'i32')
    const currentTileIdx = this.getCurrentTile()

    for (let i = 0; i < tileCount; i++) {
      const tileBase = tilesPtr + (i * this.offsets.sizeof_tileinfo)
      const tileId = new DataView(this.memory.buffer, tileBase + this.offsets.tileinfo_id, 2).getUint16(0, true)
      const tileCategory = new DataView(this.memory.buffer, tileBase + this.offsets.tileinfo_category_id, 2).getUint16(0, true)

      if (activeCategory !== -1 && tileCategory !== activeCategory) continue

      const btn = document.createElement('button')
      btn.className = `tile-btn${i === currentTileIdx ? ' active' : ''}`
      btn.title = `Tile ${tileId}`

      const preview = this.makeTilePreview(tileId)
      btn.appendChild(preview)

      const idTag = document.createElement('span')
      idTag.className = 'tile-id'
      idTag.textContent = tileId
      btn.appendChild(idTag)

      btn.addEventListener('click', () => {
        this.exports.stbte_set_active_tile(this.tilemap, i)
        this.setupTiles()
        this.updateMetadata()
      })

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
      category: this.selectedCategory === -1 ? 'All' : (this.categoryNames[this.selectedCategory] || `Category ${this.selectedCategory + 1}`),
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
}
