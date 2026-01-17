/**
 * FsAdapter - Main thread adapter for sync filesystem operations
 * 
 * Creates a worker to handle async OPFS operations and provides
 * a synchronous API via SharedArrayBuffer/Atomics.
 */

import { SyncMessenger } from './SyncMessenger.js'

// 12MB buffer - supports files up to ~10MB with JSON overhead
const BUFFER_SIZE = 12 * 1024 * 1024

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export class FsAdapter {
  constructor(messenger) {
    this.messenger = messenger
  }

  /**
   * Start the filesystem adapter
   * Uses OPFS (Origin Private File System) - the worker obtains the root handle internally
   * @returns {Promise<FsAdapter>}
   */
  static async start() {
    // Check for SharedArrayBuffer support
    if (typeof SharedArrayBuffer === 'undefined') {
      throw new Error('SharedArrayBuffer not available. Ensure COOP/COEP headers are set.')
    }

    const sab = new SharedArrayBuffer(BUFFER_SIZE)
    const messenger = new SyncMessenger(sab)

    // Create worker
    const workerUrl = new URL('./fs-worker.js', import.meta.url)
    const worker = new Worker(workerUrl, { type: 'module' })

    // Wait for worker to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker init timeout')), 5000)

      worker.onmessage = (e) => {
        if (Array.isArray(e.data) && e.data[0] === 'ready') {
          clearTimeout(timeout)
          resolve()
        }
      }

      worker.onerror = (err) => {
        clearTimeout(timeout)
        reject(err)
      }

      // Send init message with SAB only (worker gets OPFS root internally)
      worker.postMessage(['init', sab])
    })

    return new FsAdapter(messenger)
  }

  /**
   * Make a sync call to the worker
   * @private
   */
  _call(op, params = {}) {
    const request = encoder.encode(JSON.stringify({ op, ...params }))
    const responseBytes = this.messenger.callSync(request)
    const response = JSON.parse(decoder.decode(responseBytes))

    if (!response.ok) {
      throw new Error(response.error)
    }

    return response.data
  }

  // ---- Sync API ----

  readFileSync(path) {
    const data = this._call('readFile', { path })
    return new Uint8Array(data)
  }

  writeFileSync(path, data) {
    // Convert Uint8Array to regular array for JSON serialization
    const dataArray = data instanceof Uint8Array ? Array.from(data) : data
    this._call('writeFile', { path, data: dataArray })
  }

  unlinkSync(path) {
    this._call('remove', { path })
  }

  existsSync(path) {
    return this._call('exists', { path })
  }

  readdirSync(path) {
    return this._call('readdir', { path })
  }

  mkdirSync(path, options = {}) {
    this._call('mkdir', { path })
  }

  rmdirSync(path) {
    this._call('rmdir', { path })
  }

  statSync(path) {
    const data = this._call('stat', { path })
    return {
      size: data.size,
      isDirectory: () => data.type === 'directory',
      isFile: () => data.type === 'file'
    }
  }
}
