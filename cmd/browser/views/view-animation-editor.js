import { bus } from '../systems/event-bus.js'
import { decode as decodeQOI } from '../util/qoi/decode.js'
import { ViewFiles } from './view-files.js'
import { ViewCanvasBase } from './view-canvas-base.js'
import { parseCSVLines } from '../util/csv.js'

const FLIP_H = 1
const FLIP_V = 2
const FLIP_D = 4
const FLIP_LABELS = ['None', 'H', 'V', 'HV', 'D', 'DH', 'DV', 'DHV']

function createAnimation() {
  return {
    spritesheet: '',
    tileWidth: 16,
    tileHeight: 16,
    frames: [],
    loop: true
  }
}

function getStartFrame(animation) {
  if (!animation.frames || animation.frames.length === 0) return null
  return animation.frames[0].tileId
}

function validateAnimation(animation) {
  const errors = []

  if (!animation.spritesheet) errors.push('Animation must have a spritesheet')
  if (!animation.tileWidth || animation.tileWidth < 1) errors.push('Tile width must be at least 1')
  if (!animation.tileHeight || animation.tileHeight < 1) errors.push('Tile height must be at least 1')

  if (!Array.isArray(animation.frames)) {
    errors.push('Frames must be an array')
  } else if (animation.frames.length === 0) {
    errors.push('Animation must have at least one frame')
  } else {
    for (let i = 0; i < animation.frames.length; i++) {
      const frame = animation.frames[i]
      if (typeof frame.tileId !== 'number' || frame.tileId < 0) {
        errors.push(`Frame ${i}: invalid tileId`)
      }
      if (typeof frame.duration !== 'number' || frame.duration < 1) {
        errors.push(`Frame ${i}: duration must be at least 1ms`)
      }
      if (frame.flip !== undefined && (typeof frame.flip !== 'number' || frame.flip < 0 || frame.flip > 7)) {
        errors.push(`Frame ${i}: flip must be 0-7`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

function getTotalDuration(animation) {
  return animation.frames.reduce((sum, frame) => sum + frame.duration, 0)
}

function getFrameAtTime(animation, timeMs) {
  if (!animation || animation.frames.length === 0) return null

  const totalDuration = getTotalDuration(animation)
  if (totalDuration === 0) {
    return { frame: animation.frames[0], index: 0 }
  }

  const t = animation.loop ? timeMs % totalDuration : Math.min(timeMs, totalDuration)
  let elapsed = 0

  for (let i = 0; i < animation.frames.length; i++) {
    elapsed += animation.frames[i].duration
    if (t < elapsed) {
      return { frame: animation.frames[i], index: i }
    }
  }

  const last = animation.frames.length - 1
  return { frame: animation.frames[last], index: last }
}

function applyFlipTransform(ctx, flip) {
  const h = (flip & FLIP_H) !== 0
  const v = (flip & FLIP_V) !== 0
  const d = (flip & FLIP_D) !== 0

  if (d) {
    ctx.transform(0, 1, 1, 0, 0, 0)
    ctx.scale(h ? -1 : 1, v ? -1 : 1)
    return
  }

  ctx.scale(h ? -1 : 1, v ? -1 : 1)
}

class AnimationEditorCanvas extends ViewCanvasBase {
  constructor() {
    super()

    this.autoFitOnLoad = false
    this.image = null
    this.tileWidth = 16
    this.tileHeight = 16
    this.cols = 0
    this.rows = 0

    this.selectedTiles = new Set()
    this.hoveredTile = -1
    this.animationMarkers = new Set()

    this._onDblClick = this._onDblClick.bind(this)
    this._onDragStart = this._onDragStart.bind(this)
  }

  connectedCallback() {
    super.connectedCallback()
    this.style.width = '100%'
    this.style.height = '100%'
    this.style.position = 'relative'
    this.canvas.style.width = 'calc(100% - var(--aside-width))'
    this.canvas.style.height = '100%'
    this.canvas.style.cursor = 'crosshair'
  }

  setupUI() {
    this.canvas.setAttribute('draggable', 'true')
    this.canvas.style.width = 'calc(100% - var(--aside-width))'
    this.canvas.style.height = '100%'
    this.canvas.style.cursor = 'crosshair'
  }

  getViewMode() {
    return null
  }

  _onResized() {
    const width = Math.round(this.canvas.clientWidth)
    const height = Math.round(this.canvas.clientHeight)

    if (!this.canvas || width <= 0 || height <= 0) return
    if (this.canvas.width === width && this.canvas.height === height) return

    this.canvas.width = width
    this.canvas.height = height
    this.draw()
    this._tryAutoFit()
  }

  _addEventListeners() {
    super._addEventListeners()
    this.canvas.addEventListener('dblclick', this._onDblClick)
    this.canvas.addEventListener('dragstart', this._onDragStart)
  }

  _removeEventListeners() {
    super._removeEventListeners()
    this.canvas.removeEventListener('dblclick', this._onDblClick)
    this.canvas.removeEventListener('dragstart', this._onDragStart)
  }

  async loadSpritesheet(source) {
    if (!source) {
      this.image = null
      this.data = null
      this._updateGrid()
      this.draw()
      return
    }

    try {
      if (!source.startsWith('data:') && !source.startsWith('http') && !source.startsWith('blob:')) {
        this.image = await this._loadImageFromFile(source)
      } else {
        this.image = await this._loadImageFromUrl(source)
      }

      this.data = this.image
      this._updateGrid()
      this.contentBounds = this.calculateContentBounds(this.data)
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
      this.data = null
      this._updateGrid()
      this.draw()
    }
  }

  async _loadImageFromFile(path) {
    const result = await window.pluginManager.call('fs', 'read', path)
    if (result.returnCode !== 0) {
      throw new Error(`Failed to read file: ${new TextDecoder().decode(result.output)}`)
    }

    const data = result.output
    if (data.length >= 4 && data[0] === 0x71 && data[1] === 0x6f && data[2] === 0x69 && data[3] === 0x66) {
      const decoded = decodeQOI(data.buffer)
      const imageData = new ImageData(new Uint8ClampedArray(decoded.data.buffer), decoded.width, decoded.height)
      return createImageBitmap(imageData)
    }

    const blob = new Blob([data], { type: 'image/png' })
    return createImageBitmap(blob)
  }

  async _loadImageFromUrl(src) {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = src
    })
    return img
  }

  setTileSize(width, height) {
    this.tileWidth = width
    this.tileHeight = height
    this._updateGrid()
    this.contentBounds = this.calculateContentBounds(this.data)
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

    this.selectedTiles.clear()
    this.hoveredTile = -1
  }

  calculateContentBounds(data) {
    if (!data) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    }

    return {
      minX: 0,
      minY: 0,
      maxX: data.width,
      maxY: data.height,
    }
  }

  draw() {
    if (!this.canvas) return

    const { width, height } = this.canvas
    this.ctx.save()
    this.ctx.clearRect(0, 0, width, height)
    this.ctx.fillStyle = '#1a1a2e'
    this.ctx.fillRect(0, 0, width, height)

    this.ctx.translate(this.offsetX, this.offsetY)
    this.ctx.scale(this.scale, this.scale)
    this.drawContent(this.ctx, this.data)
    this.ctx.restore()
  }

  drawContent(ctx) {
    if (!this.image) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#4a4a6a'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No spritesheet loaded', this.canvas.width / 2, this.canvas.height / 2)
      ctx.restore()
      return
    }

    this._drawCheckerboard(ctx)
    ctx.drawImage(this.image, 0, 0)
    this._drawGrid(ctx)

    if (this.hoveredTile >= 0) {
      this._drawTileHighlight(ctx, this.hoveredTile, 'rgba(255, 255, 255, 0.3)')
    }

    for (const tileId of this.selectedTiles) {
      this._drawTileHighlight(ctx, tileId, 'rgba(0, 200, 255, 0.5)')
    }

    for (const tileId of this.animationMarkers) {
      this._drawAnimationMarker(ctx, tileId)
    }
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

    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath()
      ctx.moveTo(x * this.tileWidth, 0)
      ctx.lineTo(x * this.tileWidth, this.rows * this.tileHeight)
      ctx.stroke()
    }
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
    ctx.strokeStyle = color.replace('0.3', '0.8').replace('0.5', '1')
    ctx.lineWidth = 2 / this.scale
    ctx.strokeRect(x, y, this.tileWidth, this.tileHeight)
  }

  _drawAnimationMarker(ctx, tileId) {
    const col = tileId % this.cols
    const row = Math.floor(tileId / this.cols)
    const x = col * this.tileWidth
    const y = row * this.tileHeight

    const dotRadius = Math.max(3, Math.min(this.tileWidth, this.tileHeight) / 6)
    const dotX = x + this.tileWidth - dotRadius - 2
    const dotY = y + dotRadius + 2

    ctx.beginPath()
    ctx.arc(dotX, dotY, dotRadius + 1, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2)
    ctx.fillStyle = '#00e5cc'
    ctx.fill()
  }

  _isClickOnMarkerDot(worldX, worldY, tileId) {
    const col = tileId % this.cols
    const row = Math.floor(tileId / this.cols)
    const tileX = col * this.tileWidth
    const tileY = row * this.tileHeight

    const dotRadius = Math.max(3, Math.min(this.tileWidth, this.tileHeight) / 6)
    const dotX = tileX + this.tileWidth - dotRadius - 2
    const dotY = tileY + dotRadius + 2
    const hitRadius = dotRadius + 2

    const dx = worldX - dotX
    const dy = worldY - dotY
    return (dx * dx + dy * dy) <= (hitRadius * hitRadius)
  }

  fitToContent() {
    if (!this.image) return false

    const padding = 20
    const availWidth = this.canvas.width - padding * 2
    const availHeight = this.canvas.height - padding * 2

    const scaleX = availWidth / this.image.width
    const scaleY = availHeight / this.image.height
    this.scale = Math.min(scaleX, scaleY, 4)
    this.scale = Math.max(this.scale, 0.1)

    this.offsetX = (this.canvas.width - this.image.width * this.scale) / 2
    this.offsetY = (this.canvas.height - this.image.height * this.scale) / 2
    this.draw()
    return true
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

  _getWorldPosition(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    }
  }

  _getTileAtWorldPosition(worldX, worldY) {
    if (worldX < 0 || worldY < 0 || worldX >= this.cols * this.tileWidth || worldY >= this.rows * this.tileHeight) {
      return -1
    }

    const col = Math.floor(worldX / this.tileWidth)
    const row = Math.floor(worldY / this.tileHeight)
    return row * this.cols + col
  }

  onCanvasMouseDown(e) {
    const { x, y } = this._getWorldPosition(e.clientX, e.clientY)
    const tileId = this._getTileAtWorldPosition(x, y)
    if (tileId < 0) return

    if (this.animationMarkers.has(tileId) && this._isClickOnMarkerDot(x, y, tileId)) {
      bus.emit('animation:marker:click', { tileId })
      return
    }

    if (e.shiftKey) {
      if (this.selectedTiles.has(tileId)) {
        this.selectedTiles.delete(tileId)
      } else {
        this.selectedTiles.add(tileId)
      }
    } else {
      this.selectedTiles.clear()
      this.selectedTiles.add(tileId)
    }

    bus.emit('animation:tile:select', { tileIds: [...this.selectedTiles] })
    this.draw()
  }

  onCanvasMouseMove(e) {
    const { x, y } = this._getWorldPosition(e.clientX, e.clientY)
    const tileId = this._getTileAtWorldPosition(x, y)
    if (tileId !== this.hoveredTile) {
      this.hoveredTile = tileId
      this.draw()
    }
  }

  _onMouseUp(e) {
    super._onMouseUp(e)
    if (!this.spacePressed) {
      this.canvas.style.cursor = 'crosshair'
    }
  }

  _onMouseLeave() {
    super._onMouseLeave()
    this.hoveredTile = -1
    this.canvas.style.cursor = 'crosshair'
    this.draw()
  }

  _onDblClick(e) {
    const { x, y } = this._getWorldPosition(e.clientX, e.clientY)
    const tileId = this._getTileAtWorldPosition(x, y)
    if (tileId < 0) return

    const tileIds = this.selectedTiles.size > 0 ? [...this.selectedTiles] : [tileId]
    bus.emit('animation:tile:add', { tileIds })
  }

  _onDragStart(e) {
    if (this.selectedTiles.size === 0) {
      e.preventDefault()
      return
    }

    const tileIds = [...this.selectedTiles]
    e.dataTransfer.setData('application/json', JSON.stringify({ tileIds }))
    e.dataTransfer.effectAllowed = 'copy'

    if (!this.image || tileIds.length === 0) return

    const preview = document.createElement('canvas')
    preview.width = this.tileWidth * 2
    preview.height = this.tileHeight * 2
    const ctx = preview.getContext('2d')

    const tileId = tileIds[0]
    const srcX = (tileId % this.cols) * this.tileWidth
    const srcY = Math.floor(tileId / this.cols) * this.tileHeight
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.image, srcX, srcY, this.tileWidth, this.tileHeight, 0, 0, preview.width, preview.height)
    e.dataTransfer.setDragImage(preview, preview.width / 2, preview.height / 2)
  }

  _onKeyUp(e) {
    super._onKeyUp(e)
    if (e.code !== 'Space') return
    this.canvas.style.cursor = 'crosshair'
  }

  clearSelection() {
    this.selectedTiles.clear()
    this.draw()
  }

  getImage() {
    return this.image
  }

  setAnimationMarkers(tileIds) {
    this.animationMarkers = new Set(tileIds)
    this.draw()
  }

  addAnimationMarker(tileId) {
    this.animationMarkers.add(tileId)
    this.draw()
  }

  removeAnimationMarker(tileId) {
    this.animationMarkers.delete(tileId)
    this.draw()
  }
}

class FrameListPanel {
  constructor(container, options = {}) {
    this.container = container
    this.spritesheet = null
    this.tileWidth = 16
    this.tileHeight = 16
    this.cols = 0

    this.frames = []
    this.selectedIndices = new Set()
    this.defaultDuration = options.defaultDuration || 100
    this.defaultFlip = 0
    this._durationInputRef = null

    this._dragSourceIndex = -1
    this._dragOverIndex = -1

    this._setup()
  }

  setDurationInputRef(inputElement) {
    this._durationInputRef = inputElement
  }

  getCurrentDuration() {
    if (this._durationInputRef) {
      return parseInt(this._durationInputRef.value, 10) || this.defaultDuration
    }
    return this.defaultDuration
  }

  _setup() {
    this.listEl = document.createElement('div')
    this.listEl.dataset.frameList = ''
    this.container.appendChild(this.listEl)

    this.listEl.addEventListener('dragover', this._onDragOver.bind(this))
    this.listEl.addEventListener('dragleave', this._onDragLeave.bind(this))
    this.listEl.addEventListener('drop', this._onDrop.bind(this))
  }

  dispose() { }

  setSpritesheet(image, tileWidth, tileHeight) {
    this.spritesheet = image
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    this.cols = image ? Math.floor(image.width / tileWidth) : 0
    this._renderAll()
  }

  setFrames(frames) {
    this.frames = frames.map(frame => ({ tileId: frame.tileId, duration: frame.duration, flip: frame.flip || 0 }))
    this.selectedIndices.clear()
    this._renderAll()
  }

  getFrames() {
    return this.frames.map(frame => ({ tileId: frame.tileId, duration: frame.duration, flip: frame.flip || 0 }))
  }

  addFrames(tileIds, duration = null, insertIndex = -1) {
    const actualDuration = duration !== null ? duration : this.getCurrentDuration()
    const newFrames = tileIds.map(tileId => ({ tileId, duration: actualDuration, flip: this.defaultFlip }))

    if (insertIndex < 0 || insertIndex >= this.frames.length) {
      this.frames.push(...newFrames)
    } else {
      this.frames.splice(insertIndex, 0, ...newFrames)
    }

    this._renderAll()
    this._emitFramesChanged()
  }

  removeFrames(indices) {
    const indexSet = new Set(indices)
    this.frames = this.frames.filter((_, index) => !indexSet.has(index))
    this.selectedIndices.clear()
    this._renderAll()
    this._emitFramesChanged()
  }

  removeSelected() {
    if (this.selectedIndices.size === 0) return
    this.removeFrames([...this.selectedIndices])
  }

  updateDuration(indices, duration) {
    for (const index of indices) {
      if (this.frames[index]) this.frames[index].duration = duration
    }
    this._renderAll()
    this._emitFramesChanged()
  }

  updateSelectedDuration(duration) {
    if (this.selectedIndices.size === 0) return
    this.updateDuration([...this.selectedIndices], duration)
  }

  toggleFlipBit(indices, bit) {
    for (const index of indices) {
      if (this.frames[index]) {
        this.frames[index].flip = ((this.frames[index].flip || 0) ^ bit) & 7
      }
    }
    this._renderAll()
    this._emitFramesChanged()
  }

  toggleSelectedFlipBit(bit) {
    if (this.selectedIndices.size === 0) return
    this.toggleFlipBit([...this.selectedIndices], bit)
  }

  selectAll() {
    this.selectedIndices.clear()
    for (let i = 0; i < this.frames.length; i++) {
      this.selectedIndices.add(i)
    }
    this._updateSelectionVisuals()
    this._emitSelectionChanged()
  }

  clearSelection() {
    this.selectedIndices.clear()
    this._updateSelectionVisuals()
    this._emitSelectionChanged()
  }

  _renderAll() {
    this.listEl.innerHTML = ''

    if (this.frames.length === 0) {
      const placeholder = document.createElement('p')
      placeholder.dataset.placeholder = ''
      placeholder.textContent = 'Drag tiles here or double-click to add frames'
      this.listEl.appendChild(placeholder)
      return
    }

    this.frames.forEach((frame, index) => {
      this.listEl.appendChild(this._createFrameElement(frame, index))
    })
  }

  _createFrameElement(frame, index) {
    const row = document.createElement('article')
    row.dataset.frameItem = String(index)
    row.draggable = true
    if (this.selectedIndices.has(index)) row.dataset.selected = 'true'

    const thumbnail = document.createElement('canvas')
    thumbnail.width = 32
    thumbnail.height = 32
    thumbnail.dataset.thumbnail = ''
    this._drawThumbnail(thumbnail, frame.tileId, frame.flip || 0)
    row.appendChild(thumbnail)

    const body = document.createElement('div')
    body.dataset.body = ''

    const label = document.createElement('strong')
    label.textContent = `Tile ${frame.tileId}`
    body.appendChild(label)

    const controls = document.createElement('div')
    controls.dataset.controls = ''

    const durationLabel = document.createElement('label')
    durationLabel.dataset.duration = ''
    const durationInput = document.createElement('input')
    durationInput.type = 'number'
    durationInput.value = String(frame.duration)
    durationInput.min = '1'
    durationInput.addEventListener('change', (e) => {
      this.frames[index].duration = parseInt(e.target.value, 10) || this.defaultDuration
      this._emitFramesChanged()
    })
    durationInput.addEventListener('click', (e) => e.stopPropagation())

    const ms = document.createElement('span')
    ms.textContent = 'ms'
    durationLabel.append(durationInput, ms)

    const flipBtn = document.createElement('button')
    flipBtn.type = 'button'
    flipBtn.dataset.action = 'cycle-flip'
    this._updateFlipButton(flipBtn, frame.flip || 0)
    flipBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const nextFlip = ((this.frames[index].flip || 0) + 1) % 8
      this.frames[index].flip = nextFlip
      this._updateFlipButton(flipBtn, nextFlip)
      this._drawThumbnail(thumbnail, frame.tileId, nextFlip)
      this._emitFramesChanged()
    })

    controls.append(durationLabel, flipBtn)
    body.appendChild(controls)
    row.appendChild(body)

    const order = document.createElement('small')
    order.textContent = `#${index}`
    row.appendChild(order)

    row.addEventListener('click', (e) => this._onFrameClick(e, index))
    row.addEventListener('dragstart', (e) => this._onFrameDragStart(e, index))
    row.addEventListener('dragend', (e) => this._onFrameDragEnd(e))
    row.addEventListener('dragover', (e) => this._onFrameDragOver(e, index))

    return row
  }

  _updateFlipButton(btn, flip) {
    btn.textContent = String(flip)
    btn.dataset.flip = String(flip)
    btn.title = `Flip: ${FLIP_LABELS[flip] || 'None'} (click to cycle)`
  }

  _drawThumbnail(canvas, tileId, flip = 0) {
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(0, 0, 32, 32)

    if (!this.spritesheet || this.cols === 0) {
      ctx.fillStyle = '#4a4a6a'
      ctx.fillRect(4, 4, 24, 24)
      return
    }

    const srcX = (tileId % this.cols) * this.tileWidth
    const srcY = Math.floor(tileId / this.cols) * this.tileHeight
    const scale = Math.min(32 / this.tileWidth, 32 / this.tileHeight)
    const width = this.tileWidth * scale
    const height = this.tileHeight * scale
    const x = (32 - width) / 2
    const y = (32 - height) / 2

    ctx.save()
    ctx.translate(16, 16)
    applyFlipTransform(ctx, flip)
    ctx.translate(-16, -16)
    ctx.drawImage(this.spritesheet, srcX, srcY, this.tileWidth, this.tileHeight, x, y, width, height)
    ctx.restore()
  }

  _updateSelectionVisuals() {
    const rows = this.listEl.querySelectorAll('[data-frame-item]')
    rows.forEach((row, index) => {
      if (this.selectedIndices.has(index)) {
        row.dataset.selected = 'true'
      } else {
        delete row.dataset.selected
      }
    })
  }

  _onFrameClick(e, index) {
    if (e.shiftKey) {
      if (this.selectedIndices.size > 0) {
        const anchor = Math.max(...this.selectedIndices)
        const start = Math.min(anchor, index)
        const end = Math.max(anchor, index)
        for (let i = start; i <= end; i++) this.selectedIndices.add(i)
      } else {
        this.selectedIndices.add(index)
      }
    } else if (e.ctrlKey || e.metaKey) {
      if (this.selectedIndices.has(index)) {
        this.selectedIndices.delete(index)
      } else {
        this.selectedIndices.add(index)
      }
    } else {
      this.selectedIndices.clear()
      this.selectedIndices.add(index)
    }

    this._updateSelectionVisuals()
    this._emitSelectionChanged()
  }

  _onFrameDragStart(e, index) {
    this._dragSourceIndex = index
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
    requestAnimationFrame(() => {
      e.currentTarget.dataset.dragging = 'true'
    })
  }

  _onFrameDragEnd(e) {
    this._dragSourceIndex = -1
    this._dragOverIndex = -1
    delete e.currentTarget.dataset.dragging

    this.listEl.querySelectorAll('[data-drag-over]').forEach((row) => {
      delete row.dataset.dragOver
    })
  }

  _onFrameDragOver(e, index) {
    e.preventDefault()
    if (this._dragSourceIndex < 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const top = e.clientY < rect.top + rect.height / 2
    this.listEl.querySelectorAll('[data-drag-over]').forEach((row) => {
      delete row.dataset.dragOver
    })

    e.currentTarget.dataset.dragOver = top ? 'top' : 'bottom'
    this._dragOverIndex = top ? index : index + 1
  }

  _onDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    this.listEl.dataset.dragTarget = 'true'
  }

  _onDragLeave(e) {
    if (!this.listEl.contains(e.relatedTarget)) {
      delete this.listEl.dataset.dragTarget
    }
  }

  _onDrop(e) {
    e.preventDefault()
    delete this.listEl.dataset.dragTarget
    this.listEl.querySelectorAll('[data-drag-over]').forEach((row) => {
      delete row.dataset.dragOver
    })

    if (this._dragSourceIndex >= 0 && this._dragOverIndex >= 0) {
      this._reorderFrame(this._dragSourceIndex, this._dragOverIndex)
      this._dragSourceIndex = -1
      this._dragOverIndex = -1
      return
    }

    try {
      const data = e.dataTransfer.getData('application/json')
      if (!data) return
      const { tileIds } = JSON.parse(data)
      if (Array.isArray(tileIds) && tileIds.length > 0) {
        this.addFrames(tileIds, this.getCurrentDuration())
      }
    } catch (err) {
      console.warn('Invalid drop data:', err)
    }
  }

  _reorderFrame(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex === toIndex - 1) return

    const frame = this.frames[fromIndex]
    this.frames.splice(fromIndex, 1)
    const target = fromIndex < toIndex ? toIndex - 1 : toIndex
    this.frames.splice(target, 0, frame)

    this.selectedIndices.clear()
    this.selectedIndices.add(target)
    this._renderAll()
    this._emitFramesChanged()
  }

  _emitFramesChanged() {
    bus.emit('animation:frames:changed', { frames: this.getFrames() })
  }

  _emitSelectionChanged() {
    bus.emit('animation:frame:select', { indices: [...this.selectedIndices] })
  }
}

class AnimationPreview {
  constructor(container) {
    this.container = container

    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.ctx.imageSmoothingEnabled = false

    this.spritesheet = null
    this.tileWidth = 16
    this.tileHeight = 16
    this.cols = 0

    this.animation = null
    this.playing = false
    this.loop = true
    this.currentTime = 0
    this.lastFrameTime = 0
    this.animationFrameId = null
    this.currentFrameIndex = -1

    this._playbackLoop = this._playbackLoop.bind(this)
    this._setup()
  }

  _setup() {
    this.stage = document.createElement('div')
    this.stage.dataset.previewStage = ''

    this.canvas.dataset.previewCanvas = ''
    this.stage.appendChild(this.canvas)
    this.container.appendChild(this.stage)

    this.info = document.createElement('div')
    this.info.dataset.previewInfo = ''

    this.frameInfo = document.createElement('span')
    this.frameInfo.textContent = 'Frame: -/-'

    this.timeInfo = document.createElement('span')
    this.timeInfo.textContent = '0ms / 0ms'

    this.info.append(this.frameInfo, this.timeInfo)
    this.container.appendChild(this.info)

    this._resizeObserver = new ResizeObserver(() => this._onResize())
    this._resizeObserver.observe(this.stage)
    this._onResize()
  }

  dispose() {
    this.stop()
    this._resizeObserver.disconnect()
  }

  setSpritesheet(image, tileWidth, tileHeight) {
    this.spritesheet = image
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    this.cols = image ? Math.floor(image.width / tileWidth) : 0
    this._onResize()
    this.draw()
  }

  setAnimation(animation) {
    this.animation = animation
    this.currentTime = 0
    this.currentFrameIndex = -1
    this._updateInfo()
    this.draw()
  }

  setLoop(loop) {
    this.loop = loop
    if (this.animation) this.animation.loop = loop
  }

  play() {
    if (this.playing) return
    if (!this.animation || this.animation.frames.length === 0) return

    this.playing = true
    this.lastFrameTime = performance.now()
    this.animationFrameId = requestAnimationFrame(this._playbackLoop)
    bus.emit('animation:playback:start', {})
  }

  pause() {
    if (!this.playing) return

    this.playing = false
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    bus.emit('animation:playback:pause', {})
  }

  stop() {
    this.pause()
    this.currentTime = 0
    this.currentFrameIndex = -1
    this._updateInfo()
    this.draw()
    bus.emit('animation:playback:stop', {})
  }

  toggle() {
    if (this.playing) {
      this.pause()
    } else {
      this.play()
    }
  }

  isPlaying() {
    return this.playing
  }

  _playbackLoop(now) {
    if (!this.playing) return

    const dt = now - this.lastFrameTime
    this.lastFrameTime = now
    this.currentTime += dt

    const totalDuration = getTotalDuration(this.animation)
    if (this.currentTime >= totalDuration) {
      if (this.loop) {
        this.currentTime = this.currentTime % totalDuration
      } else {
        this.currentTime = totalDuration
        this.pause()
      }
    }

    this._updateCurrentFrame()
    this._updateInfo()
    this.draw()

    if (this.playing) {
      this.animationFrameId = requestAnimationFrame(this._playbackLoop)
    }
  }

  _updateCurrentFrame() {
    const result = getFrameAtTime(this.animation, this.currentTime)
    if (!result || result.index === this.currentFrameIndex) return

    this.currentFrameIndex = result.index
    bus.emit('animation:preview:frame', {
      index: this.currentFrameIndex,
      tileId: result.frame.tileId
    })
  }

  _onResize() {
    const rect = this.stage.getBoundingClientRect()
    const size = Math.min(rect.width, rect.height) - 8

    let scale = 1
    if (this.tileWidth > 0 && this.tileHeight > 0) {
      const maxDim = Math.max(this.tileWidth, this.tileHeight)
      scale = Math.max(1, Math.floor(size / maxDim))
      scale = Math.min(scale, 8)
    }

    const width = this.tileWidth * scale || 64
    const height = this.tileHeight * scale || 64
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      this.draw()
    }
  }

  draw() {
    const ctx = this.ctx
    const width = this.canvas.width
    const height = this.canvas.height

    this._drawCheckerboard(ctx, width, height)

    if (!this.animation || this.animation.frames.length === 0) {
      ctx.fillStyle = 'rgba(100, 100, 150, 0.5)'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No frames', width / 2, height / 2)
      return
    }

    if (!this.spritesheet || this.cols === 0) {
      ctx.fillStyle = 'rgba(100, 100, 150, 0.5)'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No sheet', width / 2, height / 2)
      return
    }

    const result = getFrameAtTime(this.animation, this.currentTime)
    if (!result) return

    const tileId = result.frame.tileId
    const flip = result.frame.flip || 0
    const srcX = (tileId % this.cols) * this.tileWidth
    const srcY = Math.floor(tileId / this.cols) * this.tileHeight

    ctx.save()
    ctx.translate(width / 2, height / 2)
    applyFlipTransform(ctx, flip)
    ctx.translate(-width / 2, -height / 2)
    ctx.drawImage(this.spritesheet, srcX, srcY, this.tileWidth, this.tileHeight, 0, 0, width, height)
    ctx.restore()
  }

  _drawCheckerboard(ctx, width, height) {
    const size = Math.max(4, Math.min(8, width / 8))
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#3a3a4a'

    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
          ctx.fillRect(x, y, size, size)
        }
      }
    }
  }

  _updateInfo() {
    if (!this.animation || this.animation.frames.length === 0) {
      this.frameInfo.textContent = 'Frame: -/-'
      this.timeInfo.textContent = '0ms / 0ms'
      return
    }

    const totalFrames = this.animation.frames.length
    const totalDuration = getTotalDuration(this.animation)
    const currentFrame = this.currentFrameIndex >= 0 ? this.currentFrameIndex + 1 : 1
    this.frameInfo.textContent = `Frame: ${currentFrame}/${totalFrames}`
    this.timeInfo.textContent = `${Math.round(this.currentTime)}ms / ${totalDuration}ms`
  }
}

/**
 * Animation Editor View
 */
export class ViewAnimationEditor extends AnimationEditorCanvas {
  static get viewMeta() { return { displayName: 'Animation Editor', category: 'Animation' } }
  static get keybindings() {
    return [
      { id: 'playback-toggle', eventName: 'animation:playback:toggle', description: 'Play/pause animation', defaultKeys: '<Space>' },
      { id: 'frame-delete', eventName: 'animation:frame:delete', description: 'Delete selected frames', defaultKeys: '<Del>' },
      { id: 'frame-select-all', eventName: 'animation:frame:select-all', description: 'Select all frames', defaultKeys: '<C-a>' },
      { id: 'save-animation', eventName: 'animation:save', description: 'Save animation', defaultKeys: '<C-s>' },
      { id: 'selection-clear', eventName: 'animation:selection:clear', description: 'Clear selection', defaultKeys: '<Esc>' }
    ]
  }

  static get observedAttributes() {
    return ['data-spritesheet', 'data-start-frame']
  }

  constructor() {
    super()

    this.animation = createAnimation()
    this._originalStartFrame = null

    this.frameListPanel = null
    this.animationPreview = null

    this._unsubscribers = []
    this._decoder = new TextDecoder()

    this._onTileAdd = this._onTileAdd.bind(this)
    this._onFramesChanged = this._onFramesChanged.bind(this)
    this._onFrameSelect = this._onFrameSelect.bind(this)
    this._onMarkerClick = this._onMarkerClick.bind(this)
  }

  connectedCallback() {
    this._buildDOM()
    super.connectedCallback()
    this._setupHeaderControls()
    this._setupEventListeners()
    this._setupBusListeners()

    if (this.hasAttribute('data-spritesheet')) {
      const spritesheet = this.getAttribute('data-spritesheet')
      const startFrame = this.hasAttribute('data-start-frame')
        ? parseInt(this.getAttribute('data-start-frame'), 10)
        : null

      this._loadSpritesheet(spritesheet).then(() => {
        if (startFrame !== null) {
          this._loadAnimationByStartFrame(startFrame)
        }
      })
    }
  }

  disconnectedCallback() {
    this._unsubscribers.forEach(unsub => unsub())
    this._unsubscribers = []

    if (this.frameListPanel) this.frameListPanel.dispose()
    if (this.animationPreview) this.animationPreview.dispose()

    super.disconnectedCallback()
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

  _buildDOM() {
    this.style.cssText = `
      flex:1;
      position: relative;
    `
    this.innerHTML = `
      <aside>
        <fieldset>
          <legend>Preview</legend>
          <div data-part="preview"></div>
          <div data-controls="preview">
            <button data-action="play" title="Play/Pause"><i aria-hidden="true">play_arrow</i></button>
            <button data-action="stop" title="Stop"><i aria-hidden="true">stop</i></button>
            <label>
              <input type="checkbox" data-action="loop" checked>
              <span>Loop</span>
            </label>
          </div>
        </fieldset>

        <fieldset data-section="frames">
          <legend>Frames</legend>
          <div data-controls="frames">
            <button data-action="apply-duration">Apply</button>
            <button data-action="flip-h" title="Toggle Horizontal Flip (H)">H</button>
            <button data-action="flip-v" title="Toggle Vertical Flip (V)">V</button>
            <button data-action="flip-d" title="Toggle Diagonal Flip (D)">D</button>
            <button data-action="delete-frames" class="danger" title="Delete Selected">Delete</button>
            <label>
              <span>Duration</span>
              <input type="number" data-element="frame-duration" value="100" min="1" title="Frame Duration (ms)">
            </label>
          </div>
          <div data-part="frames"></div>
        </fieldset>
      </aside>
    `

    const framesContainer = this.querySelector('[data-part="frames"]')
    const previewContainer = this.querySelector('[data-part="preview"]')

    this.frameListPanel = new FrameListPanel(framesContainer, { defaultDuration: 100 })
    this.animationPreview = new AnimationPreview(previewContainer)

    this._setupRightPanelControls()
  }

  createHeaderControlsElement() {
    const controls = document.createElement('div')
    controls.dataset.view = 'animation-editor'
    controls.innerHTML = `
      <button data-action="load-spritesheet" aria-label="Load Sheet" title="Load Sheet"><i aria-hidden="true">folder_open</i></button>
      <button data-action="new" class="accent" aria-label="New" title="New"><i aria-hidden="true">docs</i></button>
      <button data-action="save" class="accent" aria-label="Save" title="Save"><i aria-hidden="true">save</i></button>
      <span data-sep></span>
      <label data-tile-size>
        <span>Tile</span>
        <input type="number" data-element="tile-width" value="16" min="1" title="Tile Width">
        <span>x</span>
        <input type="number" data-element="tile-height" value="16" min="1" title="Tile Height">
      </label>
    `

    return controls
  }

  _setupRightPanelControls() {
    const playBtn = this.querySelector('[data-action="play"]')
    const stopBtn = this.querySelector('[data-action="stop"]')
    const loopCheckbox = this.querySelector('[data-action="loop"]')

    if (playBtn) {
      playBtn.onclick = () => {
        if (this.animationPreview.isPlaying()) {
          this.animationPreview.pause()
          this.setPlayButtonState(playBtn, false)
        } else {
          this.animationPreview.play()
          this.setPlayButtonState(playBtn, true)
        }
      }
    }

    if (stopBtn) {
      stopBtn.onclick = () => {
        this.animationPreview.stop()
        if (playBtn) this.setPlayButtonState(playBtn, false)
      }
    }

    if (loopCheckbox) {
      loopCheckbox.checked = this.animation.loop
      loopCheckbox.onchange = () => {
        this.animation.loop = loopCheckbox.checked
        this.animationPreview.setLoop(loopCheckbox.checked)
      }
    }

    const durationInput = this.querySelector('[data-element="frame-duration"]')
    const applyDurationBtn = this.querySelector('[data-action="apply-duration"]')
    const deleteBtn = this.querySelector('[data-action="delete-frames"]')

    if (durationInput) this.frameListPanel.setDurationInputRef(durationInput)

    if (applyDurationBtn && durationInput) {
      applyDurationBtn.onclick = () => {
        const duration = parseInt(durationInput.value, 10) || 100
        this.frameListPanel.updateSelectedDuration(duration)
      }
    }

    if (deleteBtn) {
      deleteBtn.onclick = () => this.frameListPanel.removeSelected()
    }

    const flipHBtn = this.querySelector('[data-action="flip-h"]')
    const flipVBtn = this.querySelector('[data-action="flip-v"]')
    const flipDBtn = this.querySelector('[data-action="flip-d"]')

    if (flipHBtn) flipHBtn.onclick = () => this.frameListPanel.toggleSelectedFlipBit(FLIP_H)
    if (flipVBtn) flipVBtn.onclick = () => this.frameListPanel.toggleSelectedFlipBit(FLIP_V)
    if (flipDBtn) flipDBtn.onclick = () => this.frameListPanel.toggleSelectedFlipBit(FLIP_D)
  }

  setPlayButtonState(playBtn, isPlaying) {
    const icon = playBtn.querySelector('i')
    if (!icon) return
    icon.textContent = isPlaying ? 'pause' : 'play_arrow'
  }

  _setupHeaderControls() {
    const loadBtn = this.queryHeaderControl('[data-action="load-spritesheet"]')
    if (loadBtn) loadBtn.onclick = () => this._promptLoadSpritesheet()

    const tileWidthInput = this.queryHeaderControl('[data-element="tile-width"]')
    const tileHeightInput = this.queryHeaderControl('[data-element="tile-height"]')

    if (tileWidthInput) {
      tileWidthInput.value = this.animation.tileWidth
      tileWidthInput.onchange = () => this._updateTileSize()
    }
    if (tileHeightInput) {
      tileHeightInput.value = this.animation.tileHeight
      tileHeightInput.onchange = () => this._updateTileSize()
    }

    const newBtn = this.queryHeaderControl('[data-action="new"]')
    if (newBtn) newBtn.onclick = () => this.clearAnimation()
  }

  _setupEventListeners() {
    this._unsubscribers.push(
      bus.on('animation:playback:start', () => {
        const playBtn = this.querySelector('[data-action="play"]')
        if (playBtn) this.setPlayButtonState(playBtn, true)
      }),
      bus.on('animation:playback:pause', () => {
        const playBtn = this.querySelector('[data-action="play"]')
        if (playBtn) this.setPlayButtonState(playBtn, false)
      }),
      bus.on('animation:playback:stop', () => {
        const playBtn = this.querySelector('[data-action="play"]')
        if (playBtn) this.setPlayButtonState(playBtn, false)
      })
    )

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
        this.clearSelection()
      }),
      bus.on('animation:save', () => {
        this.saveData()
      })
    )
  }

  _setupBusListeners() {
    this._unsubscribers.push(bus.on('animation:tile:add', this._onTileAdd))
    this._unsubscribers.push(bus.on('animation:frames:changed', this._onFramesChanged))
    this._unsubscribers.push(bus.on('animation:frame:select', this._onFrameSelect))
    this._unsubscribers.push(bus.on('animation:marker:click', this._onMarkerClick))
  }

  _onTileAdd({ tileIds }) {
    const durationInput = this.querySelector('[data-element="frame-duration"]')
    const duration = durationInput ? parseInt(durationInput.value, 10) || 100 : 100
    this.frameListPanel.addFrames(tileIds, duration)
  }

  _onFramesChanged({ frames }) {
    this.animation.frames = frames
    this._updatePreview()
  }

  _onFrameSelect() { }

  _onMarkerClick({ tileId }) {
    this._loadAnimationByStartFrame(tileId)
  }

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
    await this.loadSpritesheet(source)

    const image = this.getImage()
    if (image) {
      this.frameListPanel.setSpritesheet(image, this.animation.tileWidth, this.animation.tileHeight)
      this.animationPreview.setSpritesheet(image, this.animation.tileWidth, this.animation.tileHeight)
    }

    await this._loadAnimationMarkers(source)

    this._originalStartFrame = null
    this.animation.frames = []
    this.frameListPanel.setFrames([])
    this._updatePreview()
  }

  _updateTileSize() {
    const widthInput = this.queryHeaderControl('[data-element="tile-width"]')
    const heightInput = this.queryHeaderControl('[data-element="tile-height"]')

    const width = parseInt(widthInput?.value, 10) || 16
    const height = parseInt(heightInput?.value, 10) || 16

    this.animation.tileWidth = width
    this.animation.tileHeight = height
    this.setTileSize(width, height)

    const image = this.getImage()
    if (image) {
      this.frameListPanel.setSpritesheet(image, width, height)
      this.animationPreview.setSpritesheet(image, width, height)
    }
  }

  _updatePreview() {
    this.animationPreview.setAnimation(this.animation)
  }

  async _loadAnimationMarkers(sourceFile) {
    try {
      const escapedPath = sourceFile.replace(/'/g, "''")
      const query = `SELECT start_frame FROM animation_storage WHERE source_file = '${escapedPath}'`

      const result = await window.pluginManager.call('sql', 'query', query)
      const csv = this._decoder.decode(result.output)
      const lines = parseCSVLines(csv.trim())

      const markers = []
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].length > 0) markers.push(parseInt(lines[i][0], 10))
      }

      this.setAnimationMarkers(markers)
    } catch (err) {
      console.error('Failed to load animation markers:', err)
      this.setAnimationMarkers([])
    }
  }

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

      this.animation = {
        spritesheet: this.animation.spritesheet,
        tileWidth,
        tileHeight,
        frames: data.frames || [],
        loop: data.loop !== undefined ? data.loop : true
      }

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
      this.animation.frames = this.frameListPanel.getFrames()
      const validation = validateAnimation(this.animation)
      if (!validation.valid) {
        bus.emit('toast:show', { message: validation.errors[0], type: 'error' })
        return
      }

      const sourceFile = this.animation.spritesheet
      const startFrame = getStartFrame(this.animation)
      const escapedPath = sourceFile.replace(/'/g, "''")

      const dataJson = JSON.stringify({ frames: this.animation.frames, loop: this.animation.loop })
      const escapedData = dataJson.replace(/'/g, "''")

      if (this._originalStartFrame !== null && this._originalStartFrame !== startFrame) {
        const deleteQuery = `DELETE FROM animation_storage WHERE source_file = '${escapedPath}' AND start_frame = ${this._originalStartFrame}`
        await window.pluginManager.call('sql', 'exec', deleteQuery)
        this.removeAnimationMarker(this._originalStartFrame)
      }

      const insertQuery = `INSERT OR REPLACE INTO animation_storage (source_file, start_frame, tile_width, tile_height, data) VALUES ('${escapedPath}', ${startFrame}, ${this.animation.tileWidth}, ${this.animation.tileHeight}, '${escapedData}')`
      await window.pluginManager.call('sql', 'exec', insertQuery)

      this._originalStartFrame = startFrame
      this.addAnimationMarker(startFrame)

      bus.emit('toast:show', { message: `Animation saved (frame ${startFrame})`, type: 'success' })
    } catch (err) {
      console.error('Failed to save animation:', err)
      bus.emit('toast:show', { message: 'Failed to save animation', type: 'error' })
    }
  }

  clearAnimation() {
    this._originalStartFrame = null
    this.animation.frames = []
    this.frameListPanel.setFrames([])
    this._updatePreview()
  }

  _applyAnimationData() {
    const widthInput = this.queryHeaderControl('[data-element="tile-width"]')
    const heightInput = this.queryHeaderControl('[data-element="tile-height"]')
    const loopCheckbox = this.querySelector('[data-action="loop"]')

    if (widthInput) widthInput.value = this.animation.tileWidth
    if (heightInput) heightInput.value = this.animation.tileHeight
    if (loopCheckbox) loopCheckbox.checked = this.animation.loop

    this.setTileSize(this.animation.tileWidth, this.animation.tileHeight)

    const image = this.getImage()
    if (image) {
      this.frameListPanel.setSpritesheet(image, this.animation.tileWidth, this.animation.tileHeight)
      this.animationPreview.setSpritesheet(image, this.animation.tileWidth, this.animation.tileHeight)
    }

    this.frameListPanel.setFrames(this.animation.frames)
    this._updatePreview()
  }

  handleKeybinding(eventName) {
    switch (eventName) {
      case 'animation:playback:toggle':
        this.animationPreview.toggle()
        return true
      case 'animation:frame:delete':
        this.frameListPanel.removeSelected()
        return true
      case 'animation:frame:select-all':
        this.frameListPanel.selectAll()
        return true
      case 'animation:selection:clear':
        this.frameListPanel.clearSelection()
        this.clearSelection()
        return true
      case 'animation:save':
        this.saveData()
        return true
      default:
        return super.handleKeybinding(eventName)
    }
  }

  getViewMode() {
    return 'animation-editor'
  }
}

export default ViewAnimationEditor
