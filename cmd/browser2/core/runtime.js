const MAIN_SYNC_HEADER_SIZE = 8
const MAIN_SYNC_BUFFER_SIZE = 1024 * 1024



function serializeBridgeResult(result, error = '') {
  const normalized = result || { returnCode: 0, output: new Uint8Array() }
  const output = normalized.output instanceof Uint8Array
    ? Array.from(normalized.output)
    : Array.isArray(normalized.output)
      ? normalized.output
      : []
  return new TextEncoder().encode(JSON.stringify({
    error: error || '',
    result: {
      returnCode: Number(normalized.returnCode || 0),
      output,
    },
  }))
}

class RuntimeProxy {
  constructor(worker, setupResult, mainSyncSab) {
    this.worker = worker
    this.setupResult = setupResult
    this.pending = new Map()
    this.nextRequestId = 1
    this.mainPlugins = new Map()
    this.mainSyncSab = mainSyncSab
    this.mainSyncInt32 = new Int32Array(mainSyncSab)
    this.mainSyncUint8 = new Uint8Array(mainSyncSab)
    this.worker.addEventListener('message', (event) => this.handleMessage(event))
  }

  static async create(bootstrap) {
    const worker = new Worker(new URL('./runtime-worker.js', import.meta.url), { type: 'module' })
    const mainSyncSab = new SharedArrayBuffer(MAIN_SYNC_BUFFER_SIZE)
    const setupResult = await new Promise((resolve, reject) => {
      const onMessage = (event) => {
        const msg = event.data || {}
        if (msg.type === 'init-result') {
          cleanup()
          resolve(msg.result)
        } else if (msg.type === 'init-error') {
          cleanup()
          reject(new Error(msg.error || 'worker init failed'))
        }
      }
      const onError = (error) => {
        cleanup()
        reject(error)
      }
      const cleanup = () => {
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
      }
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      worker.postMessage({ type: 'init', bootstrap, mainSyncSab })
    })

    return new RuntimeProxy(worker, setupResult, mainSyncSab)
  }

  handleMessage(event) {
    const msg = event.data || {}
    if (msg.type === 'call-result' || msg.type === 'main-call-result') {
      const pending = this.pending.get(msg.requestId)
      if (!pending) return
      this.pending.delete(msg.requestId)
      if (msg.error) {
        pending.reject(new Error(msg.error))
      } else {
        pending.resolve(msg.result)
      }
      return
    }

    if (msg.type === 'main-call') {
      this.dispatchMainCall(msg)
      return
    }

    if (msg.type === 'main-call-sync') {
      this.dispatchMainCallSync(msg)
    }
  }

  async dispatchMainCall(msg) {
    try {
      const result = await this.invokeMainPlugin(msg.pluginId, msg.method, msg.input)
      this.worker.postMessage({
        type: 'main-call-result',
        requestId: msg.requestId,
        result,
      })
    } catch (error) {
      this.worker.postMessage({
        type: 'main-call-result',
        requestId: msg.requestId,
        error: String(error?.message || error),
      })
    }
  }

  async dispatchMainCallSync(msg) {
    try {
      const result = await this.invokeMainPlugin(msg.pluginId, msg.method, msg.input)
      const bytes = serializeBridgeResult(result)
      if (bytes.length > (this.mainSyncSab.byteLength - MAIN_SYNC_HEADER_SIZE)) {
        throw new Error('main-call-sync response too large')
      }
      this.mainSyncInt32[1] = bytes.length
      this.mainSyncUint8.set(bytes, MAIN_SYNC_HEADER_SIZE)
      Atomics.store(this.mainSyncInt32, 0, 1)
      Atomics.notify(this.mainSyncInt32, 0)
    } catch (error) {
      const bytes = serializeBridgeResult(null, String(error?.message || error))
      this.mainSyncInt32[1] = bytes.length
      this.mainSyncUint8.set(bytes, MAIN_SYNC_HEADER_SIZE)
      Atomics.store(this.mainSyncInt32, 0, 1)
      Atomics.notify(this.mainSyncInt32, 0)
    }
  }

  async invokeMainPlugin(pluginId, method, input) {
    const plugin = this.mainPlugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Unknown main-thread plugin '${pluginId}'`)
    }

    if (typeof plugin.call === 'function') {
      return await plugin.call(method, input, this.createMainContext(plugin.id))
    }

    const fn = plugin.methods?.[method]
    if (typeof fn !== 'function') {
      throw new Error(`Main-thread plugin '${plugin.id}' does not implement method '${method}'`)
    }

    return await fn(input, this.createMainContext(plugin.id))
  }

  createMainContext(callerId) {
    return {
      callerId,
      runtime: this,
      call: (pluginId, method, input) => this.call(pluginId, method, input),
    }
  }

  send(type, payload = {}) {
    const requestId = this.nextRequestId++
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.worker.postMessage({ type, requestId, ...payload })
    })
  }

  async call(pluginId, method, input) {
    return await this.send('call', { pluginId, method, input })
  }

  register(plugin) {
    if (!plugin?.id) throw new Error('main-thread plugin requires id')
    this.mainPlugins.set(plugin.id, plugin)
    this.worker.postMessage({ type: 'register-main-plugin', pluginId: plugin.id })
  }
}

let runtimeProxy = null
export const setupResult = {}

export async function init(bootstrap) {
  if (runtimeProxy) {
    throw new Error('runtime.init() may only be called once')
  }
  runtimeProxy = await RuntimeProxy.create(bootstrap)
  Object.assign(setupResult, runtimeProxy.setupResult || {})
  return { register, call }
}

export function register(plugin) {
  if (!runtimeProxy) {
    throw new Error('runtime.init() must be called before runtime.register()')
  }
  return runtimeProxy.register(plugin)
}

export async function call(pluginId, method, input) {
  if (!runtimeProxy) {
    throw new Error('runtime.init() must be called before runtime.call()')
  }
  return await runtimeProxy.call(pluginId, method, input)
}

export { RuntimeProxy }
