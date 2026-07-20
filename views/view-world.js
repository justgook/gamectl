import { runtime, unwrap } from "/core/runtime.js"
import { UndoHistory } from "/util/undo.js"
import { ViewCanvasBase } from "/util/view-canvas-base.js"
import { WorldObjectRendererRegistry } from "/util/world-object-renderers.js"

const GRID_SIZE = 16
const POINT_RADIUS_PX = 6
const HIT_RADIUS_PX = 10

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function basename(path) {
  const parts = String(path).split("/").filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : String(path)
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function cloneProps(input, label) {
  assert(
    input && typeof input === "object" && !Array.isArray(input),
    `${label} must be an object`,
  )
  const props = {}
  for (const [key, value] of Object.entries(input)) {
    assert(typeof value === "string", `${label}.${key} must be a string`)
    props[key] = value
  }
  return props
}

function cloneObject(object) {
  return { ...object, props: { ...object.props } }
}

function cloneObjects(objects) {
  return objects.map(cloneObject)
}

function objectGroup(object) {
  return object.props.group || ""
}

function objectDisplayName(object, index) {
  const name = object.props.name || object.props.id
  return name || `Object ${index + 1}`
}

function createPointRenderer() {
  return {
    async prepare(objects) {
      assert(Array.isArray(objects), "point renderer objects must be array")
    },

    draw(ctx, _object, frame) {
      assert(
        frame && Number.isFinite(frame.scale) && frame.scale > 0,
        "point renderer frame.scale must be positive",
      )
      assert(
        typeof frame.label === "string" && frame.label.length > 0,
        "point renderer frame.label must be non-empty string",
      )
      const radius = POINT_RADIUS_PX / frame.scale
      ctx.fillStyle = "#7aa2ff"
      ctx.strokeStyle = "rgba(255,255,255,0.9)"
      ctx.lineWidth = 2 / frame.scale
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = "#d6ecf8"
      ctx.font = `${12 / frame.scale}px sans-serif`
      ctx.textBaseline = "middle"
      ctx.fillText(frame.label, 12 / frame.scale, 0)
    },

    bounds() {
      return {
        minX: -POINT_RADIUS_PX,
        minY: -POINT_RADIUS_PX,
        maxX: POINT_RADIUS_PX,
        maxY: POINT_RADIUS_PX,
      }
    },

    dispose() {},
  }
}

class WorldCommand {
  constructor(label, redo, undo) {
    assert(
      typeof label === "string" && label.length > 0,
      "world command label must be non-empty string",
    )
    assert(typeof redo === "function", "world command redo must be function")
    assert(typeof undo === "function", "world command undo must be function")
    this.label = label
    this.redo = redo
    this.undo = undo
  }
}

class WorldState {
  constructor() {
    this.path = ""
    this.loaded = false
    this.objects = []
    this.nextObjectId = 1
    this.activeObjectId = 0
    this.dirty = false
    this.history = new UndoHistory()
  }

  create(path) {
    assert(
      typeof path === "string" && path.length > 0,
      "world state create requires path",
    )
    this.path = path
    this.loaded = true
    this.objects = []
    this.nextObjectId = 1
    this.activeObjectId = 0
    this.dirty = true
    this.resetHistory()
  }

  open(path, data) {
    assert(
      typeof path === "string" && path.length > 0,
      "world state open requires path",
    )
    assert(
      typeof data === "string" && data.length > 0,
      "world state open requires data",
    )
    const world = JSON.parse(data)
    assert(
      world && typeof world === "object" && !Array.isArray(world),
      "world file data must be object JSON",
    )
    assert(Array.isArray(world.objects), "world data.objects must be an array")

    this.nextObjectId = 1
    const objects = world.objects.map((object, index) =>
      this.parseObject(object, index),
    )
    this.validateGroupContiguity(objects)
    this.path = path
    this.loaded = true
    this.objects = objects
    this.activeObjectId = 0
    this.dirty = false
    this.resetHistory()
  }

  parseObject(object, index) {
    assert(
      object && typeof object === "object" && !Array.isArray(object),
      `world object ${index} must be an object`,
    )
    assert(
      Number.isFinite(object.x),
      `world object ${index}.x must be a finite number`,
    )
    assert(
      Number.isFinite(object.y),
      `world object ${index}.y must be a finite number`,
    )
    return {
      editorId: this.allocateObjectId(),
      x: object.x,
      y: object.y,
      props: cloneProps(object.props, `world object ${index}.props`),
    }
  }

  toStorageData() {
    assert(this.loaded, "world state serialization requires loaded world")
    return JSON.stringify(
      {
        objects: this.objects.map((object) => ({
          x: object.x,
          y: object.y,
          props: { ...object.props },
        })),
      },
      null,
      2,
    )
  }

  save(path) {
    assert(
      typeof path === "string" && path.length > 0,
      "world state save requires path",
    )
    this.path = path
    this.dirty = false
  }

  snapshot() {
    return {
      path: this.path,
      loaded: this.loaded,
      dirty: this.dirty,
      objects: cloneObjects(this.objects),
      activeObjectId: this.activeObjectId,
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      history: this.createHistorySnapshot(),
    }
  }

  addObject(x, y) {
    assert(Number.isFinite(x), "world state add object x must be finite")
    assert(Number.isFinite(y), "world state add object y must be finite")
    const object = {
      editorId: this.allocateObjectId(),
      x: Math.round(x),
      y: Math.round(y),
      props: {},
    }
    const previousActive = this.activeObjectId
    this.executeDirtyCommand(
      "Add object",
      () => {
        this.objects.push(object)
        this.activeObjectId = object.editorId
      },
      () => {
        const index = this.indexForId(object.editorId)
        this.objects.splice(index, 1)
        this.activeObjectId = previousActive
      },
    )
    return object.editorId
  }

  deleteObject(editorId) {
    const index = this.indexForId(editorId)
    const object = cloneObject(this.objects[index])
    const previousActive = this.activeObjectId
    this.executeDirtyCommand(
      "Delete object",
      () => {
        this.objects.splice(this.indexForId(editorId), 1)
        this.activeObjectId = 0
      },
      () => {
        this.objects.splice(index, 0, cloneObject(object))
        this.activeObjectId = previousActive
      },
    )
  }

  selectObject(editorId) {
    if (editorId === 0) {
      this.activeObjectId = 0
      return
    }
    this.requireObject(editorId)
    this.activeObjectId = editorId
  }

  setObjectPosition(editorId, x, y) {
    assert(Number.isFinite(x), "world object x must be finite")
    assert(Number.isFinite(y), "world object y must be finite")
    const object = this.requireObject(editorId)
    const previous = { x: object.x, y: object.y }
    const next = { x: Math.round(x), y: Math.round(y) }
    if (previous.x === next.x && previous.y === next.y) return false
    this.executeDirtyCommand(
      "Move object",
      () => {
        const target = this.requireObject(editorId)
        target.x = next.x
        target.y = next.y
      },
      () => {
        const target = this.requireObject(editorId)
        target.x = previous.x
        target.y = previous.y
      },
    )
    return true
  }

  moveObjectLive(editorId, x, y) {
    assert(Number.isFinite(x), "world live object x must be finite")
    assert(Number.isFinite(y), "world live object y must be finite")
    const object = this.requireObject(editorId)
    object.x = Math.round(x)
    object.y = Math.round(y)
    this.dirty = true
  }

  commitLiveMove(editorId, previous, next) {
    assert(
      Number.isFinite(previous.x) && Number.isFinite(previous.y),
      "world live move previous position must be finite",
    )
    assert(
      Number.isFinite(next.x) && Number.isFinite(next.y),
      "world live move next position must be finite",
    )
    if (previous.x === next.x && previous.y === next.y) return false
    this.history.add(
      new WorldCommand(
        "Move object",
        () => {
          const object = this.requireObject(editorId)
          object.x = next.x
          object.y = next.y
          this.dirty = true
        },
        () => {
          const object = this.requireObject(editorId)
          object.x = previous.x
          object.y = previous.y
          this.dirty = true
        },
      ),
    )
    this.dirty = true
    return true
  }

  setObjectProps(editorId, props) {
    const nextProps = cloneProps(props, "world object props")
    const previousObjects = cloneObjects(this.objects)
    const nextObjects = cloneObjects(this.objects)
    const index = nextObjects.findIndex(
      (object) => object.editorId === editorId,
    )
    assert(index >= 0, `world state missing object ${editorId}`)
    const previousGroup = objectGroup(nextObjects[index])
    const nextGroup = nextProps.group || ""
    if (JSON.stringify(nextObjects[index].props) === JSON.stringify(nextProps))
      return false

    if (nextGroup === previousGroup) {
      nextObjects[index].props = nextProps
    } else {
      const [object] = nextObjects.splice(index, 1)
      object.props = nextProps
      if (nextGroup) {
        const targetLast = nextObjects.findLastIndex(
          (candidate) => objectGroup(candidate) === nextGroup,
        )
        if (targetLast >= 0) nextObjects.splice(targetLast + 1, 0, object)
        else
          this.insertAtSourceBoundary(nextObjects, object, index, previousGroup)
      } else {
        this.insertAtSourceBoundary(nextObjects, object, index, previousGroup)
      }
    }
    this.validateGroupContiguity(nextObjects)
    this.replaceObjectsCommand(
      "Set object properties",
      previousObjects,
      nextObjects,
      editorId,
    )
    return true
  }

  insertAtSourceBoundary(objects, object, originalIndex, previousGroup) {
    if (previousGroup) {
      const sourceLast = objects.findLastIndex(
        (candidate) => objectGroup(candidate) === previousGroup,
      )
      if (sourceLast >= 0) {
        objects.splice(sourceLast + 1, 0, object)
        return
      }
    }
    objects.splice(Math.min(originalIndex, objects.length), 0, object)
  }

  moveObject(editorId, direction) {
    assert(
      direction === -1 || direction === 1,
      "world object move direction must be -1 or 1",
    )
    const index = this.indexForId(editorId)
    const group = objectGroup(this.objects[index])
    if (!group) return this.moveUnitForObject(editorId, direction)
    const targetIndex = index + direction
    if (
      targetIndex < 0 ||
      targetIndex >= this.objects.length ||
      objectGroup(this.objects[targetIndex]) !== group
    )
      return false
    const previous = cloneObjects(this.objects)
    const next = cloneObjects(this.objects)
    const target = next[targetIndex]
    next[targetIndex] = next[index]
    next[index] = target
    this.replaceObjectsCommand("Reorder object", previous, next, editorId)
    return true
  }

  moveUnitForObject(editorId, direction) {
    const units = this.units()
    const unitIndex = units.findIndex((unit) =>
      unit.objects.some((object) => object.editorId === editorId),
    )
    assert(unitIndex >= 0, `world state missing unit for object ${editorId}`)
    return this.moveUnitAt(units, unitIndex, direction, "Reorder object")
  }

  moveGroup(group, direction) {
    assert(
      typeof group === "string" && group.length > 0,
      "world state move group requires group",
    )
    const units = this.units()
    const unitIndex = units.findIndex((unit) => unit.group === group)
    assert(unitIndex >= 0, `world state missing group ${group}`)
    return this.moveUnitAt(units, unitIndex, direction, "Reorder group")
  }

  moveUnitAt(units, unitIndex, direction, label) {
    assert(
      direction === -1 || direction === 1,
      "world unit move direction must be -1 or 1",
    )
    const target = unitIndex + direction
    if (target < 0 || target >= units.length) return false
    const previous = cloneObjects(this.objects)
    const targetUnit = units[target]
    units[target] = units[unitIndex]
    units[unitIndex] = targetUnit
    const next = units.flatMap((unit) => unit.objects.map(cloneObject))
    this.replaceObjectsCommand(label, previous, next, this.activeObjectId)
    return true
  }

  units() {
    this.validateGroupContiguity(this.objects)
    const units = []
    for (const object of this.objects) {
      const group = objectGroup(object)
      const previous = units[units.length - 1]
      if (group && previous && previous.group === group) {
        previous.objects.push(cloneObject(object))
      } else {
        units.push({ group, objects: [cloneObject(object)] })
      }
    }
    return units
  }

  replaceObjectsCommand(label, previous, next, activeObjectId) {
    this.executeDirtyCommand(
      label,
      () => {
        this.objects = cloneObjects(next)
        this.activeObjectId = activeObjectId
      },
      () => {
        this.objects = cloneObjects(previous)
        this.activeObjectId = activeObjectId
      },
    )
  }

  validateGroupContiguity(objects) {
    const closed = new Set()
    let current = ""
    for (const object of objects) {
      const group = objectGroup(object)
      if (group === current) continue
      if (current) closed.add(current)
      if (group && closed.has(group)) {
        throw new Error(
          `world group ${group} must occupy one contiguous object block`,
        )
      }
      current = group
    }
  }

  undo() {
    this.history.undo()
  }

  redo() {
    this.history.redo()
  }

  moveHistoryTo(index) {
    const state = this.history.toArray()[index]
    assert(state, `world state missing history index ${index}`)
    this.history.moveTo(state)
    this.dirty = true
  }

  executeDirtyCommand(label, redo, undo) {
    this.history.execute(
      new WorldCommand(
        label,
        () => {
          redo()
          this.dirty = true
        },
        () => {
          undo()
          this.dirty = true
        },
      ),
    )
  }

  createHistorySnapshot() {
    const states = this.history.toArray()
    return states.map((state, index) => ({
      index,
      label: state.command.label,
      current: state === this.history.current,
      parentIndex: state.parent ? states.indexOf(state.parent) : -1,
    }))
  }

  resetHistory() {
    this.history.dispose()
    this.history = new UndoHistory()
  }

  requireObject(editorId) {
    const object = this.objects.find(
      (candidate) => candidate.editorId === editorId,
    )
    assert(object, `world state missing object ${editorId}`)
    return object
  }

  indexForId(editorId) {
    const index = this.objects.findIndex(
      (object) => object.editorId === editorId,
    )
    assert(index >= 0, `world state missing object ${editorId}`)
    return index
  }

  allocateObjectId() {
    const editorId = this.nextObjectId
    this.nextObjectId += 1
    return editorId
  }
}

function validateSnapshot(snapshot) {
  assert(
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot),
    "view-world snapshot must be an object",
  )
  assert(typeof snapshot.path === "string", "view-world path must be string")
  assert(
    typeof snapshot.loaded === "boolean",
    "view-world loaded must be boolean",
  )
  assert(
    typeof snapshot.dirty === "boolean",
    "view-world dirty must be boolean",
  )
  assert(Array.isArray(snapshot.objects), "view-world objects must be array")
  assert(
    Number.isInteger(snapshot.activeObjectId),
    "view-world activeObjectId must be integer",
  )
  assert(typeof snapshot.canUndo === "boolean", "view-world canUndo invalid")
  assert(typeof snapshot.canRedo === "boolean", "view-world canRedo invalid")
  assert(Array.isArray(snapshot.history), "view-world history must be array")
  for (const object of snapshot.objects) {
    assert(
      Number.isInteger(object.editorId) && object.editorId > 0,
      "view-world object editorId must be positive integer",
    )
    assert(Number.isFinite(object.x), "view-world object x must be finite")
    assert(Number.isFinite(object.y), "view-world object y must be finite")
    cloneProps(object.props, "view-world object props")
  }
  return snapshot
}

export class ViewWorld extends ViewCanvasBase {
  static get observedAttributes() {
    return ["data-source"]
  }

  constructor() {
    super()
    this.state = new WorldState()
    this.snapshot = validateSnapshot(this.state.snapshot())
    this.objectsElement = null
    this.positionFormElement = null
    this.positionXElement = null
    this.positionYElement = null
    this.propsElement = null
    this.historyElement = null
    this.pathElement = null
    this.countElement = null
    this.dirtyElement = null
    this.statusElement = null
    this.showGrid = true
    this.objectDrag = null
    this.collapsedGroups = new Set()
    this.rendererRegistry = null
    this.rendererPreparationKey = ""
    this.hoverObjectId = 0
    this.hoverTooltipObjectId = 0
    this.hoverTooltipId = 0
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = "1"
    this.style.display = "contents"
    this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <aside data-element="sidebar">
        <fieldset>
          <legend>Objects</legend>
          <table class="compact-actions" data-element="objects">
            <thead><tr><th>Object</th><th>Position</th><th>Actions</th></tr></thead>
            <tbody></tbody>
          </table>
        </fieldset>
        <fieldset>
          <legend>Position</legend>
          <form data-element="position" novalidate>
            <label>X <input type="number" step="1" data-field="x" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
            <label>Y <input type="number" step="1" data-field="y" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
            <button type="submit" data-action="apply-position">Apply</button>
          </form>
        </fieldset>
        <fieldset>
          <legend>Properties</legend>
          <table data-element="properties">
            <thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody></tbody>
          </table>
          <button type="button" data-action="edit-properties"><i aria-hidden="true">tune</i>Edit</button>
        </fieldset>
        <fieldset>
          <legend>History</legend>
          <table data-element="undo-history">
            <thead><tr><th>#</th><th>Command</th><th>Parent</th><th>State</th></tr></thead>
            <tbody></tbody>
          </table>
        </fieldset>
      </aside>
      <footer>
        <output data-element="path">No world loaded</output>
        <output data-element="count"></output>
        <output data-element="dirty"></output>
        <output data-element="status">No world loaded</output>
      </footer>
    `

    this.objectsElement = this.querySelector('[data-element="objects"] tbody')
    this.positionFormElement = this.querySelector('[data-element="position"]')
    this.positionXElement = this.querySelector('[data-field="x"]')
    this.positionYElement = this.querySelector('[data-field="y"]')
    this.propsElement = this.querySelector('[data-element="properties"] tbody')
    this.historyElement = this.querySelector('[data-element="undo-history"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    this.countElement = this.querySelector('[data-element="count"]')
    this.dirtyElement = this.querySelector('[data-element="dirty"]')
    this.statusElement = this.querySelector('[data-element="status"]')

    assert(
      this.objectsElement instanceof HTMLTableSectionElement,
      "view-world missing objects tbody",
    )
    assert(
      this.positionFormElement instanceof HTMLFormElement,
      "view-world missing position form",
    )
    assert(
      this.positionXElement instanceof HTMLInputElement,
      "view-world missing x input",
    )
    assert(
      this.positionYElement instanceof HTMLInputElement,
      "view-world missing y input",
    )
    assert(
      this.propsElement instanceof HTMLTableSectionElement,
      "view-world missing properties tbody",
    )
    assert(
      this.historyElement instanceof HTMLTableElement,
      "view-world missing history table",
    )
    assert(
      this.pathElement instanceof HTMLOutputElement,
      "view-world missing path",
    )
    assert(
      this.countElement instanceof HTMLOutputElement,
      "view-world missing count",
    )
    assert(
      this.dirtyElement instanceof HTMLOutputElement,
      "view-world missing dirty",
    )
    assert(
      this.statusElement instanceof HTMLOutputElement,
      "view-world missing status",
    )

    super.connectedCallback()
    this.bindEvents()
    this.setData(this.snapshot, { autoFit: false })
    this.renderSnapshot(this.snapshot)
    void this.initializeRenderers()
  }

  disconnectedCallback() {
    this.closeObjectTooltip()
    super.disconnectedCallback()
    if (this.rendererRegistry) this.rendererRegistry.dispose()
    this.rendererRegistry = null
    this.rendererPreparationKey = ""
  }

  async initializeRenderers() {
    assert(
      this.viewConfig &&
        typeof this.viewConfig === "object" &&
        !Array.isArray(this.viewConfig),
      "view-world requires view config",
    )
    assert(
      this.viewConfig.config &&
        typeof this.viewConfig.config === "object" &&
        !Array.isArray(this.viewConfig.config),
      "view-world requires view config.config",
    )
    this.setBusy(true)
    this.rendererRegistry = await WorldObjectRendererRegistry.create(
      this.viewConfig.config,
      createPointRenderer(),
    )
    await this.prepareRenderers(this.snapshot)
    this.setBusy(false)
    await this.bootstrap()
  }

  createHeaderControlsElement() {
    const controls = document.createElement("div")
    controls.dataset.element = "header-controls"
    controls.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="new"><i aria-hidden="true">docs</i></button>
        <button type="button" data-action="open"><i aria-hidden="true">folder_open</i></button>
        <button type="button" data-action="save" class="accent"><i aria-hidden="true">save</i></button>
        <button type="button" data-action="save-as"><i aria-hidden="true">save_as</i></button>
        <button type="button" data-action="reload"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <button type="button" data-action="add"><i aria-hidden="true">add_location</i></button>
        <button type="button" data-action="delete" class="danger"><i aria-hidden="true">delete</i></button>
        <button type="button" data-action="properties"><i aria-hidden="true">tune</i></button>
      </div>
      <div role="buttongroup" data-element="edit-actions">
        <button type="button" data-action="undo"><i aria-hidden="true">undo</i></button>
        <button type="button" data-action="redo"><i aria-hidden="true">redo</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="grid" aria-selected="true"><i aria-hidden="true">grid_on</i></button>
        <button type="button" data-action="zoom-in"><i aria-hidden="true">zoom_in</i></button>
        <button type="button" data-action="zoom-fit"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="zoom-out"><i aria-hidden="true">zoom_out</i></button>
      </div>
    `
    return controls
  }

  bindEvents() {
    this.canvas.addEventListener("wheel", () => this.closeObjectTooltip())
    this.canvas.addEventListener("mousedown", () => this.closeObjectTooltip())

    this.objectsElement.addEventListener("click", async (event) => {
      const actionElement = event.target.closest("[data-action]")
      if (actionElement instanceof HTMLElement) {
        await this.handleListAction(actionElement)
        return
      }
      const row = event.target.closest("tr[data-object-id]")
      if (!(row instanceof HTMLTableRowElement)) return
      this.state.selectObject(Number(row.dataset.objectId))
      await this.refreshSnapshot("Object selected")
    })
    this.objectsElement.addEventListener("keydown", async (event) => {
      const heading = event.target.closest(
        'th[role="button"][data-action="group-toggle"]',
      )
      if (!(heading instanceof HTMLTableCellElement)) return
      if (event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
      await this.handleListAction(heading)
    })

    this.positionFormElement.addEventListener("submit", async (event) => {
      event.preventDefault()
      await this.applyPosition()
    })
    this.querySelector('[data-action="edit-properties"]').addEventListener(
      "click",
      async () => this.edit(),
    )
    this.historyElement.addEventListener("click", async (event) => {
      const row = event.target.closest("tr[data-history-index]")
      if (!(row instanceof HTMLTableRowElement)) return
      this.state.moveHistoryTo(Number(row.dataset.historyIndex))
      await this.refreshSnapshot("History state selected")
    })

    this.queryHeader('[data-action="new"]').addEventListener(
      "click",
      async () => this.new(),
    )
    this.queryHeader('[data-action="open"]').addEventListener(
      "click",
      async () => this.open(),
    )
    this.queryHeader('[data-action="save"]').addEventListener(
      "click",
      async () => this.save(),
    )
    this.queryHeader('[data-action="save-as"]').addEventListener(
      "click",
      async () => this.saveAs(),
    )
    this.queryHeader('[data-action="reload"]').addEventListener(
      "click",
      async () => this.reload(),
    )
    this.queryHeader('[data-action="add"]').addEventListener(
      "click",
      async () => this.add(),
    )
    this.queryHeader('[data-action="delete"]').addEventListener(
      "click",
      async () => this.deleteSelected(),
    )
    this.queryHeader('[data-action="properties"]').addEventListener(
      "click",
      async () => this.edit(),
    )
    this.queryHeader('[data-action="undo"]').addEventListener(
      "click",
      async () => this.undo(),
    )
    this.queryHeader('[data-action="redo"]').addEventListener(
      "click",
      async () => this.redo(),
    )
    this.queryHeader('[data-action="grid"]').addEventListener("click", () =>
      this.toggleGrid(),
    )
    this.queryHeader('[data-action="zoom-in"]').addEventListener("click", () =>
      this.zoomIn(),
    )
    this.queryHeader('[data-action="zoom-fit"]').addEventListener("click", () =>
      this.zoomFit(),
    )
    this.queryHeader('[data-action="zoom-out"]').addEventListener("click", () =>
      this.zoomOut(),
    )
  }

  queryHeader(selector) {
    const element = this.queryHeaderControl(selector)
    assert(
      element instanceof HTMLElement,
      `view-world missing header control ${selector}`,
    )
    return element
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === "data-source" && this.dataset.ready) {
      const source = String(newValue || "").trim()
      if (source) void this.loadDataSource(source)
    }
  }

  async bootstrap() {
    const source = String(this.getAttribute("data-source") || "").trim()
    if (!source) {
      this.setStatus("No world loaded", "info")
      return
    }
    await this.loadDataSource(source)
  }

  async loadDataSource(path) {
    assert(path.length > 0, "view-world data-source must be non-empty")
    this.setBusy(true)
    this.setStatus(`Opening ${path}…`, "info")
    try {
      await this.openPath(path, { autoFit: true })
    } catch (error) {
      const message = errorMessage(error)
      this.setStatus(message, "danger")
      await runtime.call("ui.toast.error", { message })
    } finally {
      this.setBusy(false)
    }
  }

  async new() {
    const target = await this.chooseSaveTarget("new.world.json")
    if (target.cancelled) return
    this.state.create(target.path)
    this.collapsedGroups.clear()
    this.rendererPreparationKey = ""
    await this.writeWorldFile(target.path, `${this.state.toStorageData()}\n`)
    this.state.save(target.path)
    await this.refreshSnapshot(`Created ${target.path}`, { autoFit: true })
    await runtime.call("ui.toast.success", {
      message: `Created world ${target.path}`,
    })
  }

  async open() {
    const payload = unwrap(
      await runtime.call("ui.popup.open", {
        title: "Open World",
        size: "medium",
        tag: "view-files",
        props: { mode: "chooser", filter: "*.world.json,*.json" },
      }),
    )
    if (!payload || payload.cancelled) return
    const selection = Array.isArray(payload.selection)
      ? payload.selection[0]
      : payload.selection
    assert(
      selection && selection.path,
      "view-world open requires selected path",
    )
    await this.openPath(selection.path, { autoFit: true })
  }

  async openPath(path, { autoFit = true } = {}) {
    assert(
      typeof path === "string" && path.length > 0,
      "view-world open requires path",
    )
    const data = unwrap(await runtime.invoke("fs/fs::read-text", path))
    this.state.open(path, data)
    this.objectDrag = null
    this.rendererPreparationKey = ""
    this.collapsedGroups.clear()
    await this.refreshSnapshot(`Opened ${path}`, { autoFit })
  }

  async save() {
    assert(this.state.loaded, "view-world save requires loaded world")
    assert(this.state.path.length > 0, "view-world save requires path")
    await this.saveToPath(this.state.path)
    await this.refreshSnapshot("Saved")
    await runtime.call("ui.toast.success", {
      message: `Saved world ${this.state.path}`,
    })
  }

  async saveAs() {
    assert(this.state.loaded, "view-world save-as requires loaded world")
    const target = await this.chooseSaveTarget(basename(this.state.path))
    if (target.cancelled) return
    await this.saveToPath(target.path)
    await this.refreshSnapshot(`Saved as ${target.path}`)
    await runtime.call("ui.toast.success", {
      message: `Saved world ${target.path}`,
    })
  }

  async chooseSaveTarget(defaultName) {
    const payload = unwrap(
      await runtime.call("ui.popup.open", {
        title: "Save World As",
        size: "medium",
        tag: "view-files",
        props: {
          mode: "saver",
          filter: "*.world.json,*.json",
          defaultName,
        },
      }),
    )
    if (!payload || payload.cancelled) return { cancelled: true }
    assert(
      typeof payload.path === "string" && payload.path.length > 0,
      "view-world save-as requires path",
    )
    return { cancelled: false, path: payload.path }
  }

  async saveToPath(path) {
    await this.writeWorldFile(path, `${this.state.toStorageData()}\n`)
    this.state.save(path)
  }

  async writeWorldFile(path, data) {
    unwrap(await runtime.invoke("fs/fs::write-text", path, data))
  }

  async reload() {
    assert(this.state.loaded, "view-world reload requires loaded world")
    assert(this.state.path.length > 0, "view-world reload requires path")
    await this.openPath(this.state.path, { autoFit: true })
    await runtime.call("ui.toast.success", {
      message: `Reloaded world ${this.state.path}`,
    })
  }

  async add() {
    if (!this.state.loaded) {
      this.setStatus("Create or open a world before adding objects", "info")
      return
    }
    assert(
      this.canvas instanceof HTMLCanvasElement,
      "view-world add requires canvas",
    )
    const point = {
      x: (this.canvas.width / 2 - this.offsetX) / this.scale,
      y: (this.canvas.height / 2 - this.offsetY) / this.scale,
    }
    this.state.addObject(point.x, point.y)
    await this.refreshSnapshot("Object added")
  }

  async deleteSelected() {
    const editorId = this.state.activeObjectId
    if (!editorId) return
    this.state.deleteObject(editorId)
    await this.refreshSnapshot("Object deleted")
  }

  async edit() {
    const editorId = this.state.activeObjectId
    if (!editorId) {
      this.setStatus("Select an object to edit properties", "info")
      return
    }
    const object = this.state.requireObject(editorId)
    const index = this.state.indexForId(editorId)
    const title = `${objectDisplayName(object, index)} Properties`
    const payload = unwrap(
      await runtime.call("ui.popup.open", {
        title,
        size: "medium",
        tag: "view-props",
        props: { title, dataSource: object.props },
      }),
    )
    if (!payload || payload.cancelled) return
    this.state.setObjectProps(editorId, payload.data)
    await this.refreshSnapshot("Object properties updated")
  }

  async applyPosition() {
    const editorId = this.state.activeObjectId
    if (!editorId) return
    const x = Number(this.positionXElement.value)
    const y = Number(this.positionYElement.value)
    assert(Number.isFinite(x), "view-world position x must be finite")
    assert(Number.isFinite(y), "view-world position y must be finite")
    const changed = this.state.setObjectPosition(editorId, x, y)
    await this.refreshSnapshot(changed ? "Object moved" : "Position unchanged")
  }

  async undo() {
    this.state.undo()
    await this.refreshSnapshot("Undo")
  }

  async redo() {
    this.state.redo()
    await this.refreshSnapshot("Redo")
  }

  clearSelection() {
    this.state.selectObject(0)
    void this.refreshSnapshot("Selection cleared")
  }

  zoomIn() {
    this.closeObjectTooltip()
    super.zoomIn()
  }

  zoomOut() {
    this.closeObjectTooltip()
    super.zoomOut()
  }

  zoomFit() {
    this.closeObjectTooltip()
    return super.zoomFit()
  }

  toggleGrid() {
    this.showGrid = !this.showGrid
    const button = this.queryHeader('[data-action="grid"]')
    assert(
      button instanceof HTMLButtonElement,
      "view-world grid must be button",
    )
    button.setAttribute("aria-selected", this.showGrid ? "true" : "false")
    this.draw()
    this.setStatus(this.showGrid ? "Grid enabled" : "Grid disabled", "info")
  }

  async handleListAction(actionElement) {
    const action = actionElement.dataset.action
    const objectRow = actionElement.closest("tr[data-object-id]")
    const groupRow = actionElement.closest("tr[data-group]")
    if (objectRow instanceof HTMLTableRowElement) {
      const editorId = Number(objectRow.dataset.objectId)
      this.state.selectObject(editorId)
      if (action === "object-up") this.state.moveObject(editorId, 1)
      else if (action === "object-down") this.state.moveObject(editorId, -1)
      else if (action === "object-props") {
        await this.edit()
        return
      } else if (action === "object-delete") this.state.deleteObject(editorId)
      else throw new Error(`view-world unknown object action ${action}`)
    } else if (groupRow instanceof HTMLTableRowElement) {
      const group = groupRow.dataset.group
      assert(group, "view-world group action requires group")
      if (action === "group-toggle") {
        this.toggleGroupCollapsed(group)
        return
      }
      if (action === "group-up") this.state.moveGroup(group, 1)
      else if (action === "group-down") this.state.moveGroup(group, -1)
      else throw new Error(`view-world unknown group action ${action}`)
    } else {
      throw new Error("view-world list action requires object or group row")
    }
    await this.refreshSnapshot("Object order updated")
  }

  async refreshSnapshot(status, { autoFit = false } = {}) {
    this.closeObjectTooltip()
    const snapshot = validateSnapshot(this.state.snapshot())
    await this.prepareRenderers(snapshot)
    this.snapshot = snapshot
    this.setData(snapshot, { autoFit })
    this.renderSnapshot(snapshot)
    this.setStatus(status, snapshot.dirty ? "warning" : "success")
  }

  async prepareRenderers(snapshot) {
    assert(
      this.rendererRegistry instanceof WorldObjectRendererRegistry,
      "view-world renderers must be initialized",
    )
    const key = JSON.stringify(
      snapshot.objects
        .map((object) => ({ editorId: object.editorId, props: object.props }))
        .toSorted((a, b) => a.editorId - b.editorId),
    )
    if (key === this.rendererPreparationKey) return
    await this.rendererRegistry.prepare(snapshot.objects)
    this.rendererPreparationKey = key
  }

  refreshLiveSnapshot() {
    const snapshot = validateSnapshot(this.state.snapshot())
    this.snapshot = snapshot
    this.setData(snapshot, { autoFit: false })
    this.renderSnapshot(snapshot)
  }

  renderSnapshot(snapshot) {
    this.pathElement.textContent = snapshot.loaded
      ? `Path: ${snapshot.path}`
      : "No world loaded"
    this.countElement.textContent = snapshot.loaded
      ? `${snapshot.objects.length} object${snapshot.objects.length === 1 ? "" : "s"}`
      : ""
    this.dirtyElement.textContent = snapshot.loaded
      ? snapshot.dirty
        ? "Dirty"
        : "Saved"
      : ""
    this.dirtyElement.className = snapshot.dirty ? "warning" : "success"
    this.pruneCollapsedGroups(snapshot)
    this.renderObjects(snapshot)
    this.renderInspector(snapshot)
    this.renderHistory(snapshot)
    this.renderHeaderControls(snapshot)
  }

  pruneCollapsedGroups(snapshot) {
    const available = new Set(
      snapshot.objects.map(objectGroup).filter((group) => group.length > 0),
    )
    for (const group of this.collapsedGroups) {
      if (!available.has(group)) this.collapsedGroups.delete(group)
    }
  }

  toggleGroupCollapsed(group) {
    assert(
      typeof group === "string" && group.length > 0,
      "view-world collapse requires group",
    )
    if (this.collapsedGroups.has(group)) this.collapsedGroups.delete(group)
    else this.collapsedGroups.add(group)
    this.renderObjects(this.snapshot)
    this.setStatus(
      this.collapsedGroups.has(group)
        ? `Collapsed ${group}`
        : `Expanded ${group}`,
      "info",
    )
  }

  renderObjects(snapshot) {
    this.objectsElement.replaceChildren()
    if (snapshot.objects.length === 0) {
      const row = document.createElement("tr")
      const cell = document.createElement("td")
      cell.colSpan = 3
      cell.textContent = snapshot.loaded ? "No objects yet" : "No world loaded"
      row.appendChild(cell)
      this.objectsElement.appendChild(row)
      return
    }

    const units = this.state.units().toReversed()
    for (const unit of units) {
      if (unit.group) {
        this.objectsElement.appendChild(this.createGroupRow(unit.group))
        if (this.collapsedGroups.has(unit.group)) continue
      }
      for (const unitObject of unit.objects.toReversed()) {
        const index = snapshot.objects.findIndex(
          (object) => object.editorId === unitObject.editorId,
        )
        assert(
          index >= 0,
          `view-world missing snapshot object ${unitObject.editorId}`,
        )
        this.objectsElement.appendChild(
          this.createObjectRow(
            snapshot.objects[index],
            index,
            Boolean(unit.group),
          ),
        )
      }
    }
  }

  createGroupRow(group) {
    const collapsed = this.collapsedGroups.has(group)
    const row = document.createElement("tr")
    row.dataset.group = group
    const nameCell = document.createElement("th")
    nameCell.dataset.action = "group-toggle"
    nameCell.setAttribute("role", "button")
    nameCell.setAttribute("tabindex", "0")
    nameCell.setAttribute("aria-expanded", collapsed ? "false" : "true")
    nameCell.title = collapsed ? `Expand ${group}` : `Collapse ${group}`
    const folderIcon = document.createElement("i")
    folderIcon.setAttribute("aria-hidden", "true")
    folderIcon.textContent = collapsed ? "folder" : "folder_open"
    nameCell.appendChild(folderIcon)
    nameCell.appendChild(document.createTextNode(` ${group}`))
    row.appendChild(nameCell)
    row.appendChild(document.createElement("td"))
    const actionsCell = document.createElement("td")
    actionsCell.appendChild(this.createActionButton("group-up", "arrow_upward"))
    actionsCell.appendChild(
      this.createActionButton("group-down", "arrow_downward"),
    )
    row.appendChild(actionsCell)
    return row
  }

  createObjectRow(object, index, grouped) {
    assert(
      typeof grouped === "boolean",
      "view-world object grouped must be boolean",
    )
    const row = document.createElement("tr")
    row.dataset.objectId = String(object.editorId)
    if (object.editorId === this.snapshot.activeObjectId)
      row.setAttribute("aria-selected", "true")

    const nameCell = document.createElement("td")
    const indent = grouped ? "\u00a0\u00a0\u00a0\u00a0" : ""
    nameCell.textContent = `${indent}${objectDisplayName(object, index)}`
    row.appendChild(nameCell)
    const positionCell = document.createElement("td")
    positionCell.textContent = `${object.x}, ${object.y}`
    row.appendChild(positionCell)
    const actionsCell = document.createElement("td")
    actionsCell.appendChild(
      this.createActionButton("object-up", "arrow_upward"),
    )
    actionsCell.appendChild(
      this.createActionButton("object-down", "arrow_downward"),
    )
    actionsCell.appendChild(this.createActionButton("object-props", "tune"))
    actionsCell.appendChild(this.createActionButton("object-delete", "delete"))
    row.appendChild(actionsCell)
    return row
  }

  createActionButton(action, icon) {
    const button = document.createElement("button")
    button.type = "button"
    button.dataset.action = action
    const iconElement = document.createElement("i")
    iconElement.setAttribute("aria-hidden", "true")
    iconElement.textContent = icon
    button.appendChild(iconElement)
    return button
  }

  renderInspector(snapshot) {
    this.propsElement.replaceChildren()
    const object = snapshot.objects.find(
      (candidate) => candidate.editorId === snapshot.activeObjectId,
    )
    const editButton = this.querySelector('[data-action="edit-properties"]')
    const applyButton = this.querySelector('[data-action="apply-position"]')
    assert(
      editButton instanceof HTMLButtonElement,
      "view-world missing edit props",
    )
    assert(
      applyButton instanceof HTMLButtonElement,
      "view-world missing apply position",
    )
    if (!object) {
      this.positionXElement.value = ""
      this.positionYElement.value = ""
      this.positionXElement.disabled = true
      this.positionYElement.disabled = true
      editButton.disabled = true
      applyButton.disabled = true
      const row = document.createElement("tr")
      const cell = document.createElement("td")
      cell.colSpan = 2
      cell.textContent = "No object selected"
      row.appendChild(cell)
      this.propsElement.appendChild(row)
      return
    }

    this.positionXElement.disabled = false
    this.positionYElement.disabled = false
    editButton.disabled = false
    applyButton.disabled = false
    this.positionXElement.value = String(object.x)
    this.positionYElement.value = String(object.y)
    const entries = Object.entries(object.props)
    if (entries.length === 0) {
      const row = document.createElement("tr")
      const cell = document.createElement("td")
      cell.colSpan = 2
      cell.textContent = "No properties"
      row.appendChild(cell)
      this.propsElement.appendChild(row)
      return
    }
    for (const [key, value] of entries) {
      const row = document.createElement("tr")
      const keyCell = document.createElement("th")
      keyCell.textContent = key
      row.appendChild(keyCell)
      const valueCell = document.createElement("td")
      valueCell.textContent = value
      row.appendChild(valueCell)
      this.propsElement.appendChild(row)
    }
  }

  renderHistory(snapshot) {
    const tbody = this.historyElement.querySelector("tbody")
    assert(
      tbody instanceof HTMLTableSectionElement,
      "view-world missing history tbody",
    )
    tbody.replaceChildren()
    if (snapshot.history.length === 0) {
      const row = document.createElement("tr")
      const cell = document.createElement("td")
      cell.colSpan = 4
      cell.textContent = "No history yet"
      row.appendChild(cell)
      tbody.appendChild(row)
      return
    }
    for (const entry of snapshot.history) {
      const row = document.createElement("tr")
      row.dataset.historyIndex = String(entry.index)
      if (entry.current) row.setAttribute("aria-selected", "true")
      for (const text of [
        String(entry.index),
        entry.label,
        entry.parentIndex >= 0 ? String(entry.parentIndex) : "root",
        entry.current ? "Current" : "",
      ]) {
        const cell = document.createElement("td")
        cell.textContent = text
        row.appendChild(cell)
      }
      tbody.appendChild(row)
    }
  }

  renderHeaderControls(snapshot) {
    const save = this.queryHeader('[data-action="save"]')
    const saveAs = this.queryHeader('[data-action="save-as"]')
    const reload = this.queryHeader('[data-action="reload"]')
    const add = this.queryHeader('[data-action="add"]')
    const remove = this.queryHeader('[data-action="delete"]')
    const properties = this.queryHeader('[data-action="properties"]')
    const undo = this.queryHeader('[data-action="undo"]')
    const redo = this.queryHeader('[data-action="redo"]')
    for (const button of [
      save,
      saveAs,
      reload,
      add,
      remove,
      properties,
      undo,
      redo,
    ])
      assert(
        button instanceof HTMLButtonElement,
        "view-world header action must be button",
      )
    save.disabled = !snapshot.loaded
    saveAs.disabled = !snapshot.loaded
    reload.disabled = !snapshot.loaded
    add.disabled = !snapshot.loaded
    remove.disabled = snapshot.activeObjectId === 0
    properties.disabled = snapshot.activeObjectId === 0
    undo.disabled = !snapshot.canUndo
    redo.disabled = !snapshot.canRedo
  }

  calculateContentBounds(data) {
    const snapshot = data || this.snapshot
    if (!snapshot || snapshot.objects.length === 0)
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    assert(
      this.rendererRegistry instanceof WorldObjectRendererRegistry,
      "view-world content bounds require initialized renderers",
    )
    const bounds = snapshot.objects.map((object) => {
      const local = this.rendererRegistry.bounds(object)
      return {
        minX: object.x + local.minX,
        minY: object.y + local.minY,
        maxX: object.x + local.maxX,
        maxY: object.y + local.maxY,
      }
    })
    return {
      minX: Math.min(...bounds.map((entry) => entry.minX)) - 32,
      minY: Math.min(...bounds.map((entry) => entry.minY)) - 32,
      maxX: Math.max(...bounds.map((entry) => entry.maxX)) + 32,
      maxY: Math.max(...bounds.map((entry) => entry.maxY)) + 32,
    }
  }

  _constrainPosition() {}

  drawContent(ctx, data) {
    const snapshot = data || this.snapshot
    if (!snapshot) return
    if (this.showGrid) this.drawGrid(ctx)
    this.drawAxes(ctx)
    this.drawObjects(ctx, snapshot)
  }

  drawGrid(ctx) {
    assert(
      this.canvas instanceof HTMLCanvasElement,
      "view-world grid requires canvas",
    )
    const minX = -this.offsetX / this.scale
    const minY = -this.offsetY / this.scale
    const maxX = (this.canvas.width - this.offsetX) / this.scale
    const maxY = (this.canvas.height - this.offsetY) / this.scale
    const step = GRID_SIZE
    ctx.save()
    ctx.strokeStyle = "rgba(255,255,255,0.12)"
    ctx.lineWidth = 1 / this.scale
    ctx.beginPath()
    for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
      ctx.moveTo(x, minY)
      ctx.lineTo(x, maxY)
    }
    for (let y = Math.floor(minY / step) * step; y <= maxY; y += step) {
      ctx.moveTo(minX, y)
      ctx.lineTo(maxX, y)
    }
    ctx.stroke()
    ctx.restore()
  }

  drawAxes(ctx) {
    assert(
      this.canvas instanceof HTMLCanvasElement,
      "view-world axes requires canvas",
    )
    const minX = -this.offsetX / this.scale
    const minY = -this.offsetY / this.scale
    const maxX = (this.canvas.width - this.offsetX) / this.scale
    const maxY = (this.canvas.height - this.offsetY) / this.scale
    ctx.save()
    ctx.strokeStyle = "rgba(255,204,102,0.65)"
    ctx.lineWidth = 1 / this.scale
    ctx.beginPath()
    ctx.moveTo(0, minY)
    ctx.lineTo(0, maxY)
    ctx.moveTo(minX, 0)
    ctx.lineTo(maxX, 0)
    ctx.stroke()
    ctx.restore()
  }

  drawObjects(ctx, snapshot) {
    if (snapshot.objects.length === 0) return
    assert(
      this.rendererRegistry instanceof WorldObjectRendererRegistry,
      "view-world draw requires initialized renderers",
    )
    snapshot.objects.forEach((object, index) => {
      this.rendererRegistry.draw(ctx, object, {
        scale: this.scale,
        label: objectDisplayName(object, index),
      })
    })
    const selected = snapshot.objects.find(
      (object) => object.editorId === snapshot.activeObjectId,
    )
    if (selected) this.drawSelection(ctx, selected)
  }

  drawSelection(ctx, object) {
    assert(
      this.rendererRegistry instanceof WorldObjectRendererRegistry,
      "view-world selection requires initialized renderers",
    )
    const bounds = this.rendererRegistry.bounds(object)
    ctx.save()
    ctx.strokeStyle = "#ffcc66"
    ctx.lineWidth = 2 / this.scale
    ctx.strokeRect(
      object.x + bounds.minX,
      object.y + bounds.minY,
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
    )
    ctx.fillStyle = "#ffcc66"
    ctx.strokeStyle = "#111"
    ctx.beginPath()
    ctx.arc(object.x, object.y, 4 / this.scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  onCanvasMouseDown(event) {
    if (event.button !== 0 || !this.state.loaded) return
    const point = this.getWorldPoint(event.clientX, event.clientY)
    const object = this.hitTest(point)
    this.focus()
    if (!object) {
      this.state.selectObject(0)
      void this.refreshSnapshot("Selection cleared")
      return
    }
    this.state.selectObject(object.editorId)
    this.objectDrag = {
      editorId: object.editorId,
      pointerX: point.x,
      pointerY: point.y,
      startX: object.x,
      startY: object.y,
    }
    this.refreshLiveSnapshot()
  }

  onCanvasMouseMove(event) {
    const point = this.getWorldPoint(event.clientX, event.clientY)
    if (this.objectDrag) {
      this.state.moveObjectLive(
        this.objectDrag.editorId,
        this.objectDrag.startX + point.x - this.objectDrag.pointerX,
        this.objectDrag.startY + point.y - this.objectDrag.pointerY,
      )
      this.refreshLiveSnapshot()
      return
    }

    const object = this.hitTest(point)
    const nextHoverObjectId = object ? object.editorId : 0
    if (nextHoverObjectId === this.hoverObjectId) return
    this.closeObjectTooltip()
    this.hoverObjectId = nextHoverObjectId
    this.canvas.style.cursor = object ? "pointer" : "default"
    if (object) this.openObjectTooltip(object, event)
  }

  onCanvasMouseUp(_event) {
    if (!this.objectDrag) return
    const drag = this.objectDrag
    const object = this.state.requireObject(drag.editorId)
    this.objectDrag = null
    const changed = this.state.commitLiveMove(
      drag.editorId,
      { x: drag.startX, y: drag.startY },
      { x: object.x, y: object.y },
    )
    void this.refreshSnapshot(changed ? "Object moved" : "Object selected")
  }

  onCanvasMouseLeave(event) {
    this.closeObjectTooltip()
    if (this.canvas) this.canvas.style.cursor = "default"
    if (!this.objectDrag || (event.buttons & 1) !== 0) return
    this.onCanvasMouseUp(event)
  }

  objectTooltipContent(object) {
    const entries = Object.entries(object.props)
    if (entries.length === 0) return "No properties"
    return entries
      .slice(0, 10)
      .map(([key, value]) => {
        const cleanKey = key.replaceAll("\n", " ↵ ")
        const cleanValue = value.replaceAll("\n", " ↵ ")
        return `${cleanKey}: ${cleanValue}`
      })
      .join("\n")
  }

  objectClientAabb(object) {
    assert(
      this.canvas instanceof HTMLCanvasElement,
      "view-world tooltip requires canvas",
    )
    assert(
      this.rendererRegistry instanceof WorldObjectRendererRegistry,
      "view-world tooltip requires initialized renderers",
    )
    const bounds = this.rendererRegistry.bounds(object)
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = rect.width / Math.max(1, this.canvas.width)
    const scaleY = rect.height / Math.max(1, this.canvas.height)
    return {
      kind: "aabb",
      x:
        rect.left +
        ((object.x + bounds.minX) * this.scale + this.offsetX) * scaleX,
      y:
        rect.top +
        ((object.y + bounds.minY) * this.scale + this.offsetY) * scaleY,
      width: (bounds.maxX - bounds.minX) * this.scale * scaleX,
      height: (bounds.maxY - bounds.minY) * this.scale * scaleY,
    }
  }

  openObjectTooltip(object, event) {
    const editorId = object.editorId
    this.hoverTooltipObjectId = editorId
    void runtime
      .call("ui.tooltip.tip", {
        anchor: { kind: "point", x: event.clientX, y: event.clientY },
        track: this.objectClientAabb(object),
        trackPadding: 2,
        followPointer: true,
        pointerOffsetX: 14,
        pointerOffsetY: 18,
        content: this.objectTooltipContent(object),
        minWidth: 220,
      })
      .then((result) => {
        const payload = unwrap(result, "ui.tooltip.tip")
        if (this.hoverTooltipObjectId === editorId) {
          this.hoverTooltipId = Number(payload.id)
          return
        }
        void runtime.call("ui.tooltip.close", {
          id: payload.id,
          reason: "stale-world-object-hover",
        })
      })
  }

  closeObjectTooltip() {
    if (
      this.hoverObjectId === 0 &&
      this.hoverTooltipObjectId === 0 &&
      this.hoverTooltipId <= 0
    )
      return
    const tooltipId = this.hoverTooltipId
    this.hoverObjectId = 0
    this.hoverTooltipObjectId = 0
    this.hoverTooltipId = 0
    if (tooltipId > 0)
      void runtime.call("ui.tooltip.close", {
        id: tooltipId,
        reason: "view-world-object-hover",
      })
  }

  hitTest(point) {
    assert(
      this.rendererRegistry instanceof WorldObjectRendererRegistry,
      "view-world hit test requires initialized renderers",
    )
    const anchorRadius = HIT_RADIUS_PX / this.scale
    const anchorRadiusSquared = anchorRadius * anchorRadius
    for (let index = this.state.objects.length - 1; index >= 0; index--) {
      const object = this.state.objects[index]
      const bounds = this.rendererRegistry.bounds(object)
      const localX = point.x - object.x
      const localY = point.y - object.y
      const insideBounds =
        localX >= bounds.minX &&
        localX <= bounds.maxX &&
        localY >= bounds.minY &&
        localY <= bounds.maxY
      const insideAnchor =
        localX * localX + localY * localY <= anchorRadiusSquared
      if (insideBounds || insideAnchor) return object
    }
    return null
  }

  setBusy(busy) {
    assert(
      this._headerControlsElement instanceof HTMLElement,
      "view-world missing header controls",
    )
    for (const button of this._headerControlsElement.querySelectorAll("button"))
      button.disabled = busy
    if (!busy) this.renderHeaderControls(this.snapshot)
  }

  setStatus(text, tone = "") {
    this.statusElement.textContent = text
    this.statusElement.className = ""
    if (tone) this.statusElement.classList.add(tone)
  }
}

if (!customElements.get("view-world")) {
  customElements.define("view-world", ViewWorld)
}
