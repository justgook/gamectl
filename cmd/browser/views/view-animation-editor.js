import { bus } from '../systems/event-bus.js'
import { SpritesheetPanel } from './animation-editor/SpritesheetPanel.js'
import { FrameListPanel } from './animation-editor/FrameListPanel.js'
import { AnimationPreview } from './animation-editor/AnimationPreview.js'
import { createAnimation, getStartFrame, validateAnimation } from './animation-editor/AnimationData.js'
import { ViewFiles } from './view-files.js'
import { parseCSVLines } from '../util/csv.js'

/**
 * Animation Editor View
 * 
 * A Tiled-style animation editor for sprite animations.
 * Split layout:
 * - Left: Spritesheet grid for tile selection
 * - Right: Frame list + preview
 * 
 * Animation identity is based on (source_file, start_frame) composite key.
 * The first frame's tileId serves as the animation identifier within a spritesheet.
 * 
 * Attributes:
 * - data-spritesheet: Path to spritesheet image
 * - data-start-frame: Starting frame tileId to load (optional)
 */
export class ViewAnimationEditor extends HTMLElement {
  static get observedAttributes() {
    return ['data-spritesheet', 'data-start-frame']
  }
  
  constructor() {
    super()
    
    this.animation = createAnimation()
    
    // Track the original start frame when editing an existing animation
    // This allows changing the first frame without losing the original identity
    this._originalStartFrame = null
    
    // Panel references
    this.spritesheetPanel = null
    this.frameListPanel = null
    this.animationPreview = null
    
    // Header controls
    this._headerControlsElement = null
    
    // Event unsubscribers
    this._unsubscribers = []
    
    // Text decoder for SQL results
    this._decoder = new TextDecoder()
    
    // Bind methods
    this._onTileAdd = this._onTileAdd.bind(this)
    this._onFramesChanged = this._onFramesChanged.bind(this)
    this._onFrameSelect = this._onFrameSelect.bind(this)
    this._onMarkerClick = this._onMarkerClick.bind(this)
  }
  
  connectedCallback() {
    this._buildDOM()
    this._mountHeaderControls()
    this._setupEventListeners()
    this._setupBusListeners()
    
    // Load spritesheet if set (this will also load animation markers)
    if (this.hasAttribute('data-spritesheet')) {
      const spritesheet = this.getAttribute('data-spritesheet')
      const startFrame = this.hasAttribute('data-start-frame') 
        ? parseInt(this.getAttribute('data-start-frame'), 10) 
        : null
      
      this._loadSpritesheet(spritesheet).then(() => {
        // If a specific start frame is requested, load that animation
        if (startFrame !== null) {
          this._loadAnimationByStartFrame(startFrame)
        }
      })
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
      case 'data-spritesheet':
        if (newValue) this._loadSpritesheet(newValue)
        break
      case 'data-start-frame':
        if (newValue && this.animation.spritesheet) {
          this._loadAnimationByStartFrame(parseInt(newValue, 10))
        }
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
    
    // Listen for animation marker clicks (to load existing animations)
    this._unsubscribers.push(
      bus.on('animation:marker:click', this._onMarkerClick)
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
  
  _onMarkerClick({ tileId }) {
    // Load the animation that starts with this tileId
    this._loadAnimationByStartFrame(tileId)
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
    
    // Load animation markers for this spritesheet
    await this._loadAnimationMarkers(source)
    
    // Reset animation state for new spritesheet
    this._originalStartFrame = null
    this.animation.frames = []
    this.frameListPanel.setFrames([])
    this._updatePreview()
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
  
  /**
   * Load all animation markers for the current spritesheet
   * @param {string} sourceFile - The spritesheet file path
   */
  async _loadAnimationMarkers(sourceFile) {
    try {
      const escapedPath = sourceFile.replace(/'/g, "''")
      const query = `SELECT start_frame FROM animation_storage WHERE source_file = '${escapedPath}'`
      
      const result = await window.pluginManager.call('sql', 'query', query)
      const csv = this._decoder.decode(result.output)
      const lines = parseCSVLines(csv.trim())
      
      // Skip header row, collect start_frame values
      const markers = []
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].length > 0) {
          markers.push(parseInt(lines[i][0], 10))
        }
      }
      
      this.spritesheetPanel.setAnimationMarkers(markers)
    } catch (err) {
      console.error('Failed to load animation markers:', err)
      this.spritesheetPanel.setAnimationMarkers([])
    }
  }
  
  /**
   * Load an animation by its starting frame
   * @param {number} startFrame - The tileId of the first frame
   */
  async _loadAnimationByStartFrame(startFrame) {
    if (!this.animation.spritesheet) {
      bus.emit('toast:show', { message: 'No spritesheet loaded', type: 'error' })
      return
    }
    
    try {
      const escapedPath = this.animation.spritesheet.replace(/'/g, "''")
      const query = `SELECT tile_width, tile_height, data FROM animation_storage WHERE source_file = '${escapedPath}' AND start_frame = ${startFrame}`
      
      const result = await window.pluginManager.call('sql', 'query', query)
      const csv = this._decoder.decode(result.output)
      const lines = parseCSVLines(csv.trim())
      
      if (lines.length < 2 || lines[1].length < 3) {
        bus.emit('toast:show', { message: 'Animation not found', type: 'error' })
        return
      }
      
      const tileWidth = parseInt(lines[1][0], 10)
      const tileHeight = parseInt(lines[1][1], 10)
      const data = JSON.parse(lines[1][2])
      
      // Reconstruct full animation object
      this.animation = {
        spritesheet: this.animation.spritesheet,
        tileWidth,
        tileHeight,
        frames: data.frames || [],
        loop: data.loop !== undefined ? data.loop : true
      }
      
      // Track original start frame for potential updates
      this._originalStartFrame = startFrame
      
      this._applyAnimationData()
      bus.emit('toast:show', { message: `Loaded animation (frame ${startFrame})`, type: 'success' })
    } catch (err) {
      console.error('Failed to load animation:', err)
      bus.emit('toast:show', { message: 'Failed to load animation', type: 'error' })
    }
  }
  
  async saveData() {
    try {
      // Update animation with current frames
      this.animation.frames = this.frameListPanel.getFrames()
      
      // Validate animation
      const validation = validateAnimation(this.animation)
      if (!validation.valid) {
        bus.emit('toast:show', { message: validation.errors[0], type: 'error' })
        return
      }
      
      const sourceFile = this.animation.spritesheet
      const startFrame = getStartFrame(this.animation)
      const escapedPath = sourceFile.replace(/'/g, "''")
      
      // Prepare data JSON (only frames and loop, since other fields are columns)
      const dataJson = JSON.stringify({
        frames: this.animation.frames,
        loop: this.animation.loop
      })
      const escapedData = dataJson.replace(/'/g, "''")
      
      // If we're editing an existing animation and the start frame changed,
      // delete the old record first
      if (this._originalStartFrame !== null && this._originalStartFrame !== startFrame) {
        const deleteQuery = `DELETE FROM animation_storage WHERE source_file = '${escapedPath}' AND start_frame = ${this._originalStartFrame}`
        await window.pluginManager.call('sql', 'exec', deleteQuery)
        
        // Remove old marker
        this.spritesheetPanel.removeAnimationMarker(this._originalStartFrame)
      }
      
      // Insert or replace the animation
      const insertQuery = `INSERT OR REPLACE INTO animation_storage (source_file, start_frame, tile_width, tile_height, data) VALUES ('${escapedPath}', ${startFrame}, ${this.animation.tileWidth}, ${this.animation.tileHeight}, '${escapedData}')`
      
      await window.pluginManager.call('sql', 'exec', insertQuery)
      
      // Update tracked start frame
      this._originalStartFrame = startFrame
      
      // Add marker for the new start frame
      this.spritesheetPanel.addAnimationMarker(startFrame)
      
      bus.emit('toast:show', { message: `Animation saved (frame ${startFrame})`, type: 'success' })
    } catch (err) {
      console.error('Failed to save animation:', err)
      bus.emit('toast:show', { message: 'Failed to save animation', type: 'error' })
    }
  }
  
  /**
   * Clear the current animation and start fresh
   */
  clearAnimation() {
    this._originalStartFrame = null
    this.animation.frames = []
    this.frameListPanel.setFrames([])
    this._updatePreview()
  }
  
  _applyAnimationData() {
    // Update header controls
    const widthInput = this._queryHeaderControl('[data-element="tile-width"]')
    const heightInput = this._queryHeaderControl('[data-element="tile-height"]')
    const loopCheckbox = this.querySelector('[data-action="loop"]')
    
    if (widthInput) widthInput.value = this.animation.tileWidth
    if (heightInput) heightInput.value = this.animation.tileHeight
    if (loopCheckbox) loopCheckbox.checked = this.animation.loop
    
    // Update tile size in panels
    this.spritesheetPanel.setTileSize(
      this.animation.tileWidth,
      this.animation.tileHeight
    )
    
    // Update other panels with new tile size
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
    
    // Set frames
    this.frameListPanel.setFrames(this.animation.frames)
    this._updatePreview()
  }
  
  // --- View Mode ---
  
  getViewMode() {
    return 'animation-editor'
  }
}

customElements.define('view-animation-editor', ViewAnimationEditor)
