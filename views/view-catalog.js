import { runtime, unwrap } from "/core/runtime.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"
import { sql } from "/util/sql.js"
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

function createCanvasFromQoi(bytes) {
    const decoded = decodeQoi(bytes.buffer, bytes.byteOffset, bytes.byteLength, 4)
    const pixels = new Uint8ClampedArray(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength)
    const canvas = document.createElement("canvas")
    canvas.width = decoded.width
    canvas.height = decoded.height
    const ctx = canvas.getContext("2d")
    assert(ctx, "view-catalog qoi canvas requires 2d context")
    ctx.putImageData(new ImageData(pixels, decoded.width, decoded.height), 0, 0)
    return canvas
}

function assertPositiveInteger(value, name) {
    assert(Number.isInteger(value) && value > 0, `${name} must be a positive integer`)
}

export class ViewCatalog extends HTMLElement {
    constructor() {
        super()
        this.rows = []
        this.tableElement = null
        this.statusElement = null
        this.headerControlsElement = null
    }

    connectedCallback() {
        registerViewPlugin(this)
        if (this.dataset.ready) {
            this.mountHeaderControls()
            return
        }
        this.dataset.ready = "1"
        this.style.display = "contents"

        this.innerHTML = `
      <table data-element="catalog-table">
        <thead>
          <tr>
            <th>Preview</th>
            <th>Name</th>
            <th>Source</th>
            <th>Tile size</th>
            <th>Masks</th>
            <th>Tiles</th>
            <th>Variants</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <footer data-element="footer">
        <output data-element="status">Loading...</output>
      </footer>
    `

        this.tableElement = this.querySelector('[data-element="catalog-table"]')
        this.statusElement = this.querySelector('[data-element="status"]')
        assert(this.tableElement instanceof HTMLTableElement, "view-catalog missing table")
        assert(this.statusElement instanceof HTMLOutputElement, "view-catalog missing status output")

        this.mountHeaderControls()
        void this.refresh()
    }

    disconnectedCallback() {
        this.unmountHeaderControls()
        void unregisterViewPlugin(this)
    }

    createViewPluginMethods() {
        return {
            reload: async () => {
                await this.refresh()
                return { ok: true }
            },
        }
    }

    createHeaderControlsElement() {
        const toolbar = document.createElement("div")
        toolbar.dataset.element = "toolbar"
        toolbar.setAttribute("slot", "header-controls")
        toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      </div>
    `
        toolbar.querySelector('[data-action="reload"]').addEventListener("click", () => this.refresh())
        return toolbar
    }

    mountHeaderControls() {
        if (!this.parentElement || this.headerControlsElement) return
        const toolbar = this.createHeaderControlsElement()
        this.headerControlsElement = toolbar
        this.parentElement.appendChild(toolbar)
    }

    unmountHeaderControls() {
        if (!this.headerControlsElement) return
        this.headerControlsElement.remove()
        this.headerControlsElement = null
    }

    setStatus(text, tone = null) {
        assert(this.statusElement instanceof HTMLOutputElement, "view-catalog status output is not initialized")
        this.statusElement.textContent = text
        this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
        if (tone) this.statusElement.classList.add(tone)
    }

    async refresh() {
        this.setStatus("Loading...", "info")
        this.rows = await sql.queryObjects(
            `
        WITH stats AS (
          SELECT
            tileset_id,
            COUNT(*) AS tile_count,
            COUNT(DISTINCT mask) AS mask_count,
            SUM(CASE WHEN variant_index > 0 THEN 1 ELSE 0 END) AS variant_count
          FROM tile
          GROUP BY tileset_id
        ),
        previews AS (
          SELECT
            t.tileset_id,
            t.tile_index AS preview_tile_index,
            src.image_path AS preview_image_path,
            src.tile_width AS preview_tile_width,
            src.tile_height AS preview_tile_height
          FROM tile t
          JOIN tileset_image_source src
            ON src.id = t.image_source_id
           AND src.tileset_id = t.tileset_id
          WHERE t.mask = 15
            AND t.variant_index = 0
        )
        SELECT
          ts.id AS id,
          ts.name AS name,
          COALESCE(ts.display_name, ts.name) AS display_name,
          COALESCE(ts.description, '') AS description,
          previews.preview_image_path AS preview_image_path,
          previews.preview_tile_width AS preview_tile_width,
          previews.preview_tile_height AS preview_tile_height,
          previews.preview_tile_index AS preview_tile_index,
          stats.mask_count AS mask_count,
          stats.tile_count AS tile_count,
          stats.variant_count AS variant_count
        FROM tileset ts
        JOIN stats ON stats.tileset_id = ts.id
        JOIN previews ON previews.tileset_id = ts.id
        ORDER BY ts.name
      `,
            [
                "id",
                "name",
                "display_name",
                "description",
                "preview_image_path",
                "preview_tile_width",
                "preview_tile_height",
                "preview_tile_index",
                "mask_count",
                "tile_count",
                "variant_count",
            ],
        )
        this.render()
        await this.renderPreviews()
        this.setStatus(`${this.rows.length} tilesets`, "success")
    }

    render() {
        assert(this.tableElement instanceof HTMLTableElement, "view-catalog table is not initialized")
        const body = this.tableElement.querySelector("tbody")
        assert(body instanceof HTMLTableSectionElement, "view-catalog missing table body")
        body.replaceChildren()

        for (const row of this.rows) {
            const tr = document.createElement("tr")
            tr.dataset.tilesetId = String(row.id)

            const preview = document.createElement("td")
            const canvas = document.createElement("canvas")
            canvas.dataset.element = "preview"
            canvas.dataset.tilesetId = String(row.id)
            preview.appendChild(canvas)

            const name = document.createElement("td")
            name.textContent = row.display_name

            const source = document.createElement("td")
            source.textContent = row.preview_image_path

            const tileSize = document.createElement("td")
            tileSize.textContent = `${row.preview_tile_width}×${row.preview_tile_height}`

            const masks = document.createElement("td")
            masks.textContent = `${row.mask_count}/15`

            const tiles = document.createElement("td")
            tiles.textContent = String(row.tile_count)

            const variants = document.createElement("td")
            variants.textContent = String(row.variant_count)

            const description = document.createElement("td")
            description.textContent = row.description

            tr.append(preview, name, source, tileSize, masks, tiles, variants, description)
            body.appendChild(tr)
        }
    }

    async renderPreviews() {
        const imageCache = new Map()
        for (const row of this.rows) {
            const canvas = this.querySelector(`canvas[data-tileset-id="${row.id}"]`)
            assert(canvas instanceof HTMLCanvasElement, `view-catalog missing preview canvas for tileset ${row.id}`)
            await this.renderPreview(canvas, row, imageCache)
        }
    }

    async renderPreview(canvas, row, imageCache) {
        const path = row.preview_image_path
        assert(typeof path === "string" && path.length > 0, "catalog preview requires image path")
        assert(getExtension(path) === "qoi", `catalog preview currently supports qoi files only: ${path}`)

        let source = imageCache.get(path)
        if (!source) {
            const bytes = new Uint8Array(unwrap(await runtime.invoke("fs/fs::read-file", path)))
            source = createCanvasFromQoi(bytes)
            imageCache.set(path, source)
        }

        const tileWidth = Number(row.preview_tile_width)
        const tileHeight = Number(row.preview_tile_height)
        const tileIndex = Number(row.preview_tile_index)
        assertPositiveInteger(tileWidth, "preview tile width")
        assertPositiveInteger(tileHeight, "preview tile height")
        assertPositiveInteger(tileIndex, "preview tile index")
        assert(source.width % tileWidth === 0, `${path} width must be divisible by tile width`)
        assert(source.height % tileHeight === 0, `${path} height must be divisible by tile height`)

        const columns = source.width / tileWidth
        const rows = source.height / tileHeight
        assert(tileIndex <= columns * rows, `${path} tile index ${tileIndex} exceeds source tile count ${columns * rows}`)

        const zeroBasedIndex = tileIndex - 1
        const tileX = zeroBasedIndex % columns
        const tileY = Math.floor(zeroBasedIndex / columns)

        const scale = 3
        canvas.width = tileWidth * scale
        canvas.height = tileHeight * scale
        const ctx = canvas.getContext("2d")
        assert(ctx, "view-catalog preview requires 2d context")
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(source, tileX * tileWidth, tileY * tileHeight, tileWidth, tileHeight, 0, 0, canvas.width, canvas.height)
    }
}

if (!customElements.get("view-catalog")) {
    customElements.define("view-catalog", ViewCatalog)
}
