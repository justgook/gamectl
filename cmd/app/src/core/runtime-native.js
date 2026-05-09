let tauriInvoke = null

async function invoke(command, args) {
  if (tauriInvoke) return await tauriInvoke(command, args)

  if (!globalThis.__TAURI__?.core?.invoke) {
    throw new Error('Tauri invoke API is unavailable; runtime-native.js requires tauri.conf app.withGlobalTauri = true')
  }

  tauriInvoke = globalThis.__TAURI__.core.invoke
  return await tauriInvoke(command, args)
}

function encodeInput(input) {
  if (input == null) return []
  if (input instanceof Uint8Array) return Array.from(input)
  if (input instanceof ArrayBuffer) return Array.from(new Uint8Array(input))
  if (typeof input === 'string') return Array.from(new TextEncoder().encode(input))
  return Array.from(new TextEncoder().encode(JSON.stringify(input)))
}

function decodeOutput(output) {
  if (output instanceof Uint8Array) return output
  return new Uint8Array(output || [])
}

export class Runtime {
  async call(plugin, method, input = new Uint8Array()) {
    if (typeof plugin !== 'string' || plugin.length === 0) throw new Error('runtime.call requires plugin string')
    if (typeof method !== 'string' || method.length === 0) throw new Error('runtime.call requires method string')

    const output = await invoke('runtime_call', {
      plugin,
      method,
      input: encodeInput(input),
    })

    return decodeOutput(output)
  }

  async text(plugin, method, input = new Uint8Array()) {
    return new TextDecoder().decode(await this.call(plugin, method, input))
  }

  async json(plugin, method, input = new Uint8Array()) {
    return JSON.parse(await this.text(plugin, method, input))
  }
}

export const runtime = new Runtime()

export const fs = {
  read: (path) => runtime.call('fs', 'read', path),
  readText: (path) => runtime.text('fs', 'readText', path),
  write: (path, bytes) => runtime.call('fs', 'write', { path, bytes: Array.from(bytes) }),
  writeText: (path, text) => runtime.call('fs', 'writeText', { path, text }),
  list: (path) => runtime.json('fs', 'list', path),
  stat: (path) => runtime.json('fs', 'stat', path),
  exists: (path) => runtime.json('fs', 'exists', path),
  mounts: () => runtime.json('fs', 'mounts'),
}
