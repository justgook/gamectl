import { PluginManager } from './vendor/plugin-manager.js'
import fsOpfsPlugin from '../builtin/fs-opfs/index.js'

const MAIN_SYNC_HEADER_SIZE = 8
import fsWebdavPlugin from '../builtin/fs-webdav/index.js'
import { applySetup } from './setup.js'

class WorkerRuntime {
  constructor(bootstrap = {}, mainSyncSab = null) {
    this.bootstrap = bootstrap
    this.definitions = new Map()
    this.instances = new Map()
    this.capabilities = new Map()
    this.mainPlugins = new Set()
    this.pendingMainCalls = new Map()
    this.nextMainCallId = 1
    this.pluginManager = null
    this.mainSyncSab = mainSyncSab
    this.mainSyncInt32 = mainSyncSab ? new Int32Array(mainSyncSab) : null
    this.mainSyncUint8 = mainSyncSab ? new Uint8Array(mainSyncSab) : null
  }

  registerBuiltin(definition) {
    if (!definition?.id) throw new Error('builtin definition requires id')
    this.definitions.set(definition.id, definition)
  }

  registerMainPlugin(pluginId) {
    this.mainPlugins.add(pluginId)
    this.registerRemoteHostPlugin(pluginId)
  }

  setCapability(name, pluginId) {
    this.capabilities.set(name, pluginId)
  }

  resolveTarget(nameOrId) {
    return this.capabilities.get(nameOrId) || nameOrId
  }

  async ensurePluginManager() {
    if (this.pluginManager) return this.pluginManager
    const manager = await PluginManager.create({
      modules: [],
      hostFunctions: this.getHostFunctions(),
    })
    this.pluginManager = manager
    for (const pluginId of this.mainPlugins) {
      this.registerRemoteHostPlugin(pluginId)
    }
    return manager
  }

  getHostFunctions() {
    return [
      {
        module: 'fs',
        function: 'read',
        handler: (input) => this.callSync('fs', 'read', input),
      },
      {
        module: 'fs',
        function: 'write',
        handler: (input) => this.callSync('fs', 'write', input),
      },
      {
        module: 'fs',
        function: 'delete',
        handler: (input) => this.callSync('fs', 'remove', input),
      },
      {
        module: 'fs',
        function: 'exists',
        handler: (input) => this.callSync('fs', 'exists', input),
      },
      {
        module: 'fs',
        function: 'list',
        handler: (input) => this.callSync('fs', 'list', input),
      },
      {
        module: 'fs',
        function: 'mkdir',
        handler: (input) => this.callSync('fs', 'mkdir', input),
      },
      {
        module: 'fs',
        function: 'rmdir',
        handler: (input) => this.callSync('fs', 'rmdir', input),
      },
      {
        module: 'fs',
        function: 'stat',
        handler: (input) => this.callSync('fs', 'stat', input),
      },
    ]
  }

  registerRemoteHostPlugin(pluginId) {
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
      handler: (functionName, input) => this.callMainThreadSync(pluginId, functionName, input),
    })
  }

  async load(id) {
    if (this.instances.has(id)) return this.instances.get(id)
    const definition = this.definitions.get(id)
    if (!definition) throw new Error(`Unknown plugin '${id}'`)

    if (definition.runtime === 'js') {
      const module = definition.module
      const instance = { id, definition, module }
      if (typeof module?.init === 'function') {
        await module.init(this.createContext(id))
      }
      this.instances.set(id, instance)
      return instance
    }

    if (definition.runtime === 'wasm') {
      const manager = await this.ensurePluginManager()
      await manager.loadAdditionalModules([{ name: id, url: definition.url }])
      const instance = { id, definition, module: null, kind: 'wasm' }
      this.instances.set(id, instance)
      return instance
    }

    throw new Error(`Runtime '${definition.runtime}' not implemented yet for '${id}'`)
  }

  callSync(nameOrId, method, input) {
    const id = this.resolveTarget(nameOrId)

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

  async call(nameOrId, method, input) {
    const id = this.resolveTarget(nameOrId)

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

  createContext(callerId) {
    return {
      runtime: this,
      callerId,
      bootstrap: this.bootstrap,
      call: (target, method, input) => this.call(target, method, input),
      callSync: (target, method, input) => this.callSync(target, method, input),
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

  targetRuntime.registerBuiltin({
    id: 'sql.default',
    runtime: 'wasm',
    role: 'service',
    url: `/plugins/sql.wasm?t=${Date.now()}`,
  })

  targetRuntime.registerBuiltin({
    id: 'echo',
    runtime: 'wasm',
    role: 'service',
    url: `/plugins/echo.wasm?t=${Date.now()}`,
  })
}

self.onmessage = async (event) => {
  const msg = event.data || {}

  try {
    if (msg.type === 'init') {
      runtime = new WorkerRuntime(msg.bootstrap || {}, msg.mainSyncSab || null)
      registerBuiltins(runtime)
      const result = await applySetup(runtime, msg.bootstrap || {})
      self.postMessage({ type: 'init-result', result })
      return
    }

    if (!runtime) throw new Error('worker runtime not initialized')

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
