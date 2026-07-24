import { runtime, unwrap } from "/core/runtime.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export class WidgetInputFile extends HTMLElement {
  constructor() {
    super()
    this.inputElement = null
    this.buttonElement = null
    this._value = ""
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = "1"

    const input = document.createElement("input")
    input.type = "text"
    input.value = this._value
    input.placeholder = "file path"
    input.setAttribute("autocomplete", "off")
    input.setAttribute("autocorrect", "off")
    input.setAttribute("autocapitalize", "off")
    input.spellcheck = false
    input.addEventListener("input", (event) => this.forwardInputEvent(event))
    input.addEventListener("change", (event) => this.forwardInputEvent(event))

    const button = document.createElement("button")
    button.type = "button"
    button.setAttribute("aria-label", "Choose file")
    button.title = "Choose file"
    const icon = document.createElement("i")
    icon.setAttribute("aria-hidden", "true")
    icon.textContent = "folder_open"
    button.appendChild(icon)
    button.addEventListener("click", () => void this.chooseFile())

    const group = document.createElement("div")
    group.setAttribute("role", "buttongroup")
    group.append(input, button)
    this.replaceChildren(group)
    this.inputElement = input
    this.buttonElement = button
  }

  get value() {
    return this.inputElement ? this.inputElement.value : this._value
  }

  set value(value) {
    assert(typeof value === "string", "widget-input-file value must be a string")
    this._value = value
    if (this.inputElement) this.inputElement.value = value
  }

  forwardInputEvent(event) {
    this._value = this.inputElement.value
    event.stopPropagation()
    this.dispatchEvent(new Event(event.type, { bubbles: true }))
  }

  async chooseFile() {
    assert(
      this.buttonElement instanceof HTMLButtonElement,
      "widget-input-file is not connected",
    )
    this.buttonElement.disabled = true
    try {
      const payload = unwrap(
        await runtime.call("ui.popup.open", {
          title: "Choose File",
          size: "medium",
          tag: "view-files",
          props: {
            mode: "chooser",
            rootPath: this.getAttribute("root") || ".",
            filter: this.getAttribute("filter") || "",
          },
        }),
      )
      if (!payload || payload.cancelled) return
      assert(
        payload.selection && !Array.isArray(payload.selection),
        "widget-input-file chooser requires one selection",
      )
      assert(
        typeof payload.selection.path === "string" &&
          payload.selection.path.length > 0,
        "widget-input-file chooser selection requires path",
      )
      this.value = payload.selection.path
      this.dispatchEvent(new Event("input", { bubbles: true }))
      this.dispatchEvent(new Event("change", { bubbles: true }))
    } finally {
      this.buttonElement.disabled = false
    }
  }
}

if (!customElements.get("widget-input-file")) {
  customElements.define("widget-input-file", WidgetInputFile)
}
