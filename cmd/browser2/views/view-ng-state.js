const NG_KIND = new Set([1, 2, 3, 4])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function requireNumber(value, label) {
  assert(typeof value === 'number' && Number.isFinite(value), `view-ng graph ${label} must be a finite number`)
  return value
}

function requireString(value, label) {
  assert(typeof value === 'string', `view-ng graph ${label} must be a string`)
  return value
}

function cloneInput(input) {
  return {
    id: requireNumber(input.id, 'input.id'),
    name: requireString(input.name, 'input.name'),
    srcNodeId: requireNumber(input.srcNodeId, 'input.srcNodeId'),
    srcOutputId: requireNumber(input.srcOutputId, 'input.srcOutputId'),
  }
}

function cloneOutput(output) {
  return {
    id: requireNumber(output.id, 'output.id'),
    name: requireString(output.name, 'output.name'),
    value: requireString(output.value, 'output.value'),
  }
}

function cloneNode(node) {
  assert(node && typeof node === 'object' && !Array.isArray(node), 'view-ng graph node must be an object')
  const id = requireNumber(node.id, 'node.id')
  const kind = requireNumber(node.kind, `node ${id}.kind`)
  assert(NG_KIND.has(kind), `view-ng graph node ${id} kind must be one of 1, 2, 3, 4`)
  assert(Array.isArray(node.inputs), `view-ng graph node ${id}.inputs must be an array`)
  assert(Array.isArray(node.outputs), `view-ng graph node ${id}.outputs must be an array`)
  return {
    id,
    kind,
    x: requireNumber(node.x, `node ${id}.x`),
    y: requireNumber(node.y, `node ${id}.y`),
    name: requireString(node.name, `node ${id}.name`),
    codePath: requireString(node.codePath, `node ${id}.codePath`),
    graphId: requireNumber(node.graphId, `node ${id}.graphId`),
    graphName: requireString(node.graphName, `node ${id}.graphName`),
    inputs: node.inputs.map((input, index) => cloneInput(input, `node ${id}.inputs[${index}]`)),
    outputs: node.outputs.map((output, index) => cloneOutput(output, `node ${id}.outputs[${index}]`)),
  }
}

export function cloneNgGraph(graph) {
  assert(Array.isArray(graph), 'view-ng graph must be a raw node array')
  const nodes = graph.map(cloneNode)
  const ids = new Set()
  for (const node of nodes) {
    assert(node.id > 0, `view-ng graph node id must be positive: ${node.id}`)
    assert(!ids.has(node.id), `view-ng graph has duplicate node id ${node.id}`)
    ids.add(node.id)
  }
  for (const node of nodes) {
    const inputIds = new Set()
    for (const input of node.inputs) {
      assert(input.id > 0, `view-ng graph node ${node.id} input id must be positive`)
      assert(!inputIds.has(input.id), `view-ng graph node ${node.id} has duplicate input id ${input.id}`)
      inputIds.add(input.id)
      if (input.srcNodeId !== 0) assert(ids.has(input.srcNodeId), `view-ng graph input ${node.id}.${input.id} references missing source node ${input.srcNodeId}`)
    }
    const outputIds = new Set()
    for (const output of node.outputs) {
      assert(output.id > 0, `view-ng graph node ${node.id} output id must be positive`)
      assert(!outputIds.has(output.id), `view-ng graph node ${node.id} has duplicate output id ${output.id}`)
      outputIds.add(output.id)
    }
  }
  return nodes
}

export function graphToRenderSnapshot(graph) {
  const nodes = cloneNgGraph(graph).map((node) => ({
    id: node.id,
    kind: node.kind,
    execState: 0,
    inputCount: node.inputs.length,
    outputCount: node.outputs.length,
    inputs: node.inputs.map((input) => ({
      inputId: input.id,
      srcNodeId: input.srcNodeId,
      srcOutputId: input.srcOutputId,
    })),
    outputs: node.outputs.map((output) => ({ outputId: output.id })),
  }))
  const edges = []
  for (const node of nodes) {
    for (const input of node.inputs) {
      if (input.srcNodeId === 0) continue
      edges.push({
        from: input.srcNodeId,
        fromOutputId: input.srcOutputId,
        to: node.id,
        toInputId: input.inputId,
        execState: 0,
      })
    }
  }
  return { nodes, edges }
}
