export const ANIMATION_NODE_KINDS = Object.freeze({
  ANIMATION: "animation",
  BLEND_TREE: "blend-tree",
  BLEND_SPACE_1D: "blend-space-1d",
  BLEND_SPACE_2D: "blend-space-2d",
  STATE_MACHINE: "state-machine",
  BLEND_2: "blend2",
  BLEND_3: "blend3",
})

export const ROOT_ANIMATION_NODE_KINDS = Object.freeze([
  ANIMATION_NODE_KINDS.ANIMATION,
  ANIMATION_NODE_KINDS.BLEND_TREE,
  ANIMATION_NODE_KINDS.BLEND_SPACE_1D,
  ANIMATION_NODE_KINDS.BLEND_SPACE_2D,
  ANIMATION_NODE_KINDS.STATE_MACHINE,
])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function requireObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  return value
}

function createId() {
  return crypto.randomUUID()
}

function animationPorts() {
  return [{ id: "animation", direction: "output", dataType: "animation", maxConnections: null }]
}

function blendPorts(count) {
  return [
    ...Array.from({ length: count }, (_, index) => ({
      id: String.fromCharCode("a".charCodeAt(0) + index),
      direction: "input",
      dataType: "animation",
      maxConnections: 1,
    })),
    { id: "animation", direction: "output", dataType: "animation", maxConnections: null },
  ]
}

export function createAnimationNode(kind, { id = createId(), name } = {}) {
  assert(typeof id === "string" && id.length > 0, "animation node id must be a non-empty string")
  assert(typeof kind === "string" && kind.length > 0, "animation node kind must be a non-empty string")
  const label = name || kind
  assert(typeof label === "string" && label.length > 0, "animation node name must be a non-empty string")

  if (kind === ANIMATION_NODE_KINDS.ANIMATION)
    return { id, kind, name: label, animation: null, ports: animationPorts() }
  if (kind === ANIMATION_NODE_KINDS.BLEND_2)
    return { id, kind, name: label, parameters: { blendAmount: 0.5 }, ports: blendPorts(2) }
  if (kind === ANIMATION_NODE_KINDS.BLEND_3)
    return { id, kind, name: label, parameters: { blendAmount: 0.5 }, ports: blendPorts(3) }
  if (kind === ANIMATION_NODE_KINDS.BLEND_TREE)
    return {
      id,
      kind,
      name: label,
      graph: {
        nodes: [],
        edges: [],
        output: { id: "output", name: "Output", position: { x: 680, y: 180 } },
      },
    }
  if (kind === ANIMATION_NODE_KINDS.STATE_MACHINE)
    return {
      id,
      kind,
      name: label,
      graph: {
        states: [],
        transitions: [],
        start: { position: { x: -120, y: 180 } },
        end: { position: { x: 840, y: 180 } },
      },
    }
  if (kind === ANIMATION_NODE_KINDS.BLEND_SPACE_1D)
    return { id, kind, name: label, points: [] }
  if (kind === ANIMATION_NODE_KINDS.BLEND_SPACE_2D)
    return { id, kind, name: label, points: [] }
  throw new Error(`unknown animation node kind ${kind}`)
}

export function cloneAnimationNodeWithNewIds(source) {
  const cloneNode = (node) => {
    const clone = structuredClone(node)
    clone.id = createId()
    if (clone.kind === ANIMATION_NODE_KINDS.STATE_MACHINE) {
      const directIds = new Map()
      clone.graph.states = node.graph.states.map((state) => {
        const child = cloneNode(state.node)
        directIds.set(state.node.id, child.id)
        return { node: child, position: structuredClone(state.position) }
      })
      clone.graph.transitions = node.graph.transitions.map((edge) => ({
        ...structuredClone(edge),
        from: directIds.get(edge.from) || edge.from,
        to: directIds.get(edge.to) || edge.to,
      }))
    }
    if (clone.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
      const directIds = new Map()
      clone.graph.nodes = node.graph.nodes.map((placement) => {
        const child = cloneNode(placement.node)
        directIds.set(placement.node.id, child.id)
        return { node: child, position: structuredClone(placement.position) }
      })
      clone.graph.edges = node.graph.edges.map((edge) => ({
        ...structuredClone(edge),
        id: createId(),
        from: { ...edge.from, nodeId: directIds.get(edge.from.nodeId) || edge.from.nodeId },
        to: { ...edge.to, nodeId: directIds.get(edge.to.nodeId) || edge.to.nodeId },
      }))
    }
    return clone
  }
  return cloneNode(source)
}

export function createAnimationTreeDocument({ id = createId(), name = "Animation Tree", root }) {
  assert(typeof id === "string" && id.length > 0, "animation tree id must be a non-empty string")
  assert(typeof name === "string" && name.length > 0, "animation tree name must be a non-empty string")
  assert(root && ROOT_ANIMATION_NODE_KINDS.includes(root.kind), `animation tree root kind ${root?.kind} is not supported`)
  const document = { id, name, root }
  validateAnimationTreeDocument(document)
  return document
}

export function childAnimationNodes(node) {
  requireObject(node, "animation node")
  if (node.kind === ANIMATION_NODE_KINDS.STATE_MACHINE) return node.graph.states.map((state) => state.node)
  if (node.kind === ANIMATION_NODE_KINDS.BLEND_TREE) return node.graph.nodes.map((placement) => placement.node)
  return []
}

export function animationNodePath(document, targetId) {
  validateAnimationTreeDocument(document)
  const visit = (node, path) => {
    const next = path.concat(node)
    if (node.id === targetId) return next
    for (const child of childAnimationNodes(node)) {
      const found = visit(child, next)
      if (found) return found
    }
    return null
  }
  return visit(document.root, [])
}

export function validateAnimationTreeDocument(document) {
  requireObject(document, "animation tree")
  assert(typeof document.id === "string" && document.id.length > 0, "animation tree id must be a non-empty string")
  assert(typeof document.name === "string" && document.name.length > 0, "animation tree name must be a non-empty string")
  requireObject(document.root, "animation tree root")
  assert(ROOT_ANIMATION_NODE_KINDS.includes(document.root.kind), `animation tree root kind ${document.root.kind} is not supported`)
  const ids = new Set()
  const visit = (node, label) => {
    requireObject(node, label)
    assert(typeof node.id === "string" && node.id.length > 0, `${label}.id must be a non-empty string`)
    assert(!ids.has(node.id), `animation tree duplicate animation node id ${node.id}`)
    ids.add(node.id)
    assert(typeof node.kind === "string" && node.kind.length > 0, `${label}.kind must be a non-empty string`)
    assert(typeof node.name === "string" && node.name.length > 0, `${label}.name must be a non-empty string`)
    if (node.kind === ANIMATION_NODE_KINDS.STATE_MACHINE) {
      requireObject(node.graph, `${label}.graph`)
      assert(Array.isArray(node.graph.states), `${label}.graph.states must be an array`)
      assert(Array.isArray(node.graph.transitions), `${label}.graph.transitions must be an array`)
      requireObject(node.graph.start, `${label}.graph.start`)
      requireObject(node.graph.end, `${label}.graph.end`)
      node.graph.states.forEach((state, index) => {
        requireObject(state, `${label}.graph.states[${index}]`)
        requireObject(state.position, `${label}.graph.states[${index}].position`)
        visit(state.node, `${label}.graph.states[${index}].node`)
      })
      return
    }
    if (node.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
      requireObject(node.graph, `${label}.graph`)
      assert(Array.isArray(node.graph.nodes), `${label}.graph.nodes must be an array`)
      assert(Array.isArray(node.graph.edges), `${label}.graph.edges must be an array`)
      requireObject(node.graph.output, `${label}.graph.output`)
      node.graph.nodes.forEach((placement, index) => {
        requireObject(placement, `${label}.graph.nodes[${index}]`)
        requireObject(placement.position, `${label}.graph.nodes[${index}].position`)
        visit(placement.node, `${label}.graph.nodes[${index}].node`)
      })
    }
  }
  visit(document.root, "animation tree root")
  return document
}

export function createDemoAnimationTreeDocument() {
  const root = createAnimationNode(ANIMATION_NODE_KINDS.STATE_MACHINE, { id: "root", name: "Root State Machine" })
  const idle = createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "idle", name: "Idle" })
  const run = createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "run", name: "Run" })
  const jump = createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "jump", name: "Jump" })
  const fall = createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "fall", name: "Fall" })
  const movement = createAnimationNode(ANIMATION_NODE_KINDS.BLEND_TREE, { id: "movement", name: "Movement Blend" })
  const walkSource = createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "movement-walk", name: "Walk" })
  const runSource = createAnimationNode(ANIMATION_NODE_KINDS.ANIMATION, { id: "movement-run", name: "Run" })
  const blend = createAnimationNode(ANIMATION_NODE_KINDS.BLEND_2, { id: "movement-blend2", name: "Blend2" })
  movement.graph.nodes.push(
    { node: walkSource, position: { x: 60, y: 80 } },
    { node: runSource, position: { x: 60, y: 280 } },
    { node: blend, position: { x: 360, y: 180 } },
  )
  movement.graph.edges.push(
    { id: "movement-edge-1", from: { nodeId: walkSource.id, portId: "animation" }, to: { nodeId: blend.id, portId: "a" } },
    { id: "movement-edge-2", from: { nodeId: runSource.id, portId: "animation" }, to: { nodeId: blend.id, portId: "b" } },
  )
  root.graph.states.push(
    { node: idle, position: { x: 80, y: 180 } },
    { node: run, position: { x: 360, y: 80 } },
    { node: jump, position: { x: 360, y: 280 } },
    { node: fall, position: { x: 640, y: 280 } },
    { node: movement, position: { x: 640, y: 80 } },
  )
  root.graph.transitions.push(
    { id: 1, kind: "entry", from: "start", to: idle.id },
    { id: 2, kind: "transition", from: idle.id, to: run.id, switchMode: "immediate" },
    { id: 3, kind: "transition", from: run.id, to: idle.id, switchMode: "immediate" },
    { id: 4, kind: "transition", from: idle.id, to: jump.id, switchMode: "immediate" },
    { id: 5, kind: "transition", from: run.id, to: jump.id, switchMode: "immediate" },
    { id: 6, kind: "transition", from: jump.id, to: fall.id, switchMode: "immediate" },
    { id: 7, kind: "transition", from: fall.id, to: idle.id, switchMode: "immediate" },
    { id: 8, kind: "transition", from: fall.id, to: "end", switchMode: "at-end" },
  )
  return createAnimationTreeDocument({ id: "demo-animation-tree", name: "Animation Tree", root })
}
