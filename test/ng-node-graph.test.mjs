import assert from "node:assert/strict"
import test from "node:test"

import {
  NG_NODE_KINDS,
  cloneNgGraph,
  cloneNgNodesWithNewIds,
  createNgNodeGraph,
  findNgGroupPath,
  flattenNgGraph,
  flattenNgGraphWithLocations,
  nextNgNodeId,
  ngInputPortId,
  ngOutputPortId,
  parseNgGroupGraphDocument,
  serializeNgGroupGraphDocument,
  serializeNgNodeGraph,
  syncNgForEachBoundary,
  syncNgGroupBoundary,
  visibleNgExecutionNodeId,
} from "../packages/util/ng-node-graph.js"

function rawGraph() {
  return [
    {
      id: 1, kind: 4, x: 10, y: 20, name: "Value",
      inputs: [], outputs: [{ id: 1, name: "", value: "hello" }],
    },
    {
      id: 2, kind: 2, x: 200, y: 20, name: "Code", codePath: "code.lua",
      inputs: [{ id: 1, name: "value", srcNodeId: 1, srcOutputId: 1 }], outputs: [{ id: 1, name: "result", value: null }],
    },
  ]
}

test("NG projection namespaces overlapping input and output ids and round trips", () => {
  const model = createNgNodeGraph(rawGraph())
  assert(model.node(2).ports.some((port) => port.id === ngInputPortId(1)))
  assert(model.node(2).ports.some((port) => port.id === ngOutputPortId(1)))
  assert.deepEqual(serializeNgNodeGraph(model), rawGraph())
})

test("NG serialization writes NodeGraph disconnection edits into input source fields", () => {
  const model = createNgNodeGraph(rawGraph())
  model.removeEdge(1)
  const serialized = serializeNgNodeGraph(model)
  assert.equal(serialized[1].inputs[0].srcNodeId, 0)
  assert.equal(serialized[1].inputs[0].srcOutputId, 0)
})

test("NG projection preserves legacy references to undeclared output ids", () => {
  const raw = rawGraph()
  raw[1].inputs[0].srcOutputId = 99
  const model = createNgNodeGraph(raw)
  assert(model.node(1).ports.some((port) => port.id === ngOutputPortId(99) && port.synthetic))
  assert.deepEqual(serializeNgNodeGraph(model), raw)
})

test("NG cloning retains the persisted schema only", () => {
  const raw = rawGraph()
  raw[0].unknown = true
  raw[0].codePath = ""
  raw[0].graphId = 42
  raw[0].graphName = "obsolete call target"
  raw[0].outputs[0].unknown = true
  assert.deepEqual(serializeNgNodeGraph(createNgNodeGraph(raw)), rawGraph())
})

test("only Code Nodes may persist codePath", () => {
  const raw = rawGraph()
  raw[0].codePath = "not-code.lua"
  assert.throws(() => cloneNgGraph(raw), /non-Code Node 1 must not have codePath/)
})

function groupedGraph() {
  const graph = rawGraph()
  graph[1].inputs[0] = { id: 1, name: "value", srcNodeId: 10, srcOutputId: 22 }
  graph.unshift({
    id: 10, kind: NG_NODE_KINDS.GROUP, x: 100, y: 100, name: "Transform",
    inputs: [], outputs: [], childGraph: [
      { id: 20, kind: NG_NODE_KINDS.GRAPH_INPUT, x: 0, y: 0, name: "source", inputs: [], outputs: [{ id: 1, name: "source", value: null }] },
      { id: 21, kind: NG_NODE_KINDS.CODE, x: 200, y: 0, name: "Inner", codePath: "inner.lua", inputs: [{ id: 1, name: "source", srcNodeId: 20, srcOutputId: 1 }], outputs: [{ id: 1, name: "result", value: null }] },
      { id: 22, kind: NG_NODE_KINDS.GRAPH_OUTPUT, x: 400, y: 0, name: "result", inputs: [{ id: 1, name: "result", srcNodeId: 21, srcOutputId: 1 }], outputs: [] },
    ],
  })
  graph[0].inputs = [{ id: 20, name: "source", srcNodeId: 1, srcOutputId: 1 }]
  graph[0].outputs = [{ id: 22, name: "result", value: null }]
  return graph
}

test("Group Node boundaries derive parent ports", () => {
  const graph = groupedGraph()
  graph[0].inputs = []
  graph[0].outputs = []
  syncNgGroupBoundary(graph[0])
  assert.deepEqual(graph[0].inputs, [{ id: 20, name: "source", srcNodeId: 0, srcOutputId: 0 }])
  assert.deepEqual(graph[0].outputs, [{ id: 22, name: "result", value: null }])
})

test("removing a Graph Output disconnects its parent consumers", () => {
  const graph = groupedGraph()
  graph[0].childGraph = graph[0].childGraph.filter((node) => node.kind !== NG_NODE_KINDS.GRAPH_OUTPUT)
  syncNgGroupBoundary(graph[0], graph)
  assert.deepEqual(graph[2].inputs[0], { id: 1, name: "value", srcNodeId: 0, srcOutputId: 0 })
})

test("inline Group Nodes flatten to executable graph connections", () => {
  const flat = flattenNgGraph(groupedGraph())
  assert.deepEqual(flat.map((node) => node.id), [21, 1, 2])
  assert.deepEqual(flat.find((node) => node.id === 21).inputs[0], { id: 1, name: "source", srcNodeId: 1, srcOutputId: 1 })
  assert.deepEqual(flat.find((node) => node.id === 2).inputs[0], { id: 1, name: "value", srcNodeId: 21, srcOutputId: 1 })
})

test("nested Group Node boundaries flatten through every level", () => {
  const base = groupedGraph()
  const inner = base[0]
  inner.inputs[0].srcNodeId = 31
  inner.inputs[0].srcOutputId = 1
  const outer = {
    id: 30, kind: NG_NODE_KINDS.GROUP, x: 100, y: 100, name: "Outer",
    inputs: [{ id: 31, name: "source", srcNodeId: 1, srcOutputId: 1 }],
    outputs: [{ id: 32, name: "result", value: null }],
    childGraph: [
      { id: 31, kind: NG_NODE_KINDS.GRAPH_INPUT, x: 0, y: 0, name: "source", inputs: [], outputs: [{ id: 1, name: "source", value: null }] },
      inner,
      { id: 32, kind: NG_NODE_KINDS.GRAPH_OUTPUT, x: 400, y: 0, name: "result", inputs: [{ id: 1, name: "result", srcNodeId: 10, srcOutputId: 22 }], outputs: [] },
    ],
  }
  base[2].inputs[0].srcNodeId = 30
  base[2].inputs[0].srcOutputId = 32
  const flat = flattenNgGraph([outer, base[1], base[2]])
  assert.equal(flat.find((node) => node.id === 21).inputs[0].srcNodeId, 1)
  assert.equal(flat.find((node) => node.id === 2).inputs[0].srcNodeId, 21)
})

test("node ids must be unique across nested graph levels", () => {
  const graph = groupedGraph()
  graph[0].childGraph[1].id = 10
  assert.throws(() => cloneNgGraph(graph), /duplicate document node id 10/)
})

test("copying Group Nodes remaps every nested identity and boundary port", () => {
  const group = groupedGraph()[0]
  const cloned = cloneNgNodesWithNewIds([group], 100).nodes[0]
  assert.equal(cloned.id, 100)
  assert.deepEqual(cloned.childGraph.map((node) => node.id), [101, 102, 103])
  assert.equal(cloned.inputs[0].id, 101)
  assert.equal(cloned.outputs[0].id, 103)
  assert.equal(cloned.childGraph[1].inputs[0].srcNodeId, 101)
  assert.equal(cloned.childGraph[2].inputs[0].srcNodeId, 102)
})

function linkedGroup(id, path, srcNodeId = 0) {
  return {
    id, kind: NG_NODE_KINDS.GROUP, x: 100, y: 100, name: "Linked",
    storage: { mode: "linked", path },
    inputs: [{ id: 100, name: "source", srcNodeId, srcOutputId: srcNodeId ? 1 : 0 }],
    outputs: [{ id: 102, name: "result", value: null }],
  }
}

function linkedDocument() {
  return serializeNgGroupGraphDocument([
    { id: 100, kind: NG_NODE_KINDS.GRAPH_INPUT, x: 0, y: 0, name: "source", inputs: [], outputs: [{ id: 1, name: "source", value: null }] },
    { id: 101, kind: NG_NODE_KINDS.CODE, x: 100, y: 0, name: "Linked code", codePath: "linked.lua", inputs: [{ id: 1, name: "source", srcNodeId: 100, srcOutputId: 1 }], outputs: [{ id: 1, name: "result", value: null }] },
    { id: 102, kind: NG_NODE_KINDS.GRAPH_OUTPUT, x: 200, y: 0, name: "result", inputs: [{ id: 1, name: "result", srcNodeId: 101, srcOutputId: 1 }], outputs: [] },
  ])
}

test("linked Group schema normalizes paths and never persists childGraph", () => {
  const group = linkedGroup(10, "graphs\\nested/../transform.json")
  group.childGraph = []
  assert.throws(() => cloneNgGraph([group]), /must not persist childGraph/)
  delete group.childGraph
  const cloned = cloneNgGraph([group])[0]
  assert.deepEqual(cloned.storage, { mode: "linked", path: "graphs/transform.json" })
  assert.equal(Object.hasOwn(cloned, "childGraph"), false)

  const legacyInline = groupedGraph()[0]
  legacyInline.inputs[0].srcNodeId = 0
  legacyInline.inputs[0].srcOutputId = 0
  const normalized = cloneNgGraph([legacyInline])[0]
  assert.deepEqual(normalized.storage, { mode: "inline" })
})

test("linked Group documents use the versioned gams-group-graph envelope", () => {
  const envelope = linkedDocument()
  assert.equal(envelope.format, "gams-group-graph")
  assert.equal(envelope.version, 1)
  assert.deepEqual(parseNgGroupGraphDocument(JSON.stringify(envelope)), envelope.nodes)
  assert.throws(() => parseNgGroupGraphDocument({ ...envelope, version: 2 }), /version must be 1/)
})

test("linked documents are separate ID authorities and are skipped without a resolver", () => {
  const group = linkedGroup(10, "graphs/transform.json")
  assert.equal(nextNgNodeId([group]), 11)
  assert.throws(() => findNgGroupPath([group], [10]), /requires resolveLinked/)
  const found = findNgGroupPath([group], [10], { resolveLinked: () => linkedDocument() })
  assert.deepEqual(found.graph.map((node) => node.id), [100, 101, 102])
})

test("linked path lookup returns the resolver's live working graph", () => {
  const working = parseNgGroupGraphDocument(linkedDocument())
  const found = findNgGroupPath([linkedGroup(10, "graphs/transform.json")], [10], { resolveLinked: () => working })
  found.graph[1].name = "Edited live"
  assert.equal(working[1].name, "Edited live")
})

test("flattening synchronizes stale linked Group boundary snapshots", () => {
  const group = linkedGroup(10, "graphs/transform.json", 1)
  group.inputs = [{ id: 100, name: "stale", srcNodeId: 1, srcOutputId: 1 }]
  group.outputs = []
  const graph = [rawGraph()[0], group]
  const flat = flattenNgGraph(graph, { resolveLinked: () => linkedDocument() })
  assert.equal(flat.find((node) => node.codePath === "linked.lua").inputs[0].srcNodeId, 1)
})

test("flattening synchronizes nested linked Group boundary snapshots", () => {
  const b = serializeNgGroupGraphDocument([
    { id: 200, kind: NG_NODE_KINDS.GRAPH_INPUT, x: 0, y: 0, name: "source", inputs: [], outputs: [{ id: 1, name: "source", value: null }] },
    { id: 201, kind: NG_NODE_KINDS.CODE, x: 100, y: 0, name: "Nested", codePath: "nested.lua", inputs: [{ id: 1, name: "source", srcNodeId: 200, srcOutputId: 1 }], outputs: [{ id: 1, name: "result", value: null }] },
    { id: 202, kind: NG_NODE_KINDS.GRAPH_OUTPUT, x: 200, y: 0, name: "result", inputs: [{ id: 1, name: "result", srcNodeId: 201, srcOutputId: 1 }], outputs: [] },
  ])
  const nested = linkedGroup(110, "b.ng")
  nested.inputs = [{ id: 200, name: "stale", srcNodeId: 100, srcOutputId: 1 }]
  nested.outputs = []
  const a = serializeNgGroupGraphDocument([
    { id: 100, kind: NG_NODE_KINDS.GRAPH_INPUT, x: 0, y: 0, name: "source", inputs: [], outputs: [{ id: 1, name: "source", value: null }] },
    nested,
    { id: 102, kind: NG_NODE_KINDS.GRAPH_OUTPUT, x: 300, y: 0, name: "result", inputs: [{ id: 1, name: "result", srcNodeId: 110, srcOutputId: 202 }], outputs: [] },
  ])
  const documents = new Map([["a.ng", a], ["b.ng", b]])
  const rootGroup = linkedGroup(10, "a.ng", 1)
  const flat = flattenNgGraph([rawGraph()[0], rootGroup], { resolveLinked: (path) => documents.get(path) })
  assert.equal(flat.find((node) => node.codePath === "nested.lua").inputs[0].srcNodeId, 1)
})

test("repeated linked sources flatten as independent execution occurrences", () => {
  const graph = rawGraph().slice(0, 1)
  graph.push(linkedGroup(10, "graphs/transform.json", 1))
  graph.push(linkedGroup(11, "graphs/transform.json", 1))
  graph.push({ id: 12, kind: NG_NODE_KINDS.CODE, x: 300, y: 0, name: "First", codePath: "first.lua", inputs: [{ id: 1, name: "value", srcNodeId: 10, srcOutputId: 102 }], outputs: [{ id: 1, name: "result", value: null }] })
  graph.push({ id: 13, kind: NG_NODE_KINDS.CODE, x: 300, y: 100, name: "Second", codePath: "second.lua", inputs: [{ id: 1, name: "value", srcNodeId: 11, srcOutputId: 102 }], outputs: [{ id: 1, name: "result", value: null }] })

  const { nodes, locations } = flattenNgGraphWithLocations(graph, { resolveLinked: () => linkedDocument() })
  const occurrences = nodes.filter((node) => node.codePath === "linked.lua")
  assert.equal(occurrences.length, 2)
  assert.notEqual(occurrences[0].id, occurrences[1].id)
  assert.equal(occurrences[0].inputs[0].srcNodeId, 1)
  assert.equal(occurrences[1].inputs[0].srcNodeId, 1)
  assert.equal(nodes.find((node) => node.id === 12).inputs[0].srcNodeId, occurrences[0].id)
  assert.equal(nodes.find((node) => node.id === 13).inputs[0].srcNodeId, occurrences[1].id)
  assert.deepEqual(locations.get(occurrences[0].id), { executionNodeId: occurrences[0].id, sourceNodeId: 101, documentPath: "graphs/transform.json", groupPath: [10] })
  assert.deepEqual(locations.get(occurrences[1].id).groupPath, [11])
})

test("nested execution progress surfaces through the nearest visible Group", () => {
  const location = { executionNodeId: 115, sourceNodeId: 101, documentPath: "graphs/transform.json", groupPath: [92] }
  assert.equal(visibleNgExecutionNodeId(location, []), 92)
  assert.equal(visibleNgExecutionNodeId(location, [92]), 101)
  assert.equal(visibleNgExecutionNodeId(location, [111]), null)
})

test("linked document alias cycles are detected across nested documents", () => {
  const a = serializeNgGroupGraphDocument([linkedGroup(1, "b.ng")])
  const b = serializeNgGroupGraphDocument([linkedGroup(1, "a.ng")])
  const documents = new Map([["a.ng", a], ["b.ng", b]])
  assert.throws(
    () => flattenNgGraph([linkedGroup(1, "a.ng")], { resolveLinked: (path) => documents.get(path) }),
    /linked Group alias cycle: a\.ng -> b\.ng -> a\.ng/,
  )
})

test("copying a linked Group remaps only the local Group identity", () => {
  const copy = cloneNgNodesWithNewIds([linkedGroup(10, "graphs/../graphs/transform.json")], 200)
  assert.equal(copy.nextId, 201)
  assert.deepEqual(copy.nodes[0], { ...linkedGroup(200, "graphs/transform.json") })
  assert.equal(Object.hasOwn(copy.nodes[0], "childGraph"), false)
})

function forEachGraph() {
  const source = rawGraph()[0]
  source.outputs[0].value = '["a", "b"]'
  const forEach = {
    id: 10, kind: NG_NODE_KINDS.FOR_EACH, x: 100, y: 100, name: "Each item",
    inputs: [{ id: 20, name: "items", srcNodeId: 1, srcOutputId: 1 }],
    outputs: [{ id: 22, name: "result", value: null }],
    childGraph: [
      { id: 20, kind: NG_NODE_KINDS.FOR_EACH_INPUT, x: 0, y: 0, name: "items", inputs: [], outputs: [
        { id: 1, name: "Item", value: null }, { id: 2, name: "Index", value: null }, { id: 3, name: "Array", value: null },
      ] },
      { id: 21, kind: NG_NODE_KINDS.CODE, x: 200, y: 0, name: "Transform", codePath: "transform.lua", inputs: [{ id: 1, name: "item", srcNodeId: 20, srcOutputId: 1 }], outputs: [{ id: 1, name: "result", value: null }] },
      { id: 22, kind: NG_NODE_KINDS.GRAPH_OUTPUT, x: 400, y: 0, name: "result", inputs: [{ id: 1, name: "result", srcNodeId: 21, srcOutputId: 1 }], outputs: [] },
      { id: 23, kind: NG_NODE_KINDS.ITERATION_CONTROL, x: 400, y: 100, name: "Iteration Control", inputs: [
        { id: 1, name: "Skip", srcNodeId: 0, srcOutputId: 0 }, { id: 2, name: "Break", srcNodeId: 0, srcOutputId: 0 },
      ], outputs: [] },
    ],
  }
  return [source, forEach]
}

test("For Each boundaries derive array inputs and collected outputs", () => {
  const graph = forEachGraph()
  graph[1].inputs = []
  graph[1].outputs = []
  syncNgForEachBoundary(graph[1])
  assert.deepEqual(graph[1].inputs, [{ id: 20, name: "items", srcNodeId: 0, srcOutputId: 0 }])
  assert.deepEqual(graph[1].outputs, [{ id: 22, name: "result", value: null }])
})

test("For Each Shared Inputs derive parent value ports without affecting array inputs", () => {
  const graph = forEachGraph()
  graph[1].childGraph.push({
    id: 24, kind: NG_NODE_KINDS.FOR_EACH_SHARED_INPUT, x: 0, y: 150, name: "configuration",
    inputs: [], outputs: [{ id: 1, name: "Value", value: null }],
  })
  graph[1].inputs.push({ id: 24, name: "configuration", srcNodeId: 1, srcOutputId: 1 })
  syncNgForEachBoundary(graph[1])
  assert.deepEqual(graph[1].inputs, [
    { id: 20, name: "items", srcNodeId: 1, srcOutputId: 1 },
    { id: 24, name: "configuration", srcNodeId: 1, srcOutputId: 1 },
  ])
  assert.doesNotThrow(() => cloneNgGraph(graph))

  graph[1].childGraph.at(-1).outputs[0].name = "Item"
  assert.throws(() => cloneNgGraph(graph), /Shared Input 24 output must be Value/)
})

test("GetVar requires paired ports and SetVar is direct For Each state", () => {
  const graph = forEachGraph()
  graph[1].childGraph.push(
    {
      id: 24, kind: NG_NODE_KINDS.VALUE, x: 0, y: 150, name: "Initial", inputs: [],
      outputs: [{ id: 1, name: "", value: "0" }],
    },
    {
      id: 25, kind: NG_NODE_KINDS.FOR_EACH_GET_VAR, x: 150, y: 150, name: "GetVar",
      inputs: [{ id: 1, name: "total", srcNodeId: 24, srcOutputId: 1 }],
      outputs: [{ id: 1, name: "total", value: null }],
    },
    {
      id: 26, kind: NG_NODE_KINDS.FOR_EACH_SET_VAR, x: 300, y: 150, name: "SetVar",
      inputs: [{ id: 1, name: "total", srcNodeId: 25, srcOutputId: 1 }], outputs: [],
    },
  )
  assert.doesNotThrow(() => cloneNgGraph(graph))

  const unpaired = structuredClone(graph)
  unpaired[1].childGraph.find((node) => node.id === 25).outputs[0].name = "other"
  assert.throws(() => cloneNgGraph(unpaired), /paired output with the same id and name/)

  const nested = forEachGraph()
  nested[1].childGraph.push({
    id: 24, kind: NG_NODE_KINDS.GROUP, x: 0, y: 150, name: "Nested", inputs: [], outputs: [], childGraph: [{
      id: 25, kind: NG_NODE_KINDS.FOR_EACH_GET_VAR, x: 0, y: 0, name: "GetVar", inputs: [], outputs: [],
    }],
  })
  assert.throws(() => cloneNgGraph(nested), /GetVar 25 must be a direct child/)
})

test("For Each remains structured while nested Groups flatten", () => {
  const graph = forEachGraph()
  const flat = flattenNgGraph(graph)
  assert.deepEqual(flat.map((node) => node.id), [1, 10])
  assert.deepEqual(flat[1].childGraph.map((node) => node.id), [20, 21, 22, 23])
  assert.equal(flat[1].childGraph[1].inputs[0].srcNodeId, 20)
})

test("For Each schema requires its dedicated boundaries", () => {
  const graph = forEachGraph()
  graph[1].childGraph[0].outputs[0].name = "value"
  assert.throws(() => cloneNgGraph(graph), /output 1 must be Item/)
  const withoutInput = forEachGraph()
  withoutInput[1].childGraph.shift()
  withoutInput[1].childGraph[0].inputs[0] = { id: 1, name: "item", srcNodeId: 0, srcOutputId: 0 }
  assert.throws(() => cloneNgGraph(withoutInput), /requires at least one For Each Input/)
  const duplicateControl = forEachGraph()
  duplicateControl[1].childGraph.push(structuredClone(duplicateControl[1].childGraph[3]))
  duplicateControl[1].childGraph.at(-1).id = 24
  assert.throws(() => cloneNgGraph(duplicateControl), /allows at most one Iteration Control/)
  const nestedGoal = forEachGraph()
  nestedGoal[1].childGraph.push({
    id: 30, kind: NG_NODE_KINDS.GROUP, x: 0, y: 200, name: "Nested Group", inputs: [], outputs: [], childGraph: [
      { id: 31, kind: NG_NODE_KINDS.GOAL, x: 0, y: 0, name: "Invalid Goal", inputs: [], outputs: [] },
    ],
  })
  assert.throws(() => cloneNgGraph(nestedGoal), /Goal Node 31 cannot be inside a For Each Node/)
})

test("copying For Each remaps child and boundary identities", () => {
  const cloned = cloneNgNodesWithNewIds([forEachGraph()[1]], 100).nodes[0]
  assert.equal(cloned.id, 100)
  assert.deepEqual(cloned.childGraph.map((node) => node.id), [101, 102, 103, 104])
  assert.equal(cloned.inputs[0].id, 101)
  assert.equal(cloned.outputs[0].id, 103)
  assert.equal(cloned.childGraph[1].inputs[0].srcNodeId, 101)
})

test("For Each boundary ids become occurrence ids inside linked Groups", () => {
  const linkedForEach = structuredClone(forEachGraph()[1])
  linkedForEach.id = 110
  linkedForEach.inputs[0] = { id: 20, name: "items", srcNodeId: 100, srcOutputId: 1 }
  linkedForEach.childGraph[1].id = 121
  linkedForEach.childGraph[2].id = 122
  linkedForEach.childGraph[2].inputs[0].srcNodeId = 121
  linkedForEach.childGraph[3].id = 123
  linkedForEach.outputs[0].id = 122
  const document = serializeNgGroupGraphDocument([
    { id: 100, kind: NG_NODE_KINDS.GRAPH_INPUT, x: 0, y: 0, name: "items", inputs: [], outputs: [{ id: 1, name: "items", value: null }] },
    linkedForEach,
    { id: 102, kind: NG_NODE_KINDS.GRAPH_OUTPUT, x: 400, y: 0, name: "results", inputs: [{ id: 1, name: "results", srcNodeId: 110, srcOutputId: 122 }], outputs: [] },
  ])
  const root = rawGraph()
  root[1].inputs[0] = { id: 1, name: "value", srcNodeId: 10, srcOutputId: 102 }
  const rootGroup = linkedGroup(10, "each.ng", 1)
  rootGroup.inputs = [{ id: 100, name: "items", srcNodeId: 1, srcOutputId: 1 }]
  root.splice(1, 0, rootGroup)
  const flat = flattenNgGraph(root, { resolveLinked: () => document })
  const occurrence = flat.find((node) => node.kind === NG_NODE_KINDS.FOR_EACH)
  const collector = occurrence.childGraph.find((node) => node.kind === NG_NODE_KINDS.GRAPH_OUTPUT)
  assert.equal(occurrence.outputs[0].id, collector.id)
  assert.equal(flat.find((node) => node.id === 2).inputs[0].srcOutputId, collector.id)
})
