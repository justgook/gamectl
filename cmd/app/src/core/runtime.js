const invokeCommand = globalThis.__TAURI__.core.invoke
let tauriListen = null

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

  async invoke(target, ...args) {
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

  async #callView(target, args) {
    assertString(target, 'runtime.callView target')
    assertString(args, 'runtime.callView args')

    const parsedArgs = JSON.parse(args)
    assertArray(parsedArgs, 'runtime.callView args JSON')
    return JSON.stringify(await this.call(target, ...parsedArgs))
  }

  async diagnostics() {
    return await invokeCommand('runtime_diagnostics', {})
  }

  async clearCompiledComponentCache() {
    await invokeCommand('runtime_clear_compiled_component_cache', {})
  }

  register(plugin) {
    if (!plugin?.id) throw new Error('main-thread plugin requires id')
    this.#mainPlugins.set(plugin.id, plugin)
  }

  async unregister(pluginId) {
    if (!pluginId) throw new Error('main-thread plugin unregister requires id')
    this.#mainPlugins.delete(pluginId)
  }

  async call(target, ...args) {
    const parts = target.split(".")
    if (parts.length < 2) {
      throw Error(`${target} mutst be in form of "plugin.method"`)
    }
    const method = parts.pop()
    const pluginId = parts.join(".")

    console.log("runtime.call", pluginId, method, args)
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

    return await fn.apply(null, args)
  }
}

export const runtime = new Runtime()

export function unwrap(result, label = "unknown") {
  if (result && Object.prototype.hasOwnProperty.call(result, "ok")) return result.ok
  if (result && Object.prototype.hasOwnProperty.call(result, "err")) throw new Error(`${label}: ${result.err}`)
  throw new Error(`${label}: expected WIT result object`)
}
