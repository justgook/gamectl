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

function assertNonNegativeInteger(value, name) {
    assert(Number.isInteger(value) && value >= 0, `${name} must be a non-negative integer`)
}

export class ViewCatalogNinePatchEdit extends HTMLElement {
    constructor() {
        super()
        this.popupProps = this.popupProps || {}
        this.mode = "import"
        this.ninePatchId = 0
        this.formElement = null
        this.statusElement = null
        this.draft = {
            imagePath: "",
            name: "",
            displayName: "",
            description: "",
            sliceLeft: 0,
            sliceTop: 0,
            sliceRight: 1,
            sliceBottom: 1,
        }
    }

    connectedCallback() {
        registerViewPlugin(this)
        if (this.dataset.ready) return
        this.dataset.ready = "1"
        this.popupProps = this.popupProps || {}
        this.mode = String(this.popupProps.mode || "import")
        assert(this.mode === "import" || this.mode === "edit", `unknown nine-patch edit mode ${this.mode}`)
        this.ninePatchId = Number(this.popupProps.ninePatchId || 0)
        if (this.mode === "edit") assert(Number.isInteger(this.ninePatchId) && this.ninePatchId > 0, "nine-patch edit requires ninePatchId")
        this.style.display = "contents"
        this.innerHTML = '<form data-element="form" novalidate></form>'
        this.formElement = this.querySelector('[data-element="form"]')
        assert(this.formElement instanceof HTMLFormElement, "view-catalog-nine-patch-edit missing form")
        this.formElement.addEventListener("submit", async (event) => this.handleSubmit(event))
        void this.initialize()
    }

    disconnectedCallback() {
        void unregisterViewPlugin(this)
    }

    async initialize() {
        if (this.mode === "edit") await this.loadDraft(this.ninePatchId)
        this.render()
    }

    setStatus(text, tone = null) {
        assert(this.statusElement instanceof HTMLOutputElement, "view-catalog-nine-patch-edit status output is not initialized")
        this.statusElement.textContent = text
        this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
        if (tone) this.statusElement.classList.add(tone)
    }

    captureDraft() {
        assert(this.formElement instanceof HTMLFormElement, "view-catalog-nine-patch-edit form is not initialized")
        const formData = new FormData(this.formElement)
        this.draft.imagePath = String(formData.get("image-path") || "").trim()
        this.draft.name = normalizeName(formData.get("name"))
        this.draft.displayName = String(formData.get("display-name") || "").trim()
        this.draft.description = String(formData.get("description") || "").trim()
        this.draft.sliceLeft = Number(formData.get("slice-left"))
        this.draft.sliceTop = Number(formData.get("slice-top"))
        this.draft.sliceRight = Number(formData.get("slice-right"))
        this.draft.sliceBottom = Number(formData.get("slice-bottom"))
    }

    render() {
        assert(this.formElement instanceof HTMLFormElement, "view-catalog-nine-patch-edit form is not initialized")
        const submitLabel = this.mode === "edit" ? "Save nine patch" : "Import nine patch"
        this.formElement.innerHTML = `
      <fieldset>
        <legend>Source</legend>
        <label>Image path
          <input type="text" name="image-path" value="${escapeHtml(this.draft.imagePath)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </label>
        <button type="submit" name="intent" value="choose-file">Choose file</button>
      </fieldset>

      <fieldset>
        <legend>Nine patch record</legend>
        <label>Name
          <input type="text" name="name" value="${escapeHtml(this.draft.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </label>
        <label>Display name
          <input type="text" name="display-name" value="${escapeHtml(this.draft.displayName)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        </label>
        <label>Description
          <textarea name="description" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">${escapeHtml(this.draft.description)}</textarea>
        </label>
      </fieldset>

      <fieldset>
        <legend>Slice lines</legend>
        <label>Left
          <input type="number" name="slice-left" min="0" value="${Number(this.draft.sliceLeft)}">
        </label>
        <label>Top
          <input type="number" name="slice-top" min="0" value="${Number(this.draft.sliceTop)}">
        </label>
        <label>Right
          <input type="number" name="slice-right" min="1" value="${Number(this.draft.sliceRight)}">
        </label>
        <label>Bottom
          <input type="number" name="slice-bottom" min="1" value="${Number(this.draft.sliceBottom)}">
        </label>
      </fieldset>

      <footer>
        <output data-element="status"></output>
        <button type="submit" name="intent" value="cancel">Cancel</button>
        <button type="submit" name="intent" value="save" class="accent">${submitLabel}</button>
      </footer>
    `
        this.statusElement = this.formElement.querySelector('[data-element="status"]')
        assert(this.statusElement instanceof HTMLOutputElement, "view-catalog-nine-patch-edit missing status output")
    }

    async chooseFile() {
        const payload = unwrap(
            await runtime.call("ui.popup.open", {
                title: "Choose Nine Patch Source",
                size: "large",
                tag: "view-files",
                props: {
                    mode: "chooser",
                    rootPath: dirname(this.draft.imagePath || "catalog/nine-patches"),
                    filter: "*.qoi,*.png,*.jpg,*.jpeg,*.webp,*.aseprite,*.ase",
                },
            }),
        )
        if (payload?.cancelled) return
        const selection = payload?.selection
        assert(selection && !Array.isArray(selection), "nine-patch import requires one selected file")
        const path = String(selection.path || "").trim()
        assert(path, "nine-patch selected file requires path")
        const baseName = basenameWithoutExtension(path)
        this.draft.imagePath = path
        if (!this.draft.name) this.draft.name = normalizeName(baseName)
        if (!this.draft.displayName) this.draft.displayName = baseName
    }

    async loadDraft(ninePatchId) {
        const rows = await sql.queryObjects(
            `SELECT id, name, COALESCE(display_name, '') AS display_name, COALESCE(description, '') AS description,
                    image_path, slice_left, slice_top, slice_right, slice_bottom
             FROM nine_patch
             WHERE id = ?`,
            ["id", "name", "display_name", "description", "image_path", "slice_left", "slice_top", "slice_right", "slice_bottom"],
            [String(ninePatchId)],
        )
        assert(rows.length === 1, `expected one nine_patch for id ${ninePatchId}, got ${rows.length}`)
        const row = rows[0]
        this.draft.imagePath = String(row.image_path)
        this.draft.name = String(row.name)
        this.draft.displayName = String(row.display_name)
        this.draft.description = String(row.description)
        this.draft.sliceLeft = Number(row.slice_left)
        this.draft.sliceTop = Number(row.slice_top)
        this.draft.sliceRight = Number(row.slice_right)
        this.draft.sliceBottom = Number(row.slice_bottom)
    }

    validateDraft() {
        assert(this.draft.imagePath, "Choose a nine-patch source file")
        assert(this.draft.name, "Nine-patch name is required")
        assertNonNegativeInteger(this.draft.sliceLeft, "slice left")
        assertNonNegativeInteger(this.draft.sliceTop, "slice top")
        assertNonNegativeInteger(this.draft.sliceRight, "slice right")
        assertNonNegativeInteger(this.draft.sliceBottom, "slice bottom")
        assert(this.draft.sliceRight > this.draft.sliceLeft, "slice right must be greater than slice left")
        assert(this.draft.sliceBottom > this.draft.sliceTop, "slice bottom must be greater than slice top")
    }

    async saveNinePatch() {
        this.validateDraft()
        if (this.mode === "edit") {
            await sql.exec(
                `UPDATE nine_patch
                 SET name = ?, display_name = ?, description = ?, image_path = ?,
                     slice_left = ?, slice_top = ?, slice_right = ?, slice_bottom = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    this.draft.name,
                    this.draft.displayName,
                    this.draft.description,
                    this.draft.imagePath,
                    String(this.draft.sliceLeft),
                    String(this.draft.sliceTop),
                    String(this.draft.sliceRight),
                    String(this.draft.sliceBottom),
                    String(this.ninePatchId),
                ],
            )
            return
        }
        await sql.exec(
            `INSERT INTO nine_patch (name, display_name, description, image_path, slice_left, slice_top, slice_right, slice_bottom)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                this.draft.name,
                this.draft.displayName,
                this.draft.description,
                this.draft.imagePath,
                String(this.draft.sliceLeft),
                String(this.draft.sliceTop),
                String(this.draft.sliceRight),
                String(this.draft.sliceBottom),
            ],
        )
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
            this.setStatus("Loaded nine-patch source.", "success")
            return
        }

        assert(intent === "save", `unknown nine-patch intent ${intent}`)
        try {
            await this.saveNinePatch()
            await runtime.call("ui.popup.close", { ok: true, cancelled: false, mode: this.mode, ninePatchName: this.draft.name })
        } catch (error) {
            this.setStatus(String(error?.message || error), "danger")
        }
    }
}

if (!customElements.get("view-catalog-nine-patch-edit")) {
    customElements.define("view-catalog-nine-patch-edit", ViewCatalogNinePatchEdit)
}
