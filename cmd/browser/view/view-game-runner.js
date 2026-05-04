export class ViewGameRunner extends HTMLElement {
  connectedCallback() {
    this.style.display = 'contents'
    this.innerHTML = `
      <article>
        <pre data-element="description">Game Runner

Run or preview a game/runtime module inside the browser.

This view is intended as a canvas-based playtest surface with input handling, asset loading, framebuffer/display bridge, and quick iteration support.</pre>
      </article>
      <footer data-element="footer"><output>Placeholder view</output></footer>
    `
  }
}

if (!customElements.get('view-game-runner')) {
  customElements.define('view-game-runner', ViewGameRunner)
}
