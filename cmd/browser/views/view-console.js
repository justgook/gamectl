import { View } from "./view.js"

export class ViewConsole extends View {
  constructor() {
    super('view-console')
    this.logOutput = this.content.querySelector('[data-element="log-output"]')
  }

  log(message) {
    const p = document.createElement('p')
    p.textContent = message
    this.logOutput.appendChild(p)
    const target = this.logOutput.parentNode
    target.scrollTop = target.scrollHeight
  }
}
