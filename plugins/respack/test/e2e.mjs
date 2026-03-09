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

  bundle, ok_bundle := read_slot_0_bundle(pkg)
  assert(ok_bundle)

  assert(len(bundle.points) == 2)
  assert(bundle.points[0].x == f32(3.5))
  assert(bundle.points[0].y == f32(-2.0))
  assert(bundle.points[1].x == f32(10.25))
  assert(bundle.points[1].y == f32(8.75))

  assert(len(bundle.blob) == 6)
  assert(bundle.blob[0] == 0)
  assert(bundle.blob[1] == 17)
  assert(bundle.blob[2] == 34)
  assert(bundle.blob[3] == 51)
  assert(bundle.blob[4] == 200)
  assert(bundle.blob[5] == 255)

  assert(len(bundle.label) == 6)
  assert(bundle.label[0] == 'l')
  assert(bundle.label[1] == 'i')
  assert(bundle.label[2] == 'n')
  assert(bundle.label[3] == 'e')
  assert(bundle.label[4] == '\\n')
  assert(bundle.label[5] == '2')

  assert(len(bundle.text_blob) == 6)
  assert(bundle.text_blob[0] == 'l')
  assert(bundle.text_blob[1] == 'i')
  assert(bundle.text_blob[2] == 'n')
  assert(bundle.text_blob[3] == 'e')
  assert(bundle.text_blob[4] == '\\n')
  assert(bundle.text_blob[5] == '2')

  assert(bundle.shape.kind == shape_Kind.rect_shape)
  assert(bundle.shape.rect_shape.size.x == f32(6.0))
  assert(bundle.shape.rect_shape.size.y == f32(9.5))

  assert(len(bundle.palette) == 3)
  assert(bundle.palette[0][0] == 255)
  assert(bundle.palette[0][1] == 0)
  assert(bundle.palette[0][2] == 128)
  assert(bundle.palette[1][0] == 12)
  assert(bundle.palette[1][1] == 34)
  assert(bundle.palette[1][2] == 56)
  assert(bundle.palette[2][0] == 1)
  assert(bundle.palette[2][1] == 2)
  assert(bundle.palette[2][2] == 3)
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
      points: [
        { x: 3.5, y: -2.0 },
        { x: 10.25, y: 8.75 }
      ],
      blob: [0, 17, 34, 51, 200, 255],
      label: "line\n2",
      text_blob: "line\n2",
      shape: {
        rect: {
          size: { x: 6.0, y: 9.5 }
        }
      },
      palette: [
        [255, 0, 128],
        [12, 34, 56],
        [1, 2, 3]
      ]
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
