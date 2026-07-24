import { registerViewPlugin, unregisterViewPlugin } from "/util/view-plugin.js"
import "/widgets/inputs/animation.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export class ViewAnimation extends HTMLElement {
  constructor() {
    super()
    this._animationNode = null
  }

  set animationNode(node) {
    assert(node && typeof node === "object" && !Array.isArray(node), "view-animation animationNode must be an object")
    assert(node.kind === "animation", "view-animation requires an animation node")
    this._animationNode = structuredClone(node)
    if (this.dataset.ready) this.render()
  }

  get animationNode() {
    assert(this._animationNode, "view-animation animationNode is required")
    return structuredClone(this._animationNode)
  }

  connectedCallback() {
    if (this.dataset.ready) return
    assert(this._animationNode, "view-animation animationNode is required")
    this.dataset.ready = "1"
    registerViewPlugin(this)
    this.style.display = "contents"
    this.render()
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }

  render() {
    this.innerHTML = `
      <form data-element="animation-editor">
        <fieldset>
          <legend>Animation</legend>
          <label>Name <input type="text" data-field="name" value="${this.escapeAttribute(this._animationNode.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
          <label>Animation source <widget-input-animation data-field="animation"></widget-input-animation></label>
          <output class="info">Mock Animation editor</output>
        </fieldset>
      </form>
    `
    const nameInput = this.querySelector('input[data-field="name"]')
    const animationInput = this.querySelector('widget-input-animation[data-field="animation"]')
    assert(nameInput instanceof HTMLInputElement, "view-animation name field must be an input")
    assert(animationInput instanceof HTMLElement && "value" in animationInput, "view-animation animation field must be an input widget")
    animationInput.value = structuredClone(this._animationNode.animation)
    nameInput.addEventListener("change", () => {
      const value = nameInput.value.trim()
      assert(value.length > 0, "animation node name must not be empty")
      this._animationNode.name = value
      this.publishChange()
    })
    animationInput.addEventListener("change", () => {
      this._animationNode.animation = structuredClone(animationInput.value)
      this.publishChange()
    })
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

if (!customElements.get("view-animation")) {
  customElements.define("view-animation", ViewAnimation)
}
