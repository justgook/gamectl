/**
 * Toast API
 * 
 * Exported helper functions for showing toasts from anywhere in the app.
 * Uses event bus to communicate with ToastManager.
 * 
 * Usage:
 *   import { toast } from './systems/toast.js'
 *   
 *   toast('Hello world')
 *   toast.success('Saved!')
 *   toast.error('Failed', { duration: 5000 })
 *   
 *   await toast.alert('Something happened')
 *   const confirmed = await toast.confirm('Delete item?')
 */
import { bus } from './event-bus.js'

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {Object} options - Optional configuration
 * @param {string} options.type - 'info' | 'success' | 'warning' | 'error'
 * @param {number} options.duration - Auto-dismiss in ms (default: 3000, 0 = persistent)
 * @param {string} options.position - 'top-right' | 'bottom-center' | 'center'
 */
export function toast(message, options = {}) {
  bus.emit('toast:show', { message, ...options })
}

/**
 * Show a success toast
 */
toast.success = (message, options = {}) => {
  toast(message, { type: 'success', ...options })
}

/**
 * Show an error toast
 */
toast.error = (message, options = {}) => {
  toast(message, { type: 'error', ...options })
}

/**
 * Show a warning toast
 */
toast.warning = (message, options = {}) => {
  toast(message, { type: 'warning', ...options })
}

/**
 * Show an info toast
 */
toast.info = (message, options = {}) => {
  toast(message, { type: 'info', ...options })
}

/**
 * Show an alert toast that requires acknowledgment
 * @param {string} message - Alert message
 * @param {Object} options - Optional configuration
 * @param {string} options.type - Toast type
 * @param {string} options.buttonText - Confirm button text (default: 'OK')
 * @returns {Promise<true>} Resolves when user acknowledges
 */
toast.alert = (message, options = {}) => {
  return new Promise(resolve => {
    const id = crypto.randomUUID()

    bus.once(`toast:resolved:${id}`, () => resolve(true))
    bus.emit('toast:alert', { message, id, ...options })
  })
}

/**
 * Show a confirm toast with yes/no choice
 * @param {string} message - Confirm message
 * @param {Object} options - Optional configuration
 * @param {string} options.type - Toast type
 * @param {string} options.confirmText - Confirm button text (default: 'Confirm')
 * @param {string} options.cancelText - Cancel button text (default: 'Cancel')
 * @returns {Promise<boolean>} Resolves with user choice
 */
toast.confirm = (message, options = {}) => {
  return new Promise(resolve => {
    const id = crypto.randomUUID()

    bus.once(`toast:resolved:${id}`, (result) => resolve(result))
    bus.emit('toast:confirm', { message, id, ...options })
  })
}

/**
 * Close all toasts
 * @param {string} position - Optional position filter
 */
toast.closeAll = (position) => {
  bus.emit('toast:close-all', { position })
}
