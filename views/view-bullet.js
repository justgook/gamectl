import { runtime, unwrap } from "/core/runtime.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function basename(path) {
  const parts = String(path).split("/")
  return parts[parts.length - 1] || "new.gbml.json"
}

function errorMessage(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

function requireObject(value, name) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    `${name} must be an object`,
  )
  return value
}

function requireArray(value, name) {
  assert(Array.isArray(value), `${name} must be an array`)
  return value
}

function createEmptyGbml() {
  return {
    format: "gams.gbml",
    version: 1,
    source: {
      language: "bulletml-0.21",
      orientation: "vertical",
    },
    compatibility: {
      semantics: "gams-corrected-v1",
    },
    entrypoints: [],
    definitions: {
      actions: [],
      bullets: [],
      fires: [],
    },
    expressions: [],
  }
}

function stringifyGbml(gbml) {
  return `${JSON.stringify(gbml, null, 2)}\n`
}

function summarizeGbml(gbml) {
  requireObject(gbml, "gbml")
  assert(gbml.format === "gams.gbml", "gbml.format must be gams.gbml")
  assert(gbml.version === 1, "gbml.version must be 1")
  const source = requireObject(gbml.source, "gbml.source")
  const compatibility = requireObject(gbml.compatibility, "gbml.compatibility")
  const definitions = requireObject(gbml.definitions, "gbml.definitions")
  const entrypoints = requireArray(gbml.entrypoints, "gbml.entrypoints")
  const actions = requireArray(definitions.actions, "gbml.definitions.actions")
  const bullets = requireArray(definitions.bullets, "gbml.definitions.bullets")
  const fires = requireArray(definitions.fires, "gbml.definitions.fires")
  const expressions = requireArray(gbml.expressions, "gbml.expressions")

  return [
    `format: ${gbml.format} v${gbml.version}`,
    `source: ${source.language} (${source.orientation})`,
    `semantics: ${compatibility.semantics}`,
    `entrypoints: ${entrypoints.length}`,
    `actions: ${actions.length}`,
    `bullets: ${bullets.length}`,
    `fires: ${fires.length}`,
    `expressions: ${expressions.length}`,
  ].join("\n")
}

export class ViewBullet extends HTMLElement {
  static get observedAttributes() {
    return ["data-source"]
  }

  constructor() {
    super()
    this.sourcePath = ""
    this.gbml = null
    this.programText = ""
    this.dirty = false
    this.summaryOutput = null
    this.programOutput = null
    this.pathOutput = null
    this.dirtyOutput = null
    this.statusOutput = null
    this._headerControlsElement = null
  }

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = "1"
    this.style.display = "contents"

    const config = this.config
    const configSource = config && typeof config === "object" ? config.defaultSource : undefined
    const attrSource = this.getAttribute("data-source")
    assert(
      (typeof attrSource === "string" && attrSource.trim().length > 0) ||
        (typeof configSource === "string" && configSource.trim().length > 0),
      "view-bullet requires data-source or config.defaultSource",
    )
    this.sourcePath = String(attrSource || configSource).trim()

    this.innerHTML = `
      <article>
        <pre data-element="summary">Loading GBML...</pre>
        <pre data-element="program"></pre>
      </article>
      <footer>
        <output data-element="path"></output>
        <output data-element="dirty"></output>
        <output data-element="status">Loading...</output>
      </footer>
    `

    this.summaryOutput = this.querySelector('[data-element="summary"]')
    this.programOutput = this.querySelector('[data-element="program"]')
    this.pathOutput = this.querySelector('[data-element="path"]')
    this.dirtyOutput = this.querySelector('[data-element="dirty"]')
    this.statusOutput = this.querySelector('[data-element="status"]')

    assert(
      this.summaryOutput instanceof HTMLPreElement,
      "view-bullet missing summary output",
    )
    assert(
      this.programOutput instanceof HTMLPreElement,
      "view-bullet missing program output",
    )
    assert(
      this.pathOutput instanceof HTMLOutputElement,
      "view-bullet missing path output",
    )
    assert(
      this.dirtyOutput instanceof HTMLOutputElement,
      "view-bullet missing dirty output",
    )
    assert(
      this.statusOutput instanceof HTMLOutputElement,
      "view-bullet missing status output",
    )

    this._mountHeaderControls()
    this.updateFooter()
    void this.load()
  }

  disconnectedCallback() {
    this._unmountHeaderControls()
    void unregisterViewPlugin(this)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== "data-source") return
    this.sourcePath = String(newValue || "").trim()
    if (!this.dataset.ready) return
    assert(this.sourcePath.length > 0, "view-bullet data-source must not be empty")
    this.updateFooter()
    void this.load()
  }

  createHeaderControlsElement() {
    const controls = document.createElement("div")
    controls.dataset.element = "header-controls"
    controls.setAttribute("slot", "header-controls")
    controls.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="new" aria-label="New GBML" title="New GBML"><i aria-hidden="true">docs</i></button>
        <button type="button" data-action="open" aria-label="Open GBML" title="Open GBML"><i aria-hidden="true">folder_open</i></button>
        <button type="button" data-action="save" class="accent" aria-label="Save GBML" title="Save GBML"><i aria-hidden="true">save</i></button>
        <button type="button" data-action="save-as" aria-label="Save GBML as" title="Save GBML as"><i aria-hidden="true">save_as</i></button>
        <button type="button" data-action="reload" aria-label="Reload GBML" title="Reload GBML"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <button type="button" data-action="edit" aria-label="Edit GBML JSON" title="Edit GBML JSON"><i aria-hidden="true">edit</i></button>
      </div>
    `
    return controls
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControlsElement) return
    this._headerControlsElement = this.createHeaderControlsElement()
    this.parentElement.appendChild(this._headerControlsElement)
    this.queryHeader('[data-action="new"]').addEventListener("click", () =>
      void this.new(),
    )
    this.queryHeader('[data-action="open"]').addEventListener("click", () =>
      void this.open(),
    )
    this.queryHeader('[data-action="save"]').addEventListener("click", () =>
      void this.save(),
    )
    this.queryHeader('[data-action="save-as"]').addEventListener("click", () =>
      void this.saveAs(),
    )
    this.queryHeader('[data-action="reload"]').addEventListener("click", () =>
      void this.reload(),
    )
    this.queryHeader('[data-action="edit"]').addEventListener("click", () =>
      void this.edit(),
    )
    this.renderHeaderControls()
  }

  _unmountHeaderControls() {
    if (this._headerControlsElement) this._headerControlsElement.remove()
    this._headerControlsElement = null
  }

  queryHeader(selector) {
    assert(this._headerControlsElement, "view-bullet missing header controls")
    const element = this._headerControlsElement.querySelector(selector)
    assert(element instanceof HTMLElement, `view-bullet missing header control ${selector}`)
    return element
  }

  renderHeaderControls() {
    if (!this._headerControlsElement) return
    const hasProgram = this.gbml !== null
    const hasPath = this.sourcePath.length > 0
    const saveButton = this.queryHeader('[data-action="save"]')
    const saveAsButton = this.queryHeader('[data-action="save-as"]')
    const reloadButton = this.queryHeader('[data-action="reload"]')
    const editButton = this.queryHeader('[data-action="edit"]')
    assert(saveButton instanceof HTMLButtonElement, "view-bullet save control must be a button")
    assert(saveAsButton instanceof HTMLButtonElement, "view-bullet save-as control must be a button")
    assert(reloadButton instanceof HTMLButtonElement, "view-bullet reload control must be a button")
    assert(editButton instanceof HTMLButtonElement, "view-bullet edit control must be a button")
    saveButton.disabled = !hasProgram || !hasPath
    saveAsButton.disabled = !hasProgram
    reloadButton.disabled = !hasPath
    editButton.disabled = !hasPath
  }

  setStatus(text, tone = null) {
    assert(
      this.statusOutput instanceof HTMLOutputElement,
      "view-bullet missing status output",
    )
    this.statusOutput.textContent = text
    this.statusOutput.classList.remove("accent", "success", "warning", "danger", "info")
    if (tone) this.statusOutput.classList.add(tone)
  }

  updateFooter(status = null, tone = null) {
    assert(this.pathOutput instanceof HTMLOutputElement, "view-bullet missing path output")
    assert(this.dirtyOutput instanceof HTMLOutputElement, "view-bullet missing dirty output")
    this.pathOutput.textContent = `Path: ${this.sourcePath}`
    this.dirtyOutput.textContent = this.dirty ? "Dirty" : "Saved"
    this.dirtyOutput.className = this.dirty ? "warning" : "success"
    if (status !== null) this.setStatus(status, tone)
    this.renderHeaderControls()
  }

  setProgram(gbml, { dirty = false, status = "Ready", tone = "success" } = {}) {
    this.gbml = gbml
    this.programText = stringifyGbml(gbml)
    this.dirty = dirty
    this.summaryOutput.textContent = summarizeGbml(gbml)
    this.programOutput.textContent = this.programText
    this.updateFooter(status, tone)
  }

  async load() {
    assert(this.sourcePath.length > 0, "view-bullet load requires source path")
    this.setStatus("Loading...", "info")
    try {
      const text = unwrap(await runtime.invoke("fs/fs::read-text", this.sourcePath))
      const gbml = JSON.parse(text)
      this.setProgram(gbml, { dirty: false, status: "Ready", tone: "success" })
    } catch (error) {
      this.setStatus(`Error: ${errorMessage(error)}`, "danger")
      console.error("view-bullet load failed:", error)
    }
  }

  async reload() {
    await this.load()
    await runtime.call("ui.toast.success", { message: `Reloaded ${this.sourcePath}` })
  }

  async new() {
    const payload = unwrap(
      await runtime.call("ui.popup.open", this.createNewPopupOptions()),
    )
    if (!payload || payload.cancelled) return
    const path = typeof payload.path === "string" ? payload.path.trim() : ""
    assert(path.length > 0, "view-bullet new requires GBML file path")
    this.sourcePath = path
    this.setProgram(createEmptyGbml(), {
      dirty: false,
      status: `Created ${path}`,
      tone: "success",
    })
    await this.saveToPath(path)
    await runtime.call("ui.toast.success", { message: `Created ${path}` })
  }

  async open() {
    const payload = unwrap(
      await runtime.call("ui.popup.open", this.createOpenPopupOptions()),
    )
    if (!payload || payload.cancelled) return
    const selection = Array.isArray(payload.selection)
      ? payload.selection[0]
      : payload.selection
    assert(selection && selection.path, "view-bullet open requires selected GBML file path")
    this.sourcePath = selection.path
    await this.load()
  }

  async save() {
    assert(this.gbml !== null, "view-bullet save requires loaded GBML")
    assert(this.sourcePath.length > 0, "view-bullet save requires GBML file path")
    await this.saveToPath(this.sourcePath)
    this.dirty = false
    this.updateFooter(`Saved ${this.sourcePath}`, "success")
    await runtime.call("ui.toast.success", { message: `Saved ${this.sourcePath}` })
  }

  async saveAs() {
    assert(this.gbml !== null, "view-bullet save-as requires loaded GBML")
    const payload = unwrap(
      await runtime.call("ui.popup.open", this.createSavePopupOptions()),
    )
    if (!payload || payload.cancelled) return
    const path = typeof payload.path === "string" ? payload.path.trim() : ""
    assert(path.length > 0, "view-bullet save-as requires GBML file path")
    await this.saveToPath(path)
    this.sourcePath = path
    this.dirty = false
    this.updateFooter(`Saved as ${path}`, "success")
    await runtime.call("ui.toast.success", { message: `Saved ${path}` })
  }

  async edit() {
    assert(this.sourcePath.length > 0, "view-bullet edit requires GBML file path")
    const payload = unwrap(
      await runtime.call("ui.popup.open", {
        title: "Edit GBML JSON",
        size: "large",
        tag: "view-code",
        attributes: { "data-source": this.sourcePath, "data-lang": "json" },
      }),
    )
    if (payload && payload.reload) await this.load()
  }

  async saveToPath(path) {
    assert(this.gbml !== null, "view-bullet save requires loaded GBML")
    assert(typeof path === "string" && path.length > 0, "view-bullet save requires GBML path")
    this.programText = stringifyGbml(this.gbml)
    unwrap(await runtime.invoke("fs/fs::write-text", path, this.programText))
  }

  createOpenPopupOptions() {
    return {
      title: "Open GBML",
      size: "medium",
      tag: "view-files",
      props: {
        mode: "chooser",
        filter: "*.gbml.json,*.json",
      },
    }
  }

  createNewPopupOptions() {
    return {
      title: "Create GBML",
      size: "medium",
      tag: "view-files",
      props: {
        mode: "saver",
        filter: "*.gbml.json,*.json",
        defaultName: "new.gbml.json",
      },
    }
  }

  createSavePopupOptions() {
    return {
      title: "Save GBML As",
      size: "medium",
      tag: "view-files",
      props: {
        mode: "saver",
        filter: "*.gbml.json,*.json",
        defaultName: basename(this.sourcePath || "new.gbml.json"),
      },
    }
  }
}

if (!customElements.get("view-bullet")) {
  customElements.define("view-bullet", ViewBullet)
}
