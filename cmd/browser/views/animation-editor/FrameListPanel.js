import { bus } from '../../systems/event-bus.js'

/**
 * Frame List Panel
 * 
 * Displays animation frames in a vertical list.
 * Supports:
 * - Drag and drop reordering
 * - Drop from spritesheet panel
 * - Multi-select (shift+click)
 * - Inline duration editing
 * - Delete selected frames
 * 
 * Events emitted:
 * - animation:frame:select - { indices: number[] }
 * - animation:frames:changed - { frames: Array }
 */
export class FrameListPanel {
  constructor(container, options = {}) {
    this.container = container
    this.spritesheet = null  // Image reference for thumbnails
    this.tileWidth = 16
    this.tileHeight = 16
    this.cols = 0
    
    this.frames = []  // Array of { tileId, duration }
    this.selectedIndices = new Set()
    this.defaultDuration = options.defaultDuration || 100
    
    // Drag state
    this._dragSourceIndex = -1
    this._dragOverIndex = -1
    
    this._setup()
  }
  
  _setup() {
    this.container.classList.add('frame-list-panel')
    
    // Create scroll container
    this.listEl = document.createElement('div')
    this.listEl.className = 'frame-list'
    this.container.appendChild(this.listEl)
    
    // Drop zone events
    this.listEl.addEventListener('dragover', this._onDragOver.bind(this))
    this.listEl.addEventListener('dragleave', this._onDragLeave.bind(this))
    this.listEl.addEventListener('drop', this._onDrop.bind(this))
  }
  
  dispose() {
    // Cleanup if needed
  }
  
  /**
   * Set spritesheet reference for rendering thumbnails
   */
  setSpritesheet(image, tileWidth, tileHeight) {
    this.spritesheet = image
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    if (image) {
      this.cols = Math.floor(image.width / tileWidth)
    }
    this._renderAll()
  }
  
  /**
   * Set frames data
   */
  setFrames(frames) {
    this.frames = frames.map(f => ({ ...f }))
    this.selectedIndices.clear()
    this._renderAll()
  }
  
  /**
   * Get current frames
   */
  getFrames() {
    return this.frames.map(f => ({ ...f }))
  }
  
  /**
   * Add frames at end or at specific index
   */
  addFrames(tileIds, duration = this.defaultDuration, insertIndex = -1) {
    const newFrames = tileIds.map(tileId => ({ tileId, duration }))
    
    if (insertIndex < 0 || insertIndex >= this.frames.length) {
      this.frames.push(...newFrames)
    } else {
      this.frames.splice(insertIndex, 0, ...newFrames)
    }
    
    this._renderAll()
    this._emitFramesChanged()
  }
  
  /**
   * Remove frames at indices
   */
  removeFrames(indices) {
    const indexSet = new Set(indices)
    this.frames = this.frames.filter((_, i) => !indexSet.has(i))
    this.selectedIndices.clear()
    this._renderAll()
    this._emitFramesChanged()
  }
  
  /**
   * Remove selected frames
   */
  removeSelected() {
    if (this.selectedIndices.size === 0) return
    this.removeFrames([...this.selectedIndices])
  }
  
  /**
   * Update duration for frames at indices
   */
  updateDuration(indices, duration) {
    for (const i of indices) {
      if (this.frames[i]) {
        this.frames[i].duration = duration
      }
    }
    this._renderAll()
    this._emitFramesChanged()
  }
  
  /**
   * Update duration for selected frames
   */
  updateSelectedDuration(duration) {
    if (this.selectedIndices.size === 0) return
    this.updateDuration([...this.selectedIndices], duration)
  }
  
  /**
   * Get selected frame indices
   */
  getSelectedIndices() {
    return [...this.selectedIndices]
  }
  
  /**
   * Select all frames
   */
  selectAll() {
    this.selectedIndices.clear()
    for (let i = 0; i < this.frames.length; i++) {
      this.selectedIndices.add(i)
    }
    this._updateSelectionVisuals()
    this._emitSelectionChanged()
  }
  
  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedIndices.clear()
    this._updateSelectionVisuals()
    this._emitSelectionChanged()
  }
  
  // --- Rendering ---
  
  _renderAll() {
    this.listEl.innerHTML = ''
    
    if (this.frames.length === 0) {
      const placeholder = document.createElement('div')
      placeholder.className = 'frame-list-placeholder'
      placeholder.textContent = 'Drag tiles here or double-click to add frames'
      this.listEl.appendChild(placeholder)
      return
    }
    
    this.frames.forEach((frame, index) => {
      const el = this._createFrameElement(frame, index)
      this.listEl.appendChild(el)
    })
  }
  
  _createFrameElement(frame, index) {
    const el = document.createElement('div')
    el.className = 'frame-item'
    el.dataset.index = index
    el.draggable = true
    
    if (this.selectedIndices.has(index)) {
      el.classList.add('selected')
    }
    
    // Thumbnail canvas
    const thumbnail = document.createElement('canvas')
    thumbnail.className = 'frame-thumbnail'
    thumbnail.width = 32
    thumbnail.height = 32
    this._drawThumbnail(thumbnail, frame.tileId)
    el.appendChild(thumbnail)
    
    // Info container
    const info = document.createElement('div')
    info.className = 'frame-info'
    
    // Tile ID
    const tileLabel = document.createElement('span')
    tileLabel.className = 'frame-tile-id'
    tileLabel.textContent = `Tile ${frame.tileId}`
    info.appendChild(tileLabel)
    
    // Duration input
    const durationContainer = document.createElement('div')
    durationContainer.className = 'frame-duration-container'
    
    const durationInput = document.createElement('input')
    durationInput.type = 'number'
    durationInput.className = 'frame-duration'
    durationInput.value = frame.duration
    durationInput.min = 1
    durationInput.addEventListener('change', (e) => {
      const newDuration = parseInt(e.target.value, 10) || this.defaultDuration
      this.frames[index].duration = newDuration
      this._emitFramesChanged()
    })
    durationInput.addEventListener('click', (e) => e.stopPropagation())
    
    const msLabel = document.createElement('span')
    msLabel.className = 'frame-duration-unit'
    msLabel.textContent = 'ms'
    
    durationContainer.appendChild(durationInput)
    durationContainer.appendChild(msLabel)
    info.appendChild(durationContainer)
    
    el.appendChild(info)
    
    // Frame index indicator
    const indexLabel = document.createElement('span')
    indexLabel.className = 'frame-index'
    indexLabel.textContent = `#${index}`
    el.appendChild(indexLabel)
    
    // Event listeners
    el.addEventListener('click', (e) => this._onFrameClick(e, index))
    el.addEventListener('dragstart', (e) => this._onFrameDragStart(e, index))
    el.addEventListener('dragend', (e) => this._onFrameDragEnd(e))
    el.addEventListener('dragover', (e) => this._onFrameDragOver(e, index))
    
    return el
  }
  
  _drawThumbnail(canvas, tileId) {
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    
    // Background
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(0, 0, 32, 32)
    
    if (!this.spritesheet || this.cols === 0) {
      // Draw placeholder
      ctx.fillStyle = '#4a4a6a'
      ctx.fillRect(4, 4, 24, 24)
      return
    }
    
    const srcX = (tileId % this.cols) * this.tileWidth
    const srcY = Math.floor(tileId / this.cols) * this.tileHeight
    
    // Calculate scaling to fit in 32x32
    const scale = Math.min(32 / this.tileWidth, 32 / this.tileHeight)
    const destW = this.tileWidth * scale
    const destH = this.tileHeight * scale
    const destX = (32 - destW) / 2
    const destY = (32 - destH) / 2
    
    ctx.drawImage(
      this.spritesheet,
      srcX, srcY, this.tileWidth, this.tileHeight,
      destX, destY, destW, destH
    )
  }
  
  _updateSelectionVisuals() {
    const items = this.listEl.querySelectorAll('.frame-item')
    items.forEach((el, index) => {
      el.classList.toggle('selected', this.selectedIndices.has(index))
    })
  }
  
  // --- Selection ---
  
  _onFrameClick(e, index) {
    if (e.shiftKey) {
      // Range select
      if (this.selectedIndices.size > 0) {
        const lastSelected = Math.max(...this.selectedIndices)
        const start = Math.min(lastSelected, index)
        const end = Math.max(lastSelected, index)
        for (let i = start; i <= end; i++) {
          this.selectedIndices.add(i)
        }
      } else {
        this.selectedIndices.add(index)
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle
      if (this.selectedIndices.has(index)) {
        this.selectedIndices.delete(index)
      } else {
        this.selectedIndices.add(index)
      }
    } else {
      // Single select
      this.selectedIndices.clear()
      this.selectedIndices.add(index)
    }
    
    this._updateSelectionVisuals()
    this._emitSelectionChanged()
  }
  
  // --- Drag & Drop (Reorder) ---
  
  _onFrameDragStart(e, index) {
    this._dragSourceIndex = index
    e.dataTransfer.setData('text/plain', index.toString())
    e.dataTransfer.effectAllowed = 'move'
    
    // Add dragging class after a small delay (for visual feedback)
    setTimeout(() => {
      e.target.classList.add('dragging')
    }, 0)
  }
  
  _onFrameDragEnd(e) {
    this._dragSourceIndex = -1
    this._dragOverIndex = -1
    e.target.classList.remove('dragging')
    
    // Remove all drag-over classes
    this.listEl.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom')
    })
  }
  
  _onFrameDragOver(e, index) {
    e.preventDefault()
    
    if (this._dragSourceIndex < 0) return // External drag
    
    // Determine drop position (above or below)
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const isAbove = e.clientY < midY
    
    // Update visual
    this.listEl.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom')
    })
    
    e.currentTarget.classList.add('drag-over')
    e.currentTarget.classList.add(isAbove ? 'drag-over-top' : 'drag-over-bottom')
    
    this._dragOverIndex = isAbove ? index : index + 1
  }
  
  // --- Drag & Drop (From Spritesheet) ---
  
  _onDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    this.listEl.classList.add('drag-target')
  }
  
  _onDragLeave(e) {
    // Only remove class if leaving the list entirely
    if (!this.listEl.contains(e.relatedTarget)) {
      this.listEl.classList.remove('drag-target')
    }
  }
  
  _onDrop(e) {
    e.preventDefault()
    this.listEl.classList.remove('drag-target')
    
    // Remove all drag-over classes
    this.listEl.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom')
    })
    
    // Check if it's an internal reorder
    if (this._dragSourceIndex >= 0 && this._dragOverIndex >= 0) {
      this._reorderFrame(this._dragSourceIndex, this._dragOverIndex)
      this._dragSourceIndex = -1
      this._dragOverIndex = -1
      return
    }
    
    // Check for external tile data
    try {
      const jsonData = e.dataTransfer.getData('application/json')
      if (jsonData) {
        const { tileIds } = JSON.parse(jsonData)
        if (Array.isArray(tileIds) && tileIds.length > 0) {
          this.addFrames(tileIds, this.defaultDuration)
        }
      }
    } catch (err) {
      console.warn('Invalid drop data:', err)
    }
  }
  
  _reorderFrame(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex === toIndex - 1) return
    
    const frame = this.frames[fromIndex]
    this.frames.splice(fromIndex, 1)
    
    // Adjust toIndex if we removed an item before it
    const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
    this.frames.splice(adjustedIndex, 0, frame)
    
    // Update selection
    this.selectedIndices.clear()
    this.selectedIndices.add(adjustedIndex)
    
    this._renderAll()
    this._emitFramesChanged()
  }
  
  // --- Events ---
  
  _emitFramesChanged() {
    bus.emit('animation:frames:changed', { frames: this.getFrames() })
  }
  
  _emitSelectionChanged() {
    bus.emit('animation:frame:select', { indices: [...this.selectedIndices] })
  }
}
