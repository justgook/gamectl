import fsOpfsPlugin from '../builtin/fs-opfs/index.js'
import fsWebdavPlugin from '../builtin/fs-webdav/index.js'
import { applySetup } from './setup.js'

class WorkerRuntime {
  constructor(bootstrap = {}) {
    this.bootstrap = bootstrap
    this.definitions = new Map()
    this.instances = new Map()
    this.capabilities = new Map()
    this.mainPlugins = new Set()
    this.pendingMainCalls = new Map()
    this.nextMainCallId = 1
  }

  registerBuiltin(definition) {
    if (!definition?.id) throw new Error('builtin definition requires id')
    this.definitions.set(definition.id, definition)
  }

  registerMainPlugin(pluginId) {
    this.mainPlugins.add(pluginId)
  }

  setCapability(name, pluginId) {
    this.capabilities.set(name, pluginId)
  }

  resolveTarget(nameOrId) {
    return this.capabilities.get(nameOrId) || nameOrId
  }

  async load(id) {
    if (this.instances.has(id)) return this.instances.get(id)
    const definition = this.definitions.get(id)
    if (!definition) throw new Error(`Unknown plugin '${id}'`)
    if (definition.runtime !== 'js') {
      throw new Error(`Runtime '${definition.runtime}' not implemented yet for '${id}'`)
    }
    const module = definition.module
    const instance = { id, definition, module }
    if (typeof module?.init === 'function') {
      await module.init(this.createContext(id))
    }
    this.instances.set(id, instance)
    return instance
  }

  async call(nameOrId, method, input) {
    const id = this.resolveTarget(nameOrId)

    if (this.mainPlugins.has(id) && !this.definitions.has(id)) {
      return await this.callMainThread(id, method, input)
    }

    const instance = await this.load(id)
    const module = instance.module
    if (typeof module?.call === 'function') {
      return await module.call(method, input, this.createContext(id))
    }
    const fn = module?.methods?.[method]
    if (typeof fn !== 'function') {
      throw new Error(`Plugin '${id}' does not implement method '${method}'`)
    }
    return await fn(input, this.createContext(id))
  }

  createContext(callerId) {
    return {
      runtime: this,
      callerId,
      bootstrap: this.bootstrap,
      call: (target, method, input) => this.call(target, method, input),
    }
  }

  async callMainThread(pluginId, method, input) {
    const requestId = this.nextMainCallId++
    return await new Promise((resolve, reject) => {
      this.pendingMainCalls.set(requestId, { resolve, reject })
      self.postMessage({
        type: 'main-call',
        requestId,
        pluginId,
        method,
        input,
      })
    })
  }

  resolveMainCall(requestId, result, error) {
    const pending = this.pendingMainCalls.get(requestId)
    if (!pending) return
    this.pendingMainCalls.delete(requestId)
    if (error) {
      pending.reject(new Error(error))
    } else {
      pending.resolve(result)
    }
  }
}

let runtime = null

function registerBuiltins(targetRuntime) {
  targetRuntime.registerBuiltin({
    id: 'fs.opfs',
    runtime: 'js',
    role: 'service',
    module: fsOpfsPlugin,
  })

  targetRuntime.registerBuiltin({
    id: 'fs.webdav',
    runtime: 'js',
    role: 'service',
    module: fsWebdavPlugin,
  })
}

self.onmessage = async (event) => {
  const msg = event.data || {}

  try {
    if (msg.type === 'init') {
      runtime = new WorkerRuntime(msg.bootstrap || {})
      registerBuiltins(runtime)
      const result = await applySetup(runtime, msg.bootstrap || {})
      self.postMessage({ type: 'init-result', result })
      return
    }

    if (!runtime) {
      throw new Error('worker runtime not initialized')
    }

    if (msg.type === 'call') {
      const result = await runtime.call(msg.pluginId, msg.method, msg.input)
      self.postMessage({ type: 'call-result', requestId: msg.requestId, result })
      return
    }

    if (msg.type === 'register-main-plugin') {
      runtime.registerMainPlugin(msg.pluginId)
      return
    }

    if (msg.type === 'main-call-result') {
      runtime.resolveMainCall(msg.requestId, msg.result, msg.error)
      return
    }
  } catch (error) {
    const message = String(error?.message || error)
    if (msg.type === 'init') {
      self.postMessage({ type: 'init-error', error: message })
      return
    }
    if (typeof msg.requestId === 'number') {
      self.postMessage({ type: 'call-result', requestId: msg.requestId, error: message })
    } else {
      console.error('[browser worker-runtime] unhandled error', error)
    }
  }
}
