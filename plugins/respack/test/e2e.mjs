import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const wasmPath = path.join(repoRoot, 'build.nosync/plugins/respack.wasm')
const schemaPath = path.join(repoRoot, 'plugins/respack/testdata/simple.respack.json')
const game2SchemaPath = path.join(repoRoot, 'cmd/browser/assets/respack/game2.rspk.json')
const atlasPath = path.join(repoRoot, 'cmd/browser/assets/game/the_atlas.qoi')
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
    this.lastCallReturn = 0
    this.lastCallOutputPtr = 0
    this.lastCallOutputLen = 0
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
        plugin_call: (modulePtr, moduleLen, funcPtr, funcLen, inputPtr, inputLen) =>
          runtime.pluginCall(Number(modulePtr), Number(moduleLen), Number(funcPtr), Number(funcLen), Number(inputPtr), Number(inputLen)),
        plugin_call_return: () => runtime.lastCallReturn,
        plugin_call_output_ptr: () => runtime.lastCallOutputPtr,
        plugin_call_output_len: () => runtime.lastCallOutputLen,
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

  pluginCall(modulePtr, moduleLen, funcPtr, funcLen, inputPtr, inputLen) {
    const memory = new Uint8Array(this.memory.buffer)
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    const moduleName = decoder.decode(memory.slice(modulePtr, modulePtr + moduleLen))
    const functionName = decoder.decode(memory.slice(funcPtr, funcPtr + funcLen))
    const input = memory.slice(inputPtr, inputPtr + inputLen)

    this.lastCallReturn = 0
    this.lastCallOutputPtr = 0
    this.lastCallOutputLen = 0

    if (moduleName === 'fs' && functionName === 'read') {
      const filePath = decoder.decode(input)
      try {
        const data = fsSync.readFileSync(filePath)
        const ptr = this.alloc(data.length)
        new Uint8Array(this.memory.buffer, ptr, data.length).set(data)
        this.lastCallReturn = 0
        this.lastCallOutputPtr = ptr
        this.lastCallOutputLen = data.length
        return 0
      } catch (error) {
        const output = encoder.encode(error.message)
        const ptr = this.alloc(output.length)
        new Uint8Array(this.memory.buffer, ptr, output.length).set(output)
        this.lastCallReturn = 1
        this.lastCallOutputPtr = ptr
        this.lastCallOutputLen = output.length
        return 0
      }
    }

    if (moduleName === 'fs' && functionName === 'write') {
      let nullIndex = -1
      for (let i = 0; i < input.length; i++) {
        if (input[i] === 0) {
          nullIndex = i
          break
        }
      }
      if (nullIndex === -1) {
        const output = encoder.encode('Invalid format: missing null byte separator between path and data')
        const ptr = this.alloc(output.length)
        new Uint8Array(this.memory.buffer, ptr, output.length).set(output)
        this.lastCallReturn = 1
        this.lastCallOutputPtr = ptr
        this.lastCallOutputLen = output.length
        return 0
      }

      const filePath = decoder.decode(input.slice(0, nullIndex))
      const data = input.slice(nullIndex + 1)
      try {
        fsSync.writeFileSync(filePath, data)
        const output = encoder.encode('OK')
        const ptr = this.alloc(output.length)
        new Uint8Array(this.memory.buffer, ptr, output.length).set(output)
        this.lastCallReturn = 0
        this.lastCallOutputPtr = ptr
        this.lastCallOutputLen = output.length
        return 0
      } catch (error) {
        const output = encoder.encode(error.message)
        const ptr = this.alloc(output.length)
        new Uint8Array(this.memory.buffer, ptr, output.length).set(output)
        this.lastCallReturn = 1
        this.lastCallOutputPtr = ptr
        this.lastCallOutputLen = output.length
        return 0
      }
    }

    const output = encoder.encode(`unsupported host call ${moduleName}.${functionName}`)
    const ptr = this.alloc(output.length)
    new Uint8Array(this.memory.buffer, ptr, output.length).set(output)
    this.lastCallReturn = 1
    this.lastCallOutputPtr = ptr
    this.lastCallOutputLen = output.length
    return 0
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

async function expectCallError(runtime, functionName, input, expectedMessage) {
  try {
    await call(runtime, functionName, input)
  } catch (error) {
    if (!String(error.message || '').includes(expectedMessage)) {
      throw new Error(`Expected error to include "${expectedMessage}", got: ${error.message}`)
    }
    return
  }
  throw new Error(`Expected respack.${functionName} to fail`)
}

function readU16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readU32LE(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

function inspectDump(bytes) {
  if (bytes.length < 8) throw new Error('dump too small')
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'RSPK') {
    throw new Error('invalid dump magic')
  }
  const version = readU16LE(bytes, 4)
  const slotCount = readU16LE(bytes, 6)
  const slots = []
  for (let i = 0; i < slotCount; i += 1) {
    const entry = 8 + i * 8
    slots.push({
      offset: readU32LE(bytes, entry),
      length: readU32LE(bytes, entry + 4),
    })
  }
  return { version, slotCount, slots }
}

async function writeHarnessFiles(source, payloadBytes) {
  await fs.mkdir(tempDir, { recursive: true })
  await fs.writeFile(path.join(tempDir, 'generated_decoder.odin'), source)
  await fs.writeFile(path.join(tempDir, 'payload.bin'), payloadBytes)
  await fs.writeFile(path.join(tempDir, 'main.odin'), `package main

import "core:os"

main :: proc() {
  data, err_data := os.read_entire_file("payload.bin", context.allocator)
  assert(err_data == nil)

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
  const [wasmBytes, schemaText, game2SchemaText, atlasBytes] = await Promise.all([
    fs.readFile(wasmPath),
    fs.readFile(schemaPath, 'utf8'),
    fs.readFile(game2SchemaPath, 'utf8'),
    fs.readFile(atlasPath),
  ])

  const runtime = await RespackRuntime.create(toArrayBuffer(wasmBytes))
  await fs.mkdir(tempDir, { recursive: true })
  const blobPath = path.join(tempDir, 'blob.bin')
  const textBlobPath = path.join(tempDir, 'text_blob.txt')
  const missingBlobPath = path.join(tempDir, 'missing_blob.bin')
  await fs.writeFile(blobPath, Buffer.from([0, 17, 34, 51, 200, 255]))
  await fs.writeFile(textBlobPath, Buffer.from('line\n2', 'utf8'))

  await call(runtime, 'init', schemaText)

  await expectCallError(runtime, 'write', JSON.stringify({
    slot: 0,
    payload: {
      points: [
        { x: 3.5, y: -2.0 },
        { x: 10.25, y: 8.75 }
      ],
      blob: { _file: blobPath, extra: true },
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
  }), 'bytes file marker must contain only _file')

  await expectCallError(runtime, 'write', JSON.stringify({
    slot: 0,
    payload: {
      points: [
        { x: 3.5, y: -2.0 },
        { x: 10.25, y: 8.75 }
      ],
      blob: { _file: missingBlobPath },
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
  }), 'ENOENT')

  await call(runtime, 'write', JSON.stringify({
    slot: 0,
    payload: {
      points: [
        { x: 3.5, y: -2.0 },
        { x: 10.25, y: 8.75 }
      ],
      blob: { _file: blobPath },
      label: "line\n2",
      text_blob: { _file: textBlobPath },
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
  const savedDumpPath = path.join(tempDir, 'saved_payload.bin')
  await call(runtime, 'dump_to_file', savedDumpPath)
  const sourceBytes = await call(runtime, 'generate_odin', 'main')
  const source = new TextDecoder().decode(sourceBytes)
  const savedDumpBytes = await fs.readFile(savedDumpPath)

  if (Buffer.compare(Buffer.from(dumpBytes), savedDumpBytes) !== 0) {
    throw new Error('dump_to_file output mismatch')
  }

  await writeHarnessFiles(source, dumpBytes)

  await execFileAsync('odin', ['run', '.'], {
    cwd: tempDir,
    timeout: 120000,
    env: process.env
  })

  await call(runtime, 'init', game2SchemaText)
  await call(runtime, 'write', JSON.stringify({
    slot: 0,
    payload: {
      entity_ids: [],
      components: [],
    }
  }))
  await call(runtime, 'write', JSON.stringify({
    slot: 1,
    payload: { _file: atlasPath }
  }))
  await call(runtime, 'write', JSON.stringify({
    slot: 2,
    payload: []
  }))

  const game2Dump = await call(runtime, 'dump')
  const game2Info = inspectDump(game2Dump)
  if (game2Info.version !== 1) {
    throw new Error(`unexpected game2 dump version ${game2Info.version}`)
  }
  if (game2Info.slotCount !== 3) {
    throw new Error(`expected 3 slots in game2 dump, got ${game2Info.slotCount}`)
  }
  if (game2Info.slots[1].length !== atlasBytes.length + 4) {
    throw new Error(`expected atlas slot length ${atlasBytes.length + 4}, got ${game2Info.slots[1].length}`)
  }
  if (game2Dump.length <= atlasBytes.length) {
    throw new Error(`expected dump (${game2Dump.length}) to exceed atlas bytes (${atlasBytes.length})`)
  }

  console.log('respack e2e ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
