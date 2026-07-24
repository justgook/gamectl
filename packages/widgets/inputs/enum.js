function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseInteger(value, label) {
  assert(/^-?(?:0|[1-9]\d*)$/.test(value), `${label} must be an integer`)
  const parsed = Number(value)
  assert(Number.isSafeInteger(parsed), `${label} must be a safe integer`)
  return parsed
}

export class WidgetInputEnum extends HTMLElement {
  constructor() {
    super()
    this.selectElement = null
    this.options = []
    this._value = undefined
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = "1"

    const type = this.getAttribute("type")
    assert(
      type === "string" || type === "int",
      "widget-input-enum type must be string or int",
    )

    this.options = [...this.attributes]
      .filter((attribute) => attribute.name !== "type" && attribute.name !== "data-ready")
      .map((attribute) => ({
        label: attribute.name,
        value:
          type === "int"
            ? parseInteger(attribute.value, `widget-input-enum ${attribute.name}`)
            : attribute.value,
      }))
    assert(this.options.length > 0, "widget-input-enum requires options")

    const values = new Set()
    for (const option of this.options) {
      const key = `${typeof option.value}:${String(option.value)}`
      assert(!values.has(key), `widget-input-enum duplicate value ${option.value}`)
      values.add(key)
    }

    const select = document.createElement("select")
    select.dataset.element = "input"
    for (const [index, option] of this.options.entries()) {
      const optionElement = document.createElement("option")
      optionElement.value = String(index)
      optionElement.textContent = option.label
      select.appendChild(optionElement)
    }
    select.selectedIndex = -1
    select.addEventListener("input", (event) => this.forwardEvent(event))
    select.addEventListener("change", (event) => this.forwardEvent(event))
    this.replaceChildren(select)
    this.selectElement = select
    if (this._value !== undefined) this.applyValue()
  }

  get value() {
    if (!this.selectElement) return this._value
    const option = this.options[this.selectElement.selectedIndex]
    return option?.value
  }

  set value(value) {
    this._value = value
    if (!this.selectElement) return
    this.applyValue()
  }

  applyValue() {
    this.selectElement.selectedIndex = this.options.findIndex(
      (option) => Object.is(option.value, this._value),
    )
  }

  forwardEvent(event) {
    this._value = this.value
    event.stopPropagation()
    this.dispatchEvent(new Event(event.type, { bubbles: true }))
  }
}

if (!customElements.get("widget-input-enum")) {
  customElements.define("widget-input-enum", WidgetInputEnum)
}
