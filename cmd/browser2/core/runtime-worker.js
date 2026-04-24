import { PluginManager } from './vendor/plugin-manager.js'

const MAIN_SYNC_HEADER_SIZE = 8

class RuntimeWorker {
  constructor(mainSyncSab) {
    this.definitions = new Map()
    this.instances = new Map()
    this.mainPlugins = new Set()
    this.pendingMainCalls = new Map()
    this.nextMainCallId = 1
    this.pluginManager = null
    this.mainSyncSab = mainSyncSab
    this.mainSyncInt32 = new Int32Array(mainSyncSab)
    this.mainSyncUint8 = new Uint8Array(mainSyncSab)
  }

  registerMainPlugin(pluginId) {
    this.mainPlugins.add(pluginId)
    this.registerRemoteHostPlugin(pluginId)
  }

  async initializePluginHooks(id) {
    for (const hook of ['__fs_init', '__sql_init']) {
      if (!(await this.hasMethod(id, hook))) continue
      const result = await this.call(id, hook, '')
      if (result.returnCode != 0) {
        throw Error(new TextDecoder().decode(result.output).trim())
      }
    }
  }

  async ensurePluginManager() {
    if (this.pluginManager) return this.pluginManager
    const manager = await PluginManager.create({
      modules: [],
    })

    this.pluginManager = manager
    for (const pluginId of this.mainPlugins) {
      this.registerRemoteHostPlugin(pluginId)
    }
    for (const [pluginId, instance] of this.instances.entries()) {
      if (instance?.definition?.runtime === 'js') this.registerWorkerJsHostPlugin(pluginId)
    }

    return manager
  }

  registerHostWildcard(pluginId, handler) {
    if (!this.pluginManager) return
    if (!this.pluginManager.hostModules.has(pluginId)) {
      this.pluginManager.hostModules.set(pluginId, { name: pluginId, functions: [] })
    }
    if (!this.pluginManager.hostFunctionDefs.has(pluginId)) {
      this.pluginManager.hostFunctionDefs.set(pluginId, new Map())
    }
    this.pluginManager.hostFunctionDefs.get(pluginId).set('*', {
      module: pluginId,
      function: '*',
      handler,
    })
  }

  registerRemoteHostPlugin(pluginId) {
    this.registerHostWildcard(pluginId, (functionName, input) => this.callMainThreadSync(pluginId, functionName, input))
  }

  registerWorkerJsHostPlugin(pluginId) {
    this.registerHostWildcard(pluginId, (functionName, input) => this.callSync(pluginId, functionName, input))
  }

  async load(id) {
    if (this.instances.has(id)) return this.instances.get(id)
    const definition = this.definitions.get(id)
    if (!definition) throw new Error(`Unknown plugin '${id}'`)

    for (const depId of definition.deps || []) {
      await this.load(depId)
    }

    if (definition.runtime === 'js') {
      let module = {}

      if (definition.id === 'fs' || definition.id.startsWith('fs.')) {
        module = (await import(definition.url)).default
      } else {
        const result = await this.call('fs', 'read', definition.url)
        if (result.returnCode !== 0) {
          throw new Error(new TextDecoder().decode(result.output).trim() || `fs.read failed for '${definition.url}'`)
        }
        module = (await importJsFromBytes(result.output)).default
      }

      if (typeof module?.init === 'function') {
        await module.init(this.createContext(id))
      }

      const instance = { id, definition, module }
      this.instances.set(id, instance)
      this.registerWorkerJsHostPlugin(id)
      await this.initializePluginHooks(id, instance)

      return instance
    }

    if (definition.runtime === 'wasm') {
      const manager = await this.ensurePluginManager()
      const result = await this.call('fs', 'read', definition.url)
      if (result.returnCode !== 0) {
        throw new Error(new TextDecoder().decode(result.output).trim() || `fs.read failed for '${definition.url}'`)
      }
      await manager.loadAdditionalModules([{ name: id, data: result.output, memory: definition.memory }])
      const instance = { id, definition, module: null, kind: 'wasm' }
      this.instances.set(id, instance)
      await this.initializePluginHooks(id)

      return instance
    }

    throw new Error(`Runtime '${definition.runtime}' not implemented yet for '${id}'`)
  }

  callSync(id, method, input) {
    if (this.mainPlugins.has(id) && !this.definitions.has(id)) {
      return this.callMainThreadSync(id, method, input)
    }

    if (this.instances.has(id)) {
      const existing = this.instances.get(id)
      if (existing?.kind === 'wasm') {
        if (!this.pluginManager) throw new Error(`WASM plugin manager not initialized for '${id}'`)
        const inputBytes = typeof input === 'string' ? new TextEncoder().encode(input) : (input instanceof Uint8Array ? input : new Uint8Array(input || []))

        return this.pluginManager.callSync(id, method, inputBytes)
      }
    }

    const definition = this.definitions.get(id)
    if (!definition) throw new Error(`Unknown plugin '${id}'`)
    if (definition.runtime !== 'js') {
      throw new Error(`Sync call not available for runtime '${definition.runtime}' on '${id}'`)
    }

    const instance = this.instances.get(id)
    if (!instance) {
      throw new Error(`Plugin '${id}' must be loaded before sync calls are used`)
    }

    const module = instance.module
    if (typeof module?.callSync === 'function') {
      return module.callSync(method, input, this.createContext(id))
    }
    const fn = module?.methods?.[method]
    if (typeof fn !== 'function') {
      throw new Error(`Plugin '${id}' does not implement method '${method}'`)
    }
    const result = fn(input, this.createContext(id))
    if (result && typeof result.then === 'function') {
      throw new Error(`Plugin '${id}' method '${method}' returned a Promise during sync call`)
    }

    return result
  }

  async call(id, method, input) {
    if (this.mainPlugins.has(id) && !this.definitions.has(id)) {
      return await this.callMainThread(id, method, input)
    }

    await this.load(id)
    if (this.instances.get(id)?.kind === 'wasm') {
      const manager = await this.ensurePluginManager()
      const inputBytes = typeof input === 'string' ? new TextEncoder().encode(input) : (input instanceof Uint8Array ? input : new Uint8Array(input || []))
      return await manager.call(id, method, inputBytes)
    }

    return this.callSync(id, method, input)
  }

  async ensureLoaded(pluginIds) {
    if (!Array.isArray(pluginIds)) throw new Error('ensureLoaded requires an array')
    for (const pluginId of pluginIds) {
      if (this.mainPlugins.has(pluginId) && !this.definitions.has(pluginId)) continue
      if (!this.definitions.has(pluginId)) continue
      await this.load(pluginId)
    }
    return { returnCode: 0, output: new Uint8Array() }
  }

  async hasMethod(id, method) {
    const definition = this.definitions.get(id)
    if (!definition) return false

    await this.load(id)
    const instance = this.instances.get(id)
    if (!instance) return false

    if (instance.kind === 'wasm') {
      return !!this.pluginManager?.hasMethod(id, method)
    }

    if (typeof instance.module?.hasMethod === 'function') {
      return !!instance.module.hasMethod(method, this.createContext(id))
    }

    return typeof instance.module?.methods?.[method] === 'function'
  }

  async memory(id) {
    await this.load(id)
    const instance = this.instances.get(id)
    if (instance?.kind !== 'wasm') {
      throw new Error(`Shared memory is only available for wasm plugin '${id}'`)
    }
    const memory = this.pluginManager?.memory(id)
    if (!memory) {
      throw new Error(`No memory available for wasm plugin '${id}'`)
    }
    return memory.buffer
  }

  createContext(callerId) {
    const definition = this.definitions.get(callerId) || null
    return {
      runtime: this,
      callerId,
      definition,
      config: definition?.config || null,
      call: (target, method, input) => this.call(target, method, input),
      callSync: (target, method, input) => this.callSync(target, method, input),
      memory: (target) => this.memory(target),
    }
  }

  callMainThreadSync(pluginId, method, input) {
    if (!this.mainSyncSab || !this.mainSyncInt32 || !this.mainSyncUint8) {
      throw new Error('Main-thread sync bridge not initialized')
    }

    Atomics.store(this.mainSyncInt32, 0, 0)
    this.mainSyncInt32[1] = 0
    self.postMessage({ type: 'main-call-sync', pluginId, method, input })
    const waitResult = Atomics.wait(this.mainSyncInt32, 0, 0, 30000)
    if (waitResult === 'timed-out') {
      throw new Error(`Timed out waiting for main-thread plugin '${pluginId}'`)
    }
    const len = this.mainSyncInt32[1]
    const bytes = this.mainSyncUint8.slice(MAIN_SYNC_HEADER_SIZE, MAIN_SYNC_HEADER_SIZE + len)
    Atomics.store(this.mainSyncInt32, 0, 0)
    const payload = JSON.parse(new TextDecoder().decode(bytes) || '{}')
    if (payload.error) {
      throw new Error(payload.error)
    }
    return {
      returnCode: Number(payload.result?.returnCode || 0),
      output: new Uint8Array(payload.result?.output || []),
    }
  }

  async callMainThread(pluginId, method, input) {
    const requestId = this.nextMainCallId++
    return await new Promise((resolve, reject) => {
      this.pendingMainCalls.set(requestId, { resolve, reject })
      self.postMessage({ type: 'main-call', requestId, pluginId, method, input })
    })
  }

  resolveMainCall(requestId, result, error) {
    const pending = this.pendingMainCalls.get(requestId)
    if (!pending) return
    this.pendingMainCalls.delete(requestId)
    if (error) pending.reject(new Error(error))
    else pending.resolve(result)
  }
}

let runtime = null

self.onmessage = async (event) => {
  const msg = event.data || {}
  try {
    if (msg.type === 'init') {
      runtime = new RuntimeWorker(msg.mainSyncSab || null)
      self.postMessage({ type: 'init-result', ok: true })

      return
    }

    if (msg.type === 'add-plugins') {
      for (const definition of msg.plugins) {
        runtime.instances.delete(definition.id)
        runtime.definitions.set(definition.id, definition)
      }

      self.postMessage({ type: 'add-plugins-result', ok: true })

      return
    }

    if (!runtime) throw new Error('worker runtime not initialized')

    if (msg.type === 'call') {
      const result = await runtime.call(msg.pluginId, msg.method, msg.input)
      self.postMessage({ type: 'call-result', requestId: msg.requestId, result })
      return
    }

    if (msg.type === 'ensure-loaded') {
      const result = await runtime.ensureLoaded(msg.pluginIds)
      self.postMessage({ type: 'ensure-loaded-result', requestId: msg.requestId, result })
      return
    }

    if (msg.type === 'memory') {
      const buffer = await runtime.memory(msg.pluginId)
      self.postMessage({ type: 'memory-result', requestId: msg.requestId, buffer })
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

async function importJsFromBytes(bytes) {
  const blob = new Blob([bytes], {
    type: 'text/javascript'
  })
  const url = URL.createObjectURL(blob)
  try {
    return await import(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

