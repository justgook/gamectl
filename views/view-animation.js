import '/widgets/timeline.js'
import { registerViewPlugin, unregisterViewPlugin } from '/util/view-plugin.js'

export class ViewAnimation extends HTMLElement {
  connectedCallback() {
    registerViewPlugin(this)
    this.style.display = 'contents'
    this.innerHTML = `
      <article>
        <pre data-element="description">Animation

Build and preview frame-based animations from a spritesheet or tile atlas.

This view is intended for editing frame order, frame duration, loop mode, and tile flip flags before exporting animation data for game runtime use.</pre>
      </article>
      <footer data-element="footer"><widget-timeline></widget-timeline></footer>
    `

    this.timeline = this.querySelector('widget-timeline')
    if (this._timelineModel) this.timeline.model = this._timelineModel
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }

  set timelineModel(model) {
    this._timelineModel = model
    if (this.timeline) this.timeline.model = model
  }

  get timelineModel() {
    if (this.timeline) return this.timeline.model
    return this._timelineModel
  }
}

if (!customElements.get('view-animation')) {
  customElements.define('view-animation', ViewAnimation)
}
