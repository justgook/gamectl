import { runtime } from "/core/runtime.js"

export class ViewFiles extends HTMLElement {
  connectedCallback() {
    console.log(runtime)
    this.innerHTML = `
      <article>
       im view bullet 
      </article>
      <footer data-element="footer"></footer>
    `
  }
}

customElements.define('view-bullet', ViewFiles)

