/**
 * Plugin Manager Proxy (Main Thread)
 * 
 * Provides the same async API as PluginManager but executes calls in a Web Worker
 * to avoid blocking the main thread during WASM execution.
 * 
 * Detects the filesystem backend from localStorage:
 *   - If 'fs.webdav.url' is set, uses WebDAV backend
 *   - Otherwise, falls back to OPFS (Origin Private File System)
 * 
 * Usage:
 *   const manager = await PluginManagerProxy.create()
 *   const result = await manager.call('plugin', 'function', input)
 */

export class PluginManagerProxy {
  constructor() {
    this.worker = null
    this.messageId = 0
    this.pending = new Map()
    this.viewPluginInstances = new Map()
    this.nextViewPluginInstanceId = 1
    this.decoder = new TextDecoder()
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
    // Create worker as ES module
    this.worker = new Worker(new URL("worker.js", import.meta.url), { type: 'module' })

    // Set up message handler
    this.worker.onmessage = (e) => this.handleMessage(e)
    this.worker.onerror = (error) => this.handleError(error)

    // Detect filesystem backend from localStorage and pass config to worker
    const fsConfig = this.detectBackend()
    return this.sendMessage('init', { fsConfig })
  }

  /**
   * Detect the filesystem backend from localStorage
   * 
   * Checks for known backend configuration keys:
   *   - 'fs.webdav.url' → WebDAV backend
   *   - (future backends can be added here)
   *   - Default → OPFS
   * 
   * @returns {{type: string, options: Object}}
   */
  detectBackend() {
    // WebDAV: check for server URL
    const webdavUrl = localStorage.getItem('fs.webdav.url')
    if (webdavUrl) {
      const { url, authorization, displayUrl } = parseWebdavUrl(webdavUrl)
      console.log('[FS] Using WebDAV backend:', displayUrl)
      return { type: 'webdav', options: { url, authorization } }
    }

    // Default: OPFS
    console.log('[FS] Using OPFS backend')
    return { type: 'opfs', options: {} }
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
   * Phase 2: Load additional plugins from DB registry
   * Called after migrations have run and the plugins table is available.
   * 
   * @param {Array<{name: string, url: string}>} plugins - Plugin entries from DB
   * @returns {Promise<{loaded: string[], failed: Array<{name: string, error: string}>}>}
   */
  async loadPlugins(plugins) {
    return this.sendMessage('loadPlugins', { plugins })
  }

  /**
   * Load a plugin runtime instance from the plugin registry.
   *
   * Supports:
   * - load('stbte')
   * - load({ name: 'stbte', importObject })
   *
   * Only enabled plugins can be loaded.
   * Returns an instance handle that can be unloaded via unload().
   */
  async load(plugin) {
    const opts = typeof plugin === 'string' ? { name: plugin } : (plugin || {})
    if (!opts.name) {
      throw new Error('load() requires a plugin name')
    }

    const resolved = await this.resolvePlugin(opts.name)
    const wasmBytes = await this.readPluginWasmBytes(resolved.url)
    const importObject = this.createViewPluginImportObject(opts.importObject || {})

    const { instance } = await WebAssembly.instantiate(wasmBytes, importObject)

    if (typeof instance.exports?._initialize === 'function') {
      instance.exports._initialize()
    }

    const id = this.nextViewPluginInstanceId++
    const handle = {
      id,
      name: resolved.name,
      url: resolved.url,
      scope: resolved.scope,
      instance,
      exports: instance.exports,
      memory: instance.exports?.memory || importObject?.env?.memory || null
    }

    this.viewPluginInstances.set(id, handle)
    return handle
  }

  createViewPluginImportObject(importObject = {}) {
    const env = {
      alloc: () => 0,
      free: () => {},
      input_ptr: () => 0,
      input_len: () => 0,
      set_output: () => {},
      plugin_call: () => 5,
      plugin_call_return: () => 1,
      plugin_call_output_ptr: () => 0,
      plugin_call_output_len: () => 0,
      ng_on_node_changed: () => {},
      ng_on_run_event: () => {},
      ng_on_goal_reached: () => {},
      ng_host_resolve: () => 7,
      ng_host_request: () => 7,
      ...(importObject.env || {})
    }

    return {
      ...importObject,
      env
    }
  }

  /**
   * Unload a previously loaded plugin runtime instance.
   * Accepts either the handle returned by load() or the numeric instance id.
   */
  unload(handleOrId) {
    const id = typeof handleOrId === 'number' ? handleOrId : handleOrId?.id
    if (typeof id !== 'number') {
      return false
    }
    return this.viewPluginInstances.delete(id)
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

    if (type === 'loadPlugins-success') {
      const pending = this.pending.get(id)
      if (pending) {
        pending.resolve(result)
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
    for (const [_id, pending] of this.pending) {
      pending.reject(error)
    }
    this.pending.clear()
  }

  /**
   * Close the worker
   */
  close() {
    this.viewPluginInstances.clear()

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pending.clear()
  }

  parsePluginRow(line) {
    const firstComma = line.indexOf(',')
    if (firstComma === -1) return null

    const lastComma = line.lastIndexOf(',')
    if (lastComma === -1) return null

    const secondLastComma = line.lastIndexOf(',', lastComma - 1)
    const thirdLastComma = line.lastIndexOf(',', secondLastComma - 1)
    if (secondLastComma === -1 || thirdLastComma === -1) {
      return null
    }

    return {
      name: line.slice(0, firstComma),
      url: line.slice(firstComma + 1, thirdLastComma),
      enabled: line.slice(thirdLastComma + 1, secondLastComma) === '1',
      type: line.slice(secondLastComma + 1, lastComma),
      scope: line.slice(lastComma + 1)
    }
  }

  async resolvePlugin(name) {
    const escapedName = name.replace(/'/g, "''")
    const result = await this.call(
      'sql',
      'query',
      `SELECT name, url, enabled, type, scope FROM plugins WHERE name = '${escapedName}' ORDER BY enabled DESC, rowid LIMIT 1`
    )

    const csv = this.decoder.decode(result.output).trim()
    const lines = csv.split('\n')
    if (lines.length < 2 || !lines[1].trim()) {
      throw new Error(`Plugin '${name}' not found in registry`)
    }

    const parsed = this.parsePluginRow(lines[1].trim())
    if (!parsed) {
      throw new Error(`Failed to parse plugin '${name}' registry row`)
    }

    if (!parsed.enabled) {
      throw new Error(`Plugin '${name}' is disabled in settings`)
    }

    return parsed
  }

  async readPluginWasmBytes(url) {
    if (url.startsWith('local:')) {
      const localUrl = new URL(url.slice(6), location.origin).href
      const response = await fetch(localUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch plugin from ${url}: ${response.status} ${response.statusText}`)
      }
      return response.arrayBuffer()
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch plugin from ${url}: ${response.status} ${response.statusText}`)
      }
      return response.arrayBuffer()
    }

    const result = await this.call('fs', 'read', url)
    if (result.returnCode !== 0) {
      const errorMessage = this.decoder.decode(result.output)
      throw new Error(`Failed to read plugin from ${url}: ${errorMessage}`)
    }

    const bytes = result.output
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
}

function parseWebdavUrl(rawUrl) {
  const trimmedUrl = rawUrl.trim()

  try {
    const parsed = new URL(trimmedUrl)
    const username = parsed.username
    const password = parsed.password
    const hasCredentials = username || password

    if (!hasCredentials) {
      return { url: parsed.toString(), authorization: '', displayUrl: parsed.toString() }
    }

    parsed.username = ''
    parsed.password = ''

    return {
      url: parsed.toString(),
      authorization: `Basic ${btoa(`${username}:${password}`)}`,
      displayUrl: parsed.toString()
    }
  } catch {
    return { url: trimmedUrl, authorization: '', displayUrl: trimmedUrl }
  }
}
