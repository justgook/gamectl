import { SyncMessenger } from './SyncMessenger.js'
import * as backend from './backend-opfs.js'

let handlers = null
const encoder = new TextEncoder()
const decoder = new TextDecoder()

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

self.onmessage = async (e) => {
  const msg = e.data
  if (Array.isArray(msg) && msg[0] === 'init') {
    const [, sab, backendConfig = {}] = msg
    await backend.init(backendConfig)
    handlers = backend.handlers
    const messenger = new SyncMessenger(sab)
    self.postMessage(['ready'])
    messenger.serveAsync(handleRequest)
  }
}
