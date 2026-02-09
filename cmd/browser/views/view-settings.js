import { bus } from '../systems/event-bus.js'
import './settings/tab-general.js'
import './settings/tab-keybindings.js'
import './settings/tab-appearance.js'
import './settings/tab-plugins.js'

/**
 * ViewSettings - Settings panel with tabbed interface
 * 
 * Three tabs:
 *   - Keybindings: Full editor for keyboard shortcuts
 *   - Appearance: Theme, font, size selectors
 *   - Plugins: Read-only listing of built-in plugins and views
 */
export class ViewSettings extends HTMLElement {
  constructor() {
    super()
    this.activeTab = 'general'
    this.keybindingUnsubscribers = []
  }

  connectedCallback() {
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.width = '100%'
    this.style.height = '100%'
    this.style.position = 'relative'
    this.setAttribute('tabindex', '0')

    this.render()

    // Focus management
    this.addEventListener('focusin', () => {
      bus.emit('view:focus', { view: 'view-settings', mode: 'settings' })
    })

    this.addEventListener('focusout', () => {
      bus.emit('view:blur', { view: 'view-settings', mode: 'settings' })
    })
  }

  disconnectedCallback() {
    if (this.keybindingUnsubscribers) {
      this.keybindingUnsubscribers.forEach(unsub => unsub())
      this.keybindingUnsubscribers = []
    }
  }

  render() {
    this.innerHTML = ''

    // Tab bar
    const tabBar = document.createElement('div')
    tabBar.className = 'settings-tab-bar'

    const tabs = [
      { id: 'general', label: 'General' },
      { id: 'keybindings', label: 'Keybindings' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'plugins', label: 'Plugins' },
    ]

    tabs.forEach(tab => {
      const btn = document.createElement('button')
      btn.className = 'button-tab' + (tab.id === this.activeTab ? ' active' : '')
      btn.textContent = tab.label
      btn.dataset.tab = tab.id
      btn.addEventListener('click', () => this.switchTab(tab.id))
      tabBar.appendChild(btn)
    })

    this.appendChild(tabBar)

    // Tab content area
    const content = document.createElement('div')
    content.className = 'settings-tab-content'

    const tabElement = document.createElement(`settings-tab-${this.activeTab}`)
    content.appendChild(tabElement)

    this.appendChild(content)
  }

  switchTab(tabId) {
    if (tabId === this.activeTab) return
    this.activeTab = tabId
    this.render()
  }
}
