import { runtime, unwrap } from "/core/runtime.js"
import { createAnimationParameter, isInt32 } from "/util/animation-tree.js"
import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export class ViewAnimationParameters extends HTMLElement {
  constructor() {
    super()
    this.parameters = []
    this.referenceCounts = {}
    this.invalidInput = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    assert(this.popupProps && typeof this.popupProps === "object" && !Array.isArray(this.popupProps), "view-animation-parameters popupProps is required")
    assert(Array.isArray(this.popupProps.parameters), "view-animation-parameters parameters must be an array")
    assert(this.popupProps.referenceCounts && typeof this.popupProps.referenceCounts === "object", "view-animation-parameters referenceCounts must be an object")
    this.parameters = structuredClone(this.popupProps.parameters)
    this.referenceCounts = structuredClone(this.popupProps.referenceCounts)
    this.dataset.ready = "1"
    registerViewPlugin(this)
    this.style.display = "contents"
    this.render()
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }

  escape(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  }

  render() {
    this.invalidInput = null
    this.innerHTML = `
      <form data-element="animation-parameters-editor">
        <fieldset>
          <legend>Animation Parameters</legend>
          <table class="compact-actions">
            <thead><tr><th>Name</th><th>Default</th><th>Uses</th><th aria-label="Actions"></th></tr></thead>
            <tbody>
              ${this.parameters.map((parameter, index) => `
                <tr data-parameter-id="${this.escape(parameter.id)}">
                  <td><input type="text" data-field="name" data-index="${index}" value="${this.escape(parameter.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></td>
                  <td><input type="number" data-field="default-value" data-index="${index}" value="${parameter.defaultValue}" min="-2147483648" max="2147483647" step="1" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></td>
                  <td><output>${Number(this.referenceCounts[parameter.id] || 0)}</output></td>
                  <td><button type="button" class="danger" data-action="delete-parameter" data-index="${index}" ${Number(this.referenceCounts[parameter.id] || 0) > 0 ? "disabled" : ""} aria-label="Delete ${this.escape(parameter.name)}" title="Delete ${this.escape(parameter.name)}"><i aria-hidden="true">delete</i></button></td>
                </tr>`).join("")}
            </tbody>
          </table>
          <button type="button" data-action="add-parameter"><i aria-hidden="true">add</i> Add parameter</button>
          <output data-element="validation" class="info"></output>
        </fieldset>
        <footer>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="submit" data-action="save" class="accent">Save</button>
        </footer>
      </form>
    `
    const form = this.querySelector("form")
    assert(form instanceof HTMLFormElement, "view-animation-parameters form is required")
    form.addEventListener("submit", (event) => void this.save(event))
    this.querySelector('[data-action="cancel"]').addEventListener("click", () => void this.cancel())
    this.querySelector('[data-action="add-parameter"]').addEventListener("click", () => {
      if (!this.requireValidDraft()) return
      this.parameters.push(createAnimationParameter(this.parameters))
      this.render()
    })
    for (const button of this.querySelectorAll('[data-action="delete-parameter"]')) {
      button.addEventListener("click", () => {
        if (!this.requireValidDraft()) return
        const index = Number(button.dataset.index)
        assert(Number(this.referenceCounts[this.parameters[index].id] || 0) === 0, "referenced Animation Parameter cannot be deleted")
        this.parameters.splice(index, 1)
        this.render()
      })
    }
    for (const input of this.querySelectorAll('input[data-field="name"]')) {
      input.addEventListener("input", () => { this.parameters[Number(input.dataset.index)].name = input.value })
      input.addEventListener("blur", () => this.commitName(input))
    }
    for (const input of this.querySelectorAll('input[data-field="default-value"]')) input.addEventListener("blur", () => this.commitInteger(input))
  }

  setInvalid(input, message) {
    input.classList.add("danger")
    input.setCustomValidity(message)
    this.invalidInput = input
    const output = this.querySelector('[data-element="validation"]')
    assert(output instanceof HTMLOutputElement, "view-animation-parameters validation output is required")
    output.textContent = message
    output.className = "danger"
    input.reportValidity()
    queueMicrotask(() => input.focus())
  }

  clearInvalid(input) {
    input.classList.remove("danger")
    input.setCustomValidity("")
    if (this.invalidInput === input) this.invalidInput = null
    const output = this.querySelector('[data-element="validation"]')
    assert(output instanceof HTMLOutputElement, "view-animation-parameters validation output is required")
    output.textContent = ""
    output.className = "info"
  }

  commitName(input) {
    const index = Number(input.dataset.index)
    const name = input.value.trim()
    input.value = name
    this.parameters[index].name = name
    if (!name) {
      this.setInvalid(input, "Parameter names must not be blank")
      return false
    }
    if (this.parameters.some((parameter, candidateIndex) => candidateIndex !== index && parameter.name === name)) {
      this.setInvalid(input, `Parameter name already exists: ${name}`)
      return false
    }
    this.clearInvalid(input)
    return true
  }

  commitInteger(input) {
    const value = input.valueAsNumber
    if (!input.value || !isInt32(value)) {
      this.setInvalid(input, "Parameter defaults must be signed 32-bit integers")
      return false
    }
    this.parameters[Number(input.dataset.index)].defaultValue = value
    this.clearInvalid(input)
    return true
  }

  requireValidDraft() {
    if (!this.invalidInput) return true
    queueMicrotask(() => this.invalidInput.focus())
    this.invalidInput.reportValidity()
    return false
  }

  async save(event) {
    event.preventDefault()
    if (!this.requireValidDraft()) return
    for (const input of this.querySelectorAll('input[data-field="name"]')) if (!this.commitName(input)) return
    for (const input of this.querySelectorAll('input[data-field="default-value"]')) if (!this.commitInteger(input)) return
    unwrap(await runtime.call("ui.popup.close", { ok: true, cancelled: false, parameters: structuredClone(this.parameters) }))
  }

  async cancel() {
    unwrap(await runtime.call("ui.popup.close", { ok: false, cancelled: true }))
  }
}

if (!customElements.get("view-animation-parameters")) customElements.define("view-animation-parameters", ViewAnimationParameters)
