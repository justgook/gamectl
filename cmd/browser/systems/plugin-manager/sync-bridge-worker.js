import { SyncMessenger } from './fs/SyncMessenger.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

let messenger = null
let port = null
let nextRequestId = 1
const pending = new Map()

function decodeSyncCallRequest(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const moduleLen = view.getUint32(0, true)
  const funcLen = view.getUint32(4, true)
  const inputLen = view.getUint32(8, true)
  const base = 12
  const moduleName = decoder.decode(bytes.slice(base, base + moduleLen))
  const functionName = decoder.decode(bytes.slice(base + moduleLen, base + moduleLen + funcLen))
  const input = bytes.slice(base + moduleLen + funcLen, base + moduleLen + funcLen + inputLen)
  return { moduleName, functionName, input }
}

function encodeSyncCallResponse(returnCode, output) {
  const outputBytes = output instanceof Uint8Array ? output : new Uint8Array(output || [])
  const bytes = new Uint8Array(8 + outputBytes.length)
  const view = new DataView(bytes.buffer)
  view.setInt32(0, Number(returnCode || 0), true)
  view.setUint32(4, outputBytes.length, true)
  bytes.set(outputBytes, 8)
  return bytes
}

async function forwardRequest(requestBytes) {
  if (!port) {
    throw new Error('Sync bridge port is not attached')
  }
  const { moduleName, functionName, input } = decodeSyncCallRequest(requestBytes)
  const requestId = nextRequestId++
  const responsePromise = new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
  })
  port.postMessage({ type: 'sync-dispatch', requestId, moduleName, functionName, input }, [input.buffer])
  const result = await responsePromise
  return encodeSyncCallResponse(result?.returnCode || 0, result?.output || new Uint8Array())
}

self.onmessage = (e) => {
  const msg = e.data || {}
  if (msg.type === 'init') {
    port = msg.port || null
    if (!port) {
      throw new Error('Sync bridge init requires a MessagePort')
    }
    port.onmessage = (event) => {
      const data = event.data || {}
      if (data.type !== 'sync-dispatch-result') return
      const entry = pending.get(data.requestId)
      if (!entry) return
      pending.delete(data.requestId)
      entry.resolve({
        returnCode: Number(data.returnCode || 0),
        output: data.output instanceof Uint8Array ? data.output : new Uint8Array(data.output || []),
      })
    }
    port.start?.()

    messenger = new SyncMessenger(msg.sab)
    messenger.serveAsync(async (requestBytes) => {
      try {
        return await forwardRequest(requestBytes)
      } catch (error) {
        return encodeSyncCallResponse(1, encoder.encode(String(error?.message || error)))
      }
    })
    self.postMessage({ type: 'ready' })
  }
}
