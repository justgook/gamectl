import { runtime } from '/core/runtime.js'
import { ensureThemeStylesheetLink } from "/util/add-style.js"

function decodeInput(input) {
  console.trace("replace decodeInput with result")
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return new TextDecoder().decode(input)
  if (ArrayBuffer.isView(input)) {
    return new TextDecoder().decode(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
  }
  return String(input ?? '')
}

function parseOptions(input) {
  console.trace("replace parseOptions with result")

  if (input == null || input === '') return {}
  if (typeof input === 'object' && !(input instanceof Uint8Array) && !ArrayBuffer.isView(input)) {
    return input
  }
  const text = decodeInput(input)
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { value: text }
  }
}

function encodeResult(value) {
  console.trace("replace encodeResult with result")
  return {
    returnCode: 0,
    output: new TextEncoder().encode(JSON.stringify(value ?? null)),
  }
}

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
    this.stack = []
    this.nextPopupId = 1
    this.api = {
      open: async (input) => encodeResult(await this.open(parseOptions(input))),
      close: async (input) => encodeResult(await this.close(parseOptions(input))),
      closeTop: async (input) => encodeResult(await this.close(parseOptions(input))),
      closeAll: async () => encodeResult(await this.closeAll()),
      isOpen: async () => ({ ok: { count: this.popupCount } }),
    }
  }

  connectedCallback() {
    this.style.display = "contents"
    this.style.isolation = "isolate"

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
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect()
    }

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
   * Programmatic API for showing popups
   * @param {Object} options - Popup configuration
   * @param {string} options.title - Popup title
   * @param {string|HTMLElement} options.content - Popup content
   * @param {string} options.size - Popup size (small, medium, large)
   * @returns {HTMLElement} The created popup element
   */
  showPopup({ title = '', content = '', size = 'large', popupId = null } = {}) {
    const popup = document.createElement('view-popup')

    if (popupId != null) {
      popup.dataset.popupId = String(popupId)
    }

    if (size) {
      popup.setAttribute('size', size)
    }

    if (title) {
      const titleElement = document.createElement('h2')
      titleElement.slot = 'title'
      titleElement.className = 'popup-title'
      titleElement.textContent = title
      popup.appendChild(titleElement)
    }

    if (typeof content === 'string') {
      popup.innerHTML += content
    } else if (content instanceof HTMLElement) {
      popup.appendChild(content)
    }

    this.appendChild(popup)

    return popup
  }

  setViewRegistry(viewRegistry) {
    this.viewRegistry = viewRegistry
  }

  async createContent(options = {}) {
    const { tag = '', html = '', props = {}, attributes = {} } = options

    if (tag) {
      const entry = this.viewRegistry?.get(tag) || null
      const element = typeof entry?.create === 'function'
        ? await entry.create({ tag, attrs: attributes, innerHTML: '', popup: this })
        : document.createElement(tag)
      element.popupProps = props || {}
      for (const [key, value] of Object.entries(attributes || {})) {
        if (value == null) continue
        element.setAttribute(key, String(value))
      }
      return element
    }

    if (html) {
      const wrapper = document.createElement('div')
      wrapper.innerHTML = html
      const firstElement = wrapper.firstElementChild
      if (firstElement) {
        firstElement.popupProps = props || {}
      }
      return firstElement || wrapper
    }

    const empty = document.createElement('div')
    empty.textContent = ''
    empty.popupProps = props || {}
    return empty
  }

  async open(options = {}) {
    const popupId = this.nextPopupId++
    const content = await this.createContent(options)
    const popup = this.showPopup({
      title: options.title || '',
      content,
      size: options.size || 'large',
      popupId,
    })

    popup.popupProps = options.props || {}
    popup.popupId = popupId
    if (content && typeof content === 'object') {
      content.popupId = popupId
      content.popupHost = popup
    }

    return await new Promise((resolve) => {
      const frame = { popupId, popup, resolve, closed: false }
      this.stack.push(frame)
      popup.addEventListener('popup-closing', () => {
        if (frame.closed) return
        const idx = this.stack.findIndex((entry) => entry.popupId === popupId)
        if (idx >= 0) this.stack.splice(idx, 1)
        frame.closed = true
        frame.resolve({ ok: false, cancelled: true, reason: 'closed' })
      }, { once: true })
    })
  }

  async close(result = { ok: false, cancelled: true }) {
    const frame = this.stack[this.stack.length - 1]
    if (!frame) {
      return { ok: false, error: 'no_active_popup' }
    }

    this.stack.pop()
    frame.closed = true
    frame.resolve(result)
    frame.popup.close()
    return { ok: true, popupId: frame.popupId, result }
  }

  async closeAll(result = { ok: false, cancelled: true, reason: 'close-all' }) {
    const frames = this.stack.splice(0)
    for (const frame of frames.reverse()) {
      frame.closed = true
      frame.resolve(result)
      frame.popup.close()
    }
    return { ok: true, closed: frames.length }
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
      <link rel="stylesheet" href="/css/reset.css">
      <link rel="stylesheet" href="/css/base.css">
        <section part="container">
          <header part="header">
            <slot name="title"></slot>
            <slot name="header-controls"></slot>
            <button part="close" type="button" data-action="close" aria-label="Close popup"><i style="font-size: inherit;">close</i></button>

          </header>
          <main part="body">
            <slot></slot>
          </main>
        </section>
      `

    // Setup close button
    const closeBtn = this.shadowRoot.querySelector('[data-action="close"]')
    if (closeBtn) {
      closeBtn.addEventListener('click', async () => {
        await runtime.call('ui.popup', 'close', { ok: false, cancelled: true, reason: 'dismissed' })
      })
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
    ensureThemeStylesheetLink(this.shadowRoot)
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
