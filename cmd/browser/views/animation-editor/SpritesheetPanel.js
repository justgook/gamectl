import { bus } from '../../systems/event-bus.js'
import { decode as decodeQOI } from '../../util/qoi/decode.js'

/**
 * Spritesheet Panel
 * 
 * Displays a spritesheet as a grid of tiles for selection.
 * Supports:
 * - Pan/zoom
 * - Single and multi-select (shift+click)
 * - Double-click to add tiles to animation
 * - Drag tiles to frame list
 * 
 * Events emitted:
 * - animation:tile:select - { tileIds: number[] }
 * - animation:tile:add - { tileIds: number[] }
 */
export class SpritesheetPanel {
  constructor(container) {
    this.container = container
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.ctx.imageSmoothingEnabled = false
    
    // Image state
    this.image = null
    this.tileWidth = 16
    this.tileHeight = 16
    this.cols = 0
    this.rows = 0
    
    // Viewport state
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
    this.isDragging = false
    this.dragStartX = 0
    this.dragStartY = 0
    this.spacePressed = false
    
    // Selection state
    this.selectedTiles = new Set()
    this.hoveredTile = -1
    
    // Bind methods
    this._onWheel = this._onWheel.bind(this)
    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onMouseLeave = this._onMouseLeave.bind(this)
    this._onDblClick = this._onDblClick.bind(this)
    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp = this._onKeyUp.bind(this)
    this._onDragStart = this._onDragStart.bind(this)
    
    this._setup()
  }
  
  _setup() {
    // Style canvas
    this.canvas.style.display = 'block'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.cursor = 'crosshair'
    this.canvas.setAttribute('draggable', 'true')
    this.container.appendChild(this.canvas)
    
    // Add event listeners
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false })
    this.canvas.addEventListener('mousedown', this._onMouseDown)
    this.canvas.addEventListener('mousemove', this._onMouseMove)
    this.canvas.addEventListener('mouseup', this._onMouseUp)
    this.canvas.addEventListener('mouseleave', this._onMouseLeave)
    this.canvas.addEventListener('dblclick', this._onDblClick)
    this.canvas.addEventListener('dragstart', this._onDragStart)
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    
    // Observe size changes
    this._resizeObserver = new ResizeObserver(() => this._onResize())
    this._resizeObserver.observe(this.container)
    
    // Initial size
    this._onResize()
  }
  
  dispose() {
    this.canvas.removeEventListener('wheel', this._onWheel)
    this.canvas.removeEventListener('mousedown', this._onMouseDown)
    this.canvas.removeEventListener('mousemove', this._onMouseMove)
    this.canvas.removeEventListener('mouseup', this._onMouseUp)
    this.canvas.removeEventListener('mouseleave', this._onMouseLeave)
    this.canvas.removeEventListener('dblclick', this._onDblClick)
    this.canvas.removeEventListener('dragstart', this._onDragStart)
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    this._resizeObserver.disconnect()
  }
  
  /**
   * Load spritesheet from file path or URL
   * @param {string} source - File path, URL, or data URI
   */
  async loadSpritesheet(source) {
    if (!source) {
      this.image = null
      this._updateGrid()
      this.draw()
      return
    }
    
    try {
      // Check if source is a file path (not URL or data URI)
      if (!source.startsWith('data:') && !source.startsWith('http') && !source.startsWith('blob:')) {
        this.image = await this._loadImageFromFile(source)
      } else {
        this.image = await this._loadImageFromUrl(source)
      }
      
      this._updateGrid()
      this.fitToContent()
      this.draw()
      
      bus.emit('animation:spritesheet:loaded', { 
        source,
        width: this.image.width,
        height: this.image.height,
        cols: this.cols,
        rows: this.rows
      })
    } catch (err) {
      console.error('Failed to load spritesheet:', err)
      this.image = null
      this._updateGrid()
      this.draw()
    }
  }
  
  /**
   * Load image from file system using FS plugin
   */
  async _loadImageFromFile(path) {
    const result = await window.pluginManager.call('fs', 'read', path)
    if (result.returnCode !== 0) {
      throw new Error(`Failed to read file: ${new TextDecoder().decode(result.output)}`)
    }
    
    const data = result.output
    let imageData
    
    // Check for QOI magic bytes
    if (data.length >= 4 && data[0] === 0x71 && data[1] === 0x6f && data[2] === 0x69 && data[3] === 0x66) {
      const decoded = decodeQOI(data.buffer)
      imageData = new ImageData(
        new Uint8ClampedArray(decoded.data.buffer),
        decoded.width,
        decoded.height
      )
      return createImageBitmap(imageData)
    } else {
      // Assume PNG or other standard format
      const blob = new Blob([data], { type: 'image/png' })
      return createImageBitmap(blob)
    }
  }
  
  /**
   * Load image from URL or data URI
   */
  async _loadImageFromUrl(src) {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = src
    })
    return img
  }
  
  /**
   * Set tile dimensions
   */
  setTileSize(width, height) {
    this.tileWidth = width
    this.tileHeight = height
    this._updateGrid()
    this.draw()
  }
  
  _updateGrid() {
    if (this.image) {
      this.cols = Math.floor(this.image.width / this.tileWidth)
      this.rows = Math.floor(this.image.height / this.tileHeight)
    } else {
      this.cols = 0
      this.rows = 0
    }
    // Clear selection when grid changes
    this.selectedTiles.clear()
  }
  
  _onResize() {
    const rect = this.container.getBoundingClientRect()
    const width = Math.round(rect.width)
    const height = Math.round(rect.height)
    
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      this.draw()
    }
  }
  
  // --- Drawing ---
  
  draw() {
    const { width, height } = this.canvas
    const ctx = this.ctx
    
    ctx.save()
    ctx.clearRect(0, 0, width, height)
    
    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, height)
    
    if (!this.image) {
      // Draw placeholder
      ctx.fillStyle = '#4a4a6a'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No spritesheet loaded', width / 2, height / 2)
      ctx.restore()
      return
    }
    
    // Apply transform
    ctx.translate(this.offsetX, this.offsetY)
    ctx.scale(this.scale, this.scale)
    
    // Draw checkerboard background for transparency
    this._drawCheckerboard(ctx)
    
    // Draw image
    ctx.drawImage(this.image, 0, 0)
    
    // Draw grid
    this._drawGrid(ctx)
    
    // Draw hover highlight
    if (this.hoveredTile >= 0) {
      this._drawTileHighlight(ctx, this.hoveredTile, 'rgba(255, 255, 255, 0.3)')
    }
    
    // Draw selection
    for (const tileId of this.selectedTiles) {
      this._drawTileHighlight(ctx, tileId, 'rgba(0, 200, 255, 0.5)')
    }
    
    ctx.restore()
  }
  
  _drawCheckerboard(ctx) {
    const size = 8
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(0, 0, this.image.width, this.image.height)
    
    ctx.fillStyle = '#3a3a4a'
    for (let y = 0; y < this.image.height; y += size) {
      for (let x = 0; x < this.image.width; x += size) {
        if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
          ctx.fillRect(x, y, size, size)
        }
      }
    }
  }
  
  _drawGrid(ctx) {
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.5)'
    ctx.lineWidth = 1 / this.scale
    
    // Vertical lines
    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath()
      ctx.moveTo(x * this.tileWidth, 0)
      ctx.lineTo(x * this.tileWidth, this.rows * this.tileHeight)
      ctx.stroke()
    }
    
    // Horizontal lines
    for (let y = 0; y <= this.rows; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * this.tileHeight)
      ctx.lineTo(this.cols * this.tileWidth, y * this.tileHeight)
      ctx.stroke()
    }
  }
  
  _drawTileHighlight(ctx, tileId, color) {
    const col = tileId % this.cols
    const row = Math.floor(tileId / this.cols)
    const x = col * this.tileWidth
    const y = row * this.tileHeight
    
    ctx.fillStyle = color
    ctx.fillRect(x, y, this.tileWidth, this.tileHeight)
    
    // Border
    ctx.strokeStyle = color.replace('0.3', '0.8').replace('0.5', '1')
    ctx.lineWidth = 2 / this.scale
    ctx.strokeRect(x, y, this.tileWidth, this.tileHeight)
  }
  
  // --- Viewport ---
  
  fitToContent() {
    if (!this.image) return
    
    const padding = 20
    const availWidth = this.canvas.width - padding * 2
    const availHeight = this.canvas.height - padding * 2
    
    const scaleX = availWidth / this.image.width
    const scaleY = availHeight / this.image.height
    this.scale = Math.min(scaleX, scaleY, 4) // Max 4x zoom
    this.scale = Math.max(this.scale, 0.1)   // Min 0.1x zoom
    
    // Center
    this.offsetX = (this.canvas.width - this.image.width * this.scale) / 2
    this.offsetY = (this.canvas.height - this.image.height * this.scale) / 2
    
    this.draw()
  }
  
  zoom(x, y, factor) {
    const oldScale = this.scale
    this.scale = Math.max(0.1, Math.min(10, this.scale * factor))
    
    const scaleChange = this.scale - oldScale
    const relX = (x - this.offsetX) / oldScale
    const relY = (y - this.offsetY) / oldScale
    
    this.offsetX -= relX * scaleChange
    this.offsetY -= relY * scaleChange
    
    this.draw()
  }
  
  // --- Input Handlers ---
  
  _getTileAtPosition(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    const canvasX = clientX - rect.left
    const canvasY = clientY - rect.top
    
    // Transform to world coordinates
    const worldX = (canvasX - this.offsetX) / this.scale
    const worldY = (canvasY - this.offsetY) / this.scale
    
    // Check bounds
    if (worldX < 0 || worldY < 0 || 
        worldX >= this.cols * this.tileWidth || 
        worldY >= this.rows * this.tileHeight) {
      return -1
    }
    
    const col = Math.floor(worldX / this.tileWidth)
    const row = Math.floor(worldY / this.tileHeight)
    return row * this.cols + col
  }
  
  _onWheel(e) {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      this.zoom(x, y, factor)
    } else {
      this.offsetX -= e.deltaX
      this.offsetY -= e.deltaY
      this.draw()
    }
  }
  
  _onMouseDown(e) {
    if (this.spacePressed) {
      // Pan mode
      this.isDragging = true
      this.dragStartX = e.clientX - this.offsetX
      this.dragStartY = e.clientY - this.offsetY
      this.canvas.style.cursor = 'grabbing'
    } else {
      // Selection mode
      const tileId = this._getTileAtPosition(e.clientX, e.clientY)
      if (tileId >= 0) {
        if (e.shiftKey) {
          // Toggle selection
          if (this.selectedTiles.has(tileId)) {
            this.selectedTiles.delete(tileId)
          } else {
            this.selectedTiles.add(tileId)
          }
        } else {
          // Single select
          this.selectedTiles.clear()
          this.selectedTiles.add(tileId)
        }
        
        bus.emit('animation:tile:select', { tileIds: [...this.selectedTiles] })
        this.draw()
      }
    }
  }
  
  _onMouseMove(e) {
    if (this.isDragging && this.spacePressed) {
      this.offsetX = e.clientX - this.dragStartX
      this.offsetY = e.clientY - this.dragStartY
      this.draw()
    } else {
      // Update hover
      const tileId = this._getTileAtPosition(e.clientX, e.clientY)
      if (tileId !== this.hoveredTile) {
        this.hoveredTile = tileId
        this.draw()
      }
    }
  }
  
  _onMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false
      this.canvas.style.cursor = this.spacePressed ? 'grab' : 'crosshair'
    }
  }
  
  _onMouseLeave() {
    this.isDragging = false
    this.hoveredTile = -1
    this.canvas.style.cursor = 'crosshair'
    this.draw()
  }
  
  _onDblClick(e) {
    const tileId = this._getTileAtPosition(e.clientX, e.clientY)
    if (tileId >= 0) {
      // Add selected tiles (or just the double-clicked tile if none selected)
      const tilesToAdd = this.selectedTiles.size > 0 
        ? [...this.selectedTiles] 
        : [tileId]
      
      bus.emit('animation:tile:add', { tileIds: tilesToAdd })
    }
  }
  
  _onDragStart(e) {
    if (this.selectedTiles.size === 0) {
      e.preventDefault()
      return
    }
    
    // Set drag data
    const tileIds = [...this.selectedTiles]
    e.dataTransfer.setData('application/json', JSON.stringify({ tileIds }))
    e.dataTransfer.effectAllowed = 'copy'
    
    // Create drag image (thumbnail of first tile)
    if (this.image && tileIds.length > 0) {
      const canvas = document.createElement('canvas')
      canvas.width = this.tileWidth * 2
      canvas.height = this.tileHeight * 2
      const ctx = canvas.getContext('2d')
      
      const tileId = tileIds[0]
      const srcX = (tileId % this.cols) * this.tileWidth
      const srcY = Math.floor(tileId / this.cols) * this.tileHeight
      
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(
        this.image,
        srcX, srcY, this.tileWidth, this.tileHeight,
        0, 0, canvas.width, canvas.height
      )
      
      e.dataTransfer.setDragImage(canvas, canvas.width / 2, canvas.height / 2)
    }
  }
  
  _onKeyDown(e) {
    if (e.code === 'Space' && !this.spacePressed) {
      this.spacePressed = true
      this.canvas.style.cursor = 'grab'
      e.preventDefault()
    }
  }
  
  _onKeyUp(e) {
    if (e.code === 'Space') {
      this.spacePressed = false
      this.isDragging = false
      this.canvas.style.cursor = 'crosshair'
    }
  }
  
  // --- Public API ---
  
  getSelectedTiles() {
    return [...this.selectedTiles]
  }
  
  clearSelection() {
    this.selectedTiles.clear()
    this.draw()
  }
  
  getImage() {
    return this.image
  }
  
  getTileRect(tileId) {
    const col = tileId % this.cols
    const row = Math.floor(tileId / this.cols)
    return {
      x: col * this.tileWidth,
      y: row * this.tileHeight,
      width: this.tileWidth,
      height: this.tileHeight
    }
  }
}
