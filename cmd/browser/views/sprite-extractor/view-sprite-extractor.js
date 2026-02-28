import { ViewCanvasBase } from "../view-canvas-base.js"
import { bus } from "../../systems/event-bus.js"
import { decode as decodeQOI } from "../../util/qoi/decode.js"
import { ViewFiles } from "../view-files.js"

/**
 * Sprite Extractor View
 * 
 * Interactive tool for detecting and extracting sprites from images.
 * Uses the sprite-detect WASM plugin for blob detection.
 * 
 * Attributes:
 * - data-source: Path to source image file
 * - data-output-dir: Output directory for extracted sprites
 */
export class ViewSpriteExtractor extends ViewCanvasBase {
  static get viewMeta() { return { displayName: 'Extractor', category: 'Sprites' } }

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

    // Detection parameters
    this.minSize = 4
    this.mergeOverlapping = true
    this.alphaThreshold = 1

    // Detected sprites
    this.sprites = []
    this.selectedSprites = new Set() // indices of selected sprites

    // Hover state
    this.hoveredSprite = -1

    // Colors
    this.colors = {
      unselected: 'rgba(255, 100, 100, 0.3)',
      unselectedBorder: 'rgba(255, 100, 100, 0.8)',
      selected: 'rgba(100, 255, 100, 0.3)',
      selectedBorder: 'rgba(100, 255, 100, 0.9)',
      hovered: 'rgba(100, 100, 255, 0.4)',
      hoveredBorder: 'rgba(100, 100, 255, 1)'
    }

    // Spritesheet export settings
    this.outputCellW = 32
    this.outputCellH = 32
    this.suggestedSize = { width: 0, height: 0 }
    this.pivots = new Map()      // Map<spriteIndex, {x, y}>
    this.defaultPivot = { x: 0.5, y: 0.5 }  // Center
    this.pivotEditMode = false
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

    // Create side panel for controls
    this.sidePanel = document.createElement('aside')
    this.sidePanel.className = 'sprite-extractor-panel'
    this.sidePanel.innerHTML = `
      <div class="panel-section">
        <h4>Detection Parameters</h4>
        <label>
          Min Size (px):
          <input type="number" id="minSize" value="${this.minSize}" min="1" max="100">
        </label>
        <label>
          <input type="checkbox" id="mergeOverlapping" ${this.mergeOverlapping ? 'checked' : ''}>
          Merge Overlapping
        </label>
        <label>
          Alpha Threshold:
          <input type="number" id="alphaThreshold" value="${this.alphaThreshold}" min="1" max="255">
        </label>
        <button id="detectBtn" class="primary">Detect Sprites</button>
      </div>
      
      <div class="panel-section">
        <h4>Selection</h4>
        <div class="button-row">
          <button id="selectAllBtn">Select All</button>
          <button id="selectNoneBtn">Select None</button>
        </div>
        <div id="spriteCount">No sprites detected</div>
      </div>
      
      <div class="panel-section">
        <h4>Export Individual</h4>
        <button id="exportBtn" class="primary" disabled>Export Selected</button>
      </div>
      
      <div class="panel-section">
        <h4>Spritesheet Export</h4>
        <div class="size-inputs">
          <label>
            Cell W:
            <input type="number" id="outputCellW" value="${this.outputCellW}" min="8" max="512">
          </label>
          <label>
            Cell H:
            <input type="number" id="outputCellH" value="${this.outputCellH}" min="8" max="512">
          </label>
        </div>
        <button id="suggestSizeBtn" disabled>Suggest Size</button>
        <div id="suggestedSizeInfo"></div>
        
        <label style="margin-top: 8px;">
          Default Pivot:
          <select id="defaultPivotSelect">
            <option value="center" selected>Center</option>
            <option value="top">Top Center</option>
            <option value="bottom">Bottom Center</option>
            <option value="left">Left Center</option>
            <option value="right">Right Center</option>
            <option value="top-left">Top Left</option>
            <option value="top-right">Top Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="bottom-right">Bottom Right</option>
          </select>
        </label>
        
        <button id="editPivotsBtn" disabled>Edit Pivots</button>
        <div id="pivotEditInfo" style="display: none; margin-top: 8px; font-size: 11px; color: var(--color-semantic-text-secondary);">
          Click on sprites to set custom pivot points. Right-click to reset to default.
        </div>
        
        <button id="saveSpritesheetBtn" class="primary" style="margin-top: 8px;" disabled>Save Spritesheet</button>
      </div>
      
      <div class="panel-section" id="spriteList">
        <h4>Sprites</h4>
        <div class="sprite-list-container"></div>
      </div>
    `
    this.appendChild(this.sidePanel)

    // Add panel styles
    this.addStyles()

    // Bind control events
    this.bindControls()
  }

  addStyles() {
    const style = document.createElement('style')
    style.textContent = `
      .sprite-extractor-panel {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 220px;
        background: var(--color-semantic-background-secondary, #2a2a2a);
        border-left: 1px solid var(--color-semantic-border-default, #444);
        padding: 12px;
        overflow-y: auto;
        font-size: 12px;
        z-index: 10;
      }
      
      .sprite-extractor-panel .panel-section {
        margin-bottom: 16px;
      }
      
      .sprite-extractor-panel h4 {
        margin: 0 0 8px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: var(--color-semantic-text-secondary, #888);
      }
      
      .sprite-extractor-panel label {
        display: block;
        margin-bottom: 8px;
      }
      
      .sprite-extractor-panel input[type="number"] {
        width: 60px;
        padding: 4px;
        margin-left: 8px;
        background: var(--color-semantic-background-primary, #1a1a1a);
        border: 1px solid var(--color-semantic-border-default, #444);
        color: var(--color-semantic-text-primary, #fff);
        border-radius: 4px;
      }
      
      .sprite-extractor-panel input[type="checkbox"] {
        margin-right: 8px;
      }
      
      .sprite-extractor-panel button {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        background: var(--color-semantic-background-tertiary, #333);
        color: var(--color-semantic-text-primary, #fff);
      }
      
      .sprite-extractor-panel button:hover {
        background: var(--color-semantic-background-hover, #444);
      }
      
      .sprite-extractor-panel button.primary {
        background: var(--color-semantic-background-accent-default, #0066cc);
        color: var(--color-semantic-text-on-accent, #000);
      }
      
      .sprite-extractor-panel button.primary:hover {
        background: var(--color-semantic-background-accent-hover, #0077dd);
        color: var(--color-semantic-text-on-accent, #000);
      }
      
      .sprite-extractor-panel button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .sprite-extractor-panel .button-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .sprite-extractor-panel .button-row button {
        flex: 1;
      }
      
      .sprite-list-container {
        max-height: 300px;
        overflow-y: auto;
      }
      
      .sprite-list-item {
        display: flex;
        align-items: center;
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 4px;
      }
      
      .sprite-list-item:hover {
        background: var(--color-semantic-background-hover, #333);
      }
      
      .sprite-list-item.selected {
        background: var(--color-semantic-background-accent-default, #0066cc);
      }
      
      .sprite-list-item input[type="checkbox"] {
        margin-right: 8px;
      }
      
      .sprite-list-item .sprite-dims {
        margin-left: auto;
        color: var(--color-semantic-text-secondary, #888);
        font-size: 10px;
      }
      
      .sprite-extractor-panel .size-inputs {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .sprite-extractor-panel .size-inputs label {
        flex: 1;
      }
      
      .sprite-extractor-panel select {
        width: 100%;
        padding: 4px;
        margin-top: 4px;
        background: var(--color-semantic-background-primary, #1a1a1a);
        border: 1px solid var(--color-semantic-border-default, #444);
        color: var(--color-semantic-text-primary, #fff);
        border-radius: 4px;
      }
      
      #suggestedSizeInfo {
        padding: 4px 8px;
        background: var(--color-semantic-background-primary, #1a1a1a);
        border-radius: 4px;
        margin-top: 4px;
        font-size: 11px;
        min-height: 1em;
      }
      
      #editPivotsBtn.active {
        background: var(--color-semantic-background-accent-default, #0066cc);
        color: var(--color-semantic-text-on-accent, #000);
      }
      
      .sprite-list-item.has-custom-pivot::after {
        content: '';
        width: 6px;
        height: 6px;
        background: #ff9900;
        border-radius: 50%;
        margin-left: 4px;
      }
    `
    this.appendChild(style)
  }

  bindControls() {
    // Detection parameters
    this.sidePanel.querySelector('#minSize').addEventListener('change', (e) => {
      this.minSize = parseInt(e.target.value) || 4
    })

    this.sidePanel.querySelector('#mergeOverlapping').addEventListener('change', (e) => {
      this.mergeOverlapping = e.target.checked
    })

    this.sidePanel.querySelector('#alphaThreshold').addEventListener('change', (e) => {
      this.alphaThreshold = parseInt(e.target.value) || 1
    })

    // Detect button
    this.sidePanel.querySelector('#detectBtn').addEventListener('click', () => {
      this.detectSprites()
    })

    // Selection buttons
    this.sidePanel.querySelector('#selectAllBtn').addEventListener('click', () => {
      this.selectAll()
    })

    this.sidePanel.querySelector('#selectNoneBtn').addEventListener('click', () => {
      this.selectNone()
    })

    // Export button
    this.sidePanel.querySelector('#exportBtn').addEventListener('click', () => {
      this.exportSelected()
    })

    // Spritesheet export controls
    this.sidePanel.querySelector('#outputCellW').addEventListener('change', (e) => {
      this.outputCellW = parseInt(e.target.value) || 32
    })

    this.sidePanel.querySelector('#outputCellH').addEventListener('change', (e) => {
      this.outputCellH = parseInt(e.target.value) || 32
    })

    this.sidePanel.querySelector('#suggestSizeBtn').addEventListener('click', () => {
      this.suggestOutputSize()
    })

    this.sidePanel.querySelector('#defaultPivotSelect').addEventListener('change', (e) => {
      this.setDefaultPivot(e.target.value)
      this.draw()
    })

    this.sidePanel.querySelector('#editPivotsBtn').addEventListener('click', () => {
      this.togglePivotEditMode()
    })

    this.sidePanel.querySelector('#saveSpritesheetBtn').addEventListener('click', () => {
      this.saveSpritesheet()
    })
  }

  connectedCallback() {
    super.connectedCallback()

    // Adjust canvas width to account for side panel
    this.canvas.style.width = 'calc(100% - 220px)'

    // Bind header control buttons
    this.bindHeaderControls()

    // Load source if attribute is set
    if (this.hasAttribute('data-source')) {
      this.sourcePath = this.getAttribute('data-source')
      this.loadSourceImage(this.sourcePath)
    }
  }

  /**
   * Override to account for side panel width when sizing canvas bitmap
   */
  _onResized(width, height) {
    // Account for the side panel width (220px)
    const panelWidth = 220
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
      // Read file via FS plugin
      const result = await window.pluginManager.call('fs', 'read', path)
      if (result.returnCode !== 0) {
        throw new Error(new TextDecoder().decode(result.output))
      }

      const data = result.output

      // Decode image (QOI or PNG)
      let imageData
      if (data[0] === 0x71 && data[1] === 0x6f && data[2] === 0x69 && data[3] === 0x66) {
        // QOI
        const decoded = decodeQOI(data.buffer)
        imageData = new ImageData(
          new Uint8ClampedArray(decoded.data.buffer),
          decoded.width,
          decoded.height
        )
      } else {
        // Assume PNG - use browser's native decoding
        const blob = new Blob([data], { type: 'image/png' })
        const bitmap = await createImageBitmap(blob)

        // Draw to offscreen canvas to get ImageData
        const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = offscreen.getContext('2d')
        ctx.drawImage(bitmap, 0, 0)
        imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
      }

      // Create ImageBitmap for efficient rendering
      this.sourceImage = await createImageBitmap(imageData)
      this.sourceWidth = imageData.width
      this.sourceHeight = imageData.height

      // Update content bounds
      this.contentBounds = {
        minX: 0,
        minY: 0,
        maxX: this.sourceWidth,
        maxY: this.sourceHeight
      }

      // Reset sprites
      this.sprites = []
      this.selectedSprites.clear()
      this.updateSpriteList()

      // Fit to view and redraw
      this.fitToContent()
      this.draw()

    } catch (err) {
      console.error('[sprite-extractor] Failed to load image:', err)
      bus.emit('toast:show', { message: `Failed to load image: ${err.message}`, type: 'error' })
    }
  }

  async detectSprites() {
    if (!this.sourcePath) {
      bus.emit('toast:show', { message: 'No source image loaded', type: 'warning' })
      return
    }

    try {
      const input = JSON.stringify({
        path: this.sourcePath,
        minSize: this.minSize,
        mergeOverlapping: this.mergeOverlapping,
        alphaThreshold: this.alphaThreshold
      })

      const result = await window.pluginManager.call('sprite-detect', 'detect', input)
      const output = JSON.parse(new TextDecoder().decode(result.output))

      if (!output.success) {
        throw new Error(output.error || 'Detection failed')
      }

      this.sprites = output.sprites || []

      // Select all by default
      this.selectAll()

      // Reset spritesheet settings
      this.pivots.clear()
      this.pivotEditMode = false
      const editBtn = this.sidePanel.querySelector('#editPivotsBtn')
      editBtn.textContent = 'Edit Pivots'
      editBtn.classList.remove('active')
      this.sidePanel.querySelector('#pivotEditInfo').style.display = 'none'

      // Enable spritesheet export buttons
      this.sidePanel.querySelector('#suggestSizeBtn').disabled = false
      this.sidePanel.querySelector('#editPivotsBtn').disabled = false
      this.sidePanel.querySelector('#saveSpritesheetBtn').disabled = false

      // Update UI
      this.updateSpriteList()
      this.updateSpriteCount()
      this.draw()

      bus.emit('toast:show', { message: `Detected ${this.sprites.length} sprites`, type: 'success' })

    } catch (err) {
      console.error('[sprite-extractor] Detection failed:', err)
      bus.emit('toast:show', { message: `Detection failed: ${err.message}`, type: 'error' })
    }
  }

  selectAll() {
    this.selectedSprites.clear()
    for (let i = 0; i < this.sprites.length; i++) {
      this.selectedSprites.add(i)
    }
    this.updateSpriteList()
    this.updateExportButton()
    this.draw()
  }

  selectNone() {
    this.selectedSprites.clear()
    this.updateSpriteList()
    this.updateExportButton()
    this.draw()
  }

  toggleSprite(index) {
    if (this.selectedSprites.has(index)) {
      this.selectedSprites.delete(index)
    } else {
      this.selectedSprites.add(index)
    }
    this.updateSpriteList()
    this.updateExportButton()
    this.draw()
  }

  updateSpriteCount() {
    const countEl = this.sidePanel.querySelector('#spriteCount')
    if (this.sprites.length === 0) {
      countEl.textContent = 'No sprites detected'
    } else {
      countEl.textContent = `${this.selectedSprites.size} of ${this.sprites.length} selected`
    }
  }

  updateExportButton() {
    const btn = this.sidePanel.querySelector('#exportBtn')
    btn.disabled = this.selectedSprites.size === 0
    this.updateSpriteCount()
  }

  updateSpriteList() {
    const container = this.sidePanel.querySelector('.sprite-list-container')
    container.innerHTML = ''

    this.sprites.forEach((sprite, i) => {
      const item = document.createElement('div')
      item.className = 'sprite-list-item'
      if (this.selectedSprites.has(i)) item.classList.add('selected')
      if (this.pivots.has(i)) item.classList.add('has-custom-pivot')

      item.innerHTML = `
        <input type="checkbox" ${this.selectedSprites.has(i) ? 'checked' : ''}>
        <span>sprite_${String(i).padStart(3, '0')}</span>
        <span class="sprite-dims">${sprite.width}x${sprite.height}</span>
      `

      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          this.toggleSprite(i)
        }
      })

      item.querySelector('input').addEventListener('change', () => {
        this.toggleSprite(i)
      })

      item.addEventListener('mouseenter', () => {
        this.hoveredSprite = i
        this.draw()
      })

      item.addEventListener('mouseleave', () => {
        this.hoveredSprite = -1
        this.draw()
      })

      container.appendChild(item)
    })
  }

  async exportSelected() {
    if (this.selectedSprites.size === 0) return

    // Open folder selection dialog
    const folder = await ViewFiles.selectFolder({
      title: 'Export Sprites To',
      root: this.outputDir || '/'
    })

    if (!folder) {
      // User cancelled
      return
    }

    const outputDir = folder.path

    try {
      // Build regions for split operation
      const regions = []
      const indices = Array.from(this.selectedSprites).sort((a, b) => a - b)

      for (const i of indices) {
        const sprite = this.sprites[i]
        regions.push({
          x: sprite.x,
          y: sprite.y,
          width: sprite.width,
          height: sprite.height,
          outputPath: `${outputDir}/sprite_${String(i).padStart(3, '0')}.qoi`
        })
      }

      // Ensure output directory exists
      await window.pluginManager.call('fs', 'mkdir', outputDir)

      // Use image-process plugin to split
      const input = JSON.stringify({
        inputPath: this.sourcePath,
        regions: regions
      })

      const result = await window.pluginManager.call('image-process', 'split', input)
      const output = JSON.parse(new TextDecoder().decode(result.output))

      if (!output.success) {
        throw new Error(output.error || 'Export failed')
      }

      // Update output directory for future exports
      this.outputDir = outputDir

      bus.emit('toast:show', {
        message: `Exported ${regions.length} sprites to ${outputDir}`,
        type: 'success'
      })

    } catch (err) {
      console.error('[sprite-extractor] Export failed:', err)
      bus.emit('toast:show', { message: `Export failed: ${err.message}`, type: 'error' })
    }
  }

  /**
   * Set default pivot from preset name
   */
  setDefaultPivot(preset) {
    const presets = {
      'center': { x: 0.5, y: 0.5 },
      'top': { x: 0.5, y: 0 },
      'bottom': { x: 0.5, y: 1 },
      'left': { x: 0, y: 0.5 },
      'right': { x: 1, y: 0.5 },
      'top-left': { x: 0, y: 0 },
      'top-right': { x: 1, y: 0 },
      'bottom-left': { x: 0, y: 1 },
      'bottom-right': { x: 1, y: 1 }
    }
    this.defaultPivot = presets[preset] || { x: 0.5, y: 0.5 }
  }

  /**
   * Get pivot for a sprite (custom or default)
   */
  getPivotForSprite(index) {
    return this.pivots.get(index) || this.defaultPivot
  }

  /**
   * Suggest output cell size based on largest sprite and pivot positions.
   * When pivot is off-center, the sprite needs more space to stay centered on the pivot.
   */
  suggestOutputSize() {
    if (this.sprites.length === 0) {
      bus.emit('toast:show', { message: 'No sprites detected', type: 'warning' })
      return
    }

    // Calculate required cell size for each sprite considering its pivot
    // When pivot.x = 0.5, sprite is centered, needs width
    // When pivot.x = 0 or 1, sprite is at edge, needs width * 2 to center on pivot
    // Formula: requiredSize = size * 2 * max(pivot, 1 - pivot)
    let maxRequiredWidth = 0
    let maxRequiredHeight = 0

    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i]
      const pivot = this.getPivotForSprite(i)

      // Calculate how much space is needed on each side of the pivot
      // to keep the sprite centered on the pivot point
      const pivotOffsetX = Math.max(pivot.x, 1 - pivot.x)
      const pivotOffsetY = Math.max(pivot.y, 1 - pivot.y)

      const requiredWidth = Math.ceil(sprite.width * 2 * pivotOffsetX)
      const requiredHeight = Math.ceil(sprite.height * 2 * pivotOffsetY)

      if (requiredWidth > maxRequiredWidth) maxRequiredWidth = requiredWidth
      if (requiredHeight > maxRequiredHeight) maxRequiredHeight = requiredHeight
    }

    this.suggestedSize = { width: maxRequiredWidth, height: maxRequiredHeight }
    this.outputCellW = maxRequiredWidth
    this.outputCellH = maxRequiredHeight

    // Update UI
    this.sidePanel.querySelector('#outputCellW').value = this.outputCellW
    this.sidePanel.querySelector('#outputCellH').value = this.outputCellH

    const info = this.sidePanel.querySelector('#suggestedSizeInfo')
    info.innerHTML = `Suggested: ${maxRequiredWidth}x${maxRequiredHeight}<br>(accounts for pivot positions)`

    bus.emit('toast:show', {
      message: `Suggested size: ${maxRequiredWidth}x${maxRequiredHeight}`,
      type: 'success'
    })
  }

  /**
   * Toggle pivot editing mode
   */
  togglePivotEditMode() {
    this.pivotEditMode = !this.pivotEditMode

    const btn = this.sidePanel.querySelector('#editPivotsBtn')
    const info = this.sidePanel.querySelector('#pivotEditInfo')

    if (this.pivotEditMode) {
      btn.textContent = 'Done Editing'
      btn.classList.add('active')
      info.style.display = 'block'
    } else {
      btn.textContent = 'Edit Pivots'
      btn.classList.remove('active')
      info.style.display = 'none'
    }

    this.updateSpriteList()
    this.draw()
  }

  /**
   * Set custom pivot for a specific sprite
   */
  setPivotForSprite(index, x, y) {
    // Clamp values
    x = Math.max(0, Math.min(1, x))
    y = Math.max(0, Math.min(1, y))

    if (Math.abs(x - this.defaultPivot.x) < 0.01 && Math.abs(y - this.defaultPivot.y) < 0.01) {
      // Remove custom pivot if same as default
      this.pivots.delete(index)
    } else {
      this.pivots.set(index, { x, y })
    }
    this.updateSpriteList()
    this.draw()
  }

  /**
   * Save spritesheet with uniform cell sizes and pivot-based positioning
   */
  async saveSpritesheet() {
    if (this.sprites.length === 0) {
      bus.emit('toast:show', { message: 'No sprites detected', type: 'warning' })
      return
    }

    // Use selected sprites only
    const selectedIndices = Array.from(this.selectedSprites).sort((a, b) => a - b)
    if (selectedIndices.length === 0) {
      bus.emit('toast:show', { message: 'No sprites selected', type: 'warning' })
      return
    }

    // Open save dialog
    const saveResult = await ViewFiles.save({
      title: 'Save Spritesheet',
      root: this.outputDir || '/',
      defaultName: 'spritesheet.qoi'
    })

    if (!saveResult) {
      // User cancelled
      return
    }

    const spritesheetPath = saveResult.path
    const outputDir = saveResult.directory

    try {
      // Ensure output directory exists
      await window.pluginManager.call('fs', 'mkdir', outputDir)

      // Build sprite list and pivots for selected sprites
      const spritesToExport = selectedIndices.map(i => this.sprites[i])

      // Convert pivots Map to object with string keys, remapping indices
      const pivotsObj = {}
      selectedIndices.forEach((originalIdx, newIdx) => {
        if (this.pivots.has(originalIdx)) {
          pivotsObj[String(newIdx)] = this.pivots.get(originalIdx)
        }
      })

      const input = JSON.stringify({
        sourcePath: this.sourcePath,
        sprites: spritesToExport,
        pivots: pivotsObj,
        defaultPivot: this.defaultPivot,
        cellW: this.outputCellW,
        cellH: this.outputCellH,
        outputPath: spritesheetPath
      })

      const result = await window.pluginManager.call('sprite-detect', 'exportSpritesheet', input)
      const output = JSON.parse(new TextDecoder().decode(result.output))

      if (!output.success) {
        throw new Error(output.error || 'Failed to generate spritesheet')
      }

      // Update output directory for future exports
      this.outputDir = outputDir

      bus.emit('toast:show', {
        message: `Saved spritesheet to ${output.path} (${output.cols}x${output.rows} grid, ${this.outputCellW}x${this.outputCellH} cells)`,
        type: 'success'
      })

    } catch (err) {
      console.error('[sprite-extractor] Save spritesheet failed:', err)
      bus.emit('toast:show', { message: `Save spritesheet failed: ${err.message}`, type: 'error' })
    }
  }

  // Override mouse handling for sprite selection
  _onMouseMove(e) {
    super._onMouseMove(e)

    if (!this.isDragging && this.sprites.length > 0) {
      const rect = this.canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Convert to world coordinates
      const worldX = (mouseX - this.offsetX) / this.scale
      const worldY = (mouseY - this.offsetY) / this.scale

      // Find sprite under cursor
      let found = -1
      for (let i = this.sprites.length - 1; i >= 0; i--) {
        const s = this.sprites[i]
        if (worldX >= s.x && worldX < s.x + s.width &&
          worldY >= s.y && worldY < s.y + s.height) {
          found = i
          break
        }
      }

      if (found !== this.hoveredSprite) {
        this.hoveredSprite = found
        this.draw()

        // Update tooltip
        if (found >= 0) {
          const s = this.sprites[found]
          this.tileInfo.textContent = `Sprite ${found}: ${s.width}x${s.height} at (${s.x}, ${s.y})`
          this.tileInfo.style.display = 'block'
          this.tileInfo.style.left = `${e.clientX - rect.left + 10}px`
          this.tileInfo.style.top = `${e.clientY - rect.top + 10}px`
        } else {
          this.tileInfo.style.display = 'none'
        }
      }
    }
  }

  _onClick(e) {
    if (this.hoveredSprite >= 0) {
      if (this.pivotEditMode) {
        // In pivot edit mode, set pivot at click location
        const rect = this.canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // Convert to world coordinates
        const worldX = (mouseX - this.offsetX) / this.scale
        const worldY = (mouseY - this.offsetY) / this.scale

        const sprite = this.sprites[this.hoveredSprite]

        // Calculate pivot relative to sprite bounds (0-1)
        const pivotX = (worldX - sprite.x) / sprite.width
        const pivotY = (worldY - sprite.y) / sprite.height

        this.setPivotForSprite(this.hoveredSprite, pivotX, pivotY)
      } else {
        this.toggleSprite(this.hoveredSprite)
      }
    }
  }

  _onContextMenu(e) {
    if (this.pivotEditMode && this.hoveredSprite >= 0) {
      e.preventDefault()
      // Reset pivot to default
      this.pivots.delete(this.hoveredSprite)
      this.updateSpriteList()
      this.draw()
    }
  }

  _addEventListeners() {
    super._addEventListeners()
    this._boundOnClick = this._onClick.bind(this)
    this._boundOnContextMenu = this._onContextMenu.bind(this)
    this.canvas.addEventListener('click', this._boundOnClick)
    this.canvas.addEventListener('contextmenu', this._boundOnContextMenu)
  }

  _removeEventListeners() {
    super._removeEventListeners()
    if (this._boundOnClick) {
      this.canvas.removeEventListener('click', this._boundOnClick)
    }
    if (this._boundOnContextMenu) {
      this.canvas.removeEventListener('contextmenu', this._boundOnContextMenu)
    }
  }

  // Drawing
  drawContent(ctx, data) {
    // Draw source image
    if (this.sourceImage) {
      ctx.drawImage(this.sourceImage, 0, 0)
    }

    // Draw sprite overlays
    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i]
      const isSelected = this.selectedSprites.has(i)
      const isHovered = i === this.hoveredSprite

      // Fill
      if (isHovered) {
        ctx.fillStyle = this.colors.hovered
      } else if (isSelected) {
        ctx.fillStyle = this.colors.selected
      } else {
        ctx.fillStyle = this.colors.unselected
      }
      ctx.fillRect(sprite.x, sprite.y, sprite.width, sprite.height)

      // Border
      if (isHovered) {
        ctx.strokeStyle = this.colors.hoveredBorder
        ctx.lineWidth = 2 / this.scale
      } else if (isSelected) {
        ctx.strokeStyle = this.colors.selectedBorder
        ctx.lineWidth = 1.5 / this.scale
      } else {
        ctx.strokeStyle = this.colors.unselectedBorder
        ctx.lineWidth = 1 / this.scale
      }
      ctx.strokeRect(sprite.x, sprite.y, sprite.width, sprite.height)

      // Draw pivot marker in pivot edit mode
      if (this.pivotEditMode) {
        const pivot = this.getPivotForSprite(i)
        const hasCustom = this.pivots.has(i)

        // Calculate pivot position in world coordinates
        const pivotX = sprite.x + pivot.x * sprite.width
        const pivotY = sprite.y + pivot.y * sprite.height

        const crossSize = 6 / this.scale

        // Draw crosshair
        ctx.strokeStyle = hasCustom ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 170, 255, 0.7)'
        ctx.lineWidth = 2 / this.scale

        ctx.beginPath()
        ctx.moveTo(pivotX - crossSize, pivotY)
        ctx.lineTo(pivotX + crossSize, pivotY)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(pivotX, pivotY - crossSize)
        ctx.lineTo(pivotX, pivotY + crossSize)
        ctx.stroke()

        // Draw small circle at center
        ctx.beginPath()
        ctx.arc(pivotX, pivotY, 2 / this.scale, 0, Math.PI * 2)
        ctx.fillStyle = hasCustom ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 170, 255, 0.9)'
        ctx.fill()
      }

      // Draw order number badge at top-left of sprite
      const label = String(i)
      const fontSize = Math.max(10, Math.min(14, 12 / this.scale))
      ctx.font = `bold ${fontSize}px monospace`

      const textMetrics = ctx.measureText(label)
      const textWidth = textMetrics.width
      const textHeight = fontSize
      const padding = 2 / this.scale
      const badgeWidth = textWidth + padding * 2
      const badgeHeight = textHeight + padding * 2

      // Position badge at top-left corner of sprite
      const badgeX = sprite.x
      const badgeY = sprite.y

      // Draw badge background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
      ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight)

      // Draw badge border
      ctx.strokeStyle = isSelected ? 'rgba(100, 255, 100, 0.9)' : 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1 / this.scale
      ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight)

      // Draw number text
      ctx.fillStyle = isSelected ? '#90ff90' : '#ffffff'
      ctx.textBaseline = 'top'
      ctx.fillText(label, badgeX + padding, badgeY + padding)
    }
  }
}

export default ViewSpriteExtractor
