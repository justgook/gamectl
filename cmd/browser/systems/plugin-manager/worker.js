/**
 * Plugin Manager Web Worker
 * 
 * Runs the PluginManager in a separate thread to avoid blocking the main thread
 * during WASM plugin execution.
 * 
 * Uses transferable objects for efficient data transfer between worker and main thread.
 */

// Import the PluginManager class
importScripts('./plugin-manager.js')
importScripts("/plugins/fs/index.js")

let manager = null

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

      case 'setDir':
        await handleSetDir(id, payload)
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

async function handleInit(id, maybeDir) {

  const pluginNames = [
    'random',
    'treegen',
    'minimap',
    'minimap2',
    'automap',
    // delete those
    'math',
    'sql',
    'scaler',
  ];

  const dir = maybeDir ?? await navigator.storage.getDirectory()

  await PluginFileSystem.create(dir)

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

async function handleSetDir(id, payload) {
  await PluginFileSystem.create(payload)
  self.postMessage({
    id,
    type: 'setdir-success'
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
