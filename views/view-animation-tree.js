import { runtime, unwrap } from "/core/runtime.js"
import {
    ANIMATION_NODE_KINDS,
    animationNodePath,
    cloneAnimationNodeWithNewIds,
    createAnimationNode,
    createDemoAnimationTreeDocument,
    validateAnimationTreeDocument,
} from "/util/animation-tree.js"
import { NodeGraph } from "/util/node-graph.js"
import { NodeGraphRenderer } from "/util/node-graph-renderer.js"
import { ViewCanvasBase } from "/util/view-canvas-base.js"
import { StateMachineGraph } from "/util/state-machine-graph.js"
import { StateMachineGraphRenderer } from "/util/state-machine-graph-renderer.js"
import { UndoHistory } from "/util/undo.js"
import "/widgets/breadcrumbs.js"

function assert(condition, message) {
    if (!condition) throw new Error(message)
}

function canvasBackgroundColor(value) {
    assert(Array.isArray(value) && value.length === 4, "view-animation-tree background must contain four numbers")
    value.forEach((channel, index) => assert(typeof channel === "number" && Number.isFinite(channel), `view-animation-tree background[${index}] must be finite`))
    return `rgba(${Math.round(value[0] * 255)}, ${Math.round(value[1] * 255)}, ${Math.round(value[2] * 255)}, ${value[3]})`
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

const BLEND_NODE_TYPES = [
    { value: ANIMATION_NODE_KINDS.ANIMATION, label: "Animation" },
    { value: ANIMATION_NODE_KINDS.ONE_SHOT, label: "OneShot" },
    { value: ANIMATION_NODE_KINDS.BLEND_2, label: "Blend" },
    { value: ANIMATION_NODE_KINDS.TIME_SEEK, label: "TimeSeek" },
    { value: ANIMATION_NODE_KINDS.TIME_SCALE, label: "TimeScale" },
    { value: ANIMATION_NODE_KINDS.SWITCH, label: "Switch" },
    { value: ANIMATION_NODE_KINDS.BLEND_TREE, label: "BlendTree" },
    { value: ANIMATION_NODE_KINDS.BLEND_SPACE_1D, label: "BlendSpace1D" },
    { value: ANIMATION_NODE_KINDS.BLEND_SPACE_2D, label: "BlendSpace2D" },
    { value: ANIMATION_NODE_KINDS.STATE_MACHINE, label: "StateMachine" },
]

function stateMachineRequiredNodes(node) {
    return [
        {
            node: { id: "start", type: "entry", name: "Start", icon: "play_arrow", style: "required", ...node.graph.start.position },
            constraints: {
                incoming: { max: 0 },
                outgoing: { max: 1, edgeKind: "entry" },
                deletable: false,
                copyable: false,
                renameable: false,
            },
        },
        {
            node: { id: "end", type: "exit", name: "End", icon: "stop", style: "required", ...node.graph.end.position },
            constraints: {
                incoming: { max: null },
                outgoing: { max: 0, edgeKind: "transition" },
                deletable: false,
                copyable: false,
                renameable: false,
            },
        },
    ]
}

function projectStateMachineGraph(node) {
    return {
        nodes: node.graph.states.map((state) => ({
            id: state.node.id,
            type: state.node.kind,
            name: state.node.name,
            animationNode: structuredClone(state.node),
            ...state.position,
        })),
        edges: structuredClone(node.graph.transitions),
    }
}

function blendTreeRequiredNodes(node) {
    return [
        {
            node: {
                id: node.graph.output.id,
                kind: "output",
                name: node.graph.output.name,
                ports: [{ id: "animation", direction: "input", dataType: "animation", maxConnections: 1 }],
                ...node.graph.output.position,
            },
            constraints: { deletable: false, copyable: false, renameable: false },
        },
    ]
}

function projectBlendTreeGraph(node) {
    return {
        nodes: node.graph.nodes.map((placement) => ({ ...structuredClone(placement.node), ...placement.position })),
        edges: structuredClone(node.graph.edges),
    }
}

export class ViewAnimationTree extends ViewCanvasBase {
    constructor() {
        super()
        this.renderer = null
        this.nodeGraphRenderer = null
        this.history = new UndoHistory()
        this.animationTree = createDemoAnimationTreeDocument()
        this.activeNodePath = [this.animationTree.root.id]
        this.activeNode = this.animationTree.root
        this.graphModel = null
        this.graph = null
        this.loadActiveGraph()
        this.selectedNodeIds = new Set(["idle"])
        this.selectedNodeId = "idle"
        this.selectedEdgeId = null
        this.hoveredNodeId = null
        this.hoveredTransitionNodeId = null
        this.hoveredPort = null
        this.nodeConnectionDrag = null
        this.draggedNodeId = null
        this.dragNodeStarts = null
        this.selectionDrag = null
        this.lastPointerWorld = null
        this.connectionSourceNodeId = null
        this.connectionStartPoint = null
        this.connectionPointer = null
        this.dragStartPoint = null
        this.dragBeforeSnapshot = null
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
        this.nodeGraphRenderer = new NodeGraphRenderer(this.viewConfig.config.nodeGraphRenderer)

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
        this.canvas.style.backgroundColor = canvasBackgroundColor(this.viewConfig.config.background)
        this.canvas.addEventListener("contextmenu", this._onContextMenu)
        this.setData(this.graph)
        this.renderInspector()
        this.syncHistoryControls()
        this.syncTransitionModeControl()
        this.syncActiveEditorControls()
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
        }
    }

    loadActiveGraph() {
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.STATE_MACHINE) {
            this.graphModel = new StateMachineGraph({
                graph: projectStateMachineGraph(this.activeNode),
                requiredNodes: stateMachineRequiredNodes(this.activeNode),
            })
            this.graph = this.graphModel.graph
            return
        }
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
            this.graphModel = new NodeGraph({
                graph: projectBlendTreeGraph(this.activeNode),
                requiredNodes: blendTreeRequiredNodes(this.activeNode),
                allowCycles: false,
            })
            this.graph = this.graphModel.graph
            return
        }
        this.graphModel = null
        this.graph = { nodes: [], edges: [] }
    }

    syncActiveGraph() {
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.STATE_MACHINE) {
            assert(this.graphModel instanceof StateMachineGraph, "view-animation-tree active state machine model is required")
            const requiredIds = new Set(["start", "end"])
            this.activeNode.graph.states = this.graph.nodes
                .filter((node) => !requiredIds.has(node.id))
                .map((node) => {
                    const animationNode = structuredClone(node.animationNode)
                    animationNode.name = node.name
                    animationNode.kind = node.type
                    return { node: animationNode, position: { x: node.x, y: node.y } }
                })
            this.activeNode.graph.transitions = structuredClone(this.graph.edges)
            const start = this.graph.nodes.find((node) => node.id === "start")
            const end = this.graph.nodes.find((node) => node.id === "end")
            assert(start && end, "view-animation-tree state machine requires start and end")
            this.activeNode.graph.start.position = { x: start.x, y: start.y }
            this.activeNode.graph.end.position = { x: end.x, y: end.y }
            return
        }
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
            assert(this.graphModel instanceof NodeGraph, "view-animation-tree active blend tree model is required")
            this.activeNode.graph.nodes = this.graph.nodes
                .filter((node) => !this.graphModel.isRequired(node.id))
                .map((node) => {
                    const animationNode = structuredClone(node)
                    delete animationNode.x
                    delete animationNode.y
                    return { node: animationNode, position: { x: node.x, y: node.y } }
                })
            this.activeNode.graph.edges = structuredClone(this.graph.edges)
            const output = this.graph.nodes.find((node) => this.graphModel.isRequired(node.id))
            assert(output, "view-animation-tree blend tree requires output")
            this.activeNode.graph.output.position = { x: output.x, y: output.y }
        }
    }

    breadcrumbItems() {
        const path = animationNodePath(this.animationTree, this.activeNode.id)
        assert(path, `view-animation-tree missing active node path ${this.activeNode.id}`)
        return path.map((node, index) => ({
            id: node.id,
            label: index === 0 ? this.animationTree.name : node.name,
            icon: index === 0 ? "account_tree" : this.animationNodeIcon(node.kind),
        }))
    }

    animationNodeIcon(kind) {
        if (kind === ANIMATION_NODE_KINDS.ANIMATION) return "animation"
        if (kind === ANIMATION_NODE_KINDS.ONE_SHOT) return "looks_one"
        if (kind === ANIMATION_NODE_KINDS.BLEND_2) return "call_merge"
        if (kind === ANIMATION_NODE_KINDS.TIME_SEEK) return "more_time"
        if (kind === ANIMATION_NODE_KINDS.TIME_SCALE) return "speed"
        if (kind === ANIMATION_NODE_KINDS.SWITCH) return "toggle_on"
        if (kind === ANIMATION_NODE_KINDS.BLEND_TREE) return "schema"
        if (kind === ANIMATION_NODE_KINDS.BLEND_SPACE_1D) return "linear_scale"
        if (kind === ANIMATION_NODE_KINDS.BLEND_SPACE_2D) return "scatter_plot"
        if (kind === ANIMATION_NODE_KINDS.STATE_MACHINE) return "account_tree"
        throw new Error(`view-animation-tree unknown animation node kind ${kind}`)
    }

    navigateToAnimationNode(nodeId) {
        this.syncActiveGraph()
        validateAnimationTreeDocument(this.animationTree)
        const path = animationNodePath(this.animationTree, nodeId)
        assert(path, `view-animation-tree missing animation node ${nodeId}`)
        this.activeNodePath = path.map((node) => node.id)
        this.activeNode = path[path.length - 1]
        this.loadActiveGraph()
        this.cancelTransitionDrag()
        this.nodeConnectionDrag = null
        this.hoveredPort = null
        this.hoveredNodeId = null
        this.hoveredTransitionNodeId = null
        this.setNodeSelection([])
        const breadcrumbs = this.queryHeaderControl('[data-element="breadcrumbs"]')
        assert(breadcrumbs instanceof HTMLElement && breadcrumbs.localName === "widget-breadcrumbs", "view-animation-tree missing breadcrumbs control")
        breadcrumbs.items = this.breadcrumbItems()
        this.syncActiveEditorControls()
        if (this.graphModel === null) {
            this.scale = 1
            this.offsetX = 0
            this.offsetY = 0
        }
        this.setData(this.graph)
        this.renderInspector()
        this.setStatus(`Editing ${this.activeNode.name}`, "info")
    }

    async edit() {
        if (this.selectedNodeIds.size !== 1) {
            this.setStatus("Select exactly one node to edit", "warning")
            return false
        }
        const nodeId = this.selectedNodeId ?? [...this.selectedNodeIds][0]
        const path = animationNodePath(this.animationTree, nodeId)
        if (!path) {
            this.setStatus("Structural graph nodes have no embedded Animation Node", "warning")
            return false
        }
        this.navigateToAnimationNode(nodeId)
        return true
    }

    syncActiveEditorControls() {
        const transition = this.queryHeaderControl('[data-action="transition-mode"]')
        const add = this.queryHeaderControl('[data-action="add-state"]')
        const remove = this.queryHeaderControl('[data-action="delete"]')
        if (transition instanceof HTMLButtonElement) transition.hidden = this.activeNode.kind !== ANIMATION_NODE_KINDS.STATE_MACHINE
        if (add instanceof HTMLButtonElement) add.disabled = this.graphModel === null
        if (remove instanceof HTMLButtonElement) remove.disabled = this.graphModel === null
    }

    async add() {
        if (this.graphModel === null) {
            this.setStatus(`${this.activeNode.name} does not contain graph nodes`, "info")
            return false
        }
        await this.showNodeMenuAtCanvasCenter()
        return true
    }

    clearSelection() {
        const hasSelection = this.selectedNodeIds.size > 0 || this.selectedEdgeId !== null
        if (!hasSelection && this.activeNodePath.length > 1) {
            const parentNodeId = this.activeNodePath[this.activeNodePath.length - 2]
            assert(typeof parentNodeId === "string" && parentNodeId.length > 0, "view-animation-tree parent animation node id is required")
            this.navigateToAnimationNode(parentNodeId)
            return true
        }
        this.cancelTransitionDrag()
        this.nodeConnectionDrag = null
        this.hoveredPort = null
        this.setNodeSelection([])
        this.renderInspector()
        this.draw()
        this.setStatus("Selection cleared", "info")
        return true
    }

    createHeaderControlsElement() {
        const controls = document.createElement("div")
        controls.innerHTML = `
      <widget-breadcrumbs data-element="breadcrumbs"></widget-breadcrumbs>
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="new" aria-label="New graph" title="New graph" disabled><i aria-hidden="true">docs</i></button>
        <button type="button" data-action="open" aria-label="Open graph" title="Open graph" disabled><i aria-hidden="true">folder_open</i></button>
        <button type="button" data-action="save" aria-label="Save graph" title="Save graph" disabled><i aria-hidden="true">save</i></button>
        <button type="button" data-action="save-as" aria-label="Save graph as" title="Save graph as" disabled><i aria-hidden="true">save_as</i></button>
        <button type="button" data-action="reload" aria-label="Reload graph" title="Reload graph" disabled><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <button type="button" data-action="transition-mode" aria-label="New transition type: Immediate" title="New transition type: Immediate"><i aria-hidden="true">play_arrow</i></button>
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

        const breadcrumbs = controls.querySelector('[data-element="breadcrumbs"]')
        assert(breadcrumbs instanceof HTMLElement && breadcrumbs.localName === "widget-breadcrumbs", "view-animation-tree missing breadcrumbs control")
        breadcrumbs.items = this.breadcrumbItems()
        breadcrumbs.addEventListener("navigate", (event) => this.navigateToAnimationNode(event.detail.id))

        for (const [name, button] of Object.entries(actions)) assert(button instanceof HTMLButtonElement, `view-animation-tree missing ${name} control`)
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
        this.syncActiveGraph()
        return {
            animationTree: structuredClone(this.animationTree),
            activeNodeId: this.activeNode.id,
            selectedNodeIds: [...this.selectedNodeIds],
            selectedNodeId: this.selectedNodeId,
            selectedEdgeId: this.selectedEdgeId,
        }
    }

    restoreSnapshot(snapshot) {
        assert(snapshot && typeof snapshot === "object", "view-animation-tree history snapshot is required")
        this.cancelTransitionDrag()
        this.animationTree = structuredClone(snapshot.animationTree)
        validateAnimationTreeDocument(this.animationTree)
        const path = animationNodePath(this.animationTree, snapshot.activeNodeId)
        assert(path, `view-animation-tree history missing active node ${snapshot.activeNodeId}`)
        this.activeNodePath = path.map((node) => node.id)
        this.activeNode = path[path.length - 1]
        this.loadActiveGraph()
        this.selectedNodeIds = new Set(snapshot.selectedNodeIds)
        this.selectedNodeId = snapshot.selectedNodeId
        this.selectedEdgeId = snapshot.selectedEdgeId
        this.draggedNodeId = null
        this.dragNodeStarts = null
        this.selectionDrag = null
        this.dragBeforeSnapshot = null
        this.nodeConnectionDrag = null
        const breadcrumbs = this.queryHeaderControl('[data-element="breadcrumbs"]')
        assert(breadcrumbs instanceof HTMLElement && breadcrumbs.localName === "widget-breadcrumbs", "view-animation-tree missing breadcrumbs control")
        breadcrumbs.items = this.breadcrumbItems()
        this.syncActiveEditorControls()
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
        if (!(this.graphModel instanceof StateMachineGraph) || this.selectedNodeIds.size === 0) return null
        const selected = new Set([...this.selectedNodeIds].filter((id) => this.graphModel.canCopyNode(id)))
        if (selected.size === 0) return null
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
        if (!(this.graphModel instanceof StateMachineGraph)) {
            this.setStatus("Copy and paste for this editor is not implemented", "info")
            return false
        }
        assert(navigator.clipboard, "view-animation-tree paste requires navigator.clipboard")
        const payload = this.parseClipboardPayload(await navigator.clipboard.readText())
        const before = this.captureSnapshot()
        const idMap = new Map()
        const animationNodes = new Map()
        for (const node of payload.nodes) {
            const animationNode = cloneAnimationNodeWithNewIds(node.animationNode)
            idMap.set(node.id, animationNode.id)
            animationNodes.set(node.id, animationNode)
        }
        const minX = Math.min(...payload.nodes.map((node) => node.x))
        const minY = Math.min(...payload.nodes.map((node) => node.y))
        const maxX = Math.max(...payload.nodes.map((node) => node.x + this.renderer.config.node.width))
        const maxY = Math.max(...payload.nodes.map((node) => node.y + this.renderer.config.node.height))
        assert(this.lastPointerWorld, "view-animation-tree paste requires the pointer to have visited the canvas")
        const offsetX = this.lastPointerWorld.x - (minX + maxX) / 2
        const offsetY = this.lastPointerWorld.y - (minY + maxY) / 2
        const nodes = payload.nodes.map((node) => {
            const animationNode = animationNodes.get(node.id)
            assert(animationNode, `view-animation-tree missing cloned animation node ${node.id}`)
            return {
                id: animationNode.id,
                type: animationNode.kind,
                name: animationNode.name,
                animationNode,
                x: Math.round(node.x + offsetX),
                y: Math.round(node.y + offsetY),
            }
        })
        let nextEdgeId = this.graph.edges.length ? Math.max(...this.graph.edges.map((edge) => edge.id)) + 1 : 1
        const edges = payload.edges.map((edge) => ({
            ...structuredClone(edge),
            id: nextEdgeId++,
            from: idMap.get(edge.from),
            to: idMap.get(edge.to),
        }))
        assert(
            edges.every((edge) => edge.from !== undefined && edge.to !== undefined),
            "view-animation-tree pasted edge must reference pasted nodes",
        )
        for (const node of nodes) this.graphModel.addNode(node)
        for (const edge of edges) {
            edge.kind = "transition"
            this.graphModel.addEdge(edge)
        }
        this.cancelTransitionDrag()
        this.setNodeSelection(
            nodes.map((node) => node.id),
            nodes[nodes.length - 1].id,
        )
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
        const types = this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE ? BLEND_NODE_TYPES : NODE_TYPES
        return [
            {
                label: this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE ? "Blend tree nodes" : "Animation tree nodes",
                items: types.map((type) => ({
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
        await this.showNodeMenu({ kind: "point", x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, this.viewportCenterWorld())
    }

    async showNodeMenuForButton(button) {
        assert(button instanceof HTMLButtonElement, "view-animation-tree add button is required")
        const rect = button.getBoundingClientRect()
        await this.showNodeMenu({ kind: "point", x: rect.left + rect.width / 2, y: rect.bottom }, this.viewportCenterWorld())
    }

    addState(typeValue = "animation", worldPoint = null) {
        assert(this.graphModel, "view-animation-tree active graph model is required")
        const types = this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE ? BLEND_NODE_TYPES : NODE_TYPES
        const type = types.find((candidate) => candidate.value === typeValue)
        assert(type, `view-animation-tree unknown node type ${typeValue}`)
        const before = this.captureSnapshot()
        const animationNode = createAnimationNode(type.value, { name: type.label })
        const activeRenderer = this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE ? this.nodeGraphRenderer : this.renderer
        const width = activeRenderer.config.node.width
        const point = worldPoint
            ? { x: worldPoint.x - width / 2, y: worldPoint.y - 30 }
            : { x: 120 + (this.graph.nodes.length % 4) * 240, y: 100 + Math.floor(this.graph.nodes.length / 4) * 160 }
        const node =
            this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE
                ? { ...structuredClone(animationNode), x: Math.round(point.x), y: Math.round(point.y) }
                : {
                      id: animationNode.id,
                      type: animationNode.kind,
                      name: animationNode.name,
                      animationNode,
                      x: Math.round(point.x),
                      y: Math.round(point.y),
                  }
        this.graphModel.addNode(node)
        this.cancelTransitionDrag()
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

    syncTransitionModeControl() {
        const transition = this.queryHeaderControl('[data-action="transition-mode"]')
        if (!(transition instanceof HTMLButtonElement)) return
        const mode = this.currentTransitionMode()
        transition.setAttribute("aria-label", `New transition type: ${mode.label}`)
        transition.setAttribute("title", `New transition type: ${mode.label}`)
        const icon = transition.querySelector("i")
        assert(icon instanceof HTMLElement, "view-animation-tree transition mode icon is required")
        icon.textContent = mode.icon
    }

    cycleTransitionMode() {
        this.transitionModeIndex = (this.transitionModeIndex + 1) % TRANSITION_MODES.length
        this.syncTransitionModeControl()
        this.setStatus(`New transitions use ${this.currentTransitionMode().label}`, "info")
    }

    cancelTransitionDrag() {
        this.connectionSourceNodeId = null
        this.connectionStartPoint = null
        this.connectionPointer = null
    }

    beginTransitionDrag(node, point) {
        assert(this.graphModel.transitionSourceState(node.id) === "available", `view-animation-tree node ${node.id} cannot start a transition`)
        this.connectionSourceNodeId = node.id
        this.connectionStartPoint = point
        this.connectionPointer = point
        this.setNodeSelection([node.id], node.id)
        this.renderInspector()
        this.draw()
        const edgeKind = this.graphModel.edgeKindFrom(node.id)
        const label = edgeKind === "entry" ? "Entry" : this.currentTransitionMode().label
        this.setStatus(`${label}: drag ${node.name} to a target state`, "accent")
    }

    finishTransitionDrag(target) {
        assert(this.connectionSourceNodeId !== null, "view-animation-tree transition drag requires a source state")
        const from = this.connectionSourceNodeId
        this.cancelTransitionDrag()
        if (!target) {
            this.draw()
            this.setStatus("Transition cancelled · drag to a target state", "info")
            return false
        }

        const to = target.id
        const result = this.graphModel.canAddEdge(from, to)
        if (!result.ok) {
            this.draw()
            this.setStatus(result.reason, "warning")
            return false
        }
        const before = this.captureSnapshot()
        const id = this.graph.edges.length === 0 ? 1 : Math.max(...this.graph.edges.map((edge) => edge.id)) + 1
        const kind = this.graphModel.edgeKindFrom(from)
        const mode = this.currentTransitionMode()
        const edge = kind === "entry" ? { id, kind, from, to } : { id, kind, from, to, switchMode: mode.value }
        this.graphModel.addEdge(edge)
        this.selectedNodeIds.clear()
        this.selectedNodeId = null
        this.selectedEdgeId = edge.id
        this.renderInspector()
        this.draw()
        this.recordEdit("add transition", before)
        const label = kind === "entry" ? "entry" : mode.label
        this.setStatus(`Added ${label}: ${this.stateName(from)} → ${this.stateName(to)} · drag to create another`, "success")
        return true
    }

    deleteSelected() {
        this.cancelTransitionDrag()
        if (this.selectedNodeId === null && this.selectedEdgeId === null) {
            this.setStatus("Select a state or transition to delete", "warning")
            return false
        }
        const before = this.captureSnapshot()
        if (this.selectedEdgeId !== null) {
            const edge = this.selectedEdge()
            this.graphModel.removeEdge(edge.id)
            if (this.graphModel instanceof NodeGraph) {
                this.setNodeSelection([edge.from.nodeId], edge.from.nodeId)
                this.renderInspector()
                this.draw()
                this.recordEdit("delete connection", before)
                this.setStatus(`Deleted ${edge.from.nodeId}.${edge.from.portId} → ${edge.to.nodeId}.${edge.to.portId}`, "success")
                return
            }
            this.setNodeSelection([edge.from], edge.from)
            this.renderInspector()
            this.draw()
            this.recordEdit("delete transition", before)
            this.setStatus(`Deleted ${this.stateName(edge.from)} → ${this.stateName(edge.to)}`, "success")
            return
        }

        assert(this.selectedNodeIds.size > 0, "view-animation-tree node deletion requires selected states")
        const result = this.graphModel.removeNodes(this.selectedNodeIds)
        if (result.removedNodeIds.length === 0) {
            this.setStatus("Required nodes cannot be deleted", "warning")
            return false
        }
        const nextSelection = result.preservedNodeIds.length > 0 ? result.preservedNodeIds : [this.graph.nodes[0].id]
        this.setNodeSelection(nextSelection)
        this.setData(this.graph, { autoFit: false })
        this.renderInspector()
        this.recordEdit("delete states", before)
        const preserved = result.preservedNodeIds.length > 0 ? ` · preserved ${result.preservedNodeIds.length} required` : ""
        this.setStatus(
            `Deleted ${result.removedNodeIds.length} state${result.removedNodeIds.length === 1 ? "" : "s"} and ${result.removedEdgeCount} transition${result.removedEdgeCount === 1 ? "" : "s"}${preserved}`,
            "success",
        )
    }

    setStatus(message, tone) {
        assert(this.statusOutput instanceof HTMLOutputElement, "view-animation-tree status output is not initialized")
        this.statusOutput.textContent = message
        this.statusOutput.classList.remove("accent", "success", "warning", "danger", "info")
        this.statusOutput.classList.add(tone)
    }

    blendNodeInspector(node) {
        const number = (label, target, value, attributes = "") =>
            `<label>${label} <input type="number" data-target="${target}" data-value-type="number" value="${value}" ${attributes} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>`
        if (node.kind === ANIMATION_NODE_KINDS.ANIMATION)
            return {
                legend: "Animation",
                fields: `<label>Animation <input type="text" data-target="animation" value="${this.escapeAttribute(node.animation)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>`,
            }
        if (node.kind === ANIMATION_NODE_KINDS.ONE_SHOT)
            return {
                legend: "OneShot",
                fields: `<label>Active <input type="checkbox" data-target="parameters.active" ${node.parameters.active ? "checked" : ""}></label>`,
            }
        if (node.kind === ANIMATION_NODE_KINDS.BLEND_2)
            return { legend: "Blend", fields: "<output>Combines both inputs fully.</output>" }
        if (node.kind === ANIMATION_NODE_KINDS.TIME_SEEK)
            return { legend: "TimeSeek", fields: number("Seek time", "parameters.seekTime", node.parameters.seekTime, 'min="0" step="0.01"') }
        if (node.kind === ANIMATION_NODE_KINDS.TIME_SCALE)
            return { legend: "TimeScale", fields: number("Scale", "parameters.scale", node.parameters.scale, 'step="0.05"') }
        if (node.kind === ANIMATION_NODE_KINDS.SWITCH) {
            const inputs = node.ports.filter((port) => port.direction === "input")
            return {
                legend: "Switch",
                fields: `<label>Current input
            <select data-target="parameters.currentInput">
              ${inputs.map((port) => `<option value="${this.escapeAttribute(port.id)}" ${node.parameters.currentInput === port.id ? "selected" : ""}>${this.escapeAttribute(port.name)}</option>`).join("")}
            </select>
          </label>
          <table class="compact-actions" data-element="switch-inputs">
            <caption>Inputs</caption>
            <thead><tr><th>Name</th><th aria-label="Actions"></th></tr></thead>
            <tbody>
              ${inputs
                  .map(
                      (port) => `<tr data-port-id="${this.escapeAttribute(port.id)}">
                <td><input type="text" data-port-name="${this.escapeAttribute(port.id)}" value="${this.escapeAttribute(port.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></td>
                <td><button type="button" class="danger" data-action="remove-switch-input" data-port-id="${this.escapeAttribute(port.id)}" aria-label="Delete ${this.escapeAttribute(port.name)}" title="Delete ${this.escapeAttribute(port.name)}" ${inputs.length <= 2 ? "disabled" : ""}><i aria-hidden="true">delete</i></button></td>
              </tr>`,
                  )
                  .join("")}
            </tbody>
          </table>
          <button type="button" data-action="add-switch-input"><i aria-hidden="true">add</i> Add input</button>`,
            }
        }
        if (node.kind === ANIMATION_NODE_KINDS.BLEND_TREE)
            return {
                legend: "BlendTree",
                fields: `<label>Nodes <output>${node.graph.nodes.length}</output></label><label>Connections <output>${node.graph.edges.length}</output></label>`,
                editor: true,
            }
        if (node.kind === ANIMATION_NODE_KINDS.BLEND_SPACE_1D)
            return {
                legend: "BlendSpace1D",
                fields: `${number("Blend position", "parameters.blendPosition", node.parameters.blendPosition, 'step="0.05"')}
          ${number("Minimum", "parameters.min", node.parameters.min, 'step="0.05"')}
          ${number("Maximum", "parameters.max", node.parameters.max, 'step="0.05"')}
          <label>Points <output>${node.points.length}</output></label>`,
            }
        if (node.kind === ANIMATION_NODE_KINDS.BLEND_SPACE_2D)
            return {
                legend: "BlendSpace2D",
                fields: `${number("Blend X", "parameters.blendX", node.parameters.blendX, 'step="0.05"')}
          ${number("Blend Y", "parameters.blendY", node.parameters.blendY, 'step="0.05"')}
          ${number("Minimum X", "parameters.minX", node.parameters.minX, 'step="0.05"')}
          ${number("Maximum X", "parameters.maxX", node.parameters.maxX, 'step="0.05"')}
          ${number("Minimum Y", "parameters.minY", node.parameters.minY, 'step="0.05"')}
          ${number("Maximum Y", "parameters.maxY", node.parameters.maxY, 'step="0.05"')}
          <label>Points <output>${node.points.length}</output></label>`,
            }
        if (node.kind === ANIMATION_NODE_KINDS.STATE_MACHINE)
            return {
                legend: "StateMachine",
                fields: `<label>States <output>${node.graph.states.length}</output></label><label>Transitions <output>${node.graph.transitions.length}</output></label>`,
                editor: true,
            }
        throw new Error(`view-animation-tree missing inspector for animation node kind ${node.kind}`)
    }

    setBlendNodeValue(node, target, input) {
        const path = target.split(".")
        let owner = node
        for (const part of path.slice(0, -1)) owner = owner[part]
        const key = path[path.length - 1]
        if (input instanceof HTMLInputElement && input.type === "checkbox") owner[key] = input.checked
        else if (input.dataset.valueType === "number") {
            assert(input instanceof HTMLInputElement && input.value.length > 0, `view-animation-tree ${target} requires a number`)
            owner[key] = input.valueAsNumber
            assert(Number.isFinite(owner[key]), `view-animation-tree ${target} must be finite`)
        } else owner[key] = input.value
    }

    addSwitchInput(node) {
        assert(node.kind === ANIMATION_NODE_KINDS.SWITCH, "view-animation-tree add input requires a switch node")
        const before = this.captureSnapshot()
        const inputIds = new Set(node.ports.filter((port) => port.direction === "input").map((port) => port.id))
        let index = 1
        while (inputIds.has(`input-${index}`)) index += 1
        const outputIndex = node.ports.findIndex((port) => port.direction === "output")
        assert(outputIndex >= 0, "view-animation-tree switch output port is required")
        node.ports.splice(outputIndex, 0, { id: `input-${index}`, name: `Input ${inputIds.size + 1}`, direction: "input", dataType: "animation", maxConnections: 1 })
        this.setData(this.graph, { autoFit: false })
        this.renderInspector()
        this.recordEdit("add switch input", before)
        this.setStatus(`Added input ${node.ports.filter((port) => port.direction === "input").length} to ${node.name}`, "success")
    }

    removeSwitchInput(node, portId) {
        assert(node.kind === ANIMATION_NODE_KINDS.SWITCH, "view-animation-tree remove input requires a switch node")
        const inputs = node.ports.filter((port) => port.direction === "input")
        assert(inputs.length > 2, "view-animation-tree switch requires at least two inputs")
        const removed = inputs.find((port) => port.id === portId)
        assert(removed, `view-animation-tree missing switch input ${portId}`)
        const before = this.captureSnapshot()
        const endpoint = { nodeId: node.id, portId: removed.id }
        for (const edge of [...this.graphModel.edgesForPort(endpoint)]) this.graphModel.removeEdge(edge.id)
        node.ports.splice(node.ports.indexOf(removed), 1)
        if (node.parameters.currentInput === removed.id) node.parameters.currentInput = inputs.find((port) => port.id !== removed.id).id
        this.setData(this.graph, { autoFit: false })
        this.renderInspector()
        this.recordEdit("remove switch input", before)
        this.setStatus(`Removed ${removed.name} from ${node.name}`, "success")
    }

    bindBlendNodeInspector(node) {
        for (const input of this.inspectorElement.querySelectorAll("[data-port-name]")) {
            assert(input instanceof HTMLInputElement, "view-animation-tree switch input name must be an input")
            input.addEventListener("change", () => {
                const before = this.captureSnapshot()
                const name = input.value.trim()
                assert(name.length > 0, "view-animation-tree switch input name must not be empty")
                const port = node.ports.find((candidate) => candidate.id === input.dataset.portName)
                assert(port && port.direction === "input", `view-animation-tree missing switch input ${input.dataset.portName}`)
                port.name = name
                this.draw()
                this.recordEdit("rename switch input", before)
                this.renderInspector()
                this.setStatus(`Renamed switch input to ${name}`, "success")
            })
        }
        for (const input of this.inspectorElement.querySelectorAll("[data-target]")) {
            assert(input instanceof HTMLInputElement || input instanceof HTMLSelectElement, "view-animation-tree blend inspector field must be an input or select")
            input.addEventListener("change", () => {
                const before = this.captureSnapshot()
                this.setBlendNodeValue(node, input.dataset.target, input)
                assert(node.name.length > 0, "view-animation-tree blend node name must not be empty")
                this.selectionOutput.textContent = `Selected: ${node.name}`
                this.draw()
                this.recordEdit(`edit ${node.kind}`, before)
                this.setStatus(`Updated ${node.name}`, "success")
            })
        }
        const addSwitchInput = this.inspectorElement.querySelector('[data-action="add-switch-input"]')
        const removeSwitchInputs = [...this.inspectorElement.querySelectorAll('[data-action="remove-switch-input"]')]
        if (node.kind === ANIMATION_NODE_KINDS.SWITCH) {
            assert(addSwitchInput instanceof HTMLButtonElement, "view-animation-tree add switch input button is required")
            const inputCount = node.ports.filter((port) => port.direction === "input").length
            assert(removeSwitchInputs.length === inputCount, "view-animation-tree requires one remove action per switch input")
            addSwitchInput.addEventListener("click", () => this.addSwitchInput(node))
            for (const removeSwitchInput of removeSwitchInputs) {
                assert(removeSwitchInput instanceof HTMLButtonElement, "view-animation-tree remove switch input button is required")
                removeSwitchInput.addEventListener("click", () => this.removeSwitchInput(node, removeSwitchInput.dataset.portId))
            }
        } else {
            assert(addSwitchInput === null && removeSwitchInputs.length === 0, "view-animation-tree switch input actions require a switch node")
        }
        const edit = this.inspectorElement.querySelector('[data-action="edit-node"]')
        if (edit !== null) {
            assert(edit instanceof HTMLButtonElement, "view-animation-tree edit node button is required")
            edit.addEventListener("click", () => this.navigateToAnimationNode(node.id))
        }
    }

    renderNodeGraphInspector() {
        if (this.selectedEdgeId !== null) {
            const edge = this.selectedEdge()
            this.selectionOutput.textContent = `Selected connection: ${edge.from.nodeId}.${edge.from.portId} → ${edge.to.nodeId}.${edge.to.portId}`
            this.inspectorElement.innerHTML = `
        <form data-element="connection-inspector">
          <fieldset>
            <legend>Connection</legend>
            <label>From <output>${this.escapeAttribute(`${edge.from.nodeId}.${edge.from.portId}`)}</output></label>
            <label>To <output>${this.escapeAttribute(`${edge.to.nodeId}.${edge.to.portId}`)}</output></label>
          </fieldset>
        </form>
      `
            return
        }
        if (this.selectedNodeIds.size === 0) {
            this.selectionOutput.textContent = "No selection"
            this.inspectorElement.innerHTML = "<output>Select a blend node or connection to inspect it.</output>"
            return
        }
        const nodes = this.graph.nodes.filter((node) => this.selectedNodeIds.has(node.id))
        if (nodes.length > 1) {
            this.selectionOutput.textContent = `Selected: ${nodes.length} blend nodes`
            this.inspectorElement.innerHTML = `
        <table>
          <caption>Selected blend nodes</caption>
          <thead><tr><th>Name</th><th>Kind</th></tr></thead>
          <tbody>${nodes.map((node) => `<tr><td>${this.escapeAttribute(node.name)}</td><td>${this.escapeAttribute(node.kind)}</td></tr>`).join("")}</tbody>
        </table>
      `
            return
        }
        const node = nodes[0]
        const required = this.graphModel.isRequired(node.id)
        this.selectionOutput.textContent = `Selected: ${node.name}`
        if (required) {
            this.inspectorElement.innerHTML = `
        <form data-element="blend-output-inspector">
          <fieldset>
            <legend>Output</legend>
            <label>Kind <output>${this.escapeAttribute(node.kind)}</output></label>
            <label>Name <output>${this.escapeAttribute(node.name)}</output></label>
          </fieldset>
        </form>
      `
            return
        }
        const inspector = this.blendNodeInspector(node)
        this.inspectorElement.innerHTML = `
      <form data-element="${this.escapeAttribute(node.kind)}-inspector">
        <fieldset>
          <legend>${inspector.legend}</legend>
          <label>Name <input type="text" data-target="name" value="${this.escapeAttribute(node.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
          ${inspector.fields}
        </fieldset>
        ${inspector.editor ? '<footer><button type="button" data-action="edit-node"><i aria-hidden="true">edit</i> Edit graph</button></footer>' : ""}
      </form>
    `
        this.bindBlendNodeInspector(node)
    }

    renderInspector() {
        assert(this.inspectorElement instanceof HTMLElement, "view-animation-tree inspector is not initialized")
        assert(this.selectionOutput instanceof HTMLOutputElement, "view-animation-tree selection output is not initialized")
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
            this.renderNodeGraphInspector()
            return
        }
        if (this.activeNode.kind !== ANIMATION_NODE_KINDS.STATE_MACHINE) {
            this.selectionOutput.textContent = `Editing: ${this.activeNode.name}`
            this.inspectorElement.innerHTML = `<output>${this.escapeAttribute(this.activeNode.kind)} editor is not implemented in this prototype.</output>`
            return
        }
        if (this.selectedEdgeId !== null) {
            const edge = this.selectedEdge()
            const label = `${this.stateName(edge.from)} → ${this.stateName(edge.to)}`
            this.selectionOutput.textContent = `Selected ${edge.kind === "entry" ? "entry" : "transition"}: ${label}`
            const switchModeField =
                edge.kind === "entry"
                    ? "<label>Kind <output>Entry</output></label>"
                    : `<label>Switch mode
              <select data-field="switch-mode">
                ${TRANSITION_MODES.map((mode) => `<option value="${mode.value}" ${mode.value === edge.switchMode ? "selected" : ""}>${mode.label}</option>`).join("")}
            </select>
          </label>`
            this.inspectorElement.innerHTML = `
        <form data-element="transition-inspector">
          <fieldset>
            <legend>${edge.kind === "entry" ? "Entry" : "Transition"}</legend>
            <label>From <output>${this.escapeAttribute(this.stateName(edge.from))}</output></label>
            <label>To <output>${this.escapeAttribute(this.stateName(edge.to))}</output></label>
            ${switchModeField}
          </fieldset>
        </form>
      `
            if (edge.kind === "entry") return
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
          <tbody>${nodes.map((node) => `<tr><td>${this.escapeAttribute(node.name)}</td><td>${this.escapeAttribute(this.graphModel.isRequired(node.id) ? "Required" : this.nodeType(node.type).label)}</td></tr>`).join("")}</tbody>
        </table>
      `
            return
        }

        const node = this.selectedNode()
        this.selectionOutput.textContent = `Selected: ${node.name}`
        if (this.graphModel.isRequired(node.id)) {
            this.inspectorElement.innerHTML = `
        <form data-element="state-inspector">
          <fieldset>
            <legend>Required state</legend>
            <label>Type <output>${this.escapeAttribute(node.type)}</output></label>
            <label>Name <output>${this.escapeAttribute(node.name)}</output></label>
          </fieldset>
        </form>
      `
            return
        }
        this.inspectorElement.innerHTML = `
      <form data-element="state-inspector">
        <fieldset>
          <legend>State</legend>
          <label>Type <input type="text" value="${this.escapeAttribute(this.nodeType(node.type).label)}" disabled autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
          <label>Name <input type="text" data-field="name" value="${this.escapeAttribute(node.name)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
        </fieldset>
        <fieldset>
          <legend>Animation</legend>
          <output>Animation assignment will be added after graph editing is validated.</output>
        </fieldset>
      </form>
    `
        const nameInput = this.inspectorElement.querySelector('[data-field="name"]')
        assert(nameInput instanceof HTMLInputElement, "view-animation-tree missing state name input")
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
    }

    escapeAttribute(value) {
        return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    }

    calculateContentBounds(graph) {
        assert(graph === this.graph, "view-animation-tree data must reference its graph")
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
            assert(this.nodeGraphRenderer instanceof NodeGraphRenderer, "view-animation-tree node graph renderer is not initialized")
            return this.nodeGraphRenderer.contentBounds(graph.nodes)
        }
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.STATE_MACHINE) {
            assert(this.renderer instanceof StateMachineGraphRenderer, "view-animation-tree renderer is not initialized")
            return this.renderer.contentBounds(graph.nodes)
        }
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
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
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
            assert(this.graphModel instanceof NodeGraph, "view-animation-tree active node graph model is required")
            this.nodeGraphRenderer.draw(ctx, graph, {
                selectedNodeIds: this.selectedNodeIds,
                selectedEdgeId: this.selectedEdgeId,
                hoveredNodeId: this.hoveredNodeId,
                hoveredPort: this.hoveredPort,
                requiredNodeIds: new Set(graph.nodes.filter((node) => this.graphModel.isRequired(node.id)).map((node) => node.id)),
            })
            if (this.nodeConnectionDrag) {
                const target = this.nodeGraphRenderer.hitPort(graph.nodes, this.nodeConnectionDrag.current)
                const valid = Boolean(target && this.graphModel.canAddEdge(this.nodeConnectionDrag.from, { nodeId: target.node.id, portId: target.port.id }).ok)
                this.nodeGraphRenderer.drawConnectionPreview(ctx, this.nodeConnectionDrag.start, this.nodeConnectionDrag.current, valid)
            }
            if (this.selectionDrag) this.nodeGraphRenderer.drawSelectionRect(ctx, this.selectionRect())
            return
        }
        if (this.activeNode.kind !== ANIMATION_NODE_KINDS.STATE_MACHINE) {
            ctx.save()
            ctx.fillStyle = "rgba(214, 236, 248, 0.85)"
            ctx.font = "600 18px sans-serif"
            ctx.textAlign = "center"
            ctx.fillText(`${this.activeNode.name} editor`, this.canvas.width / (2 * this.scale), this.canvas.height / (2 * this.scale))
            ctx.font = "13px sans-serif"
            ctx.fillText("This Animation Node editor is not implemented in this prototype.", this.canvas.width / (2 * this.scale), this.canvas.height / (2 * this.scale) + 28)
            ctx.restore()
            return
        }
        assert(this.renderer instanceof StateMachineGraphRenderer, "view-animation-tree renderer is not initialized")
        assert(this.graphModel instanceof StateMachineGraph, "view-animation-tree active state machine model is required")
        this.renderer.draw(ctx, graph, {
            selectedNodeIds: this.selectedNodeIds,
            selectedEdgeId: this.selectedEdgeId,
            hoveredNodeId: this.hoveredNodeId,
            hoveredTransitionNodeId: this.hoveredTransitionNodeId,
            transitionSourceStates: new Map(graph.nodes.map((node) => [node.id, this.graphModel.transitionSourceState(node.id)])),
        })
        if (this.connectionSourceNodeId !== null) {
            assert(this.connectionStartPoint, "view-animation-tree transition drag requires a start point")
            assert(this.connectionPointer, "view-animation-tree transition drag requires a pointer")
            const source = this.graph.nodes.find((node) => node.id === this.connectionSourceNodeId)
            assert(source, `view-animation-tree missing transition source node ${this.connectionSourceNodeId}`)
            const target = this.renderer.hitNode(this.graph.nodes, this.connectionPointer)
            const validTarget = Boolean(target && this.graphModel.canAddEdge(source.id, target.id).ok)
            this.renderer.drawTransitionPreview(ctx, this.connectionStartPoint, this.connectionPointer, validTarget)
        }
        if (this.selectionDrag) this.renderer.drawSelectionRect(ctx, this.selectionRect())
    }

    async _onContextMenu(event) {
        if (this.graphModel === null) return
        const activeRenderer = this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE ? this.nodeGraphRenderer : this.renderer
        const worldPoint = this.getWorldPoint(event.clientX, event.clientY)
        this.lastPointerWorld = worldPoint
        const node = activeRenderer.hitNode(this.graph.nodes, worldPoint)
        const edge = activeRenderer.hitEdge(this.graph, worldPoint, 10 / this.scale)
        if (node || edge) return
        event.preventDefault()
        this.focus()
        await this.showNodeMenu({ kind: "point", x: event.clientX, y: event.clientY }, worldPoint)
    }

    onCanvasMouseDown(event) {
        if (event.button !== 0) return
        this.focus()
        const point = this.getWorldPoint(event.clientX, event.clientY)
        this.lastPointerWorld = point
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
            this.onNodeGraphMouseDown(point)
            return
        }
        if (this.activeNode.kind !== ANIMATION_NODE_KINDS.STATE_MACHINE) return
        assert(this.renderer instanceof StateMachineGraphRenderer, "view-animation-tree renderer is not initialized")
        const node = this.renderer.hitNode(this.graph.nodes, point)
        const inTransitionRegion = node && this.renderer.pointInTransitionRegion(node, point)
        const sourceState = node ? this.graphModel.transitionSourceState(node.id) : null
        if (inTransitionRegion && sourceState === "available") {
            this.beginTransitionDrag(node, point)
            return
        }
        if (inTransitionRegion && sourceState === "disabled") {
            this.setNodeSelection([node.id], node.id)
            this.renderInspector()
            this.draw()
            const maximum = this.graphModel.constraints(node.id).outgoing.max
            this.setStatus(`${node.name} already has its maximum of ${maximum} outgoing transition${maximum === 1 ? "" : "s"}`, "warning")
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
        const point = this.getWorldPoint(event.clientX, event.clientY)
        this.lastPointerWorld = point
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
            this.onNodeGraphMouseMove(point)
            return
        }
        if (this.activeNode.kind !== ANIMATION_NODE_KINDS.STATE_MACHINE) return
        assert(this.renderer instanceof StateMachineGraphRenderer, "view-animation-tree renderer is not initialized")
        if (this.connectionSourceNodeId !== null) {
            this.connectionPointer = point
            const node = this.renderer.hitNode(this.graph.nodes, point)
            this.hoveredNodeId = node && node.id !== this.connectionSourceNodeId ? node.id : null
            this.hoveredTransitionNodeId = null
            this.canvas.style.cursor = "crosshair"
            this.draw()
            return
        }
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
        const sourceState = node ? this.graphModel.transitionSourceState(node.id) : null
        const transitionRegionHovered = Boolean(node && sourceState && this.renderer.pointInTransitionRegion(node, point))
        const hoveredNodeId = node && !transitionRegionHovered ? node.id : null
        const hoveredTransitionNodeId = transitionRegionHovered ? node.id : null
        const cursor = transitionRegionHovered ? (sourceState === "disabled" ? "not-allowed" : "crosshair") : node ? "grab" : "default"
        if (hoveredNodeId === this.hoveredNodeId && hoveredTransitionNodeId === this.hoveredTransitionNodeId) {
            this.canvas.style.cursor = cursor
            return
        }
        this.hoveredNodeId = hoveredNodeId
        this.hoveredTransitionNodeId = hoveredTransitionNodeId
        this.canvas.style.cursor = cursor
        this.draw()
    }

    onNodeGraphMouseDown(point) {
        assert(this.graphModel instanceof NodeGraph, "view-animation-tree active node graph model is required")
        const portHit = this.nodeGraphRenderer.hitPort(this.graph.nodes, point)
        if (portHit?.port.direction === "output") {
            const before = this.captureSnapshot()
            this.nodeConnectionDrag = {
                from: { nodeId: portHit.node.id, portId: portHit.port.id },
                start: portHit.point,
                current: point,
                before,
            }
            this.setNodeSelection([portHit.node.id], portHit.node.id)
            this.renderInspector()
            this.canvas.style.cursor = "crosshair"
            this.draw()
            this.setStatus(`Connect ${portHit.node.name}.${portHit.port.id} to an input`, "accent")
            return
        }
        const node = this.nodeGraphRenderer.hitNode(this.graph.nodes, point)
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
        const edge = this.nodeGraphRenderer.hitEdge(this.graph, point, 10 / this.scale)
        if (edge) {
            this.selectedNodeIds.clear()
            this.selectedNodeId = null
            this.selectedEdgeId = edge.id
            this.renderInspector()
            this.draw()
            this.setStatus(`Selected connection ${edge.from.nodeId}.${edge.from.portId} → ${edge.to.nodeId}.${edge.to.portId}`, "info")
            return
        }
        this.setNodeSelection([])
        this.selectionDrag = { start: point, current: point }
        this.renderInspector()
        this.draw()
    }

    onNodeGraphMouseMove(point) {
        if (this.nodeConnectionDrag) {
            this.nodeConnectionDrag.current = point
            const hit = this.nodeGraphRenderer.hitPort(this.graph.nodes, point)
            this.hoveredPort = hit ? { nodeId: hit.node.id, portId: hit.port.id } : null
            this.canvas.style.cursor = "crosshair"
            this.draw()
            return
        }
        if (this.draggedNodeId !== null) {
            assert(this.dragStartPoint && this.dragNodeStarts instanceof Map, "view-animation-tree node graph drag state is required")
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
                    const bounds = this.nodeGraphRenderer.nodeBounds(node)
                    return bounds.x <= rect.x + rect.width && bounds.x + bounds.width >= rect.x && bounds.y <= rect.y + rect.height && bounds.y + bounds.height >= rect.y
                })
                .map((node) => node.id)
            this.setNodeSelection(selected)
            this.renderInspector()
            this.draw()
            return
        }
        const portHit = this.nodeGraphRenderer.hitPort(this.graph.nodes, point)
        const node = this.nodeGraphRenderer.hitNode(this.graph.nodes, point)
        this.hoveredPort = portHit ? { nodeId: portHit.node.id, portId: portHit.port.id } : null
        this.hoveredNodeId = node ? node.id : null
        this.canvas.style.cursor = portHit?.port.direction === "output" ? "crosshair" : node ? "grab" : "default"
        this.draw()
    }

    finishNodeGraphConnection(point) {
        assert(this.nodeConnectionDrag, "view-animation-tree node graph connection drag is required")
        const drag = this.nodeConnectionDrag
        this.nodeConnectionDrag = null
        const hit = this.nodeGraphRenderer.hitPort(this.graph.nodes, point)
        if (!hit) {
            this.setStatus("Connection cancelled", "info")
            this.draw()
            return false
        }
        const to = { nodeId: hit.node.id, portId: hit.port.id }
        const result = this.graphModel.canAddEdge(drag.from, to)
        if (!result.ok) {
            this.setStatus(result.reason, "warning")
            this.draw()
            return false
        }
        const edge = { id: crypto.randomUUID(), from: drag.from, to }
        this.graphModel.addEdge(edge)
        this.selectedNodeIds.clear()
        this.selectedNodeId = null
        this.selectedEdgeId = edge.id
        this.renderInspector()
        this.draw()
        this.recordEdit("connect blend nodes", drag.before)
        this.setStatus(`Connected ${drag.from.nodeId}.${drag.from.portId} → ${to.nodeId}.${to.portId}`, "success")
        return true
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

    onCanvasMouseUp(event) {
        if (this.activeNode.kind === ANIMATION_NODE_KINDS.BLEND_TREE) {
            const point = this.getWorldPoint(event.clientX, event.clientY)
            if (this.nodeConnectionDrag) this.finishNodeGraphConnection(point)
            this.finishNodeDrag()
            this.finishSelectionDrag()
            this.canvas.style.cursor = this.hoveredNodeId === null ? "default" : "grab"
            return
        }
        if (this.activeNode.kind !== ANIMATION_NODE_KINDS.STATE_MACHINE) return
        if (this.connectionSourceNodeId !== null) {
            const sourceNodeId = this.connectionSourceNodeId
            const point = this.getWorldPoint(event.clientX, event.clientY)
            const target = this.renderer.hitNode(this.graph.nodes, point)
            const targetSourceState = target ? this.graphModel.transitionSourceState(target.id) : null
            const transitionTargetHovered = Boolean(target && targetSourceState && this.renderer.pointInTransitionRegion(target, point))
            this.finishTransitionDrag(target)
            this.hoveredNodeId = target && !transitionTargetHovered && target.id !== sourceNodeId ? target.id : null
            this.hoveredTransitionNodeId = transitionTargetHovered && target.id !== sourceNodeId ? target.id : null
            this.canvas.style.cursor =
                this.hoveredTransitionNodeId === null ? (this.hoveredNodeId === null ? "default" : "grab") : targetSourceState === "disabled" ? "not-allowed" : "crosshair"
            this.draw()
            return
        }
        this.finishNodeDrag()
        this.finishSelectionDrag()
        this.canvas.style.cursor = this.hoveredNodeId === null ? "default" : "grab"
    }

    onCanvasMouseLeave() {
        if (this.nodeConnectionDrag) {
            this.nodeConnectionDrag = null
            this.setStatus("Connection cancelled", "info")
        }
        if (this.connectionSourceNodeId !== null) {
            this.cancelTransitionDrag()
            this.setStatus("Transition cancelled · drag from a node frame to a target state", "info")
        }
        this.finishNodeDrag()
        this.finishSelectionDrag()
        this.hoveredNodeId = null
        this.hoveredTransitionNodeId = null
        this.hoveredPort = null
        this.draw()
    }
}

if (!customElements.get("view-animation-tree")) {
    customElements.define("view-animation-tree", ViewAnimationTree)
}
