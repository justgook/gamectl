import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const wasmPath = path.join(repoRoot, 'build.nosync/plugins/respack.wasm')
const schemaPath = path.join(repoRoot, 'plugins/respack/testdata/simple.respack.json')
const tempDir = path.join(repoRoot, 'build.nosync/respack-e2e')

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

class RespackRuntime {
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
    runtime = new RespackRuntime(instance)
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

  call(functionName, input = '') {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
    this.inputPtr = this.alloc(bytes.length)
    this.inputLen = bytes.length
    new Uint8Array(this.memory.buffer, this.inputPtr, bytes.length).set(bytes)
    this.output = new Uint8Array()
    const fn = this.instance.exports[functionName]
    if (typeof fn !== 'function') {
      throw new Error(`missing export ${functionName}`)
    }
    const returnCode = Number(fn()) || 0
    if (returnCode !== 0) {
      throw new Error(`respack.${functionName} failed: ${new TextDecoder().decode(this.output)}`)
    }
    return this.output
  }
}

async function call(runtime, functionName, input = '') {
  try {
    return runtime.call(functionName, input)
  } catch (error) {
    throw error
  }
}

async function writeHarnessFiles(source, payloadBytes) {
  await fs.mkdir(tempDir, { recursive: true })
  await fs.writeFile(path.join(tempDir, 'generated_decoder.odin'), source)
  await fs.writeFile(path.join(tempDir, 'payload.bin'), payloadBytes)
  await fs.writeFile(path.join(tempDir, 'main.odin'), `package main

import "core:os"

main :: proc() {
  data, ok_data := os.read_entire_file("payload.bin", context.allocator)
  assert(ok_data)

  pkg, ok_pkg := open_respack(data)
  assert(ok_pkg)

  entity, ok_entity := read_slot_0_entity(pkg)
  assert(ok_entity)
  assert(entity.id == 7)
  assert(entity.name == "")
  assert(entity.pos.x == f32(3.5))
  assert(entity.pos.y == f32(-2.0))
  assert(entity.enabled)
}
`)
}

async function main() {
  const [wasmBytes, schemaText] = await Promise.all([
    fs.readFile(wasmPath),
    fs.readFile(schemaPath, 'utf8')
  ])

  const runtime = await RespackRuntime.create(toArrayBuffer(wasmBytes))

  await call(runtime, 'init', schemaText)

  await call(runtime, 'write', JSON.stringify({
    slot: 0,
    payload: {
      id: 7,
      pos: { x: 3.5, y: -2.0 },
      enabled: true
    }
  }))

  const dumpBytes = await call(runtime, 'dump')
  const sourceBytes = await call(runtime, 'generate_odin', 'main')
  const source = new TextDecoder().decode(sourceBytes)

  await writeHarnessFiles(source, dumpBytes)

  await execFileAsync('odin', ['run', '.'], {
    cwd: tempDir,
    timeout: 120000,
    env: process.env
  })

  console.log('respack e2e ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
