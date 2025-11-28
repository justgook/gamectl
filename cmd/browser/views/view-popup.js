/**
 * Popup Wrapper Component
 * 
 * Wraps content with popup UI (header, close button, styling).
 * Handles its own cleanup and provides consistent popup interface.
 */
export class ViewPopup extends HTMLElement {
  constructor() {
    super()

    this.isClosing = false
  }

  connectedCallback() {
    this.render()
    this.setupEventHandlers()

    // Auto-cleanup when close event is fired
    this.addEventListener('close', () => {
      if (!this.isClosing) {
        this.close()
      }
    })
  }

  /**
   * Render popup structure
   */
  render() {
    // Get attributes
    const title = this.getAttribute('title') || ''
    const size = this.getAttribute('size') || 'medium'

    // Store original content
    const originalContent = Array.from(this.childNodes)

    // Clear and rebuild with popup structure
    this.innerHTML = ''

    // Add CSS classes
    this.classList.add('popup', `popup-size-${size}`)

    // Create popup structure
    const container = document.createElement('div')
    container.className = 'popup-container'

    // Create header if title provided
    if (title) {
      const header = document.createElement('div')
      header.className = 'popup-header'

      const titleElement = document.createElement('h2')
      titleElement.className = 'popup-title'
      titleElement.textContent = title

      const closeButton = document.createElement('button')
      closeButton.className = 'popup-close'
      closeButton.type = 'button'
      closeButton.innerHTML = '×'
      closeButton.setAttribute('aria-label', 'Close popup')
      closeButton.addEventListener('click', () => this.close())

      header.appendChild(titleElement)
      header.appendChild(closeButton)
      container.appendChild(header)
    }

    // Create content area
    const content = document.createElement('div')
    content.className = 'popup-content'

    // Restore original content
    originalContent.forEach(node => content.appendChild(node))

    container.appendChild(content)
    this.appendChild(container)
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Close on backdrop click
    this.addEventListener('click', (e) => {
      if (e.target === this) {
        this.close()
      }
    })

    // Prevent clicks inside popup from bubbling to backdrop
    const container = this.querySelector('.popup-container')
    if (container) {
      container.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    }
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

  /**
   * Set popup title
   */
  setTitle(title) {
    this.setAttribute('title', title)
    const titleElement = this.querySelector('.popup-title')
    if (titleElement) {
      titleElement.textContent = title
    }
  }

  /**
   * Set popup size
   */
  setSize(size) {
    // Remove old size class
    this.className = this.className.replace(/popup-size-\w+/g, '')

    // Add new size class
    this.setAttribute('size', size)
    this.classList.add(`popup-size-${size}`)
  }

  /**
   * Get popup content container
   */
  get contentContainer() {
    return this.querySelector('.popup-content')
  }

  /**
   * Set content (replaces existing content)
   */
  setContent(content) {
    const contentContainer = this.contentContainer
    if (!contentContainer) return

    contentContainer.innerHTML = ''

    if (typeof content === 'string') {
      contentContainer.innerHTML = content
    } else if (content instanceof HTMLElement) {
      contentContainer.appendChild(content)
    } else if (content instanceof DocumentFragment) {
      contentContainer.appendChild(content)
    }
  }

  /**
   * Add content (appends to existing content)
   */
  addContent(content) {
    const contentContainer = this.contentContainer
    if (!contentContainer) return

    if (typeof content === 'string') {
      const temp = document.createElement('div')
      temp.innerHTML = content
      while (temp.firstChild) {
        contentContainer.appendChild(temp.firstChild)
      }
    } else if (content instanceof HTMLElement) {
      contentContainer.appendChild(content)
    } else if (content instanceof DocumentFragment) {
      contentContainer.appendChild(content)
    }
  }

  /**
   * Clear content
   */
  clearContent() {
    const contentContainer = this.contentContainer
    if (contentContainer) {
      contentContainer.innerHTML = ''
    }
  }

  // Lifecycle callbacks for attribute changes
  static get observedAttributes() {
    return ['title', 'size']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.isConnected) return

    switch (name) {
      case 'title':
        const titleElement = this.querySelector('.popup-title')
        if (titleElement) {
          titleElement.textContent = newValue || ''
        }
        break
      case 'size':
        this.setSize(newValue || 'medium')
        break
    }
  }
}

customElements.define('view-popup', ViewPopup)
