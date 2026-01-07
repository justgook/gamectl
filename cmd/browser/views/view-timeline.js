export class ViewTimeline extends HTMLElement {
  timeline = {
    pixelsPerSecond: 100,
    viewStartTime: 0,
    // HARD LIMITS
    minTime: 0,          // e.g. frame 0
    maxTime: 60,         // e.g. 60 seconds (or compute from data)

    // ZOOM LIMITS
    minPixelsPerSecond: 10,
    maxPixelsPerSecond: 800,
  }

  _mockData() {
    const boneList = [
      "root", "spine", "chest", "neck", "head",
      "shoulder_l", "arm_upper_l", "arm_lower_l", "hand_l",
      "shoulder_r", "arm_upper_r", "arm_lower_r", "hand_r",
      "hip_l", "leg_upper_l", "leg_lower_l", "foot_l",
      "hip_r", "leg_upper_r", "leg_lower_r", "foot_r"
    ]
    const fragment = new DocumentFragment()
    for (const bone of boneList) {
      const row = document.createElement("tr")
      row.innerHTML = `
        <th>${bone}</th>
        <td>Cell Data</td>
        `
      fragment.appendChild(row)
    }

    this.querySelector("tbody").appendChild(fragment)
  }

  async connectedCallback() {
    const html = await fetch(
      new URL('./templates/timeline.html', import.meta.url)
    ).then(r => r.text())

    this.innerHTML = html
    this._mountHeaderControls()
    this._mockData()
    requestAnimationFrame(() => {
      this._resizeRulerCanvas()
      this._clampViewStartTime()
      this._drawRuler()
      this._attachRulerEvents()
      this._observeRulerResize()
    })
  }

  disconnectedCallback() {
    // 1. Remove header controls (you already have this)
    this._unmountHeaderControls()
    // 2. Remove wheel listener from ruler canvas
    const canvas = this._getRulerCanvas()
    if (canvas && this._onRulerWheel) {
      canvas.removeEventListener('wheel', this._onRulerWheel)
      this._onRulerWheel = null
    }

    // 3. Disconnect ResizeObserver
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
  }

  _mountHeaderControls() {
    const headerControls = this.querySelector('[slot="header-controls"]')

    if (headerControls) {
      this._headerControlsElement = headerControls;
      this.parentElement.appendChild(headerControls);
    }
  }

  _unmountHeaderControls() {
    if (this._headerControlsElement && this._headerControlsElement.parentElement) {
      this._headerControlsElement.remove();
      this._headerControlsElement = null;
    }
  }

  // make as separate component ruler
  _attachRulerEvents() {
    const canvas = this._getRulerCanvas()
    canvas.addEventListener('wheel', this._onRulerWheel)
  }

  _onRulerWheel = e => {
    e.preventDefault()

    const canvas = this._getRulerCanvas()
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left

    const mouseTime =
      mouseX / this.timeline.pixelsPerSecond +
      this.timeline.viewStartTime

    // Zoom
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    let newPPS = this.timeline.pixelsPerSecond * zoomFactor

    // Clamp zoom
    newPPS = Math.min(
      Math.max(newPPS, this.timeline.minPixelsPerSecond),
      this.timeline.maxPixelsPerSecond
    )

    this.timeline.pixelsPerSecond = newPPS

    // Keep mouse anchored
    this.timeline.viewStartTime =
      mouseTime - mouseX / newPPS

    // Clamp scroll AFTER zoom
    this._clampViewStartTime()

    this._drawRuler()
  }
  _observeRulerResize() {
    const canvas = this._getRulerCanvas()
    const th = canvas.closest('th')

    this._resizeObserver = new ResizeObserver(() => {
      this._resizeRulerCanvas()
      this._clampViewStartTime()
      this._drawRuler()
    })

    this._resizeObserver.observe(th)
  }

  _drawRuler() {
    const canvas = this._getRulerCanvas()
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const w = canvas.width / devicePixelRatio
    const h = canvas.height / devicePixelRatio

    ctx.clearRect(0, 0, w, h)
    ctx.font = '10px sans-serif'
    ctx.fillStyle = '#888'
    ctx.strokeStyle = '#555'

    const { pixelsPerSecond, viewStartTime } = this.timeline

    const timeToX = t => (t - viewStartTime) * pixelsPerSecond
    const xToTime = x => x / pixelsPerSecond + viewStartTime

    const tStart = viewStartTime
    const tEnd = xToTime(w)

    const step = this._chooseStep(pixelsPerSecond)
    const first = Math.floor(tStart / step) * step

    for (let t = first; t <= tEnd; t += step) {
      const x = timeToX(t)

      ctx.beginPath()
      ctx.moveTo(x, h)
      ctx.lineTo(x, 8)
      ctx.stroke()

      ctx.fillText(t.toFixed(2), x + 2, 10)
    }
  }
  _chooseStep(pxPerSec) {
    const targetPx = 100
    const raw = targetPx / pxPerSec
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]
    return steps.find(s => s >= raw) || steps.at(-1)
  }

  _getRulerCanvas() {
    return this.querySelector('canvas[data-element="ruler"]')
  }

  _resizeRulerCanvas() {
    const canvas = this._getRulerCanvas()
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  _getVisibleDuration() {
    const canvas = this._getRulerCanvas()
    const width = canvas.getBoundingClientRect().width
    return width / this.timeline.pixelsPerSecond
  }

  _clampViewStartTime() {
    const { minTime, maxTime } = this.timeline
    const visible = this._getVisibleDuration()

    const minStart = minTime
    const maxStart = Math.max(minTime, maxTime - visible)

    this.timeline.viewStartTime = Math.min(
      Math.max(this.timeline.viewStartTime, minStart),
      maxStart
    )
  }
}


customElements.define('view-timeline', ViewTimeline)
