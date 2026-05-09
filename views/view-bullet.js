export class ViewBullet extends HTMLElement {
  connectedCallback() {
    this.style.display = 'contents'
    this.innerHTML = `
      <article>
        <pre data-element="description">BulletML

Author, inspect, and preview BulletML-style projectile patterns.

This view is intended for shmup and bullet-hell attack scripting, pattern simulation, and exporting projectile behavior data.</pre>
      </article>
      <footer data-element="footer"><output>Placeholder view</output></footer>
    `
  }
}

if (!customElements.get('view-bullet')) {
  customElements.define('view-bullet', ViewBullet)
}
