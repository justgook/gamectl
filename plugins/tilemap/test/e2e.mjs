import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const wasmPath = path.join(repoRoot, 'build.nosync/plugins/tilemap.wasm')
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

class Runtime {
  constructor(instance) {
    this.instance = instance
    this.memory = instance.exports.memory
    this.heapOffset = Number(instance.exports.__heap_base?.value || 65536)
    this.inputPtr = 0
    this.inputLen = 0
    this.output = new Uint8Array()
  }

  static async create(wasmBytes) {
    let runtime = null
    const importObject = {
      env: {
        alloc: (size) => runtime.alloc(Number(size)),
        free: () => {},
        input_ptr: () => runtime.inputPtr,
        input_len: () => runtime.inputLen,
        set_output: (ptr, len) => runtime.setOutput(Number(ptr), Number(len)),
        plugin_call: () => 1,
        plugin_call_return: () => 1,
        plugin_call_output_ptr: () => 0,
        plugin_call_output_len: () => 0,
      },
    }

    const { instance } = await WebAssembly.instantiate(wasmBytes, importObject)
    runtime = new Runtime(instance)
    return runtime
  }

  alloc(size) {
    const ptr = this.heapOffset
    this.heapOffset += Math.max(1, size)
    if (this.heapOffset > this.memory.buffer.byteLength) {
      this.memory.grow(Math.ceil((this.heapOffset - this.memory.buffer.byteLength) / 65536))
    }
    return ptr
  }

  setOutput(ptr, len) {
    this.output = new Uint8Array(this.memory.buffer.slice(ptr, ptr + len))
  }

  call(method, payload = {}) {
    const bytes = encoder.encode(JSON.stringify(payload))
    this.inputPtr = this.alloc(bytes.length)
    this.inputLen = bytes.length
    new Uint8Array(this.memory.buffer, this.inputPtr, bytes.length).set(bytes)
    this.output = new Uint8Array()
    const fn = this.instance.exports[method]
    assert(typeof fn === 'function', `missing export ${method}`)
    const returnCode = Number(fn()) || 0
    const text = decoder.decode(this.output)
    return { returnCode, text, json: text ? JSON.parse(text) : null }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  const wasmBytes = await fs.readFile(wasmPath)
  const runtime = await Runtime.create(toArrayBuffer(wasmBytes))

  const created = runtime.call('create', {
    path: 'maps/test.tilemap.json',
    width: 12,
    height: 8,
    layers: 2,
    spacingX: 16,
    spacingY: 16,
    maxTiles: 256,
  })
  assert(created.returnCode === 0, `create failed: ${created.text}`)
  assert(created.json.handle === 1, 'create should return mock handle 1')
  assert(created.json.memory.width === 12, 'create should use requested width')
  assert(created.json.memory.layers === 2, 'create should use requested layers')

  const setTool = runtime.call('set_tool', { handle: 1, tool: 1 })
  assert(setTool.returnCode === 0, `set_tool failed: ${setTool.text}`)

  const setTile = runtime.call('set_active_tile', { handle: 1, tile: 42 })
  assert(setTile.returnCode === 0, `set_active_tile failed: ${setTile.text}`)

  const apply = runtime.call('apply', { handle: 1, x0: 2, y0: 3, x1: 2, y1: 3 })
  assert(apply.returnCode === 0, `apply failed: ${apply.text}`)

  const snapshot = runtime.call('snapshot', { handle: 1 })
  assert(snapshot.returnCode === 0, `snapshot failed: ${snapshot.text}`)
  assert(snapshot.json.width === 12, 'snapshot width mismatch')
  assert(snapshot.json.height === 8, 'snapshot height mismatch')
  assert(snapshot.json.activeTile === 42, 'snapshot active tile mismatch')
  assert(snapshot.json.dirty === true, 'apply should mark mock document dirty')
  assert(Array.isArray(snapshot.json.layers) && snapshot.json.layers.length === 2, 'snapshot layer mismatch')

  const save = runtime.call('save', { handle: 1, path: 'maps/test.tilemap.json' })
  assert(save.returnCode === 0, `save failed: ${save.text}`)

  const afterSave = runtime.call('snapshot', { handle: 1 })
  assert(afterSave.json.dirty === false, 'save should clear mock dirty flag')

  console.log('tilemap mock e2e passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
