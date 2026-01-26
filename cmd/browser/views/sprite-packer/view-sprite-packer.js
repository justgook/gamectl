import { ViewCanvasBase } from "../view-canvas-base.js"
import { bus } from "../../systems/event-bus.js"
import { decode as decodeQOI } from "../../util/qoi/decode.js"
import { ViewFiles } from "../view-files.js"

/**
 * Sprite Packer View
 * 
 * Interactive tool for packing sprites into a texture atlas.
 * Uses the sprite-pack WASM plugin for bin packing.
 * 
 * Attributes:
 * - data-sprites: Comma-separated sprite paths or directory
 * - data-output: Output atlas path
 */
export class ViewSpritePacker extends ViewCanvasBase {
  static get observedAttributes() {
    return ['data-sprites', 'data-output']
  }

  constructor() {
    super()
    
    // Sprites to pack
    this.sprites = [] // {path, name, image, width, height}
    
    // Packing options
    this.options = {
      padding: 2,
      extrude: 1,
      powerOfTwo: true,
      maxSize: 4096,
      cropAlpha: true
    }
    
    // Packing result
    this.atlas = null
    this.atlasWidth = 0
    this.atlasHeight = 0
    this.placements = []
    
    // Output path
    this.outputPath = '/atlas.qoi'
    
    // Hover state
    this.hoveredSprite = -1
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'data-sprites' && oldVal !== newVal) {
      this.loadSpritesFromAttribute(newVal)
    }
    if (name === 'data-output' && oldVal !== newVal) {
      this.outputPath = newVal
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
    this.sidePanel.className = 'sprite-packer-panel'
    this.sidePanel.innerHTML = `
      <div class="panel-section">
        <h4>Input Sprites</h4>
        <div class="sprite-input-list"></div>
        <div id="spriteInputCount">0 sprites</div>
      </div>
      
      <div class="panel-section">
        <h4>Packing Options</h4>
        <label>
          Padding:
          <input type="number" id="padding" value="${this.options.padding}" min="0" max="16">
        </label>
        <label>
          Extrude:
          <input type="number" id="extrude" value="${this.options.extrude}" min="0" max="8">
        </label>
        <label>
          Max Size:
          <select id="maxSize">
            <option value="512">512</option>
            <option value="1024">1024</option>
            <option value="2048">2048</option>
            <option value="4096" selected>4096</option>
            <option value="8192">8192</option>
          </select>
        </label>
        <label>
          <input type="checkbox" id="powerOfTwo" ${this.options.powerOfTwo ? 'checked' : ''}>
          Power of 2
        </label>
        <label>
          <input type="checkbox" id="cropAlpha" ${this.options.cropAlpha ? 'checked' : ''}>
          Crop Alpha
        </label>
      </div>
      
      <div class="panel-section">
        <h4>Actions</h4>
        <button id="packBtn" class="primary full-width">Pack Atlas</button>
      </div>
      
      <div class="panel-section">
        <h4>Result</h4>
        <div id="resultInfo">No atlas generated</div>
        <label>
          Output Path:
          <input type="text" id="outputPath" value="${this.outputPath}" style="width: 100%">
        </label>
        <button id="saveBtn" class="primary full-width" disabled>Save Atlas</button>
        <button id="saveMetaBtn" class="full-width" disabled>Save Metadata</button>
      </div>
    `
    this.appendChild(this.sidePanel)
    
    // Add styles
    this.addStyles()
    
    // Bind events
    this.bindControls()
  }

  addStyles() {
    const style = document.createElement('style')
    style.textContent = `
      .sprite-packer-panel {
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
      
      .sprite-packer-panel .panel-section {
        margin-bottom: 16px;
      }
      
      .sprite-packer-panel h4 {
        margin: 0 0 8px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: var(--color-semantic-text-secondary, #888);
      }
      
      .sprite-packer-panel label {
        display: block;
        margin-bottom: 8px;
      }
      
      .sprite-packer-panel input[type="number"],
      .sprite-packer-panel input[type="text"],
      .sprite-packer-panel select {
        width: 70px;
        padding: 4px;
        margin-left: 8px;
        background: var(--color-semantic-background-primary, #1a1a1a);
        border: 1px solid var(--color-semantic-border-default, #444);
        color: var(--color-semantic-text-primary, #fff);
        border-radius: 4px;
      }
      
      .sprite-packer-panel input[type="text"] {
        width: calc(100% - 8px);
        margin-left: 0;
        margin-top: 4px;
      }
      
      .sprite-packer-panel input[type="checkbox"] {
        margin-right: 8px;
      }
      
      .sprite-packer-panel button {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        background: var(--color-semantic-background-tertiary, #333);
        color: var(--color-semantic-text-primary, #fff);
      }
      
      .sprite-packer-panel button:hover {
        background: var(--color-semantic-background-hover, #444);
      }
      
      .sprite-packer-panel button.primary {
        background: var(--color-semantic-background-accent-default, #0066cc);
        color: var(--color-semantic-text-on-accent, #000);
      }
      
      .sprite-packer-panel button.primary:hover {
        background: var(--color-semantic-background-accent-hover, #0077dd);
        color: var(--color-semantic-text-on-accent, #000);
      }
      
      .sprite-packer-panel button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .sprite-packer-panel button.full-width {
        width: 100%;
        margin-bottom: 8px;
      }
      
      .sprite-packer-panel .button-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .sprite-packer-panel .button-row button {
        flex: 1;
      }
      
      .sprite-input-list {
        max-height: 150px;
        overflow-y: auto;
        background: var(--color-semantic-background-primary, #1a1a1a);
        border-radius: 4px;
        margin-bottom: 8px;
      }
      
      .sprite-input-item {
        display: flex;
        align-items: center;
        padding: 4px 8px;
        border-bottom: 1px solid var(--color-semantic-border-default, #333);
      }
      
      .sprite-input-item:last-child {
        border-bottom: none;
      }
      
      .sprite-input-item .sprite-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .sprite-input-item .sprite-dims {
        color: var(--color-semantic-text-secondary, #888);
        font-size: 10px;
        margin-left: 8px;
      }
      
      .sprite-input-item .remove-btn {
        padding: 2px 6px;
        margin-left: 4px;
        font-size: 10px;
      }
      
      #resultInfo {
        padding: 8px;
        background: var(--color-semantic-background-primary, #1a1a1a);
        border-radius: 4px;
        margin-bottom: 8px;
      }
    `
    this.appendChild(style)
  }

  bindControls() {
    // Options
    this.sidePanel.querySelector('#padding').addEventListener('change', (e) => {
      this.options.padding = parseInt(e.target.value) || 0
    })
    
    this.sidePanel.querySelector('#extrude').addEventListener('change', (e) => {
      this.options.extrude = parseInt(e.target.value) || 0
    })
    
    this.sidePanel.querySelector('#maxSize').addEventListener('change', (e) => {
      this.options.maxSize = parseInt(e.target.value) || 4096
    })
    
    this.sidePanel.querySelector('#powerOfTwo').addEventListener('change', (e) => {
      this.options.powerOfTwo = e.target.checked
    })
    
    this.sidePanel.querySelector('#cropAlpha').addEventListener('change', (e) => {
      this.options.cropAlpha = e.target.checked
    })
    
    // Pack button
    this.sidePanel.querySelector('#packBtn').addEventListener('click', () => {
      this.packAtlas()
    })
    
    // Output path
    this.sidePanel.querySelector('#outputPath').addEventListener('change', (e) => {
      this.outputPath = e.target.value
    })
    
    // Save button
    this.sidePanel.querySelector('#saveBtn').addEventListener('click', () => {
      this.saveAtlas()
    })
    
    // Save metadata button
    this.sidePanel.querySelector('#saveMetaBtn').addEventListener('click', () => {
      this.saveMetadata()
    })
  }

  connectedCallback() {
    super.connectedCallback()
    
    // Adjust canvas width
    this.canvas.style.width = 'calc(100% - 240px)'
    
    // Bind header control buttons
    this.bindHeaderControls()
    
    // Load sprites from attribute
    if (this.hasAttribute('data-sprites')) {
      this.loadSpritesFromAttribute(this.getAttribute('data-sprites'))
    }
  }

  /**
   * Bind header control buttons from template
   */
  bindHeaderControls() {
    // Add sprites button - opens file chooser with multi-select
    const addSpritesBtn = this.queryHeaderControl('[data-action="add-sprites"]')
    if (addSpritesBtn) {
      addSpritesBtn.addEventListener('click', () => this.openSpriteChooser())
    }

    // Clear button
    const clearBtn = this.queryHeaderControl('[data-action="clear"]')
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearSprites())
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
   * Open file chooser to select sprite files (multi-select)
   */
  async openSpriteChooser() {
    const result = await ViewFiles.choose({
      title: 'Select Sprites',
      filter: '*.png,*.qoi',
      multiSelect: true,
      selectFolders: true,
      root: '/'
    })

    if (result && result.length > 0) {
      for (const item of result) {
        await this.addSpritePath(item.path)
      }
      bus.emit('toast:show', { 
        message: `Added ${result.length} item${result.length > 1 ? 's' : ''}`, 
        type: 'success' 
      })
    }
  }

  async loadSpritesFromAttribute(value) {
    if (!value) return
    
    const paths = value.split(',').map(p => p.trim()).filter(Boolean)
    for (const path of paths) {
      await this.addSpritePath(path)
    }
  }

  async addSpritePath(path) {
    try {
      // Check if it's a directory
      const statResult = await window.pluginManager.call('fs', 'stat', path)
      const stat = JSON.parse(new TextDecoder().decode(statResult.output))
      
      if (stat.type === 'directory') {
        // List directory and add all images
        const listResult = await window.pluginManager.call('fs', 'list', path)
        const files = JSON.parse(new TextDecoder().decode(listResult.output))
        
        for (const file of files) {
          if (file.endsWith('.qoi') || file.endsWith('.png')) {
            await this.addSpriteFile(`${path}/${file}`)
          }
        }
      } else {
        await this.addSpriteFile(path)
      }
    } catch (err) {
      console.error('[sprite-packer] Failed to add path:', path, err)
      bus.emit('toast:show', { message: `Failed to add: ${path}`, type: 'error' })
    }
  }

  async addSpriteFile(path) {
    try {
      // Read and decode image
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
      
      // Extract name from path
      const name = path.split('/').pop().replace(/\.(qoi|png)$/i, '')
      
      // Create thumbnail for display
      const thumbnail = await createImageBitmap(imageData)
      
      this.sprites.push({
        path,
        name,
        image: thumbnail,
        width: imageData.width,
        height: imageData.height
      })
      
      this.updateSpriteInputList()
      this.draw()
      
    } catch (err) {
      console.error('[sprite-packer] Failed to load sprite:', path, err)
    }
  }

  clearSprites() {
    this.sprites = []
    this.atlas = null
    this.placements = []
    this.updateSpriteInputList()
    this.updateResultInfo()
    this.draw()
  }

  removeSprite(index) {
    this.sprites.splice(index, 1)
    this.updateSpriteInputList()
    this.draw()
  }

  updateSpriteInputList() {
    const container = this.sidePanel.querySelector('.sprite-input-list')
    container.innerHTML = ''
    
    this.sprites.forEach((sprite, i) => {
      const item = document.createElement('div')
      item.className = 'sprite-input-item'
      item.innerHTML = `
        <span class="sprite-name" title="${sprite.path}">${sprite.name}</span>
        <span class="sprite-dims">${sprite.width}x${sprite.height}</span>
        <button class="remove-btn">x</button>
      `
      
      item.querySelector('.remove-btn').addEventListener('click', () => {
        this.removeSprite(i)
      })
      
      container.appendChild(item)
    })
    
    this.sidePanel.querySelector('#spriteInputCount').textContent = 
      `${this.sprites.length} sprite${this.sprites.length !== 1 ? 's' : ''}`
  }

  async packAtlas() {
    if (this.sprites.length === 0) {
      bus.emit('toast:show', { message: 'No sprites to pack', type: 'warning' })
      return
    }
    
    try {
      const input = JSON.stringify({
        sprites: this.sprites.map(s => ({ path: s.path, name: s.name })),
        options: this.options,
        outputPath: '/tmp/atlas_preview.qoi'
      })
      
      const result = await window.pluginManager.call('sprite-pack', 'pack', input)
      const output = JSON.parse(new TextDecoder().decode(result.output))
      
      if (!output.success) {
        throw new Error(output.error || 'Packing failed')
      }
      
      this.placements = output.placements
      this.atlasWidth = output.atlasW
      this.atlasHeight = output.atlasH
      
      // Load the generated atlas for preview
      const atlasResult = await window.pluginManager.call('fs', 'read', '/tmp/atlas_preview.qoi')
      if (atlasResult.returnCode === 0) {
        const decoded = decodeQOI(atlasResult.output.buffer)
        const imageData = new ImageData(
          new Uint8ClampedArray(decoded.data.buffer),
          decoded.width,
          decoded.height
        )
        this.atlas = await createImageBitmap(imageData)
      }
      
      // Update content bounds
      this.contentBounds = {
        minX: 0,
        minY: 0,
        maxX: this.atlasWidth,
        maxY: this.atlasHeight
      }
      
      this.updateResultInfo()
      this.fitToContent()
      this.draw()
      
      // Enable save buttons
      this.sidePanel.querySelector('#saveBtn').disabled = false
      this.sidePanel.querySelector('#saveMetaBtn').disabled = false
      
      bus.emit('toast:show', { 
        message: `Packed ${this.sprites.length} sprites into ${this.atlasWidth}x${this.atlasHeight} atlas`, 
        type: 'success' 
      })
      
    } catch (err) {
      console.error('[sprite-packer] Packing failed:', err)
      bus.emit('toast:show', { message: `Packing failed: ${err.message}`, type: 'error' })
    }
  }

  updateResultInfo() {
    const info = this.sidePanel.querySelector('#resultInfo')
    if (!this.atlas) {
      info.textContent = 'No atlas generated'
    } else {
      info.innerHTML = `
        Atlas: ${this.atlasWidth} x ${this.atlasHeight}<br>
        Sprites: ${this.placements.length}
      `
    }
  }

  async saveAtlas() {
    if (!this.atlas) return
    
    try {
      // The atlas is already saved to temp, copy to final location
      const readResult = await window.pluginManager.call('fs', 'read', '/tmp/atlas_preview.qoi')
      if (readResult.returnCode !== 0) {
        throw new Error('Failed to read temp atlas')
      }
      
      // Create write input
      const pathBytes = new TextEncoder().encode(this.outputPath)
      const writeInput = new Uint8Array(pathBytes.length + 1 + readResult.output.length)
      writeInput.set(pathBytes)
      writeInput[pathBytes.length] = 0
      writeInput.set(readResult.output, pathBytes.length + 1)
      
      const writeResult = await window.pluginManager.call('fs', 'write', writeInput)
      if (writeResult.returnCode !== 0) {
        throw new Error(new TextDecoder().decode(writeResult.output))
      }
      
      bus.emit('toast:show', { message: `Atlas saved to ${this.outputPath}`, type: 'success' })
      
    } catch (err) {
      console.error('[sprite-packer] Save failed:', err)
      bus.emit('toast:show', { message: `Save failed: ${err.message}`, type: 'error' })
    }
  }

  async saveMetadata() {
    if (this.placements.length === 0) return
    
    try {
      const metaPath = this.outputPath.replace(/\.(qoi|png)$/i, '.json')
      
      const metadata = {
        image: this.outputPath.split('/').pop(),
        width: this.atlasWidth,
        height: this.atlasHeight,
        sprites: this.placements
      }
      
      const metaJson = JSON.stringify(metadata, null, 2)
      const pathBytes = new TextEncoder().encode(metaPath)
      const dataBytes = new TextEncoder().encode(metaJson)
      
      const writeInput = new Uint8Array(pathBytes.length + 1 + dataBytes.length)
      writeInput.set(pathBytes)
      writeInput[pathBytes.length] = 0
      writeInput.set(dataBytes, pathBytes.length + 1)
      
      const result = await window.pluginManager.call('fs', 'write', writeInput)
      if (result.returnCode !== 0) {
        throw new Error(new TextDecoder().decode(result.output))
      }
      
      bus.emit('toast:show', { message: `Metadata saved to ${metaPath}`, type: 'success' })
      
    } catch (err) {
      console.error('[sprite-packer] Metadata save failed:', err)
      bus.emit('toast:show', { message: `Metadata save failed: ${err.message}`, type: 'error' })
    }
  }

  _onMouseMove(e) {
    super._onMouseMove(e)
    
    if (!this.isDragging && this.placements.length > 0) {
      const rect = this.canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const worldX = (mouseX - this.offsetX) / this.scale
      const worldY = (mouseY - this.offsetY) / this.scale
      
      let found = -1
      for (let i = this.placements.length - 1; i >= 0; i--) {
        const p = this.placements[i]
        if (worldX >= p.x && worldX < p.x + p.width &&
            worldY >= p.y && worldY < p.y + p.height) {
          found = i
          break
        }
      }
      
      if (found !== this.hoveredSprite) {
        this.hoveredSprite = found
        this.draw()
        
        if (found >= 0) {
          const p = this.placements[found]
          this.tileInfo.textContent = `${p.name}: ${p.width}x${p.height} at (${p.x}, ${p.y})`
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
    // Draw atlas
    if (this.atlas) {
      ctx.drawImage(this.atlas, 0, 0)
      
      // Draw sprite borders
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)'
      ctx.lineWidth = 1 / this.scale
      
      for (let i = 0; i < this.placements.length; i++) {
        const p = this.placements[i]
        
        if (i === this.hoveredSprite) {
          ctx.strokeStyle = 'rgba(255, 255, 100, 1)'
          ctx.lineWidth = 2 / this.scale
          ctx.strokeRect(p.x, p.y, p.width, p.height)
          ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)'
          ctx.lineWidth = 1 / this.scale
        } else {
          ctx.strokeRect(p.x, p.y, p.width, p.height)
        }
      }
    } else if (this.sprites.length > 0) {
      // No atlas yet - show input sprites in a grid
      ctx.fillStyle = '#333'
      ctx.fillRect(0, 0, 512, 512)
      
      let x = 10, y = 10
      const maxHeight = 64
      
      for (const sprite of this.sprites) {
        const scale = Math.min(1, maxHeight / sprite.height)
        const w = sprite.width * scale
        const h = sprite.height * scale
        
        if (x + w > 500) {
          x = 10
          y += maxHeight + 10
        }
        
        ctx.drawImage(sprite.image, x, y, w, h)
        x += w + 10
      }
      
      this.contentBounds = { minX: 0, minY: 0, maxX: 512, maxY: Math.max(512, y + maxHeight + 10) }
    }
  }
}

customElements.define('view-sprite-packer', ViewSpritePacker)
