export class ViewHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header style="--wails-draggable:drag">
        <small>Game Assets Management System</small>
        <strong >GAMS</strong>
      </header>
    `
  }
}

customElements.define('view-header', ViewHeader)
