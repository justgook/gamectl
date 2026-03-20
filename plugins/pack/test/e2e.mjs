import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const wasmPath = path.join(repoRoot, 'build.nosync/plugins/pack.wasm')

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

class PackRuntime {
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
      }
    }

    const { instance } = await WebAssembly.instantiate(wasmBytes, importObject)
    runtime = new PackRuntime(instance)
    return runtime
  }

  alloc(size) {
    const ptr = this.heapOffset
    this.heapOffset += size
    if (this.heapOffset > this.memory.buffer.byteLength) {
      const missing = this.heapOffset - this.memory.buffer.byteLength
      const pages = Math.ceil(missing / 65536)
      this.memory.grow(pages)
    }
    return ptr
  }

  setOutput(ptr, len) {
    this.output = new Uint8Array(this.memory.buffer.slice(ptr, ptr + len))
  }

  call(functionName, input) {
    const bytes = new TextEncoder().encode(input)
    this.inputPtr = this.alloc(bytes.length)
    this.inputLen = bytes.length
    new Uint8Array(this.memory.buffer, this.inputPtr, bytes.length).set(bytes)
    this.output = new Uint8Array()
    const fn = this.instance.exports[functionName]
    if (typeof fn !== 'function') {
      throw new Error(`missing export ${functionName}`)
    }
    const returnCode = Number(fn()) || 0
    const outputText = new TextDecoder().decode(this.output)
    return { returnCode, outputText }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const wasmBytes = await fs.readFile(wasmPath)
  const runtime = await PackRuntime.create(toArrayBuffer(wasmBytes))

  const success = runtime.call('pack', JSON.stringify({
    width: 8,
    height: 8,
    padding: 1,
    rects: [
      { width: 3, height: 2 },
      { id: 9, width: 2, height: 2 },
      { width: 10, height: 1 },
    ]
  }))

  assert(success.returnCode === 0, `pack failed: ${success.outputText}`)
  const payload = JSON.parse(success.outputText)
  assert(payload.api === 'pack/v1', 'missing api version')
  assert(payload.width === 8 && payload.height === 8, 'wrong target size')
  assert(payload.padding === 1, 'wrong padding')
  assert(payload.packedAll === false, 'expected partial packing')
  assert(payload.packedCount === 2, 'expected two packed rects')
  assert(payload.failedCount === 1, 'expected one failed rect')
  assert(Array.isArray(payload.rects) && payload.rects.length === 3, 'wrong rect count')

  assert(payload.rects[0].id === 0, 'expected index-based id fallback')
  assert(payload.rects[0].packed === true, 'first rect should be packed')
  assert(typeof payload.rects[0].x === 'number', 'first rect missing x')
  assert(typeof payload.rects[0].y === 'number', 'first rect missing y')

  assert(payload.rects[1].id === 9, 'explicit id should be preserved')
  assert(payload.rects[1].packed === true, 'second rect should be packed')

  assert(payload.rects[2].id === 2, 'third rect should use index fallback id')
  assert(payload.rects[2].packed === false, 'third rect should not fit')
  assert(!('x' in payload.rects[2]), 'unpacked rect should not expose x')
  assert(!('y' in payload.rects[2]), 'unpacked rect should not expose y')

  const autoSized = runtime.call('pack', JSON.stringify({
    width: 3,
    height: 5,
    padding: 0,
    autoSize: true,
    rects: [
      { width: 5, height: 3 },
      { width: 3, height: 3 },
      { width: 2, height: 2 },
    ]
  }))

  assert(autoSized.returnCode === 0, `autoSize pack failed: ${autoSized.outputText}`)
  const autoPayload = JSON.parse(autoSized.outputText)
  assert(autoPayload.packedAll === true, 'autoSize should fit all rects')
  assert(autoPayload.packedCount === 3, 'autoSize should pack all rects')
  assert(autoPayload.failedCount === 0, 'autoSize should have no failed rects')
  assert(autoPayload.width === 8 && autoPayload.height === 8,
    'autoSize should grow to the smallest square power-of-two atlas')
  assert(autoPayload.rects.every((rect) => rect.packed === true),
    'autoSize should mark all rects packed')

  const badInput = runtime.call('pack', JSON.stringify({ height: 4, rects: [] }))
  assert(badInput.returnCode !== 0, 'expected bad input to fail')
  const badPayload = JSON.parse(badInput.outputText)
  assert(badPayload.code === 'bad_input', 'expected bad_input code')

  console.log('pack e2e ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
