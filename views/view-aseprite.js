import { runtime, unwrap } from "/core/runtime.js"
import { ViewCanvasBase } from "/util/view-canvas-base.js"

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function makePixelsCanvas(pixels) {
    assert(pixels && typeof pixels === "object", "view-aseprite pixels result must be an object")
    assert(Number.isInteger(pixels.width), "view-aseprite pixels width must be an integer")
    assert(Number.isInteger(pixels.height), "view-aseprite pixels height must be an integer")
    assert(Array.isArray(pixels.data), "view-aseprite pixels data must be an array")
    const data = new Uint8ClampedArray(pixels.data)
    assert(data.length === pixels.width * pixels.height * 4, "view-aseprite pixels data length must match RGBA dimensions")
    const canvas = document.createElement("canvas")
    canvas.width = pixels.width
    canvas.height = pixels.height
    const ctx = canvas.getContext("2d")
    assert(ctx, "view-aseprite pixels canvas requires 2d context")
    ctx.putImageData(new ImageData(data, pixels.width, pixels.height), 0, 0)
    return canvas
}

function layerInitiallyVisible(layer) {
    const flags = layer["layer-flags"]
    assert(Array.isArray(flags), "view-aseprite layer-flags must be an array")
    return flags.includes("visible")
}

function blendOrder(a, b) {
    return a["layer-index"] + a["z-index"] - (b["layer-index"] + b["z-index"]) || a["z-index"] - b["z-index"]
}

function optionValue(value, name) {
    if (value === null) return null
    assert(value !== undefined, `${name} must be present`)
    if (typeof value !== "object") return value
    if ("is_some" in value) return value.is_some ? value.val : null
    if ("isSome" in value) return value.isSome ? value.val : null
    return value
}

function normalizeOptionalRect(value, name) {
    const rect = optionValue(value, name)
    if (rect === null) return null
    const x = Number(rect.x)
    const y = Number(rect.y)
    const width = Number(rect.width)
    const height = Number(rect.height)
    assert(Number.isInteger(x), `${name} x must be an integer`)
    assert(Number.isInteger(y), `${name} y must be an integer`)
    assert(Number.isInteger(width) && width > 0, `${name} width must be a positive integer`)
    assert(Number.isInteger(height) && height > 0, `${name} height must be a positive integer`)
    return { x, y, width, height }
}

function normalizeOptionalPoint(value, name) {
    const point = optionValue(value, name)
    if (point === null) return null
    const x = Number(point.x)
    const y = Number(point.y)
    assert(Number.isInteger(x), `${name} x must be an integer`)
    assert(Number.isInteger(y), `${name} y must be an integer`)
    return { x, y }
}

function normalizeRgba(value, name) {
    assert(value && typeof value === "object", `${name} must be an rgba object`)
    const r = Number(value.r)
    const g = Number(value.g)
    const b = Number(value.b)
    const a = Number(value.a)
    assert(Number.isInteger(r) && r >= 0 && r <= 255, `${name} red must be a byte`)
    assert(Number.isInteger(g) && g >= 0 && g <= 255, `${name} green must be a byte`)
    assert(Number.isInteger(b) && b >= 0 && b <= 255, `${name} blue must be a byte`)
    assert(Number.isInteger(a) && a >= 0 && a <= 255, `${name} alpha must be a byte`)
    return { r, g, b, a }
}

function rgbaCss(color) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`
}

function sliceUserData(slice) {
    const userData = optionValue(slice["user-data"], `view-aseprite slice ${String(slice.name || "")} user data`)
    if (userData === null) return { text: null, color: null }
    assert(userData && typeof userData === "object", `view-aseprite slice ${String(slice.name || "")} user data must be an object`)
    const text = optionValue(userData.text, `view-aseprite slice ${String(slice.name || "")} user data text`)
    const colorValue = optionValue(userData.color, `view-aseprite slice ${String(slice.name || "")} user data color`)
    const color = colorValue === null ? null : normalizeRgba(colorValue, `view-aseprite slice ${String(slice.name || "")} user data color`)
    return { text, color }
}

function sliceOverlayColor(slice) {
    return sliceUserData(slice).color || { r: 255, g: 0, b: 255, a: 255 }
}

function sliceKeyForFrame(slice, frameIndex) {
    assert(slice && typeof slice === "object", "view-aseprite slice must be an object")
    assert(Array.isArray(slice.keys), `view-aseprite slice ${String(slice.name || "")} keys must be an array`)
    assert(slice.keys.length > 0, `view-aseprite slice ${String(slice.name || "")} requires at least one key`)
    assert(Number.isInteger(frameIndex), "view-aseprite slice frame index must be an integer")
    const keys = [...slice.keys].sort((left, right) => Number(left.frame) - Number(right.frame))
    for (const key of keys) {
        assert(Number.isInteger(Number(key.frame)), `view-aseprite slice ${String(slice.name || "")} key frame must be an integer`)
        assert(Number.isInteger(Number(key.x)), `view-aseprite slice ${String(slice.name || "")} x must be an integer`)
        assert(Number.isInteger(Number(key.y)), `view-aseprite slice ${String(slice.name || "")} y must be an integer`)
        assert(Number.isInteger(Number(key.width)) && Number(key.width) > 0, `view-aseprite slice ${String(slice.name || "")} width must be a positive integer`)
        assert(Number.isInteger(Number(key.height)) && Number(key.height) > 0, `view-aseprite slice ${String(slice.name || "")} height must be a positive integer`)
    }
    let selected = keys[0]
    for (const key of keys) {
        if (Number(key.frame) > frameIndex) break
        selected = key
    }
    const name = `view-aseprite slice ${String(slice.name || "")}`
    const patch = normalizeOptionalRect(selected.patch, `${name} nine-slice patch`)
    const pivot = normalizeOptionalPoint(selected.pivot, `${name} pivot`)
    const width = Number(selected.width)
    const height = Number(selected.height)
    if (patch) {
        assert(patch.x >= 0 && patch.x + patch.width <= width, `${name} nine-slice patch must fit within slice width`)
        assert(patch.y >= 0 && patch.y + patch.height <= height, `${name} nine-slice patch must fit within slice height`)
    }
    return {
        frame: Number(selected.frame),
        x: Number(selected.x),
        y: Number(selected.y),
        width,
        height,
        patch,
        pivot,
    }
}

function drawSliceOverlay(ctx, key, { offsetX = 0, offsetY = 0, lineWidth = 1, includeBounds = true, color = { r: 255, g: 0, b: 255, a: 255 } } = {}) {
    const x = offsetX
    const y = offsetY
    ctx.save()
    ctx.lineWidth = lineWidth
    ctx.setLineDash([])
    if (includeBounds) {
        ctx.strokeStyle = rgbaCss(color)
        ctx.strokeRect(x, y, key.width, key.height)
    }
    if (key.patch) {
        const left = x + key.patch.x
        const right = x + key.patch.x + key.patch.width
        const top = y + key.patch.y
        const bottom = y + key.patch.y + key.patch.height
        ctx.strokeStyle = "#00e5ff"
        ctx.beginPath()
        ctx.moveTo(left, y)
        ctx.lineTo(left, y + key.height)
        ctx.moveTo(right, y)
        ctx.lineTo(right, y + key.height)
        ctx.moveTo(x, top)
        ctx.lineTo(x + key.width, top)
        ctx.moveTo(x, bottom)
        ctx.lineTo(x + key.width, bottom)
        ctx.stroke()
    }
    if (key.pivot) {
        const pivotX = x + key.pivot.x
        const pivotY = y + key.pivot.y
        const radius = Math.max(2 * lineWidth, 2)
        ctx.strokeStyle = "#ffcc00"
        ctx.beginPath()
        ctx.moveTo(pivotX - radius, pivotY)
        ctx.lineTo(pivotX + radius, pivotY)
        ctx.moveTo(pivotX, pivotY - radius)
        ctx.lineTo(pivotX, pivotY + radius)
        ctx.stroke()
    }
    ctx.restore()
}

export class ViewAseprite extends ViewCanvasBase {
    static get observedAttributes() {
        return ["data-source"]
    }

    constructor() {
        super()
        this.path = ""
        this.documentResource = null
        this.info = null
        this.frames = []
        this.layers = []
        this.tags = []
        this.paletteInfo = null
        this.paletteColors = []
        this.slices = []
        this.tilesets = []
        this.frameIndex = 0
        this.selectedTagIndex = null
        this.selectedSliceIndex = null
        this.playbackDirection = 1
        this.layerVisibility = new Map()
        this.celsByFrame = new Map()
        this.statusElement = null
        this.pathElement = null
        this.frameElement = null
        this.asideElement = null
        this.playTimer = 0
    }

    connectedCallback() {
        if (this.dataset.ready) return
        this.dataset.ready = "1"

        this.path = String(this.popupProps?.path || this.getAttribute("data-source") || this.config?.defaultSource || "").trim()
        assert(this.path, "view-aseprite requires data-source")

        this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <aside data-element="inspector"></aside>
      <footer data-element="footer">
        <output data-element="path"></output>
        <output data-element="frame"></output>
        <output data-element="status">Loading...</output>
      </footer>
    `

        this.statusElement = this.querySelector('[data-element="status"]')
        this.pathElement = this.querySelector('[data-element="path"]')
        this.frameElement = this.querySelector('[data-element="frame"]')
        this.asideElement = this.querySelector('[data-element="inspector"]')
        assert(this.statusElement instanceof HTMLOutputElement, "view-aseprite missing status output")
        assert(this.pathElement instanceof HTMLOutputElement, "view-aseprite missing path output")
        assert(this.frameElement instanceof HTMLOutputElement, "view-aseprite missing frame output")
        assert(this.asideElement instanceof HTMLElement, "view-aseprite missing inspector aside")
        this.pathElement.textContent = this.path

        super.connectedCallback()
        void this.load()
    }

    disconnectedCallback() {
        this.stopPlayback()
        void this.releaseDocument()
        super.disconnectedCallback()
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        if (name !== "data-source") return
        this.path = String(newValue || "").trim()
        if (this.pathElement instanceof HTMLOutputElement) this.pathElement.textContent = this.path
        if (this.dataset.ready) void this.load()
    }

    createViewPluginMethods() {
        return {
            reload: async () => {
                await this.reload()
                return { ok: true }
            },
            nextFrame: async () => {
                await this.nextFrame()
                return { ok: true }
            },
            previousFrame: async () => {
                await this.previousFrame()
                return { ok: true }
            },
            setFrame: async (frameIndex) => {
                await this.setFrame(Number(frameIndex))
                return { ok: true }
            },
        }
    }

    createHeaderControlsElement() {
        const toolbar = document.createElement("div")
        toolbar.dataset.element = "toolbar"
        toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="playback-actions">
        <button type="button" data-action="first-frame" aria-label="First frame" title="First frame"><i aria-hidden="true">first_page</i></button>
        <button type="button" data-action="previous-frame" aria-label="Previous frame" title="Previous frame"><i aria-hidden="true">chevron_left</i></button>
        <button type="button" data-action="play-pause" aria-label="Play" title="Play"><i aria-hidden="true">play_arrow</i></button>
        <button type="button" data-action="next-frame" aria-label="Next frame" title="Next frame"><i aria-hidden="true">chevron_right</i></button>
        <button type="button" data-action="last-frame" aria-label="Last frame" title="Last frame"><i aria-hidden="true">last_page</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit" title="Fit"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in"><i aria-hidden="true">zoom_in</i></button>
      </div>
    `
        toolbar.querySelector('[data-action="reload"]').addEventListener("click", () => this.reload())
        toolbar.querySelector('[data-action="first-frame"]').addEventListener("click", () => this.setFrame(this.playbackStartFrame()))
        toolbar.querySelector('[data-action="previous-frame"]').addEventListener("click", () => this.previousFrame())
        toolbar.querySelector('[data-action="play-pause"]').addEventListener("click", () => this.togglePlayback())
        toolbar.querySelector('[data-action="next-frame"]').addEventListener("click", () => this.nextFrame())
        toolbar.querySelector('[data-action="last-frame"]').addEventListener("click", () => this.setFrame(this.playbackEndFrame()))
        toolbar.querySelector('[data-action="zoom-out"]').addEventListener("click", () => this.zoomOut())
        toolbar.querySelector('[data-action="zoom-fit"]').addEventListener("click", () => this.zoomFit())
        toolbar.querySelector('[data-action="zoom-in"]').addEventListener("click", () => this.zoomIn())
        return toolbar
    }

    async reload() {
        await this.load()
        await runtime.call("ui.toast.success", { message: `Reloaded ${this.path}` })
    }

    async releaseDocument() {
        if (!this.documentResource) return
        const resource = this.documentResource
        this.documentResource = null
        await runtime.releaseResource(resource)
    }

    setStatus(text, tone = null) {
        assert(this.statusElement instanceof HTMLOutputElement, "view-aseprite status output is not initialized")
        this.statusElement.textContent = text
        this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
        if (tone) this.statusElement.classList.add(tone)
    }

    setFrameStatus() {
        assert(this.frameElement instanceof HTMLOutputElement, "view-aseprite frame output is not initialized")
        if (this.frames.length === 0) {
            this.frameElement.textContent = "Frame 0 / 0"
            return
        }
        const frame = this.frames[this.frameIndex]
        assert(frame, "view-aseprite active frame must exist")
        this.frameElement.textContent = `Frame ${this.frameIndex + 1} / ${this.frames.length} · ${frame["duration-ms"]}ms`
    }

    async load() {
        assert(this.path, "view-aseprite requires data-source")
        this.stopPlayback()
        this.setStatus("Loading...", "info")
        this.setData(null, { autoFit: false })

        try {
            await this.releaseDocument()
            this.documentResource = unwrap(await runtime.invoke("aseprite/aseprite::open", this.path), "aseprite open")
            this.info = unwrap(await runtime.invoke("aseprite/aseprite::info", this.documentResource), "aseprite info")
            this.frames = unwrap(await runtime.invoke("aseprite/aseprite::frames", this.documentResource), "aseprite frames")
            this.layers = unwrap(await runtime.invoke("aseprite/aseprite::layers", this.documentResource), "aseprite layers")
            this.tags = unwrap(await runtime.invoke("aseprite/aseprite::tags", this.documentResource), "aseprite tags")
            this.paletteInfo = unwrap(await runtime.invoke("aseprite/aseprite::get-palette-info", this.documentResource), "aseprite palette info")
            this.paletteColors = unwrap(await runtime.invoke("aseprite/aseprite::palette-colors", this.documentResource), "aseprite palette colors")
            this.slices = unwrap(await runtime.invoke("aseprite/aseprite::slices", this.documentResource), "aseprite slices")
            this.tilesets = unwrap(await runtime.invoke("aseprite/aseprite::tilesets", this.documentResource), "aseprite tilesets")
            assert(this.frames.length > 0, "view-aseprite requires at least one frame")
            this.layerVisibility = new Map(this.layers.map((layer) => [layer.index, layerInitiallyVisible(layer)]))
            this.celsByFrame = new Map()
            this.selectedTagIndex = null
            this.selectedSliceIndex = null
            this.playbackDirection = 1
            this.frameIndex = 0
            this.renderInspector()
            await this.renderFrame()
            this.setStatus(`${this.info.width} × ${this.info.height} · ${this.frames.length} frames`, "success")
        } catch (error) {
            this.stopPlayback()
            await this.releaseDocument()
            this.renderInspector()
            this.setData(null, { autoFit: false })
            this.setStatus(`Error: ${error?.message || error}`, "danger")
            console.error("view-aseprite load failed:", error)
        }
    }

    async renderFrame({ autoFit = false } = {}) {
        assert(this.documentResource, "view-aseprite requires loaded document")
        assert(this.frames[this.frameIndex], "view-aseprite active frame must exist")
        const source = await this.composeFrameCanvas(this.frameIndex)
        this.setData({ source, width: source.width, height: source.height }, { autoFit })
        this.setFrameStatus()
        this.renderSlicePreviews()
    }

    async celsForFrame(frameIndex) {
        if (this.celsByFrame.has(frameIndex)) return this.celsByFrame.get(frameIndex)
        assert(this.documentResource, "view-aseprite requires loaded document")
        const cels = unwrap(await runtime.invoke("aseprite/aseprite::cels", this.documentResource, frameIndex), "aseprite cels")
        this.celsByFrame.set(frameIndex, cels)
        return cels
    }

    async composeFrameCanvas(frameIndex) {
        assert(this.info, "view-aseprite requires loaded info")
        assert(this.documentResource, "view-aseprite requires loaded document")
        const canvas = document.createElement("canvas")
        canvas.width = this.info.width
        canvas.height = this.info.height
        const ctx = canvas.getContext("2d")
        assert(ctx, "view-aseprite compose canvas requires 2d context")
        ctx.imageSmoothingEnabled = false

        const cels = [...(await this.celsForFrame(frameIndex))].sort(blendOrder)
        for (const cel of cels) {
            const layer = this.layers[cel["layer-index"]]
            assert(layer, `view-aseprite cel references missing layer ${cel["layer-index"]}`)
            if (this.layerVisibility.get(layer.index) !== true) continue
            const celPixels = unwrap(await runtime.invoke("aseprite/aseprite::cel-pixels", this.documentResource, frameIndex, cel["cel-index"]), "aseprite cel pixels")
            const celCanvas = makePixelsCanvas(celPixels)
            ctx.globalAlpha = (cel.opacity / 255) * (layer.opacity / 255)
            ctx.drawImage(celCanvas, cel.x, cel.y)
            ctx.globalAlpha = 1
        }

        return canvas
    }

    async toggleLayerVisible(layerIndex) {
        assert(Number.isInteger(layerIndex), "view-aseprite layer index must be an integer")
        assert(this.layerVisibility.has(layerIndex), `view-aseprite unknown layer ${layerIndex}`)
        this.layerVisibility.set(layerIndex, !this.layerVisibility.get(layerIndex))
        this.renderInspector()
        await this.renderFrame({ autoFit: false })
    }

    selectedTag() {
        if (this.selectedTagIndex === null) return null
        const tag = this.tags[this.selectedTagIndex]
        assert(tag, "view-aseprite selected tag must exist")
        return tag
    }

    selectedTagDirection() {
        const tag = this.selectedTag()
        return tag ? String(tag.direction) : "forward"
    }

    playbackStartFrame() {
        const tag = this.selectedTag()
        return tag ? Number(tag["from-frame"]) : 0
    }

    playbackEndFrame() {
        const tag = this.selectedTag()
        return tag ? Number(tag["to-frame"]) : this.frames.length - 1
    }

    playbackInitialDirection() {
        const direction = this.selectedTagDirection()
        if (direction === "reverse" || direction === "ping-pong-reverse") return -1
        return 1
    }

    playbackEntryFrame() {
        return this.playbackInitialDirection() < 0 ? this.playbackEndFrame() : this.playbackStartFrame()
    }

    async selectTag(tagIndex) {
        assert(Number.isInteger(tagIndex), "view-aseprite tag index must be an integer")
        assert(tagIndex >= 0 && tagIndex < this.tags.length, "view-aseprite tag index out of range")
        this.selectedTagIndex = this.selectedTagIndex === tagIndex ? null : tagIndex
        this.playbackDirection = this.playbackInitialDirection()
        this.renderInspector()
        if (this.selectedTagIndex !== null) {
            await this.setFrame(this.playbackEntryFrame())
        }
    }

    selectSlice(sliceIndex) {
        assert(Number.isInteger(sliceIndex), "view-aseprite slice index must be an integer")
        assert(sliceIndex >= 0 && sliceIndex < this.slices.length, "view-aseprite slice index out of range")
        this.selectedSliceIndex = this.selectedSliceIndex === sliceIndex ? null : sliceIndex
        this.renderInspector()
        this.draw()
    }

    async setFrame(frameIndex) {
        if (!this.documentResource || this.frames.length === 0) return
        assert(Number.isInteger(frameIndex), "view-aseprite frame index must be an integer")
        const clamped = Math.max(0, Math.min(this.frames.length - 1, frameIndex))
        if (clamped === this.frameIndex && this.data) return
        this.frameIndex = clamped
        await this.renderFrame({ autoFit: false })
        this.renderInspector()
    }

    frameStep(manualDirection) {
        const start = this.playbackStartFrame()
        const end = this.playbackEndFrame()
        const direction = this.selectedTagDirection()

        if (start === end) return start

        if (direction === "reverse") {
            if (manualDirection > 0) return this.frameIndex <= start ? end : this.frameIndex - 1
            return this.frameIndex >= end ? start : this.frameIndex + 1
        }

        if (direction === "ping-pong" || direction === "ping-pong-reverse") {
            const step = this.playbackDirection * manualDirection
            if (step > 0) {
                if (this.frameIndex >= end) {
                    this.playbackDirection = -1
                    return end - 1
                }
                return this.frameIndex + 1
            }
            if (this.frameIndex <= start) {
                this.playbackDirection = 1
                return start + 1
            }
            return this.frameIndex - 1
        }

        if (manualDirection > 0) return this.frameIndex >= end ? start : this.frameIndex + 1
        return this.frameIndex <= start ? end : this.frameIndex - 1
    }

    async previousFrame() {
        if (this.frames.length === 0) return
        await this.setFrame(this.frameStep(-1))
    }

    async nextFrame() {
        if (this.frames.length === 0) return
        await this.setFrame(this.frameStep(1))
    }

    togglePlayback() {
        if (this.playTimer) {
            this.stopPlayback()
            return
        }
        this.startPlayback()
    }

    startPlayback() {
        if (this.playTimer || this.frames.length <= 1) return
        const button = this.queryHeaderControl('[data-action="play-pause"]')
        if (button instanceof HTMLButtonElement) {
            button.setAttribute("aria-label", "Pause")
            button.setAttribute("title", "Pause")
            const icon = button.querySelector("i")
            assert(icon instanceof HTMLElement, "view-aseprite play button missing icon")
            icon.textContent = "pause"
        }
        const tick = async () => {
            this.playTimer = 0
            await this.nextFrame()
            const frame = this.frames[this.frameIndex]
            assert(frame, "view-aseprite playback frame must exist")
            this.playTimer = window.setTimeout(() => void tick(), Math.max(16, Number(frame["duration-ms"])))
        }
        const frame = this.frames[this.frameIndex]
        assert(frame, "view-aseprite playback frame must exist")
        this.playTimer = window.setTimeout(() => void tick(), Math.max(16, Number(frame["duration-ms"])))
    }

    stopPlayback() {
        if (this.playTimer) {
            window.clearTimeout(this.playTimer)
            this.playTimer = 0
        }
        const button = this.queryHeaderControl('[data-action="play-pause"]')
        if (button instanceof HTMLButtonElement) {
            button.setAttribute("aria-label", "Play")
            button.setAttribute("title", "Play")
            const icon = button.querySelector("i")
            assert(icon instanceof HTMLElement, "view-aseprite play button missing icon")
            icon.textContent = "play_arrow"
        }
    }

    renderInspector() {
        assert(this.asideElement instanceof HTMLElement, "view-aseprite inspector aside is not initialized")
        if (!this.info) {
            this.asideElement.innerHTML = `<table><tbody><tr><th>Status</th><td>No Aseprite loaded</td></tr></tbody></table>`
            return
        }

        const rows = [
            ["Size", `${this.info.width} × ${this.info.height}`],
            ["Frames", this.info.frames],
            ["Color depth", this.info["color-depth"]],
            ["Pixel ratio", `${this.info["pixel-ratio-width"]}:${this.info["pixel-ratio-height"]}`],
            ["Layers", this.layers.length],
            ["Tags", this.tags.length],
            ["Slices", this.slices.length],
            ["Tilesets", this.tilesets.length],
            ["Palette", this.paletteInfo ? `${this.paletteInfo.size} colors` : "none"],
        ]

        const layerRows = this.layers
            .map((layer) => {
                const visible = this.layerVisibility.get(layer.index) === true
                return `
          <tr>
            <td>${escapeHtml(layer.index)}</td>
            <td><button type="button" data-action="toggle-layer-visible" data-layer-index="${escapeHtml(layer.index)}" aria-pressed="${visible ? "true" : "false"}" aria-label="${visible ? "Hide" : "Show"} ${escapeHtml(layer.name)}"><i aria-hidden="true">${visible ? "visibility" : "visibility_off"}</i></button></td>
            <td>${escapeHtml(layer.name)}</td>
            <td>${escapeHtml(layer.opacity)}</td>
          </tr>`
            })
            .join("")

        const tagRows = this.tags
            .map((tag, index) => {
                const selected = this.selectedTagIndex === index
                return `
          <tr data-action="select-tag" data-tag-index="${escapeHtml(index)}" aria-selected="${selected ? "true" : "false"}">
            <td>${escapeHtml(tag.name)}</td>
            <td>${escapeHtml(tag["from-frame"])}–${escapeHtml(tag["to-frame"])}</td>
            <td>${escapeHtml(tag.direction)}</td>
          </tr>`
            })
            .join("")

        const sliceRows = this.slices
            .map((slice, index) => {
                const selected = this.selectedSliceIndex === index
                const key = sliceKeyForFrame(slice, this.frameIndex)
                const userData = sliceUserData(slice)
                return `
          <tr data-action="select-slice" data-slice-index="${escapeHtml(index)}" aria-selected="${selected ? "true" : "false"}">
            <td><canvas data-element="slice-preview" data-slice-index="${escapeHtml(index)}"></canvas></td>
            <td>${escapeHtml(slice.name)}</td>
            <td>${escapeHtml(key.x)}, ${escapeHtml(key.y)}</td>
            <td>${escapeHtml(key.width)}×${escapeHtml(key.height)}</td>
            <td>${escapeHtml(key.frame)}</td>
            <td>${userData.color ? escapeHtml(`${userData.color.r}, ${userData.color.g}, ${userData.color.b}, ${userData.color.a}`) : "none"}</td>
            <td>${userData.text === null ? "" : escapeHtml(userData.text)}</td>
          </tr>`
            })
            .join("")

        this.asideElement.innerHTML = `
      <table>
        <caption>Aseprite</caption>
        <tbody>${rows.map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody>
      </table>
      <table>
        <caption>Layers</caption>
        <thead><tr><th>#</th><th>Visible</th><th>Name</th><th>Opacity</th></tr></thead>
        <tbody>${layerRows || `<tr><td colspan="4">No layers</td></tr>`}</tbody>
      </table>
      <table>
        <caption>Tags</caption>
        <thead><tr><th>Name</th><th>Frames</th><th>Direction</th></tr></thead>
        <tbody>${tagRows || `<tr><td colspan="3">No tags</td></tr>`}</tbody>
      </table>
      <table>
        <caption>Slices</caption>
        <thead><tr><th>Preview</th><th>Name</th><th>Origin</th><th>Size</th><th>Key</th><th>Color</th><th>User data</th></tr></thead>
        <tbody>${sliceRows || `<tr><td colspan="7">No slices</td></tr>`}</tbody>
      </table>
    `
        for (const button of this.asideElement.querySelectorAll('[data-action="toggle-layer-visible"]')) {
            assert(button instanceof HTMLButtonElement, "view-aseprite layer visibility control must be a button")
            button.addEventListener("click", () => {
                const layerIndex = Number(button.dataset.layerIndex)
                void this.toggleLayerVisible(layerIndex)
            })
        }
        for (const row of this.asideElement.querySelectorAll('[data-action="select-tag"]')) {
            assert(row instanceof HTMLTableRowElement, "view-aseprite tag selector must be a table row")
            row.addEventListener("click", () => {
                const tagIndex = Number(row.dataset.tagIndex)
                void this.selectTag(tagIndex)
            })
        }
        for (const row of this.asideElement.querySelectorAll('[data-action="select-slice"]')) {
            assert(row instanceof HTMLTableRowElement, "view-aseprite slice selector must be a table row")
            row.addEventListener("click", () => {
                const sliceIndex = Number(row.dataset.sliceIndex)
                this.selectSlice(sliceIndex)
            })
        }
        this.renderSlicePreviews()
    }

    renderSlicePreviews() {
        if (!this.data) return
        assert(this.asideElement instanceof HTMLElement, "view-aseprite inspector aside is not initialized")
        for (const canvas of this.asideElement.querySelectorAll('canvas[data-element="slice-preview"]')) {
            assert(canvas instanceof HTMLCanvasElement, "view-aseprite slice preview must be a canvas")
            const sliceIndex = Number(canvas.dataset.sliceIndex)
            assert(Number.isInteger(sliceIndex), "view-aseprite slice preview index must be an integer")
            const slice = this.slices[sliceIndex]
            assert(slice, `view-aseprite slice preview missing slice ${sliceIndex}`)
            const key = sliceKeyForFrame(slice, this.frameIndex)
            canvas.width = key.width
            canvas.height = key.height
            const ctx = canvas.getContext("2d")
            assert(ctx, "view-aseprite slice preview requires 2d context")
            ctx.imageSmoothingEnabled = false
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(this.data.source, key.x, key.y, key.width, key.height, 0, 0, key.width, key.height)
            drawSliceOverlay(ctx, key, { lineWidth: 1, includeBounds: true, color: sliceOverlayColor(slice) })
        }
    }

    calculateContentBounds(data) {
        if (!data) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
        return { minX: 0, minY: 0, maxX: data.width, maxY: data.height }
    }

    drawContent(ctx, data) {
        if (!data) return

        const tile = 16
        const cols = Math.ceil(data.width / tile)
        const rows = Math.ceil(data.height / tile)
        for (let y = 0; y < rows; y += 1) {
            for (let x = 0; x < cols; x += 1) {
                ctx.fillStyle = (x + y) % 2 === 0 ? "#d0d0d0" : "#f0f0f0"
                ctx.fillRect(x * tile, y * tile, tile, tile)
            }
        }

        ctx.imageSmoothingEnabled = false
        ctx.drawImage(data.source, 0, 0)

        if (this.selectedSliceIndex !== null) {
            const slice = this.slices[this.selectedSliceIndex]
            assert(slice, "view-aseprite selected slice must exist")
            const key = sliceKeyForFrame(slice, this.frameIndex)
            drawSliceOverlay(ctx, key, { offsetX: key.x, offsetY: key.y, lineWidth: 1 / this.scale, color: sliceOverlayColor(slice) })
        }
    }
}

if (!customElements.get("view-aseprite")) {
    customElements.define("view-aseprite", ViewAseprite)
}
