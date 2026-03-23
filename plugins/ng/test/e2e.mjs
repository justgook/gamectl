import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWasiPreview1Imports } from '../../../cmd/browser/util/wasi.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const wasmPath = path.join(repoRoot, 'build.nosync/plugins/ng.wasm')

const NG = {
  NODE_GOAL: 1,
  NODE_CODE: 2,
  NODE_CALL: 3,
  NODE_VALUE: 4,
}

const INFO = {
  GENERATION: 8,
  NODES: 28,
}

const NODE = {
  ID: 0,
  KIND: 4,
  EXEC_STATE: 8,
  INPUT_COUNT: 20,
  OUTPUT_COUNT: 24,
}

const ABI = {
  NODE_HEADER_SIZE: 32,
  INPUT_PORT_SIZE: 12,
  OUTPUT_PORT_SIZE: 4,
  VALUE_SLOT_SIZE: 12,
}

ABI.NODE_SIZE = ABI.NODE_HEADER_SIZE + (32 * ABI.INPUT_PORT_SIZE) + (32 * ABI.OUTPUT_PORT_SIZE) + (32 * ABI.VALUE_SLOT_SIZE)

const IMPORT_BOUNDARY_PORT_STRIDE = 33

function importPortId(nodeId, portId) {
  return Number(nodeId) * IMPORT_BOUNDARY_PORT_STRIDE + Number(portId)
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class NgRuntime {
  constructor(instance) {
    this.instance = instance
    this.memory = instance.exports.memory
    this.heapOffset = Number(instance.exports.__heap_base?.value || 65536)
    this.inputPtr = 0
    this.inputLen = 0
    this.output = new Uint8Array()
    this.lastEvent = null
    this.goalPayloads = []
  }

  static async create(wasmBytes) {
    let runtime = null
    const importObject = {
      wasi_snapshot_preview1: createWasiPreview1Imports(() => runtime?.memory || null),
      env: {
        ng_on_node_changed: () => {},
        ng_on_run_event: (nodeId, eventKind, errorCode) => {
          if (!runtime) return
          runtime.lastEvent = { nodeId: Number(nodeId), eventKind: Number(eventKind), errorCode: Number(errorCode) }
        },
        ng_on_goal_reached: (goalNodeId, payloadPtr, payloadLen) => {
          if (!runtime) return
          const bytes = new Uint8Array(runtime.memory.buffer, Number(payloadPtr), Number(payloadLen))
          runtime.goalPayloads.push({ goalNodeId: Number(goalNodeId), payload: new TextDecoder().decode(bytes) })
        },
        ng_host_resolve: (nodeId, resolveKind, reqPtr, reqLen, outPtr, outCap, outLenPtr) => {
          if (!runtime) return 7
          const view = new DataView(runtime.memory.buffer)
          const req = new Uint8Array(runtime.memory.buffer, Number(reqPtr), Number(reqLen))
          let payload = ''
          if (Number(resolveKind) === 3) {
            const outputId = req.length >= 4 ? view.getUint32(Number(reqPtr), true) : 1
            payload = `value:${Number(nodeId)}:${outputId}`
          } else if (Number(resolveKind) === 4) {
            const graphId = req.length >= 4 ? view.getUint32(Number(reqPtr), true) : 0
            if (graphId === 99) {
              payload = JSON.stringify([
                {
                  id: 11,
                  kind: NG.NODE_VALUE,
                  name: 'input',
                  outputs: [
                    { id: 1, name: 'A', value: 'fallback-a' },
                    { id: 2, name: 'B', value: 'fallback-b' },
                  ],
                },
                {
                  id: 12,
                  kind: NG.NODE_CODE,
                  code: "outputs[1] = 'subA:' .. tostring(inputs[1] or '')\noutputs[2] = 'subB:' .. tostring(inputs[2] or '')",
                  inputs: [{ id: 1, srcNodeId: 11, srcOutputId: 1 }, { id: 2, srcNodeId: 11, srcOutputId: 2 }],
                  outputs: [{ id: 1 }, { id: 2 }],
                },
                {
                  id: 13,
                  kind: NG.NODE_GOAL,
                  name: 'result',
                  inputs: [{ id: 1, name: 'A', srcNodeId: 12, srcOutputId: 1 }, { id: 2, name: 'B', srcNodeId: 12, srcOutputId: 2 }],
                },
              ])
            }
          }
          const bytes = new TextEncoder().encode(payload)
          if (bytes.length > Number(outCap)) return 4
          new Uint8Array(runtime.memory.buffer, Number(outPtr), bytes.length).set(bytes)
          view.setInt32(Number(outLenPtr), bytes.length, true)
          return 0
        },
        ng_host_request: () => 7,
      },
    }

    const { instance } = await WebAssembly.instantiate(wasmBytes, importObject)
    runtime = new NgRuntime(instance)
    return runtime
  }

  call(fnName, ...args) {
    const fn = this.instance.exports[fnName]
    if (typeof fn !== 'function') throw new Error(`missing export ${fnName}`)
    return Number(fn(...args)) || 0
  }

  infoView() {
    return new DataView(this.memory.buffer)
  }

  nodeAt(index) {
    const ptr = this.call('ng_get_info_ptr')
    const base = ptr + INFO.NODES + index * ABI.NODE_SIZE
    const view = this.infoView()
    return {
      id: view.getUint32(base + NODE.ID, true),
      kind: view.getUint32(base + NODE.KIND, true),
      execState: view.getUint32(base + NODE.EXEC_STATE, true),
      inputCount: view.getUint32(base + NODE.INPUT_COUNT, true),
      outputCount: view.getUint32(base + NODE.OUTPUT_COUNT, true),
    }
  }

  nodeById(nodeId) {
    for (let i = 0; i < 32; i += 1) {
      const node = this.nodeAt(i)
      if (node.id === Number(nodeId)) return node
    }
    return null
  }

  writeString(ptr, text) {
    const bytes = new TextEncoder().encode(String(text || ''))
    new Uint8Array(this.memory.buffer, ptr, bytes.length).set(bytes)
    return bytes.length
  }

  run(fnName, input = '') {
    const bytes = new TextEncoder().encode(String(input || ''))
    this.inputPtr = this.heapOffset
    this.inputLen = bytes.length
    this.heapOffset += bytes.length
    if (this.heapOffset > this.memory.buffer.byteLength) {
      this.memory.grow(Math.ceil((this.heapOffset - this.memory.buffer.byteLength) / 65536))
    }
    new Uint8Array(this.memory.buffer, this.inputPtr, bytes.length).set(bytes)
    this.output = new Uint8Array()
    const fn = this.instance.exports[fnName]
    const returnCode = Number(fn()) || 0
    return returnCode
  }
}

async function main() {
  await fs.access(wasmPath)
  const wasmBytes = await fs.readFile(wasmPath)
  const runtime = await NgRuntime.create(toArrayBuffer(wasmBytes))

  assert(runtime.call('ng_init') === 0, 'ng_init failed')
  assert(runtime.call('ng_clear_graph') === 0, 'ng_clear_graph failed')

  assert(runtime.call('ng_node_create', 1, NG.NODE_GOAL) === 0, 'goal create failed')
  assert(runtime.call('ng_node_create', 2, NG.NODE_VALUE) === 0, 'value create failed')
  assert(runtime.call('ng_node_create', 3, NG.NODE_CALL) === 0, 'import create failed')

  assert(runtime.call('ng_input_add', 1, 1) === 0, 'goal input add failed')
  assert(runtime.call('ng_input_add', 1, 2) === 0, 'goal second input add failed')
  assert(runtime.call('ng_output_add', 2, 1) === 0, 'value output add failed')
  assert(runtime.call('ng_output_add', 2, 2) === 0, 'value second output add failed')
  assert(runtime.call('ng_input_add', 3, importPortId(11, 1)) === 0, 'import input A add failed')
  assert(runtime.call('ng_input_add', 3, importPortId(11, 2)) === 0, 'import input B add failed')
  assert(runtime.call('ng_output_add', 3, importPortId(13, 1)) === 0, 'import output A add failed')
  assert(runtime.call('ng_output_add', 3, importPortId(13, 2)) === 0, 'import output B add failed')
  assert(runtime.call('ng_node_set_arg', 3, 0, 1, 99, 0) === 0, 'import graph id set failed')

  assert(runtime.call('ng_input_connect', 3, importPortId(11, 1), 2, 1) === 0, 'import/value A connect failed')
  assert(runtime.call('ng_input_connect', 1, 1, 3, importPortId(13, 1)) === 0, 'goal/import A connect failed')
  assert(runtime.call('ng_input_connect', 1, 2, 3, importPortId(13, 2)) === 0, 'goal/import B connect failed')

  const goal = runtime.nodeById(1)
  const value = runtime.nodeById(2)
  const imp = runtime.nodeById(3)

  assert(goal.kind === NG.NODE_GOAL, 'goal kind mismatch')
  assert(goal.inputCount === 2, 'goal input count mismatch')
  assert(value.kind === NG.NODE_VALUE, 'value kind mismatch')
  assert(value.outputCount === 2, 'value output count mismatch')
  assert(imp.kind === NG.NODE_CALL, 'import kind mismatch')
  assert(imp.inputCount === 2 && imp.outputCount === 2, 'import port counts mismatch')

  const rc = runtime.call('ng_run_goal', 1)
  assert(rc === 0, `run goal failed with ${rc}`)
  assert(runtime.goalPayloads.length === 1, 'expected one goal callback')
  assert(runtime.goalPayloads[0].payload.includes('subA:value:2:1'), 'goal payload should resolve imported port A from parent connection')
  assert(runtime.goalPayloads[0].payload.includes('subB:fallback-b'), 'goal payload should resolve imported port B from default')

  const importState = runtime.call('ng_get_node_exec_state', 3)
  assert(importState === 1, 'import node should finish successfully')

  runtime.goalPayloads = []
  assert(runtime.call('ng_clear_graph') === 0, 'second clear_graph failed')
  assert(runtime.call('ng_node_create', 1, NG.NODE_GOAL) === 0, 'second goal create failed')
  assert(runtime.call('ng_node_create', 3, NG.NODE_CALL) === 0, 'second import create failed')
  assert(runtime.call('ng_input_add', 1, 1) === 0, 'second goal input add failed')
  assert(runtime.call('ng_input_add', 1, 2) === 0, 'second goal second input add failed')
  assert(runtime.call('ng_output_add', 3, importPortId(13, 1)) === 0, 'second import output A add failed')
  assert(runtime.call('ng_output_add', 3, importPortId(13, 2)) === 0, 'second import output B add failed')
  assert(runtime.call('ng_node_set_arg', 3, 0, 1, 99, 0) === 0, 'second import graph id set failed')
  assert(runtime.call('ng_input_connect', 1, 1, 3, importPortId(13, 1)) === 0, 'second goal/import A connect failed')
  assert(runtime.call('ng_input_connect', 1, 2, 3, importPortId(13, 2)) === 0, 'second goal/import B connect failed')

  const rcDefault = runtime.call('ng_run_goal', 1)
  assert(rcDefault === 0, `default import run failed with ${rcDefault}`)
  assert(runtime.goalPayloads.length === 1, 'expected one default goal callback')
  assert(runtime.goalPayloads[0].payload.includes('subA:fallback-a'), 'goal payload should use imported default value for A when disconnected')
  assert(runtime.goalPayloads[0].payload.includes('subB:fallback-b'), 'goal payload should use imported default value for B when disconnected')

  console.log('ng e2e ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
