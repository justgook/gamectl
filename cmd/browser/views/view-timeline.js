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
      1/120,   // 1 frame at 120fps (for very high zoom)
      1/60,    // 1 frame at 60fps
      1/30,    // 2 frames
      1/15,    // 4 frames  
      1/10,    // 6 frames
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
}

customElements.define('timeline-ruler', TimelineRuler)


/**
 * View Timeline Component
 * 
 * Container for animation timeline with track labels on left and scrollable
 * timeline area on right. The ruler controls the scale (pixels-per-second)
 * and all tracks scale with it.
 */
export class ViewTimeline extends HTMLElement {
  constructor() {
    super()
    this._headerControlsElement = null
  }

  async connectedCallback() {
    // Single scroll container with sticky header/labels - ONE scrollbar per axis
    this.innerHTML = `
      <div class="timeline-viewport">
        <div class="timeline-scroll-area">
          <!-- Header row: corner + ruler -->
          <div class="timeline-header">
            <div class="corner-cell">Tracks</div>
            <timeline-ruler 
              min-value="0" 
              max-value="60" 
              pixels-per-second="100">
            </timeline-ruler>
          </div>
          <!-- Body: labels column + tracks grid -->
          <div class="timeline-body">
            <div class="track-labels"></div>
            <div class="tracks-area"></div>
          </div>
        </div>
      </div>
      <style>
        .timeline-viewport {
          height: 100%;
          overflow: auto;
          background: var(--color-bg-secondary, #1a1a2e);
          border-radius: 4px;
        }

        .timeline-scroll-area {
          display: inline-block;
          min-width: 100%;
          min-height: 100%;
        }

        .timeline-header {
          display: flex;
          position: sticky;
          top: 0;
          z-index: 20;
          background: var(--color-bg-secondary, #1a1a2e);
          border-bottom: 1px solid var(--color-border, #2a2a3e);
        }

        .corner-cell {
          width: 120px;
          min-width: 120px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 500;
          color: var(--color-text-secondary, #8888aa);
          background: var(--color-bg-tertiary, #12121e);
          border-right: 1px solid var(--color-border, #2a2a3e);
          display: flex;
          align-items: center;
          position: sticky;
          left: 0;
          z-index: 30;
        }

        timeline-ruler {
          cursor: ew-resize;
        }

        .timeline-body {
          display: flex;
        }

        .track-labels {
          width: 120px;
          min-width: 120px;
          background: var(--color-bg-tertiary, #12121e);
          border-right: 1px solid var(--color-border, #2a2a3e);
          position: sticky;
          left: 0;
          z-index: 10;
        }

        .track-label {
          padding: 4px 8px;
          font-size: 11px;
          color: var(--color-text-primary, #ccccee);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          height: 24px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--color-border, #2a2a3e);
          box-sizing: border-box;
        }

        .track-label:hover {
          background: var(--color-bg-hover, #2a2a3e);
        }

        .tracks-area {
          flex: 1;
        }

        .track-row {
          height: 24px;
          border-bottom: 1px solid var(--color-border, #2a2a3e);
          position: relative;
          box-sizing: border-box;
        }

        .track-row:nth-child(even) {
          background: rgba(255, 255, 255, 0.02);
        }
      </style>
    `

    this._setupComponents()
    this._mountHeaderControls()
    this._mockData()
  }

  disconnectedCallback() {
    this._unmountHeaderControls()
  }

  _setupComponents() {
    const ruler = this.querySelector('timeline-ruler')
    const tracksArea = this.querySelector('.tracks-area')

    // Update tracks width when ruler PPS changes
    ruler.addEventListener('pps-change', (e) => {
      const { width, pixelsPerSecond } = e.detail
      tracksArea.style.width = `${width}px`
      console.log('PPS changed:', pixelsPerSecond, 'Width:', width)
    })

    // Set initial width
    tracksArea.style.width = `${ruler.width}px`
  }

  _mockData() {
    const boneList = [
      "root", "spine", "chest", "neck", "head",
      "shoulder_l", "arm_upper_l", "arm_lower_l", "hand_l",
      "shoulder_r", "arm_upper_r", "arm_lower_r", "hand_r",
      "hip_l", "leg_upper_l", "leg_lower_l", "foot_l",
      "hip_r", "leg_upper_r", "leg_lower_r", "foot_r"
    ]

    const trackLabels = this.querySelector('.track-labels')
    const tracksArea = this.querySelector('.tracks-area')

    const labelsFragment = document.createDocumentFragment()
    const tracksFragment = document.createDocumentFragment()

    for (const bone of boneList) {
      // Create label
      const label = document.createElement('div')
      label.className = 'track-label'
      label.textContent = bone
      labelsFragment.appendChild(label)

      // Create track row
      const track = document.createElement('div')
      track.className = 'track-row'
      track.dataset.track = bone
      tracksFragment.appendChild(track)
    }

    trackLabels.appendChild(labelsFragment)
    tracksArea.appendChild(tracksFragment)
  }

  _mountHeaderControls() {
    const headerControls = this.querySelector('[slot="header-controls"]')
    if (headerControls) {
      this._headerControlsElement = headerControls
      this.parentElement?.appendChild(headerControls)
    }
  }

  _unmountHeaderControls() {
    if (this._headerControlsElement?.parentElement) {
      this._headerControlsElement.remove()
      this._headerControlsElement = null
    }
  }

  // --- Public API ---

  get ruler() {
    return this.querySelector('timeline-ruler')
  }

  setTimeRange(min, max) {
    const ruler = this.ruler
    if (ruler) {
      ruler.setAttribute('min-value', min)
      ruler.setAttribute('max-value', max)
    }
  }

  setPixelsPerSecond(pps) {
    const ruler = this.ruler
    if (ruler) {
      ruler.setPixelsPerSecond(pps)
    }
  }
}

customElements.define('view-timeline', ViewTimeline)
