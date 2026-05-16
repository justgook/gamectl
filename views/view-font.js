import { registerViewPlugin, unregisterViewPlugin } from '/util/view-plugin.js'

export class ViewFont extends HTMLElement {
  connectedCallback() {
    registerViewPlugin(this)
    this.style.display = 'contents'
    this.innerHTML = `
      <article>
        <pre data-element="description">Artery Font

Inspect and prepare game font assets, especially atlas-based and SDF-style fonts.

This view is intended for previewing glyph atlases, font metrics, sample text rendering, and exporting font metadata usable by game runtimes.</pre>
      </article>
      <footer data-element="footer"><output>Placeholder view</output></footer>
    `
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get('view-font')) {
  customElements.define('view-font', ViewFont)
}
