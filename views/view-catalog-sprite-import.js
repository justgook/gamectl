import { runtime, unwrap } from "/core/runtime.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"
import { sql } from "/util/sql.js"

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function basenameWithoutExtension(path) {
    const name = String(path || "").split("/").pop() || ""
    const dot = name.lastIndexOf(".")
    return dot > 0 ? name.slice(0, dot) : name
}

function dirname(path) {
    const normalized = String(path || "").trim().replace(/\/+/g, "/")
    if (!normalized || normalized === "/") return "/"
    const slashIndex = normalized.lastIndexOf("/")
    if (slashIndex <= 0) return "/"
    return normalized.slice(0, slashIndex)
}

function normalizeName(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
}

function assertPositiveInteger(value, name) {
    assert(Number.isInteger(value) && value > 0, `${name} must be a positive integer`)
}

function assertNonNegativeInteger(value, name) {
    assert(Number.isInteger(value) && value >= 0, `${name} must be a non-negative integer`)
}

export class ViewCatalogSpriteImport extends HTMLElement {
    constructor() {
        super()
        this.popupProps = this.popupProps || {}
        this.mode = "import"
        this.spriteId = 0
        this.formElement = null
        this.statusElement = null
        this.draft = {
            imagePath: "",
            name: "",
            displayName: "",
            description: "",
            gridWidth: 1,
            gridHeight: 1,
            width: 0,
            height: 0,
            frameCount: 0,
            animations: [],
        }
    }

    connectedCallback() {
        registerViewPlugin(this)
        if (this.dataset.ready) return
        this.dataset.ready = "1"
        this.popupProps = this.popupProps || {}
        this.mode = String(this.popupProps.mode || "import")
        assert(this.mode === "import" || this.mode === "edit", `unknown sprite import mode ${this.mode}`)
        this.spriteId = Number(this.popupProps.spriteId || 0)
        if (this.mode === "edit") assert(Number.isInteger(this.spriteId) && this.spriteId > 0, "sprite edit requires spriteId")
        this.style.display = "contents"
        this.innerHTML = '<form data-element="form" novalidate></form>'
        this.formElement = this.querySelector('[data-element="form"]')
        assert(this.formElement instanceof HTMLFormElement, "view-catalog-sprite-import missing form")
        this.formElement.addEventListener("submit", async (event) => this.handleSubmit(event))
        void this.initialize()
    }

    async initialize() {
        if (this.mode === "edit") await this.loadSpriteDraft(this.spriteId)
        this.render()
    }

    disconnectedCallback() {
        void unregisterViewPlugin(this)
    }

    setStatus(text, tone = null) {
        assert(this.statusElement instanceof HTMLOutputElement, "view-catalog-sprite-import status output is not initialized")
        this.statusElement.textContent = text
        this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
        if (tone) this.statusElement.classList.add(tone)
    }

    captureDraft() {
        assert(this.formElement instanceof HTMLFormElement, "view-catalog-sprite-import form is not initialized")
        const formData = new FormData(this.formElement)
        this.draft.imagePath = String(formData.get("image-path") || "").trim()
        this.draft.name = normalizeName(formData.get("name"))
        this.draft.displayName = String(formData.get("display-name") || "").trim()
        this.draft.description = String(formData.get("description") || "").trim()
        this.draft.gridWidth = Number(formData.get("grid-width"))
        this.draft.gridHeight = Number(formData.get("grid-height"))

        this.draft.animations = this.draft.animations.map((animation, index) => ({
            name: String(formData.get(`animation-name-${index}`) || "").trim(),
            startFrame: Number(formData.get(`animation-start-${index}`)),
            endFrame: Number(formData.get(`animation-end-${index}`)),
        }))
    }

    render() {
        assert(this.formElement instanceof HTMLFormElement, "view-catalog-sprite-import form is not initialized")
        const isEdit = this.mode === "edit"
        const submitLabel = isEdit ? "Save sprite" : "Import sprite"
        const sourceInfo = this.draft.frameCount > 0 ? `${Number(this.draft.width)}×${Number(this.draft.height)} · ${Number(this.draft.frameCount)} frames` : isEdit ? "Loaded from database." : "Choose an Aseprite file."
        const animationsRows = this.draft.animations
            .map(
                (animation, index) => `
              <tr>
                <td><input type="text" name="animation-name-${index}" value="${escapeHtml(animation.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></td>
                <td><input type="number" name="animation-start-${index}" min="0" value="${Number(animation.startFrame)}"></td>
                <td><input type="number" name="animation-end-${index}" min="0" value="${Number(animation.endFrame)}"></td>
              </tr>
            `,
            )
            .join("")

        this.formElement.innerHTML = `
      <fieldset>
        <legend>Source</legend>
        <label>Image path
          <input type="text" name="image-path" value="${escapeHtml(this.draft.imagePath)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </label>
        <button type="submit" name="intent" value="choose-file">Choose file</button>
        <output data-element="source-info">${sourceInfo}</output>
      </fieldset>

      <fieldset>
        <legend>Sprite record</legend>
        <label>Name
          <input type="text" name="name" value="${escapeHtml(this.draft.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </label>
        <label>Display name
          <input type="text" name="display-name" value="${escapeHtml(this.draft.displayName)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </label>
        <label>Description
          <textarea name="description" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">${escapeHtml(this.draft.description)}</textarea>
        </label>
        <label>Grid width
          <input type="number" name="grid-width" min="1" value="${Number(this.draft.gridWidth)}">
        </label>
        <label>Grid height
          <input type="number" name="grid-height" min="1" value="${Number(this.draft.gridHeight)}">
        </label>
      </fieldset>

      <fieldset>
        <legend>Animations</legend>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Start frame</th>
              <th>End frame</th>
            </tr>
          </thead>
          <tbody>${animationsRows}</tbody>
        </table>
      </fieldset>

      <footer>
        <output data-element="status"></output>
        <button type="submit" name="intent" value="cancel">Cancel</button>
        <button type="submit" name="intent" value="save" class="accent">${submitLabel}</button>
      </footer>
    `
        this.statusElement = this.formElement.querySelector('[data-element="status"]')
        assert(this.statusElement instanceof HTMLOutputElement, "view-catalog-sprite-import missing status output")
    }

    async chooseFile() {
        const payload = unwrap(
            await runtime.call("ui.popup.open", {
                title: "Choose Sprite Source",
                size: "large",
                tag: "view-files",
                props: {
                    mode: "chooser",
                    rootPath: dirname(this.draft.imagePath || "catalog/sprites"),
                    filter: "*.aseprite,*.ase",
                },
            }),
        )
        if (payload?.cancelled) return
        const selection = payload?.selection
        assert(selection && !Array.isArray(selection), "sprite import requires one selected file")
        const path = String(selection.path || "").trim()
        assert(path, "sprite import selected file requires path")
        await this.loadAsepriteDraft(path)
    }

    async loadAsepriteDraft(path) {
        let documentResource = null
        try {
            documentResource = unwrap(await runtime.invoke("aseprite/aseprite::open", path), "aseprite open")
            const info = unwrap(await runtime.invoke("aseprite/aseprite::info", documentResource), "aseprite info")
            const frames = unwrap(await runtime.invoke("aseprite/aseprite::frames", documentResource), "aseprite frames")
            const tags = unwrap(await runtime.invoke("aseprite/aseprite::tags", documentResource), "aseprite tags")
            const baseName = basenameWithoutExtension(path)
            this.draft.imagePath = path
            this.draft.name = normalizeName(baseName)
            this.draft.displayName = baseName
            this.draft.width = Number(info.width)
            this.draft.height = Number(info.height)
            this.draft.frameCount = frames.length
            this.draft.animations = tags.map((tag) => ({
                name: String(tag.name || "").trim(),
                startFrame: Number(tag["from-frame"] ?? tag.from),
                endFrame: Number(tag["to-frame"] ?? tag.to),
            }))
            assertPositiveInteger(this.draft.width, "sprite source width")
            assertPositiveInteger(this.draft.height, "sprite source height")
            assertPositiveInteger(this.draft.frameCount, "sprite source frame count")
            for (const animation of this.draft.animations) {
                assert(animation.name, "sprite animation requires name")
                assertNonNegativeInteger(animation.startFrame, `sprite animation ${animation.name} start frame`)
                assertNonNegativeInteger(animation.endFrame, `sprite animation ${animation.name} end frame`)
                assert(animation.endFrame >= animation.startFrame, `sprite animation ${animation.name} end frame must be >= start frame`)
            }
        } finally {
            if (documentResource) await runtime.releaseResource(documentResource)
        }
    }

    async loadSpriteDraft(spriteId) {
        const sprites = await sql.queryObjects(
            `SELECT
               id,
               name,
               COALESCE(display_name, '') AS display_name,
               COALESCE(description, '') AS description,
               image_path,
               grid_width,
               grid_height
             FROM sprite
             WHERE id = ?`,
            ["id", "name", "display_name", "description", "image_path", "grid_width", "grid_height"],
            [String(spriteId)],
        )
        assert(sprites.length === 1, `expected one sprite for id ${spriteId}, got ${sprites.length}`)
        const sprite = sprites[0]
        const animations = await sql.queryObjects(
            `SELECT name, start_frame, end_frame
             FROM sprite_animation
             WHERE sprite_id = ?
             ORDER BY start_frame, id`,
            ["name", "start_frame", "end_frame"],
            [String(spriteId)],
        )
        this.draft.imagePath = String(sprite.image_path)
        this.draft.name = String(sprite.name)
        this.draft.displayName = String(sprite.display_name)
        this.draft.description = String(sprite.description)
        this.draft.gridWidth = Number(sprite.grid_width)
        this.draft.gridHeight = Number(sprite.grid_height)
        this.draft.width = 0
        this.draft.height = 0
        this.draft.frameCount = 0
        this.draft.animations = animations.map((animation) => ({
            name: String(animation.name),
            startFrame: Number(animation.start_frame),
            endFrame: Number(animation.end_frame),
        }))
    }

    validateDraft() {
        assert(this.draft.imagePath, "Choose a sprite source file")
        assert(this.draft.name, "Sprite name is required")
        assertPositiveInteger(this.draft.gridWidth, "grid width")
        assertPositiveInteger(this.draft.gridHeight, "grid height")
        assert(this.draft.animations.length > 0, "Sprite import requires at least one animation")
        const names = new Set()
        for (const animation of this.draft.animations) {
            assert(animation.name, "Animation name is required")
            assert(!names.has(animation.name), `Duplicate animation name: ${animation.name}`)
            names.add(animation.name)
            assertNonNegativeInteger(animation.startFrame, `animation ${animation.name} start frame`)
            assertNonNegativeInteger(animation.endFrame, `animation ${animation.name} end frame`)
            assert(animation.endFrame >= animation.startFrame, `animation ${animation.name} end frame must be >= start frame`)
        }
    }

    async saveSprite() {
        this.validateDraft()
        await sql.exec("BEGIN TRANSACTION", [])
        try {
            let spriteId = this.spriteId
            if (this.mode === "edit") {
                assert(Number.isInteger(spriteId) && spriteId > 0, "sprite edit requires spriteId")
                await sql.exec(
                    `UPDATE sprite
                     SET name = ?, display_name = ?, description = ?, image_path = ?, grid_width = ?, grid_height = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [
                        this.draft.name,
                        this.draft.displayName,
                        this.draft.description,
                        this.draft.imagePath,
                        String(this.draft.gridWidth),
                        String(this.draft.gridHeight),
                        String(spriteId),
                    ],
                )
                await sql.exec("DELETE FROM sprite_animation WHERE sprite_id = ?", [String(spriteId)])
            } else {
                await sql.exec(
                    `INSERT INTO sprite (name, display_name, description, image_path, grid_width, grid_height)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        this.draft.name,
                        this.draft.displayName,
                        this.draft.description,
                        this.draft.imagePath,
                        String(this.draft.gridWidth),
                        String(this.draft.gridHeight),
                    ],
                )
                spriteId = await sql.value("SELECT last_insert_rowid()", [])
            }
            for (const animation of this.draft.animations) {
                await sql.exec(
                    `INSERT INTO sprite_animation (sprite_id, name, start_frame, end_frame)
                     VALUES (?, ?, ?, ?)`,
                    [String(spriteId), animation.name, String(animation.startFrame), String(animation.endFrame)],
                )
            }
            await sql.exec("COMMIT", [])
        } catch (error) {
            await sql.exec("ROLLBACK", [])
            throw error
        }
    }

    async handleSubmit(event) {
        event.preventDefault()
        const formData = new FormData(this.formElement, event.submitter || undefined)
        const intent = String(formData.get("intent") || "save")
        this.captureDraft()

        if (intent === "cancel") {
            await runtime.call("ui.popup.close", { ok: false, cancelled: true })
            return
        }

        if (intent === "choose-file") {
            try {
                await this.chooseFile()
            } catch (error) {
                this.setStatus(String(error?.message || error), "danger")
                return
            }
            this.render()
            this.setStatus("Loaded sprite source.", "success")
            return
        }

        assert(intent === "save", `unknown sprite import intent ${intent}`)
        try {
            await this.saveSprite()
            await runtime.call("ui.popup.close", { ok: true, cancelled: false, mode: this.mode, spriteId: this.spriteId, spriteName: this.draft.name })
        } catch (error) {
            this.setStatus(String(error?.message || error), "danger")
        }
    }
}

if (!customElements.get("view-catalog-sprite-import")) {
    customElements.define("view-catalog-sprite-import", ViewCatalogSpriteImport)
}
