export const ANIMATION_NODE_KINDS = Object.freeze({
  ANIMATION: "animation",
  ONE_SHOT: "one-shot",
  BLEND_2: "blend2",
  TIME_SEEK: "time-seek",
  TIME_SCALE: "time-scale",
  SWITCH: "switch",
  BLEND_TREE: "blend-tree",
  BLEND_SPACE_1D: "blend-space-1d",
  BLEND_SPACE_2D: "blend-space-2d",
  STATE_MACHINE: "state-machine",
})

export const ROOT_ANIMATION_NODE_KINDS = Object.freeze([
  ANIMATION_NODE_KINDS.ANIMATION,
  ANIMATION_NODE_KINDS.BLEND_TREE,
  ANIMATION_NODE_KINDS.BLEND_SPACE_1D,
  ANIMATION_NODE_KINDS.BLEND_SPACE_2D,
  ANIMATION_NODE_KINDS.STATE_MACHINE,
])

export const ANIMATION_CONDITION_OPERATORS = Object.freeze(["eq", "neq", "lt", "lte", "gt", "gte"])
export const INT32_MIN = -2147483648
export const INT32_MAX = 2147483647

export const DEFAULT_ANIMATION_NODE_VIEWS = Object.freeze({
  [ANIMATION_NODE_KINDS.ANIMATION]: null,
  [ANIMATION_NODE_KINDS.ONE_SHOT]: null,
  [ANIMATION_NODE_KINDS.BLEND_2]: null,
  [ANIMATION_NODE_KINDS.TIME_SEEK]: null,
  [ANIMATION_NODE_KINDS.TIME_SCALE]: null,
  [ANIMATION_NODE_KINDS.SWITCH]: null,
  [ANIMATION_NODE_KINDS.BLEND_TREE]: "view-animation-blend-tree",
  [ANIMATION_NODE_KINDS.BLEND_SPACE_1D]: "view-animation-blend-space-1d",
  [ANIMATION_NODE_KINDS.BLEND_SPACE_2D]: "view-animation-blend-space-2d",
  [ANIMATION_NODE_KINDS.STATE_MACHINE]: "view-animation-state-machine",
})

export function validateAnimationNodeViews(views) {
  requireObject(views, "animation node views")
  const kinds = Object.values(ANIMATION_NODE_KINDS)
  const configuredKinds = Object.keys(views)
  assert(configuredKinds.length === kinds.length, "animation node views must configure every animation node kind")
  for (const kind of kinds) {
    assert(Object.hasOwn(views, kind), `animation node views missing ${kind}`)
    const tag = views[kind]
    assert(tag === null || (typeof tag === "string" && tag.length > 0), `animation node view ${kind} must be a non-empty view tag or null`)
  }
  for (const kind of configuredKinds) assert(kinds.includes(kind), `animation node views contains unknown kind ${kind}`)
  return views
}

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

export function isInt32(value) {
  return Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX
}

export function createAnimationParameter(parameters = []) {
  assert(Array.isArray(parameters), "animation parameters must be an array")
  const names = new Set(parameters.map((parameter) => parameter.name))
  let index = 1
  while (names.has(`Parameter ${index}`)) index += 1
  return { id: createId(), name: `Parameter ${index}`, defaultValue: 0 }
}

export function animationParameterReferenceCounts(document) {
  validateAnimationTreeDocument(document)
  const counts = new Map(document.parameters.map((parameter) => [parameter.id, 0]))
  const visit = (node) => {
    if (node.kind === ANIMATION_NODE_KINDS.STATE_MACHINE) {
      for (const edge of node.graph.transitions) {
        if (edge.kind !== "transition") continue
        for (const condition of edge.conditions) counts.set(condition.parameterId, counts.get(condition.parameterId) + 1)
      }
    }
    for (const child of childAnimationNodes(node)) visit(child)
  }
  visit(document.root)
  return counts
}

export function validateAnimationSelector(value, label = "animation selector") {
  requireObject(value, label)
  const keys = Object.keys(value)
  assert(keys.length === 3 && keys.includes("url") && keys.includes("layer") && keys.includes("tag"), `${label} must contain only url, layer, and tag`)
  assert(typeof value.url === "string", `${label}.url must be a string`)
  assert(typeof value.layer === "string" && value.layer.length > 0, `${label}.layer must be a non-empty string`)
  assert(typeof value.tag === "string" && value.tag.length > 0, `${label}.tag must be a non-empty string`)
  return value
}

function animationPorts() {
  return [{ id: "animation", direction: "output", dataType: "animation", maxConnections: null }]
}

function inputPort(id, name = id) {
  return { id, name, direction: "input", dataType: "animation", maxConnections: 1 }
}

function blendPorts(count, prefix = "") {
  return [
    ...Array.from({ length: count }, (_, index) => {
      const id = prefix ? `${prefix}${index + 1}` : String.fromCharCode("a".charCodeAt(0) + index)
      return inputPort(id, prefix ? `Input ${index + 1}` : id)
    }),
    ...animationPorts(),
  ]
}

function filterPorts(inputId = "input") {
  return [inputPort(inputId), ...animationPorts()]
}

export function createAnimationNode(kind, { id = createId(), name } = {}) {
  assert(typeof id === "string" && id.length > 0, "animation node id must be a non-empty string")
  assert(typeof kind === "string" && kind.length > 0, "animation node kind must be a non-empty string")
  const label = name || kind
  assert(typeof label === "string" && label.length > 0, "animation node name must be a non-empty string")

  if (kind === ANIMATION_NODE_KINDS.ANIMATION)
    return { id, kind, name: label, animation: { url: "", layer: "*", tag: "*" }, ports: animationPorts() }
  if (kind === ANIMATION_NODE_KINDS.ONE_SHOT)
    return { id, kind, name: label, parameters: { active: false }, ports: [inputPort("base"), inputPort("shot"), ...animationPorts()] }
  if (kind === ANIMATION_NODE_KINDS.BLEND_2)
    return { id, kind, name: label, ports: blendPorts(2) }
  if (kind === ANIMATION_NODE_KINDS.TIME_SEEK)
    return { id, kind, name: label, parameters: { seekTime: 0 }, ports: filterPorts() }
  if (kind === ANIMATION_NODE_KINDS.TIME_SCALE)
    return { id, kind, name: label, parameters: { scale: 1 }, ports: filterPorts() }
  if (kind === ANIMATION_NODE_KINDS.SWITCH)
    return { id, kind, name: label, parameters: { currentInput: "input-1" }, ports: blendPorts(2, "input-") }
  if (kind === ANIMATION_NODE_KINDS.BLEND_TREE)
    return {
      id,
      kind,
      name: label,
      ports: animationPorts(),
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
      ports: animationPorts(),
      graph: {
        states: [],
        transitions: [],
        start: { position: { x: -120, y: 180 } },
        end: { position: { x: 840, y: 180 } },
      },
    }
  if (kind === ANIMATION_NODE_KINDS.BLEND_SPACE_1D)
    return { id, kind, name: label, parameters: { blendPosition: 0, min: -1, max: 1 }, points: [], ports: animationPorts() }
  if (kind === ANIMATION_NODE_KINDS.BLEND_SPACE_2D)
    return {
      id,
      kind,
      name: label,
      parameters: { blendX: 0, blendY: 0, minX: -1, maxX: 1, minY: -1, maxY: 1 },
      points: [],
      ports: animationPorts(),
    }
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

export function createEmptyAnimationTreeDocument() {
  const root = createAnimationNode(ANIMATION_NODE_KINDS.STATE_MACHINE, { name: "Animation Tree" })
  return createAnimationTreeDocument({ name: "Animation Tree", parameters: [], root })
}

export function createAnimationTreeDocument({ id = createId(), name = "Animation Tree", parameters = [], root }) {
  assert(typeof id === "string" && id.length > 0, "animation tree id must be a non-empty string")
  assert(typeof name === "string" && name.length > 0, "animation tree name must be a non-empty string")
  assert(root && ROOT_ANIMATION_NODE_KINDS.includes(root.kind), `animation tree root kind ${root?.kind} is not supported`)
  const document = { id, name, parameters, root }
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
  assert(Array.isArray(document.parameters), "animation tree parameters must be an array")
  const parameterIds = new Set()
  const parameterNames = new Set()
  document.parameters.forEach((parameter, index) => {
    const label = `animation tree parameters[${index}]`
    requireObject(parameter, label)
    assert(Object.keys(parameter).length === 3 && ["id", "name", "defaultValue"].every((key) => Object.hasOwn(parameter, key)), `${label} must contain only id, name, and defaultValue`)
    assert(typeof parameter.id === "string" && parameter.id.length > 0, `${label}.id must be a non-empty string`)
    assert(!parameterIds.has(parameter.id), `animation tree duplicate parameter id ${parameter.id}`)
    parameterIds.add(parameter.id)
    assert(typeof parameter.name === "string" && parameter.name === parameter.name.trim() && parameter.name.length > 0, `${label}.name must be a trimmed non-empty string`)
    assert(!parameterNames.has(parameter.name), `animation tree duplicate parameter name ${parameter.name}`)
    parameterNames.add(parameter.name)
    assert(isInt32(parameter.defaultValue), `${label}.defaultValue must be a signed 32-bit integer`)
  })
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
    if (node.kind === ANIMATION_NODE_KINDS.ANIMATION) validateAnimationSelector(node.animation, `${label}.animation`)
    if (node.kind === ANIMATION_NODE_KINDS.STATE_MACHINE) {
      requireObject(node.graph, `${label}.graph`)
      assert(Array.isArray(node.graph.states), `${label}.graph.states must be an array`)
      assert(Array.isArray(node.graph.transitions), `${label}.graph.transitions must be an array`)
      node.graph.transitions.forEach((edge, index) => {
        const edgeLabel = `${label}.graph.transitions[${index}]`
        requireObject(edge, edgeLabel)
        assert(edge.kind === "entry" || edge.kind === "transition", `${edgeLabel}.kind must be entry or transition`)
        if (edge.kind === "entry") {
          assert(!Object.hasOwn(edge, "conditions"), `${edgeLabel} entry edge must not contain conditions`)
          return
        }
        assert(edge.switchMode === "immediate" || edge.switchMode === "sync" || edge.switchMode === "at-end", `${edgeLabel}.switchMode is not supported`)
        assert(Array.isArray(edge.conditions), `${edgeLabel}.conditions must be an array`)
        edge.conditions.forEach((condition, conditionIndex) => {
          const conditionLabel = `${edgeLabel}.conditions[${conditionIndex}]`
          requireObject(condition, conditionLabel)
          assert(Object.keys(condition).length === 3 && ["parameterId", "operator", "value"].every((key) => Object.hasOwn(condition, key)), `${conditionLabel} must contain only parameterId, operator, and value`)
          assert(typeof condition.parameterId === "string" && parameterIds.has(condition.parameterId), `${conditionLabel}.parameterId must reference an Animation Parameter`)
          assert(ANIMATION_CONDITION_OPERATORS.includes(condition.operator), `${conditionLabel}.operator is not supported`)
          assert(isInt32(condition.value), `${conditionLabel}.value must be a signed 32-bit integer`)
        })
      })
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
  for (const edge of root.graph.transitions) if (edge.kind === "transition") edge.conditions = []
  return createAnimationTreeDocument({ id: "demo-animation-tree", name: "Animation Tree", parameters: [], root })
}
