function decodeInput(input) {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return new TextDecoder().decode(input)
  if (ArrayBuffer.isView(input)) {
    return new TextDecoder().decode(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
  }
  return String(input ?? '')
}

function parseOptions(input) {
  if (input == null || input === '') return {}
  if (typeof input === 'object' && !(input instanceof Uint8Array) && !ArrayBuffer.isView(input)) {
    return input
  }
  const text = decodeInput(input)
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function encodeResult(value) {
  return {
    returnCode: 0,
    output: new TextEncoder().encode(JSON.stringify(value ?? null)),
  }
}

export class ToastManager extends HTMLElement {
  constructor() {
    super()

    this.observer = null
    this.api = {
      show: async (input) => {
        this.show(parseOptions(input))
        return encodeResult({ ok: true })
      },
      success: async (input) => {
        this.show({ ...parseOptions(input), type: 'success' })
        return encodeResult({ ok: true })
      },
      error: async (input) => {
        this.show({ ...parseOptions(input), type: 'error' })
        return encodeResult({ ok: true })
      },
      warning: async (input) => {
        this.show({ ...parseOptions(input), type: 'warning' })
        return encodeResult({ ok: true })
      },
      info: async (input) => {
        this.show({ ...parseOptions(input), type: 'info' })
        return encodeResult({ ok: true })
      },
      alert: async (input) => encodeResult(await this.alert(parseOptions(input))),
      confirm: async (input) => encodeResult(await this.confirm(parseOptions(input))),
      closeAll: async (input) => {
        const options = parseOptions(input)
        this.closeAll(options.position)
        return encodeResult({ ok: true })
      },
    }
  }

  connectedCallback() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          this.updateVisibility()
        }
      })
    })

    this.observer.observe(this, {
      childList: true,
      subtree: false,
    })

    this.updateVisibility()
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect()
    }
  }

  updateVisibility() {
    const toasts = Array.from(this.querySelectorAll('view-toast'))
    const byPosition = {
      primary: [],
      secondary: [],
      modal: [],
    }

    toasts.forEach((toast) => {
      const pos = toast.getAttribute('position') || 'primary'
      if (byPosition[pos]) {
        byPosition[pos].push(toast)
      }
    })

    byPosition.primary.forEach((toast, index) => {
      toast.removeAttribute('hidden')
      toast.style.setProperty('--toast-stack-index', index)
    })

    byPosition.secondary.forEach((toast, index, arr) => {
      if (index === arr.length - 1) toast.removeAttribute('hidden')
      else toast.setAttribute('hidden', '')
    })

    byPosition.modal.forEach((toast, index, arr) => {
      if (index === arr.length - 1) toast.removeAttribute('hidden')
      else toast.setAttribute('hidden', '')
    })
  }

  show({ message = '', type = 'info', duration = 3000, position = 'primary' } = {}) {
    const toast = document.createElement('view-toast')
    toast.setAttribute('type', type)
    toast.setAttribute('position', position)
    toast.setAttribute('duration', duration.toString())
    toast.setAttribute('mode', 'toast')
    toast.textContent = message
    this.appendChild(toast)
    return toast
  }

  async alert({ message = '', type = 'info', buttonText = 'OK' } = {}) {
    const toast = document.createElement('view-toast')
    toast.setAttribute('type', type)
    toast.setAttribute('position', 'modal')
    toast.setAttribute('duration', '0')
    toast.setAttribute('mode', 'alert')
    toast.setAttribute('confirm-text', buttonText)
    toast.textContent = message
    this.appendChild(toast)
    return await toast.promise
  }

  async confirm({ message = '', type = 'info', confirmText = 'Confirm', cancelText = 'Cancel' } = {}) {
    const toast = document.createElement('view-toast')
    toast.setAttribute('type', type)
    toast.setAttribute('position', 'modal')
    toast.setAttribute('duration', '0')
    toast.setAttribute('mode', 'confirm')
    toast.setAttribute('confirm-text', confirmText)
    toast.setAttribute('cancel-text', cancelText)
    toast.textContent = message
    this.appendChild(toast)
    return await toast.promise
  }

  closeAll(position) {
    const selector = position ? `view-toast[position="${position}"]` : 'view-toast'
    const toasts = this.querySelectorAll(selector)
    toasts.forEach((toast) => toast.close(false))
  }

  get toasts() {
    return Array.from(this.querySelectorAll('view-toast'))
  }

  get toastCount() {
    return this.querySelectorAll('view-toast').length
  }
}

if (!customElements.get('toast-manager')) {
  customElements.define('toast-manager', ToastManager)
}

/**
 * Toast Component
 * 
 * Individual toast notification with auto-dismiss, hover pause, and action buttons.
 * Supports three modes: toast (simple notification), alert (requires acknowledgment), confirm (yes/no).
 * 
 * Attributes:
 * - type: 'info' | 'success' | 'warning' | 'error' (default: 'info')
 * - position: 'primary' | 'secondary' | 'modal' (default: 'primary')
 * - duration: number in ms (default: 3000, 0 = no auto-dismiss)
 * - mode: 'toast' | 'alert' | 'confirm' (default: 'toast')
 */

const TYPE_TO_INTENT = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
}

const TOAST_TEMPLATE_HTML = {
  toast: `
    <span data-element="message"></span>
    <button part="close" type="button" data-action="close" aria-label="Close"><i style="font-size: inherit;">close</i></button>
  `,
  alert: `
    <div class="toast-container">
      <span data-element="message"></span>
      <div class="toast-actions">
        <button class="accent" data-action="confirm" data-element="confirm-button">OK</button>
      </div>
    </div>
  `,
  confirm: `
    <div class="toast-container">
      <span data-element="message"></span>
      <div class="toast-actions">
        <button data-action="cancel" data-element="cancel-button">Cancel</button>
        <button class="accent" data-action="confirm" data-element="confirm-button">Confirm</button>
      </div>
    </div>
  `,
}

const TOAST_TEMPLATES = Object.fromEntries(Object.entries(TOAST_TEMPLATE_HTML).map(([mode, html]) => {
  const template = document.createElement('template')
  template.innerHTML = html
  return [mode, template]
}))

function cloneTemplateForMode(mode) {
  const template = TOAST_TEMPLATES[mode] || TOAST_TEMPLATES.toast
  return template.content.cloneNode(true)
}

export class ViewToast extends HTMLElement {
  constructor() {
    super()

    this.isClosing = false
    this.timerId = null
    this.remainingTime = 0
    this.startTime = 0
    this.isPaused = false

    // Promise resolver for alert/confirm modes
    this._resolve = null
  }

  connectedCallback() {
    this.render()
    this.setupEventHandlers()
    this.startTimer()

    // Animate in
    this.animateIn()
  }

  disconnectedCallback() {
    this.clearTimer()
  }

  /**
   * Get duration from attribute (default 3000ms, 0 = no auto-dismiss)
   */
  get duration() {
    const dur = parseInt(this.getAttribute('duration'), 10)
    return isNaN(dur) ? 3000 : dur
  }

  /**
   * Get mode from attribute
   */
  get mode() {
    return this.getAttribute('mode') || 'toast'
  }

  /**
   * Get type from attribute
   */
  get type() {
    return this.getAttribute('type') || 'info'
  }

  /**
   * Get position from attribute
   */
  get position() {
    return this.getAttribute('position') || 'primary'
  }

  /**
   * Promise that resolves when toast is dismissed (for alert/confirm)
   */
  get promise() {
    if (this._promise) return this._promise

    this._promise = new Promise(resolve => {
      this._resolve = resolve
    })

    return this._promise
  }

  /**
   * Render toast structure using HTML templates
   */
  render() {
    // Get message from innerHTML before clearing
    const message = this.textContent.trim()

    // Clear current content
    this.innerHTML = ''

    // Apply intent class from type (info→.info, success→.success, error→.danger)
    const intentClass = TYPE_TO_INTENT[this.type] || 'info'
    this.classList.add(intentClass)

    // Set position attribute for CSS
    if (!this.hasAttribute('position')) {
      this.setAttribute('position', 'primary')
    }

    // Clone mode template from local JS constants
    const templateContent = cloneTemplateForMode(this.mode)

    // Set message
    const messageElement = templateContent.querySelector('[data-element="message"]')
    if (messageElement) {
      messageElement.textContent = message
    }

    // Set custom button text if provided
    const confirmButton = templateContent.querySelector('[data-element="confirm-button"]')
    if (confirmButton && this.hasAttribute('confirm-text')) {
      confirmButton.textContent = this.getAttribute('confirm-text')
    }

    const cancelButton = templateContent.querySelector('[data-element="cancel-button"]')
    if (cancelButton && this.hasAttribute('cancel-text')) {
      cancelButton.textContent = this.getAttribute('cancel-text')
    }

    // Handle close button visibility
    const closeButton = templateContent.querySelector('[data-action="close"]')
    if (closeButton) {
      // Always visible if no timer, hover-only if has timer
      if (this.duration > 0) {
        closeButton.classList.add('toast-close-hover-only')
      }
    }

    // Append to toast
    this.appendChild(templateContent)
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Click to close (for toast mode)
    if (this.mode === 'toast') {
      this.addEventListener('click', (e) => {
        // Don't close if clicking close button (it has its own handler)
        if (e.target.closest('[data-action="close"]')) return
        this.close(true)
      })
    }

    // Close button
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close"]')) {
        e.stopPropagation()
        this.close(true)
      }
    })

    // Confirm button
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="confirm"]')) {
        this.close(true)
      }
    })

    // Cancel button
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="cancel"]')) {
        this.close(false)
      }
    })

    // Hover pause/resume (only for timed toasts)
    if (this.duration > 0) {
      this.addEventListener('mouseenter', () => this.pauseTimer())
      this.addEventListener('mouseleave', () => this.resetTimer())
    }
  }

  /**
   * Animate toast entrance
   */
  animateIn() {
    const position = this.position

    // Set initial state based on position
    this.style.opacity = '0'

    if (position === 'primary') {
      this.style.transform = 'translateX(100%)'
    } else if (position === 'secondary') {
      this.style.transform = 'translateX(-50%) translateY(100%)'
    } else if (position === 'modal') {
      this.style.transform = 'translate(-50%, -50%) scale(0.95)'
    }

    this.style.transition = 'none'

    // Force reflow
    this.offsetHeight

    // Animate to final state
    this.style.transition = 'opacity var(--toast-animation-duration, 200ms) var(--toast-animation-easing, ease-out), transform var(--toast-animation-duration, 200ms) var(--toast-animation-easing, ease-out)'
    this.style.opacity = '1'

    if (position === 'primary') {
      this.style.transform = 'translateX(0)'
    } else if (position === 'secondary') {
      this.style.transform = 'translateX(-50%) translateY(0)'
    } else if (position === 'modal') {
      this.style.transform = 'translate(-50%, -50%) scale(1)'
    }

    // Clean up inline styles after animation
    setTimeout(() => {
      if (!this.isClosing) {
        this.style.transition = ''
        this.style.transform = ''  // Clear to let CSS handle stacking
        this.style.opacity = ''
      }
    }, 200)
  }

  /**
   * Start auto-dismiss timer
   */
  startTimer() {
    if (this.duration <= 0) return
    if (this.mode !== 'toast') return // No auto-dismiss for alert/confirm

    this.remainingTime = this.duration
    this.startTime = Date.now()
    this.isPaused = false

    this.timerId = setTimeout(() => {
      this.close(true)
    }, this.remainingTime)
  }

  /**
   * Pause timer on hover
   */
  pauseTimer() {
    if (!this.timerId || this.isPaused) return

    clearTimeout(this.timerId)
    this.timerId = null
    this.isPaused = true

    // Calculate remaining time
    const elapsed = Date.now() - this.startTime
    this.remainingTime = Math.max(0, this.remainingTime - elapsed)
  }

  /**
   * Reset timer to full duration on mouseout
   */
  resetTimer() {
    if (!this.isPaused) return

    this.isPaused = false
    this.remainingTime = this.duration // Full reset
    this.startTime = Date.now()

    this.timerId = setTimeout(() => {
      this.close(true)
    }, this.remainingTime)
  }

  /**
   * Clear timer
   */
  clearTimer() {
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  /**
   * Close the toast with animation
   * @param {boolean} result - Result to resolve promise with (for alert/confirm)
   */
  close(result = true) {
    if (this.isClosing) return

    this.isClosing = true
    this.clearTimer()

    // Resolve promise for alert/confirm
    if (this._resolve) {
      this._resolve(result)
    }

    // Emit closing event
    this.dispatchEvent(new CustomEvent('toast-closing', {
      detail: { toast: this, result },
      bubbles: true,
      cancelable: false
    }))

    // Animate out based on position
    const position = this.position

    this.style.transition = 'opacity var(--toast-animation-duration, 200ms) var(--toast-animation-easing, ease-out), transform var(--toast-animation-duration, 200ms) var(--toast-animation-easing, ease-out)'
    this.style.opacity = '0'

    if (position === 'primary') {
      this.style.transform = 'translateX(100%)'
    } else if (position === 'secondary') {
      this.style.transform = 'translateX(-50%) translateY(100%)'
    } else if (position === 'modal') {
      this.style.transform = 'translate(-50%, -50%) scale(0.95)'
    }

    // Remove after animation
    setTimeout(() => {
      if (this.parentNode) {
        this.parentNode.removeChild(this)
      }
    }, 200)
  }

  /**
   * Set message content
   */
  setMessage(message) {
    const messageElement = this.querySelector('[data-element="message"]')
    if (messageElement) {
      messageElement.textContent = message
    }
  }
}

if (!customElements.get('view-toast')) {
  customElements.define('view-toast', ViewToast)
}

