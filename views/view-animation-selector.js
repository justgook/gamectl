import { runtime, unwrap } from "/core/runtime.js"
import { validateAnimationSelector } from "/util/animation-tree.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"
import "/widgets/inputs/file.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function uniqueNames(records, label) {
  assert(Array.isArray(records), `Aseprite ${label} must be an array`)
  const names = records.map((record, index) => {
    assert(record && typeof record === "object" && !Array.isArray(record), `Aseprite ${label}[${index}] must be an object`)
    assert(typeof record.name === "string", `Aseprite ${label}[${index}].name must be a string`)
    const name = record.name.trim()
    assert(name.length > 0, `Aseprite ${label}[${index}] name must be non-empty`)
    return name
  })
  assert(new Set(names).size === names.length, `Aseprite ${label} names must be unique`)
  return names
}

export class ViewAnimationSelector extends HTMLElement {
  constructor() {
    super()
    this.mode = "select"
    this.valueDraft = { url: "", layer: "*", tag: "*" }
    this.nameDraft = ""
    this.layers = []
    this.tags = []
    this.loadedUrl = ""
    this.formElement = null
    this.nameElement = null
    this.urlElement = null
    this.layerElement = null
    this.tagElement = null
    this.statusElement = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    assert(this.popupProps && typeof this.popupProps === "object" && !Array.isArray(this.popupProps), "view-animation-selector popupProps is required")
    assert(this.popupProps.mode === "select" || this.popupProps.mode === "edit-node", `view-animation-selector mode ${this.popupProps.mode} is not supported`)
    validateAnimationSelector(this.popupProps.value, "view-animation-selector value")
    this.mode = this.popupProps.mode
    this.valueDraft = structuredClone(this.popupProps.value)
    if (this.mode === "edit-node") {
      assert(typeof this.popupProps.name === "string", "view-animation-selector edit-node name must be a string")
      this.nameDraft = this.popupProps.name
    }
    this.dataset.ready = "1"
    registerViewPlugin(this)
    this.style.display = "contents"
    this.innerHTML = `
      <form data-element="animation-selector">
        <fieldset>
          <legend>Animation</legend>
          ${this.mode === "edit-node" ? `<label>Name <input type="text" data-field="name" value="${this.escapeAttribute(this.nameDraft)}" placeholder="${this.escapeAttribute(this.valueDraft.tag)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>` : ""}
          <label>Aseprite file
            <widget-input-file data-field="url" filter="*.aseprite,*.ase"></widget-input-file>
          </label>
          <label>Layer <select data-field="layer" disabled></select></label>
          <label>Tag <select data-field="tag" disabled></select></label>
          <output data-element="status" class="info"></output>
        </fieldset>
        <footer>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="submit" data-action="select" class="accent" disabled>${this.mode === "edit-node" ? "Save" : "Select"}</button>
        </footer>
      </form>
    `
    this.formElement = this.querySelector("form")
    this.nameElement = this.querySelector('[data-field="name"]')
    this.urlElement = this.querySelector('[data-field="url"]')
    this.layerElement = this.querySelector('[data-field="layer"]')
    this.tagElement = this.querySelector('[data-field="tag"]')
    this.statusElement = this.querySelector('[data-element="status"]')
    assert(this.formElement instanceof HTMLFormElement, "view-animation-selector form is required")
    if (this.mode === "edit-node") assert(this.nameElement instanceof HTMLInputElement, "view-animation-selector edit-node name input is required")
    else assert(this.nameElement === null, "view-animation-selector select mode must not contain a name input")
    assert(this.urlElement instanceof HTMLElement && this.urlElement.localName === "widget-input-file" && "value" in this.urlElement, "view-animation-selector file input widget is required")
    assert(this.layerElement instanceof HTMLSelectElement, "view-animation-selector layer select is required")
    assert(this.tagElement instanceof HTMLSelectElement, "view-animation-selector tag select is required")
    assert(this.statusElement instanceof HTMLOutputElement, "view-animation-selector status is required")
    this.urlElement.value = this.valueDraft.url
    this.querySelector('[data-action="cancel"]').addEventListener("click", () => void this.cancel())
    this.urlElement.addEventListener("change", () => void this.loadAseprite(this.urlElement.value.trim()))
    this.layerElement.addEventListener("change", () => { this.valueDraft.layer = this.layerElement.value })
    this.tagElement.addEventListener("change", () => {
      this.valueDraft.tag = this.tagElement.value
      if (this.nameElement) this.nameElement.placeholder = this.valueDraft.tag
    })
    this.formElement.addEventListener("submit", (event) => void this.submit(event))
    if (this.valueDraft.url) void this.loadAseprite(this.valueDraft.url)
    else this.setStatus("Choose an Aseprite file", "info")
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }

  async loadAseprite(path) {
    assert(typeof path === "string", "animation selector path must be a string")
    this.setLoaded(false)
    this.loadedUrl = ""
    this.layers = []
    this.tags = []
    if (!path) {
      this.setStatus("Choose an Aseprite file", "info")
      return
    }
    this.setStatus("Loading Aseprite file…", "info")
    let documentResource = null
    try {
      documentResource = unwrap(await runtime.invoke("aseprite/aseprite::open", path), "aseprite open")
      const layers = unwrap(await runtime.invoke("aseprite/aseprite::layers", documentResource), "aseprite layers")
      const tags = unwrap(await runtime.invoke("aseprite/aseprite::tags", documentResource), "aseprite tags")
      this.layers = uniqueNames(layers, "layers")
      this.tags = uniqueNames(tags, "tags")
      this.valueDraft.url = path
      this.loadedUrl = path
      this.renderOptions(this.layerElement, "All layers", this.layers, this.valueDraft.layer)
      this.renderOptions(this.tagElement, "All tags", this.tags, this.valueDraft.tag)
      this.valueDraft.layer = this.layerElement.value
      this.valueDraft.tag = this.tagElement.value
      if (this.nameElement) this.nameElement.placeholder = this.valueDraft.tag
      this.setLoaded(true)
      this.setStatus(`${this.layers.length} layers · ${this.tags.length} tags`, "success")
    } catch (error) {
      this.setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`, "danger")
    } finally {
      if (documentResource) await runtime.releaseResource(documentResource)
    }
  }

  renderOptions(select, allLabel, names, selected) {
    select.replaceChildren()
    const all = document.createElement("option")
    all.value = "*"
    all.textContent = allLabel
    select.appendChild(all)
    for (const name of names) {
      const option = document.createElement("option")
      option.value = name
      option.textContent = name
      select.appendChild(option)
    }
    assert(selected === "*" || names.includes(selected), `selected value ${selected} is not available in the Aseprite file`)
    select.value = selected
  }

  setLoaded(loaded) {
    this.layerElement.disabled = !loaded
    this.tagElement.disabled = !loaded
    const submit = this.querySelector('[data-action="select"]')
    assert(submit instanceof HTMLButtonElement, "view-animation-selector select button is required")
    submit.disabled = !loaded
  }

  setStatus(message, tone) {
    this.statusElement.textContent = message
    this.statusElement.className = tone
  }

  async submit(event) {
    event.preventDefault()
    assert(this.loadedUrl && this.loadedUrl === this.urlElement.value.trim(), "animation selector file must be loaded")
    const value = { url: this.loadedUrl, layer: this.layerElement.value, tag: this.tagElement.value }
    validateAnimationSelector(value)
    if (this.mode === "edit-node") {
      const name = this.nameElement.value.trim()
      unwrap(await runtime.call("ui.popup.close", { ok: true, cancelled: false, name, value }))
      return
    }
    unwrap(await runtime.call("ui.popup.close", { ok: true, cancelled: false, value }))
  }

  escapeAttribute(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  }

  async cancel() {
    unwrap(await runtime.call("ui.popup.close", { ok: false, cancelled: true }))
  }
}

if (!customElements.get("view-animation-selector")) {
  customElements.define("view-animation-selector", ViewAnimationSelector)
}
