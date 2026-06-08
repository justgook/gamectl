import { runtime, unwrap } from "/core/runtime.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function requireObject(value, name) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${name} must be an object`)
  return value
}

function requireArray(value, name) {
  assert(Array.isArray(value), `${name} must be an array`)
  return value
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

  connectedCallback() {
    registerViewPlugin(this)
    if (this.dataset.ready) return
    this.dataset.ready = "1"
    this.style.display = "contents"

    const configSource = this.config?.defaultSource
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
      <footer data-element="footer">
        <output data-element="path"></output>
        <output data-element="status">Loading...</output>
        <button type="button" data-action="reload">Reload</button>
      </footer>
    `

    this.summaryOutput = this.querySelector('[data-element="summary"]')
    this.programOutput = this.querySelector('[data-element="program"]')
    this.pathOutput = this.querySelector('[data-element="path"]')
    this.statusOutput = this.querySelector('[data-element="status"]')
    this.reloadButton = this.querySelector('[data-action="reload"]')

    assert(this.summaryOutput instanceof HTMLPreElement, "view-bullet missing summary output")
    assert(this.programOutput instanceof HTMLPreElement, "view-bullet missing program output")
    assert(this.pathOutput instanceof HTMLOutputElement, "view-bullet missing path output")
    assert(this.statusOutput instanceof HTMLOutputElement, "view-bullet missing status output")
    assert(this.reloadButton instanceof HTMLButtonElement, "view-bullet missing reload button")

    this.pathOutput.textContent = this.sourcePath
    this.reloadButton.addEventListener("click", () => void this.load())
    void this.load()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== "data-source") return
    this.sourcePath = String(newValue || "").trim()
    if (!this.dataset.ready) return
    assert(this.sourcePath.length > 0, "view-bullet data-source must not be empty")
    this.pathOutput.textContent = this.sourcePath
    void this.load()
  }

  setStatus(text, tone = null) {
    this.statusOutput.textContent = text
    this.statusOutput.classList.remove("accent", "success", "warning", "danger", "info")
    if (tone) this.statusOutput.classList.add(tone)
  }

  async load() {
    this.reloadButton.disabled = true
    this.setStatus("Loading...", "info")
    try {
      const text = unwrap(await runtime.invoke("fs/fs::read-text", this.sourcePath))
      const gbml = JSON.parse(text)
      this.summaryOutput.textContent = summarizeGbml(gbml)
      this.programOutput.textContent = JSON.stringify(gbml, null, 2)
      this.setStatus("Ready", "success")
    } catch (error) {
      this.setStatus(`Error: ${error?.message || error}`, "danger")
      console.error("view-bullet load failed:", error)
    } finally {
      this.reloadButton.disabled = false
    }
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get("view-bullet")) {
  customElements.define("view-bullet", ViewBullet)
}
