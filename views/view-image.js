import { runtime, unwrap } from "/core/runtime.js"
import { ViewCanvasBase } from "/util/view-canvas-base.js"
import { decode as decodeQoi } from "/util/qoi/decode.js"

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

function getExtension(path) {
    const name =
        String(path || "")
            .split("/")
            .pop() || ""
    const parts = name.split(".")
    if (parts.length <= 1) return ""
    return parts.pop().toLowerCase()
}

function mimeTypeForPath(path) {
    const ext = getExtension(path)
    if (ext === "png") return "image/png"
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
    if (ext === "webp") return "image/webp"
    if (ext === "gif") return "image/gif"
    if (ext === "bmp") return "image/bmp"
    return "application/octet-stream"
}

function createCanvasFromQoi(bytes) {
    const decoded = decodeQoi(bytes.buffer, bytes.byteOffset, bytes.byteLength, 4)
    const pixels = new Uint8ClampedArray(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength)
    const canvas = document.createElement("canvas")
    canvas.width = decoded.width
    canvas.height = decoded.height
    const ctx = canvas.getContext("2d")
    assert(ctx, "view-image qoi canvas requires 2d context")
    ctx.putImageData(new ImageData(pixels, decoded.width, decoded.height), 0, 0)
    return canvas
}

export class ViewImage extends ViewCanvasBase {
    static get observedAttributes() {
        return ["data-source"]
    }

    constructor() {
        super()
        this.path = ""
        this.statusElement = null
        this.pathElement = null
    }

    connectedCallback() {
        if (this.dataset.ready) return
        this.dataset.ready = "1"

        this.path = String(this.popupProps?.path || this.getAttribute("data-source") || "").trim()
        assert(this.path, "view-image requires data-source")

        this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <footer data-element="footer">
        <output data-element="path"></output>
        <output data-element="status">Loading...</output>
      </footer>
    `

        this.statusElement = this.querySelector('[data-element="status"]')
        this.pathElement = this.querySelector('[data-element="path"]')
        assert(this.statusElement instanceof HTMLOutputElement, "view-image missing status output")
        assert(this.pathElement instanceof HTMLOutputElement, "view-image missing path output")
        this.pathElement.textContent = this.path

        super.connectedCallback()
        void this.load()
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
        }
    }

    createHeaderControlsElement() {
        const toolbar = document.createElement("div")
        toolbar.dataset.element = "toolbar"
        toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit" title="Fit"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in"><i aria-hidden="true">zoom_in</i></button>
      </div>
    `
        toolbar.querySelector('[data-action="reload"]').addEventListener("click", () => this.reload())
        toolbar.querySelector('[data-action="zoom-out"]').addEventListener("click", () => this.zoomOut())
        toolbar.querySelector('[data-action="zoom-fit"]').addEventListener("click", () => this.zoomFit())
        toolbar.querySelector('[data-action="zoom-in"]').addEventListener("click", () => this.zoomIn())
        return toolbar
    }

    async reload() {
        await this.load()
        await runtime.call("ui.toast.success", { message: `Reloaded ${this.path}` })
    }

    setStatus(text, tone = null) {
        assert(this.statusElement instanceof HTMLOutputElement, "view-image status output is not initialized")
        this.statusElement.textContent = text
        this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
        if (tone) this.statusElement.classList.add(tone)
    }

    async load() {
        assert(this.path, "view-image requires data-source")
        this.setStatus("Loading...", "info")

        try {
            const bytes = new Uint8Array(unwrap(await runtime.invoke("fs/fs::read-file", this.path)))

            const ext = getExtension(this.path)
            const source =
                ext === "qoi"
                    ? createCanvasFromQoi(bytes)
                    : await createImageBitmap(new Blob([bytes], { type: mimeTypeForPath(this.path) }))

            this.setData({ source, width: source.width, height: source.height }, { autoFit: true })
            this.setStatus(`${source.width} × ${source.height}`, "success")
        } catch (error) {
            this.setData(null, { autoFit: false })
            this.setStatus(`Error: ${error?.message || error}`, "danger")
            console.error("view-image load failed:", error)
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
    }
}

if (!customElements.get("view-image")) {
    customElements.define("view-image", ViewImage)
}
