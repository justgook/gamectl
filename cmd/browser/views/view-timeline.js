/**
 * Timeline Ruler Component
 * 
 * A scalable ruler for animation timelines with instant snap-to-level zooming.
 * 
 * Attributes:
 *   min-value        - Minimum time value (default: 0)
 *   max-value        - Maximum time value (default: 60)
 *   pixels-per-second - Initial scale (default: 100)
 *   snap-levels      - Comma-separated PPS values to snap to
 *   scroll-inverted  - If present, inverts scroll direction (for Windows users)
 * 
 * Events:
 *   pps-change - Fired when pixels-per-second changes
 *     detail: { pixelsPerSecond: number, width: number }
 */
export class TimelineRuler extends HTMLElement {
  // Default snap levels optimized for 60fps animation work
  // From frame-level detail (6000 = 100px/frame) to overview (3 = 3px/second)
  static DEFAULT_SNAP_LEVELS = [6000, 3000, 1500, 600, 300, 120, 60, 30, 15, 6, 3]

  static get observedAttributes() {
    return ['min-value', 'max-value', 'pixels-per-second', 'snap-levels', 'scroll-inverted']
  }

  constructor() {
    super()
    this._minValue = 0
    this._maxValue = 60
    this._pixelsPerSecond = 100
    this._snapLevels = [...TimelineRuler.DEFAULT_SNAP_LEVELS]
    this._scrollInverted = false
    this._canvas = null
    this._ctx = null
  }

  // --- Getters/Setters ---

  get minValue() { return this._minValue }
  set minValue(v) {
    this._minValue = parseFloat(v) || 0
    this._updateWidth()
    this._draw()
  }

  get maxValue() { return this._maxValue }
  set maxValue(v) {
    this._maxValue = parseFloat(v) || 60
    this._updateWidth()
    this._draw()
  }

  get pixelsPerSecond() { return this._pixelsPerSecond }
  set pixelsPerSecond(v) {
    const pps = parseFloat(v)
    if (pps && pps > 0 && pps !== this._pixelsPerSecond) {
      this._pixelsPerSecond = pps
      this._updateWidth()
      this._draw()
      this._emitChange()
    }
  }

  get snapLevels() { return this._snapLevels }
  set snapLevels(v) {
    if (typeof v === 'string') {
      this._snapLevels = v.split(',').map(n => parseFloat(n.trim())).filter(n => n > 0).sort((a, b) => b - a)
    } else if (Array.isArray(v)) {
      this._snapLevels = v.filter(n => n > 0).sort((a, b) => b - a)
    }
  }

  get width() {
    return (this._maxValue - this._minValue) * this._pixelsPerSecond
  }

  /** Returns the snap interval for keyframe snapping (minor tick interval) */
  get snapInterval() {
    return this._chooseTickInterval() / 4
  }

  // --- Lifecycle ---

  connectedCallback() {
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 24px;
          overflow: hidden;
        }
        canvas {
          display: block;
          height: 100%;
        }
      </style>
      <canvas></canvas>
    `

    this._canvas = this.shadowRoot.querySelector('canvas')
    this._ctx = this._canvas.getContext('2d')

    this._readAttributes()
    this._updateWidth()
    this._draw()

    this._boundWheel = this._onWheel.bind(this)
    this._canvas.addEventListener('wheel', this._boundWheel, { passive: false })
  }

  disconnectedCallback() {
    if (this._canvas) {
      this._canvas.removeEventListener('wheel', this._boundWheel)
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return

    switch (name) {
      case 'min-value':
        this.minValue = newValue
        break
      case 'max-value':
        this.maxValue = newValue
        break
      case 'pixels-per-second':
        this.pixelsPerSecond = newValue
        break
      case 'snap-levels':
        this.snapLevels = newValue
        break
      case 'scroll-inverted':
        this._scrollInverted = this.hasAttribute('scroll-inverted')
        break
    }
  }

  _readAttributes() {
    if (this.hasAttribute('min-value')) {
      this._minValue = parseFloat(this.getAttribute('min-value')) || 0
    }
    if (this.hasAttribute('max-value')) {
      this._maxValue = parseFloat(this.getAttribute('max-value')) || 60
    }
    if (this.hasAttribute('pixels-per-second')) {
      this._pixelsPerSecond = parseFloat(this.getAttribute('pixels-per-second')) || 100
    }
    if (this.hasAttribute('snap-levels')) {
      this.snapLevels = this.getAttribute('snap-levels')
    }
    this._scrollInverted = this.hasAttribute('scroll-inverted')
  }

  // --- Zoom Logic ---

  _snapToLevel(currentPPS, zoomIn) {
    const levels = this._snapLevels
    if (levels.length === 0) return currentPPS

    // Find current position in levels
    let currentIndex = -1
    for (let i = 0; i < levels.length; i++) {
      if (Math.abs(levels[i] - currentPPS) < 0.5) {
        currentIndex = i
        break
      }
    }

    if (currentIndex === -1) {
      // Not on a snap level, find nearest
      let nearestIndex = 0
      let nearestDiff = Math.abs(levels[0] - currentPPS)
      for (let i = 1; i < levels.length; i++) {
        const diff = Math.abs(levels[i] - currentPPS)
        if (diff < nearestDiff) {
          nearestDiff = diff
          nearestIndex = i
        }
      }
      return levels[nearestIndex]
    }

    // Move to next/previous level
    if (zoomIn) {
      // Higher PPS = more zoomed in (levels sorted descending)
      return currentIndex > 0 ? levels[currentIndex - 1] : levels[0]
    } else {
      // Lower PPS = more zoomed out
      return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : levels[levels.length - 1]
    }
  }

  _onWheel(e) {
    e.preventDefault()
    e.stopPropagation()

    const delta = this._scrollInverted ? e.deltaY : -e.deltaY
    const zoomIn = delta > 0

    const newPPS = this._snapToLevel(this._pixelsPerSecond, zoomIn)
    if (newPPS !== this._pixelsPerSecond) {
      this._pixelsPerSecond = newPPS
      this._updateWidth()
      this._draw()
      this._emitChange()
    }
  }

  // --- Rendering ---

  _updateWidth() {
    const width = this.width
    this.style.width = `${width}px`

    if (this._canvas) {
      const dpr = devicePixelRatio || 1
      const height = this.clientHeight || 24
      this._canvas.width = Math.floor(width * dpr)
      this._canvas.height = Math.floor(height * dpr)
      this._canvas.style.width = `${width}px`
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
  }

  _chooseTickInterval() {
    // Choose tick interval based on PPS to keep ticks visually spaced ~60-120px apart
    const targetPixelSpacing = 80
    const rawInterval = targetPixelSpacing / this._pixelsPerSecond

    // Nice intervals for time (in seconds)
    const niceIntervals = [
      1 / 120,   // 1 frame at 120fps (for very high zoom)
      1 / 60,    // 1 frame at 60fps
      1 / 30,    // 2 frames
      1 / 15,    // 4 frames  
      1 / 10,    // 6 frames
      0.1,     // 100ms
      0.2,     // 200ms
      0.25,    // 250ms (quarter second)
      0.5,     // 500ms
      1,       // 1s
      2,       // 2s
      5,       // 5s
      10,      // 10s
      15,      // 15s
      30,      // 30s
      60       // 1min
    ]

    for (const interval of niceIntervals) {
      if (interval >= rawInterval) return interval
    }
    return niceIntervals[niceIntervals.length - 1]
  }

  _formatTime(seconds) {
    if (seconds < 0.1) {
      // Show as frames (assuming 60fps)
      const frames = Math.round(seconds * 60)
      return `${frames}f`
    } else if (seconds < 1) {
      // Show as milliseconds
      return `${Math.round(seconds * 1000)}ms`
    } else if (seconds < 60) {
      // Show as seconds
      return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`
    } else {
      // Show as minutes:seconds
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
  }

  _draw() {
    if (!this._ctx) return

    const ctx = this._ctx
    const width = this.width
    const height = this.clientHeight || 24

    ctx.clearRect(0, 0, width, height)

    const majorInterval = this._chooseTickInterval()
    const minorInterval = majorInterval / 4  // 4 minor ticks between major ticks

    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textBaseline = 'top'

    const start = this._minValue
    const end = this._maxValue

    // Draw minor ticks first
    ctx.strokeStyle = '#3a3a4a'
    ctx.lineWidth = 1
    for (let t = start; t <= end; t += minorInterval) {
      const x = (t - this._minValue) * this._pixelsPerSecond
      if (x < 0 || x > width) continue

      // Skip if this is a major tick position
      const isMajor = Math.abs(Math.round(t / majorInterval) * majorInterval - t) < minorInterval * 0.1
      if (isMajor) continue

      ctx.beginPath()
      ctx.moveTo(x, height)
      ctx.lineTo(x, height - 6)
      ctx.stroke()
    }

    // Draw major ticks and labels
    ctx.strokeStyle = '#6a6a8a'
    ctx.fillStyle = '#8a8aaa'
    ctx.lineWidth = 1

    for (let t = start; t <= end; t += majorInterval) {
      const x = (t - this._minValue) * this._pixelsPerSecond
      if (x < 0 || x > width) continue

      ctx.beginPath()
      ctx.moveTo(x, height)
      ctx.lineTo(x, height - 14)
      ctx.stroke()

      const label = this._formatTime(t)
      ctx.textAlign = x < 20 ? 'left' : 'center'
      ctx.fillText(label, x, 2)
    }
  }

  // --- Events ---

  _emitChange() {
    this.dispatchEvent(new CustomEvent('pps-change', {
      detail: {
        pixelsPerSecond: this._pixelsPerSecond,
        width: this.width
      },
      bubbles: true
    }))
  }

  // --- Public API ---

  setPixelsPerSecond(pps) {
    const clampedPPS = Math.max(
      this._snapLevels[this._snapLevels.length - 1] || 1,
      Math.min(this._snapLevels[0] || 10000, pps)
    )
    this.pixelsPerSecond = clampedPPS
  }

  /** Convert time to X position */
  timeToX(time) {
    return (time - this._minValue) * this._pixelsPerSecond
  }

  /** Convert X position to time */
  xToTime(x) {
    return x / this._pixelsPerSecond + this._minValue
  }
}

customElements.define('timeline-ruler', TimelineRuler)


/**
 * View Timeline Component
 * 
 * Animation timeline with tracks, keyframes, playhead, and playback controls.
 * 
 * Features:
 * - Track list with selection (click/shift+click)
 * - Scalable ruler with snap-to-level zoom
 * - Playhead with scrubbing
 * - Playback controls (play/pause/stop/loop)
 * - Keyframes with selection, drag & drop (with snapping)
 * - Marquee selection for keyframes
 * 
 * API:
 * - addTrack(id, name) / removeTrack(id) / getTracks()
 * - addKeyframe(trackId, time, value) / removeKeyframe(id) / moveKeyframe(id, time)
 * - play() / pause() / stop() / setCurrentTime(time)
 * 
 * Callbacks (override these):
 * - onKeyframeAdded(trackId, time, value)
 * - onKeyframeMoved(keyframeId, oldTime, newTime)
 * - onKeyframeDeleted(keyframeId)
 * - onTimeChanged(time)
 */
export class ViewTimeline extends HTMLElement {
  // Forward these attributes to the internal timeline-ruler
  static RULER_ATTRIBUTES = ['min-value', 'max-value', 'pixels-per-second', 'snap-levels', 'scroll-inverted']

  static get observedAttributes() {
    return ViewTimeline.RULER_ATTRIBUTES
  }

  constructor() {
    super()
    this._headerControlsElement = null

    // State
    this._tracks = new Map()  // trackId -> { name, keyframes: Map<keyframeId, { time, value }> }
    this._selectedTracks = new Set()
    this._selectedKeyframes = new Set()
    this._keyframeIdCounter = 0

    // Playback
    this._currentTime = 0
    this._playing = false
    this._loop = false
    this._lastFrameTime = 0
    this._animationFrameId = null

    // Interaction state
    this._isDraggingPlayhead = false
    this._isDraggingKeyframe = false
    this._draggedKeyframe = null
    this._dragStartTime = 0
    this._isMarqueeSelecting = false
    this._marqueeStart = { x: 0, y: 0 }
    this._marqueeCurrent = { x: 0, y: 0 }

    // Bind methods
    this._onPlayClick = this._onPlayClick.bind(this)
    this._onStopClick = this._onStopClick.bind(this)
    this._onAddKeyClick = this._onAddKeyClick.bind(this)
    this._onDeleteKeyClick = this._onDeleteKeyClick.bind(this)
    this._onLoopChange = this._onLoopChange.bind(this)
    this._onRulerMouseDown = this._onRulerMouseDown.bind(this)
    this._onTracksMouseDown = this._onTracksMouseDown.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onKeyDown = this._onKeyDown.bind(this)
    this._playbackLoop = this._playbackLoop.bind(this)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    
    // Forward ruler attributes to internal ruler
    if (ViewTimeline.RULER_ATTRIBUTES.includes(name) && this._ruler) {
      if (newValue === null) {
        this._ruler.removeAttribute(name)
      } else {
        this._ruler.setAttribute(name, newValue)
      }
    }
  }

  connectedCallback() {
    this._buildDOM()
    this._forwardInitialAttributes()
    this._mountHeaderControls()
    this._setupEventListeners()
    this._setupResizeObserver()
    this._mockData()
    this._updatePlayhead()
  }

  disconnectedCallback() {
    this._unmountHeaderControls()
    this._removeEventListeners()
    this._stopPlayback()
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
  }

  /** Forward initial attributes to ruler after DOM is built */
  _forwardInitialAttributes() {
    for (const attr of ViewTimeline.RULER_ATTRIBUTES) {
      if (this.hasAttribute(attr)) {
        this._ruler.setAttribute(attr, this.getAttribute(attr))
      }
    }
  }

  // --- DOM Construction ---

  _buildDOM() {
    // Default values - can be overridden by attributes on view-timeline
    this.innerHTML = `
      <div class="timeline-viewport">
        <div class="timeline-scroll-area">
          <div class="timeline-header">
            <div class="corner-cell">Tracks</div>
            <timeline-ruler 
              min-value="0" 
              max-value="60" 
              pixels-per-second="100">
            </timeline-ruler>
          </div>
          <div class="timeline-body">
            <div class="track-labels"></div>
            <div class="tracks-area">
              <div class="playhead" style="left: 0px;"></div>
            </div>
          </div>
        </div>
        <div class="selection-marquee" style="display: none;"></div>
      </div>
    `

    // Cache element references
    this._viewport = this.querySelector('.timeline-viewport')
    this._scrollArea = this.querySelector('.timeline-scroll-area')
    this._ruler = this.querySelector('timeline-ruler')
    this._trackLabels = this.querySelector('.track-labels')
    this._tracksArea = this.querySelector('.tracks-area')
    this._playhead = this.querySelector('.playhead')
    this._marquee = this.querySelector('.selection-marquee')

    // Sync width with ruler
    this._ruler.addEventListener('pps-change', (e) => {
      const { width } = e.detail
      this._updateTracksWidth(width)
      this._updatePlayhead()
      this._updateAllKeyframePositions()
    })

    this._updateTracksWidth(this._ruler.width)
  }

  /** Update tracks area width - ensures minimum viewport width */
  _updateTracksWidth(rulerWidth) {
    if (!this._viewport || !this._tracksArea) return
    
    // Get the available width (viewport width minus label column)
    const viewportWidth = this._viewport.clientWidth
    const labelWidth = 120 // --timeline-label-width
    const availableWidth = Math.max(0, viewportWidth - labelWidth)
    
    // Use the larger of ruler width or available width
    const tracksWidth = Math.max(rulerWidth, availableWidth)
    this._tracksArea.style.width = `${tracksWidth}px`
  }

  /** Setup resize observer to update tracks width when viewport resizes */
  _setupResizeObserver() {
    this._resizeObserver = new ResizeObserver(() => {
      if (this._ruler) {
        this._updateTracksWidth(this._ruler.width)
      }
    })
    this._resizeObserver.observe(this._viewport)
  }

  // --- Header Controls (Template Pattern) ---

  _mountHeaderControls() {
    const viewTag = this.tagName.toLowerCase()
    const template = document.getElementById(viewTag)

    if (template && this.parentElement) {
      const content = template.content.cloneNode(true)
      const headerControls = content.querySelector('[slot="header-controls"]')

      if (headerControls) {
        this._headerControlsElement = headerControls
        this.parentElement.appendChild(headerControls)

        // Setup button handlers
        const playBtn = this._queryHeaderControl('[data-action="play"]')
        const stopBtn = this._queryHeaderControl('[data-action="stop"]')
        const addKeyBtn = this._queryHeaderControl('[data-action="add-key"]')
        const deleteKeyBtn = this._queryHeaderControl('[data-action="delete-key"]')
        const loopCheckbox = this._queryHeaderControl('[data-action="loop"]')
        this._timeDisplay = this._queryHeaderControl('[data-element="time-display"]')

        if (playBtn) playBtn.addEventListener('click', this._onPlayClick)
        if (stopBtn) stopBtn.addEventListener('click', this._onStopClick)
        if (addKeyBtn) addKeyBtn.addEventListener('click', this._onAddKeyClick)
        if (deleteKeyBtn) deleteKeyBtn.addEventListener('click', this._onDeleteKeyClick)
        if (loopCheckbox) loopCheckbox.addEventListener('change', this._onLoopChange)
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

  // --- Event Listeners ---

  _setupEventListeners() {
    this._ruler.addEventListener('mousedown', this._onRulerMouseDown)
    this._tracksArea.addEventListener('mousedown', this._onTracksMouseDown)
    document.addEventListener('mousemove', this._onMouseMove)
    document.addEventListener('mouseup', this._onMouseUp)
    document.addEventListener('keydown', this._onKeyDown)
  }

  _removeEventListeners() {
    this._ruler?.removeEventListener('mousedown', this._onRulerMouseDown)
    this._tracksArea?.removeEventListener('mousedown', this._onTracksMouseDown)
    document.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('mouseup', this._onMouseUp)
    document.removeEventListener('keydown', this._onKeyDown)
  }

  // --- Header Button Handlers ---

  _onPlayClick() {
    if (this._playing) {
      this.pause()
    } else {
      this.play()
    }
  }

  _onStopClick() {
    this.stop()
  }

  _onAddKeyClick() {
    // Add keyframe at current time for all selected tracks
    if (this._selectedTracks.size === 0) {
      console.log('No tracks selected')
      return
    }

    for (const trackId of this._selectedTracks) {
      const value = this._onKeyframeAdded(trackId, this._currentTime)
      this.addKeyframe(trackId, this._currentTime, value)
    }
  }

  _onDeleteKeyClick() {
    this._deleteSelectedKeyframes()
  }

  _onLoopChange(e) {
    this._loop = e.target.checked
  }

  // --- Mouse Handlers ---

  _onRulerMouseDown(e) {
    e.preventDefault()
    this._isDraggingPlayhead = true
    this._scrubToPosition(e)
  }

  _onTracksMouseDown(e) {
    const target = e.target

    // Check if clicking on a keyframe
    if (target.classList.contains('keyframe')) {
      this._handleKeyframeClick(e, target)
      return
    }

    // Check if clicking on a track row (for playhead scrubbing or marquee)
    const trackRow = target.closest('.track-row')
    if (trackRow) {
      if (e.shiftKey) {
        // Start marquee selection
        this._startMarqueeSelection(e)
      } else {
        // Scrub playhead
        this._isDraggingPlayhead = true
        this._scrubToPosition(e)
        // Deselect keyframes when clicking empty area
        this._deselectAllKeyframes()
      }
    }
  }

  _handleKeyframeClick(e, keyframeEl) {
    e.stopPropagation()
    const keyframeId = keyframeEl.dataset.keyframeId

    if (e.shiftKey) {
      // Add to selection
      this._toggleKeyframeSelection(keyframeId)
    } else {
      // Single select (deselect others)
      if (!this._selectedKeyframes.has(keyframeId)) {
        this._deselectAllKeyframes()
        this._selectKeyframe(keyframeId)
      }
      // Start dragging
      this._startKeyframeDrag(e, keyframeEl)
    }
  }

  _onMouseMove(e) {
    if (this._isDraggingPlayhead) {
      this._scrubToPosition(e)
    } else if (this._isDraggingKeyframe) {
      this._dragKeyframe(e)
    } else if (this._isMarqueeSelecting) {
      this._updateMarquee(e)
    }
  }

  _onMouseUp(e) {
    if (this._isDraggingPlayhead) {
      this._isDraggingPlayhead = false
    }

    if (this._isDraggingKeyframe) {
      this._endKeyframeDrag(e)
    }

    if (this._isMarqueeSelecting) {
      this._endMarqueeSelection(e)
    }
  }

  _onKeyDown(e) {
    // Delete key removes selected keyframes
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this._selectedKeyframes.size > 0) {
        e.preventDefault()
        this._deleteSelectedKeyframes()
      }
    }

    // Escape deselects all
    if (e.key === 'Escape') {
      this._deselectAllKeyframes()
      this._deselectAllTracks()
    }

    // Space toggles playback
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault()
      if (this._playing) {
        this.pause()
      } else {
        this.play()
      }
    }
  }

  // --- Playhead Scrubbing ---

  _scrubToPosition(e) {
    const rect = this._tracksArea.getBoundingClientRect()
    const scrollLeft = this._viewport.scrollLeft
    const x = e.clientX - rect.left + scrollLeft
    const time = this._ruler.xToTime(x)
    this.setCurrentTime(Math.max(this._ruler.minValue, Math.min(this._ruler.maxValue, time)))
  }

  // --- Track Selection ---

  _onTrackLabelClick(e, trackId) {
    if (e.shiftKey) {
      this._toggleTrackSelection(trackId)
    } else {
      this._deselectAllTracks()
      this._selectTrack(trackId)
    }
  }

  _selectTrack(trackId) {
    this._selectedTracks.add(trackId)
    this._updateTrackVisuals(trackId)
  }

  _deselectTrack(trackId) {
    this._selectedTracks.delete(trackId)
    this._updateTrackVisuals(trackId)
  }

  _toggleTrackSelection(trackId) {
    if (this._selectedTracks.has(trackId)) {
      this._deselectTrack(trackId)
    } else {
      this._selectTrack(trackId)
    }
  }

  _deselectAllTracks() {
    for (const trackId of this._selectedTracks) {
      this._selectedTracks.delete(trackId)
      this._updateTrackVisuals(trackId)
    }
  }

  _updateTrackVisuals(trackId) {
    const label = this._trackLabels.querySelector(`[data-track-id="${trackId}"]`)
    const row = this._tracksArea.querySelector(`[data-track-id="${trackId}"]`)
    const isSelected = this._selectedTracks.has(trackId)

    if (label) label.classList.toggle('selected', isSelected)
    if (row) row.classList.toggle('selected', isSelected)
  }

  // --- Keyframe Selection ---

  _selectKeyframe(keyframeId) {
    this._selectedKeyframes.add(keyframeId)
    this._updateKeyframeVisual(keyframeId)
  }

  _deselectKeyframe(keyframeId) {
    this._selectedKeyframes.delete(keyframeId)
    this._updateKeyframeVisual(keyframeId)
  }

  _toggleKeyframeSelection(keyframeId) {
    if (this._selectedKeyframes.has(keyframeId)) {
      this._deselectKeyframe(keyframeId)
    } else {
      this._selectKeyframe(keyframeId)
    }
  }

  _deselectAllKeyframes() {
    for (const keyframeId of this._selectedKeyframes) {
      this._selectedKeyframes.delete(keyframeId)
      this._updateKeyframeVisual(keyframeId)
    }
  }

  _updateKeyframeVisual(keyframeId) {
    const el = this._tracksArea.querySelector(`[data-keyframe-id="${keyframeId}"]`)
    if (el) {
      el.classList.toggle('selected', this._selectedKeyframes.has(keyframeId))
    }
  }

  // --- Keyframe Dragging ---

  _startKeyframeDrag(e, keyframeEl) {
    this._isDraggingKeyframe = true
    this._draggedKeyframe = keyframeEl
    this._dragStartTime = parseFloat(keyframeEl.dataset.time)
    
    // Store initial times for all selected keyframes
    this._dragInitialTimes = new Map()
    for (const keyframeId of this._selectedKeyframes) {
      const el = this._tracksArea.querySelector(`[data-keyframe-id="${keyframeId}"]`)
      if (el) {
        this._dragInitialTimes.set(keyframeId, parseFloat(el.dataset.time))
        el.classList.add('dragging')
      }
    }
  }

  _dragKeyframe(e) {
    if (!this._draggedKeyframe) return

    const rect = this._tracksArea.getBoundingClientRect()
    const scrollLeft = this._viewport.scrollLeft
    const x = e.clientX - rect.left + scrollLeft
    let newTime = this._ruler.xToTime(x)

    // Snap to grid
    const snapInterval = this._ruler.snapInterval
    newTime = Math.round(newTime / snapInterval) * snapInterval

    // Calculate time delta from the dragged keyframe's original position
    const timeDelta = newTime - this._dragStartTime

    // Update all selected keyframes
    for (const [keyframeId, initialTime] of this._dragInitialTimes) {
      let keyframeNewTime = initialTime + timeDelta
      
      // Clamp to bounds
      keyframeNewTime = Math.max(this._ruler.minValue, Math.min(this._ruler.maxValue, keyframeNewTime))
      
      // Update visual position
      const el = this._tracksArea.querySelector(`[data-keyframe-id="${keyframeId}"]`)
      if (el) {
        const newX = this._ruler.timeToX(keyframeNewTime)
        el.style.left = `${newX}px`
        el.dataset.time = keyframeNewTime
      }
    }
  }

  _endKeyframeDrag(e) {
    if (!this._draggedKeyframe) return

    // Calculate final time delta
    const finalTime = parseFloat(this._draggedKeyframe.dataset.time)
    const timeDelta = finalTime - this._dragStartTime
    const hasMoved = Math.abs(timeDelta) > 0.001

    // Update all selected keyframes
    for (const [keyframeId, initialTime] of this._dragInitialTimes) {
      const el = this._tracksArea.querySelector(`[data-keyframe-id="${keyframeId}"]`)
      if (el) {
        el.classList.remove('dragging')
        
        if (hasMoved) {
          const newTime = parseFloat(el.dataset.time)
          // Update internal state
          const trackId = el.dataset.trackId
          const track = this._tracks.get(trackId)
          if (track) {
            const keyframe = track.keyframes.get(keyframeId)
            if (keyframe) {
              const oldTime = keyframe.time
              keyframe.time = newTime
              this._onKeyframeMoved(keyframeId, oldTime, newTime)
            }
          }
        }
      }
    }

    this._isDraggingKeyframe = false
    this._draggedKeyframe = null
    this._dragInitialTimes = null
  }

  // --- Marquee Selection ---

  _startMarqueeSelection(e) {
    this._isMarqueeSelecting = true
    // Use scroll-area as reference since marquee is positioned inside viewport
    const scrollAreaRect = this._scrollArea.getBoundingClientRect()
    const viewportRect = this._viewport.getBoundingClientRect()
    this._marqueeStart = {
      x: e.clientX - viewportRect.left + this._viewport.scrollLeft,
      y: e.clientY - viewportRect.top + this._viewport.scrollTop
    }
    this._marqueeCurrent = { ...this._marqueeStart }
    this._marquee.style.display = 'block'
    this._updateMarqueeVisual()
  }

  _updateMarquee(e) {
    const viewportRect = this._viewport.getBoundingClientRect()
    this._marqueeCurrent = {
      x: e.clientX - viewportRect.left + this._viewport.scrollLeft,
      y: e.clientY - viewportRect.top + this._viewport.scrollTop
    }
    this._updateMarqueeVisual()
  }

  _updateMarqueeVisual() {
    const x1 = Math.min(this._marqueeStart.x, this._marqueeCurrent.x)
    const y1 = Math.min(this._marqueeStart.y, this._marqueeCurrent.y)
    const x2 = Math.max(this._marqueeStart.x, this._marqueeCurrent.x)
    const y2 = Math.max(this._marqueeStart.y, this._marqueeCurrent.y)

    this._marquee.style.left = `${x1}px`
    this._marquee.style.top = `${y1}px`
    this._marquee.style.width = `${x2 - x1}px`
    this._marquee.style.height = `${y2 - y1}px`
  }

  _endMarqueeSelection(e) {
    this._isMarqueeSelecting = false
    this._marquee.style.display = 'none'

    // Find keyframes inside marquee (coordinates are relative to viewport with scroll)
    const x1 = Math.min(this._marqueeStart.x, this._marqueeCurrent.x)
    const y1 = Math.min(this._marqueeStart.y, this._marqueeCurrent.y)
    const x2 = Math.max(this._marqueeStart.x, this._marqueeCurrent.x)
    const y2 = Math.max(this._marqueeStart.y, this._marqueeCurrent.y)

    const viewportRect = this._viewport.getBoundingClientRect()
    const keyframeEls = this._tracksArea.querySelectorAll('.keyframe')

    for (const el of keyframeEls) {
      const elRect = el.getBoundingClientRect()
      // Calculate keyframe center position relative to viewport with scroll
      const elX = elRect.left - viewportRect.left + this._viewport.scrollLeft + elRect.width / 2
      const elY = elRect.top - viewportRect.top + this._viewport.scrollTop + elRect.height / 2

      if (elX >= x1 && elX <= x2 && elY >= y1 && elY <= y2) {
        this._selectKeyframe(el.dataset.keyframeId)
      }
    }
  }

  // --- Keyframe Management ---

  _deleteSelectedKeyframes() {
    for (const keyframeId of [...this._selectedKeyframes]) {
      this.removeKeyframe(keyframeId)
    }
  }

  // --- Playback ---

  play() {
    if (this._playing) return
    this._playing = true
    this._lastFrameTime = performance.now()
    this._animationFrameId = requestAnimationFrame(this._playbackLoop)
    this._updatePlayButton()
  }

  pause() {
    this._playing = false
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId)
      this._animationFrameId = null
    }
    this._updatePlayButton()
  }

  stop() {
    this.pause()
    this.setCurrentTime(this._ruler.minValue)
  }

  _stopPlayback() {
    this._playing = false
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId)
      this._animationFrameId = null
    }
  }

  _playbackLoop(now) {
    if (!this._playing) return

    const dt = (now - this._lastFrameTime) / 1000
    this._lastFrameTime = now

    let newTime = this._currentTime + dt

    if (newTime >= this._ruler.maxValue) {
      if (this._loop) {
        newTime = this._ruler.minValue
      } else {
        newTime = this._ruler.maxValue
        this.pause()
      }
    }

    this.setCurrentTime(newTime)

    if (this._playing) {
      this._animationFrameId = requestAnimationFrame(this._playbackLoop)
    }
  }

  _updatePlayButton() {
    const playBtn = this._queryHeaderControl('[data-action="play"]')
    if (playBtn) {
      playBtn.textContent = this._playing ? '⏸ Pause' : '▶ Play'
      playBtn.classList.toggle('playing', this._playing)
    }
  }

  // --- Playhead & Time ---

  setCurrentTime(time) {
    this._currentTime = time
    this._updatePlayhead()
    this._updateTimeDisplay()
    this._onTimeChanged(time)
  }

  getCurrentTime() {
    return this._currentTime
  }

  _updatePlayhead() {
    if (!this._playhead || !this._ruler) return
    const x = this._ruler.timeToX(this._currentTime)
    this._playhead.style.left = `${x}px`
  }

  _updateTimeDisplay() {
    if (this._timeDisplay) {
      this._timeDisplay.textContent = `${this._currentTime.toFixed(2)}s`
    }
  }

  // --- Track API ---

  addTrack(id, name) {
    if (this._tracks.has(id)) return id

    this._tracks.set(id, {
      name,
      keyframes: new Map()
    })

    this._renderTrack(id, name)
    return id
  }

  removeTrack(id) {
    if (!this._tracks.has(id)) return

    this._tracks.delete(id)
    this._selectedTracks.delete(id)

    // Remove DOM elements
    const label = this._trackLabels.querySelector(`[data-track-id="${id}"]`)
    const row = this._tracksArea.querySelector(`[data-track-id="${id}"]`)
    label?.remove()
    row?.remove()
  }

  getTrack(id) {
    return this._tracks.get(id)
  }

  getTracks() {
    return this._tracks
  }

  _renderTrack(id, name) {
    const index = this._tracks.size - 1

    // Create label
    const label = document.createElement('div')
    label.className = 'track-label'
    label.dataset.trackId = id
    label.innerHTML = `<span class="track-index">${index.toString().padStart(2, '0')}</span>${name}`
    label.addEventListener('click', (e) => this._onTrackLabelClick(e, id))
    this._trackLabels.appendChild(label)

    // Create track row (insert before playhead)
    const row = document.createElement('div')
    row.className = 'track-row'
    row.dataset.trackId = id
    this._tracksArea.insertBefore(row, this._playhead)
  }

  // --- Keyframe API ---

  addKeyframe(trackId, time, value) {
    const track = this._tracks.get(trackId)
    if (!track) return null

    const keyframeId = `kf_${++this._keyframeIdCounter}`
    track.keyframes.set(keyframeId, { time, value })

    this._renderKeyframe(trackId, keyframeId, time, value)
    return keyframeId
  }

  removeKeyframe(keyframeId) {
    // Find and remove from track
    for (const [trackId, track] of this._tracks) {
      if (track.keyframes.has(keyframeId)) {
        track.keyframes.delete(keyframeId)
        this._selectedKeyframes.delete(keyframeId)

        // Remove DOM element
        const el = this._tracksArea.querySelector(`[data-keyframe-id="${keyframeId}"]`)
        el?.remove()

        this._onKeyframeDeleted(keyframeId)
        return
      }
    }
  }

  moveKeyframe(keyframeId, newTime) {
    for (const [trackId, track] of this._tracks) {
      const keyframe = track.keyframes.get(keyframeId)
      if (keyframe) {
        const oldTime = keyframe.time
        keyframe.time = newTime

        // Update DOM
        const el = this._tracksArea.querySelector(`[data-keyframe-id="${keyframeId}"]`)
        if (el) {
          el.style.left = `${this._ruler.timeToX(newTime)}px`
          el.dataset.time = newTime
        }

        this._onKeyframeMoved(keyframeId, oldTime, newTime)
        return
      }
    }
  }

  getKeyframe(keyframeId) {
    for (const [trackId, track] of this._tracks) {
      const keyframe = track.keyframes.get(keyframeId)
      if (keyframe) {
        return { trackId, ...keyframe }
      }
    }
    return null
  }

  _renderKeyframe(trackId, keyframeId, time, value) {
    const row = this._tracksArea.querySelector(`[data-track-id="${trackId}"]`)
    if (!row) return

    const el = document.createElement('div')
    el.className = 'keyframe'
    el.dataset.keyframeId = keyframeId
    el.dataset.trackId = trackId
    el.dataset.time = time
    el.style.left = `${this._ruler.timeToX(time)}px`
    el.title = `t=${time.toFixed(3)}, value=${value}`

    row.appendChild(el)
  }

  _updateAllKeyframePositions() {
    for (const [trackId, track] of this._tracks) {
      for (const [keyframeId, keyframe] of track.keyframes) {
        const el = this._tracksArea.querySelector(`[data-keyframe-id="${keyframeId}"]`)
        if (el) {
          el.style.left = `${this._ruler.timeToX(keyframe.time)}px`
        }
      }
    }
  }

  // --- Callbacks (Override these) ---

  /**
   * Called when a keyframe is about to be added.
   * Override to provide custom value or perform additional logic.
   * @param {string} trackId 
   * @param {number} time 
   * @returns {*} The value to store for this keyframe
   */
  _onKeyframeAdded(trackId, time) {
    const value = Math.round(Math.random() * 360 - 180)
    console.log(`Keyframe added: track=${trackId}, time=${time.toFixed(3)}, value=${value}`)
    return value
  }

  /**
   * Called when a keyframe is moved.
   * @param {string} keyframeId 
   * @param {number} oldTime 
   * @param {number} newTime 
   */
  _onKeyframeMoved(keyframeId, oldTime, newTime) {
    console.log(`Keyframe moved: id=${keyframeId}, ${oldTime.toFixed(3)} -> ${newTime.toFixed(3)}`)
  }

  /**
   * Called when a keyframe is deleted.
   * @param {string} keyframeId 
   */
  _onKeyframeDeleted(keyframeId) {
    console.log(`Keyframe deleted: id=${keyframeId}`)
  }

  /**
   * Called on each frame during playback and when time is changed.
   * @param {number} time 
   */
  _onTimeChanged(time) {
    // Override to drive external animations
  }

  // --- Mock Data ---

  _mockData() {
    const boneList = [
      "root", "spine", "chest", "neck", "head",
      "shoulder_l", "arm_upper_l", "arm_lower_l", "hand_l",
      "shoulder_r", "arm_upper_r", "arm_lower_r", "hand_r",
      "hip_l", "leg_upper_l", "leg_lower_l", "foot_l",
      "hip_r", "leg_upper_r", "leg_lower_r", "foot_r"
    ]

    for (const bone of boneList) {
      this.addTrack(bone, bone)
    }
  }

  // --- Public API ---

  get ruler() {
    return this._ruler
  }

  setTimeRange(min, max) {
    if (this._ruler) {
      this._ruler.setAttribute('min-value', min)
      this._ruler.setAttribute('max-value', max)
    }
  }

  setPixelsPerSecond(pps) {
    if (this._ruler) {
      this._ruler.setPixelsPerSecond(pps)
    }
  }
}

customElements.define('view-timeline', ViewTimeline)
