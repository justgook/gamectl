let tauriInvoke = null

async function invokeCommand(command, args) {
  if (tauriInvoke) return await tauriInvoke(command, args)

  if (!globalThis.__TAURI__?.core?.invoke) {
    throw new Error('Tauri invoke API is unavailable; cmd/app requires app.withGlobalTauri = true')
  }

  tauriInvoke = globalThis.__TAURI__.core.invoke
  return await tauriInvoke(command, args)
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must be a non-empty string`)
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`)
}

export class Runtime {
  #viewDispatcher = null

  async invoke(target, args = []) {
    assertString(target, 'runtime.invoke target')
    assertArray(args, 'runtime.invoke args')
    return await invokeCommand('runtime_invoke', { target, args })
  }

  async addPlugins(paths) {
    assertArray(paths, 'runtime.addPlugins paths')
    for (const path of paths) assertString(path, 'runtime.addPlugins path')
    const handles = await invokeCommand('runtime_add_plugins', { paths })
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

  async callView(target, args) {
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
}

export const runtime = new Runtime()
globalThis.gams = Object.freeze({ runtime })
