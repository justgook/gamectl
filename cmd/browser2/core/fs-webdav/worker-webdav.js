import { SyncMessenger } from './SyncMessenger.js'
import * as backend from './backend-webdav.js'

let handlers = null
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const RESPONSE_JSON = 0x4a
const RESPONSE_BINARY = 0x42

function encodeJsonResponse(value) {
  const payload = encoder.encode(JSON.stringify(value))
  const bytes = new Uint8Array(payload.length + 1)
  bytes[0] = RESPONSE_JSON
  bytes.set(payload, 1)
  return bytes
}

function encodeBinaryResponse(data) {
  const source = data instanceof Uint8Array ? data : new Uint8Array(data)
  const bytes = new Uint8Array(source.length + 1)
  bytes[0] = RESPONSE_BINARY
  bytes.set(source, 1)
  return bytes
}

async function handleRequest(requestBytes) {
  try {
    const request = JSON.parse(decoder.decode(requestBytes))
    const { op, ...params } = request
    const handler = handlers[op]
    if (!handler) {
      return encodeJsonResponse({ ok: false, error: `Unknown operation: ${op}` })
    }
    const result = await handler(params.path, params.data)
    if (result?.ok && (op === 'readFile' || op === 'readHttp')) {
      return encodeBinaryResponse(result.data)
    }
    return encodeJsonResponse(result)
  } catch (err) {
    return encodeJsonResponse({ ok: false, error: err.message })
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
