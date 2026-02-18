/**
 * Popup Component with Shadow DOM
 * 
 * Uses slot-based architecture similar to ViewChrome.
 * - Main content goes in default slot
 * - Title goes in "title" named slot
 * - Header controls go in "header-controls" named slot
 */
export class ViewPopup extends HTMLElement {
  static get observedAttributes() { return ['size'] }

  constructor() {
    super()

    this.isClosing = false

    // Create shadow DOM
    const template = document.getElementById('popup-template')
    const shadowRoot = this.attachShadow({ mode: 'open' })
    shadowRoot.appendChild(document.importNode(template.content, true))

    // Setup close button
    const closeBtn = this.shadowRoot.querySelector('[data-action="close"]')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }

    // Setup backdrop click handler
    const backdrop = this.shadowRoot.querySelector('.popup-backdrop')
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.close()
        }
      })
    }

    // Prevent clicks inside container from closing
    const container = this.shadowRoot.querySelector('.popup-container')
    if (container) {
      container.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    }
  }

  connectedCallback() {
    this.setAttribute('data-theme', document.documentElement.dataset.theme || 'current')

    // Add base popup class
    if (!this.classList.contains('popup')) {
      this.classList.add('popup')
    }

    // Add size class
    this._updateSizeClass()

    // Auto-cleanup when close event is fired
    this.addEventListener('close', () => {
      if (!this.isClosing) {
        this.close()
      }
    })
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'size' && this.isConnected) {
      this._updateSizeClass()
    }
  }

  _updateSizeClass() {
    const size = this.getAttribute('size') || 'large'
    // Remove old size classes
    this.className = this.className.replace(/popup-size-\w+/g, '').trim()
    // Add new size class
    this.classList.add(`popup-size-${size}`)
  }

  /**
   * Close the popup with animation
   */
  close() {
    if (this.isClosing) return

    this.isClosing = true

    // Emit close event before removal (for any cleanup listeners)
    this.dispatchEvent(new CustomEvent('popup-closing', {
      detail: { popup: this },
      bubbles: true,
      cancelable: false
    }))

    // Animate out
    this.style.transition = 'opacity var(--popup-animation-duration) var(--popup-animation-easing), transform var(--popup-animation-duration) var(--popup-animation-easing)'
    this.style.opacity = '0'
    this.style.transform = 'scale(0.95)'

    // Remove after animation
    setTimeout(() => {
      if (this.parentNode) {
        this.parentNode.removeChild(this)
      }
    }, 200) // Match animation duration
  }
}

customElements.define('view-popup', ViewPopup)
