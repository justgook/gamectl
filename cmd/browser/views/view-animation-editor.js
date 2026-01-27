import { bus } from '../systems/event-bus.js'
import { SpritesheetPanel } from './animation-editor/SpritesheetPanel.js'
import { FrameListPanel } from './animation-editor/FrameListPanel.js'
import { AnimationPreview } from './animation-editor/AnimationPreview.js'
import { createAnimation, cloneAnimation } from './animation-editor/AnimationData.js'
import { ViewFiles } from './view-files.js'

/**
 * Animation Editor View
 * 
 * A Tiled-style animation editor for sprite animations.
 * Split layout:
 * - Left: Spritesheet grid for tile selection
 * - Right: Frame list + preview
 * 
 * Attributes:
 * - data-key: Animation name to load (default: 'untitled')
 * - data-spritesheet: Path to spritesheet image
 */
export class ViewAnimationEditor extends HTMLElement {
  static get observedAttributes() {
    return ['data-key', 'data-spritesheet']
  }
  
  constructor() {
    super()
    
    this.animationKey = 'untitled'
    this.animation = createAnimation('untitled')
    
    // Panel references
    this.spritesheetPanel = null
    this.frameListPanel = null
    this.animationPreview = null
    
    // Header controls
    this._headerControlsElement = null
    
    // Event unsubscribers
    this._unsubscribers = []
    
    // Bind methods
    this._onTileAdd = this._onTileAdd.bind(this)
    this._onFramesChanged = this._onFramesChanged.bind(this)
    this._onFrameSelect = this._onFrameSelect.bind(this)
  }
  
  connectedCallback() {
    this._buildDOM()
    this._mountHeaderControls()
    this._setupEventListeners()
    this._setupBusListeners()
    
    // Load initial data if key is set
    if (this.hasAttribute('data-key')) {
      this.animationKey = this.getAttribute('data-key')
      this.fetchData()
    }
    
    // Load spritesheet if set
    if (this.hasAttribute('data-spritesheet')) {
      this._loadSpritesheet(this.getAttribute('data-spritesheet'))
    }
  }
  
  disconnectedCallback() {
    this._unmountHeaderControls()
    this._unsubscribers.forEach(unsub => unsub())
    this._unsubscribers = []
    
    if (this.spritesheetPanel) this.spritesheetPanel.dispose()
    if (this.frameListPanel) this.frameListPanel.dispose()
    if (this.animationPreview) this.animationPreview.dispose()
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    
    switch (name) {
      case 'data-key':
        this.animationKey = newValue || 'untitled'
        this.fetchData()
        break
      case 'data-spritesheet':
        if (newValue) this._loadSpritesheet(newValue)
        break
    }
  }
  
  // --- DOM ---
  
  _buildDOM() {
    this.innerHTML = `
      <div class="animation-editor-container">
        <div class="animation-editor-left">
          <div class="panel-header">Spritesheet</div>
          <div class="spritesheet-container"></div>
        </div>
        <div class="animation-editor-right">
          <div class="animation-editor-preview-section">
            <div class="panel-header">Preview</div>
            <div class="preview-container"></div>
            <div class="preview-controls">
              <button data-action="play" class="btn-icon" title="Play/Pause">▶</button>
              <button data-action="stop" class="btn-icon" title="Stop">◼</button>
              <label class="control-checkbox">
                <input type="checkbox" data-action="loop" checked>
                <span>Loop</span>
              </label>
            </div>
          </div>
          <div class="animation-editor-frames-section">
            <div class="panel-header">Frames</div>
            <div class="frames-toolbar">
              <input type="number" data-element="frame-duration" value="100" min="1" class="input-duration" title="Frame Duration (ms)">
              <span class="duration-label">ms</span>
              <button data-action="apply-duration" class="btn-small">Apply</button>
              <button data-action="delete-frames" class="btn-small btn-danger" title="Delete Selected">Delete</button>
            </div>
            <div class="frames-container"></div>
          </div>
        </div>
      </div>
    `
    
    // Initialize panels
    const spritesheetContainer = this.querySelector('.spritesheet-container')
    const framesContainer = this.querySelector('.frames-container')
    const previewContainer = this.querySelector('.preview-container')
    
    this.spritesheetPanel = new SpritesheetPanel(spritesheetContainer)
    this.frameListPanel = new FrameListPanel(framesContainer, {
      defaultDuration: 100
    })
    this.animationPreview = new AnimationPreview(previewContainer)
    
    // Setup right panel controls
    this._setupRightPanelControls()
  }
  
  _setupRightPanelControls() {
    // Playback controls
    const playBtn = this.querySelector('[data-action="play"]')
    const stopBtn = this.querySelector('[data-action="stop"]')
    const loopCheckbox = this.querySelector('[data-action="loop"]')
    
    if (playBtn) {
      playBtn.onclick = () => {
        if (this.animationPreview.isPlaying()) {
          this.animationPreview.pause()
          playBtn.textContent = '▶'
        } else {
          this.animationPreview.play()
          playBtn.textContent = '⏸'
        }
      }
    }
    
    if (stopBtn) {
      stopBtn.onclick = () => {
        this.animationPreview.stop()
        if (playBtn) playBtn.textContent = '▶'
      }
    }
    
    if (loopCheckbox) {
      loopCheckbox.checked = this.animation.loop
      loopCheckbox.onchange = () => {
        this.animation.loop = loopCheckbox.checked
        this.animationPreview.setLoop(loopCheckbox.checked)
      }
    }
    
    // Frame controls
    const durationInput = this.querySelector('[data-element="frame-duration"]')
    const applyDurationBtn = this.querySelector('[data-action="apply-duration"]')
    const deleteBtn = this.querySelector('[data-action="delete-frames"]')
    
    if (applyDurationBtn && durationInput) {
      applyDurationBtn.onclick = () => {
        const duration = parseInt(durationInput.value, 10) || 100
        this.frameListPanel.updateSelectedDuration(duration)
      }
    }
    
    if (deleteBtn) {
      deleteBtn.onclick = () => this.frameListPanel.removeSelected()
    }
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
        this._setupHeaderControls()
      }
    }
  }
  
  _unmountHeaderControls() {
    if (this._headerControlsElement?.parentElement) {
      this._headerControlsElement.remove()
      this._headerControlsElement = null
    }
  }
  
  _queryHeaderControl(selector) {
    return this._headerControlsElement?.querySelector(selector) ?? null
  }
  
  _setupHeaderControls() {
    // Load spritesheet button
    const loadBtn = this._queryHeaderControl('[data-action="load-spritesheet"]')
    if (loadBtn) {
      loadBtn.onclick = () => this._promptLoadSpritesheet()
    }
    
    // Tile size inputs
    const tileWidthInput = this._queryHeaderControl('[data-element="tile-width"]')
    const tileHeightInput = this._queryHeaderControl('[data-element="tile-height"]')
    
    if (tileWidthInput) {
      tileWidthInput.value = this.animation.tileWidth
      tileWidthInput.onchange = () => this._updateTileSize()
    }
    if (tileHeightInput) {
      tileHeightInput.value = this.animation.tileHeight
      tileHeightInput.onchange = () => this._updateTileSize()
    }
    
    // Save button
    const saveBtn = this._queryHeaderControl('[data-action="save"]')
    if (saveBtn) {
      saveBtn.onclick = () => this.saveData()
    }
  }
  
  // --- Event Listeners ---
  
  _setupEventListeners() {
    // Listen for playback state changes to update button in right panel
    this._unsubscribers.push(
      bus.on('animation:playback:start', () => {
        const playBtn = this.querySelector('[data-action="play"]')
        if (playBtn) playBtn.textContent = '⏸'
      }),
      bus.on('animation:playback:pause', () => {
        const playBtn = this.querySelector('[data-action="play"]')
        if (playBtn) playBtn.textContent = '▶'
      }),
      bus.on('animation:playback:stop', () => {
        const playBtn = this.querySelector('[data-action="play"]')
        if (playBtn) playBtn.textContent = '▶'
      })
    )
    
    // Listen for keybinding events
    this._unsubscribers.push(
      bus.on('animation:playback:toggle', () => {
        this.animationPreview.toggle()
      }),
      bus.on('animation:frame:delete', () => {
        this.frameListPanel.removeSelected()
      }),
      bus.on('animation:frame:select-all', () => {
        this.frameListPanel.selectAll()
      }),
      bus.on('animation:selection:clear', () => {
        this.frameListPanel.clearSelection()
        this.spritesheetPanel.clearSelection()
      }),
      bus.on('animation:save', () => {
        this.saveData()
      })
    )
  }
  
  _setupBusListeners() {
    // Listen for tile additions from spritesheet
    this._unsubscribers.push(
      bus.on('animation:tile:add', this._onTileAdd)
    )
    
    // Listen for frame changes
    this._unsubscribers.push(
      bus.on('animation:frames:changed', this._onFramesChanged)
    )
    
    // Listen for frame selection
    this._unsubscribers.push(
      bus.on('animation:frame:select', this._onFrameSelect)
    )
  }
  
  _onTileAdd({ tileIds }) {
    const durationInput = this._queryHeaderControl('[data-element="frame-duration"]')
    const duration = durationInput ? parseInt(durationInput.value, 10) || 100 : 100
    
    this.frameListPanel.addFrames(tileIds, duration)
  }
  
  _onFramesChanged({ frames }) {
    this.animation.frames = frames
    this._updatePreview()
  }
  
  _onFrameSelect({ indices }) {
    // Could highlight frames in preview or show selection info
  }
  
  // --- Spritesheet ---
  
  async _promptLoadSpritesheet() {
    const result = await ViewFiles.choose({
      title: 'Select Spritesheet',
      filter: '*.png,*.qoi,*.jpg,*.jpeg,*.gif,*.bmp',
      root: '/'
    })
    
    if (result && result.path) {
      await this._loadSpritesheet(result.path)
      bus.emit('toast:show', { message: `Loaded: ${result.name}`, type: 'success' })
    }
  }
  
  async _loadSpritesheet(source) {
    this.animation.spritesheet = source
    await this.spritesheetPanel.loadSpritesheet(source)
    
    // Update panels with spritesheet
    const image = this.spritesheetPanel.getImage()
    if (image) {
      this.frameListPanel.setSpritesheet(
        image, 
        this.animation.tileWidth, 
        this.animation.tileHeight
      )
      this.animationPreview.setSpritesheet(
        image,
        this.animation.tileWidth,
        this.animation.tileHeight
      )
    }
  }
  
  _updateTileSize() {
    const widthInput = this._queryHeaderControl('[data-element="tile-width"]')
    const heightInput = this._queryHeaderControl('[data-element="tile-height"]')
    
    const width = parseInt(widthInput?.value, 10) || 16
    const height = parseInt(heightInput?.value, 10) || 16
    
    this.animation.tileWidth = width
    this.animation.tileHeight = height
    
    this.spritesheetPanel.setTileSize(width, height)
    
    const image = this.spritesheetPanel.getImage()
    if (image) {
      this.frameListPanel.setSpritesheet(image, width, height)
      this.animationPreview.setSpritesheet(image, width, height)
    }
  }
  
  _updatePreview() {
    this.animationPreview.setAnimation(this.animation)
  }
  
  // --- Data Persistence ---
  
  getSelectQuery() {
    return `SELECT data FROM animation_storage WHERE name = '${this.animationKey}'`
  }
  
  getInsertQueryFn() {
    return (name, escapedJsonData) => 
      `INSERT OR REPLACE INTO animation_storage (name, data) VALUES ('${name}', '${escapedJsonData}')`
  }
  
  async fetchData() {
    try {
      const query = this.getSelectQuery()
      bus.emit(`cache:load:${query}`)
      
      // Subscribe to cache updates
      const unsub = bus.on(`cache:changed:${query}`, (data) => {
        if (data) {
          this.animation = cloneAnimation(data)
          this._applyAnimationData()
        }
      })
      this._unsubscribers.push(unsub)
    } catch (err) {
      console.error('Failed to fetch animation:', err)
    }
  }
  
  async saveData() {
    try {
      // Update animation with current frames
      this.animation.frames = this.frameListPanel.getFrames()
      this.animation.name = this.animationKey
      
      const selectQuery = this.getSelectQuery()
      const insertQueryFn = this.getInsertQueryFn()
      
      bus.emit('cache:save', { 
        selectQuery, 
        insertQueryFn,
        // Override data since we want to save current state
        data: this.animation
      })
      
      bus.emit('toast:show', { message: `Animation "${this.animationKey}" saved`, type: 'success' })
    } catch (err) {
      console.error('Failed to save animation:', err)
      bus.emit('toast:show', { message: 'Failed to save animation', type: 'error' })
    }
  }
  
  _applyAnimationData() {
    // Update header controls
    const widthInput = this._queryHeaderControl('[data-element="tile-width"]')
    const heightInput = this._queryHeaderControl('[data-element="tile-height"]')
    const loopCheckbox = this._queryHeaderControl('[data-action="loop"]')
    
    if (widthInput) widthInput.value = this.animation.tileWidth
    if (heightInput) heightInput.value = this.animation.tileHeight
    if (loopCheckbox) loopCheckbox.checked = this.animation.loop
    
    // Update tile size in panels
    this.spritesheetPanel.setTileSize(
      this.animation.tileWidth,
      this.animation.tileHeight
    )
    
    // Load spritesheet if specified
    if (this.animation.spritesheet) {
      this._loadSpritesheet(this.animation.spritesheet).then(() => {
        // After spritesheet loads, set frames
        this.frameListPanel.setFrames(this.animation.frames)
        this._updatePreview()
      })
    } else {
      this.frameListPanel.setFrames(this.animation.frames)
      this._updatePreview()
    }
  }
  
  // --- View Mode ---
  
  getViewMode() {
    return 'animation-editor'
  }
}

customElements.define('view-animation-editor', ViewAnimationEditor)
