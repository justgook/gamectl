/**
 * Popup Manager Component
 * 
 * Manages all popups as a transparent wrapper around layout content.
 * Uses DOM as state - last child is active popup.
 * Provides backdrop and CSS-driven popup stacking.
 */
export class PopupManager extends HTMLElement {
  constructor() {
    super()

    // Track if we have any popups for backdrop management
    this.observer = null
  }

  connectedCallback() {
    // Add CSS class for styling
    this.classList.add('popup-manager')

    // Set up mutation observer to watch for popup changes
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          this.updateBackdrop()

          // Handle new popup animations
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'VIEW-POPUP') {
              this.animatePopupIn(node)
            }
          })
        }
      })
    })

    this.observer.observe(this, {
      childList: true,
      subtree: false
    })

    // Initial backdrop state
    this.updateBackdrop()

    // Handle escape key for closing topmost popup
    this.setupKeyboardHandling()
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect()
    }

    // Remove global event listeners
    document.removeEventListener('keydown', this.handleKeydown)
  }

  /**
   * Update backdrop visibility based on popup existence
   */
  updateBackdrop() {
    const popups = this.querySelectorAll('view-popup')

    if (popups.length > 0) {
      this.setAttribute('has-popups', '')
    } else {
      this.removeAttribute('has-popups')
    }
  }

  /**
   * Animate popup entrance
   */
  animatePopupIn(popup) {
    // Set initial state for animation
    popup.style.opacity = '0'
    popup.style.transform = 'scale(0.95)'
    popup.style.transition = 'none'

    // Force reflow
    popup.offsetHeight

    // Enable transition and animate to final state
    popup.style.transition = 'opacity var(--popup-animation-duration) var(--popup-animation-easing), transform var(--popup-animation-duration) var(--popup-animation-easing)'
    popup.style.opacity = '1'
    popup.style.transform = 'scale(1)'

    // Clean up inline styles after animation
    setTimeout(() => {
      popup.style.opacity = ''
      popup.style.transform = ''
      popup.style.transition = ''
    }, 200) // Match animation duration
  }

  /**
   * Set up global keyboard handling
   */
  setupKeyboardHandling() {
    this.handleKeydown = (e) => {
      if (e.key === 'Escape') {
        const topPopup = this.querySelector('view-popup:last-of-type')
        if (topPopup) {
          e.preventDefault()
          e.stopPropagation()
          topPopup.close()
        }
      }
    }

    document.addEventListener('keydown', this.handleKeydown)
  }

  /**
   * Programmatic API for showing popups
   * @param {Object} options - Popup configuration
   * @param {string} options.title - Popup title
   * @param {string|HTMLElement} options.content - Popup content
   * @param {string} options.size - Popup size (small, medium, large)
   * @returns {HTMLElement} The created popup element
   */
  showPopup({ title = '', content = '', size = 'medium' } = {}) {
    const popup = document.createElement('view-popup')

    if (title) {
      popup.setAttribute('title', title)
    }

    if (size) {
      popup.setAttribute('size', size)
    }

    if (typeof content === 'string') {
      popup.innerHTML = content
    } else if (content instanceof HTMLElement) {
      popup.appendChild(content)
    }

    this.appendChild(popup)

    return popup
  }

  /**
   * Close the topmost popup
   */
  closeTopPopup() {
    const topPopup = this.querySelector('view-popup:last-of-type')
    if (topPopup) {
      topPopup.close()
    }
  }

  /**
   * Close all popups
   */
  closeAllPopups() {
    const popups = this.querySelectorAll('view-popup')
    popups.forEach(popup => popup.close())
  }

  /**
   * Get the number of open popups
   */
  get popupCount() {
    return this.querySelectorAll('view-popup').length
  }

  /**
   * Get the topmost popup
   */
  get topPopup() {
    return this.querySelector('view-popup:last-of-type')
  }
}

customElements.define('popup-manager', PopupManager)
