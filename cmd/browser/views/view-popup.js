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
    const shadowRoot = this.attachShadow({ mode: 'open' })
    shadowRoot.innerHTML = `
      <link rel="stylesheet" href="reset.css">
      <link rel="stylesheet" href="base.css">
      <link data-theme-stylesheet rel="stylesheet" href="themes/the98.css">
        <section class="popup-container" part="container">
          <header part="header">
            <slot name="title"></slot>
            <slot name="header-controls"></slot>
            <button class="popup-close" type="button" data-action="close" aria-label="Close popup">×</button>
          </header>
          <div class="popup-body" part="body">
            <slot></slot>
          </div>
        </section>
      `

    // Setup close button
    const closeBtn = this.shadowRoot.querySelector('[data-action="close"]')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }

    const container = this.shadowRoot.querySelector('.popup-container')
    if (container) {
      this.addEventListener('click', (e) => {
        if (!e.composedPath().includes(container)) {
          this.close()
        }
      })
    }
  }

  connectedCallback() {
    if (typeof window.__syncThemeStylesheetToRoot === 'function') {
      window.__syncThemeStylesheetToRoot(this.shadowRoot)
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
