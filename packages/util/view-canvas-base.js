import { registerViewPlugin, unregisterViewPlugin } from './view-plugin.js'

const MIN_SCALE = 0.2
const MAX_SCALE = 3

function assert(condition, message) {
  if (!condition) throw new Error(message)
}


export class ViewCanvasBase extends HTMLElement {
  constructor() {
    super()
    this.canvas = null
    this.ctx = null
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
    this.isDragging = false
    this.dragStartX = 0
    this.dragStartY = 0
    this.spacePressed = false
    this.data = null
    this.contentBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    this.autoFitOnLoad = true
    this._hasAutoFitted = false
    this._headerControlsElement = null

    this._resizeFrame = 0
    this._pendingCanvasSize = null
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== this.canvas) continue

        this._pendingCanvasSize = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        }

        if (this._resizeFrame) return

        this._resizeFrame = requestAnimationFrame(() => {
          this._resizeFrame = 0
          const size = this._pendingCanvasSize
          this._pendingCanvasSize = null
          if (!size) return
          this._onResized(size.width, size.height)
        })
      }
    })

    this._onWheel = this._onWheel.bind(this)
    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onMouseLeave = this._onMouseLeave.bind(this)
    this._onKeyDown = this._onKeyDown.bind(this)
    this._onKeyUp = this._onKeyUp.bind(this)
  }

  connectedCallback() {
    registerViewPlugin(this, this.createViewPluginMethods())
    this.style.display = 'contents'
    this.canvas = this.querySelector('canvas[data-element="canvas"]') || this.querySelector('canvas')
    if (!(this.canvas instanceof HTMLCanvasElement)) {
      this.canvas = document.createElement('canvas')
      this.canvas.dataset.element = 'canvas'
      this.appendChild(this.canvas)
    }

    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.minWidth = '0'
    this.canvas.style.minHeight = '0'
    this.canvas.style.maxWidth = '100%'
    this.canvas.style.maxHeight = '100%'
    this.canvas.style.justifySelf = 'stretch'
    this.canvas.style.alignSelf = 'stretch'

    this.ctx = this.canvas.getContext('2d')
    assert(this.ctx, 'view-canvas-base failed to create 2d context')
    this.ctx.imageSmoothingEnabled = false

    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0')
    }

    this._mountHeaderControls()
    this._resizeObserver.observe(this.canvas)
    this._addEventListeners()
    this.draw()
  }

  disconnectedCallback() {
    if (this._resizeFrame) {
      cancelAnimationFrame(this._resizeFrame)
      this._resizeFrame = 0
    }

    this._resizeObserver.disconnect()
    this._removeEventListeners()
    this._unmountHeaderControls()
    void unregisterViewPlugin(this)
  }

  createViewPluginMethods() {
    return {}
  }

  createHeaderControlsElement() {
    return null
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControlsElement) return
    const headerControls = this.createHeaderControlsElement()
    if (!(headerControls instanceof HTMLElement)) return
    headerControls.setAttribute('slot', 'header-controls')
    this._headerControlsElement = headerControls
    this.parentElement.appendChild(headerControls)
  }

  _unmountHeaderControls() {
    if (this._headerControlsElement?.parentElement) {
      this._headerControlsElement.remove()
    }
    this._headerControlsElement = null
  }

  queryHeaderControl(selector) {
    return this._headerControlsElement?.querySelector(selector) || null
  }

  _addEventListeners() {
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false })
    this.canvas.addEventListener('mousedown', this._onMouseDown)
    this.canvas.addEventListener('mousemove', this._onMouseMove)
    this.canvas.addEventListener('mouseup', this._onMouseUp)
    this.canvas.addEventListener('mouseleave', this._onMouseLeave)
    this.addEventListener('keydown', this._onKeyDown)
    this.addEventListener('keyup', this._onKeyUp)
  }

  _removeEventListeners() {
    if (!(this.canvas instanceof HTMLCanvasElement)) return
    this.canvas.removeEventListener('wheel', this._onWheel)
    this.canvas.removeEventListener('mousedown', this._onMouseDown)
    this.canvas.removeEventListener('mousemove', this._onMouseMove)
    this.canvas.removeEventListener('mouseup', this._onMouseUp)
    this.canvas.removeEventListener('mouseleave', this._onMouseLeave)
    this.removeEventListener('keydown', this._onKeyDown)
    this.removeEventListener('keyup', this._onKeyUp)
  }

  _onResized(width, height) {
    if (!(this.canvas instanceof HTMLCanvasElement)) return
    const roundedWidth = Math.max(1, Math.round(width))
    const roundedHeight = Math.max(1, Math.round(height))
    if (this.canvas.width === roundedWidth && this.canvas.height === roundedHeight) return
    this.canvas.width = roundedWidth
    this.canvas.height = roundedHeight
    this.draw()
    this._tryAutoFit()
  }

  setData(data, { autoFit = true } = {}) {
    assert(typeof autoFit === 'boolean', 'view-canvas-base setData autoFit must be boolean')
    this.data = data
    this.contentBounds = this.calculateContentBounds(data)
    if (autoFit) {
      this._hasAutoFitted = false
      this.draw()
      this._tryAutoFit()
      return
    }
    this._constrainPosition()
    this.draw()
  }

  draw() {
    if (!(this.canvas instanceof HTMLCanvasElement) || !this.ctx) return
    const { width, height } = this.canvas
    this.ctx.save()
    this.ctx.clearRect(0, 0, width, height)
    this.ctx.translate(this.offsetX, this.offsetY)
    this.ctx.scale(this.scale, this.scale)
    this.drawContent(this.ctx, this.data)
    this.ctx.restore()
  }

  getWorldPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    }
  }

  zoom(x, y, factor) {
    const oldScale = this.scale
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * factor))

    const scaleChange = this.scale - oldScale
    const relX = (x - this.offsetX) / oldScale
    const relY = (y - this.offsetY) / oldScale

    this.offsetX -= relX * scaleChange
    this.offsetY -= relY * scaleChange
    this._constrainPosition()
    this.draw()
  }

  zoomIn() {
    this.zoom(this.canvas.width / 2, this.canvas.height / 2, 1.2)
  }

  zoomOut() {
    this.zoom(this.canvas.width / 2, this.canvas.height / 2, 0.8)
  }

  zoomFit() {
    return this.fitToContent()
  }

  fitToContent() {
    if (!(this.canvas instanceof HTMLCanvasElement)) return false
    if (!this._hasValidContentBounds()) {
      this.contentBounds = this.calculateContentBounds(this.data)
    }
    if (!this._hasValidContentBounds()) return false

    const wrapperWidth = this.canvas.width
    const wrapperHeight = this.canvas.height
    const { minX, maxX, minY, maxY } = this.contentBounds
    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    if (contentWidth <= 0 || contentHeight <= 0) return false

    const padding = 40
    const targetWidth = Math.max(1, wrapperWidth - padding * 2)
    const targetHeight = Math.max(1, wrapperHeight - padding * 2)
    const scaleX = targetWidth / contentWidth
    const scaleY = targetHeight / contentHeight
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)))

    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2
    this.offsetX = wrapperWidth / 2 - contentCenterX * this.scale
    this.offsetY = wrapperHeight / 2 - contentCenterY * this.scale
    this._constrainPosition()
    this.draw()
    return true
  }

  _tryAutoFit() {
    if (!this.autoFitOnLoad || this._hasAutoFitted) return
    if (!(this.canvas instanceof HTMLCanvasElement)) return
    if (this.canvas.width <= 0 || this.canvas.height <= 0) return
    this._hasAutoFitted = true
    if (!this.fitToContent()) {
      this._hasAutoFitted = false
    }
  }

  _hasValidContentBounds() {
    const { minX, maxX, minY, maxY } = this.contentBounds || {}
    return Number.isFinite(minX) && Number.isFinite(maxX) && Number.isFinite(minY) && Number.isFinite(maxY) && maxX > minX && maxY > minY
  }

  _constrainPosition() {
    if (!(this.canvas instanceof HTMLCanvasElement) || !this._hasValidContentBounds()) return
    const wrapperWidth = this.canvas.width
    const wrapperHeight = this.canvas.height
    const { minX, maxX, minY, maxY } = this.contentBounds
    const margin = 50

    const maxOffsetX = wrapperWidth - margin - minX * this.scale
    const minOffsetX = margin - maxX * this.scale
    const maxOffsetY = wrapperHeight - margin - minY * this.scale
    const minOffsetY = margin - maxY * this.scale

    if (minOffsetX <= maxOffsetX) {
      this.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.offsetX))
    }
    if (minOffsetY <= maxOffsetY) {
      this.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.offsetY))
    }
  }

  _onWheel(event) {
    event.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (event.ctrlKey || event.metaKey) {
      this.zoom(x, y, event.deltaY < 0 ? 1.1 : 0.9)
      return
    }

    this.offsetX -= event.deltaX
    this.offsetY -= event.deltaY
    this._constrainPosition()
    this.draw()
  }

  _onMouseDown(event) {
    if (this.spacePressed) {
      this.isDragging = true
      this.dragStartX = event.clientX - this.offsetX
      this.dragStartY = event.clientY - this.offsetY
      this.canvas.style.cursor = 'grabbing'
      return
    }
    this.onCanvasMouseDown(event)
  }

  _onMouseMove(event) {
    if (this.isDragging && this.spacePressed) {
      this.offsetX = event.clientX - this.dragStartX
      this.offsetY = event.clientY - this.dragStartY
      this._constrainPosition()
      this.draw()
      return
    }
    this.onCanvasMouseMove(event)
  }

  _onMouseUp(event) {
    if (this.isDragging && this.spacePressed) {
      this.isDragging = false
      this.canvas.style.cursor = 'grab'
      return
    }
    this.onCanvasMouseUp(event)
  }

  _onMouseLeave() {
    this.isDragging = false
    if (this.canvas) this.canvas.style.cursor = this.spacePressed ? 'grab' : 'default'
  }

  _onKeyDown(event) {
    if (event.key === ' ') {
      event.preventDefault()
      this.spacePressed = true
      if (this.canvas) this.canvas.style.cursor = 'grab'
      return
    }

    if (event.key === '+') {
      event.preventDefault()
      this.zoomIn()
      return
    }

    if (event.key === '-') {
      event.preventDefault()
      this.zoomOut()
      return
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      this.fitToContent()
    }
  }

  _onKeyUp(event) {
    if (event.key !== ' ') return
    event.preventDefault()
    this.spacePressed = false
    this.isDragging = false
    if (this.canvas) this.canvas.style.cursor = 'default'
  }

  onCanvasMouseDown(_event) { }
  onCanvasMouseMove(_event) { }
  onCanvasMouseUp(_event) { }

  calculateContentBounds(_data) {
    throw new Error('ViewCanvasBase subclass must implement calculateContentBounds(data)')
  }

  drawContent(_ctx, _data) {
    throw new Error('ViewCanvasBase subclass must implement drawContent(ctx, data)')
  }
}
