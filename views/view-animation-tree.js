import { runtime, unwrap } from "/core/runtime.js"
import { ViewCanvasBase } from "/util/view-canvas-base.js"
import { StateMachineGraphRenderer } from "/util/state-machine-graph-renderer.js"
import { UndoHistory } from "/util/undo.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const TRANSITION_MODES = [
  { value: "immediate", label: "Immediate", icon: "play_arrow" },
  { value: "sync", label: "Sync", icon: "resume" },
  { value: "at-end", label: "At End", icon: "skip_next" },
]

const NODE_TYPES = [
  { value: "animation", label: "Animation" },
  { value: "blend-space-1d", label: "BlendSpace1D" },
  { value: "blend-space-2d", label: "BlendSpace2D" },
  { value: "blend-tree", label: "BlendTree" },
  { value: "state-machine", label: "State Machine" },
]

const CLIPBOARD_FORMAT = "gams.animation-tree.nodes"

function createInitialGraph() {
  return {
    nodes: [
      { id: 1, type: "animation", name: "Idle", x: 80, y: 180, start: true },
      { id: 2, type: "animation", name: "Run", x: 360, y: 80, start: false },
      { id: 3, type: "animation", name: "Jump", x: 360, y: 280, start: false },
      { id: 4, type: "animation", name: "Fall", x: 640, y: 280, start: false },
    ],
    edges: [
      { id: 1, from: 1, to: 2, switchMode: "immediate" },
      { id: 2, from: 2, to: 1, switchMode: "immediate" },
      { id: 3, from: 1, to: 3, switchMode: "immediate" },
      { id: 4, from: 2, to: 3, switchMode: "immediate" },
      { id: 5, from: 3, to: 4, switchMode: "immediate" },
      { id: 6, from: 4, to: 1, switchMode: "immediate" },
    ],
  }
}

export class ViewAnimationTree extends ViewCanvasBase {
  constructor() {
    super()
    this.renderer = null
    this.history = new UndoHistory()
    this.graph = createInitialGraph()
    this.selectedNodeIds = new Set([1])
    this.selectedNodeId = 1
    this.selectedEdgeId = null
    this.hoveredNodeId = null
    this.draggedNodeId = null
    this.dragNodeStarts = null
    this.selectionDrag = null
    this.lastPointerWorld = null
    this.connecting = false
    this.connectionSourceNodeId = null
    this.dragStartPoint = null
    this.dragBeforeSnapshot = null
    this.interactionMode = "select"
    this.transitionModeIndex = 0
    this._onContextMenu = this._onContextMenu.bind(this)
    this.inspectorElement = null
    this.selectionOutput = null
    this.statusOutput = null
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = "1"
    assert(this.viewConfig && typeof this.viewConfig === "object", "view-animation-tree viewConfig is required")
    assert(this.viewConfig.config && typeof this.viewConfig.config === "object", "view-animation-tree viewConfig.config is required")
    this.renderer = new StateMachineGraphRenderer(this.viewConfig.config.renderer)

    this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <aside data-element="inspector"></aside>
      <footer data-element="footer">
        <output data-element="selection"></output>
        <output data-element="status" class="info">Select a state or transition</output>
      </footer>
    `
    this.inspectorElement = this.querySelector('[data-element="inspector"]')
    this.selectionOutput = this.querySelector('[data-element="selection"]')
    this.statusOutput = this.querySelector('[data-element="status"]')
    assert(this.inspectorElement instanceof HTMLElement, "view-animation-tree missing inspector")
    assert(this.selectionOutput instanceof HTMLOutputElement, "view-animation-tree missing selection output")
    assert(this.statusOutput instanceof HTMLOutputElement, "view-animation-tree missing status output")

    super.connectedCallback()
    this.canvas.addEventListener("contextmenu", this._onContextMenu)
    this.setData(this.graph)
    this.renderInspector()
    this.syncHistoryControls()
    this.syncModeControls()
  }

  disconnectedCallback() {
    if (this.canvas instanceof HTMLCanvasElement) this.canvas.removeEventListener("contextmenu", this._onContextMenu)
    void runtime.call("ui.tooltip.closeAll")
    super.disconnectedCallback()
  }

  createViewPluginMethods() {
    return {
      addState: (input) => {
        this.addState(input && input.type ? input.type : "animation")
        return { ok: true }
      },
      addTransition: () => {
        this.cycleTransitionMode()
        return { ok: true }
      },
      tool_1: () => {
        this.selectMode()
        return { ok: true }
      },
      tool_2: () => {
        this.cycleTransitionMode()
        return { ok: true }
      },
    }
  }

  async add() {
    await this.showNodeMenuAtCanvasCenter()
    return true
  }

  clearSelection() {
    this.cancelConnecting({ silent: true })
    this.setNodeSelection([])
    this.renderInspector()
    this.draw()
    this.setStatus("Selection cleared", "info")
    return true
  }

  createHeaderControlsElement() {
    const controls = document.createElement("div")
    controls.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="new" aria-label="New graph" title="New graph" disabled><i aria-hidden="true">docs</i></button>
        <button type="button" data-action="open" aria-label="Open graph" title="Open graph" disabled><i aria-hidden="true">folder_open</i></button>
        <button type="button" data-action="save" aria-label="Save graph" title="Save graph" disabled><i aria-hidden="true">save</i></button>
        <button type="button" data-action="save-as" aria-label="Save graph as" title="Save graph as" disabled><i aria-hidden="true">save_as</i></button>
        <button type="button" data-action="reload" aria-label="Reload graph" title="Reload graph" disabled><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <button type="button" data-action="select-mode" class="accent" aria-pressed="true" aria-label="Select mode" title="Select mode"><i aria-hidden="true">near_me</i></button>
        <button type="button" data-action="transition-mode" aria-pressed="false" aria-label="Transition mode: Immediate" title="Transition mode: Immediate"><i aria-hidden="true">play_arrow</i></button>
      </div>
      <div role="buttongroup" data-element="state-actions">
        <button type="button" data-action="add-state" aria-label="Add node" title="Add node"><i aria-hidden="true">add</i></button>
        <button type="button" data-action="delete" class="danger" aria-label="Delete selected" title="Delete selected"><i aria-hidden="true">delete</i></button>
      </div>
      <div role="buttongroup" data-element="edit-actions">
        <button type="button" data-action="undo" aria-label="Undo" title="Undo" disabled><i aria-hidden="true">undo</i></button>
        <button type="button" data-action="redo" aria-label="Redo" title="Redo" disabled><i aria-hidden="true">redo</i></button>
        <button type="button" data-action="copy" aria-label="Copy selected" title="Copy selected"><i aria-hidden="true">content_copy</i></button>
        <button type="button" data-action="paste" aria-label="Paste" title="Paste"><i aria-hidden="true">content_paste</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in"><i aria-hidden="true">zoom_in</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit graph" title="Fit graph"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out"><i aria-hidden="true">zoom_out</i></button>
      </div>
    `
    const actions = {
      selectMode: controls.querySelector('[data-action="select-mode"]'),
      transitionMode: controls.querySelector('[data-action="transition-mode"]'),
      addState: controls.querySelector('[data-action="add-state"]'),
      delete: controls.querySelector('[data-action="delete"]'),
      undo: controls.querySelector('[data-action="undo"]'),
      redo: controls.querySelector('[data-action="redo"]'),
      copy: controls.querySelector('[data-action="copy"]'),
      paste: controls.querySelector('[data-action="paste"]'),
      zoomIn: controls.querySelector('[data-action="zoom-in"]'),
      zoomFit: controls.querySelector('[data-action="zoom-fit"]'),
      zoomOut: controls.querySelector('[data-action="zoom-out"]'),
    }
    for (const [name, button] of Object.entries(actions))
      assert(button instanceof HTMLButtonElement, `view-animation-tree missing ${name} control`)
    actions.selectMode.addEventListener("click", () => this.selectMode())
    actions.transitionMode.addEventListener("click", () => this.cycleTransitionMode())
    actions.addState.addEventListener("click", () => this.showNodeMenuForButton(actions.addState))
    actions.delete.addEventListener("click", () => this.deleteSelected())
    actions.undo.addEventListener("click", () => this.undo())
    actions.redo.addEventListener("click", () => this.redo())
    actions.copy.addEventListener("click", () => this.copy())
    actions.paste.addEventListener("click", () => this.paste())
    actions.zoomIn.addEventListener("click", () => this.zoomIn())
    actions.zoomFit.addEventListener("click", () => this.zoomFit())
    actions.zoomOut.addEventListener("click", () => this.zoomOut())
    return controls
  }

  setNodeSelection(ids, activeId = null) {
    this.selectedNodeIds = new Set(ids)
    this.selectedNodeId = activeId === null ? (this.selectedNodeIds.size ? [...this.selectedNodeIds][this.selectedNodeIds.size - 1] : null) : activeId
    if (this.selectedNodeId !== null) assert(this.selectedNodeIds.has(this.selectedNodeId), "view-animation-tree active node must be selected")
    this.selectedEdgeId = null
  }

  selectedNode() {
    assert(this.selectedNodeId !== null, "view-animation-tree has no selected node")
    const node = this.graph.nodes.find((candidate) => candidate.id === this.selectedNodeId)
    assert(node, `view-animation-tree missing selected node ${this.selectedNodeId}`)
    return node
  }

  selectedEdge() {
    assert(this.selectedEdgeId !== null, "view-animation-tree has no selected edge")
    const edge = this.graph.edges.find((candidate) => candidate.id === this.selectedEdgeId)
    assert(edge, `view-animation-tree missing selected edge ${this.selectedEdgeId}`)
    return edge
  }

  stateName(id) {
    const node = this.graph.nodes.find((candidate) => candidate.id === id)
    assert(node, `view-animation-tree missing node ${id}`)
    return node.name
  }

  captureSnapshot() {
    return {
      graph: structuredClone(this.graph),
      selectedNodeIds: [...this.selectedNodeIds],
      selectedNodeId: this.selectedNodeId,
      selectedEdgeId: this.selectedEdgeId,
    }
  }

  restoreSnapshot(snapshot) {
    assert(snapshot && typeof snapshot === "object", "view-animation-tree history snapshot is required")
    this.cancelConnecting({ silent: true })
    this.graph = structuredClone(snapshot.graph)
    this.selectedNodeIds = new Set(snapshot.selectedNodeIds)
    this.selectedNodeId = snapshot.selectedNodeId
    this.selectedEdgeId = snapshot.selectedEdgeId
    this.draggedNodeId = null
    this.dragNodeStarts = null
    this.selectionDrag = null
    this.dragBeforeSnapshot = null
    this.setData(this.graph, { autoFit: false })
    this.renderInspector()
    this.syncHistoryControls()
  }

  recordEdit(label, before) {
    const after = this.captureSnapshot()
    if (JSON.stringify(before) === JSON.stringify(after)) return false
    this.history.clearRedo()
    this.history.add({
      undo: () => this.restoreSnapshot(before),
      redo: () => this.restoreSnapshot(after),
    })
    this.syncHistoryControls()
    return true
  }

  syncHistoryControls() {
    const undo = this.queryHeaderControl('[data-action="undo"]')
    const redo = this.queryHeaderControl('[data-action="redo"]')
    if (!(undo instanceof HTMLButtonElement) || !(redo instanceof HTMLButtonElement)) return
    undo.disabled = !this.history.canUndo()
    redo.disabled = !this.history.canRedo()
  }

  undo() {
    if (!this.history.undo()) return false
    this.syncHistoryControls()
    this.setStatus("Undid graph edit", "info")
    return true
  }

  redo() {
    if (!this.history.redo()) return false
    this.syncHistoryControls()
    this.setStatus("Redid graph edit", "info")
    return true
  }

  clipboardPayload() {
    if (this.selectedNodeIds.size === 0) return null
    const selected = new Set(this.selectedNodeIds)
    return {
      format: CLIPBOARD_FORMAT,
      version: 1,
      nodes: structuredClone(this.graph.nodes.filter((node) => selected.has(node.id))),
      edges: structuredClone(this.graph.edges.filter((edge) => selected.has(edge.from) && selected.has(edge.to))),
    }
  }

  async copy() {
    const payload = this.clipboardPayload()
    if (!payload) {
      this.setStatus("Select one or more states to copy", "warning")
      return false
    }
    assert(navigator.clipboard, "view-animation-tree copy requires navigator.clipboard")
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    this.setStatus(`Copied ${payload.nodes.length} state${payload.nodes.length === 1 ? "" : "s"}`, "success")
    return true
  }

  parseClipboardPayload(text) {
    const payload = JSON.parse(String(text))
    assert(payload && typeof payload === "object", "view-animation-tree clipboard payload must be an object")
    assert(payload.format === CLIPBOARD_FORMAT, "view-animation-tree clipboard format is not supported")
    assert(payload.version === 1, "view-animation-tree clipboard version is not supported")
    assert(Array.isArray(payload.nodes) && payload.nodes.length > 0, "view-animation-tree clipboard requires nodes")
    assert(Array.isArray(payload.edges), "view-animation-tree clipboard requires edges")
    return payload
  }

  async paste() {
    assert(navigator.clipboard, "view-animation-tree paste requires navigator.clipboard")
    const payload = this.parseClipboardPayload(await navigator.clipboard.readText())
    const before = this.captureSnapshot()
    const idMap = new Map()
    let nextNodeId = Math.max(...this.graph.nodes.map((node) => node.id)) + 1
    for (const node of payload.nodes) idMap.set(node.id, nextNodeId++)
    const minX = Math.min(...payload.nodes.map((node) => node.x))
    const minY = Math.min(...payload.nodes.map((node) => node.y))
    const maxX = Math.max(...payload.nodes.map((node) => node.x + this.renderer.config.node.width))
    const maxY = Math.max(...payload.nodes.map((node) => node.y + this.renderer.config.node.height))
    assert(this.lastPointerWorld, "view-animation-tree paste requires the pointer to have visited the canvas")
    const offsetX = this.lastPointerWorld.x - (minX + maxX) / 2
    const offsetY = this.lastPointerWorld.y - (minY + maxY) / 2
    const nodes = payload.nodes.map((node) => ({
      ...structuredClone(node),
      id: idMap.get(node.id),
      x: Math.round(node.x + offsetX),
      y: Math.round(node.y + offsetY),
      start: false,
    }))
    let nextEdgeId = this.graph.edges.length ? Math.max(...this.graph.edges.map((edge) => edge.id)) + 1 : 1
    const edges = payload.edges.map((edge) => ({
      ...structuredClone(edge),
      id: nextEdgeId++,
      from: idMap.get(edge.from),
      to: idMap.get(edge.to),
    }))
    assert(edges.every((edge) => edge.from !== undefined && edge.to !== undefined), "view-animation-tree pasted edge must reference pasted nodes")
    this.graph.nodes.push(...nodes)
    this.graph.edges.push(...edges)
    this.selectMode({ silent: true })
    this.setNodeSelection(nodes.map((node) => node.id), nodes[nodes.length - 1].id)
    this.setData(this.graph, { autoFit: false })
    this.renderInspector()
    this.recordEdit("paste states", before)
    this.setStatus(`Pasted ${nodes.length} state${nodes.length === 1 ? "" : "s"}`, "success")
    return true
  }

  nodeType(value) {
    const type = NODE_TYPES.find((candidate) => candidate.value === value)
    assert(type, `view-animation-tree unknown node type ${value}`)
    return type
  }

  nodeMenuItems() {
    return [
      {
        label: "Animation tree nodes",
        items: NODE_TYPES.map((type) => ({
          label: type.label,
          keywords: [type.label, type.value],
          value: { type: type.value },
        })),
      },
    ]
  }

  viewportCenterWorld() {
    const rect = this.canvas.getBoundingClientRect()
    return this.getWorldPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  async showNodeMenu(anchor, worldPoint) {
    const result = unwrap(
      await runtime.call("ui.tooltip.contextMenu", {
        anchor,
        searchable: true,
        placeholder: "Search animation nodes…",
        items: this.nodeMenuItems(),
      }),
      "ui.tooltip.contextMenu",
    )
    if (!result.ok) return false
    assert(result.selected && result.selected.value, "view-animation-tree node menu selection is required")
    this.addState(result.selected.value.type, worldPoint)
    return true
  }

  async showNodeMenuAtCanvasCenter() {
    const rect = this.canvas.getBoundingClientRect()
    await this.showNodeMenu(
      { kind: "point", x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      this.viewportCenterWorld(),
    )
  }

  async showNodeMenuForButton(button) {
    assert(button instanceof HTMLButtonElement, "view-animation-tree add button is required")
    const rect = button.getBoundingClientRect()
    await this.showNodeMenu(
      { kind: "point", x: rect.left + rect.width / 2, y: rect.bottom },
      this.viewportCenterWorld(),
    )
  }

  addState(typeValue = "animation", worldPoint = null) {
    const type = this.nodeType(typeValue)
    const before = this.captureSnapshot()
    const id = Math.max(...this.graph.nodes.map((node) => node.id)) + 1
    const point = worldPoint
      ? {
          x: worldPoint.x - this.renderer.config.node.width / 2,
          y: worldPoint.y - this.renderer.config.node.height / 2,
        }
      : { x: 120 + (id % 4) * 240, y: 100 + Math.floor(id / 4) * 160 }
    const node = {
      id,
      type: type.value,
      name: `${type.label} ${id}`,
      x: Math.round(point.x),
      y: Math.round(point.y),
      start: false,
    }
    this.graph.nodes.push(node)
    this.selectMode({ silent: true })
    this.setNodeSelection([node.id], node.id)
    this.setData(this.graph, { autoFit: false })
    this.renderInspector()
    this.recordEdit("add state", before)
    this.setStatus(`Added ${node.name}`, "success")
  }

  transitionMode(value) {
    const mode = TRANSITION_MODES.find((candidate) => candidate.value === value)
    assert(mode, `view-animation-tree unknown transition mode ${value}`)
    return mode
  }

  currentTransitionMode() {
    const mode = TRANSITION_MODES[this.transitionModeIndex]
    assert(mode, `view-animation-tree missing transition mode ${this.transitionModeIndex}`)
    return mode
  }

  syncModeControls() {
    const select = this.queryHeaderControl('[data-action="select-mode"]')
    const transition = this.queryHeaderControl('[data-action="transition-mode"]')
    if (!(select instanceof HTMLButtonElement) || !(transition instanceof HTMLButtonElement)) return
    const selecting = this.interactionMode === "select"
    const mode = this.currentTransitionMode()
    select.setAttribute("aria-pressed", selecting ? "true" : "false")
    select.classList.toggle("accent", selecting)
    transition.setAttribute("aria-pressed", selecting ? "false" : "true")
    transition.classList.toggle("accent", !selecting)
    transition.setAttribute("aria-label", `Transition mode: ${mode.label}`)
    transition.setAttribute("title", `Transition mode: ${mode.label}`)
    const icon = transition.querySelector("i")
    assert(icon instanceof HTMLElement, "view-animation-tree transition mode icon is required")
    icon.textContent = mode.icon
  }

  selectMode({ silent = false } = {}) {
    this.interactionMode = "select"
    this.connecting = false
    this.connectionSourceNodeId = null
    this.syncModeControls()
    if (this.canvas instanceof HTMLCanvasElement) this.canvas.style.cursor = this.hoveredNodeId === null ? "default" : "grab"
    if (!silent) this.setStatus("Select mode", "info")
  }

  cycleTransitionMode() {
    if (this.interactionMode === "transition")
      this.transitionModeIndex = (this.transitionModeIndex + 1) % TRANSITION_MODES.length
    this.interactionMode = "transition"
    this.connecting = true
    this.connectionSourceNodeId = null
    this.syncModeControls()
    this.canvas.style.cursor = "crosshair"
    this.setStatus(`${this.currentTransitionMode().label} transition: select the source state`, "accent")
  }

  cancelConnecting({ silent = false } = {}) {
    this.selectMode({ silent })
  }

  chooseConnectionNode(node) {
    assert(this.connecting, "view-animation-tree must be in transition creation mode")
    if (this.connectionSourceNodeId === null) {
      this.connectionSourceNodeId = node.id
      this.setNodeSelection([node.id], node.id)
      this.renderInspector()
      this.draw()
      this.setStatus(`${this.currentTransitionMode().label}: ${node.name} → select target`, "accent")
      return
    }

    const from = this.connectionSourceNodeId
    const to = node.id
    if (from === to) {
      this.setStatus("Self-transitions are not implemented in this slice", "warning")
      return
    }
    if (this.graph.edges.some((edge) => edge.from === from && edge.to === to)) {
      this.setStatus(`${this.stateName(from)} → ${this.stateName(to)} already exists`, "warning")
      return
    }
    const before = this.captureSnapshot()
    const id = this.graph.edges.length === 0 ? 1 : Math.max(...this.graph.edges.map((edge) => edge.id)) + 1
    const mode = this.currentTransitionMode()
    const edge = { id, from, to, switchMode: mode.value }
    this.graph.edges.push(edge)
    this.selectedNodeIds.clear()
    this.selectedNodeId = null
    this.selectedEdgeId = edge.id
    this.connectionSourceNodeId = null
    this.renderInspector()
    this.draw()
    this.recordEdit("add transition", before)
    this.setStatus(`Added ${mode.label}: ${this.stateName(from)} → ${this.stateName(to)} · select another source`, "success")
  }

  deleteSelected() {
    this.cancelConnecting({ silent: true })
    if (this.selectedNodeId === null && this.selectedEdgeId === null) {
      this.setStatus("Select a state or transition to delete", "warning")
      return false
    }
    const before = this.captureSnapshot()
    if (this.selectedEdgeId !== null) {
      const edge = this.selectedEdge()
      this.graph.edges = this.graph.edges.filter((candidate) => candidate.id !== edge.id)
      this.setNodeSelection([edge.from], edge.from)
      this.renderInspector()
      this.draw()
      this.recordEdit("delete transition", before)
      this.setStatus(`Deleted ${this.stateName(edge.from)} → ${this.stateName(edge.to)}`, "success")
      return
    }

    const selected = new Set(this.selectedNodeIds)
    assert(selected.size > 0, "view-animation-tree node deletion requires selected states")
    if (selected.size >= this.graph.nodes.length) {
      this.setStatus("The graph requires at least one state", "warning")
      return false
    }
    const deletedStart = this.graph.nodes.some((node) => selected.has(node.id) && node.start)
    const deletedEdges = this.graph.edges.filter((edge) => selected.has(edge.from) || selected.has(edge.to)).length
    this.graph.nodes = this.graph.nodes.filter((node) => !selected.has(node.id))
    this.graph.edges = this.graph.edges.filter((edge) => !selected.has(edge.from) && !selected.has(edge.to))
    const next = this.graph.nodes[0]
    assert(next, "view-animation-tree requires a state after deletion")
    if (deletedStart) next.start = true
    this.setNodeSelection([next.id], next.id)
    this.setData(this.graph, { autoFit: false })
    this.renderInspector()
    this.recordEdit("delete states", before)
    this.setStatus(`Deleted ${selected.size} state${selected.size === 1 ? "" : "s"} and ${deletedEdges} transition${deletedEdges === 1 ? "" : "s"}`, "success")
  }

  setStatus(message, tone) {
    assert(this.statusOutput instanceof HTMLOutputElement, "view-animation-tree status output is not initialized")
    this.statusOutput.textContent = message
    this.statusOutput.classList.remove("accent", "success", "warning", "danger", "info")
    this.statusOutput.classList.add(tone)
  }

  renderInspector() {
    assert(this.inspectorElement instanceof HTMLElement, "view-animation-tree inspector is not initialized")
    assert(this.selectionOutput instanceof HTMLOutputElement, "view-animation-tree selection output is not initialized")
    if (this.selectedEdgeId !== null) {
      const edge = this.selectedEdge()
      const label = `${this.stateName(edge.from)} → ${this.stateName(edge.to)}`
      this.selectionOutput.textContent = `Selected transition: ${label}`
      this.inspectorElement.innerHTML = `
        <form data-element="transition-inspector">
          <fieldset>
            <legend>Transition</legend>
            <label>From <output>${this.escapeAttribute(this.stateName(edge.from))}</output></label>
            <label>To <output>${this.escapeAttribute(this.stateName(edge.to))}</output></label>
            <label>Switch mode
              <select data-field="switch-mode">
                ${TRANSITION_MODES.map((mode) => `<option value="${mode.value}" ${mode.value === edge.switchMode ? "selected" : ""}>${mode.label}</option>`).join("")}
              </select>
            </label>
          </fieldset>
        </form>
      `
      const switchMode = this.inspectorElement.querySelector('[data-field="switch-mode"]')
      assert(switchMode instanceof HTMLSelectElement, "view-animation-tree missing transition switch mode select")
      switchMode.addEventListener("change", () => {
        const before = this.captureSnapshot()
        const mode = this.transitionMode(switchMode.value)
        edge.switchMode = mode.value
        this.recordEdit("change transition mode", before)
        this.draw()
        this.setStatus(`Changed ${label} to ${mode.label}`, "success")
      })
      return
    }
    if (this.selectedNodeId === null) {
      this.selectionOutput.textContent = "No selection"
      this.inspectorElement.innerHTML = "<output>Select a state or transition to inspect it.</output>"
      return
    }
    if (this.selectedNodeIds.size > 1) {
      const nodes = this.graph.nodes.filter((node) => this.selectedNodeIds.has(node.id))
      this.selectionOutput.textContent = `Selected: ${nodes.length} states`
      this.inspectorElement.innerHTML = `
        <table>
          <caption>Selected states</caption>
          <thead><tr><th>Name</th><th>Type</th></tr></thead>
          <tbody>${nodes.map((node) => `<tr><td>${this.escapeAttribute(node.name)}</td><td>${this.escapeAttribute(this.nodeType(node.type).label)}</td></tr>`).join("")}</tbody>
        </table>
      `
      return
    }

    const node = this.selectedNode()
    this.selectionOutput.textContent = `Selected: ${node.name}`
    this.inspectorElement.innerHTML = `
      <form data-element="state-inspector">
        <fieldset>
          <legend>State</legend>
          <label>Type <input type="text" value="${this.escapeAttribute(this.nodeType(node.type).label)}" disabled autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
          <label>Name <input type="text" data-field="name" value="${this.escapeAttribute(node.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
          <label>Start state <input type="radio" name="start-state" data-field="start" ${node.start ? "checked" : ""}></label>
        </fieldset>
        <fieldset>
          <legend>Animation</legend>
          <output>Animation assignment will be added after graph editing is validated.</output>
        </fieldset>
      </form>
    `
    const nameInput = this.inspectorElement.querySelector('[data-field="name"]')
    const startInput = this.inspectorElement.querySelector('[data-field="start"]')
    assert(nameInput instanceof HTMLInputElement, "view-animation-tree missing state name input")
    assert(startInput instanceof HTMLInputElement, "view-animation-tree missing start state input")
    let nameBefore = null
    nameInput.addEventListener("focus", () => {
      nameBefore = this.captureSnapshot()
    })
    nameInput.addEventListener("input", () => {
      const name = nameInput.value.trim()
      assert(name.length > 0, "view-animation-tree state name must not be empty")
      node.name = name
      this.selectionOutput.textContent = `Selected: ${node.name}`
      this.draw()
    })
    nameInput.addEventListener("change", () => {
      assert(nameBefore, "view-animation-tree name edit snapshot is required")
      this.recordEdit("rename state", nameBefore)
      nameBefore = this.captureSnapshot()
      this.setStatus(`Renamed state to ${node.name}`, "success")
    })
    startInput.addEventListener("change", () => {
      assert(startInput.checked, "view-animation-tree requires exactly one start state")
      const before = this.captureSnapshot()
      for (const candidate of this.graph.nodes) candidate.start = candidate.id === node.id
      this.renderInspector()
      this.draw()
      this.recordEdit("set start state", before)
      this.setStatus(`${node.name} is the start state`, "success")
    })
  }

  escapeAttribute(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  }

  calculateContentBounds(graph) {
    assert(this.renderer instanceof StateMachineGraphRenderer, "view-animation-tree renderer is not initialized")
    assert(graph === this.graph, "view-animation-tree data must reference its graph")
    return this.renderer.contentBounds(graph.nodes)
  }

  selectionRect() {
    assert(this.selectionDrag, "view-animation-tree selection drag is required")
    const { start, current } = this.selectionDrag
    return {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    }
  }

  drawContent(ctx, graph) {
    if (!graph) return
    assert(this.renderer instanceof StateMachineGraphRenderer, "view-animation-tree renderer is not initialized")
    this.renderer.draw(ctx, graph, {
      selectedNodeIds: this.selectedNodeIds,
      selectedEdgeId: this.selectedEdgeId,
      hoveredNodeId: this.hoveredNodeId,
    })
    if (this.selectionDrag) this.renderer.drawSelectionRect(ctx, this.selectionRect())
  }

  async _onContextMenu(event) {
    assert(this.renderer instanceof StateMachineGraphRenderer, "view-animation-tree renderer is not initialized")
    const worldPoint = this.getWorldPoint(event.clientX, event.clientY)
    this.lastPointerWorld = worldPoint
    const node = this.renderer.hitNode(this.graph.nodes, worldPoint)
    const edge = this.renderer.hitEdge(this.graph, worldPoint, 10 / this.scale)
    if (node || edge) return
    event.preventDefault()
    this.focus()
    await this.showNodeMenu(
      { kind: "point", x: event.clientX, y: event.clientY },
      worldPoint,
    )
  }

  onCanvasMouseDown(event) {
    assert(this.renderer instanceof StateMachineGraphRenderer, "view-animation-tree renderer is not initialized")
    if (event.button !== 0) return
    this.focus()
    const point = this.getWorldPoint(event.clientX, event.clientY)
    this.lastPointerWorld = point
    const node = this.renderer.hitNode(this.graph.nodes, point)
    if (this.connecting) {
      if (node) this.chooseConnectionNode(node)
      return
    }
    if (node) {
      if (!this.selectedNodeIds.has(node.id)) this.setNodeSelection([node.id], node.id)
      else {
        this.selectedNodeId = node.id
        this.selectedEdgeId = null
      }
      this.dragBeforeSnapshot = this.captureSnapshot()
      this.draggedNodeId = node.id
      this.dragStartPoint = point
      this.dragNodeStarts = new Map(
        this.graph.nodes.filter((candidate) => this.selectedNodeIds.has(candidate.id)).map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]),
      )
      this.canvas.style.cursor = "grabbing"
      this.renderInspector()
      this.draw()
      return
    }

    const edge = this.renderer.hitEdge(this.graph, point, 10 / this.scale)
    if (edge) {
      this.selectedNodeIds.clear()
      this.selectedNodeId = null
      this.selectedEdgeId = edge.id
      this.renderInspector()
      this.draw()
      this.setStatus(`Selected ${this.stateName(edge.from)} → ${this.stateName(edge.to)}`, "info")
      return
    }

    this.setNodeSelection([])
    this.selectionDrag = { start: point, current: point }
    this.renderInspector()
    this.draw()
  }

  onCanvasMouseMove(event) {
    assert(this.renderer instanceof StateMachineGraphRenderer, "view-animation-tree renderer is not initialized")
    const point = this.getWorldPoint(event.clientX, event.clientY)
    this.lastPointerWorld = point
    if (this.draggedNodeId !== null) {
      assert(this.dragStartPoint && this.dragNodeStarts instanceof Map, "view-animation-tree group drag state is required")
      const deltaX = point.x - this.dragStartPoint.x
      const deltaY = point.y - this.dragStartPoint.y
      for (const node of this.graph.nodes) {
        const start = this.dragNodeStarts.get(node.id)
        if (!start) continue
        node.x = start.x + deltaX
        node.y = start.y + deltaY
      }
      this.contentBounds = this.calculateContentBounds(this.graph)
      this.draw()
      return
    }
    if (this.selectionDrag) {
      this.selectionDrag.current = point
      const rect = this.selectionRect()
      const selected = this.graph.nodes
        .filter((node) => {
          const bounds = this.renderer.nodeBounds(node)
          return bounds.x <= rect.x + rect.width && bounds.x + bounds.width >= rect.x && bounds.y <= rect.y + rect.height && bounds.y + bounds.height >= rect.y
        })
        .map((node) => node.id)
      const previous = [...this.selectedNodeIds]
      if (previous.length !== selected.length || previous.some((id, index) => id !== selected[index])) {
        this.setNodeSelection(selected)
        this.renderInspector()
      }
      this.draw()
      return
    }
    const node = this.renderer.hitNode(this.graph.nodes, point)
    const hoveredNodeId = node ? node.id : null
    const cursor = this.connecting ? "crosshair" : node ? "grab" : "default"
    if (hoveredNodeId === this.hoveredNodeId) {
      this.canvas.style.cursor = cursor
      return
    }
    this.hoveredNodeId = hoveredNodeId
    this.canvas.style.cursor = cursor
    this.draw()
  }

  finishNodeDrag() {
    if (this.draggedNodeId === null) return
    assert(this.dragBeforeSnapshot, "view-animation-tree drag history snapshot is required")
    const count = this.selectedNodeIds.size
    this.draggedNodeId = null
    this.dragNodeStarts = null
    this.dragStartPoint = null
    const changed = this.recordEdit("move states", this.dragBeforeSnapshot)
    this.dragBeforeSnapshot = null
    if (changed) this.setStatus(`Moved ${count} state${count === 1 ? "" : "s"}`, "info")
  }

  finishSelectionDrag() {
    if (!this.selectionDrag) return
    const count = this.selectedNodeIds.size
    this.selectionDrag = null
    this.renderInspector()
    this.draw()
    this.setStatus(count ? `Selected ${count} state${count === 1 ? "" : "s"}` : "Selection cleared", "info")
  }

  onCanvasMouseUp() {
    this.finishNodeDrag()
    this.finishSelectionDrag()
    this.canvas.style.cursor = this.hoveredNodeId === null ? "default" : "grab"
  }

  onCanvasMouseLeave() {
    this.finishNodeDrag()
    this.finishSelectionDrag()
    this.hoveredNodeId = null
    if (this.connecting) this.canvas.style.cursor = "crosshair"
    this.draw()
  }
}

if (!customElements.get("view-animation-tree")) {
  customElements.define("view-animation-tree", ViewAnimationTree)
}
