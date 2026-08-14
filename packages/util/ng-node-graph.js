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
})

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
  return { id: output.id, name: output.name, value: output.value }
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

function cloneLevel(graph, globalIds, label, { allowExternalSources = false, resolveLinked } = {}) {
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
    }
    if (raw.kind === NG_NODE_KINDS.GRAPH_INPUT)
      assert(inputs.length === 0 && outputs.length === 1, `Graph Input ${raw.id} requires exactly one output and no inputs`)
    if (raw.kind === NG_NODE_KINDS.GRAPH_OUTPUT)
      assert(inputs.length === 1 && outputs.length === 0, `Graph Output ${raw.id} requires exactly one input and no outputs`)
    const result = {
      id: raw.id, kind: raw.kind, x: raw.x, y: raw.y, name: raw.name,
      ...(raw.kind === NG_NODE_KINDS.CODE ? { codePath: raw.codePath } : {}),
      inputs, outputs,
    }
    if (raw.kind === NG_NODE_KINDS.GROUP) {
      result.storage = groupStorage(raw, `${label} Group Node ${raw.id}`)
      if (result.storage.mode === "inline")
        result.childGraph = cloneLevel(raw.childGraph, globalIds, `view-ng Group Node ${raw.id}.childGraph`, { resolveLinked })
    }
    return result
  })
  for (const node of nodes) if (node.kind === NG_NODE_KINDS.GROUP && (node.storage.mode === "inline" || resolveLinked))
    syncNgGroupBoundary(node, nodes, { resolveLinked })
  for (const node of nodes) for (const input of node.inputs)
    assert(allowExternalSources || input.srcNodeId === 0 || localIds.has(input.srcNodeId), `${label} input ${node.id}.${input.id} references node ${input.srcNodeId} outside its graph level`)
  return nodes
}

function graphFromResolvedDocument(value, path) {
  if (Array.isArray(value)) return cloneNgGraphFragment(value)
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
  return cloneNgGraphFragment(raw.nodes)
}

export function serializeNgGroupGraphDocument(graph) {
  return { format: NG_GROUP_GRAPH_FORMAT, version: NG_GROUP_GRAPH_VERSION, nodes: cloneNgGraphFragment(graph) }
}

export function cloneNgGraphFragment(graph, options = {}) {
  return cloneLevel(structuredClone(graph), new Set(), "view-ng graph fragment", { resolveLinked: resolverFrom(options) })
}

export function cloneNgGraph(graph, options = {}) {
  const cloned = cloneLevel(structuredClone(graph), new Set(), "view-ng graph", { resolveLinked: resolverFrom(options) })
  for (const node of cloned)
    assert(node.kind !== NG_NODE_KINDS.GRAPH_INPUT && node.kind !== NG_NODE_KINDS.GRAPH_OUTPUT, `root graph cannot contain ${kindName(node.kind)} ${node.id}`)
  return cloned
}

export function visitNgNodes(graph, visitor, pathOrOptions = [], maybeOptions = {}) {
  const initialPath = Array.isArray(pathOrOptions) ? pathOrOptions : []
  const options = Array.isArray(pathOrOptions) ? maybeOptions : pathOrOptions
  const resolveLinked = resolverFrom(options)
  const visitLevel = (level, path, linkedStack) => {
    for (const node of level) {
      visitor(node, path)
      if (node.kind !== NG_NODE_KINDS.GROUP) continue
      if ((node.storage?.mode ?? "inline") === "inline") {
        visitLevel(node.childGraph, [...path, node.id], linkedStack)
      } else if (resolveLinked) {
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
    return result
  })
  return { nodes: remapLevel(cloned), nextId, idMap }
}

export function findNgGroupPath(graph, groupPath, options = {}) {
  const resolveLinked = resolverFrom(options)
  let level = graph
  const groups = []
  for (const id of groupPath) {
    const group = level.find((node) => node.id === id)
    assert(group && group.kind === NG_NODE_KINDS.GROUP, `view-ng missing Group Node ${id}`)
    groups.push(group)
    if ((group.storage?.mode ?? "inline") === "inline") level = group.childGraph
    else level = resolveLinkedDocumentReference(resolveLinked, normalizeNgGroupPath(group.storage.path))
  }
  return { graph: level, groups }
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
  const records = []
  const executionIdBySource = new Map()
  const locations = new Map()
  let nextContextId = 1
  let nextExecutionId = nextNgNodeId(document)
  const rootContext = { id: 0, documentPath: null, linked: false }

  const addLevel = (level, context, owner = null, occurrencePath = [], linkedStack = []) => {
    for (const node of level) {
      if (node.kind === NG_NODE_KINDS.GRAPH_INPUT) {
        assert(owner, `root graph cannot contain Graph Input ${node.id}`)
        const parentInput = owner.group.inputs.find((input) => input.id === node.id)
        assert(parentInput, `Group Node ${owner.group.id} missing input for Graph Input ${node.id}`)
        aliases.set(sourceKey(context.id, { srcNodeId: node.id, srcOutputId: node.outputs[0].id }), parentInput.srcNodeId ? { contextId: owner.context.id, srcNodeId: parentInput.srcNodeId, srcOutputId: parentInput.srcOutputId } : null)
      } else if (node.kind === NG_NODE_KINDS.GRAPH_OUTPUT) {
        assert(owner, `root graph cannot contain Graph Output ${node.id}`)
        const input = node.inputs[0]
        aliases.set(sourceKey(owner.context.id, { srcNodeId: owner.group.id, srcOutputId: node.id }), input.srcNodeId ? { contextId: context.id, srcNodeId: input.srcNodeId, srcOutputId: input.srcOutputId } : null)
      } else if (node.kind === NG_NODE_KINDS.GROUP) {
        const childOccurrencePath = [...occurrencePath, node.id]
        if (node.storage.mode === "inline") {
          addLevel(node.childGraph, context, { group: node, context }, childOccurrencePath, linkedStack)
        } else {
          const path = node.storage.path
          assert(resolveLinked, `view-ng linked Group ${path} requires resolveLinked(path)`)
          assert(!linkedStack.includes(path), `view-ng linked Group alias cycle: ${[...linkedStack, path].join(" -> ")}`)
          const childContext = { id: nextContextId++, documentPath: path, linked: true }
          const child = cloneNgGraphFragment(resolveLinkedDocument(resolveLinked, path), { resolveLinked })
          addLevel(child, childContext, { group: node, context }, childOccurrencePath, [...linkedStack, path])
        }
      } else {
        const executionId = context.linked ? nextExecutionId++ : node.id
        const key = `${context.id}:${node.id}`
        executionIdBySource.set(key, executionId)
        records.push({ node: structuredClone(node), context, executionId })
        locations.set(executionId, {
          executionNodeId: executionId,
          sourceNodeId: node.id,
          documentPath: context.documentPath,
          groupPath: [...occurrencePath],
        })
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

  const nodes = records.map(({ node, context, executionId }) => {
    node.id = executionId
    node.inputs = node.inputs.map((input) => {
      if (!input.srcNodeId) return input
      const source = resolve(context.id, input)
      if (!source) return { ...input, srcNodeId: 0, srcOutputId: 0 }
      const sourceId = executionIdBySource.get(`${source.contextId}:${source.srcNodeId}`)
      assert(sourceId !== undefined, `view-ng flattened input references non-executable node ${source.srcNodeId}`)
      return { ...input, srcNodeId: sourceId, srcOutputId: source.srcOutputId }
    })
    return node
  })
  return { nodes, locations }
}

export function flattenNgGraph(graph, options = {}) {
  return flattenNgGraphWithLocations(graph, options).nodes
}
