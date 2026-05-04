export class ViewAnimation extends HTMLElement {
  connectedCallback() {
    this.style.display = 'contents'
    this.innerHTML = `
      <article>
        <pre data-element="description">Animation

Build and preview frame-based animations from a spritesheet or tile atlas.

This view is intended for editing frame order, frame duration, loop mode, and tile flip flags before exporting animation data for game runtime use.</pre>
      </article>
      <footer data-element="footer"><output>Placeholder view</output></footer>
    `
  }
}

if (!customElements.get('view-animation')) {
  customElements.define('view-animation', ViewAnimation)
}
