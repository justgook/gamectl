/**
 * Plugin Manager Web Worker
 * 
 * Runs the PluginManager in a separate thread to avoid blocking the main thread
 * during WASM plugin execution.
 * 
 * Two-phase boot:
 *   Phase 1 (init): Initialize FS + load base plugins (sql) + register host functions
 *   Phase 2 (loadPlugins): Load remaining plugins from DB registry via FS
 * 
 * Uses transferable objects for efficient data transfer between worker and main thread.
 */

// Import as ES modules
import { PluginManager } from './plugin-manager.js'
import * as PluginFileSystem from './fs/index.js'
import { createWriteInput } from '../../util/fs.js'
import { toast } from '../toast.js'

let manager = null

/**
 * Host functions shared between phase 1 and phase 2
 */
function getHostFunctions() {
  return [
    {
      module: 'host',
      function: 'log',
      handler: (input) => {
        const message = typeof input === "string" ? input : new TextDecoder().decode(input)
        console.log('[Plugin]', message)
        return { returnCode: 0, output: new Uint8Array() }
      }
    },
    { module: 'fs', function: 'read', handler: PluginFileSystem.read },
    { module: 'fs', function: 'write', handler: PluginFileSystem.write },
    {
      module: 'fs',
      function: 'writeJson',
      handler: (input) => {
        try {
          const json = JSON.parse(new TextDecoder().decode(input))
          const binaryInput = createWriteInput(json.path, json.content)
          return PluginFileSystem.write(binaryInput)
        } catch (e) {
          return { returnCode: 1, output: new TextEncoder().encode(e.message) }
        }
      }
    },
    {
      module: 'fs',
      function: 'writeBin',
      handler: (input) => {
        try {
          const json = JSON.parse(new TextDecoder().decode(input))
          const binaryInput = createWriteInput(json.path, base64ToUint8Array(json.content))

          return PluginFileSystem.write(binaryInput)
        } catch (e) {
          return { returnCode: 1, output: new TextEncoder().encode(e.message) }
        }
      }
    },
    { module: 'fs', function: 'delete', handler: PluginFileSystem.remove },
    { module: 'fs', function: 'exists', handler: PluginFileSystem.exists },
    { module: 'fs', function: 'list', handler: PluginFileSystem.list },
    { module: 'fs', function: 'mkdir', handler: PluginFileSystem.mkdir },
    { module: 'fs', function: 'rmdir', handler: PluginFileSystem.rmdir },
    { module: 'fs', function: 'stat', handler: PluginFileSystem.stat },
  ]
}

/**
 * Handle messages from main thread
 */
self.onmessage = async (e) => {
  const { id, type, payload } = e.data

  try {
    switch (type) {
      case 'init':
        await handleInit(id, payload)
        break

      case 'loadPlugins':
        await handleLoadPlugins(id, payload)
        break

      case 'call':
        await handleCall(id, payload)
        break

      case 'rawCall':
        await handleRawCall(id, payload)
        break

      default:
        console.warn('Unknown message type:', type)
    }
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      id,
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack
      }
    })
  }
}

/**
 * Phase 1: Initialize FS + load base plugins (sql only)
 * 
 * After this, the main thread can run migrations (which need sql + fs),
 * then query the plugins table and send the full plugin list via loadPlugins.
 */
async function handleInit(id, payload) {
  const fsConfig = payload?.fsConfig

  // Initialize filesystem with the configured backend (OPFS, WebDAV, etc.)
  await PluginFileSystem.create(fsConfig)

  // Phase 1: only load the base plugin (sql) - fs is already available as host functions
  const baseModules = [
    { name: 'sql', url: `/plugins/sql.wasm?t=${Date.now()}` },
  ]

  const workerOptions = {
    modules: baseModules,
    hostFunctions: getHostFunctions()
  }

  manager = await PluginManager.create(workerOptions)

  console.log('[Worker] Phase 1 complete: fs + sql ready')

  self.postMessage({
    id,
    type: 'init-success'
  })
}

/**
 * Phase 2: Load plugins from DB registry
 * 
 * Receives a list of {name, url} entries from the main thread (queried from the plugins table).
 * Each plugin is loaded via FS (supports local:, http:, filesystem paths).
 * 
 * @param {number} id - Message ID
 * @param {{plugins: Array<{name: string, url: string}>}} payload
 */
async function handleLoadPlugins(id, payload) {
  const { plugins } = payload

  if (!manager) {
    throw new Error('PluginManager not initialized - call init first')
  }

  if (!plugins || plugins.length === 0) {
    console.log('[Worker] Phase 2: no additional plugins to load')
    self.postMessage({ id, type: 'loadPlugins-success', result: { loaded: [], failed: [] } })
    return
  }

  const loaded = []
  const failed = []

  for (const plugin of plugins) {
    try {
      // Skip if already loaded (e.g. sql was loaded in phase 1)
      const existing = manager.getLoadedModules()
      if (existing.includes(plugin.name)) {
        console.log(`[Worker] Plugin '${plugin.name}' already loaded, skipping`)
        loaded.push(plugin.name)
        continue
      }

      console.log(`[Worker] Loading plugin '${plugin.name}' from ${plugin.url}`)

      // Use FS to read the WASM bytes (supports local:, http:, filesystem paths)
      const readResult = PluginFileSystem.read(plugin.url)

      if (readResult.returnCode !== 0) {
        const errMsg = new TextDecoder().decode(readResult.output)
        throw new Error(`FS read failed: ${errMsg}`)
      }

      // readResult.output is Uint8Array with the WASM bytes
      const wasmBytes = readResult.output

      // Load via PluginManager using the data (ArrayBuffer) path
      await manager.loadAdditionalModules([
        { name: plugin.name, data: wasmBytes.buffer }
      ])

      loaded.push(plugin.name)
      console.log(`[Worker] Plugin '${plugin.name}' loaded successfully`)
    } catch (error) {
      console.error(`[Worker] Failed to load plugin '${plugin.name}':`, error)
      failed.push({ name: plugin.name, error: error.message })
    }
  }

  console.log(`[Worker] Phase 2 complete: ${loaded.length} loaded, ${failed.length} failed`)

  self.postMessage({
    id,
    type: 'loadPlugins-success',
    result: { loaded, failed }
  })
}

/**
 * Handle plugin call
 */
async function handleCall(id, payload) {
  const { moduleName, functionName, input } = payload

  // Convert input to Uint8Array if needed
  let inputArray = input
  if (typeof input === 'string') {
    inputArray = new TextEncoder().encode(input)
  } else if (!(input instanceof Uint8Array)) {
    inputArray = new Uint8Array(input)
  }

  const result = await manager.call(moduleName, functionName, inputArray)

  // Prepare transferable output
  const outputBuffer = result.output.buffer

  self.postMessage(
    {
      id,
      type: 'call-result',
      result: {
        returnCode: result.returnCode,
        output: result.output
      }
    },
    // Transfer the output buffer for zero-copy performance
    [outputBuffer]
  )
}

/**
 * Handle raw plugin call (direct function call without PDK wrapper)
 */
async function handleRawCall(id, payload) {
  const { moduleName, functionName, input } = payload
  const result = manager.rawCall(moduleName, functionName, input)

  self.postMessage({
    id,
    type: 'rawcall-result',
    result
  })
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}
