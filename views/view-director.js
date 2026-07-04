import { runtime, unwrap } from "/core/runtime.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"

const EMPTY_DOCUMENT = Object.freeze({
    settings: Object.freeze({ name: "Game Director", description: "" }),
    manifest: Object.freeze([]),
    rules: Object.freeze([]),
})

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

function textInputAttrs() {
    return 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"'
}

function newRowId(prefix) {
    return `${prefix}_${Date.now()}_${crypto.randomUUID()}`
}

function normalizeDocument(raw) {
    assert(isPlainObject(raw), "director document root must be an object")
    const settings = isPlainObject(raw.settings) ? raw.settings : EMPTY_DOCUMENT.settings
    const manifest = Array.isArray(raw.manifest) ? raw.manifest : EMPTY_DOCUMENT.manifest
    const rules = Array.isArray(raw.rules) ? raw.rules : EMPTY_DOCUMENT.rules
    return {
        settings: {
            name: String(settings.name || "Game Director"),
            description: String(settings.description || ""),
        },
        manifest: manifest.map((row, index) => normalizeManifestRow(row, index)),
        rules: rules.map((row, index) => normalizeRuleRow(row, index)),
    }
}

function normalizeManifestRow(raw, index) {
    assert(isPlainObject(raw), `director manifest[${index}] must be an object`)
    return {
        id: String(raw.id || raw.createdAt || `manifest_${index}`),
        entity: String(raw.entity || ""),
        name: String(raw.name || ""),
        description: String(raw.description || ""),
    }
}

function normalizeRuleRow(raw, index) {
    assert(isPlainObject(raw), `director rules[${index}] must be an object`)
    return {
        id: String(raw.id || raw.createdAt || `rule_${index}`),
        rule_id: String(raw.rule_id || raw.ruleId || ""),
        rule: String(raw.rule || ""),
        narrative: String(raw.narrative || ""),
    }
}

function stringifyDocument(document) {
    return `${JSON.stringify(document, null, 2)}\n`
}

function entityIdFromEntityText(entityText) {
    const text = String(entityText || "").trim()
    if (!text) return ""
    const match = text.match(/^([A-Za-z0-9_-]+)/)
    return match ? match[1] : ""
}

function propertyKeysFromText(text) {
    const keys = new Set()
    for (const match of String(text || "").matchAll(/\.-?([A-Za-z0-9_-]+)/g)) {
        if (match[1]) keys.add(match[1])
    }
    return keys
}

function validateDirectorDocument(document) {
    const errors = []
    const entityIds = new Map()
    for (const [index, row] of document.manifest.entries()) {
        const entityId = entityIdFromEntityText(row.entity)
        if (!entityId) errors.push(`manifest row ${index + 1}: entity id is required`)
        if (entityId) {
            if (entityIds.has(entityId)) errors.push(`manifest row ${index + 1}: duplicate entity id ${entityId}`)
            entityIds.set(entityId, row.id)
        }
    }

    const ruleIds = new Set()
    for (const [index, row] of document.rules.entries()) {
        const ruleId = row.rule_id.trim()
        if (!ruleId) errors.push(`rule row ${index + 1}: rule id is required`)
        if (ruleId) {
            if (ruleIds.has(ruleId)) errors.push(`rule row ${index + 1}: duplicate rule id ${ruleId}`)
            ruleIds.add(ruleId)
        }
        const ruleText = row.rule.trim()
        if (!ruleText) errors.push(`rule row ${index + 1}: rule text is required`)
        if (ruleText && !/^ON:\s+/m.test(ruleText)) errors.push(`rule row ${index + 1}: rule must contain ON:`)
    }
    return errors
}

function completionContext(input, mode) {
    const value = input.value
    const cursor = Number(input.selectionStart || 0)
    const before = value.slice(0, cursor)
    const propertyMatch = before.match(/((?:\$|\*|[A-Za-z0-9_-]+)\.-?)([A-Za-z0-9_-]*)$/)
    if (propertyMatch) {
        return {
            kind: "property",
            prefix: propertyMatch[2],
            start: cursor - propertyMatch[2].length,
            end: cursor,
        }
    }

    const entityPattern = mode === "manifest" ? /(^|[A-Za-z0-9_-]+=\(?(?:link\s+)?)([A-Z0-9_-]*)$/ : /(\s*|[A-Za-z0-9_-]+=\(?(?:link\s+)?)([A-Z0-9_-]*)$/
    const entityMatch = before.match(entityPattern)
    if (entityMatch) {
        return {
            kind: "entity",
            prefix: entityMatch[2],
            start: cursor - entityMatch[2].length,
            end: cursor,
        }
    }
    return null
}

function replaceInputRange(input, start, end, replacement) {
    const value = input.value
    input.value = `${value.slice(0, start)}${replacement}${value.slice(end)}`
    const cursor = start + replacement.length
    input.focus()
    input.setSelectionRange(cursor, cursor)
    input.dispatchEvent(new Event("input", { bubbles: true }))
}

export class ViewDirector extends HTMLElement {
    static get observedAttributes() {
        return ["data-source"]
    }

    constructor() {
        super()
        this.path = ""
        this.document = normalizeDocument(EMPTY_DOCUMENT)
        this.activeTab = "manifest"
        this.selectedKind = "manifest"
        this.selectedId = ""
        this.dirty = false
        this.headerControlsElement = null
        this.suppressDataSourceReload = false
        this.statusElement = null
        this.manifestTableElement = null
        this.rulesTableElement = null
        this.settingsPanelElement = null
    }

    connectedCallback() {
        registerViewPlugin(this)
        if (this.dataset.ready) {
            this.mountHeaderControls()
            return
        }
        this.dataset.ready = "1"
        this.style.display = "contents"
        this.path = this.resolveSourcePath()

        this.innerHTML = `
      <article>
        <div role="tablist">
          <button type="button" role="tab" data-tab="manifest" aria-selected="true">Manifest</button>
          <button type="button" role="tab" data-tab="rules" aria-selected="false">Rules</button>
          <button type="button" role="tab" data-tab="settings" aria-selected="false">Settings</button>
        </div>
        <section role="tabpanel" data-panel="manifest">
          <table data-element="manifest-table">
            <thead>
              <tr>
                <th>Entity definition</th>
                <th>Name</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </section>
        <section role="tabpanel" data-panel="rules" hidden>
          <table data-element="rules-table">
            <thead>
              <tr>
                <th>Rule ID</th>
                <th>Rule</th>
                <th>Narrative</th>
                <th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </section>
        <section role="tabpanel" data-panel="settings" hidden>
          <form data-element="settings-form" novalidate>
            <fieldset>
              <legend>Source</legend>
              <label>Path <input type="text" data-field="path" ${textInputAttrs()}></label>
              <label>Name <input type="text" data-field="name" ${textInputAttrs()}></label>
              <label>Description <textarea data-field="description" ${textInputAttrs()}></textarea></label>
            </fieldset>
          </form>
        </section>
      </article>
      <footer data-element="footer">
        <output data-element="status">Loading...</output>
      </footer>
    `

        this.manifestTableElement = this.querySelector('[data-element="manifest-table"]')
        this.rulesTableElement = this.querySelector('[data-element="rules-table"]')
        this.settingsPanelElement = this.querySelector('[data-panel="settings"]')
        this.statusElement = this.querySelector('[data-element="status"]')
        assert(this.manifestTableElement instanceof HTMLTableElement, "view-director missing manifest table")
        assert(this.rulesTableElement instanceof HTMLTableElement, "view-director missing rules table")
        assert(this.settingsPanelElement instanceof HTMLElement, "view-director missing settings panel")
        assert(this.statusElement instanceof HTMLOutputElement, "view-director missing status output")

        this.querySelector('[data-tab="manifest"]').addEventListener("click", () => this.selectTab("manifest"))
        this.querySelector('[data-tab="rules"]').addEventListener("click", () => this.selectTab("rules"))
        this.querySelector('[data-tab="settings"]').addEventListener("click", () => this.selectTab("settings"))
        this.addEventListener("input", (event) => this.handleInput(event))
        this.addEventListener("keydown", (event) => this.handleKeyDown(event))
        this.addEventListener("click", (event) => this.handleClick(event))

        this.mountHeaderControls()
        void this.load()
    }

    disconnectedCallback() {
        this.unmountHeaderControls()
        void unregisterViewPlugin(this)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        if (name !== "data-source") return
        this.path = String(newValue || "").trim()
        if (this.suppressDataSourceReload) return
        if (this.dataset.ready) void this.load()
    }

    resolveSourcePath() {
        const attr = String(this.getAttribute("data-source") || "").trim()
        if (attr) return attr
        const configSource = String(this.config && this.config.defaultSource ? this.config.defaultSource : "").trim()
        if (configSource) return configSource
        const viewSource = String(this.viewConfig && this.viewConfig.defaultSource ? this.viewConfig.defaultSource : "").trim()
        assert(viewSource, "view-director requires data-source or defaultSource")
        return viewSource
    }

    createHeaderControlsElement() {
        const toolbar = document.createElement("div")
        toolbar.dataset.element = "toolbar"
        toolbar.setAttribute("slot", "header-controls")
        toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="open" aria-label="Open Director source" title="Open"><i aria-hidden="true">folder_open</i></button>
        <button type="button" data-action="reload" aria-label="Reload Director source" title="Reload"><i aria-hidden="true">refresh</i></button>
        <button type="button" data-action="save" aria-label="Save Director source" title="Save"><i aria-hidden="true">save</i></button>
        <button type="button" data-action="save-as" aria-label="Save Director source as" title="Save As"><i aria-hidden="true">save_as</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <button type="button" data-action="add" aria-label="Add row" title="Add row"><i aria-hidden="true">add</i></button>
        <button type="button" data-action="delete" aria-label="Delete selected row" title="Delete selected row"><i aria-hidden="true">delete</i></button>
      </div>
    `
        toolbar.querySelector('[data-action="open"]').addEventListener("click", () => this.open())
        toolbar.querySelector('[data-action="reload"]').addEventListener("click", () => this.reload())
        toolbar.querySelector('[data-action="save"]').addEventListener("click", () => this.save())
        toolbar.querySelector('[data-action="save-as"]').addEventListener("click", () => this.saveAs())
        toolbar.querySelector('[data-action="add"]').addEventListener("click", () => this.add())
        toolbar.querySelector('[data-action="delete"]').addEventListener("click", () => this.deleteSelected())
        return toolbar
    }

    mountHeaderControls() {
        if (!this.parentElement || this.headerControlsElement) return
        this.headerControlsElement = this.createHeaderControlsElement()
        this.parentElement.appendChild(this.headerControlsElement)
        this.updateHeaderControlsUI()
    }

    unmountHeaderControls() {
        if (!this.headerControlsElement) return
        this.headerControlsElement.remove()
        this.headerControlsElement = null
    }

    updateHeaderControlsUI() {
        if (!this.headerControlsElement) return
        const deleteButton = this.headerControlsElement.querySelector('[data-action="delete"]')
        assert(deleteButton instanceof HTMLButtonElement, "view-director delete button missing")
        deleteButton.disabled = !this.selectedId
    }

    selectTab(tab) {
        assert(tab === "manifest" || tab === "rules" || tab === "settings", `view-director unknown tab ${tab}`)
        this.activeTab = tab
        for (const button of this.querySelectorAll('[role="tab"]')) {
            button.setAttribute("aria-selected", button.dataset.tab === tab ? "true" : "false")
        }
        for (const panel of this.querySelectorAll('[role="tabpanel"]')) {
            panel.hidden = panel.dataset.panel !== tab
        }
        if (tab === "manifest" || tab === "rules") this.selectedKind = tab
        this.updateStatus()
    }

    setStatus(text, tone = null) {
        assert(this.statusElement instanceof HTMLOutputElement, "view-director status output is not initialized")
        this.statusElement.textContent = text
        this.statusElement.classList.remove("accent", "success", "warning", "danger", "info")
        if (tone) this.statusElement.classList.add(tone)
    }

    updateStatus() {
        const errors = validateDirectorDocument(this.document)
        if (errors.length) {
            this.setStatus(`${errors.length} validation problem${errors.length === 1 ? "" : "s"}: ${errors[0]}`, "warning")
            return
        }
        const dirtyText = this.dirty ? "Unsaved" : "Saved"
        this.setStatus(`${dirtyText}: ${this.document.manifest.length} entities, ${this.document.rules.length} rules`, this.dirty ? "warning" : "success")
    }

    async load() {
        assert(this.path, "view-director load requires path")
        this.setStatus(`Loading ${this.path}...`, "info")
        const text = unwrap(await runtime.invoke("fs/fs::read-text", this.path), this.path)
        this.document = normalizeDocument(JSON.parse(text))
        this.dirty = false
        this.selectedId = ""
        this.render()
        this.updateStatus()
    }

    async reload() {
        await this.load()
        return true
    }

    async save() {
        assert(this.path, "view-director save requires path")
        this.syncSettingsFromDom()
        unwrap(await runtime.invoke("fs/fs::write-text", this.path, stringifyDocument(this.document)), this.path)
        this.dirty = false
        this.renderSettings()
        this.updateStatus()
        await runtime.call("ui.toast.success", { message: `Saved Director source to ${this.path}` })
        return true
    }

    async saveAs() {
        const payload = unwrap(
            await runtime.call("ui.popup.open", {
                title: "Save Director As",
                size: "medium",
                tag: "view-files",
                props: {
                    mode: "saver",
                    filter: "*.director.json,*.json",
                    defaultName: "director.director.json",
                },
            }),
        )
        if (!payload || payload.cancelled) return false
        assert(payload.path, "view-director save-as requires selected path")
        this.path = payload.path
        this.suppressDataSourceReload = true
        this.setAttribute("data-source", this.path)
        this.suppressDataSourceReload = false
        await this.save()
        return true
    }

    async open() {
        const payload = unwrap(
            await runtime.call("ui.popup.open", {
                title: "Open Director",
                size: "medium",
                tag: "view-files",
                props: { mode: "chooser", filter: "*.director.json,*.json" },
            }),
        )
        if (!payload || payload.cancelled) return false
        const selection = payload.selection
        const path = Array.isArray(selection) ? String(selection[0].path || "") : String(selection.path || "")
        assert(path, "view-director open requires selected path")
        this.path = path
        this.suppressDataSourceReload = true
        this.setAttribute("data-source", this.path)
        this.suppressDataSourceReload = false
        await this.load()
        return true
    }

    new() {
        this.document = normalizeDocument(EMPTY_DOCUMENT)
        this.dirty = true
        this.selectedId = ""
        this.render()
        this.updateStatus()
        return true
    }

    add() {
        if (this.activeTab === "rules") {
            const row = { id: newRowId("rule"), rule_id: "", rule: "ON: ", narrative: "" }
            this.document.rules.push(row)
            this.selectedKind = "rules"
            this.selectedId = row.id
        } else {
            const row = { id: newRowId("manifest"), entity: "", name: "", description: "" }
            this.document.manifest.push(row)
            this.selectedKind = "manifest"
            this.selectedId = row.id
        }
        this.markDirty()
        this.render()
        this.focusSelectedFirstField()
        return true
    }

    deleteSelected() {
        if (!this.selectedId) return false
        if (this.selectedKind === "rules") this.document.rules = this.document.rules.filter((row) => row.id !== this.selectedId)
        else this.document.manifest = this.document.manifest.filter((row) => row.id !== this.selectedId)
        this.selectedId = ""
        this.markDirty()
        this.render()
        return true
    }

    markDirty() {
        this.dirty = true
        this.updateStatus()
    }

    render() {
        this.renderManifest()
        this.renderRules()
        this.renderSettings()
        this.updateHeaderControlsUI()
    }

    renderManifest() {
        const tbody = this.manifestTableElement.querySelector("tbody")
        assert(tbody instanceof HTMLTableSectionElement, "view-director manifest tbody missing")
        tbody.innerHTML = this.document.manifest.map((row) => this.renderManifestRow(row)).join("")
    }

    renderManifestRow(row) {
        const selected = this.selectedKind === "manifest" && this.selectedId === row.id
        return `
      <tr data-kind="manifest" data-row-id="${escapeHtml(row.id)}" aria-selected="${selected ? "true" : "false"}">
        <td><input type="text" data-field="entity" value="${escapeHtml(row.entity)}" ${textInputAttrs()} placeholder="PLAYER.current_location=ROOM.level=0"></td>
        <td><input type="text" data-field="name" value="${escapeHtml(row.name)}" ${textInputAttrs()}></td>
        <td><textarea data-field="description" ${textInputAttrs()}>${escapeHtml(row.description)}</textarea></td>
        <td><button type="button" data-action="delete-row" aria-label="Delete entity"><i aria-hidden="true">delete</i></button></td>
      </tr>
    `
    }

    renderRules() {
        const tbody = this.rulesTableElement.querySelector("tbody")
        assert(tbody instanceof HTMLTableSectionElement, "view-director rules tbody missing")
        tbody.innerHTML = this.document.rules.map((row) => this.renderRuleRow(row)).join("")
    }

    renderRuleRow(row) {
        const selected = this.selectedKind === "rules" && this.selectedId === row.id
        return `
      <tr data-kind="rules" data-row-id="${escapeHtml(row.id)}" aria-selected="${selected ? "true" : "false"}">
        <td><input type="text" data-field="rule_id" value="${escapeHtml(row.rule_id)}" ${textInputAttrs()}></td>
        <td><textarea data-field="rule" ${textInputAttrs()} placeholder="ON: PLAYER\nIF: PLAYER.level=0\nDO: PLAYER.level+1">${escapeHtml(row.rule)}</textarea></td>
        <td><textarea data-field="narrative" ${textInputAttrs()}>${escapeHtml(row.narrative)}</textarea></td>
        <td><button type="button" data-action="delete-row" aria-label="Delete rule"><i aria-hidden="true">delete</i></button></td>
      </tr>
    `
    }

    renderSettings() {
        const pathInput = this.settingsPanelElement.querySelector('[data-field="path"]')
        const nameInput = this.settingsPanelElement.querySelector('[data-field="name"]')
        const descriptionInput = this.settingsPanelElement.querySelector('[data-field="description"]')
        assert(pathInput instanceof HTMLInputElement, "view-director settings path input missing")
        assert(nameInput instanceof HTMLInputElement, "view-director settings name input missing")
        assert(descriptionInput instanceof HTMLTextAreaElement, "view-director settings description input missing")
        pathInput.value = this.path
        nameInput.value = this.document.settings.name
        descriptionInput.value = this.document.settings.description
    }

    focusSelectedFirstField() {
        if (!this.selectedId) return
        const row = this.querySelector(`tr[data-row-id="${CSS.escape(this.selectedId)}"]`)
        if (!row) return
        const input = row.querySelector("input, textarea")
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.focus()
    }

    handleClick(event) {
        const target = event.target
        if (!(target instanceof Element)) return
        const row = target.closest("tr[data-row-id]")
        if (row instanceof HTMLTableRowElement) this.selectRow(row)
        const action = target.closest("button[data-action]")
        if (!(action instanceof HTMLButtonElement)) return
        if (action.dataset.action === "delete-row") {
            event.preventDefault()
            this.deleteSelected()
        }
    }

    selectRow(row) {
        const kind = String(row.dataset.kind || "")
        assert(kind === "manifest" || kind === "rules", `view-director unknown row kind ${kind}`)
        this.selectedKind = kind
        this.selectedId = String(row.dataset.rowId || "")
        for (const other of this.querySelectorAll("tr[data-row-id]")) other.setAttribute("aria-selected", "false")
        row.setAttribute("aria-selected", "true")
        this.updateHeaderControlsUI()
    }

    handleInput(event) {
        const target = event.target
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
        const field = String(target.dataset.field || "")
        if (target.closest('[data-panel="settings"]')) {
            assert(field === "path" || field === "name" || field === "description", `view-director unknown settings field ${field}`)
            this.syncSettingsFromDom()
            this.markDirty()
            return
        }
        const row = target.closest("tr[data-row-id]")
        if (!(row instanceof HTMLTableRowElement)) return
        this.selectRow(row)
        this.updateRowField(String(row.dataset.kind || ""), String(row.dataset.rowId || ""), field, target.value)
        this.markDirty()
    }

    syncSettingsFromDom() {
        const pathInput = this.settingsPanelElement.querySelector('[data-field="path"]')
        const nameInput = this.settingsPanelElement.querySelector('[data-field="name"]')
        const descriptionInput = this.settingsPanelElement.querySelector('[data-field="description"]')
        assert(pathInput instanceof HTMLInputElement, "view-director settings path input missing")
        assert(nameInput instanceof HTMLInputElement, "view-director settings name input missing")
        assert(descriptionInput instanceof HTMLTextAreaElement, "view-director settings description input missing")
        this.path = pathInput.value.trim()
        this.document.settings.name = nameInput.value
        this.document.settings.description = descriptionInput.value
    }

    updateRowField(kind, id, field, value) {
        const rows = kind === "rules" ? this.document.rules : this.document.manifest
        const row = rows.find((candidate) => candidate.id === id)
        assert(row, `view-director row ${id} not found`)
        assert(Object.hasOwn(row, field), `view-director row field ${field} not found`)
        row[field] = value
    }

    handleKeyDown(event) {
        if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return
        if ((event.ctrlKey || event.metaKey) && event.key === " ") {
            event.preventDefault()
            void this.autocomplete(event.target)
            return
        }
        if (event.key === "Escape") void runtime.call("ui.tooltip.closeAll")
    }

    async autocomplete(input) {
        const row = input.closest("tr[data-row-id]")
        if (!(row instanceof HTMLTableRowElement)) return false
        const field = String(input.dataset.field || "")
        if (field !== "entity" && field !== "rule") return false
        const context = completionContext(input, field === "entity" ? "manifest" : "rules")
        if (!context) {
            this.setStatus("No completion available at cursor", "info")
            return false
        }
        const items = this.completionItems(context.kind, context.prefix)
        if (!items.length) {
            this.setStatus(`No ${context.kind} completions`, "info")
            return false
        }
        const result = unwrap(
            await runtime.call("ui.tooltip.autocomplete", {
                anchor: { kind: "caret", input },
                placement: "bottom",
                minWidth: 260,
                placeholder: `Search ${context.kind}...`,
                items,
            }),
        )
        if (!result || result.cancelled || !result.selected) return false
        replaceInputRange(input, context.start, context.end, String(result.selected.value))
        return true
    }

    completionItems(kind, prefix) {
        const normalizedPrefix = String(prefix || "").toLowerCase()
        const values = kind === "entity" ? this.entityIds() : this.propertyKeys()
        return values
            .filter((value) => value.toLowerCase().startsWith(normalizedPrefix))
            .sort((a, b) => a.localeCompare(b))
            .map((value) => ({ label: value, value, group: kind === "entity" ? "Entities" : "Properties" }))
    }

    entityIds() {
        return [...new Set(this.document.manifest.map((row) => entityIdFromEntityText(row.entity)).filter(Boolean))]
    }

    propertyKeys() {
        const keys = new Set()
        for (const row of this.document.manifest) for (const key of propertyKeysFromText(row.entity)) keys.add(key)
        for (const row of this.document.rules) for (const key of propertyKeysFromText(row.rule)) keys.add(key)
        return [...keys]
    }
}

if (!customElements.get("view-director")) customElements.define("view-director", ViewDirector)
