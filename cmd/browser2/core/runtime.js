function readBootstrapConfig() {
  return {
    fs: localStorage.getItem('browser.fs') || 'fs.opfs',
    sql: localStorage.getItem('browser.sql') || 'sql.default',
    webdavUrl: localStorage.getItem('browser.fs.webdav.url') || '',
  }
}

class RuntimeProxy {
  constructor(worker, setupResult) {
    this.worker = worker
    this.setupResult = setupResult
    this.pending = new Map()
    this.nextRequestId = 1
    this.mainPlugins = new Map()
    this.worker.addEventListener('message', (event) => this.handleMessage(event))
  }

  static async create() {
    const worker = new Worker(new URL('./worker-runtime.js', import.meta.url), { type: 'module' })
    const bootstrap = readBootstrapConfig()
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
      worker.postMessage({ type: 'init', bootstrap })
    })

    return new RuntimeProxy(worker, setupResult)
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
    }
  }

  async dispatchMainCall(msg) {
    const plugin = this.mainPlugins.get(msg.pluginId)
    if (!plugin) {
      this.worker.postMessage({
        type: 'main-call-result',
        requestId: msg.requestId,
        error: `Unknown main-thread plugin '${msg.pluginId}'`,
      })
      return
    }

    try {
      let result
      if (typeof plugin.call === 'function') {
        result = await plugin.call(msg.method, msg.input, this.createMainContext(plugin.id))
      } else {
        const fn = plugin.methods?.[msg.method]
        if (typeof fn !== 'function') {
          throw new Error(`Main-thread plugin '${plugin.id}' does not implement method '${msg.method}'`)
        }
        result = await fn(msg.input, this.createMainContext(plugin.id))
      }

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

  registerMainPlugin(plugin) {
    if (!plugin?.id) throw new Error('main-thread plugin requires id')
    this.mainPlugins.set(plugin.id, plugin)
    this.worker.postMessage({ type: 'register-main-plugin', pluginId: plugin.id })
  }
}

export async function createRuntime() {
  return await RuntimeProxy.create()
}

export { RuntimeProxy }
