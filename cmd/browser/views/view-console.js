import { bus } from "../systems/event-bus.js"

export class ViewConsole extends HTMLElement {
  constructor() {
    super()
    this.logOutput = null
    this.keybindingUnsubscribers = []
  }
  
  connectedCallback() {
    // Make element fill container and focusable
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '100%'
    this.style.position = 'relative'
    this.setAttribute('tabindex', '0')
    
    // Load template
    const template = document.getElementById('view-console')
    const content = template.content.cloneNode(true)
    this.appendChild(content)
    
    this.logOutput = this.querySelector('[data-element="log-output"]')
    
    // Setup keybindings
    this.setupKeybindings()
    
    // Focus management
    this.addEventListener('focusin', () => {
      bus.emit('view:focus', { view: 'view-console', mode: 'console' })
    })
    
    this.addEventListener('focusout', () => {
      bus.emit('view:blur', { view: 'view-console', mode: 'console' })
    })
  }
  
  disconnectedCallback() {
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
