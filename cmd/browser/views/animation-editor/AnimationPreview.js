import { bus } from '../../systems/event-bus.js'
import { getFrameAtTime, getTotalDuration } from './AnimationData.js'

/**
 * Animation Preview
 * 
 * Canvas-based preview of the animation with playback controls.
 * Shows current frame with proper timing.
 * 
 * Events emitted:
 * - animation:preview:frame - { index: number, tileId: number }
 */
export class AnimationPreview {
  constructor(container) {
    this.container = container
    
    // Create canvas
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.ctx.imageSmoothingEnabled = false
    
    // Image reference
    this.spritesheet = null
    this.tileWidth = 16
    this.tileHeight = 16
    this.cols = 0
    
    // Animation data
    this.animation = null
    
    // Playback state
    this.playing = false
    this.loop = true
    this.currentTime = 0
    this.lastFrameTime = 0
    this.animationFrameId = null
    this.currentFrameIndex = -1
    
    // Bind methods
    this._playbackLoop = this._playbackLoop.bind(this)
    
    this._setup()
  }
  
  _setup() {
    // Container styling
    this.container.classList.add('animation-preview')
    
    // Create preview area
    this.previewArea = document.createElement('div')
    this.previewArea.className = 'preview-area'
    
    this.canvas.className = 'preview-canvas'
    this.previewArea.appendChild(this.canvas)
    this.container.appendChild(this.previewArea)
    
    // Create info display
    this.infoDisplay = document.createElement('div')
    this.infoDisplay.className = 'preview-info'
    this.infoDisplay.innerHTML = `
      <span class="preview-frame">Frame: -/-</span>
      <span class="preview-time">0ms / 0ms</span>
    `
    this.container.appendChild(this.infoDisplay)
    
    this.frameDisplay = this.infoDisplay.querySelector('.preview-frame')
    this.timeDisplay = this.infoDisplay.querySelector('.preview-time')
    
    // Observe size changes
    this._resizeObserver = new ResizeObserver(() => this._onResize())
    this._resizeObserver.observe(this.previewArea)
    
    // Initial size
    this._onResize()
  }
  
  dispose() {
    this.stop()
    this._resizeObserver.disconnect()
  }
  
  /**
   * Set spritesheet for rendering
   */
  setSpritesheet(image, tileWidth, tileHeight) {
    this.spritesheet = image
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    if (image) {
      this.cols = Math.floor(image.width / tileWidth)
    }
    this._onResize()
    this.draw()
  }
  
  /**
   * Set animation data
   */
  setAnimation(animation) {
    this.animation = animation
    this.currentTime = 0
    this.currentFrameIndex = -1
    this._updateInfo()
    this.draw()
  }
  
  /**
   * Set loop mode
   */
  setLoop(loop) {
    this.loop = loop
    if (this.animation) {
      this.animation.loop = loop
    }
  }
  
  // --- Playback ---
  
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
    
    // Handle end of animation
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
    if (result && result.index !== this.currentFrameIndex) {
      this.currentFrameIndex = result.index
      bus.emit('animation:preview:frame', { 
        index: this.currentFrameIndex, 
        tileId: result.frame.tileId 
      })
    }
  }
  
  // --- Rendering ---
  
  _onResize() {
    const rect = this.previewArea.getBoundingClientRect()
    const size = Math.min(rect.width, rect.height) - 8 // Padding
    
    // Determine canvas size based on tile size
    // Aim for integer scaling that fits nicely
    let scale = 1
    if (this.tileWidth > 0 && this.tileHeight > 0) {
      const maxDim = Math.max(this.tileWidth, this.tileHeight)
      scale = Math.max(1, Math.floor(size / maxDim))
      scale = Math.min(scale, 8) // Cap at 8x
    }
    
    const canvasWidth = this.tileWidth * scale || 64
    const canvasHeight = this.tileHeight * scale || 64
    
    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth
      this.canvas.height = canvasHeight
      this.draw()
    }
  }
  
  draw() {
    const ctx = this.ctx
    const { width, height } = this.canvas
    
    // Background (checkerboard for transparency)
    this._drawCheckerboard(ctx, width, height)
    
    if (!this.animation || this.animation.frames.length === 0) {
      // Draw placeholder
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
    
    // Get current frame
    const result = getFrameAtTime(this.animation, this.currentTime)
    if (!result) return
    
    const { frame } = result
    const tileId = frame.tileId
    
    const srcX = (tileId % this.cols) * this.tileWidth
    const srcY = Math.floor(tileId / this.cols) * this.tileHeight
    
    ctx.drawImage(
      this.spritesheet,
      srcX, srcY, this.tileWidth, this.tileHeight,
      0, 0, width, height
    )
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
      this.frameDisplay.textContent = 'Frame: -/-'
      this.timeDisplay.textContent = '0ms / 0ms'
      return
    }
    
    const totalFrames = this.animation.frames.length
    const totalDuration = getTotalDuration(this.animation)
    const currentFrame = this.currentFrameIndex >= 0 ? this.currentFrameIndex + 1 : 1
    
    this.frameDisplay.textContent = `Frame: ${currentFrame}/${totalFrames}`
    this.timeDisplay.textContent = `${Math.round(this.currentTime)}ms / ${totalDuration}ms`
  }
  
  // --- Public API ---
  
  /**
   * Seek to specific time
   */
  seekTo(timeMs) {
    const totalDuration = this.animation ? getTotalDuration(this.animation) : 0
    this.currentTime = Math.max(0, Math.min(timeMs, totalDuration))
    this._updateCurrentFrame()
    this._updateInfo()
    this.draw()
  }
  
  /**
   * Go to specific frame
   */
  goToFrame(index) {
    if (!this.animation || index < 0 || index >= this.animation.frames.length) return
    
    // Calculate time at frame start
    let time = 0
    for (let i = 0; i < index; i++) {
      time += this.animation.frames[i].duration
    }
    
    this.seekTo(time)
  }
  
  /**
   * Get current playback time
   */
  getCurrentTime() {
    return this.currentTime
  }
  
  /**
   * Get current frame index
   */
  getCurrentFrameIndex() {
    return this.currentFrameIndex
  }
}
