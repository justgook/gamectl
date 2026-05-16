import { registerViewPlugin, unregisterViewPlugin } from '/util/view-plugin.js'

export class ViewParticle extends HTMLElement {
  connectedCallback() {
    registerViewPlugin(this)
    this.style.display = 'contents'
    this.innerHTML = `
      <article>
        <pre data-element="description">Particle

Design and preview game particle effects such as smoke, sparks, explosions, trails, and magic effects.

This view is intended for editing emitters, lifetime, velocity, color and alpha curves, spawn rates, and exporting runtime effect definitions.</pre>
      </article>
      <footer data-element="footer"><output>Placeholder view</output></footer>
    `
  }

  disconnectedCallback() {
    void unregisterViewPlugin(this)
  }
}

if (!customElements.get('view-particle')) {
  customElements.define('view-particle', ViewParticle)
}
