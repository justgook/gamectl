import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const wasmPath = path.join(repoRoot, 'build.nosync/plugins/markov.wasm')
const tempDir = path.join(repoRoot, 'build.nosync/markov-e2e')

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class MarkovRuntime {
  constructor(instance) {
    this.instance = instance
    this.memory = instance.exports.memory
    this.heapOffset = Math.max(Number(instance.exports.__heap_base?.value || 65536), 8 * 1024 * 1024)
    if (this.heapOffset > this.memory.buffer.byteLength) {
      this.memory.grow(Math.ceil((this.heapOffset - this.memory.buffer.byteLength) / 65536))
    }
    this.inputPtr = 0
    this.inputLen = 0
    this.output = new Uint8Array()
    this.lastCallReturn = 0
    this.lastCallOutputPtr = 0
    this.lastCallOutputLen = 0
  }

  static async create(wasmBytes) {
    let runtime = null
    const writeU32 = (ptr, value) => new DataView(runtime.memory.buffer).setUint32(ptr, value >>> 0, true)
    const importObject = {
      wasi_snapshot_preview1: {
        fd_write: () => 0,
        clock_time_get: (_id, _precision, ptr) => { writeU32(Number(ptr), 0); writeU32(Number(ptr) + 4, 0); return 0 },
        args_sizes_get: (argcPtr, argvBufSizePtr) => { writeU32(Number(argcPtr), 0); writeU32(Number(argvBufSizePtr), 0); return 0 },
        args_get: () => 0,
        random_get: (ptr, len) => { new Uint8Array(runtime.memory.buffer, Number(ptr), Number(len)).fill(7); return 0 },
      },
      env: {
        alloc: (size) => runtime.alloc(Number(size)),
        free: () => {},
        input_ptr: () => runtime.inputPtr,
        input_len: () => runtime.inputLen,
        set_output: (ptr, len) => runtime.setOutput(Number(ptr), Number(len)),
        plugin_call: (modulePtr, moduleLen, funcPtr, funcLen, inputPtr, inputLen) =>
          runtime.pluginCall(Number(modulePtr), Number(moduleLen), Number(funcPtr), Number(funcLen), Number(inputPtr), Number(inputLen)),
        plugin_call_return: () => runtime.lastCallReturn,
        plugin_call_output_ptr: () => runtime.lastCallOutputPtr,
        plugin_call_output_len: () => runtime.lastCallOutputLen,
      },
    }
    const { instance } = await WebAssembly.instantiate(wasmBytes, importObject)
    runtime = new MarkovRuntime(instance)
    instance.exports._initialize()
    return runtime
  }

  alloc(size) {
    const ptr = this.heapOffset
    this.heapOffset += size
    if (this.heapOffset > this.memory.buffer.byteLength) {
      const missing = this.heapOffset - this.memory.buffer.byteLength
      this.memory.grow(Math.ceil(missing / 65536))
    }
    return ptr
  }

  setOutput(ptr, len) {
    this.output = new Uint8Array(this.memory.buffer.slice(ptr, ptr + len))
  }

  pluginCall(modulePtr, moduleLen, funcPtr, funcLen, inputPtr, inputLen) {
    const memory = new Uint8Array(this.memory.buffer)
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    const moduleName = decoder.decode(memory.slice(modulePtr, modulePtr + moduleLen))
    const functionName = decoder.decode(memory.slice(funcPtr, funcPtr + funcLen))
    const input = memory.slice(inputPtr, inputPtr + inputLen)

    const setResult = (returnCode, bytes) => {
      const ptr = this.alloc(bytes.length)
      new Uint8Array(this.memory.buffer, ptr, bytes.length).set(bytes)
      this.lastCallReturn = returnCode
      this.lastCallOutputPtr = ptr
      this.lastCallOutputLen = bytes.length
      return 0
    }

    this.lastCallReturn = 0
    this.lastCallOutputPtr = 0
    this.lastCallOutputLen = 0

    if (moduleName === 'fs' && functionName === 'read') {
      const filePath = decoder.decode(input)
      try {
        return setResult(0, fsSync.readFileSync(filePath))
      } catch (error) {
        return setResult(1, encoder.encode(String(error?.message || error)))
      }
    }

    if (moduleName === 'fs' && functionName === 'write') {
      const zero = input.indexOf(0)
      if (zero < 0) return setResult(1, encoder.encode('fs.write input missing separator'))
      const filePath = decoder.decode(input.slice(0, zero))
      const data = input.slice(zero + 1)
      fsSync.mkdirSync(path.dirname(filePath), { recursive: true })
      fsSync.writeFileSync(filePath, data)
      return setResult(0, encoder.encode('OK'))
    }

    return setResult(1, encoder.encode(`unsupported host call ${moduleName}.${functionName}`))
  }

  call(functionName, input) {
    const bytes = new TextEncoder().encode(JSON.stringify(input))
    this.inputPtr = this.alloc(bytes.length)
    this.inputLen = bytes.length
    new Uint8Array(this.memory.buffer, this.inputPtr, bytes.length).set(bytes)
    this.output = new Uint8Array()
    const fn = this.instance.exports[functionName]
    if (typeof fn !== 'function') throw new Error(`missing export ${functionName}`)
    const returnCode = Number(fn()) || 0
    return { returnCode, outputText: new TextDecoder().decode(this.output) }
  }
}

async function main() {
  await fs.mkdir(tempDir, { recursive: true })
  const wasmBytes = await fs.readFile(wasmPath)
  const runtime = await MarkovRuntime.create(toArrayBuffer(wasmBytes))

  const inspected = runtime.call('inspect', { modelXml: '<one values="BW" in="B" out="W"/>' })
  assert(inspected.returnCode === 0, `inspect failed: ${inspected.outputText}`)
  const inspectPayload = JSON.parse(inspected.outputText)
  assert(inspectPayload.values === 'BW', 'inspect should return values')
  assert(inspectPayload.features.one === true, 'inspect should report one feature')

  const run = runtime.call('run', { modelXml: '<one values="BW" in="B" out="W"/>', width: 3, height: 2, seed: 1, steps: 10 })
  assert(run.returnCode === 0, `run failed: ${run.outputText}`)
  const runPayload = JSON.parse(run.outputText)
  assert(runPayload.cells === 'WWW/WWW', `unexpected cells: ${run.outputText}`)

  const pathRun = runtime.call('run', {
    modelXml: '<sequence values="BRSU"><path from="R" to="S" on="B" color="U"/></sequence>',
    width: 5,
    height: 1,
    seed: 1,
    steps: 1,
    initial: { cells: 'RBBBS' },
  })
  assert(pathRun.returnCode === 0, `path run failed: ${pathRun.outputText}`)
  const pathPayload = JSON.parse(pathRun.outputText)
  assert(pathPayload.cells === 'RUUUS', `unexpected path cells: ${pathRun.outputText}`)

  const convolutionRun = runtime.call('run', {
    modelXml: '<convolution values="BW" neighborhood="Moore"><rule in="B" out="W" values="W" sum="1..8"/></convolution>',
    width: 3,
    height: 1,
    seed: 1,
    steps: 1,
    initial: { cells: 'BWB' },
  })
  assert(convolutionRun.returnCode === 0, `convolution run failed: ${convolutionRun.outputText}`)
  const convolutionPayload = JSON.parse(convolutionRun.outputText)
  assert(convolutionPayload.cells === 'WWW', `unexpected convolution cells: ${convolutionRun.outputText}`)

  const volumeRun = runtime.call('run', {
    modelXml: '<one values="BW" in="B B" out="W W"/>',
    width: 1,
    height: 1,
    depth: 2,
    seed: 1,
    steps: 10,
  })
  assert(volumeRun.returnCode === 0, `volume run failed: ${volumeRun.outputText}`)
  const volumePayload = JSON.parse(volumeRun.outputText)
  assert(volumePayload.depth === 2 && volumePayload.cells === 'W W', `unexpected volume cells: ${volumeRun.outputText}`)

  const mapRun = runtime.call('run', {
    modelXml: '<sequence values="BW"><all in="B" out="W"/><map scale="2 2 1" values="._"><rule in="W" out="__/__"/></map></sequence>',
    width: 2,
    height: 1,
    depth: 1,
    seed: 1,
    steps: 10,
  })
  assert(mapRun.returnCode === 0, `map run failed: ${mapRun.outputText}`)
  const mapPayload = JSON.parse(mapRun.outputText)
  assert(mapPayload.width === 4 && mapPayload.height === 2 && mapPayload.cells === '____/____', `unexpected map cells: ${mapRun.outputText}`)

  const sampleDir = path.join(tempDir, 'resources', 'samples')
  await fs.mkdir(sampleDir, { recursive: true })
  await fs.copyFile(path.join(repoRoot, 'tmp/MarkovJunior/resources/samples/Maze.png'), path.join(sampleDir, 'Maze.png'))
  const sampleModel = path.join(tempDir, 'Chain.xml')
  await fs.writeFile(sampleModel, '<convchain values="BDA" sample="Maze" on="B" black="D" white="A" n="2" steps="2"/>')
  const convChainRun = runtime.call('run', { model: sampleModel, width: 4, height: 4, seed: 1, steps: 10 })
  assert(convChainRun.returnCode === 0, `convchain run failed: ${convChainRun.outputText}`)
  const convChainPayload = JSON.parse(convChainRun.outputText)
  assert(convChainPayload.cells !== 'BBBB/BBBB/BBBB/BBBB', `convchain did not modify cells: ${convChainRun.outputText}`)

  await fs.copyFile(path.join(repoRoot, 'tmp/MarkovJunior/resources/samples/Dungeon.png'), path.join(sampleDir, 'Dungeon.png'))
  const wfcModel = path.join(tempDir, 'Wave.xml')
  await fs.writeFile(wfcModel, '<wfc values="BWP" sample="Dungeon" n="3" tries="10"/>')
  const wfcRun = runtime.call('run', { model: wfcModel, width: 6, height: 6, seed: 1, steps: 10 })
  assert(wfcRun.returnCode === 0, `overlap wfc run failed: ${wfcRun.outputText}`)
  const wfcPayload = JSON.parse(wfcRun.outputText)
  assert(wfcPayload.width === 6 && wfcPayload.height === 6 && wfcPayload.values === 'BWP', `unexpected wfc payload: ${wfcRun.outputText}`)

  const modelDir = path.join(tempDir, 'models')
  await fs.mkdir(modelDir, { recursive: true })
  const modelsXml = path.join(tempDir, 'models.xml')
  await fs.writeFile(modelsXml, '<models><model name="Basic" size="3" steps="10"/></models>')
  await fs.writeFile(path.join(modelDir, 'Basic.xml'), '<one values="BW" in="B" out="W"/>')
  const entry = runtime.call('runModelEntry', { modelsXml, name: 'Basic', seed: 1 })
  assert(entry.returnCode === 0, `runModelEntry failed: ${entry.outputText}`)
  const entryPayload = JSON.parse(entry.outputText)
  assert(entryPayload.width === 3 && entryPayload.height === 3, 'runModelEntry dimensions mismatch')
  assert(entryPayload.cells === 'WWW/WWW/WWW', `unexpected entry cells: ${entry.outputText}`)

  console.log('markov e2e ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
