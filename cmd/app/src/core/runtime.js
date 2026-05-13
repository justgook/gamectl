let tauriInvoke = null
let tauriListen = null

async function invokeCommand(command, args) {
  if (tauriInvoke) return await tauriInvoke(command, args)

  if (!globalThis.__TAURI__?.core?.invoke) {
    throw new Error('Tauri invoke API is unavailable; cmd/app requires app.withGlobalTauri = true')
  }

  tauriInvoke = globalThis.__TAURI__.core.invoke
  return await tauriInvoke(command, args)
}

async function listenEvent(event, callback) {
  if (tauriListen) return await tauriListen(event, callback)

  if (!globalThis.__TAURI__?.event?.listen) {
    throw new Error('Tauri event API is unavailable; cmd/app requires app.withGlobalTauri = true')
  }

  tauriListen = globalThis.__TAURI__.event.listen
  return await tauriListen(event, callback)
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must be a non-empty string`)
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`)
}

export class Runtime {
  #viewDispatcher = null
  #callViewListenerReady = null
  #mainPlugins = new Map()

  constructor() {
    this.#callViewListenerReady = this.#setupCallViewBridge()
  }

  get ready() {
    return this.#callViewListenerReady
  }

  async #setupCallViewBridge() {
    await listenEvent('gams-runtime-call-view', async (event) => {
      const payload = event.payload
      try {
        if (!payload || typeof payload !== 'object') throw new Error('call-view payload must be an object')
        assertString(payload.id, 'call-view payload id')
        assertString(payload.target, 'call-view payload target')
        assertString(payload.args, 'call-view payload args')
        const ok = await this.#callView(payload.target, payload.args)
        await invokeCommand('runtime_call_view_response', { id: payload.id, ok, err: null })
      } catch (error) {
        const id = payload && typeof payload === 'object' && typeof payload.id === 'string' ? payload.id : ''
        if (!id) throw error
        await invokeCommand('runtime_call_view_response', {
          id,
          ok: null,
          err: error instanceof Error ? error.message : String(error),
        })
      }
    })
    await invokeCommand('runtime_call_view_ready', {})
  }

  async invoke(target, args = []) {
    assertString(target, 'runtime.invoke target')
    assertArray(args, 'runtime.invoke args')
    return await invokeCommand('runtime_invoke', { target, args })
  }

  async addPlugins(paths, reload = false) {
    assertArray(paths, 'runtime.addPlugins paths')
    if (typeof reload !== 'boolean') throw new Error('runtime.addPlugins reload must be a boolean')
    for (const path of paths) assertString(path, 'runtime.addPlugins path')
    const handles = await invokeCommand('runtime_add_plugins', { paths, reload })
    assertArray(handles, 'runtime.addPlugins result')
    for (const handle of handles) {
      assertString(handle.handle, 'component handle')
      assertString(handle.path, 'component path')
      assertArray(handle.imports, 'component imports')
      assertArray(handle.exports, 'component exports')
    }
    return handles
  }

  onCallView(callback) {
    if (typeof callback !== 'function') throw new Error('runtime.onCallView callback must be a function')
    this.#viewDispatcher = callback
  }

  async #callView(target, args) {
    assertString(target, 'runtime.callView target')
    assertString(args, 'runtime.callView args')
    if (!this.#viewDispatcher) throw new Error('runtime.onCallView has not been registered')
    const result = await this.#viewDispatcher(target, args)
    assertString(result, 'runtime.callView result')
    return result
  }

  async addUiPlugin(_wit, _functions) {
    throw new Error('runtime.addUiPlugin is planned but not implemented in the destructive bootstrap yet')
  }

  async diagnostics() {
    return await invokeCommand('runtime_diagnostics', {})
  }

  register(plugin) {
    if (!plugin?.id) throw new Error('main-thread plugin requires id')
    this.#mainPlugins.set(plugin.id, plugin)
  }

  async unregister(pluginId) {
    if (!pluginId) throw new Error('main-thread plugin unregister requires id')
    this.#mainPlugins.delete(pluginId)
  }

  async call(pluginId, method, input) {
    const plugin = this.#mainPlugins.get(pluginId)
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

    return await fn(input)
  }
}

export const runtime = new Runtime()
