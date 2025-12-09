import { View } from "./view.js"
import { bus } from "../systems/event-bus.js"

export class ViewConsole extends View {
  constructor() {
    super('view-console')
    this.logOutput = this.content.querySelector('[data-element="log-output"]')
  }
  
  connectedCallback() {
    super.connectedCallback()
    this.setupKeybindings()
  }
  
  disconnectedCallback() {
    super.disconnectedCallback()
    if (this.keybindingUnsubscribers) {
      this.keybindingUnsubscribers.forEach(unsub => unsub())
      this.keybindingUnsubscribers = []
    }
  }
  
  setupKeybindings() {
    this.keybindingUnsubscribers = [
      bus.on('console:clear', () => this.clear())
    ]
  }

  log(message) {
    const p = document.createElement('p')
    p.textContent = message
    this.logOutput.appendChild(p)
    const target = this.logOutput.parentNode
    target.scrollTop = target.scrollHeight
  }
  
  clear() {
    if (this.logOutput) {
      this.logOutput.innerHTML = ''
    }
  }
}
