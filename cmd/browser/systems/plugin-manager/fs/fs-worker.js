/**
 * FS Worker — Backend dispatcher for filesystem operations
 * 
 * Receives sync requests via SharedArrayBuffer/Atomics and delegates
 * to the active backend (OPFS, WebDAV, etc.).
 * 
 * The backend is selected at init time based on the backendType parameter.
 * Each backend must export:
 *   - init(config): Promise<void>  — one-time setup
 *   - handlers: { [op]: (path, data?) => Promise<{ok, data?, error?}> }
 * 
 * Message protocol (JSON):
 * Request:  { op: string, path?: string, data?: number[], ... }
 * Response: { ok: true, data?: any } | { ok: false, error: string }
 */

import { SyncMessenger } from './SyncMessenger.js'

let handlers = null
let messenger = null

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Backend registry — maps type names to module paths
 * Add new backends here as they are implemented.
 */
const BACKENDS = {
  opfs: './backends/opfs.js',
  webdav: './backends/webdav.js'
}

/**
 * Process incoming request by dispatching to the active backend's handlers
 */
async function handleRequest(requestBytes) {
  try {
    const request = JSON.parse(decoder.decode(requestBytes))
    const { op, ...params } = request

    const handler = handlers[op]
    if (!handler) {
      return encoder.encode(JSON.stringify({ ok: false, error: `Unknown operation: ${op}` }))
    }

    const result = await handler(params.path, params.data)
    return encoder.encode(JSON.stringify(result))
  } catch (err) {
    return encoder.encode(JSON.stringify({ ok: false, error: err.message }))
  }
}

/**
 * Message handler for initialization
 * 
 * Expected message: ['init', SharedArrayBuffer, backendType, backendConfig]
 *   - backendType: 'opfs' | 'webdav' | ...
 *   - backendConfig: backend-specific configuration object
 */
self.onmessage = async (e) => {
  const msg = e.data

  if (Array.isArray(msg) && msg[0] === 'init') {
    const [, sab, backendType = 'opfs', backendConfig = {}] = msg

    // Resolve backend module
    const backendPath = BACKENDS[backendType]
    if (!backendPath) {
      throw new Error(`Unknown filesystem backend: ${backendType}. Available: ${Object.keys(BACKENDS).join(', ')}`)
    }

    // Dynamic import of the selected backend
    const backend = await import(backendPath)
    await backend.init(backendConfig)
    handlers = backend.handlers

    messenger = new SyncMessenger(sab)

    // Signal ready
    self.postMessage(['ready'])

    // Start serving requests
    messenger.serveAsync(handleRequest)
  }
}
