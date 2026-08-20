import { NodeGraph } from "./node-graph.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export const NG_NODE_KINDS = Object.freeze({
  GOAL: 1,
  CODE: 2,
  GROUP: 3,
  VALUE: 4,
  GRAPH_INPUT: 5,
  GRAPH_OUTPUT: 6,
  FOR_EACH: 7,
  FOR_EACH_INPUT: 8,
  ITERATION_CONTROL: 9,
  FOR_EACH_SHARED_INPUT: 10,
  FOR_EACH_GET_VAR: 11,
  FOR_EACH_SET_VAR: 12,
})

export const NG_FOR_EACH_INPUT_OUTPUTS = Object.freeze([
  Object.freeze({ id: 1, name: "Item" }),
  Object.freeze({ id: 2, name: "Index" }),
  Object.freeze({ id: 3, name: "Array" }),
])

export const NG_FOR_EACH_SHARED_INPUT_OUTPUT = Object.freeze({ id: 1, name: "Value" })

export const NG_ITERATION_CONTROL_INPUTS = Object.freeze([
  Object.freeze({ id: 1, name: "Skip" }),
  Object.freeze({ id: 2, name: "Break" }),
])

export const NG_GROUP_GRAPH_FORMAT = "gams-group-graph"
export const NG_GROUP_GRAPH_VERSION = 1

const VALID_KINDS = new Set(Object.values(NG_NODE_KINDS))

export function ngInputPortId(id) { return `input:${id}` }
export function ngOutputPortId(id) { return `output:${id}` }

export function normalizeNgGroupPath(path) {
  assert(typeof path === "string" && path.length > 0, "view-ng linked Group path must be a non-empty string")
  const slashPath = path.replaceAll("\\", "/")
  assert(!slashPath.startsWith("/") && !/^[A-Za-z]:\//.test(slashPath), `view-ng linked Group path must be project-relative: ${path}`)
  const parts = []
  for (const part of slashPath.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      assert(parts.length > 0, `view-ng linked Group path escapes the project: ${path}`)
      parts.pop()
    } else {
      assert(!part.includes("\0"), "view-ng linked Group path contains a null byte")
      parts.push(part)
    }
  }
  assert(parts.length > 0, `view-ng linked Group path must identify a document: ${path}`)
  return parts.join("/")
}

function cloneInput(input, nodeId) {
  for (const key of ["id", "srcNodeId", "srcOutputId"])
    assert(typeof input[key] === "number" && Number.isFinite(input[key]), `view-ng graph input ${nodeId}.${key} must be a finite number`)
  assert(typeof input.name === "string", `view-ng graph input ${nodeId}.${input.id}.name must be a string`)
  return { id: input.id, name: input.name, srcNodeId: input.srcNodeId, srcOutputId: input.srcOutputId }
}

function cloneOutput(output, nodeId) {
  assert(typeof output.id === "number" && Number.isFinite(output.id), `view-ng graph output ${nodeId}.id must be a finite number`)
  assert(typeof output.name === "string", `view-ng graph output ${nodeId}.${output.id}.name must be a string`)
  assert(output.value === null || typeof output.value === "string", `view-ng graph output ${nodeId}.${output.id}.value must be a string or null`)
  const hasStateSource = output.stateNodeId !== undefined || output.statePortId !== undefined
  if (hasStateSource) {
    assert(typeof output.stateNodeId === "number" && Number.isFinite(output.stateNodeId), `view-ng graph output ${nodeId}.${output.id}.stateNodeId must be a finite number`)
    assert(typeof output.statePortId === "number" && Number.isFinite(output.statePortId), `view-ng graph output ${nodeId}.${output.id}.statePortId must be a finite number`)
  }
  return { id: output.id, name: output.name, value: output.value, ...(hasStateSource ? { stateNodeId: output.stateNodeId, statePortId: output.statePortId } : {}) }
}

function groupStorage(raw, label) {
  const storage = raw.storage ?? { mode: "inline" }
  assert(storage && typeof storage === "object" && !Array.isArray(storage), `${label}.storage must be an object`)
  assert(storage.mode === "inline" || storage.mode === "linked", `${label}.storage.mode must be inline or linked`)
  if (storage.mode === "inline") {
    assert(Array.isArray(raw.childGraph), `${label}.childGraph must be a raw node array`)
    return { mode: "inline" }
  }
  assert(raw.childGraph === undefined, `${label} linked storage must not persist childGraph`)
  return { mode: "linked", path: normalizeNgGroupPath(storage.path) }
}

function cloneLevel(graph, globalIds, label, { allowExternalSources = false, resolveLinked, ownerKind = null, insideForEach = false } = {}) {
  assert(Array.isArray(graph), `${label} must be a raw node array`)
  const localIds = new Set()
  const nodes = graph.map((raw) => {
    assert(raw && typeof raw === "object" && !Array.isArray(raw), `${label} node must be an object`)
    for (const key of ["id", "kind", "x", "y"])
      assert(typeof raw[key] === "number" && Number.isFinite(raw[key]), `${label} node ${key} must be a finite number`)
    assert(typeof raw.name === "string", `${label} node ${raw.id}.name must be a string`)
    assert(raw.id > 0, `${label} node id must be positive: ${raw.id}`)
    assert(!globalIds.has(raw.id), `view-ng graph has duplicate document node id ${raw.id}`)
    assert(VALID_KINDS.has(raw.kind), `${label} node ${raw.id} has unknown kind ${raw.kind}`)
    if (raw.kind === NG_NODE_KINDS.CODE)
      assert(typeof raw.codePath === "string", `${label} Code Node ${raw.id}.codePath must be a string`)
    else
      assert(raw.codePath === undefined || raw.codePath === "", `${label} non-Code Node ${raw.id} must not have codePath`)
    assert(Array.isArray(raw.inputs), `${label} node ${raw.id}.inputs must be an array`)
    assert(Array.isArray(raw.outputs), `${label} node ${raw.id}.outputs must be an array`)
    globalIds.add(raw.id)
    localIds.add(raw.id)
    const inputs = raw.inputs.map((input) => cloneInput(input, raw.id))
    const outputs = raw.outputs.map((output) => cloneOutput(output, raw.id))
    const inputIds = new Set()
    for (const input of inputs) {
      assert(input.id > 0, `${label} node ${raw.id} input id must be positive`)
      assert(!inputIds.has(input.id), `${label} node ${raw.id} has duplicate input id ${input.id}`)
      inputIds.add(input.id)
    }
    const outputIds = new Set()
    for (const output of outputs) {
      assert(output.id > 0, `${label} node ${raw.id} output id must be positive`)
      assert(!outputIds.has(output.id), `${label} node ${raw.id} has duplicate output id ${output.id}`)
      outputIds.add(output.id)
      assert(output.stateNodeId === undefined || raw.kind === NG_NODE_KINDS.FOR_EACH, `${label} non-For Each Node ${raw.id} output ${output.id} must not reference Iteration State`)
    }
    if (raw.kind === NG_NODE_KINDS.GRAPH_INPUT) {
      assert(ownerKind === null || ownerKind === NG_NODE_KINDS.GROUP, `Graph Input ${raw.id} must be a direct child of a Group Node`)
      assert(inputs.length === 0 && outputs.length === 1, `Graph Input ${raw.id} requires exactly one output and no inputs`)
    }
    if (raw.kind === NG_NODE_KINDS.GRAPH_OUTPUT) {
      assert(ownerKind === null || ownerKind === NG_NODE_KINDS.GROUP || ownerKind === NG_NODE_KINDS.FOR_EACH, `Graph Output ${raw.id} must be a direct child of a Group or For Each Node`)
      assert(inputs.length === 1 && outputs.length === 0, `Graph Output ${raw.id} requires exactly one input and no outputs`)
    }
    if (raw.kind === NG_NODE_KINDS.FOR_EACH_INPUT) {
      assert(ownerKind === null || ownerKind === NG_NODE_KINDS.FOR_EACH, `For Each Input ${raw.id} must be a direct child of a For Each Node`)
      assert(inputs.length === 0, `For Each Input ${raw.id} must not have inputs`)
      assert(outputs.length === NG_FOR_EACH_INPUT_OUTPUTS.length, `For Each Input ${raw.id} requires Item, Index, and Array outputs`)
      NG_FOR_EACH_INPUT_OUTPUTS.forEach((expected, index) => {
        assert(outputs[index].id === expected.id && outputs[index].name === expected.name && outputs[index].value === null, `For Each Input ${raw.id} output ${index + 1} must be ${expected.name}`)
      })
    }
    if (raw.kind === NG_NODE_KINDS.FOR_EACH_SHARED_INPUT) {
      assert(ownerKind === null || ownerKind === NG_NODE_KINDS.FOR_EACH, `Shared Input ${raw.id} must be a direct child of a For Each Node`)
      assert(inputs.length === 0 && outputs.length === 1, `Shared Input ${raw.id} requires exactly one output and no inputs`)
      const output = outputs[0]
      assert(output.id === NG_FOR_EACH_SHARED_INPUT_OUTPUT.id && output.name === NG_FOR_EACH_SHARED_INPUT_OUTPUT.name && output.value === null, `Shared Input ${raw.id} output must be Value`)
    }
    if (raw.kind === NG_NODE_KINDS.FOR_EACH_GET_VAR) {
      assert(ownerKind === null || ownerKind === NG_NODE_KINDS.FOR_EACH, `GetVar ${raw.id} must be a direct child of a For Each Node`)
      assert(inputs.length === outputs.length, `GetVar ${raw.id} requires one paired output per input`)
      inputs.forEach((input, index) => {
        const output = outputs[index]
        assert(input.name.length > 0, `GetVar ${raw.id} input ${input.id} requires a variable name`)
        assert(output.id === input.id && output.name === input.name && output.value === null, `GetVar ${raw.id} input ${input.id} must have a paired output with the same id and name`)
      })
    }
    if (raw.kind === NG_NODE_KINDS.FOR_EACH_SET_VAR) {
      assert(ownerKind === null || ownerKind === NG_NODE_KINDS.FOR_EACH, `SetVar ${raw.id} must be a direct child of a For Each Node`)
      assert(outputs.length === 0, `SetVar ${raw.id} must not have outputs`)
      inputs.forEach((input) => assert(input.name.length > 0, `SetVar ${raw.id} input ${input.id} requires a variable name`))
    }
    if (raw.kind === NG_NODE_KINDS.ITERATION_CONTROL) {
      assert(ownerKind === null || ownerKind === NG_NODE_KINDS.FOR_EACH, `Iteration Control ${raw.id} must be a direct child of a For Each Node`)
      assert(outputs.length === 0, `Iteration Control ${raw.id} must not have outputs`)
      assert(inputs.length === NG_ITERATION_CONTROL_INPUTS.length, `Iteration Control ${raw.id} requires Skip and Break inputs`)
      NG_ITERATION_CONTROL_INPUTS.forEach((expected, index) => {
        assert(inputs[index].id === expected.id && inputs[index].name === expected.name, `Iteration Control ${raw.id} input ${index + 1} must be ${expected.name}`)
      })
    }
    if (insideForEach)
      assert(raw.kind !== NG_NODE_KINDS.GOAL, `Goal Node ${raw.id} cannot be inside a For Each Node`)
    const result = {
      id: raw.id, kind: raw.kind, x: raw.x, y: raw.y, name: raw.name,
      ...(raw.kind === NG_NODE_KINDS.CODE ? { codePath: raw.codePath } : {}),
      inputs, outputs,
    }
    if (raw.kind === NG_NODE_KINDS.GROUP) {
      result.storage = groupStorage(raw, `${label} Group Node ${raw.id}`)
      if (result.storage.mode === "inline")
        result.childGraph = cloneLevel(raw.childGraph, globalIds, `view-ng Group Node ${raw.id}.childGraph`, { resolveLinked, ownerKind: NG_NODE_KINDS.GROUP, insideForEach })
    }
    if (raw.kind === NG_NODE_KINDS.FOR_EACH) {
      assert(raw.storage === undefined, `For Each Node ${raw.id} supports inline storage only`)
      assert(Array.isArray(raw.childGraph), `For Each Node ${raw.id}.childGraph must be a raw node array`)
      result.childGraph = cloneLevel(raw.childGraph, globalIds, `view-ng For Each Node ${raw.id}.childGraph`, { resolveLinked, ownerKind: NG_NODE_KINDS.FOR_EACH, insideForEach: true })
      assert(result.childGraph.some((node) => node.kind === NG_NODE_KINDS.FOR_EACH_INPUT), `For Each Node ${raw.id} requires at least one For Each Input`)
      assert(result.childGraph.filter((node) => node.kind === NG_NODE_KINDS.ITERATION_CONTROL).length <= 1, `For Each Node ${raw.id} allows at most one Iteration Control`)
    }
    return result
  })
  for (const node of nodes) {
    if (node.kind === NG_NODE_KINDS.GROUP && (node.storage.mode === "inline" || resolveLinked))
      syncNgGroupBoundary(node, nodes, { resolveLinked })
    if (node.kind === NG_NODE_KINDS.FOR_EACH) syncNgForEachBoundary(node, nodes)
  }
  for (const node of nodes) for (const input of node.inputs)
    assert(allowExternalSources || input.srcNodeId === 0 || localIds.has(input.srcNodeId), `${label} input ${node.id}.${input.id} references node ${input.srcNodeId} outside its graph level`)
  return nodes
}

function graphFromResolvedDocument(value, path) {
  if (Array.isArray(value)) return cloneNgGraphFragment(value, { ownerKind: NG_NODE_KINDS.GROUP })
  try {
    return parseNgGroupGraphDocument(value)
  } catch (error) {
    throw new Error(`view-ng failed to resolve linked Group ${path}: ${error.message}`)
  }
}

function resolverFrom(options) {
  return typeof options === "function" ? options : options?.resolveLinked
}

function resolvedLinkedValue(resolveLinked, path) {
  assert(typeof resolveLinked === "function", `view-ng linked Group ${path} requires resolveLinked(path)`)
  const value = resolveLinked(path)
  assert(value !== undefined && value !== null, `view-ng linked Group resolver returned no document for ${path}`)
  return value
}

function resolveLinkedDocument(resolveLinked, path) {
  return graphFromResolvedDocument(resolvedLinkedValue(resolveLinked, path), path)
}

function resolveLinkedDocumentReference(resolveLinked, path) {
  const value = resolvedLinkedValue(resolveLinked, path)
  return Array.isArray(value) ? value : graphFromResolvedDocument(value, path)
}

export function parseNgGroupGraphDocument(document) {
  const raw = typeof document === "string" ? JSON.parse(document) : document
  assert(raw && typeof raw === "object" && !Array.isArray(raw), "view-ng Group graph document must be an object")
  assert(raw.format === NG_GROUP_GRAPH_FORMAT, `view-ng Group graph document format must be ${NG_GROUP_GRAPH_FORMAT}`)
  assert(raw.version === NG_GROUP_GRAPH_VERSION, `view-ng Group graph document version must be ${NG_GROUP_GRAPH_VERSION}`)
  return cloneNgGraphFragment(raw.nodes, { ownerKind: NG_NODE_KINDS.GROUP })
}

export function serializeNgGroupGraphDocument(graph) {
  return { format: NG_GROUP_GRAPH_FORMAT, version: NG_GROUP_GRAPH_VERSION, nodes: cloneNgGraphFragment(graph, { ownerKind: NG_NODE_KINDS.GROUP }) }
}

export function cloneNgGraphFragment(graph, options = {}) {
  return cloneLevel(structuredClone(graph), new Set(), "view-ng graph fragment", { resolveLinked: resolverFrom(options), ownerKind: options.ownerKind ?? null, insideForEach: options.insideForEach ?? false })
}

export function cloneNgGraph(graph, options = {}) {
  const cloned = cloneLevel(structuredClone(graph), new Set(), "view-ng graph", { resolveLinked: resolverFrom(options) })
  for (const node of cloned)
    assert(![NG_NODE_KINDS.GRAPH_INPUT, NG_NODE_KINDS.GRAPH_OUTPUT, NG_NODE_KINDS.FOR_EACH_INPUT, NG_NODE_KINDS.FOR_EACH_SHARED_INPUT, NG_NODE_KINDS.FOR_EACH_GET_VAR, NG_NODE_KINDS.FOR_EACH_SET_VAR, NG_NODE_KINDS.ITERATION_CONTROL].includes(node.kind), `root graph cannot contain ${kindName(node.kind)} ${node.id}`)
  return cloned
}

export function visitNgNodes(graph, visitor, pathOrOptions = [], maybeOptions = {}) {
  const initialPath = Array.isArray(pathOrOptions) ? pathOrOptions : []
  const options = Array.isArray(pathOrOptions) ? maybeOptions : pathOrOptions
  const resolveLinked = resolverFrom(options)
  const visitLevel = (level, path, linkedStack) => {
    for (const node of level) {
      visitor(node, path)
      if (node.kind === NG_NODE_KINDS.FOR_EACH) {
        visitLevel(node.childGraph, [...path, node.id], linkedStack)
      } else if (node.kind === NG_NODE_KINDS.GROUP && (node.storage?.mode ?? "inline") === "inline") {
        visitLevel(node.childGraph, [...path, node.id], linkedStack)
      } else if (node.kind === NG_NODE_KINDS.GROUP && resolveLinked) {
        const linkedPath = normalizeNgGroupPath(node.storage.path)
        assert(!linkedStack.includes(linkedPath), `view-ng linked Group alias cycle: ${[...linkedStack, linkedPath].join(" -> ")}`)
        visitLevel(resolveLinkedDocument(resolveLinked, linkedPath), [...path, node.id], [...linkedStack, linkedPath])
      }
    }
  }
  visitLevel(graph, initialPath, [])
}

export function nextNgNodeId(graph, options = {}) {
  let maximum = 0
  visitNgNodes(graph, (node) => { maximum = Math.max(maximum, node.id) }, options)
  return maximum + 1
}

export function cloneNgNodesWithNewIds(nodes, firstId) {
  const cloned = cloneLevel(structuredClone(nodes), new Set(), "view-ng clipboard graph", { allowExternalSources: true })
  const idMap = new Map()
  let nextId = firstId
  visitNgNodes(cloned, (node) => idMap.set(node.id, nextId++))
  const remapLevel = (level) => level.map((node) => {
    const originalId = node.id
    const remapSource = (input) => ({
      ...input,
      srcNodeId: input.srcNodeId && idMap.has(input.srcNodeId) ? idMap.get(input.srcNodeId) : 0,
      srcOutputId: input.srcNodeId && idMap.has(input.srcNodeId) ? input.srcOutputId : 0,
    })
    const result = { ...node, id: idMap.get(originalId), inputs: node.inputs.map(remapSource), outputs: node.outputs.map((output) => ({ ...output })) }
    if (node.kind === NG_NODE_KINDS.GROUP && node.storage.mode === "inline") {
      result.childGraph = remapLevel(node.childGraph)
      result.inputs = result.inputs.map((input) => ({ ...input, id: idMap.get(input.id) }))
      result.outputs = result.outputs.map((output) => ({ ...output, id: idMap.get(output.id) }))
    }
    if (node.kind === NG_NODE_KINDS.FOR_EACH) {
      result.childGraph = remapLevel(node.childGraph)
      result.inputs = result.inputs.map((input) => ({ ...input, id: idMap.get(input.id) }))
      result.outputs = result.outputs.map((output) => output.stateNodeId === undefined
        ? { ...output, id: idMap.get(output.id) }
        : { ...output, stateNodeId: idMap.get(output.stateNodeId) })
      syncNgForEachBoundary(result)
    }
    return result
  })
  return { nodes: remapLevel(cloned), nextId, idMap }
}

export function findNgChildGraphPath(graph, childGraphPath, options = {}) {
  const resolveLinked = resolverFrom(options)
  let level = graph
  const owners = []
  for (const id of childGraphPath) {
    const owner = level.find((node) => node.id === id)
    assert(owner && (owner.kind === NG_NODE_KINDS.GROUP || owner.kind === NG_NODE_KINDS.FOR_EACH), `view-ng missing child-graph owner Node ${id}`)
    owners.push(owner)
    if (owner.kind === NG_NODE_KINDS.FOR_EACH || (owner.storage?.mode ?? "inline") === "inline") level = owner.childGraph
    else level = resolveLinkedDocumentReference(resolveLinked, normalizeNgGroupPath(owner.storage.path))
  }
  return { graph: level, owners }
}

export const findNgGroupPath = findNgChildGraphPath

export function syncNgForEachBoundary(forEach, parentGraph = null) {
  assert(forEach.kind === NG_NODE_KINDS.FOR_EACH, `view-ng node ${forEach.id} must be a For Each Node`)
  const previousInputs = new Map(forEach.inputs.map((port) => [port.id, port]))
  forEach.inputs = forEach.childGraph.filter((node) => node.kind === NG_NODE_KINDS.FOR_EACH_INPUT || node.kind === NG_NODE_KINDS.FOR_EACH_SHARED_INPUT).map((node) => ({
    id: node.id, name: node.name || `input ${node.id}`,
    srcNodeId: previousInputs.get(node.id)?.srcNodeId || 0,
    srcOutputId: previousInputs.get(node.id)?.srcOutputId || 0,
  }))

  const previousStateOutputs = new Map(forEach.outputs.filter((output) => output.stateNodeId !== undefined).map((output) => [`${output.stateNodeId}:${output.statePortId}`, output]))
  const graphOutputs = forEach.childGraph.filter((node) => node.kind === NG_NODE_KINDS.GRAPH_OUTPUT).map((node) => ({ id: node.id, name: node.name || `output ${node.id}`, value: null }))
  const usedOutputIds = new Set(graphOutputs.map((output) => output.id))
  let nextOutputId = Math.max(0, ...forEach.outputs.map((output) => output.id), ...graphOutputs.map((output) => output.id)) + 1
  const stateOutputs = []
  const retainedStateKeys = new Set()
  const remappedStateIds = new Map()
  for (const getVar of forEach.childGraph.filter((node) => node.kind === NG_NODE_KINDS.FOR_EACH_GET_VAR)) for (const output of getVar.outputs) {
    const key = `${getVar.id}:${output.id}`
    retainedStateKeys.add(key)
    const previous = previousStateOutputs.get(key)
    let id = previous?.id
    if (id === undefined || usedOutputIds.has(id)) {
      while (usedOutputIds.has(nextOutputId)) nextOutputId += 1
      id = nextOutputId++
    }
    usedOutputIds.add(id)
    if (previous && previous.id !== id) remappedStateIds.set(previous.id, id)
    stateOutputs.push({ id, name: output.name, value: null, stateNodeId: getVar.id, statePortId: output.id })
  }
  const removedStateIds = new Set([...previousStateOutputs].filter(([key]) => !retainedStateKeys.has(key)).map(([, output]) => output.id))
  forEach.outputs = [...graphOutputs, ...stateOutputs]
  if (parentGraph) {
    const outputIds = new Set(forEach.outputs.map((output) => output.id))
    for (const node of parentGraph) for (const input of node.inputs) if (input.srcNodeId === forEach.id) {
      if (remappedStateIds.has(input.srcOutputId)) input.srcOutputId = remappedStateIds.get(input.srcOutputId)
      else if (removedStateIds.has(input.srcOutputId) || !outputIds.has(input.srcOutputId)) {
        input.srcNodeId = 0
        input.srcOutputId = 0
      }
    }
  }
  return forEach
}

export function syncNgGroupBoundary(group, parentGraph = null, options = {}) {
  const resolveLinked = resolverFrom(options)
  assert(group.kind === NG_NODE_KINDS.GROUP, `view-ng node ${group.id} must be a Group Node`)
  const storage = group.storage ?? { mode: "inline" }
  const childGraph = storage.mode === "inline" ? group.childGraph : resolveLinkedDocument(resolveLinked, normalizeNgGroupPath(storage.path))
  const previousInputs = new Map(group.inputs.map((port) => [port.id, port]))
  group.inputs = childGraph.filter((node) => node.kind === NG_NODE_KINDS.GRAPH_INPUT).map((node) => ({
    id: node.id, name: node.name || `input ${node.id}`,
    srcNodeId: previousInputs.get(node.id)?.srcNodeId || 0,
    srcOutputId: previousInputs.get(node.id)?.srcOutputId || 0,
  }))
  group.outputs = childGraph.filter((node) => node.kind === NG_NODE_KINDS.GRAPH_OUTPUT).map((node) => ({ id: node.id, name: node.name || `output ${node.id}`, value: null }))
  if (parentGraph) {
    const outputIds = new Set(group.outputs.map((output) => output.id))
    for (const node of parentGraph) for (const input of node.inputs) if (input.srcNodeId === group.id && !outputIds.has(input.srcOutputId)) {
      input.srcNodeId = 0
      input.srcOutputId = 0
    }
  }
  return group
}

function kindName(kind) {
  if (kind === NG_NODE_KINDS.GOAL) return "goal"
  if (kind === NG_NODE_KINDS.CODE) return "code"
  if (kind === NG_NODE_KINDS.GROUP) return "group"
  if (kind === NG_NODE_KINDS.VALUE) return "value"
  if (kind === NG_NODE_KINDS.GRAPH_INPUT) return "graph-input"
  if (kind === NG_NODE_KINDS.GRAPH_OUTPUT) return "graph-output"
  if (kind === NG_NODE_KINDS.FOR_EACH) return "for-each"
  if (kind === NG_NODE_KINDS.FOR_EACH_INPUT) return "for-each-input"
  if (kind === NG_NODE_KINDS.FOR_EACH_SHARED_INPUT) return "for-each-shared-input"
  if (kind === NG_NODE_KINDS.FOR_EACH_GET_VAR) return "for-each-get-var"
  if (kind === NG_NODE_KINDS.FOR_EACH_SET_VAR) return "for-each-set-var"
  if (kind === NG_NODE_KINDS.ITERATION_CONTROL) return "iteration-control"
  throw new Error(`view-ng unknown node kind ${kind}`)
}

export function projectNgGraph(rawGraph) {
  const raw = cloneLevel(structuredClone(rawGraph), new Set(), "view-ng active graph")
  const missingOutputs = new Map(raw.map((node) => [node.id, new Set()]))
  for (const node of raw) for (const input of node.inputs) {
    if (!input.srcNodeId) continue
    const source = raw.find((candidate) => candidate.id === input.srcNodeId)
    if (!source.outputs.some((output) => output.id === input.srcOutputId)) missingOutputs.get(source.id).add(input.srcOutputId)
  }
  const nodes = raw.map((node) => ({
    id: node.id, kind: kindName(node.kind), name: node.name || `${kindName(node.kind)} #${node.id}`,
    subtitle: kindName(node.kind), x: node.x, y: node.y, ng: structuredClone(node), execState: "idle",
    ports: [
      ...node.inputs.map((input, index) => ({ id: ngInputPortId(input.id), name: input.name || `input ${index + 1}`, direction: "input", dataType: "ng-value", maxConnections: 1, ngPortId: input.id })),
      ...node.outputs.map((output, index) => ({ id: ngOutputPortId(output.id), name: node.kind === NG_NODE_KINDS.VALUE ? String(output.value ?? "") : output.name || `output ${index + 1}`, direction: "output", dataType: "ng-value", maxConnections: null, ngPortId: output.id })),
      ...[...missingOutputs.get(node.id)].map((id) => ({ id: ngOutputPortId(id), name: `output ${id}`, direction: "output", dataType: "ng-value", maxConnections: null, ngPortId: id, synthetic: true })),
    ],
  }))
  let edgeId = 1
  const edges = []
  for (const node of raw) for (const input of node.inputs) if (input.srcNodeId) edges.push({
    id: edgeId++, from: { nodeId: input.srcNodeId, portId: ngOutputPortId(input.srcOutputId) },
    to: { nodeId: node.id, portId: ngInputPortId(input.id) }, execState: "idle",
  })
  return { nodes, edges }
}

export function createNgNodeGraph(rawGraph) {
  return new NodeGraph({ graph: projectNgGraph(rawGraph), allowCycles: true })
}

export function serializeNgNodeGraph(graph) {
  assert(graph instanceof NodeGraph, "view-ng serialization requires a NodeGraph")
  const incoming = new Map(graph.graph.edges.map((edge) => [`${edge.to.nodeId}:${edge.to.portId}`, edge.from]))
  return graph.graph.nodes.map((node) => {
    const result = structuredClone(node.ng)
    result.x = node.x
    result.y = node.y
    result.inputs = result.inputs.map((input) => {
      const source = incoming.get(`${node.id}:${ngInputPortId(input.id)}`)
      return { ...input, srcNodeId: source ? Number(source.nodeId) : 0, srcOutputId: source ? Number(String(source.portId).slice("output:".length)) : 0 }
    })
    return result
  })
}

function sourceKey(contextId, source) { return `${contextId}:${source.srcNodeId}:${source.srcOutputId}` }

export function flattenNgGraphWithLocations(graph, options = {}) {
  const resolveLinked = resolverFrom(options)
  const document = cloneNgGraph(graph, { resolveLinked })
  const aliases = new Map()
  const rootRecords = []
  const executionIdBySource = new Map()
  const nodeKindBySource = new Map()
  const forEachStateOutputIdBySource = new Map()
  const locations = new Map()
  let nextContextId = 1
  let nextExecutionId = nextNgNodeId(document, { resolveLinked })
  const rootContext = { id: 0, documentPath: null, linked: false }

  const addRecord = (node, context, destination, occurrencePath) => {
    const executionId = context.linked ? nextExecutionId++ : node.id
    executionIdBySource.set(`${context.id}:${node.id}`, executionId)
    nodeKindBySource.set(`${context.id}:${node.id}`, node.kind)
    if (node.kind === NG_NODE_KINDS.FOR_EACH) for (const output of node.outputs) if (output.stateNodeId !== undefined)
      forEachStateOutputIdBySource.set(`${context.id}:${node.id}:${output.id}`, context.linked ? nextExecutionId++ : output.id)
    const record = { node: structuredClone(node), context, executionId, children: null }
    destination.push(record)
    locations.set(executionId, {
      executionNodeId: executionId,
      sourceNodeId: node.id,
      documentPath: context.documentPath,
      groupPath: [...occurrencePath],
    })
    return record
  }

  const addLevel = (level, context, owner = null, occurrencePath = [], linkedStack = [], destination = rootRecords) => {
    for (const node of level) {
      if (node.kind === NG_NODE_KINDS.GRAPH_INPUT && owner?.kind === NG_NODE_KINDS.GROUP) {
        const parentInput = owner.node.inputs.find((input) => input.id === node.id)
        assert(parentInput, `Group Node ${owner.node.id} missing input for Graph Input ${node.id}`)
        aliases.set(sourceKey(context.id, { srcNodeId: node.id, srcOutputId: node.outputs[0].id }), parentInput.srcNodeId ? { contextId: owner.context.id, srcNodeId: parentInput.srcNodeId, srcOutputId: parentInput.srcOutputId } : null)
      } else if (node.kind === NG_NODE_KINDS.GRAPH_OUTPUT && owner?.kind === NG_NODE_KINDS.GROUP) {
        const input = node.inputs[0]
        aliases.set(sourceKey(owner.context.id, { srcNodeId: owner.node.id, srcOutputId: node.id }), input.srcNodeId ? { contextId: context.id, srcNodeId: input.srcNodeId, srcOutputId: input.srcOutputId } : null)
      } else if (node.kind === NG_NODE_KINDS.GROUP) {
        const childOccurrencePath = [...occurrencePath, node.id]
        if (node.storage.mode === "inline") {
          addLevel(node.childGraph, context, { kind: node.kind, node, context }, childOccurrencePath, linkedStack, destination)
        } else {
          const path = node.storage.path
          assert(resolveLinked, `view-ng linked Group ${path} requires resolveLinked(path)`)
          assert(!linkedStack.includes(path), `view-ng linked Group alias cycle: ${[...linkedStack, path].join(" -> ")}`)
          const childContext = { id: nextContextId++, documentPath: path, linked: true }
          const child = cloneNgGraphFragment(resolveLinkedDocument(resolveLinked, path), { resolveLinked })
          addLevel(child, childContext, { kind: node.kind, node, context }, childOccurrencePath, [...linkedStack, path], destination)
        }
      } else {
        const record = addRecord(node, context, destination, occurrencePath)
        if (node.kind === NG_NODE_KINDS.FOR_EACH) {
          record.children = []
          addLevel(node.childGraph, context, { kind: node.kind, node, context }, [...occurrencePath, node.id], linkedStack, record.children)
        }
      }
    }
  }
  addLevel(document, rootContext)

  const resolve = (contextId, source) => {
    const seen = new Set()
    let current = { contextId, srcNodeId: source.srcNodeId, srcOutputId: source.srcOutputId }
    while (current && aliases.has(sourceKey(current.contextId, current))) {
      const key = sourceKey(current.contextId, current)
      assert(!seen.has(key), `view-ng Group Node boundary alias cycle at ${key}`)
      seen.add(key)
      current = aliases.get(key)
    }
    return current
  }

  const materialize = (records) => records.map(({ node, context, executionId, children }) => {
    const sourceNodeId = node.id
    node.id = executionId
    node.inputs = node.inputs.map((input) => {
      if (!input.srcNodeId) return input
      const source = resolve(context.id, input)
      if (!source) return { ...input, srcNodeId: 0, srcOutputId: 0 }
      const sourceId = executionIdBySource.get(`${source.contextId}:${source.srcNodeId}`)
      assert(sourceId !== undefined, `view-ng flattened input references non-executable node ${source.srcNodeId}`)
      const stateOutputId = forEachStateOutputIdBySource.get(`${source.contextId}:${source.srcNodeId}:${source.srcOutputId}`)
      const sourceOutputId = nodeKindBySource.get(`${source.contextId}:${source.srcNodeId}`) === NG_NODE_KINDS.FOR_EACH
        ? stateOutputId ?? executionIdBySource.get(`${source.contextId}:${source.srcOutputId}`)
        : source.srcOutputId
      assert(sourceOutputId !== undefined, `view-ng flattened For Each output references missing Graph Output ${source.srcOutputId}`)
      return { ...input, srcNodeId: sourceId, srcOutputId: sourceOutputId }
    })
    if (children) {
      node.childGraph = materialize(children)
      node.inputs = node.inputs.map((input) => ({ ...input, id: executionIdBySource.get(`${context.id}:${input.id}`) }))
      node.outputs = node.outputs.map((output) => output.stateNodeId === undefined
        ? { ...output, id: executionIdBySource.get(`${context.id}:${output.id}`) }
        : {
            ...output,
            id: forEachStateOutputIdBySource.get(`${context.id}:${sourceNodeId}:${output.id}`),
            stateNodeId: executionIdBySource.get(`${context.id}:${output.stateNodeId}`),
          })
      node.inputs.forEach((input) => assert(input.id !== undefined, `view-ng flattened For Each ${sourceNodeId} references missing For Each Input`))
      node.outputs.forEach((output) => assert(output.id !== undefined, `view-ng flattened For Each ${sourceNodeId} references missing output`))
      node.outputs.filter((output) => output.statePortId !== undefined).forEach((output) => assert(output.stateNodeId !== undefined, `view-ng flattened For Each ${sourceNodeId} references missing GetVar`))
    }
    return node
  })
  return { nodes: materialize(rootRecords), locations }
}

export function visibleNgExecutionNodeId(location, activeGroupPath) {
  assert(location && typeof location === "object", "view-ng execution location is required")
  assert(Array.isArray(location.groupPath), "view-ng execution location groupPath must be an array")
  assert(Array.isArray(activeGroupPath), "view-ng active Group path must be an array")
  if (!activeGroupPath.every((groupId, index) => location.groupPath[index] === groupId)) return null
  return activeGroupPath.length < location.groupPath.length
    ? location.groupPath[activeGroupPath.length]
    : location.sourceNodeId
}

export function flattenNgGraph(graph, options = {}) {
  return flattenNgGraphWithLocations(graph, options).nodes
}
