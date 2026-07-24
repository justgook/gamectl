// PROTOTYPE: widget-breadcrumbs uses an undocumented Core View UI pattern.
// Do not treat this markup or API as stable until the breadcrumb vocabulary is
// approved and added to the GAMS View Development Guide.

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

export class WidgetBreadcrumbs extends HTMLElement {
  constructor() {
    super()
    this._items = []
  }

  set items(value) {
    assert(Array.isArray(value), "widget-breadcrumbs items must be an array")
    const ids = new Set()
    this._items = value.map((item, index) => {
      assert(item && typeof item === "object" && !Array.isArray(item), `widget-breadcrumbs items[${index}] must be an object`)
      assert(typeof item.id === "string" && item.id.length > 0, `widget-breadcrumbs items[${index}].id must be a non-empty string`)
      assert(!ids.has(item.id), `widget-breadcrumbs duplicate item id ${item.id}`)
      ids.add(item.id)
      assert(typeof item.label === "string" && item.label.length > 0, `widget-breadcrumbs items[${index}].label must be a non-empty string`)
      assert(item.icon === undefined || (typeof item.icon === "string" && item.icon.length > 0), `widget-breadcrumbs items[${index}].icon must be a non-empty string`)
      return { id: item.id, label: item.label, ...(item.icon === undefined ? {} : { icon: item.icon }) }
    })
    this.render()
  }

  get items() {
    return this._items.map((item) => ({ ...item }))
  }

  connectedCallback() {
    this.setAttribute("role", "navigation")
    this.setAttribute("aria-label", "Breadcrumb")
    this.render()
  }

  render() {
    if (!this.isConnected) return
    assert(this._items.length > 0, "widget-breadcrumbs requires at least one item")
    const lastIndex = this._items.length - 1
    this.innerHTML = this._items.map((item, index) => {
      const content = `${item.icon ? `<i aria-hidden="true">${escapeHtml(item.icon)}</i>` : ""}<span>${escapeHtml(item.label)}</span>`
      if (index === lastIndex) return `<output aria-current="page">${content}</output>`
      return `<button type="button" data-index="${index}">${content}</button><i aria-hidden="true">chevron_right</i>`
    }).join("")
    for (const button of this.querySelectorAll("button[data-index]")) {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.index)
        const item = this._items[index]
        assert(item, `widget-breadcrumbs missing item ${index}`)
        this.dispatchEvent(new CustomEvent("navigate", {
          detail: { id: item.id, index },
          bubbles: true,
        }))
      })
    }
  }
}

if (!customElements.get("widget-breadcrumbs")) {
  customElements.define("widget-breadcrumbs", WidgetBreadcrumbs)
}
