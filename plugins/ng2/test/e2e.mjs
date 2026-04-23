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
    this.graphRows = new Map()
    this.nextRowId = 1
    this.fsReads = new Map([
      ['local:/code/pass.lua', 'outputs[1] = inputs[1]'],
      ['local:/code/literal.lua', "outputs[1] = 'from-file'"],
    ])
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
          const enc = new TextEncoder()
          const memView = new Uint8Array(runtime.memory.buffer)
          const module = dec.decode(memView.slice(Number(modulePtr), Number(modulePtr) + Number(moduleLen)))
          const func = dec.decode(memView.slice(Number(funcPtr), Number(funcPtr) + Number(funcLen)))
          const input = dec.decode(memView.slice(Number(inputPtr), Number(inputPtr) + Number(inputLen)))
          const decodeSqlString = (text) => text.replace(/''/g, "'")
          const csvField = (value) => {
            const text = String(value ?? '')
            if (!/[",\n\r]/.test(text)) return text
            return '"' + text.replace(/"/g, '""') + '"'
          }
          if (module === 'sql' && func === 'exec') {
            runtime.sqlExecs.push(input)
            if (input.startsWith('INSERT OR IGNORE INTO ng2_graph_storage')) {
              const match = input.match(/VALUES \('((?:''|[^'])*)','((?:[^']|'')*)',(\d+)\)/)
              if (match) {
                const name = decodeSqlString(match[1])
                if (!runtime.graphRows.has(name)) {
                  runtime.graphRows.set(name, { rowid: runtime.nextRowId++, name, data: decodeSqlString(match[2]), nodeCount: Number(match[3]) })
                }
              }
            } else if (input.startsWith('INSERT INTO ng2_graph_storage')) {
              const prefix = "VALUES ('"
              const nameSep = "', '"
              const countSep = "', "
              const tail = ", datetime('now')) ON CONFLICT(name) DO UPDATE"
              const prefixIndex = input.indexOf(prefix)
              const nameSepIndex = input.indexOf(nameSep, prefixIndex + prefix.length)
              const tailIndex = input.lastIndexOf(tail)
              const countSepIndex = input.lastIndexOf(countSep, tailIndex)
              if (prefixIndex >= 0 && nameSepIndex > prefixIndex && countSepIndex > nameSepIndex && tailIndex > countSepIndex) {
                const name = decodeSqlString(input.slice(prefixIndex + prefix.length, nameSepIndex))
                const data = decodeSqlString(input.slice(nameSepIndex + nameSep.length, countSepIndex))
                const nodeCount = Number(input.slice(countSepIndex + countSep.length, tailIndex))
                const existing = runtime.graphRows.get(name)
                runtime.graphRows.set(name, {
                  rowid: existing?.rowid || runtime.nextRowId++,
                  name,
                  data,
                  nodeCount,
                })
              }
            } else if (input.startsWith('DELETE FROM ng2_graph_storage')) {
              const match = input.match(/WHERE name='((?:''|[^'])*)'/)
              if (match) runtime.graphRows.delete(decodeSqlString(match[1]))
            }
            runtime.lastPluginCallReturn = 0
            runtime.lastPluginCallOutput = enc.encode('OK')
            return 0
          }
          if (module === 'sql' && func === 'query') {
            let text = ''
            if (input.startsWith('SELECT name, data FROM ng2_graph_storage WHERE name=')) {
              const match = input.match(/WHERE name='((?:''|[^'])*)'/)
              const name = decodeSqlString(match?.[1] || '')
              const row = runtime.graphRows.get(name)
              text = 'name,data\n'
              if (row) text += `${csvField(row.name)},${csvField(row.data)}\n`
            } else if (input.startsWith('SELECT name, data FROM ng2_graph_storage WHERE rowid=')) {
              const match = input.match(/WHERE rowid=(\d+)/)
              const rowid = Number(match?.[1] || 0)
              const row = [...runtime.graphRows.values()].find((entry) => entry.rowid === rowid)
              text = 'name,data\n'
              if (row) text += `${csvField(row.name)},${csvField(row.data)}\n`
            } else if (input.startsWith('SELECT rowid, name, node_count, updated_at FROM ng2_graph_storage')) {
              text = 'rowid,name,node_count,updated_at\n'
              for (const row of [...runtime.graphRows.values()].sort((a, b) => a.name.localeCompare(b.name))) {
                text += `${row.rowid},${csvField(row.name)},${row.nodeCount},now\n`
              }
            } else {
              runtime.lastPluginCallReturn = 1
              runtime.lastPluginCallOutput = enc.encode('unsupported sql query')
              return 0
            }
            runtime.lastPluginCallReturn = 0
            runtime.lastPluginCallOutput = enc.encode(text)
            return 0
          }
          if (module === 'fs' && func === 'read') {
            if (!runtime.fsReads.has(input)) {
              runtime.lastPluginCallReturn = 1
              runtime.lastPluginCallOutput = enc.encode('missing fs path')
              return 0
            }
            runtime.lastPluginCallReturn = 0
            runtime.lastPluginCallOutput = enc.encode(runtime.fsReads.get(input))
            return 0
          }
          runtime.lastPluginCallReturn = 1
          runtime.lastPluginCallOutput = enc.encode('unsupported plugin call')
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

  const created2 = runtime.call('ng_handle_create')
  assert(created2.returnCode === 0, `second ng_handle_create failed: ${created2.returnCode}`)
  const handle2 = Number.parseInt(created2.text, 10)
  assert(handle2 > 0, 'second handle should be positive')

  assert(runtime.call('ng_node_create', JSON.stringify({ handle: handle2, nodeId: 10, kind: 4 })).returnCode === 0, 'ng_node_create value failed')
  assert(runtime.call('ng_output_add', JSON.stringify({ handle: handle2, nodeId: 10, outputId: 1 })).returnCode === 0, 'ng_output_add failed')
  assert(runtime.call('ng_node_create', JSON.stringify({ handle: handle2, nodeId: 20, kind: 2 })).returnCode === 0, 'ng_node_create code failed')
  assert(runtime.call('ng_input_add', JSON.stringify({ handle: handle2, nodeId: 20, inputId: 1 })).returnCode === 0, 'ng_input_add failed')
  assert(runtime.call('ng_output_add', JSON.stringify({ handle: handle2, nodeId: 20, outputId: 1 })).returnCode === 0, 'second ng_output_add failed')
  assert(runtime.call('ng_input_connect', JSON.stringify({ handle: handle2, nodeId: 20, inputId: 1, srcNodeId: 10, srcOutputId: 1 })).returnCode === 0, 'ng_input_connect failed')
  assert(runtime.call('ng_node_create', JSON.stringify({ handle: handle2, nodeId: 30, kind: 3 })).returnCode === 0, 'ng_node_create import failed')
  assert(runtime.call('ng_input_add', JSON.stringify({ handle: handle2, nodeId: 30, inputId: 331 })).returnCode === 0, 'import input add failed')
  assert(runtime.call('ng_output_add', JSON.stringify({ handle: handle2, nodeId: 30, outputId: 661 })).returnCode === 0, 'import output add failed')
  assert(runtime.call('ng_node_set_arg', JSON.stringify({ handle: handle2, nodeId: 30, argIndex: 0, type: 1, a: 99, b: 0 })).returnCode === 0, 'ng_node_set_arg failed')
  assert(runtime.call('ng_node_replace', JSON.stringify({ handle: handle2, nodeId: 30, kind: 3 })).returnCode === 0, 'ng_node_replace failed')
  assert(runtime.call('ng_input_add', JSON.stringify({ handle: handle2, nodeId: 30, inputId: 332 })).returnCode === 0, 'import input re-add failed')
  assert(runtime.call('ng_output_add', JSON.stringify({ handle: handle2, nodeId: 30, outputId: 662 })).returnCode === 0, 'import output re-add failed')
  assert(runtime.call('ng_input_disconnect', JSON.stringify({ handle: handle2, nodeId: 20, inputId: 1 })).returnCode === 0, 'ng_input_disconnect failed')
  assert(runtime.call('ng_node_delete', JSON.stringify({ handle: handle2, nodeId: 10 })).returnCode === 0, 'ng_node_delete failed')

  const ptr2 = runtime.call('ng_get_info_ptr', String(handle2))
  assert(ptr2.returnCode === 0, 'ng_get_info_ptr for second handle failed')
  const infoPtr2 = Number.parseInt(ptr2.text, 10)
  const nodeCount2 = view.getUint32(infoPtr2 + 12, true)
  assert(nodeCount2 === 2, `expected second graph node count 2, got ${nodeCount2}`)
  const firstNodeBase = infoPtr2 + 28
  const secondNodeBase = firstNodeBase + (32 + 32 * 12 + 32 * 4 + 32 * 12)
  assert(view.getUint32(firstNodeBase + 0, true) === 20, 'expected remaining first node id 20')
  assert(view.getUint32(firstNodeBase + 20, true) === 1, 'expected node 20 input count 1')
  assert(view.getUint32(firstNodeBase + 32 + 4, true) === 0, 'expected disconnected src node id 0 after delete')
  assert(view.getUint32(secondNodeBase + 0, true) === 30, 'expected remaining second node id 30')
  assert(view.getUint32(secondNodeBase + 20, true) === 1, 'expected import node input count 1 after replace/re-add')
  assert(view.getUint32(secondNodeBase + 24, true) === 1, 'expected import node output count 1 after replace/re-add')

  const saveSub = runtime.call('ng_graph_save', JSON.stringify({
    handle: handle2,
    name: 'sub',
    data: {
      nodes: [
        { id: 11, kind: 4, name: 'subA', x: 10, y: 20, inputs: [], outputs: [{ outputId: 1, name: 'value', value: 'fallback-a' }] },
        { id: 12, kind: 4, name: 'subB', x: 20, y: 30, inputs: [], outputs: [{ outputId: 1, name: 'value', value: 'fallback-b' }] },
        { id: 13, kind: 1, name: 'subGoal', x: 30, y: 40, inputs: [
          { inputId: 1, name: 'a', srcNodeId: 11, srcOutputId: 1 },
          { inputId: 2, name: 'b', srcNodeId: 12, srcOutputId: 1 }
        ], outputs: [] },
      ],
      edges: [
        { from: 11, fromOutputId: 1, to: 13, toInputId: 1, execState: 0 },
        { from: 12, fromOutputId: 1, to: 13, toInputId: 2, execState: 0 },
      ],
    },
  }))
  assert(saveSub.returnCode === 0, `ng_graph_save(sub) failed: ${saveSub.returnCode}`)

  const save = runtime.call('ng_graph_save', JSON.stringify({
    handle: handle2,
    name: 'custom',
    data: {
      nodes: [
        { id: 20, kind: 4, name: 'rootValue', x: 10, y: 20, inputs: [], outputs: [{ outputId: 1, name: 'out', value: 'root' }] },
        { id: 25, kind: 2, name: 'passCode', x: 20, y: 30, code: 'outputs[1] = inputs[1]', inputs: [{ inputId: 1, name: 'in', srcNodeId: 20, srcOutputId: 1 }], outputs: [{ outputId: 1, name: 'out', value: '' }] },
        { id: 40, kind: 1, name: 'goal', x: 90, y: 100, inputs: [{ inputId: 1, name: 'goalIn', srcNodeId: 25, srcOutputId: 1 }], outputs: [] },
      ],
      edges: [
        { from: 20, fromOutputId: 1, to: 25, toInputId: 1, execState: 0 },
        { from: 25, fromOutputId: 1, to: 40, toInputId: 1, execState: 0 },
      ],
    },
  }))
  assert(save.returnCode === 0, `ng_graph_save failed: ${save.returnCode}`)
  const saveJson = JSON.parse(save.text)
  assert(saveJson.saved === true, 'ng_graph_save should report saved=true')
  assert(runtime.graphRows.get('custom')?.nodeCount === 3, 'expected custom graph row to be saved from provided document data')

  const open = runtime.call('ng_graph_open', JSON.stringify({ name: 'custom' }))
  assert(open.returnCode === 0, `ng_graph_open failed: ${open.returnCode}`)
  const openJson = JSON.parse(open.text)
  assert(openJson.name === 'custom', 'ng_graph_open should report graph name')
  assert(Number(openJson.handle) > 0, 'ng_graph_open should return handle')
  assert(Array.isArray(openJson.data.nodes), 'ng_graph_open should echo raw graph data')
  const openPtr = runtime.call('ng_get_info_ptr', String(openJson.handle))
  assert(openPtr.returnCode === 0, 'ng_get_info_ptr for opened handle failed')
  const openInfoPtr = Number.parseInt(openPtr.text, 10)
  const openNodeCount = view.getUint32(openInfoPtr + 12, true)
  assert(openNodeCount === 3, `expected opened graph node count 3, got ${openNodeCount}`)

  const runSaved = runtime.call('ng_run', JSON.stringify({
    graph: 'custom',
    goal: 0,
    inputs: {
      entry: {
        mode: 'saved',
      },
    },
  }))
  assert(runSaved.returnCode === 0, `ng_run(saved graph) failed: ${runSaved.returnCode}`)
  const runSavedJson = JSON.parse(runSaved.text)
  assert(runSavedJson.goalCount === 1, 'saved graph run should find one goal')
  assert(runSavedJson.goals[0].goalNodeId === 40, 'saved graph run should target goal node 40')
  assert(runSavedJson.goals[0].payload.result === 'goal-40', 'saved graph run should use real goal id in result payload')
  assert(runSavedJson.goals[0].payload.inputs.entry.mode === 'saved', 'saved graph run should echo request inputs')
  assert(runSavedJson.goals[0].payload.goalInputs.goalIn === 'root', 'saved graph run should resolve code-node output into goal input')

  console.log('ng2 e2e ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
