import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class ViewAnimationBlendSpaceBase extends HTMLElement {
  constructor(kind, legend, fields) {
    super()
    this.expectedKind = kind
    this.legend = legend
    this.fields = fields
    this._animationNode = null
  }

  set animationNode(node) {
    assert(node && typeof node === "object" && !Array.isArray(node), `${this.localName} animationNode must be an object`)
    assert(node.kind === this.expectedKind, `${this.localName} requires a ${this.expectedKind} node`)
    this._animationNode = structuredClone(node)
    if (this.dataset.ready) this.render()
  }

  get animationNode() {
    assert(this._animationNode, `${this.localName} animationNode is required`)
    return structuredClone(this._animationNode)
  }

  connectedCallback() {
    if (this.dataset.ready) return
    assert(this._animationNode, `${this.localName} animationNode is required`)
    this.dataset.ready = "1"
    registerViewPlugin(this)
    this.style.display = "contents"
    this.render()
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }

  render() {
    const numberField = ({ label, target, step = "0.05" }) =>
      `<label>${label} <input type="number" data-parameter="${target}" value="${this._animationNode.parameters[target]}" step="${step}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>`
    this.innerHTML = `
      <form data-element="blend-space-editor">
        <fieldset>
          <legend>${this.legend}</legend>
          <label>Name <input type="text" data-field="name" value="${this.escapeAttribute(this._animationNode.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
          ${this.fields.map(numberField).join("")}
          <label>Points <output>${this._animationNode.points.length}</output></label>
          <output class="info">Mock ${this.legend} editor</output>
        </fieldset>
      </form>
    `
    const name = this.querySelector('[data-field="name"]')
    assert(name instanceof HTMLInputElement, `${this.localName} name field is required`)
    name.addEventListener("change", () => {
      const value = name.value.trim()
      assert(value.length > 0, "animation node name must not be empty")
      this._animationNode.name = value
      this.publishChange()
    })
    for (const input of this.querySelectorAll("input[data-parameter]")) {
      assert(input instanceof HTMLInputElement, `${this.localName} parameter field must be an input`)
      input.addEventListener("change", () => {
        assert(input.value.length > 0 && Number.isFinite(input.valueAsNumber), `${input.dataset.parameter} must be finite`)
        this._animationNode.parameters[input.dataset.parameter] = input.valueAsNumber
        this.publishChange()
      })
    }
  }

  publishChange() {
    this.dispatchEvent(new CustomEvent("animation-node-change", {
      bubbles: true,
      detail: { node: structuredClone(this._animationNode) },
    }))
  }

  escapeAttribute(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  }
}

export class ViewAnimationBlendSpace1D extends ViewAnimationBlendSpaceBase {
  constructor() {
    super("blend-space-1d", "BlendSpace1D", [
      { label: "Blend position", target: "blendPosition" },
      { label: "Minimum", target: "min" },
      { label: "Maximum", target: "max" },
    ])
  }
}

export class ViewAnimationBlendSpace2D extends ViewAnimationBlendSpaceBase {
  constructor() {
    super("blend-space-2d", "BlendSpace2D", [
      { label: "Blend X", target: "blendX" },
      { label: "Blend Y", target: "blendY" },
      { label: "Minimum X", target: "minX" },
      { label: "Maximum X", target: "maxX" },
      { label: "Minimum Y", target: "minY" },
      { label: "Maximum Y", target: "maxY" },
    ])
  }
}

if (!customElements.get("view-animation-blend-space-1d")) {
  customElements.define("view-animation-blend-space-1d", ViewAnimationBlendSpace1D)
}
if (!customElements.get("view-animation-blend-space-2d")) {
  customElements.define("view-animation-blend-space-2d", ViewAnimationBlendSpace2D)
}
