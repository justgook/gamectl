/**
 * Toast Manager Component
 * 
 * Manages all toasts as a transparent wrapper around content.
 * Uses DOM as state - toasts are appended as children.
 * Listens to event bus for toast:show, toast:alert, toast:confirm, toast:close-all.
 * 
 * Position stacking rules:
 * - primary:   unlimited, all visible, stacked vertically (top-right)
 * - secondary: limit 1, only last visible (bottom-center)
 * - modal:     limit 1, only last visible (center, for alert/confirm)
 */
import { bus } from '../systems/event-bus.js'

export class ToastManager extends HTMLElement {
  constructor() {
    super()

    this.observer = null
    this.unsubscribers = []
  }

  connectedCallback() {
    // Set up mutation observer to manage position-based visibility
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          this.updateVisibility()
        }
      })
    })

    this.observer.observe(this, {
      childList: true,
      subtree: false
    })

    // Subscribe to event bus
    this.unsubscribers.push(
      bus.on('toast:show', (data) => this.show(data)),
      bus.on('toast:alert', (data) => this.alert(data)),
      bus.on('toast:confirm', (data) => this.confirm(data)),
      bus.on('toast:close-all', (data) => this.closeAll(data?.position))
    )

    // Initial visibility update
    this.updateVisibility()
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect()
    }

    // Unsubscribe from event bus
    this.unsubscribers.forEach(unsub => unsub())
    this.unsubscribers = []
  }

  /**
   * Update visibility of toasts based on position rules
   * - primary: all visible
   * - secondary/modal: only last of that position visible
   */
  updateVisibility() {
    const toasts = Array.from(this.querySelectorAll('view-toast'))

    // Group toasts by position
    const byPosition = {
      'primary': [],
      'secondary': [],
      'modal': []
    }

    toasts.forEach(toast => {
      const pos = toast.getAttribute('position') || 'primary'
      if (byPosition[pos]) {
        byPosition[pos].push(toast)
      }
    })

    // primary: all visible, update offset for stacking
    byPosition['primary'].forEach((toast, index) => {
      toast.removeAttribute('hidden')
      toast.style.setProperty('--toast-stack-index', index)
    })

    // secondary: only last visible
    byPosition['secondary'].forEach((toast, index, arr) => {
      if (index === arr.length - 1) {
        toast.removeAttribute('hidden')
      } else {
        toast.setAttribute('hidden', '')
      }
    })

    // modal: only last visible
    byPosition['modal'].forEach((toast, index, arr) => {
      if (index === arr.length - 1) {
        toast.removeAttribute('hidden')
      } else {
        toast.setAttribute('hidden', '')
      }
    })
  }

  /**
   * Show a toast notification
   * @param {Object} options
   * @param {string} options.message - Toast message
   * @param {string} options.type - 'info' | 'success' | 'warning' | 'error'
   * @param {number} options.duration - Auto-dismiss in ms (0 = no auto-dismiss)
   * @param {string} options.position - 'primary' | 'secondary' | 'modal'
   * @returns {HTMLElement} The created toast element
   */
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

  /**
   * Show an alert toast (requires acknowledgment)
   * @param {Object} options
   * @param {string} options.message - Alert message
   * @param {string} options.id - Unique ID for event bus response
   * @param {string} options.type - Toast type
   * @param {string} options.buttonText - Confirm button text
   * @returns {Promise<true>} Resolves when user acknowledges
   */
  async alert({ message = '', id, type = 'info', buttonText = 'OK' } = {}) {
    const toast = document.createElement('view-toast')

    toast.setAttribute('type', type)
    toast.setAttribute('position', 'modal')
    toast.setAttribute('duration', '0')
    toast.setAttribute('mode', 'alert')
    toast.setAttribute('confirm-text', buttonText)
    toast.textContent = message

    this.appendChild(toast)

    const result = await toast.promise

    // Emit result via event bus if id provided
    if (id) {
      bus.emit(`toast:resolved:${id}`, result)
    }

    return result
  }

  /**
   * Show a confirm toast (yes/no choice)
   * @param {Object} options
   * @param {string} options.message - Confirm message
   * @param {string} options.id - Unique ID for event bus response
   * @param {string} options.type - Toast type
   * @param {string} options.confirmText - Confirm button text
   * @param {string} options.cancelText - Cancel button text
   * @returns {Promise<boolean>} Resolves with user choice
   */
  async confirm({ message = '', id, type = 'info', confirmText = 'Confirm', cancelText = 'Cancel' } = {}) {
    const toast = document.createElement('view-toast')

    toast.setAttribute('type', type)
    toast.setAttribute('position', 'modal')
    toast.setAttribute('duration', '0')
    toast.setAttribute('mode', 'confirm')
    toast.setAttribute('confirm-text', confirmText)
    toast.setAttribute('cancel-text', cancelText)
    toast.textContent = message

    this.appendChild(toast)

    const result = await toast.promise

    // Emit result via event bus if id provided
    if (id) {
      bus.emit(`toast:resolved:${id}`, result)
    }

    return result
  }

  /**
   * Close all toasts, optionally filtered by position
   * @param {string} position - Optional position filter
   */
  closeAll(position) {
    const selector = position
      ? `view-toast[position="${position}"]`
      : 'view-toast'

    const toasts = this.querySelectorAll(selector)
    toasts.forEach(toast => toast.close(false))
  }

  /**
   * Get all toasts
   */
  get toasts() {
    return Array.from(this.querySelectorAll('view-toast'))
  }

  /**
   * Get toast count
   */
  get toastCount() {
    return this.querySelectorAll('view-toast').length
  }
}

customElements.define('toast-manager', ToastManager)
