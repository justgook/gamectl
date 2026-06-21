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

function createCanvasFromPixels(pixels, label) {
    assert(pixels && typeof pixels === "object", `${label} pixels result must be an object`)
    assert(Number.isInteger(pixels.width) && pixels.width > 0, `${label} pixels width must be a positive integer`)
    assert(Number.isInteger(pixels.height) && pixels.height > 0, `${label} pixels height must be a positive integer`)
    assert(Array.isArray(pixels.data), `${label} pixels data must be an array`)
    const data = new Uint8ClampedArray(pixels.data)
    assert(data.length === pixels.width * pixels.height * 4, `${label} pixels data length must match RGBA dimensions`)
    const canvas = document.createElement("canvas")
    canvas.width = pixels.width
    canvas.height = pixels.height
    const ctx = canvas.getContext("2d")
    assert(ctx, `${label} pixels canvas requires 2d context`)
    ctx.putImageData(new ImageData(data, pixels.width, pixels.height), 0, 0)
    return canvas
}

function assertPositiveInteger(value, name) {
    assert(Number.isInteger(value) && value > 0, `${name} must be a positive integer`)
}

export class ViewCatalog extends HTMLElement {
    constructor() {
        super()
        this.activeTab = "tilesets"
        this.selectedTilesetId = 0
        this.selectedSpriteId = 0
        this.tilesetRows = []
        this.spriteRows = []
        this.tilesetTableElement = null
        this.spriteTableElement = null
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
      <article>
        <div role="tablist">
          <button type="button" role="tab" data-tab="tilesets" aria-selected="true">Tilesets</button>
          <button type="button" role="tab" data-tab="sprites" aria-selected="false">Sprites</button>
        </div>
        <section role="tabpanel" data-panel="tilesets">
          <table data-element="tileset-table">
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
        </section>
        <section role="tabpanel" data-panel="sprites" hidden>
          <table data-element="sprite-table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Name</th>
                <th>Source</th>
                <th>Grid</th>
                <th>Animations</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </section>
      </article>
      <footer data-element="footer">
        <output data-element="status">Loading...</output>
      </footer>
    `

        this.tilesetTableElement = this.querySelector('[data-element="tileset-table"]')
        this.spriteTableElement = this.querySelector('[data-element="sprite-table"]')
        this.statusElement = this.querySelector('[data-element="status"]')
        assert(this.tilesetTableElement instanceof HTMLTableElement, "view-catalog missing tileset table")
        assert(this.spriteTableElement instanceof HTMLTableElement, "view-catalog missing sprite table")
        assert(this.statusElement instanceof HTMLOutputElement, "view-catalog missing status output")

        this.querySelector('[data-tab="tilesets"]').addEventListener("click", () => this.selectTab("tilesets"))
        this.querySelector('[data-tab="sprites"]').addEventListener("click", () => this.selectTab("sprites"))

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
      <div role="buttongroup" data-element="tool-actions">
        <button type="button" data-action="new" aria-label="New catalog record" title="New"><i aria-hidden="true">add</i></button>
        <button type="button" data-action="edit" aria-label="Edit selected catalog record" title="Edit"><i aria-hidden="true">edit</i></button>
      </div>
    `
        toolbar.querySelector('[data-action="reload"]').addEventListener("click", () => this.refresh())
        toolbar.querySelector('[data-action="new"]').addEventListener("click", () => this.importForActiveTab())
        toolbar.querySelector('[data-action="edit"]').addEventListener("click", () => this.editSelectedForActiveTab())
        return toolbar
    }

    mountHeaderControls() {
        if (!this.parentElement || this.headerControlsElement) return
        const toolbar = this.createHeaderControlsElement()
        this.headerControlsElement = toolbar
        this.parentElement.appendChild(toolbar)
        this.updateHeaderControlsUI()
    }

    unmountHeaderControls() {
        if (!this.headerControlsElement) return
        this.headerControlsElement.remove()
        this.headerControlsElement = null
    }

    selectTab(tab) {
        assert(tab === "tilesets" || tab === "sprites", `unknown catalog tab ${tab}`)
        this.activeTab = tab
        for (const button of this.querySelectorAll('[role="tab"]')) {
            button.setAttribute("aria-selected", button.dataset.tab === tab ? "true" : "false")
        }
        for (const panel of this.querySelectorAll('[role="tabpanel"]')) {
            panel.hidden = panel.dataset.panel !== tab
        }
        this.updateHeaderControlsUI()
        this.updateStatus()
    }

    updateHeaderControlsUI() {
        if (!this.headerControlsElement) return
        const editButton = this.headerControlsElement.querySelector('[data-action="edit"]')
        assert(editButton instanceof HTMLButtonElement, "view-catalog edit button missing")
        editButton.disabled = this.activeTab === "tilesets" ? this.selectedTilesetId <= 0 : this.selectedSpriteId <= 0
    }

    setStatus(text, tone = null) {
        assert(this.statusElement instanceof HTMLOutputElement, "view-catalog status output is not initialized")
        this.statusElement.textContent = text
        this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
        if (tone) this.statusElement.classList.add(tone)
    }

    updateStatus() {
        if (this.activeTab === "tilesets") {
            this.setStatus(`${this.tilesetRows.length} tilesets`, "success")
            return
        }
        this.setStatus(`${this.spriteRows.length} sprites`, "success")
    }

    async importForActiveTab() {
        if (this.activeTab === "sprites") {
            await this.importSprite()
            return
        }
        assert(this.activeTab === "tilesets", `unknown catalog tab ${this.activeTab}`)
        this.setStatus("Tileset import is not implemented yet.", "warning")
    }

    async importSprite() {
        const payload = unwrap(
            await runtime.call("ui.popup.open", {
                title: "Import Sprite",
                size: "large",
                tag: "view-catalog-sprite-import",
            }),
        )
        if (payload?.cancelled) return
        await this.refresh()
        this.selectTab("sprites")
    }

    async editSelectedForActiveTab() {
        if (this.activeTab === "sprites") {
            assert(this.selectedSpriteId > 0, "select a sprite before editing")
            const payload = unwrap(
                await runtime.call("ui.popup.open", {
                    title: "Edit Sprite",
                    size: "large",
                    tag: "view-catalog-sprite-import",
                    props: {
                        mode: "edit",
                        spriteId: this.selectedSpriteId,
                    },
                }),
            )
            if (payload?.cancelled) return
            await this.refresh()
            this.selectTab("sprites")
            return
        }
        assert(this.activeTab === "tilesets", `unknown catalog tab ${this.activeTab}`)
        assert(this.selectedTilesetId > 0, "select a tileset before editing")
        this.setStatus("Tileset editing is not implemented yet.", "warning")
    }

    async refresh() {
        this.setStatus("Loading...", "info")
        this.tilesetRows = await this.fetchTilesets()
        this.spriteRows = await this.fetchSprites()
        if (!this.tilesetRows.some((row) => Number(row.id) === this.selectedTilesetId)) this.selectedTilesetId = 0
        if (!this.spriteRows.some((row) => Number(row.id) === this.selectedSpriteId)) this.selectedSpriteId = 0
        this.renderTilesets()
        this.renderSprites()
        await this.renderTilesetPreviews()
        await this.renderSpritePreviews()
        this.updateHeaderControlsUI()
        this.updateStatus()
    }

    async fetchTilesets() {
        return await sql.queryObjects(
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
    }

    async fetchSprites() {
        return await sql.queryObjects(
            `
        SELECT
          s.id AS id,
          s.name AS name,
          COALESCE(s.display_name, s.name) AS display_name,
          COALESCE(s.description, '') AS description,
          s.image_path AS image_path,
          s.grid_width AS grid_width,
          s.grid_height AS grid_height,
          COUNT(a.id) AS animation_count
        FROM sprite s
        LEFT JOIN sprite_animation a ON a.sprite_id = s.id
        GROUP BY s.id
        ORDER BY s.name
      `,
            ["id", "name", "display_name", "description", "image_path", "grid_width", "grid_height", "animation_count"],
        )
    }

    renderTilesets() {
        assert(this.tilesetTableElement instanceof HTMLTableElement, "view-catalog tileset table is not initialized")
        const body = this.tilesetTableElement.querySelector("tbody")
        assert(body instanceof HTMLTableSectionElement, "view-catalog missing tileset table body")
        body.replaceChildren()

        for (const row of this.tilesetRows) {
            const tr = document.createElement("tr")
            tr.dataset.tilesetId = String(row.id)
            tr.setAttribute("aria-selected", Number(row.id) === this.selectedTilesetId ? "true" : "false")
            tr.addEventListener("click", () => this.selectTileset(Number(row.id)))

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

    renderSprites() {
        assert(this.spriteTableElement instanceof HTMLTableElement, "view-catalog sprite table is not initialized")
        const body = this.spriteTableElement.querySelector("tbody")
        assert(body instanceof HTMLTableSectionElement, "view-catalog missing sprite table body")
        body.replaceChildren()

        for (const row of this.spriteRows) {
            const tr = document.createElement("tr")
            tr.dataset.spriteId = String(row.id)
            tr.setAttribute("aria-selected", Number(row.id) === this.selectedSpriteId ? "true" : "false")
            tr.addEventListener("click", () => this.selectSprite(Number(row.id)))

            const preview = document.createElement("td")
            const canvas = document.createElement("canvas")
            canvas.dataset.element = "preview"
            canvas.dataset.spriteId = String(row.id)
            preview.appendChild(canvas)

            const name = document.createElement("td")
            name.textContent = row.display_name

            const source = document.createElement("td")
            source.textContent = row.image_path

            const grid = document.createElement("td")
            grid.textContent = `${row.grid_width}×${row.grid_height}`

            const animations = document.createElement("td")
            animations.textContent = String(row.animation_count)

            const description = document.createElement("td")
            description.textContent = row.description

            tr.append(preview, name, source, grid, animations, description)
            body.appendChild(tr)
        }
    }

    selectTileset(tilesetId) {
        assert(Number.isInteger(tilesetId) && tilesetId > 0, "tileset selection requires positive id")
        this.selectedTilesetId = tilesetId
        for (const row of this.querySelectorAll("tr[data-tileset-id]")) {
            row.setAttribute("aria-selected", Number(row.dataset.tilesetId) === tilesetId ? "true" : "false")
        }
        this.updateHeaderControlsUI()
    }

    selectSprite(spriteId) {
        assert(Number.isInteger(spriteId) && spriteId > 0, "sprite selection requires positive id")
        this.selectedSpriteId = spriteId
        for (const row of this.querySelectorAll("tr[data-sprite-id]")) {
            row.setAttribute("aria-selected", Number(row.dataset.spriteId) === spriteId ? "true" : "false")
        }
        this.updateHeaderControlsUI()
    }

    async renderTilesetPreviews() {
        const imageCache = new Map()
        for (const row of this.tilesetRows) {
            const canvas = this.querySelector(`canvas[data-tileset-id="${row.id}"]`)
            assert(canvas instanceof HTMLCanvasElement, `view-catalog missing preview canvas for tileset ${row.id}`)
            await this.renderTilesetPreview(canvas, row, imageCache)
        }
    }

    async renderTilesetPreview(canvas, row, imageCache) {
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

    async renderSpritePreviews() {
        const spriteCache = new Map()
        for (const row of this.spriteRows) {
            const canvas = this.querySelector(`canvas[data-sprite-id="${row.id}"]`)
            assert(canvas instanceof HTMLCanvasElement, `view-catalog missing preview canvas for sprite ${row.id}`)
            await this.renderSpritePreview(canvas, row, spriteCache)
        }
    }

    async renderSpritePreview(canvas, row, spriteCache) {
        const path = row.image_path
        assert(typeof path === "string" && path.length > 0, "sprite preview requires image path")
        assert(getExtension(path) === "aseprite" || getExtension(path) === "ase", `sprite preview currently supports aseprite files only: ${path}`)

        let sprite = spriteCache.get(path)
        if (!sprite) {
            sprite = await this.loadAsepriteSprite(path)
            spriteCache.set(path, sprite)
        }

        const source = sprite.preview
        const maxSize = 64
        const scale = Math.max(1, Math.floor(maxSize / Math.max(source.width, source.height)))
        canvas.width = source.width * scale
        canvas.height = source.height * scale
        const ctx = canvas.getContext("2d")
        assert(ctx, "view-catalog sprite preview requires 2d context")
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

        return sprite
    }

    async loadAsepriteSprite(path) {
        let documentResource = null
        try {
            documentResource = unwrap(await runtime.invoke("aseprite/aseprite::open", path), "aseprite open")
            const pixels = unwrap(await runtime.invoke("aseprite/aseprite::render-frame", documentResource, 0), "aseprite render frame")
            return {
                preview: createCanvasFromPixels(pixels, "view-catalog sprite preview"),
            }
        } finally {
            if (documentResource) await runtime.releaseResource(documentResource)
        }
    }
}

if (!customElements.get("view-catalog")) {
    customElements.define("view-catalog", ViewCatalog)
}
