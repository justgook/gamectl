import { runtime } from '../core/runtime.js'
import { ViewCanvasBase } from '../util/view-canvas-base.js'

const TOOL = {
  SELECT: 0,
  BRUSH: 1,
  ERASE: 2,
  EYEDROPPER: 3,
  PASTE: 4,
  FILL: 5,
}

const TOOL_LABELS = new Map([
  [TOOL.SELECT, 'Select'],
  [TOOL.BRUSH, 'Brush'],
  [TOOL.ERASE, 'Erase'],
  [TOOL.EYEDROPPER, 'Eyedropper'],
  [TOOL.PASTE, 'Paste'],
  [TOOL.FILL, 'Fill'],
])

const CLIENT_TILESETS = [
  { name: 'dungeon_floor', path: 'tilesets/dungeon_floor.png', tileWidth: 16, tileHeight: 16, columns: 8, rows: 4, firstTileId: 1 },
  { name: 'dungeon_walls', path: 'tilesets/dungeon_walls.png', tileWidth: 16, tileHeight: 16, columns: 8, rows: 4, firstTileId: 33 },
  { name: 'forest_overgrowth', path: 'tilesets/forest_overgrowth.png', tileWidth: 16, tileHeight: 16, columns: 8, rows: 4, firstTileId: 65 },
  { name: 'forest_overgrowth1', path: 'tilesets/forest_overgrowth1.png', tileWidth: 16, tileHeight: 16, columns: 8, rows: 4, firstTileId: 65 },
  { name: 'forest_overgrowth2', path: 'tilesets/forest_overgrowtah2.png', tileWidth: 16, tileHeight: 16, columns: 8, rows: 4, firstTileId: 65 },
  { name: 'forest_overgrowth3', path: 'tilesets/forest_overgrowth3.png', tileWidth: 16, tileHeight: 16, columns: 8, rows: 4, firstTileId: 65 },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class TilemapState {
  constructor() {
    this.handle = 1
    this.path = 'maps/mock.tilemap.json'
    this.width = 32
    this.height = 24
    this.layers = [
      { index: 0, name: 'Layer 0', hidden: false, locked: false },
      { index: 1, name: 'Layer 1', hidden: false, locked: false },
      { index: 2, name: 'Layer 2', hidden: false, locked: false },
    ]
    this.activeLayer = 0
    this.tool = TOOL.BRUSH
    this.activeTile = 1
    this.dirty = false
    this.canUndo = false
    this.canRedo = false
    this.hasClipboard = false
  }

  create({ path, width, height, layers }) {
    this.path = path
    this.width = width
    this.height = height
    this.layers = Array.from({ length: layers }, (_item, index) => ({
      index,
      name: `Layer ${index}`,
      hidden: false,
      locked: false,
    }))
    this.activeLayer = layers > 0 ? 0 : -1
    this.dirty = false
    this.canUndo = false
    this.canRedo = false
    return { handle: this.handle }
  }

  open({ path }) {
    this.path = path
    this.dirty = false
    return { handle: this.handle }
  }

  save({ path }) {
    this.path = path
    this.dirty = false
  }

  snapshot() {
    return {
      handle: this.handle,
      path: this.path,
      dirty: this.dirty,
      width: this.width,
      height: this.height,
      layers: this.layers.map((layer, index) => ({ ...layer, index })),
      activeLayer: this.activeLayer,
      tool: this.tool,
      activeTile: this.activeTile,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    }
  }

  setTool(tool) {
    this.tool = tool
  }

  setActiveTile(tile) {
    this.activeTile = tile
  }

  setActiveLayer(layer) {
    this.activeLayer = layer
  }

  setLayerHidden(layer, hidden) {
    this.requireLayer(layer).hidden = hidden
  }

  setLayerLocked(layer, locked) {
    this.requireLayer(layer).locked = locked
  }

  insertLayer(index) {
    assert(index >= 0 && index <= this.layers.length, 'tilemap state insert layer index out of range')
    this.layers.splice(index, 0, { index, name: `Layer ${index}`, hidden: false, locked: false })
    this.renumberLayers()
    this.markDirty()
  }

  deleteLayer(index) {
    assert(this.layers.length > 1, 'tilemap state must keep at least one layer')
    this.requireLayer(index)
    this.layers.splice(index, 1)
    this.renumberLayers()
    if (this.activeLayer === index) this.activeLayer = -1
    else if (this.activeLayer > index) this.activeLayer -= 1
    this.markDirty()
  }

  moveLayer(from, to) {
    this.requireLayer(from)
    this.requireLayer(to)
    if (from === to) return
    const [layer] = this.layers.splice(from, 1)
    this.layers.splice(to, 0, layer)
    this.renumberLayers()
    this.activeLayer = to
    this.markDirty()
  }

  cut() {
    this.hasClipboard = true
    this.markDirty()
  }

  copy() {
    this.hasClipboard = true
  }

  undo() {
    this.canUndo = false
    this.canRedo = true
  }

  redo() {
    this.canUndo = true
    this.canRedo = false
  }

  markDirty() {
    this.dirty = true
    this.canUndo = true
    this.canRedo = false
  }

  renumberLayers() {
    this.layers.forEach((layer, index) => {
      layer.index = index
      layer.name = `Layer ${index}`
    })
  }

  requireLayer(index) {
    const layer = this.layers[index]
    assert(layer, `tilemap state missing layer ${index}`)
    return layer
  }
}

function validateSnapshot(snapshot) {
  assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'view-tilemap snapshot must be an object')
  assert(Number.isInteger(snapshot.handle) && snapshot.handle > 0, 'view-tilemap snapshot.handle must be positive integer')
  assert(typeof snapshot.path === 'string', 'view-tilemap snapshot.path must be string')
  assert(typeof snapshot.dirty === 'boolean', 'view-tilemap snapshot.dirty must be boolean')
  assert(Number.isInteger(snapshot.width) && snapshot.width > 0, 'view-tilemap snapshot.width must be positive integer')
  assert(Number.isInteger(snapshot.height) && snapshot.height > 0, 'view-tilemap snapshot.height must be positive integer')
  assert(Array.isArray(snapshot.layers), 'view-tilemap snapshot.layers must be array')
  assert(Number.isInteger(snapshot.activeLayer), 'view-tilemap snapshot.activeLayer must be integer')
  assert(Number.isInteger(snapshot.tool), 'view-tilemap snapshot.tool must be integer')
  assert(Number.isInteger(snapshot.activeTile), 'view-tilemap snapshot.activeTile must be integer')
  assert(typeof snapshot.canUndo === 'boolean', 'view-tilemap snapshot.canUndo must be boolean')
  assert(typeof snapshot.canRedo === 'boolean', 'view-tilemap snapshot.canRedo must be boolean')
  for (const layer of snapshot.layers) {
    assert(Number.isInteger(layer.index), 'view-tilemap layer.index must be integer')
    assert(typeof layer.name === 'string', 'view-tilemap layer.name must be string')
    assert(typeof layer.hidden === 'boolean', 'view-tilemap layer.hidden must be boolean')
    assert(typeof layer.locked === 'boolean', 'view-tilemap layer.locked must be boolean')
  }
  return snapshot
}

export class ViewTilemap extends ViewCanvasBase {
  constructor() {
    super()
    this.state = new TilemapState()
    this.handle = 0
    this.snapshot = null
    this.sidebarElement = null
    this.statusElement = null
    this.pathElement = null
    this.dimensionsElement = null
    this.dirtyElement = null
    this.layersElement = null
    this.undoStateElement = null
    this.tilesetTabsElement = null
    this.tilesetPanelsElement = null
    this.activeTilesetName = ''
    this.selectedLayerIndexes = new Set()
    this.showGrid = true
    this.tilemapRender = new TilemapRender()
    this.tilesetRender = new TilesetRender()
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'
    this.style.display = 'contents'

    this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <aside data-element="sidebar">
        <fieldset>
          <legend>Layers</legend>
          <table data-element="layers">
            <thead>
              <tr><th>Layer</th><th>Hidden</th><th>Locked</th><th>Actions</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </fieldset>
        <fieldset data-element="tilesets">
          <legend>Tilesets</legend>
          <div role="tablist" data-element="tileset-tabs" aria-label="Tileset files"></div>
          <div data-element="tileset-panels"></div>
        </fieldset>
        <fieldset>
          <legend>Non-linear History</legend>
          <output data-element="undo-state">Tilemap history placeholder</output>
        </fieldset>
      </aside>
      <footer>
        <output data-element="path"></output>
        <output data-element="dimensions"></output>
        <output data-element="dirty"></output>
        <output data-element="status">Loading tilemap…</output>
      </footer>
    `

    this.sidebarElement = this.querySelector('[data-element="sidebar"]')
    this.statusElement = this.querySelector('[data-element="status"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    this.dimensionsElement = this.querySelector('[data-element="dimensions"]')
    this.dirtyElement = this.querySelector('[data-element="dirty"]')
    this.layersElement = this.querySelector('[data-element="layers"]')
    this.undoStateElement = this.querySelector('[data-element="undo-state"]')
    this.tilesetTabsElement = this.querySelector('[data-element="tileset-tabs"]')
    this.tilesetPanelsElement = this.querySelector('[data-element="tileset-panels"]')

    assert(this.sidebarElement instanceof HTMLElement, 'view-tilemap missing sidebar')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-tilemap missing status output')
    assert(this.pathElement instanceof HTMLOutputElement, 'view-tilemap missing path output')
    assert(this.dimensionsElement instanceof HTMLOutputElement, 'view-tilemap missing dimensions output')
    assert(this.dirtyElement instanceof HTMLOutputElement, 'view-tilemap missing dirty output')
    assert(this.layersElement instanceof HTMLTableElement, 'view-tilemap missing layers table')
    assert(this.undoStateElement instanceof HTMLOutputElement, 'view-tilemap missing undo output')
    assert(this.tilesetTabsElement instanceof HTMLElement, 'view-tilemap missing tileset tabs')
    assert(this.tilesetPanelsElement instanceof HTMLElement, 'view-tilemap missing tileset panels')

    super.connectedCallback()
    this.bindEvents()
    void this.bootstrap()
  }

  createHeaderControlsElement() {
    const controls = document.createElement('div')
    controls.dataset.element = 'header-controls'
    controls.innerHTML = `
      <button type="button" data-action="open"><i aria-hidden="true">folder_open</i></button>
      <button type="button" data-action="save" class="accent"><i aria-hidden="true">save</i></button>
      <button type="button" data-action="save-as"><i aria-hidden="true">save_as</i></button>
      <button type="button" data-action="reload"><i aria-hidden="true">refresh</i></button>
      <div role="buttongroup" data-element="tools">
        <button type="button" data-action="select" data-tool="0"><i aria-hidden="true">select_all</i></button>
        <button type="button" data-action="brush" data-tool="1"><i aria-hidden="true">brush</i></button>
        <button type="button" data-action="erase" data-tool="2"><i aria-hidden="true">ink_eraser</i></button>
        <button type="button" data-action="eyedropper" data-tool="3"><i aria-hidden="true">colorize</i></button>
        <button type="button" data-action="paste-tool" data-tool="4"><i aria-hidden="true">content_paste</i></button>
        <button type="button" data-action="fill" data-tool="5"><i aria-hidden="true">format_color_fill</i></button>
      </div>
      <div role="buttongroup" data-element="edit-actions">
        <button type="button" data-action="cut"><i aria-hidden="true">content_cut</i></button>
        <button type="button" data-action="copy"><i aria-hidden="true">content_copy</i></button>
        <button type="button" data-action="undo"><i aria-hidden="true">undo</i></button>
        <button type="button" data-action="redo"><i aria-hidden="true">redo</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="grid" aria-selected="true"><i aria-hidden="true">grid_on</i></button>
        <button type="button" data-action="zoom-in"><i aria-hidden="true">zoom_in</i></button>
        <button type="button" data-action="zoom-out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit"><i aria-hidden="true">fit_screen</i></button>
      </div>
      <button type="button" data-action="settings"><i aria-hidden="true">settings</i></button>
    `
    return controls
  }

  bindEvents() {
    this.tilesetTabsElement.addEventListener('click', (event) => {
      const button = event.target.closest('button[role="tab"][data-tileset]')
      if (!(button instanceof HTMLButtonElement)) return
      this.selectTilesetTab(button.dataset.tileset)
    })

    this.layersElement.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]')
      if (button instanceof HTMLButtonElement) {
        await this.handleLayerAction(button)
        return
      }

      const row = event.target.closest('tr[data-layer]')
      if (!(row instanceof HTMLTableRowElement)) return
      await this.toggleLayerSelection(Number(row.dataset.layer))
    })

    this.queryHeader('[data-action="open"]').addEventListener('click', async () => this.openMock())
    this.queryHeader('[data-action="save"]').addEventListener('click', async () => this.save())
    this.queryHeader('[data-action="save-as"]').addEventListener('click', async () => this.saveAsMock())
    this.queryHeader('[data-action="reload"]').addEventListener('click', async () => this.reload())
    this.queryHeader('[data-action="select"]').addEventListener('click', async () => this.setTool(TOOL.SELECT))
    this.queryHeader('[data-action="brush"]').addEventListener('click', async () => this.setTool(TOOL.BRUSH))
    this.queryHeader('[data-action="erase"]').addEventListener('click', async () => this.setTool(TOOL.ERASE))
    this.queryHeader('[data-action="eyedropper"]').addEventListener('click', async () => this.setTool(TOOL.EYEDROPPER))
    this.queryHeader('[data-action="paste-tool"]').addEventListener('click', async () => this.setTool(TOOL.PASTE))
    this.queryHeader('[data-action="fill"]').addEventListener('click', async () => this.setTool(TOOL.FILL))
    this.queryHeader('[data-action="cut"]').addEventListener('click', async () => this.command('cut', 'Cut'))
    this.queryHeader('[data-action="copy"]').addEventListener('click', async () => this.command('copy', 'Copy'))
    this.queryHeader('[data-action="undo"]').addEventListener('click', async () => this.command('undo', 'Undo'))
    this.queryHeader('[data-action="redo"]').addEventListener('click', async () => this.command('redo', 'Redo'))
    this.queryHeader('[data-action="grid"]').addEventListener('click', () => this.toggleGrid())
    this.queryHeader('[data-action="zoom-in"]').addEventListener('click', () => this.zoomIn())
    this.queryHeader('[data-action="zoom-out"]').addEventListener('click', () => this.zoomOut())
    this.queryHeader('[data-action="zoom-fit"]').addEventListener('click', () => this.fitToContent())
    this.queryHeader('[data-action="settings"]').addEventListener('click', async () => this.openSettings())
  }

  queryHeader(selector) {
    const element = this.queryHeaderControl(selector)
    assert(element instanceof HTMLElement, `view-tilemap missing header control ${selector}`)
    return element
  }

  async bootstrap() {
    this.setBusy(true)
    this.setStatus('Creating mock tilemap…', 'info')
    try {
      const path = this.getAttribute('path') || this.getAttribute('data-path') || 'maps/mock.tilemap.json'
      const result = this.state.create({
        path,
        width: 32,
        height: 24,
        layers: 3,
      })
      assert(Number.isInteger(result.handle) && result.handle > 0, 'view-tilemap create returned invalid handle')
      this.handle = result.handle
      await this.refreshSnapshot('Ready')
    } catch (error) {
      this.setStatus(String(error?.message || error), 'danger')
      await runtime.call('ui.toast', 'error', { message: String(error?.message || error) })
    } finally {
      this.setBusy(false)
    }
  }

  async handleLayerAction(button) {
    const layer = Number(button.dataset.layer)
    const action = button.dataset.action
    if (action === 'layer-hidden') {
      this.state.setLayerHidden(layer, button.dataset.next === '1')
    } else if (action === 'layer-locked') {
      this.state.setLayerLocked(layer, button.dataset.next === '1')
    } else if (action === 'layer-insert') {
      this.state.insertLayer(layer + 1)
    } else if (action === 'layer-delete') {
      this.state.deleteLayer(layer)
    } else if (action === 'layer-up') {
      this.state.moveLayer(layer, Math.max(0, layer - 1))
    } else if (action === 'layer-down') {
      assert(this.snapshot, 'view-tilemap missing snapshot for layer-down')
      this.state.moveLayer(layer, Math.min(this.snapshot.layers.length - 1, layer + 1))
    } else {
      throw new Error(`view-tilemap unknown layer action ${action}`)
    }
    await this.refreshSnapshot('Layer updated')
  }

  async openMock() {
    const path = this.snapshot?.path || 'maps/mock.tilemap.json'
    const result = this.state.open({ path })
    assert(Number.isInteger(result.handle) && result.handle > 0, 'view-tilemap open returned invalid handle')
    this.handle = result.handle
    await this.refreshSnapshot('Opened')
  }

  async saveAsMock() {
    this.state.save({ path: this.snapshot?.path || 'maps/mock.tilemap.json' })
    await this.refreshSnapshot('Saved as mock path')
  }

  async save() {
    this.state.save({ path: this.snapshot?.path || 'maps/mock.tilemap.json' })
    await this.refreshSnapshot('Saved')
  }

  async reload() {
    await this.refreshSnapshot('Reloaded snapshot')
  }

  async setTool(tool) {
    this.state.setTool(tool)
    await this.refreshSnapshot(`${TOOL_LABELS.get(tool)} tool selected`)
  }

  toggleGrid() {
    const button = this.queryHeader('[data-action="grid"]')
    assert(button instanceof HTMLButtonElement, 'view-tilemap grid control must be a button')
    const enabled = button.getAttribute('aria-selected') !== 'true'
    button.setAttribute('aria-selected', enabled ? 'true' : 'false')
    this.showGrid = enabled
    this.draw()
    this.setStatus(enabled ? 'Grid preview enabled' : 'Grid preview disabled', 'info')
  }

  async command(method, label) {
    const fn = this.state[method]
    assert(typeof fn === 'function', `view-tilemap state missing command ${method}`)
    fn.call(this.state)
    await this.refreshSnapshot(label)
  }

  async openSettings() {
    await runtime.call('ui.popup', 'open', {
      title: 'Tilemap Settings',
      content: 'Tilemap settings placeholder',
    })
  }

  async refreshSnapshot(statusText) {
    const snapshot = validateSnapshot(this.state.snapshot())
    this.snapshot = snapshot
    this.setData(snapshot)
    this.renderSnapshot(snapshot)
    this.setStatus(statusText, snapshot.dirty ? 'warning' : 'success')
  }

  requireHandle() {
    assert(Number.isInteger(this.handle) && this.handle > 0, 'view-tilemap requires open handle')
    return this.handle
  }

  renderSnapshot(snapshot) {
    this.pathElement.textContent = `Path: ${snapshot.path}`
    this.dimensionsElement.textContent = `Size: ${snapshot.width} × ${snapshot.height}`
    this.dirtyElement.textContent = snapshot.dirty ? 'Dirty' : 'Saved'
    this.dirtyElement.className = snapshot.dirty ? 'warning' : 'success'

    this.renderHeaderControls(snapshot)
    this.renderLayers(snapshot)
    this.renderTilesets(snapshot.activeTile)

    this.undoStateElement.textContent = `Non-linear history placeholder — undo: ${snapshot.canUndo ? 'yes' : 'no'} / redo: ${snapshot.canRedo ? 'yes' : 'no'}`
  }

  selectTilesetTab(name) {
    assert(typeof name === 'string' && name.length > 0, 'view-tilemap tileset tab requires name')
    assert(this.tilesetTabsElement instanceof HTMLElement, 'view-tilemap missing tileset tabs')
    assert(this.tilesetPanelsElement instanceof HTMLElement, 'view-tilemap missing tileset panels')
    this.activeTilesetName = name

    for (const button of this.tilesetTabsElement.querySelectorAll('button[role="tab"][data-tileset]')) {
      assert(button instanceof HTMLButtonElement, 'view-tilemap tileset tab must be a button')
      const selected = button.dataset.tileset === name
      button.setAttribute('aria-selected', selected ? 'true' : 'false')
    }

    for (const panel of this.tilesetPanelsElement.querySelectorAll('[role="tabpanel"][data-tileset]')) {
      assert(panel instanceof HTMLFieldSetElement, 'view-tilemap tileset panel must be a fieldset')
      panel.hidden = panel.dataset.tileset !== name
    }
  }

  renderTilesets(activeTile) {
    assert(Number.isInteger(activeTile), 'view-tilemap active tile must be integer')
    assert(this.tilesetTabsElement instanceof HTMLElement, 'view-tilemap missing tileset tabs')
    assert(this.tilesetPanelsElement instanceof HTMLElement, 'view-tilemap missing tileset panels')
    this.tilesetTabsElement.replaceChildren()
    this.tilesetPanelsElement.replaceChildren()

    const activeTileset = CLIENT_TILESETS.find((tileset) => this.tilesetRender.containsTile(tileset, activeTile))
    const activeName = CLIENT_TILESETS.some((tileset) => tileset.name === this.activeTilesetName)
      ? this.activeTilesetName
      : activeTileset?.name || CLIENT_TILESETS[0].name

    for (const tileset of CLIENT_TILESETS) {
      const selected = tileset.name === activeName
      const panelId = `view-tilemap-tileset-${tileset.name}`

      const tab = document.createElement('button')
      tab.type = 'button'
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-selected', selected ? 'true' : 'false')
      tab.setAttribute('aria-controls', panelId)
      tab.dataset.action = 'tileset-tab'
      tab.dataset.tileset = tileset.name
      tab.textContent = tileset.name
      this.tilesetTabsElement.appendChild(tab)

      const panel = document.createElement('fieldset')
      panel.setAttribute('role', 'tabpanel')
      panel.dataset.tileset = tileset.name
      panel.id = panelId
      panel.hidden = !selected

      const legend = document.createElement('legend')
      legend.textContent = tileset.name
      panel.appendChild(legend)

      const canvas = document.createElement('canvas')
      canvas.dataset.element = 'tileset-canvas'
      canvas.dataset.tileset = tileset.name
      canvas.width = tileset.columns * tileset.tileWidth
      canvas.height = tileset.rows * tileset.tileHeight
      canvas.addEventListener('click', async (event) => this.selectTileFromTileset(event, tileset))
      panel.appendChild(canvas)
      this.tilesetRender.draw(canvas, tileset, activeTile)

      const status = document.createElement('output')
      status.dataset.element = 'tileset-status'
      status.textContent = `${tileset.path} — client-side helper only; click grid cells to set active tile id`
      panel.appendChild(status)

      this.tilesetPanelsElement.appendChild(panel)
    }

    this.activeTilesetName = activeName
  }

  async selectTileFromTileset(event, tileset) {
    assert(event.currentTarget instanceof HTMLCanvasElement, 'view-tilemap tileset click requires canvas')
    const tile = this.tilesetRender.tileFromPointerEvent(event, tileset)
    this.state.setActiveTile(tile)
    await this.refreshSnapshot(`Active tile ${tile} selected from ${tileset.name}`)
  }

  renderHeaderControls(snapshot) {
    assert(this._headerControlsElement instanceof HTMLElement, 'view-tilemap missing header controls')
    for (const button of this._headerControlsElement.querySelectorAll('button[data-tool]')) {
      assert(button instanceof HTMLButtonElement, 'view-tilemap tool control must be a button')
      const selected = Number(button.dataset.tool) === snapshot.tool
      button.classList.toggle('accent', selected)
      if (selected) button.setAttribute('aria-selected', 'true')
      else button.removeAttribute('aria-selected')
    }

    const undoButton = this.queryHeader('[data-action="undo"]')
    const redoButton = this.queryHeader('[data-action="redo"]')
    assert(undoButton instanceof HTMLButtonElement, 'view-tilemap undo control must be a button')
    assert(redoButton instanceof HTMLButtonElement, 'view-tilemap redo control must be a button')
    undoButton.disabled = !snapshot.canUndo
    redoButton.disabled = !snapshot.canRedo
  }

  normalizeSelectedLayers(snapshot) {
    const available = new Set(snapshot.layers.map((layer) => layer.index))
    for (const index of [...this.selectedLayerIndexes]) {
      if (!available.has(index)) this.selectedLayerIndexes.delete(index)
    }

  }

  async toggleLayerSelection(layer) {
    if (this.selectedLayerIndexes.has(layer)) this.selectedLayerIndexes.delete(layer)
    else this.selectedLayerIndexes.add(layer)

    await this.syncBackendActiveLayerFromSelection()
    this.renderLayers(this.requireSnapshot())
    this.draw()
    this.setStatus('Layer selection updated', 'info')
  }

  async syncBackendActiveLayerFromSelection() {
    if (this.selectedLayerIndexes.size === 1) {
      const [layer] = [...this.selectedLayerIndexes]
      this.state.setActiveLayer(layer)
      return
    }

    this.state.setActiveLayer(-1)
  }

  requireSnapshot() {
    assert(this.snapshot, 'view-tilemap requires snapshot')
    return this.snapshot
  }

  renderLayers(snapshot) {
    const tbody = this.layersElement.querySelector('tbody')
    assert(tbody instanceof HTMLTableSectionElement, 'view-tilemap missing layers tbody')
    tbody.replaceChildren()
    this.normalizeSelectedLayers(snapshot)

    for (const layer of snapshot.layers) {
      const row = document.createElement('tr')
      row.dataset.layer = String(layer.index)
      if (this.selectedLayerIndexes.has(layer.index)) row.setAttribute('aria-selected', 'true')

      const nameCell = document.createElement('td')
      nameCell.textContent = layer.name
      row.appendChild(nameCell)

      const hiddenCell = document.createElement('td')
      hiddenCell.appendChild(this.createLayerButton('layer-hidden', layer.index, layer.hidden ? 'visibility_off' : 'visibility', layer.hidden ? '0' : '1'))
      row.appendChild(hiddenCell)

      const lockedCell = document.createElement('td')
      lockedCell.appendChild(this.createLayerButton('layer-locked', layer.index, layer.locked ? 'lock' : 'lock_open', layer.locked ? '0' : '1'))
      row.appendChild(lockedCell)

      const actionsCell = document.createElement('td')
      actionsCell.appendChild(this.createLayerButton('layer-up', layer.index, 'arrow_upward', ''))
      actionsCell.appendChild(this.createLayerButton('layer-down', layer.index, 'arrow_downward', ''))
      actionsCell.appendChild(this.createLayerButton('layer-insert', layer.index, 'add', ''))
      actionsCell.appendChild(this.createLayerButton('layer-delete', layer.index, 'delete', ''))
      row.appendChild(actionsCell)

      tbody.appendChild(row)
    }
  }

  calculateContentBounds(data) {
    const snapshot = data || this.snapshot || this.state.snapshot()
    return this.tilemapRender.calculateContentBounds(snapshot)
  }

  drawContent(ctx, data) {
    const snapshot = data || this.snapshot
    if (!snapshot) return
    this.tilemapRender.draw(ctx, {
      snapshot,
      selectedLayerIndexes: this.selectedLayerIndexes,
      showGrid: this.showGrid,
      scale: this.scale,
    })
  }

  createLayerButton(action, layer, icon, next) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.action = action
    button.dataset.layer = String(layer)
    if (next) button.dataset.next = next
    const iconElement = document.createElement('i')
    iconElement.setAttribute('aria-hidden', 'true')
    iconElement.textContent = icon
    button.appendChild(iconElement)
    return button
  }

  setBusy(isBusy) {
    assert(this._headerControlsElement instanceof HTMLElement, 'view-tilemap missing header controls')
    for (const button of this._headerControlsElement.querySelectorAll('button')) {
      button.disabled = isBusy
    }
    if (!isBusy && this.snapshot) this.renderHeaderControls(this.snapshot)
  }

  setStatus(text, tone = '') {
    this.statusElement.textContent = text
    this.statusElement.className = ''
    if (tone) this.statusElement.classList.add(tone)
  }
}

if (!customElements.get('view-tilemap')) {
  customElements.define('view-tilemap', ViewTilemap)
}



const DEFAULT_TILE_WIDTH = 16
const DEFAULT_TILE_HEIGHT = 16
const DEFAULT_LAYER_COLORS = ['#7aa2ff', '#3ddc97', '#ffcc66', '#ff5c7a', '#5bd6ff']

export class TilemapRender {
  constructor({ tileWidth = DEFAULT_TILE_WIDTH, tileHeight = DEFAULT_TILE_HEIGHT, layerColors = DEFAULT_LAYER_COLORS } = {}) {
    assert(Number.isInteger(tileWidth) && tileWidth > 0, 'tilemap render tileWidth must be positive integer')
    assert(Number.isInteger(tileHeight) && tileHeight > 0, 'tilemap render tileHeight must be positive integer')
    assert(Array.isArray(layerColors) && layerColors.length > 0, 'tilemap render layerColors must be non-empty array')
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    this.layerColors = layerColors
  }

  calculateContentBounds(snapshot) {
    this.validateSnapshotShape(snapshot)
    return {
      minX: 0,
      minY: 0,
      maxX: snapshot.width * this.tileWidth,
      maxY: snapshot.height * this.tileHeight,
    }
  }

  draw(ctx, { snapshot, selectedLayerIndexes, showGrid, scale }) {
    assert(ctx instanceof CanvasRenderingContext2D, 'tilemap render requires 2d context')
    this.validateSnapshotShape(snapshot)
    assert(selectedLayerIndexes instanceof Set, 'tilemap render selectedLayerIndexes must be a Set')
    assert(typeof showGrid === 'boolean', 'tilemap render showGrid must be boolean')
    assert(Number.isFinite(scale) && scale > 0, 'tilemap render scale must be positive number')

    const widthPx = snapshot.width * this.tileWidth
    const heightPx = snapshot.height * this.tileHeight

    ctx.save()
    this.drawBackground(ctx, snapshot, widthPx, heightPx)
    this.drawLayers(ctx, snapshot, selectedLayerIndexes)
    if (showGrid) this.drawGrid(ctx, snapshot, widthPx, heightPx, scale)
    this.drawBounds(ctx, widthPx, heightPx, scale)
    ctx.restore()
  }

  drawBackground(ctx, snapshot, widthPx, heightPx) {
    ctx.fillStyle = '#18212b'
    ctx.fillRect(0, 0, widthPx, heightPx)

    for (let y = 0; y < snapshot.height; y++) {
      for (let x = 0; x < snapshot.width; x++) {
        const parity = (x + y) % 2
        ctx.fillStyle = parity ? '#243244' : '#202c3b'
        ctx.fillRect(x * this.tileWidth, y * this.tileHeight, this.tileWidth, this.tileHeight)
      }
    }
  }

  drawLayers(ctx, snapshot, selectedLayerIndexes) {
    for (const layer of snapshot.layers) {
      if (layer.hidden) continue
      const layerAlpha = selectedLayerIndexes.size === 0 || selectedLayerIndexes.has(layer.index) ? 0.45 : 0.16
      ctx.globalAlpha = layerAlpha
      ctx.fillStyle = this.layerColors[layer.index % this.layerColors.length]
      const inset = 2 + layer.index * 2
      for (let y = layer.index; y < snapshot.height; y += 4) {
        for (let x = layer.index; x < snapshot.width; x += 5) {
          ctx.fillRect(
            x * this.tileWidth + inset,
            y * this.tileHeight + inset,
            this.tileWidth - inset * 2,
            this.tileHeight - inset * 2,
          )
        }
      }
    }
    ctx.globalAlpha = 1
  }

  drawGrid(ctx, snapshot, widthPx, heightPx, scale) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1 / scale
    ctx.beginPath()
    for (let x = 0; x <= snapshot.width; x++) {
      ctx.moveTo(x * this.tileWidth, 0)
      ctx.lineTo(x * this.tileWidth, heightPx)
    }
    for (let y = 0; y <= snapshot.height; y++) {
      ctx.moveTo(0, y * this.tileHeight)
      ctx.lineTo(widthPx, y * this.tileHeight)
    }
    ctx.stroke()
  }

  drawBounds(ctx, widthPx, heightPx, scale) {
    ctx.strokeStyle = '#ffcc66'
    ctx.lineWidth = 2 / scale
    ctx.strokeRect(0, 0, widthPx, heightPx)
  }

  validateSnapshotShape(snapshot) {
    assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'tilemap render snapshot must be an object')
    assert(Number.isInteger(snapshot.width) && snapshot.width > 0, 'tilemap render snapshot.width must be positive integer')
    assert(Number.isInteger(snapshot.height) && snapshot.height > 0, 'tilemap render snapshot.height must be positive integer')
    assert(Array.isArray(snapshot.layers), 'tilemap render snapshot.layers must be array')
  }
}

export class TilesetRender {
  draw(canvas, tileset, activeTile) {
    assert(canvas instanceof HTMLCanvasElement, 'tileset render requires canvas')
    this.validateTileset(tileset)
    assert(Number.isInteger(activeTile), 'tileset render activeTile must be integer')

    const ctx = canvas.getContext('2d')
    assert(ctx, 'tileset render canvas requires 2d context')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#222'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#888'
    ctx.fillStyle = '#ddd'
    ctx.font = '10px monospace'

    for (let y = 0; y < tileset.rows; y++) {
      for (let x = 0; x < tileset.columns; x++) {
        const tile = tileset.firstTileId + y * tileset.columns + x
        const px = x * tileset.tileWidth
        const py = y * tileset.tileHeight
        ctx.strokeRect(px + 0.5, py + 0.5, tileset.tileWidth, tileset.tileHeight)
        ctx.fillText(String(tile), px + 2, py + 11)
        if (tile === activeTile) this.drawActiveTile(ctx, px, py, tileset)
      }
    }
  }

  tileFromPointerEvent(event, tileset) {
    assert(event.currentTarget instanceof HTMLCanvasElement, 'tileset render pointer event requires canvas currentTarget')
    this.validateTileset(tileset)
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / tileset.tileWidth)
    const y = Math.floor((event.clientY - rect.top) / tileset.tileHeight)
    assert(x >= 0 && x < tileset.columns && y >= 0 && y < tileset.rows, 'tileset render pointer outside tileset bounds')
    return tileset.firstTileId + y * tileset.columns + x
  }

  containsTile(tileset, tile) {
    this.validateTileset(tileset)
    assert(Number.isInteger(tile), 'tileset render tile must be integer')
    const count = tileset.columns * tileset.rows
    return tile >= tileset.firstTileId && tile < tileset.firstTileId + count
  }

  drawActiveTile(ctx, px, py, tileset) {
    ctx.save()
    ctx.strokeStyle = '#ffcc66'
    ctx.lineWidth = 2
    ctx.strokeRect(px + 1, py + 1, tileset.tileWidth - 2, tileset.tileHeight - 2)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 1
    ctx.strokeRect(px + 3.5, py + 3.5, tileset.tileWidth - 7, tileset.tileHeight - 7)
    ctx.restore()
  }

  validateTileset(tileset) {
    assert(tileset && typeof tileset === 'object' && !Array.isArray(tileset), 'tileset render tileset must be an object')
    assert(typeof tileset.name === 'string' && tileset.name.length > 0, 'tileset render tileset.name must be non-empty string')
    assert(typeof tileset.path === 'string', 'tileset render tileset.path must be string')
    assert(Number.isInteger(tileset.tileWidth) && tileset.tileWidth > 0, 'tileset render tileset.tileWidth must be positive integer')
    assert(Number.isInteger(tileset.tileHeight) && tileset.tileHeight > 0, 'tileset render tileset.tileHeight must be positive integer')
    assert(Number.isInteger(tileset.columns) && tileset.columns > 0, 'tileset render tileset.columns must be positive integer')
    assert(Number.isInteger(tileset.rows) && tileset.rows > 0, 'tileset render tileset.rows must be positive integer')
    assert(Number.isInteger(tileset.firstTileId), 'tileset render tileset.firstTileId must be integer')
  }
}
