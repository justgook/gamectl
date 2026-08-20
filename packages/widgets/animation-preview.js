const DIRECTIONS = new Set(["forward", "reverse", "ping-pong", "ping-pong-reverse"])

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

function requireObject(value, label) {
    assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
    return value
}

function requireExactKeys(value, keys, label) {
    const actual = Object.keys(value)
    assert(
        actual.length === keys.length && keys.every((key) => actual.includes(key)),
        `${label} must contain only ${keys.join(", ")}`,
    )
}

function validatePixels(pixels, width, height, label) {
    requireObject(pixels, label)
    requireExactKeys(pixels, ["width", "height", "data"], label)
    assert(Number.isInteger(pixels.width) && pixels.width === width, `${label}.width must match clip width`)
    assert(Number.isInteger(pixels.height) && pixels.height === height, `${label}.height must match clip height`)
    assert(Array.isArray(pixels.data), `${label}.data must be an array`)
    assert(pixels.data.length === width * height * 4, `${label}.data length must match RGBA dimensions`)
    pixels.data.forEach((channel, index) => {
        assert(
            Number.isInteger(channel) && channel >= 0 && channel <= 255,
            `${label}.data[${index}] must be an unsigned byte`,
        )
    })
}

function validateClip(clip) {
    requireObject(clip, "widget-animation-preview clip")
    requireExactKeys(clip, ["width", "height", "direction", "repeat", "frames"], "widget-animation-preview clip")
    assert(
        Number.isInteger(clip.width) && clip.width > 0,
        "widget-animation-preview clip.width must be a positive integer",
    )
    assert(
        Number.isInteger(clip.height) && clip.height > 0,
        "widget-animation-preview clip.height must be a positive integer",
    )
    assert(DIRECTIONS.has(clip.direction), `widget-animation-preview clip.direction ${clip.direction} is not supported`)
    assert(
        Number.isInteger(clip.repeat) && clip.repeat >= 0,
        "widget-animation-preview clip.repeat must be a non-negative integer",
    )
    assert(
        Array.isArray(clip.frames) && clip.frames.length > 0,
        "widget-animation-preview clip.frames must be a non-empty array",
    )
    clip.frames.forEach((frame, index) => {
        const label = `widget-animation-preview clip.frames[${index}]`
        requireObject(frame, label)
        requireExactKeys(frame, ["durationMs", "pixels"], label)
        assert(
            Number.isFinite(frame.durationMs) && frame.durationMs > 0,
            `${label}.durationMs must be positive and finite`,
        )
        validatePixels(frame.pixels, clip.width, clip.height, `${label}.pixels`)
    })
    return clip
}

function playbackOrder(frameCount, direction) {
    const forward = Array.from({ length: frameCount }, (_, index) => index)
    if (direction === "forward") return forward
    if (direction === "reverse") return [...forward].reverse()
    if (direction === "ping-pong") return forward.concat(forward.slice(1, -1).reverse())
    if (direction === "ping-pong-reverse") return [...forward].reverse().concat(forward.slice(1, -1))
    throw new Error(`widget-animation-preview direction ${direction} is not supported`)
}

export class WidgetAnimationPreview extends HTMLElement {
    constructor() {
        super()
        this.canvasElement = null
        this._clip = null
        this._playing = false
        this._playbackRate = 1
        this._frameIndex = 0
        this._order = []
        this._orderIndex = 0
        this._completedCycles = 0
        this._timer = 0
    }

    connectedCallback() {
        if (!this.dataset.ready) {
            this.dataset.ready = "1"
            this.innerHTML = '<canvas data-element="animation-preview" aria-label="Animation preview"></canvas>'
            this.canvasElement = this.querySelector('[data-element="animation-preview"]')
            assert(this.canvasElement instanceof HTMLCanvasElement, "widget-animation-preview canvas is required")
        }
        this.renderFrame()
        if (this._playing) this.scheduleNextFrame()
    }

    disconnectedCallback() {
        this.clearTimer()
    }

    get clip() {
        return this._clip === null ? null : structuredClone(this._clip)
    }

    set clip(value) {
        this.clearTimer()
        if (value === null) {
            this._clip = null
            this._playing = false
            this._frameIndex = 0
            this._order = []
            this._orderIndex = 0
            this._completedCycles = 0
            this.renderFrame()
            return
        }
        validateClip(value)
        this._clip = structuredClone(value)
        this._order = playbackOrder(this._clip.frames.length, this._clip.direction)
        this._orderIndex = 0
        this._frameIndex = this._order[0]
        this._completedCycles = 0
        this.renderFrame()
        this.publishFrameChange()
        if (this._playing && this.isConnected) this.scheduleNextFrame()
    }

    get playing() {
        return this._playing
    }

    set playing(value) {
        assert(typeof value === "boolean", "widget-animation-preview playing must be a boolean")
        if (value) assert(this._clip, "widget-animation-preview requires a clip before playback")
        if (this._playing === value) return
        this._playing = value
        this.clearTimer()
        if (this._playing && this.isConnected) this.scheduleNextFrame()
    }

    get playbackRate() {
        return this._playbackRate
    }

    set playbackRate(value) {
        assert(Number.isFinite(value) && value > 0, "widget-animation-preview playbackRate must be positive and finite")
        this._playbackRate = value
        if (this._playing && this.isConnected) {
            this.clearTimer()
            this.scheduleNextFrame()
        }
    }

    get frameIndex() {
        return this._frameIndex
    }

    set frameIndex(value) {
        assert(this._clip, "widget-animation-preview requires a clip before seeking")
        assert(
            Number.isInteger(value) && value >= 0 && value < this._clip.frames.length,
            "widget-animation-preview frameIndex is out of range",
        )
        this._frameIndex = value
        this._orderIndex = this._order.indexOf(value)
        assert(this._orderIndex >= 0, `widget-animation-preview playback order is missing frame ${value}`)
        this._completedCycles = 0
        this.renderFrame()
        this.publishFrameChange()
        if (this._playing && this.isConnected) {
            this.clearTimer()
            this.scheduleNextFrame()
        }
    }

    clearTimer() {
        if (!this._timer) return
        window.clearTimeout(this._timer)
        this._timer = 0
    }

    scheduleNextFrame() {
        assert(this._clip, "widget-animation-preview playback requires a clip")
        assert(this._timer === 0, "widget-animation-preview playback timer must not already be scheduled")
        const frame = this._clip.frames[this._frameIndex]
        assert(frame, `widget-animation-preview frame ${this._frameIndex} is required`)
        const delay = Math.max(16, frame.durationMs / this._playbackRate)
        this._timer = window.setTimeout(() => {
            this._timer = 0
            this.advanceFrame()
        }, delay)
    }

    advanceFrame() {
        assert(this._clip && this._playing, "widget-animation-preview can only advance during playback")
        const nextOrderIndex = this._orderIndex + 1
        if (nextOrderIndex >= this._order.length) {
            this._completedCycles += 1
            if (this._clip.repeat > 0 && this._completedCycles >= this._clip.repeat) {
                this._playing = false
                this.dispatchEvent(new CustomEvent("ended", { bubbles: true }))
                return
            }
            this._orderIndex = 0
        } else {
            this._orderIndex = nextOrderIndex
        }
        this._frameIndex = this._order[this._orderIndex]
        this.renderFrame()
        this.publishFrameChange()
        this.scheduleNextFrame()
    }

    renderFrame() {
        if (!(this.canvasElement instanceof HTMLCanvasElement)) return
        if (this._clip === null) {
            this.canvasElement.width = 1
            this.canvasElement.height = 1
            const context = this.canvasElement.getContext("2d")
            assert(context, "widget-animation-preview canvas requires a 2d context")
            context.clearRect(0, 0, 1, 1)
            return
        }
        const frame = this._clip.frames[this._frameIndex]
        assert(frame, `widget-animation-preview frame ${this._frameIndex} is required`)
        this.canvasElement.width = this._clip.width
        this.canvasElement.height = this._clip.height
        const context = this.canvasElement.getContext("2d")
        assert(context, "widget-animation-preview canvas requires a 2d context")
        context.imageSmoothingEnabled = false
        const data = new Uint8ClampedArray(frame.pixels.data)
        context.putImageData(new ImageData(data, this._clip.width, this._clip.height), 0, 0)
    }

    publishFrameChange() {
        this.dispatchEvent(
            new CustomEvent("framechange", {
                bubbles: true,
                detail: { frameIndex: this._frameIndex },
            }),
        )
    }
}

if (!customElements.get("widget-animation-preview")) {
    customElements.define("widget-animation-preview", WidgetAnimationPreview)
}
