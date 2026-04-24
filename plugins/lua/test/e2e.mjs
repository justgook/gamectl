import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createWasiPreview1Imports } from '../../../cmd/browser/util/wasi.js'

if (!process.execArgv.includes('--experimental-wasm-exnref') && !process.env.GAMS_LUA_E2E_CHILD) {
  execFileSync(process.execPath, ['--experimental-wasm-exnref', fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: { ...process.env, GAMS_LUA_E2E_CHILD: '1' },
  })
  process.exit(0)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const wasmPath = path.join(repoRoot, 'build.nosync/plugins/lua.wasm')
const tempDir = path.join(repoRoot, 'build.nosync/lua-e2e')

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseJson(text) {
  return JSON.parse(text)
}

function assertDeepEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  if (actualText !== expectedText) {
    throw new Error(`${label}: expected ${expectedText}, got ${actualText}`)
  }
}

function createLuaWasiImports(getMemory) {
  const wasi = createWasiPreview1Imports(getMemory)
  const writeU32 = (ptr, value) => {
    const mem = getMemory()
    if (!mem || !ptr) return
    new DataView(mem.buffer).setUint32(ptr, value >>> 0, true)
  }
  return {
    ...wasi,
    environ_get: () => 0,
    environ_sizes_get: (countPtr, bufSizePtr) => {
      writeU32(countPtr, 0)
      writeU32(bufSizePtr, 0)
      return 0
    },
  }
}

class LuaRuntime {
  constructor(instance) {
    this.instance = instance
    this.memory = instance.exports.memory
    this.heapOffset = Math.max(Number(instance.exports.__heap_base?.value || 65536) + (4 * 1024 * 1024), this.memory.buffer.byteLength)
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
    const importObject = {
      wasi_snapshot_preview1: createLuaWasiImports(() => runtime?.memory || null),
      env: {
        __wasm_longjmp: () => {
          throw new Error('__wasm_longjmp called')
        },
        __wasm_setjmp: () => {},
        __wasm_setjmp_test: () => 0,
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
    runtime = new LuaRuntime(instance)
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

    this.lastCallReturn = 0
    this.lastCallOutputPtr = 0
    this.lastCallOutputLen = 0

    const setResult = (returnCode, bytes) => {
      const ptr = this.alloc(bytes.length)
      new Uint8Array(this.memory.buffer, ptr, bytes.length).set(bytes)
      this.lastCallReturn = returnCode
      this.lastCallOutputPtr = ptr
      this.lastCallOutputLen = bytes.length
      return 0
    }

    if (moduleName === 'fs' && functionName === 'read') {
      const filePath = decoder.decode(input)
      try {
        return setResult(0, fsSync.readFileSync(filePath))
      } catch (error) {
        return setResult(1, encoder.encode(String(error?.message || error)))
      }
    }

    if (moduleName === 'mock' && functionName === 'ping') {
      return setResult(0, encoder.encode(`pong:${decoder.decode(input)}`))
    }

    return setResult(1, encoder.encode(`unsupported host call ${moduleName}.${functionName}`))
  }

  call(functionName, input = '') {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
    this.inputPtr = this.alloc(bytes.length)
    this.inputLen = bytes.length
    new Uint8Array(this.memory.buffer, this.inputPtr, bytes.length).set(bytes)
    this.output = new Uint8Array()
    const fn = this.instance.exports[functionName]
    if (typeof fn !== 'function') throw new Error(`missing export ${functionName}`)
    const returnCode = Number(fn()) || 0
    return { returnCode, output: new TextDecoder().decode(this.output) }
  }
}

async function main() {
  await fs.mkdir(tempDir, { recursive: true })
  await fs.access(wasmPath)

  const modulePath = path.join(tempDir, 'util.lua')
  await fs.writeFile(modulePath, [
    'load_count = (load_count or 0) + 1',
    'return {',
    '  value = 41,',
    '  count = load_count,',
    '}'
  ].join('\n'))

  const wasmBytes = await fs.readFile(wasmPath)
  const runtime = await LuaRuntime.create(toArrayBuffer(wasmBytes))

  const initResult = runtime.call('init', '')
  assert(initResult.returnCode === 0, `init failed: ${initResult.output}`)
  assert(initResult.output === 'ok', `init output mismatch: ${initResult.output}`)

  const simple = runtime.call('run', [
    'output = {',
    '  answer = 42,',
    '  list = {1, 2, 3},',
    '  ok = true,',
    '}'
  ].join('\n'))
  assert(simple.returnCode === 0, `simple run failed: ${simple.output}`)
  {
    const parsed = parseJson(simple.output)
    assertDeepEqual(parsed.list, [1, 2, 3], 'simple.list')
    assert(parsed.answer === 42, `unexpected simple.answer: ${simple.output}`)
    assert(parsed.ok === true, `unexpected simple.ok: ${simple.output}`)
  }

  const decodeResult = runtime.call('run', [
    'function main()',
    '  local doc = json.decode("{\\"name\\":\\"demo\\",\\"items\\":[1,2,true,null],\\"nested\\":{\\"x\\":3}}")',
    '  output = {',
    '    name = doc.name,',
    '    second = doc.items[2],',
    '    third = doc.items[3],',
    '    fourth_is_nil = doc.items[4] == nil,',
    '    x = doc.nested.x,',
    '  }',
    'end'
  ].join('\n'))
  assert(decodeResult.returnCode === 0, `json.decode run failed: ${decodeResult.output}`)
  {
    const parsed = parseJson(decodeResult.output)
    assert(parsed.name === 'demo', `unexpected decode.name: ${decodeResult.output}`)
    assert(parsed.second === 2, `unexpected decode.second: ${decodeResult.output}`)
    assert(parsed.third === true, `unexpected decode.third: ${decodeResult.output}`)
    assert(parsed.fourth_is_nil === true, `unexpected decode.fourth_is_nil: ${decodeResult.output}`)
    assert(parsed.x === 3, `unexpected decode.x: ${decodeResult.output}`)
  }

  const hostCall = runtime.call('run', [
    'function main()',
    '  local reply = host.call("mock", "ping", "hello")',
    '  output = { reply = reply }',
    'end'
  ].join('\n'))
  assert(hostCall.returnCode === 0, `host.call run failed: ${hostCall.output}`)
  {
    const parsed = parseJson(hostCall.output)
    assert(parsed.reply === 'pong:hello', `unexpected host.call output: ${hostCall.output}`)
  }

  const requireResult = runtime.call('run', [
    'function main()',
    `  local a = require(${JSON.stringify(modulePath.slice(0, -4))})`,
    `  local b = require(${JSON.stringify(modulePath.slice(0, -4))})`,
    '  output = {',
    '    sum = a.value + b.value,',
    '    same = a == b,',
    '    count = load_count,',
    '  }',
    'end'
  ].join('\n'))
  assert(requireResult.returnCode === 0, `require run failed: ${requireResult.output}`)
  {
    const parsed = parseJson(requireResult.output)
    assert(parsed.sum === 82, `unexpected require.sum: ${requireResult.output}`)
    assert(parsed.same === true, `unexpected require.same: ${requireResult.output}`)
    assert(parsed.count === 1, `unexpected require.count: ${requireResult.output}`)
  }

  const nullOutput = runtime.call('run', 'function main() end')
  assert(nullOutput.returnCode === 0, `null output run failed: ${nullOutput.output}`)
  assert(nullOutput.output === 'null', `unexpected null output: ${nullOutput.output}`)

  const syntaxError = runtime.call('run', [
    'function main(',
    '  output = 1',
    'end',
  ].join('\n'))
  assert(syntaxError.returnCode === 1, `syntax error should fail: ${syntaxError.output}`)
  assert(syntaxError.output.includes("(input):2: ')' expected near '='"), `syntax error message was not preserved: ${syntaxError.output}`)
  assert(!syntaxError.output.includes('unreachable'), `syntax error leaked wasm trap: ${syntaxError.output}`)

  const runtimeError = runtime.call('run', [
    'function main()',
    '  error("boom")',
    'end',
  ].join('\n'))
  assert(runtimeError.returnCode === 1, `runtime error should fail: ${runtimeError.output}`)
  assert(runtimeError.output.includes('(input):2: boom'), `runtime error message was not preserved: ${runtimeError.output}`)
  assert(!runtimeError.output.includes('unreachable'), `runtime error leaked wasm trap: ${runtimeError.output}`)

  console.log('lua e2e ok')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
