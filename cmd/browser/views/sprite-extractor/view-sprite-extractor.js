import { ViewCanvasBase } from "../view-canvas-base.js"
import { bus } from "../../systems/event-bus.js"
import { decode as decodeQOI } from "../../util/qoi/decode.js"

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
    this.sidePanel = document.createElement('div')
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
        <h4>Export</h4>
        <button id="exportBtn" class="primary" disabled>Export Selected</button>
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
      }
      
      .sprite-extractor-panel button.primary:hover {
        background: var(--color-semantic-background-accent-hover, #0077dd);
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
  }

  connectedCallback() {
    super.connectedCallback()

    // Adjust canvas width to account for side panel
    this.canvas.style.width = 'calc(100% - 220px)'

    // Load source if attribute is set
    if (this.hasAttribute('data-source')) {
      this.sourcePath = this.getAttribute('data-source')
      this.loadSourceImage(this.sourcePath)
    }
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
      item.className = 'sprite-list-item' + (this.selectedSprites.has(i) ? ' selected' : '')
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

    const outputDir = this.outputDir || '/sprites'

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

      bus.emit('toast:show', {
        message: `Exported ${regions.length} sprites to ${outputDir}`,
        type: 'success'
      })

    } catch (err) {
      console.error('[sprite-extractor] Export failed:', err)
      bus.emit('toast:show', { message: `Export failed: ${err.message}`, type: 'error' })
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
      this.toggleSprite(this.hoveredSprite)
    }
  }

  _addEventListeners() {
    super._addEventListeners()
    this.canvas.addEventListener('click', this._onClick.bind(this))
  }

  _removeEventListeners() {
    super._removeEventListeners()
    // Note: click handler will be removed when canvas is removed
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
    }
  }
}

customElements.define('view-sprite-extractor', ViewSpriteExtractor)
