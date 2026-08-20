import { runtime, unwrap } from "/core/runtime.js"
import { validateAnimationSelector } from "/util/animation-tree.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseValue(text) {
  const value = JSON.parse(text)
  validateAnimationSelector(value, "widget-input-animation value")
  return value
}

export class WidgetInputAnimation extends HTMLElement {
  constructor() {
    super()
    this.inputElement = null
    this.buttonElement = null
    this._value = { url: "", layer: "*", tag: "*" }
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = "1"

    const input = document.createElement("input")
    input.type = "text"
    input.size = 10
    input.value = JSON.stringify(this._value)
    input.placeholder = '{"url":"file.aseprite","layer":"*","tag":"Run"}'
    input.setAttribute("autocomplete", "off")
    input.setAttribute("autocorrect", "off")
    input.setAttribute("autocapitalize", "off")
    input.spellcheck = false
    input.addEventListener("input", (event) => this.forwardInputEvent(event))
    input.addEventListener("change", (event) => this.forwardInputEvent(event))

    const button = document.createElement("button")
    button.type = "button"
    button.setAttribute("aria-label", "Edit animation selector")
    button.title = "Edit animation selector"
    const icon = document.createElement("i")
    icon.setAttribute("aria-hidden", "true")
    icon.textContent = "edit"
    button.appendChild(icon)
    button.addEventListener("click", () => void this.chooseAnimation())

    const group = document.createElement("div")
    group.setAttribute("role", "buttongroup")
    group.append(input, button)
    this.replaceChildren(group)
    this.inputElement = input
    this.buttonElement = button
  }

  get value() {
    if (this.inputElement) return structuredClone(parseValue(this.inputElement.value))
    return structuredClone(this._value)
  }

  set value(value) {
    validateAnimationSelector(value, "widget-input-animation value")
    this._value = structuredClone(value)
    if (this.inputElement) {
      this.inputElement.value = JSON.stringify(this._value)
      this.inputElement.setCustomValidity("")
    }
  }

  forwardInputEvent(event) {
    assert(this.inputElement instanceof HTMLInputElement, "widget-input-animation is not connected")
    event.stopPropagation()
    try {
      this._value = structuredClone(parseValue(this.inputElement.value))
      this.inputElement.setCustomValidity("")
      this.dispatchEvent(new Event(event.type, { bubbles: true }))
    } catch (error) {
      this.inputElement.setCustomValidity(error instanceof Error ? error.message : String(error))
      if (event.type === "change") this.inputElement.reportValidity()
    }
  }

  async chooseAnimation() {
    assert(this.inputElement instanceof HTMLInputElement, "widget-input-animation is not connected")
    assert(this.buttonElement instanceof HTMLButtonElement, "widget-input-animation is not connected")
    let value
    try {
      value = this.value
      this.inputElement.setCustomValidity("")
    } catch (error) {
      this.inputElement.setCustomValidity(error instanceof Error ? error.message : String(error))
      this.inputElement.reportValidity()
      return
    }

    this.buttonElement.disabled = true
    try {
      const payload = unwrap(
        await runtime.call("ui.popup.open", {
          title: "Choose Animation",
          size: "medium",
          tag: "view-animation-selector",
          props: { mode: "select", value },
        }),
        "animation selector popup",
      )
      assert(payload && typeof payload === "object" && !Array.isArray(payload), "animation selector popup result must be an object")
      if (payload.cancelled) return
      this.value = payload.value
      this.dispatchEvent(new Event("input", { bubbles: true }))
      this.dispatchEvent(new Event("change", { bubbles: true }))
    } finally {
      this.buttonElement.disabled = false
    }
  }
}

if (!customElements.get("widget-input-animation")) {
  customElements.define("widget-input-animation", WidgetInputAnimation)
}
