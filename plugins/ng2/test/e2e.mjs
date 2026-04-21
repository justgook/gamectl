import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const wasmPath = path.join(repoRoot, 'build.nosync/plugins/ng2.wasm')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

class Ng2Runtime {
  constructor(instance, memory) {
    this.instance = instance
    this.memory = memory
    this.inputPtr = 0
    this.inputLen = 0
    this.outputPtr = 0
    this.outputLen = 0
    this.heapOffset = 5 * 1024 * 1024
    this.output = new Uint8Array()
    this.lastPluginCallReturn = 0
    this.lastPluginCallOutput = new Uint8Array()
    this.sqlExecs = []
  }

  static async create(wasmBytes) {
    const memory = new WebAssembly.Memory({ initial: 96, maximum: 256, shared: true })
    let runtime = null
    const importObject = {
      env: {
        memory,
        alloc: (size) => {
          const aligned = (Number(size) + 7) & ~7
          const ptr = runtime.heapOffset
          runtime.heapOffset += aligned
          while (runtime.heapOffset > runtime.memory.buffer.byteLength) {
            runtime.memory.grow(1)
          }
          new Uint8Array(runtime.memory.buffer, ptr, aligned).fill(0)
          return ptr
        },
        free: () => {},
        input_ptr: () => runtime.inputPtr,
        input_len: () => runtime.inputLen,
        set_output: (ptr, len) => {
          runtime.outputPtr = Number(ptr)
          runtime.outputLen = Number(len)
        },
        plugin_call: (modulePtr, moduleLen, funcPtr, funcLen, inputPtr, inputLen) => {
          const dec = new TextDecoder()
          const memView = new Uint8Array(runtime.memory.buffer)
          const module = dec.decode(memView.slice(Number(modulePtr), Number(modulePtr) + Number(moduleLen)))
          const func = dec.decode(memView.slice(Number(funcPtr), Number(funcPtr) + Number(funcLen)))
          const input = dec.decode(memView.slice(Number(inputPtr), Number(inputPtr) + Number(inputLen)))
          if (module === 'sql' && func === 'exec') {
            runtime.sqlExecs.push(input)
            runtime.lastPluginCallReturn = 0
            runtime.lastPluginCallOutput = new TextEncoder().encode('OK')
            return 0
          }
          runtime.lastPluginCallReturn = 1
          runtime.lastPluginCallOutput = new TextEncoder().encode('unsupported plugin call')
          return 0
        },
        plugin_call_return: () => runtime.lastPluginCallReturn,
        plugin_call_output_ptr: () => {
          if (!runtime.lastPluginCallOutput.length) return 0
          const ptr = runtime.heapOffset
          runtime.heapOffset += runtime.lastPluginCallOutput.length
          while (runtime.heapOffset > runtime.memory.buffer.byteLength) {
            runtime.memory.grow(1)
          }
          new Uint8Array(runtime.memory.buffer, ptr, runtime.lastPluginCallOutput.length).set(runtime.lastPluginCallOutput)
          return ptr
        },
        plugin_call_output_len: () => runtime.lastPluginCallOutput.length,
      },
    }
    const { instance } = await WebAssembly.instantiate(wasmBytes, importObject)
    runtime = new Ng2Runtime(instance, memory)
    return runtime
  }

  call(name, input = '') {
    const fn = this.instance.exports[name]
    if (typeof fn !== 'function') throw new Error(`missing export ${name}`)
    const bytes = new TextEncoder().encode(String(input))
    this.inputPtr = 1024
    this.inputLen = bytes.length
    this.outputPtr = 0
    this.outputLen = 0
    new Uint8Array(this.memory.buffer, this.inputPtr, bytes.length).set(bytes)
    const returnCode = Number(fn()) || 0
    this.output = this.outputLen > 0
      ? new Uint8Array(this.memory.buffer.slice(this.outputPtr, this.outputPtr + this.outputLen))
      : new Uint8Array()
    return {
      returnCode,
      output: this.output,
      text: new TextDecoder().decode(this.output),
    }
  }
}

async function main() {
  await fs.access(wasmPath)
  const wasmBytes = await fs.readFile(wasmPath)
  const runtime = await Ng2Runtime.create(toArrayBuffer(wasmBytes))

  const sqlInit = runtime.call('__sql_init')
  assert(sqlInit.returnCode === 0, `__sql_init failed: ${sqlInit.returnCode}`)
  assert(runtime.sqlExecs.length === 2, `expected 2 sql init statements, got ${runtime.sqlExecs.length}`)
  assert(runtime.sqlExecs[0].includes('CREATE TABLE IF NOT EXISTS ng2_graph_storage'), 'expected ng2_graph_storage create SQL')
  assert(runtime.sqlExecs[1].includes("INSERT OR IGNORE INTO ng2_graph_storage"), 'expected ng2 default seed SQL')

  const created = runtime.call('ng_handle_create')
  assert(created.returnCode === 0, `ng_handle_create failed: ${created.returnCode}`)
  const handle = Number.parseInt(created.text, 10)
  assert(handle > 0, 'handle should be positive')

  const loaded = runtime.call('ng_debug_load_sample', String(handle))
  assert(loaded.returnCode === 0, `ng_debug_load_sample failed: ${loaded.returnCode}`)

  const sizeResult = runtime.call('ng_get_info_size')
  assert(sizeResult.returnCode === 0, 'ng_get_info_size failed')
  const infoSize = Number.parseInt(sizeResult.text, 10)
  assert(infoSize > 0, 'info size should be positive')

  const ptrResult = runtime.call('ng_get_info_ptr', String(handle))
  assert(ptrResult.returnCode === 0, `ng_get_info_ptr failed: ${ptrResult.returnCode}`)
  const infoPtr = Number.parseInt(ptrResult.text, 10)
  const view = new DataView(runtime.memory.buffer)
  const nodeCount = view.getUint32(infoPtr + 12, true)
  assert(nodeCount === 6, `expected sample node count 6, got ${nodeCount}`)

  const runExisting = runtime.call('ng_run', JSON.stringify({
    handle,
    goal: 6,
    inputs: {
      entry: {
        seed: 123,
        theme: 'forest',
      },
    },
  }))
  assert(runExisting.returnCode === 0, `ng_run existing-handle failed: ${runExisting.returnCode}`)
  const runExistingJson = JSON.parse(runExisting.text)
  assert(runExistingJson.success === true, 'ng_run success should be true')
  assert(runExistingJson.handle === handle, 'ng_run should keep the same handle')
  assert(runExistingJson.goalCount === 1, 'ng_run should report one goal')
  assert(runExistingJson.goals[0].goalNodeId === 6, 'goal payload should target node 6')
  assert(runExistingJson.goals[0].payload.inputs.entry.seed === 123, 'ng_run should echo scoped input seed')
  assert(runExistingJson.goals[0].payload.inputs.entry.theme === 'forest', 'ng_run should echo scoped input theme')

  const stillAlive = runtime.call('ng_get_info_ptr', String(handle))
  assert(stillAlive.returnCode === 0, 'ng_run should not close existing handle')

  const runTemp = runtime.call('ng_run_and_close', JSON.stringify({
    graph: 'default',
    goal: 0,
    inputs: {
      entry: {
        mode: 'batch',
      },
    },
  }))
  assert(runTemp.returnCode === 0, `ng_run_and_close failed: ${runTemp.returnCode}`)
  const runTempJson = JSON.parse(runTemp.text)
  assert(runTempJson.success === true, 'ng_run_and_close success should be true')
  assert(runTempJson.graph === 'default', 'ng_run_and_close should report graph name')
  assert(runTempJson.goals[0].payload.inputs.entry.mode === 'batch', 'ng_run_and_close should echo scoped batch input')

  const closeExisting = runtime.call('ng_run_and_close', JSON.stringify({
    handle,
    goal: 6,
    inputs: {
      entry: {
        closeMe: true,
      },
    },
  }))
  assert(closeExisting.returnCode === 0, `ng_run_and_close(existing handle) failed: ${closeExisting.returnCode}`)

  const dead = runtime.call('ng_get_info_ptr', String(handle))
  assert(dead.returnCode === 2, `expected closed handle to be invalid, got ${dead.returnCode}`)

  const notImpl = runtime.call('ng_node_create', '1')
  assert(notImpl.returnCode === 4, `expected not implemented rc 4, got ${notImpl.returnCode}`)
  assert(notImpl.text === 'ng_node_create', `expected method name output, got ${notImpl.text}`)

  console.log('ng2 e2e ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
