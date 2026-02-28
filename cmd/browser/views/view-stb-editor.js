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
    this.boundViewportWheel = null
    this.boundCanvasMouseUp = null
    this._headerControlsElement = null
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
    if (!this.parentElement) return

    const headerControls = document.createElement('div')
    headerControls.setAttribute('slot', 'header-controls')
    headerControls.innerHTML = `
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

    if (this.boundViewportWheel) {
      this.el('tilemap')?.removeEventListener('wheel', this.boundViewportWheel)
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
      <canvas data-id="tilemap" width="640" height="480"></canvas>

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
            <legend>Categories</legend>
            <div data-id="categories"></div>
          </fieldset>

          <fieldset>
            <legend>Tiles</legend>
            <div data-id="tiles"></div>
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
    this.headerControlButtons('[data-tool]').forEach((btn) => {
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
    this.headerControlButtons('[data-tool]').forEach((btn) => {
      const isActive = parseInt(btn.dataset.tool, 10) === this.currentTool
      btn.classList.toggle('accent', isActive)
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false')
    })

    const gridBtn = this.headerControl('grid-btn')
    if (gridBtn) {
      gridBtn.classList.toggle('accent', this.showGrid)
      gridBtn.setAttribute('aria-pressed', this.showGrid ? 'true' : 'false')
    }
  }

  setupViewportControls() {
    const canvas = this.el('tilemap')
    this.boundViewportWheel = (e) => {
      e.preventDefault()
      const rect = this.getBoundingClientRect()
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
    canvas.addEventListener('wheel', this.boundViewportWheel, { passive: false })

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
    const sidepanel = this.el('sidepanel')
    const viewportWidth = Math.max(1, this.clientWidth - (sidepanel?.offsetWidth || 0))
    const viewportHeight = Math.max(1, this.clientHeight)
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
    let isDragging = false
    let areaDrag = false

    const isAreaDrag = (e) => this.currentTool === 0 || (e.shiftKey && (this.currentTool === 1 || this.currentTool === 2))

    const eventToCell = (e) => {
      const viewportRect = this.getBoundingClientRect()
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
      row.className = 'split-row'

      const name = document.createElement('button')
      if (this.selectedLayer === i) name.classList.add('accent')
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
    if (on) btn.classList.add('accent')
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
    allBtn.className = this.selectedCategory === -1 ? 'accent' : ''
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
      btn.className = this.selectedCategory === i ? 'accent' : ''
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
      if (i === currentTileIdx) btn.classList.add('accent')
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
