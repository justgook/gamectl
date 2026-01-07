export class ViewTimeline extends HTMLElement {
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

    const ruler = this.querySelector('timeline-ruler')
    ruler.addEventListener('timeline-change', e => {
      const { pixelsPerSecond, viewStartTime } = e.detail

      // 🔥 THIS is your single source of truth
      // this._updateTracks(pixelsPerSecond, viewStartTime)
      console.log({ pixelsPerSecond, viewStartTime })
    })

    this._mockData()
  }

  disconnectedCallback() {
    this._unmountHeaderControls()
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
}


customElements.define('view-timeline', ViewTimeline)




export class TimelineRuler extends HTMLElement {
  static ZOOM_LEVELS = [25, 50, 100, 200, 400, 800]

  state = {
    pixelsPerSecond: 100,
    viewStartTime: 0,

    minTime: 0,
    maxTime: 60,
  }

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

    this.canvas = this.shadowRoot.querySelector('canvas')
    this.ctx = this.canvas.getContext('2d')

    this._resize()
    this._clamp()
    this._draw()

    this._onWheel = this._onWheel.bind(this)
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false })

    this._ro = new ResizeObserver(() => {
      this._resize()
      this._clamp()
      this._draw()
    })
    this._ro.observe(this)
  }

  disconnectedCallback() {
    this.canvas.removeEventListener('wheel', this._onWheel)
    this._ro.disconnect()
  }

  // ---------- core math ----------

  timeToX(t) {
    return (t - this.state.viewStartTime) * this.state.pixelsPerSecond
  }

  xToTime(x) {
    return x / this.state.pixelsPerSecond + this.state.viewStartTime
  }

  get visibleDuration() {
    return this.clientWidth / this.state.pixelsPerSecond
  }

  _clamp() {
    const { minTime, maxTime } = this.state
    const visible = this.visibleDuration

    const minStart = minTime
    const maxStart = Math.max(minTime, maxTime - visible)

    this.state.viewStartTime = Math.min(
      Math.max(this.state.viewStartTime, minStart),
      maxStart
    )
  }

  // ---------- zoom ----------

  _snapZoom(value) {
    return TimelineRuler.ZOOM_LEVELS.reduce((a, b) =>
      Math.abs(b - value) < Math.abs(a - value) ? b : a
    )
  }

  _onWheel(e) {
    e.preventDefault()

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseTime = this.xToTime(mouseX)

    const dir = e.deltaY < 0 ? 1.1 : 0.9
    let pps = this.state.pixelsPerSecond * dir
    pps = this._snapZoom(pps)

    if (pps === this.state.pixelsPerSecond) return

    this.state.pixelsPerSecond = pps
    this.state.viewStartTime = mouseTime - mouseX / pps

    this._clamp()
    this._resize()
    this._draw()
    this._emit()
  }

  // ---------- rendering ----------

  _resize() {
    const dpr = devicePixelRatio || 1
    const virtualWidth =
      (this.state.maxTime - this.state.minTime) *
      this.state.pixelsPerSecond

    this.style.width = `${virtualWidth}px`

    this.canvas.width = Math.floor(this.clientWidth * dpr)
    this.canvas.height = Math.floor(this.clientHeight * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  _chooseStep() {
    const targetPx = 100
    const raw = targetPx / this.state.pixelsPerSecond
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10]
    return steps.find(s => s >= raw) || steps.at(-1)
  }

  _draw() {
    const { ctx } = this
    const w = this.canvas.width / devicePixelRatio
    const h = this.canvas.height / devicePixelRatio

    ctx.clearRect(0, 0, w, h)
    ctx.font = '10px sans-serif'
    ctx.fillStyle = '#aaa'
    ctx.strokeStyle = '#666'

    const step = this._chooseStep()
    const minor = step / 5

    const start = Math.floor(this.state.viewStartTime / step) * step
    const end = this.xToTime(w)

    for (let t = start; t <= end; t += minor) {
      const x = this.timeToX(t)
      const isMajor = Math.abs(t % step) < 1e-6

      ctx.beginPath()
      ctx.moveTo(x, h)
      ctx.lineTo(x, isMajor ? 6 : 10)
      ctx.stroke()

      if (isMajor) {
        ctx.fillText(t.toFixed(2), x + 2, 10)
      }
    }
  }

  // ---------- events ----------

  _emit() {
    this.dispatchEvent(new CustomEvent('timeline-change', {
      detail: {
        pixelsPerSecond: this.state.pixelsPerSecond,
        viewStartTime: this.state.viewStartTime,
      },
      bubbles: true,
    }))
  }
}

customElements.define('timeline-ruler', TimelineRuler)

