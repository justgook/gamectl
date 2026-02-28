import { ViewCanvasBase } from "../view-canvas-base.js"
import { bus } from "../../systems/event-bus.js"
import { decode as decodeQOI } from "../../util/qoi/decode.js"
import { ViewFiles } from "../view-files.js"

/**
 * Tile Extractor View
 * 
 * Interactive tool for extracting tilemaps and tilebanks from game screenshots.
 * Uses the tile-detect WASM plugin for tile detection and deduplication.
 * 
 * Attributes:
 * - data-source: Path to source image file
 * - data-output-dir: Output directory for tiles and tilemap
 */
export class ViewTileExtractor extends ViewCanvasBase {
  static get viewMeta() { return { displayName: 'Tile Extractor', category: 'Tiles' } }

  static get observedAttributes() {
    return ['data-source', 'data-output-dir']
  }

  constructor() {
    super()

    // Source image
    this.sourceImage = null
    this.sourceWidth = 0
    this.sourceHeight = 0
    this.sourcePath = ''

    // Tile settings
    this.tileW = 16
    this.tileH = 16
    this.tolerance = 0

    // Detection result
    this.tilebank = []
    this.tilemap = null

    // Display settings
    this.showGrid = true
    this.highlightDuplicates = true
    this.hoveredTile = { x: -1, y: -1 }

    // Color palette for visualizing unique tiles
    this.tileColors = []
  }

  createHeaderControlsElement() {
    const controls = document.createElement('div')
    controls.innerHTML = `
      <button data-action="load" aria-label="Load" title="Load"><i aria-hidden="true">folder_open</i></button>
      <button data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      <button data-action="zoom-in" aria-label="Zoom In" title="Zoom In"><i aria-hidden="true">zoom_in</i></button>
      <button data-action="zoom-out" aria-label="Zoom Out" title="Zoom Out"><i aria-hidden="true">zoom_out</i></button>
      <button data-action="zoom-fit" aria-label="Fit View" title="Fit View"><i aria-hidden="true">fit_screen</i></button>
    `
    return controls
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'data-source' && oldVal !== newVal) {
      this.sourcePath = newVal
      this.loadSourceImage(newVal)
    }
    if (name === 'data-output-dir' && oldVal !== newVal) {
      this.outputDir = newVal
    }
  }

  setupUI() {
    // Create tooltip
    this.tileInfo = document.createElement('div')
    this.tileInfo.className = 'tooltip'
    this.tileInfo.setAttribute('data-tooltip', '')
    this.tileInfo.style.display = 'none'
    this.appendChild(this.tileInfo)

    // Create side panel
    this.sidePanel = document.createElement('div')
    this.sidePanel.className = 'tile-extractor-panel'
    this.sidePanel.innerHTML = `
      <div class="panel-section">
        <h4>Tile Size</h4>
        <div class="size-inputs">
          <label>
            Width:
            <input type="number" id="tileW" value="${this.tileW}" min="4" max="128">
          </label>
          <label>
            Height:
            <input type="number" id="tileH" value="${this.tileH}" min="4" max="128">
          </label>
        </div>
        <button id="autoDetectBtn">Auto Detect Size</button>
        <div id="sizeInfo"></div>
      </div>
      
      <div class="panel-section">
        <h4>Options</h4>
        <label>
          Tolerance (0-255):
          <input type="number" id="tolerance" value="${this.tolerance}" min="0" max="255">
        </label>
        <label>
          <input type="checkbox" id="showGrid" ${this.showGrid ? 'checked' : ''}>
          Show Grid
        </label>
        <label>
          <input type="checkbox" id="highlightDuplicates" ${this.highlightDuplicates ? 'checked' : ''}>
          Highlight Duplicates
        </label>
      </div>
      
      <div class="panel-section">
        <h4>Actions</h4>
        <button id="extractBtn" class="primary full-width">Extract Tiles</button>
      </div>
      
      <div class="panel-section">
        <h4>Result</h4>
        <div id="resultInfo">No extraction performed</div>
      </div>
      
      <div class="panel-section">
        <h4>Export</h4>
        <button id="saveTilesetBtn" class="primary full-width" disabled>Save Tileset</button>
        <button id="saveTilemapBtn" class="full-width" disabled>Save Tilemap JSON</button>
        <button id="saveToStorageBtn" class="full-width" disabled>Save to Tilemap Storage</button>
      </div>
      
      <div class="panel-section" id="tilebankPreview">
        <h4>Unique Tiles</h4>
        <div class="tilebank-grid"></div>
      </div>
    `
    this.appendChild(this.sidePanel)

    this.addStyles()
    this.bindControls()
  }

  addStyles() {
    const style = document.createElement('style')
    style.textContent = `
      .tile-extractor-panel {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 240px;
        background: var(--color-semantic-background-secondary, #2a2a2a);
        border-left: 1px solid var(--color-semantic-border-default, #444);
        padding: 12px;
        overflow-y: auto;
        font-size: 12px;
        z-index: 10;
      }
      
      .tile-extractor-panel .panel-section {
        margin-bottom: 16px;
      }
      
      .tile-extractor-panel h4 {
        margin: 0 0 8px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: var(--color-semantic-text-secondary, #888);
      }
      
      .tile-extractor-panel label {
        display: block;
        margin-bottom: 8px;
      }
      
      .tile-extractor-panel .size-inputs {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .tile-extractor-panel .size-inputs label {
        flex: 1;
      }
      
      .tile-extractor-panel input[type="number"],
      .tile-extractor-panel input[type="text"],
      .tile-extractor-panel select {
        width: 60px;
        padding: 4px;
        margin-left: 8px;
        background: var(--color-semantic-background-primary, #1a1a1a);
        border: 1px solid var(--color-semantic-border-default, #444);
        color: var(--color-semantic-text-primary, #fff);
        border-radius: 4px;
      }
      
      .tile-extractor-panel input[type="text"] {
        width: calc(100% - 8px);
        margin-left: 0;
        margin-top: 4px;
      }
      
      .tile-extractor-panel input[type="checkbox"] {
        margin-right: 8px;
      }
      
      .tile-extractor-panel button {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        background: var(--color-semantic-background-tertiary, #333);
        color: var(--color-semantic-text-primary, #fff);
        width: 100%;
        margin-bottom: 8px;
      }
      
      .tile-extractor-panel button:hover {
        background: var(--color-semantic-background-hover, #444);
      }
      
      .tile-extractor-panel button.primary {
        background: var(--color-semantic-background-accent-default, #0066cc);
        color: var(--color-semantic-text-on-accent, #000);
      }
      
      .tile-extractor-panel button.primary:hover {
        background: var(--color-semantic-background-accent-hover, #0077dd);
        color: var(--color-semantic-text-on-accent, #000);
      }
      
      .tile-extractor-panel button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .tile-extractor-panel button.full-width {
        width: 100%;
      }
      
      #resultInfo, #sizeInfo {
        padding: 8px;
        background: var(--color-semantic-background-primary, #1a1a1a);
        border-radius: 4px;
        margin-top: 8px;
      }
      
      .tilebank-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        max-height: 200px;
        overflow-y: auto;
      }
      
      .tilebank-item {
        aspect-ratio: 1;
        background: var(--color-semantic-background-primary, #1a1a1a);
        border: 1px solid var(--color-semantic-border-default, #444);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: relative;
      }
      
      .tilebank-item:hover {
        border-color: var(--color-semantic-border-focus, #0066cc);
      }
      
      .tilebank-item canvas {
        max-width: 100%;
        max-height: 100%;
        image-rendering: pixelated;
      }
      
      .tilebank-item .tile-id {
        position: absolute;
        bottom: 2px;
        right: 2px;
        font-size: 8px;
        background: rgba(0,0,0,0.7);
        padding: 1px 3px;
        border-radius: 2px;
      }
    `
    this.appendChild(style)
  }

  bindControls() {
    this.sidePanel.querySelector('#tileW').addEventListener('change', (e) => {
      this.tileW = parseInt(e.target.value) || 16
      this.draw()
    })

    this.sidePanel.querySelector('#tileH').addEventListener('change', (e) => {
      this.tileH = parseInt(e.target.value) || 16
      this.draw()
    })

    this.sidePanel.querySelector('#tolerance').addEventListener('change', (e) => {
      this.tolerance = parseInt(e.target.value) || 0
    })

    this.sidePanel.querySelector('#showGrid').addEventListener('change', (e) => {
      this.showGrid = e.target.checked
      this.draw()
    })

    this.sidePanel.querySelector('#highlightDuplicates').addEventListener('change', (e) => {
      this.highlightDuplicates = e.target.checked
      this.draw()
    })

    this.sidePanel.querySelector('#autoDetectBtn').addEventListener('click', () => {
      this.autoDetectSize()
    })

    this.sidePanel.querySelector('#extractBtn').addEventListener('click', () => {
      this.extractTiles()
    })

    this.sidePanel.querySelector('#saveTilesetBtn').addEventListener('click', () => {
      this.saveTileset()
    })

    this.sidePanel.querySelector('#saveTilemapBtn').addEventListener('click', () => {
      this.saveTilemapJson()
    })

    this.sidePanel.querySelector('#saveToStorageBtn').addEventListener('click', () => {
      this.saveToStorage()
    })
  }

  connectedCallback() {
    super.connectedCallback()

    this.canvas.style.width = 'calc(100% - 240px)'
    this.outputDir = this.getAttribute('data-output-dir') || '/tiles'

    // Bind header control buttons
    this.bindHeaderControls()

    if (this.hasAttribute('data-source')) {
      this.sourcePath = this.getAttribute('data-source')
      this.loadSourceImage(this.sourcePath)
    }
  }

  /**
   * Override to account for side panel width when sizing canvas bitmap
   */
  _onResized(width, height) {
    // Account for the side panel width (240px)
    const panelWidth = 240
    const canvasWidth = Math.max(1, Math.round(width - panelWidth))
    const canvasHeight = Math.round(height)

    if (!this.canvas || (this.canvas.width === canvasWidth && this.canvas.height === canvasHeight)) return

    this.canvas.width = canvasWidth
    this.canvas.height = canvasHeight
    this.draw()

    this._tryAutoFit()
  }

  /**
   * Bind header control buttons from template
   */
  bindHeaderControls() {
    // Load button - opens file chooser
    const loadBtn = this.queryHeaderControl('[data-action="load"]')
    if (loadBtn) {
      loadBtn.addEventListener('click', () => this.openFileChooser())
    }

    // Reload button - reloads current source
    const reloadBtn = this.queryHeaderControl('[data-action="reload"]')
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.reloadSource())
    }

    // Zoom controls
    const zoomInBtn = this.queryHeaderControl('[data-action="zoom-in"]')
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => this.zoomIn())
    }

    const zoomOutBtn = this.queryHeaderControl('[data-action="zoom-out"]')
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => this.zoomOut())
    }

    const zoomFitBtn = this.queryHeaderControl('[data-action="zoom-fit"]')
    if (zoomFitBtn) {
      zoomFitBtn.addEventListener('click', () => this.fitToContent())
    }
  }

  /**
   * Open file chooser to select an image file
   */
  async openFileChooser() {
    const result = await ViewFiles.choose({
      title: 'Select Image',
      filter: '*.png,*.qoi,*.jpg,*.jpeg,*.gif,*.bmp',
      root: '/'
    })

    if (result && result.path) {
      this.sourcePath = result.path
      this.setAttribute('data-source', result.path)
      await this.loadSourceImage(result.path)
      bus.emit('toast:show', { message: `Loaded: ${result.name}`, type: 'success' })
    }
  }

  /**
   * Reload the current source image
   */
  async reloadSource() {
    if (!this.sourcePath) {
      bus.emit('toast:show', { message: 'No source loaded', type: 'warning' })
      return
    }

    await this.loadSourceImage(this.sourcePath)
    bus.emit('toast:show', { message: 'Reloaded source image', type: 'success' })
  }

  async loadSourceImage(path) {
    if (!path) return

    try {
      const result = await window.pluginManager.call('fs', 'read', path)
      if (result.returnCode !== 0) {
        throw new Error(new TextDecoder().decode(result.output))
      }

      const data = result.output
      let imageData

      if (data[0] === 0x71 && data[1] === 0x6f && data[2] === 0x69 && data[3] === 0x66) {
        const decoded = decodeQOI(data.buffer)
        imageData = new ImageData(
          new Uint8ClampedArray(decoded.data.buffer),
          decoded.width,
          decoded.height
        )
      } else {
        const blob = new Blob([data], { type: 'image/png' })
        const bitmap = await createImageBitmap(blob)
        const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = offscreen.getContext('2d')
        ctx.drawImage(bitmap, 0, 0)
        imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
      }

      this.sourceImage = await createImageBitmap(imageData)
      this.sourceWidth = imageData.width
      this.sourceHeight = imageData.height

      this.contentBounds = {
        minX: 0, minY: 0,
        maxX: this.sourceWidth,
        maxY: this.sourceHeight
      }

      // Reset extraction
      this.tilebank = []
      this.tilemap = null
      this.updateResultInfo()
      this.updateTilebankPreview()

      this.fitToContent()
      this.draw()

    } catch (err) {
      console.error('[tile-extractor] Failed to load image:', err)
      bus.emit('toast:show', { message: `Failed to load image: ${err.message}`, type: 'error' })
    }
  }

  async autoDetectSize() {
    if (!this.sourcePath) {
      bus.emit('toast:show', { message: 'No source image loaded', type: 'warning' })
      return
    }

    try {
      const input = JSON.stringify({
        path: this.sourcePath,
        minSize: 8,
        maxSize: 64
      })

      const result = await window.pluginManager.call('tile-detect', 'detectSize', input)
      const output = JSON.parse(new TextDecoder().decode(result.output))

      if (!output.success) {
        throw new Error(output.error || 'Detection failed')
      }

      this.tileW = output.tileW
      this.tileH = output.tileH

      this.sidePanel.querySelector('#tileW').value = this.tileW
      this.sidePanel.querySelector('#tileH').value = this.tileH

      const sizeInfo = this.sidePanel.querySelector('#sizeInfo')
      sizeInfo.innerHTML = `Detected: ${this.tileW}x${this.tileH}<br>Confidence: ${(output.confidence * 100).toFixed(0)}%`

      this.draw()

      bus.emit('toast:show', {
        message: `Detected tile size: ${this.tileW}x${this.tileH}`,
        type: 'success'
      })

    } catch (err) {
      console.error('[tile-extractor] Auto-detect failed:', err)
      bus.emit('toast:show', { message: `Auto-detect failed: ${err.message}`, type: 'error' })
    }
  }

  async extractTiles() {
    if (!this.sourcePath) {
      bus.emit('toast:show', { message: 'No source image loaded', type: 'warning' })
      return
    }

    try {
      const input = JSON.stringify({
        path: this.sourcePath,
        tileW: this.tileW,
        tileH: this.tileH,
        tolerance: this.tolerance,
        skipNthPixel: 1
      })

      const result = await window.pluginManager.call('tile-detect', 'extract', input)
      const output = JSON.parse(new TextDecoder().decode(result.output))

      if (!output.success) {
        throw new Error(output.error || 'Extraction failed')
      }

      this.tilebank = output.tilebank
      this.tilemap = output.tilemap

      // Generate colors for highlighting
      this.generateTileColors(this.tilebank.length)

      this.updateResultInfo()
      this.updateTilebankPreview()
      this.draw()

      // Enable save buttons
      this.sidePanel.querySelector('#saveTilesetBtn').disabled = false
      this.sidePanel.querySelector('#saveTilemapBtn').disabled = false
      this.sidePanel.querySelector('#saveToStorageBtn').disabled = false

      bus.emit('toast:show', {
        message: `Extracted ${this.tilebank.length} unique tiles from ${this.tilemap.width}x${this.tilemap.height} grid`,
        type: 'success'
      })

    } catch (err) {
      console.error('[tile-extractor] Extraction failed:', err)
      bus.emit('toast:show', { message: `Extraction failed: ${err.message}`, type: 'error' })
    }
  }

  generateTileColors(count) {
    this.tileColors = []
    for (let i = 0; i <= count; i++) {
      const hue = (i * 137.5) % 360 // Golden angle distribution
      this.tileColors.push(`hsla(${hue}, 70%, 50%, 0.4)`)
    }
  }

  updateResultInfo() {
    const info = this.sidePanel.querySelector('#resultInfo')
    if (!this.tilemap) {
      info.textContent = 'No extraction performed'
    } else {
      const totalTiles = this.tilemap.width * this.tilemap.height
      const compression = ((1 - this.tilebank.length / totalTiles) * 100).toFixed(1)
      info.innerHTML = `
        Grid: ${this.tilemap.width} x ${this.tilemap.height} tiles<br>
        Unique: ${this.tilebank.length} tiles<br>
        Compression: ${compression}%
      `
    }
  }

  updateTilebankPreview() {
    const grid = this.sidePanel.querySelector('.tilebank-grid')
    grid.innerHTML = ''

    if (!this.sourceImage || !this.tilemap) return

    // Create an offscreen canvas to extract tiles from source image
    const sourceCanvas = new OffscreenCanvas(this.sourceWidth, this.sourceHeight)
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
    sourceCtx.drawImage(this.sourceImage, 0, 0)

    const cols = this.tilemap.width

    for (const tile of this.tilebank) {
      const item = document.createElement('div')
      item.className = 'tilebank-item'

      // Calculate tile position from sourceIndex
      const tileX = tile.sourceIndex % cols
      const tileY = Math.floor(tile.sourceIndex / cols)
      const srcX = tileX * this.tileW
      const srcY = tileY * this.tileH

      // Extract tile from source image
      const tileData = sourceCtx.getImageData(srcX, srcY, this.tileW, this.tileH)

      const canvas = document.createElement('canvas')
      canvas.width = this.tileW
      canvas.height = this.tileH
      canvas.getContext('2d').putImageData(tileData, 0, 0)

      item.appendChild(canvas)

      const idLabel = document.createElement('span')
      idLabel.className = 'tile-id'
      idLabel.textContent = tile.id
      item.appendChild(idLabel)

      item.addEventListener('click', () => {
        this.highlightTileId = this.highlightTileId === tile.id ? null : tile.id
        this.draw()
      })

      grid.appendChild(item)
    }
  }

  async saveTileset() {
    if (!this.tilebank.length || !this.tilemap) return

    // Open save dialog
    const saveResult = await ViewFiles.save({
      title: 'Save Tileset',
      root: this.outputDir || '/',
      defaultName: 'tileset.qoi'
    })

    if (!saveResult) {
      // User cancelled
      return
    }

    const tilesetPath = saveResult.path
    const outputDir = saveResult.directory

    try {
      // Ensure output directory exists
      await window.pluginManager.call('fs', 'mkdir', outputDir)

      const input = JSON.stringify({
        tilebank: this.tilebank,
        sourcePath: this.sourcePath,
        sourceCols: this.tilemap.width,
        tileW: this.tilemap.tileW,
        tileH: this.tilemap.tileH,
        outputPath: tilesetPath
      })

      const result = await window.pluginManager.call('tile-detect', 'exportTileset', input)
      const output = JSON.parse(new TextDecoder().decode(result.output))

      if (!output.success) {
        throw new Error(output.error || 'Failed to generate tileset')
      }

      // Update output directory for future saves
      this.outputDir = outputDir

      // Store tileset info for later use
      this.tilesetInfo = {
        path: output.path,
        width: output.width,
        height: output.height,
        cols: output.cols,
        rows: output.rows
      }

      bus.emit('toast:show', {
        message: `Saved tileset to ${output.path} (${output.cols}x${output.rows} grid)`,
        type: 'success'
      })

    } catch (err) {
      console.error('[tile-extractor] Save tileset failed:', err)
      bus.emit('toast:show', { message: `Save tileset failed: ${err.message}`, type: 'error' })
    }
  }

  async saveTilemapJson() {
    if (!this.tilemap) return

    // Open save dialog
    const saveResult = await ViewFiles.save({
      title: 'Save Tilemap JSON',
      root: this.outputDir || '/',
      defaultName: 'tilemap.json'
    })

    if (!saveResult) {
      // User cancelled
      return
    }

    const jsonPath = saveResult.path
    const outputDir = saveResult.directory

    try {
      // Ensure output directory exists
      await window.pluginManager.call('fs', 'mkdir', outputDir)

      const tilemapData = {
        width: this.tilemap.width,
        height: this.tilemap.height,
        tileW: this.tilemap.tileW,
        tileH: this.tilemap.tileH,
        data: this.tilemap.data,
        tilebank: this.tilebank.map(t => ({
          id: t.id,
          path: `tile_${String(t.id).padStart(3, '0')}.qoi`
        }))
      }

      // Include tileset reference if available
      if (this.tilesetInfo) {
        tilemapData.tileset = 'tileset.qoi'
        tilemapData.tilesetCols = this.tilesetInfo.cols
      }

      const jsonData = JSON.stringify(tilemapData, null, 2)

      const pathBytes = new TextEncoder().encode(jsonPath)
      const dataBytes = new TextEncoder().encode(jsonData)
      const writeInput = new Uint8Array(pathBytes.length + 1 + dataBytes.length)
      writeInput.set(pathBytes)
      writeInput[pathBytes.length] = 0
      writeInput.set(dataBytes, pathBytes.length + 1)

      await window.pluginManager.call('fs', 'write', writeInput)

      // Update output directory for future saves
      this.outputDir = outputDir

      bus.emit('toast:show', { message: `Saved tilemap to ${jsonPath}`, type: 'success' })

    } catch (err) {
      console.error('[tile-extractor] Save JSON failed:', err)
      bus.emit('toast:show', { message: `Save JSON failed: ${err.message}`, type: 'error' })
    }
  }

  async saveToStorage() {
    if (!this.tilemap) return

    try {
      // Convert to internal tilemap format via plugin
      const input = JSON.stringify({
        success: true,
        tilebank: this.tilebank,
        tilemap: this.tilemap
      })

      const result = await window.pluginManager.call('tile-detect', 'toTilemap', input)
      const tilemapData = JSON.parse(new TextDecoder().decode(result.output))

      // Add tileset reference to layer props if tileset was generated
      if (this.tilesetInfo && tilemapData.layers && tilemapData.layers.length > 0) {
        tilemapData.layers[0].props = tilemapData.layers[0].props || {}
        tilemapData.layers[0].props.tileset = this.tilesetInfo.path
        tilemapData.layers[0].props.tw = String(this.tilemap.tileW)
        tilemapData.layers[0].props.th = String(this.tilemap.tileH)
      }

      const tilemapJson = JSON.stringify(tilemapData)

      // Prompt for tilemap name
      const mapName = prompt('Enter tilemap name:', 'extracted_map')
      if (!mapName) return

      // Save to tilemap_storage via SQL
      const escapedName = mapName.replace(/'/g, "''")
      const escapedData = tilemapJson.replace(/'/g, "''")
      const sqlQuery = `INSERT OR REPLACE INTO tilemap_storage (name, data) VALUES ('${escapedName}', '${escapedData}')`

      await window.pluginManager.call('sql', 'exec', sqlQuery)

      bus.emit('toast:show', { message: `Saved tilemap as "${mapName}"`, type: 'success' })
      bus.emit('cache:invalidate', { query: `SELECT data FROM tilemap_storage WHERE name = '${mapName}'` })

    } catch (err) {
      console.error('[tile-extractor] Save to storage failed:', err)
      bus.emit('toast:show', { message: `Save to storage failed: ${err.message}`, type: 'error' })
    }
  }

  _onMouseMove(e) {
    super._onMouseMove(e)

    if (!this.isDragging && this.sourceImage) {
      const rect = this.canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const worldX = (mouseX - this.offsetX) / this.scale
      const worldY = (mouseY - this.offsetY) / this.scale

      const tileX = Math.floor(worldX / this.tileW)
      const tileY = Math.floor(worldY / this.tileH)

      if (tileX !== this.hoveredTile.x || tileY !== this.hoveredTile.y) {
        this.hoveredTile = { x: tileX, y: tileY }
        this.draw()

        if (this.tilemap && tileX >= 0 && tileX < this.tilemap.width &&
          tileY >= 0 && tileY < this.tilemap.height) {
          const idx = tileY * this.tilemap.width + tileX
          const tileId = this.tilemap.data[idx]
          this.tileInfo.textContent = `Tile (${tileX}, ${tileY}): ID ${tileId}`
          this.tileInfo.style.display = 'block'
          this.tileInfo.style.left = `${e.clientX - rect.left + 10}px`
          this.tileInfo.style.top = `${e.clientY - rect.top + 10}px`
        } else {
          this.tileInfo.style.display = 'none'
        }
      }
    }
  }

  drawContent(ctx, data) {
    // Draw source image
    if (this.sourceImage) {
      ctx.drawImage(this.sourceImage, 0, 0)
    }

    // Draw grid
    if (this.showGrid && this.sourceImage) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 1 / this.scale

      const cols = Math.floor(this.sourceWidth / this.tileW)
      const rows = Math.floor(this.sourceHeight / this.tileH)

      for (let x = 0; x <= cols; x++) {
        ctx.beginPath()
        ctx.moveTo(x * this.tileW, 0)
        ctx.lineTo(x * this.tileW, rows * this.tileH)
        ctx.stroke()
      }

      for (let y = 0; y <= rows; y++) {
        ctx.beginPath()
        ctx.moveTo(0, y * this.tileH)
        ctx.lineTo(cols * this.tileW, y * this.tileH)
        ctx.stroke()
      }
    }

    // Draw duplicate highlighting
    if (this.highlightDuplicates && this.tilemap && this.tileColors.length > 0) {
      for (let y = 0; y < this.tilemap.height; y++) {
        for (let x = 0; x < this.tilemap.width; x++) {
          const idx = y * this.tilemap.width + x
          const tileId = this.tilemap.data[idx]

          if (tileId > 0) {
            // Highlight specific tile if selected
            if (this.highlightTileId && tileId === this.highlightTileId) {
              ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'
            } else {
              ctx.fillStyle = this.tileColors[tileId % this.tileColors.length]
            }
            ctx.fillRect(x * this.tileW, y * this.tileH, this.tileW, this.tileH)
          }
        }
      }
    }

    // Highlight hovered tile
    if (this.hoveredTile.x >= 0 && this.hoveredTile.y >= 0) {
      ctx.strokeStyle = 'rgba(255, 255, 100, 1)'
      ctx.lineWidth = 2 / this.scale
      ctx.strokeRect(
        this.hoveredTile.x * this.tileW,
        this.hoveredTile.y * this.tileH,
        this.tileW,
        this.tileH
      )
    }
  }
}

export default ViewTileExtractor
