import { getDirectoryHandle } from "./getdir.js"
/**
 * Plugin Manager Proxy (Main Thread)
 * 
 * Provides the same async API as PluginManager but executes calls in a Web Worker
 * to avoid blocking the main thread during WASM execution.
 * 
 * Usage:
 *   const manager = await PluginManagerProxy.create({ modules: [...] })
 *   const result = await manager.call('plugin', 'function', input)
 */

export class PluginManagerProxy {
  constructor() {
    this.worker = null
    this.messageId = 0
    this.pending = new Map()
  }

  /**
   * Create a new PluginManagerProxy instance
   * @param {Object} options - Same options as PluginManager.create()
   * @returns {Promise<PluginManagerProxy>}
   */
  static async create() {

    const proxy = new PluginManagerProxy()
    await proxy.init()
    return proxy
  }

  /**
   * Initialize the worker and plugin manager
   */
  async init() {
    // Create worker
    this.worker = new Worker(new URL("worker.js", import.meta.url))

    // Set up message handler
    this.worker.onmessage = (e) => this.handleMessage(e)
    this.worker.onerror = (error) => this.handleError(error)

    const dir = window.showDirectoryPicker ? await getDirectoryHandle() : null

    return this.sendMessage('init', dir)

  }

  /**
   * Call a plugin function
   * @param {string} moduleName
   * @param {string} functionName
   * @param {string|Uint8Array} input
   * @returns {Promise<{returnCode: number, output: Uint8Array}>}
   */
  async call(moduleName, functionName, input) {
    // Convert string input to Uint8Array
    let inputArray = input
    if (typeof input === 'string') {
      inputArray = new TextEncoder().encode(input)
    } else if (!(input instanceof Uint8Array)) {
      inputArray = new Uint8Array(input)
    }

    // Transfer the input buffer for zero-copy performance
    const inputBuffer = inputArray.buffer

    const result = await this.sendMessage(
      'call',
      { moduleName, functionName, input: inputArray },
      [inputBuffer]
    )

    return result
  }

  /**
   * Call a plugin function directly (without PDK wrapper)
   * @param {string} moduleName
   * @param {string} functionName
   * @param {any} input
   * @returns {Promise<any>}
   */
  async rawCall(moduleName, functionName, input) {
    const result = await this.sendMessage('rawCall', {
      moduleName,
      functionName,
      input
    })
    return result
  }

  /**
   * Send a message to the worker and wait for response
   */
  sendMessage(type, payload, transfer = []) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++
      this.pending.set(id, { resolve, reject })

      this.worker.postMessage({ id, type, payload }, transfer)
    })
  }

  /**
   * Handle messages from worker
   */
  handleMessage(e) {
    const { id, type, result, error } = e.data

    if (type === 'error') {
      const pending = this.pending.get(id)
      if (pending) {
        const err = new Error(error.message)
        err.stack = error.stack
        pending.reject(err)
        this.pending.delete(id)
      }
      return
    }

    if (type === 'init-success') {
      const pending = this.pending.get(id)
      if (pending) {
        pending.resolve()
        this.pending.delete(id)
      }
      return
    }

    if (type === 'call-result') {
      const pending = this.pending.get(id)
      if (pending) {
        pending.resolve(result)
        this.pending.delete(id)
      }
      return
    }

    if (type === 'rawcall-result') {
      const pending = this.pending.get(id)
      if (pending) {
        pending.resolve(result)
        this.pending.delete(id)
      }
      return
    }
  }

  /**
   * Handle worker errors
   */
  handleError(error) {
    console.error('Worker error:', error)
    // Reject all pending promises
    for (const [id, pending] of this.pending) {
      pending.reject(error)
    }
    this.pending.clear()
  }

  /**
   * Close the worker
   */
  close() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pending.clear()
  }
}

