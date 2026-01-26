/**
 * Plugin Manager Web Worker
 * 
 * Runs the PluginManager in a separate thread to avoid blocking the main thread
 * during WASM plugin execution.
 * 
 * Uses transferable objects for efficient data transfer between worker and main thread.
 */

// Import as ES modules
import { PluginManager } from './plugin-manager.js'
import * as PluginFileSystem from './fs/index.js'
import { createWriteInput } from '../../util/fs.js'

let manager = null

/**
 * Handle messages from main thread
 */
self.onmessage = async (e) => {
  const { id, type, payload } = e.data

  try {
    switch (type) {
      case 'init':
        await handleInit(id)
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

async function handleInit(id) {

  const pluginNames = [
    'random',
    'treegen',
    'biomes',
    'keylock',
    'minimap',
    'minimap2',
    'automap',
    // delete those
    'math',
    'sql',
    'scaler',
    'roomgen',
    // sprite tools
    'image-process',
    'sprite-detect',
    'sprite-pack',
    'tile-detect'
  ];

  // Initialize OPFS-based filesystem (worker obtains root internally)
  await PluginFileSystem.create()

  const workerOptions = {
    modules: pluginNames.map(name => ({
      name: name,
      url: `/plugins/${name}.wasm?t=${Date.now()}`
    })),
    hostFunctions: [
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
      { module: 'fs', function: 'delete', handler: PluginFileSystem.remove },
      { module: 'fs', function: 'exists', handler: PluginFileSystem.exists },
      { module: 'fs', function: 'list', handler: PluginFileSystem.list },
      { module: 'fs', function: 'mkdir', handler: PluginFileSystem.mkdir },
      { module: 'fs', function: 'rmdir', handler: PluginFileSystem.rmdir },
      { module: 'fs', function: 'stat', handler: PluginFileSystem.stat },
    ]
  }


  manager = await PluginManager.create(workerOptions)

  self.postMessage({
    id,
    type: 'init-success'
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
