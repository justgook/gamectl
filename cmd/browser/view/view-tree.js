import { runtime } from '/core/runtime.js'
import { registerViewPlugin, unregisterViewPlugin, viewOk } from '/util/view-plugin.js'
import { parseCSVLines } from '/util/csv.js'

const textDecoder = new TextDecoder()

const MIN_SCALE = 0.2
const MAX_SCALE = 3.0
const NODE_MIN_WIDTH = 200
const NODE_MIN_HEIGHT = 72
const NODE_PADDING_X = 14
const NODE_PADDING_Y = 12
const TITLE_FONT_PX = 13
const DATA_FONT_PX = 11
const LINE_HEIGHT = 17
const MAX_VISIBLE_DATA = 5
const HORIZONTAL_SPACING = 150
const MIN_VERTICAL_SPACING = 42
const CONTENT_PADDING_X = 180
const CONTENT_PADDING_Y = 120

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function decodeOutput(result) {
  return textDecoder.decode(result?.output || new Uint8Array())
}

function quoteSqlValue(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(info || 'shader compile failed')
  }
  return shader
}

function createProgram(gl, vert, frag) {
  const program = gl.createProgram()
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vert))
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(info || 'program link failed')
  }
  return program
}

function buildGlyphMap(meta) {
  const map = new Map()
  assert(meta && meta.glyphs && meta.atlas, 'view-tree text atlas metadata missing glyphs or atlas')
  const aw = Number(meta.atlas.width) || 1
  const ah = Number(meta.atlas.height) || 1
  const em = Number(meta.atlas.size) || 1
  const yOriginTop = meta.atlas.yOrigin === 'top'

  for (const g of meta.glyphs) {
    const code = g.unicode
    const advancePx = Number(g.advance || 0) * em
    if (!g.planeBounds || !g.atlasBounds) {
      map.set(code, { empty: true, advancePx })
      continue
    }

    const ab = g.atlasBounds
    const pb = g.planeBounds
    const left = Number(ab.left)
    const right = Number(ab.right)
    const srcBottom = Number(ab.bottom)
    const srcTop = Number(ab.top)
    const bottom = yOriginTop ? ah - srcBottom : srcBottom
    const top = yOriginTop ? ah - srcTop : srcTop
    const widthPx = right - left
    const heightPx = top - bottom

    map.set(code, {
      empty: false,
      uv: [left / aw, bottom / ah, widthPx / aw, heightPx / ah],
      widthPx,
      heightPx,
      offsetXPx: (Number(pb.left) + Number(pb.right)) * 0.5 * em,
      baselineOffsetYPx: -((Number(pb.bottom) + Number(pb.top)) * 0.5 * em),
      advancePx,
    })
  }

  return map
}

function getTreeRenderAssets() {
  return {
    theme: {
      clear: [11 / 255, 25 / 255, 34 / 255, 1],
      text: [214 / 255, 236 / 255, 248 / 255, 1],
      textMuted: [147 / 255, 177 / 255, 194 / 255, 1],
      selection: [74 / 255, 199 / 255, 255 / 255, 1],
      edge: [70 / 255, 108 / 255, 132 / 255, 0.95],
    },
    edge: {
      handleMin: 26,
      handleMax: 180,
      halfWidthPx: 1.7,
      glowPx: 2.2,
      aaPx: 1.0,
    },
    text: {
      aa: 8,
      effect: 'fill',
      stroke: 2.5,
      glow: 2,
      shadowX: 4,
      shadowY: -4,
      source: {
        metaUrl: '/demo/ng/atlas-mtsdf.json',
        atlasUrl: '/demo/ng/atlas-mtsdf.png',
        channels: 4,
      },
    },
    nineSlices: {
      idle: { textureUrl: '/demo/ng/nine.png', left: 8, right: 8, top: 8, bottom: 8 },
      hover: { textureUrl: '/demo/ng/nine-hover.png', left: 8, right: 8, top: 8, bottom: 8 },
      selected: { textureUrl: '/demo/ng/nine-selected.png', left: 8, right: 8, top: 8, bottom: 8 },
    },
  }
}

function cloneStringData(input, label) {
  if (input == null) return {}
  assert(input && typeof input === 'object' && !Array.isArray(input), `${label} data must be an object`)
  const data = {}
  for (const [key, value] of Object.entries(input)) data[String(key)] = String(value ?? '')
  return data
}

function cloneTreeNode(node, index, length) {
  assert(node && typeof node === 'object' && !Array.isArray(node), `view-tree node ${index} must be an object`)
  const parent = Number(node.parent)
  assert(Number.isInteger(parent), `view-tree node ${index}.parent must be an integer`)
  if (index === 0) {
    assert(parent === -1 || parent === 0, 'view-tree root node parent must be -1 or 0')
    return { parent, data: cloneStringData(node.data, `view-tree node ${index}`) }
  }
  assert(parent >= 0 && parent < length, `view-tree node ${index}.parent references missing node ${parent}`)
  return { parent, data: cloneStringData(node.data, `view-tree node ${index}`) }
}

function cloneTree(input) {
  assert(Array.isArray(input), 'view-tree storage data must be an array')
  assert(input.length > 0, 'view-tree storage data must contain a root node')
  const tree = input.map((node, index) => cloneTreeNode(node, index, input.length))
  for (let index = 1; index < tree.length; index += 1) {
    let current = tree[index].parent
    const seen = new Set([index])
    while (current !== 0) {
      assert(!seen.has(current), `view-tree node ${index} parent chain contains a cycle`)
      seen.add(current)
      current = tree[current].parent
    }
  }
  return tree
}

export class ViewTree extends HTMLElement {
  static get observedAttributes() {
    return ['data-key', 'data-source']
  }

  constructor() {
    super()
    this.assets = getTreeRenderAssets()
    this.canvas = null
    this.gl = null
    this.keyElement = null
    this.countElement = null
    this.dirtyElement = null
    this.statusElement = null
    this._headerControlsElement = null
    this.resizeObserver = new ResizeObserver(() => {
      this._resizeCanvas()
      this.render()
    })
    this._resizeTarget = null
    this.treeKey = this._readTreeKey()
    this.treeData = []
    this.nodePositions = new Map()
    this.nodeSizes = new Map()
    this.selectedNodeIndex = -1
    this.hoverNodeIndex = -1
    this.dirty = false
    this.scale = 1
    this.offsetX = 0
    this.offsetY = 0
    this.contentBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    this._ready = false
    this._renderQueued = false
    this._pointerMode = 'idle'
    this._pointerStartClientX = 0
    this._pointerStartClientY = 0
    this._pointerStartOffsetX = 0
    this._pointerStartOffsetY = 0
    this.baseVao = null
    this.baseVbo = null
    this.edgeProgram = null
    this.nodeProgram = null
    this.textProgram = null
    this.edgeBuffer = null
    this.nodeBuffer = null
    this.skinTextures = null
    this.textAtlas = null
    this._onWheel = this._onWheel.bind(this)
    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)
  }

  connectedCallback() {
    registerViewPlugin(this, this.createViewPluginMethods())
    if (!this._ready) {
      this._ready = true
      this.style.display = 'contents'
      this.innerHTML = `
        <canvas data-element="canvas"></canvas>
        <footer>
          <output data-element="key"></output>
          <output data-element="count"></output>
          <output data-element="dirty"></output>
          <output data-element="status">No tree loaded</output>
        </footer>
      `
      this.canvas = this.querySelector('canvas[data-element="canvas"]')
      this.keyElement = this.querySelector('[data-element="key"]')
      this.countElement = this.querySelector('[data-element="count"]')
      this.dirtyElement = this.querySelector('[data-element="dirty"]')
      this.statusElement = this.querySelector('[data-element="status"]')
      assert(this.canvas instanceof HTMLCanvasElement, 'view-tree missing canvas')
      assert(this.keyElement instanceof HTMLOutputElement, 'view-tree missing key output')
      assert(this.countElement instanceof HTMLOutputElement, 'view-tree missing count output')
      assert(this.dirtyElement instanceof HTMLOutputElement, 'view-tree missing dirty output')
      assert(this.statusElement instanceof HTMLOutputElement, 'view-tree missing status output')
      this._styleCanvas()
      this.gl = this.canvas.getContext('webgl2', { alpha: false, antialias: true })
      assert(this.gl, 'view-tree requires WebGL2')
      this._mountHeaderControls()
      this._initPrograms()
      this._bindEvents()
      this._resizeTarget = this.parentElement || this.canvas
      this.resizeObserver.observe(this._resizeTarget)
      this._loadAssets().then(async () => {
        if (this.treeKey) await this.loadTree()
        else this.newTreeData('untitled', { dirty: true, fit: true })
      }).catch((error) => { throw error })
    }
    this.render()
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect()
    this._resizeTarget = null
    this._unbindEvents()
    this._unmountHeaderControls()
    void unregisterViewPlugin(this)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== 'data-key' && name !== 'data-source') return
    this.treeKey = this._readTreeKey()
    this.updateFooter()
    if (this._ready) void this.loadTree()
  }

  _readTreeKey() {
    return String(this.getAttribute('data-key') || this.getAttribute('data-source') || '').trim()
  }

  _styleCanvas() {
    this.canvas.style.display = 'block'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.minWidth = '0'
    this.canvas.style.minHeight = '0'
    this.canvas.style.maxWidth = '100%'
    this.canvas.style.maxHeight = '100%'
    this.canvas.style.justifySelf = 'stretch'
    this.canvas.style.alignSelf = 'stretch'
    this.canvas.style.touchAction = 'none'
    this.canvas.tabIndex = 0
  }

  createViewPluginMethods() {
    return {
      tool_1: async () => {
        await this.addNode()
        return viewOk()
      },
      tool_2: async () => {
        await this.changeParent()
        return viewOk()
      },
      tool_3: async () => {
        await this.editSelectedNodeProps()
        return viewOk()
      },
    }
  }

  createHeaderControlsElement() {
    const controls = document.createElement('div')
    controls.dataset.element = 'header-controls'
    controls.setAttribute('slot', 'header-controls')
    controls.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="new" aria-label="New tree" title="New tree"><i aria-hidden="true">docs</i></button>
        <button type="button" data-action="open" aria-label="Open tree" title="Open tree"><i aria-hidden="true">folder_open</i></button>
        <button type="button" data-action="save" class="accent" aria-label="Save tree" title="Save tree"><i aria-hidden="true">save</i></button>
        <button type="button" data-action="save-as" aria-label="Save tree as" title="Save tree as"><i aria-hidden="true">save_as</i></button>
        <button type="button" data-action="reload" aria-label="Reload" title="Reload"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <button type="button" data-action="add-node" aria-label="Add node" title="Add node"><i aria-hidden="true">add</i></button>
        <button type="button" data-action="change-parent" aria-label="Change parent" title="Change parent"><i aria-hidden="true">account_tree</i></button>
        <button type="button" data-action="edit-node-props" aria-label="Edit node properties" title="Edit node properties"><i aria-hidden="true">tune</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-in" aria-label="Zoom In" title="Zoom In"><i aria-hidden="true">zoom_in</i></button>
        <button type="button" data-action="zoom-out" aria-label="Zoom Out" title="Zoom Out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit View" title="Fit View"><i aria-hidden="true">fit_screen</i></button>
      </div>
    `
    return controls
  }

  _mountHeaderControls() {
    if (!this.parentElement || this._headerControlsElement) return
    this._headerControlsElement = this.createHeaderControlsElement()
    this.parentElement.appendChild(this._headerControlsElement)
    this.queryHeader('[data-action="new"]').addEventListener('click', () => this.newTree())
    this.queryHeader('[data-action="open"]').addEventListener('click', async () => this.openTree())
    this.queryHeader('[data-action="save"]').addEventListener('click', async () => this.save())
    this.queryHeader('[data-action="save-as"]').addEventListener('click', async () => this.saveAs())
    this.queryHeader('[data-action="reload"]').addEventListener('click', async () => this.reload())
    this.queryHeader('[data-action="zoom-in"]').addEventListener('click', () => this.zoomIn())
    this.queryHeader('[data-action="zoom-out"]').addEventListener('click', () => this.zoomOut())
    this.queryHeader('[data-action="zoom-fit"]').addEventListener('click', () => this.fitToContent())
    this.queryHeader('[data-action="add-node"]').addEventListener('click', async () => this.addNode())
    this.queryHeader('[data-action="change-parent"]').addEventListener('click', async () => this.changeParent())
    this.queryHeader('[data-action="edit-node-props"]').addEventListener('click', async () => this.editSelectedNodeProps())
    this.renderHeaderControls()
  }

  _unmountHeaderControls() {
    this._headerControlsElement?.remove()
    this._headerControlsElement = null
  }

  queryHeader(selector) {
    const element = this._headerControlsElement?.querySelector(selector)
    assert(element instanceof HTMLElement, `view-tree missing header control ${selector}`)
    return element
  }

  renderHeaderControls() {
    if (!this._headerControlsElement) return
    const hasTree = this.treeData.length > 0
    const hasSelection = this.selectedNodeIndex >= 0
    const canChangeParent = hasSelection && this.selectedNodeIndex > 0 && this.validParentCandidates(this.selectedNodeIndex).length > 0
    const addButton = this.queryHeader('[data-action="add-node"]')
    const editButton = this.queryHeader('[data-action="edit-node-props"]')
    const parentButton = this.queryHeader('[data-action="change-parent"]')
    const saveButton = this.queryHeader('[data-action="save"]')
    const reloadButton = this.queryHeader('[data-action="reload"]')
    assert(addButton instanceof HTMLButtonElement, 'view-tree add node control must be a button')
    assert(editButton instanceof HTMLButtonElement, 'view-tree edit props control must be a button')
    assert(parentButton instanceof HTMLButtonElement, 'view-tree change parent control must be a button')
    assert(saveButton instanceof HTMLButtonElement, 'view-tree save control must be a button')
    assert(reloadButton instanceof HTMLButtonElement, 'view-tree reload control must be a button')
    addButton.disabled = !hasTree
    editButton.disabled = !hasSelection
    parentButton.disabled = !canChangeParent
    saveButton.disabled = !hasTree
    reloadButton.disabled = !hasTree
  }

  setStatus(text, tone = null) {
    assert(this.statusElement instanceof HTMLOutputElement, 'view-tree missing status output')
    this.statusElement.textContent = text
    this.statusElement.classList.remove('accent', 'success', 'warning', 'danger', 'info')
    if (tone) this.statusElement.classList.add(tone)
  }

  updateFooter(status = null, tone = null) {
    if (this.keyElement instanceof HTMLOutputElement) this.keyElement.textContent = `Key: ${this.treeKey}`
    if (this.countElement instanceof HTMLOutputElement) this.countElement.textContent = `Nodes: ${this.treeData.length}`
    if (this.dirtyElement instanceof HTMLOutputElement) {
      this.dirtyElement.textContent = this.dirty ? 'Dirty' : 'Saved'
      this.dirtyElement.className = this.dirty ? 'warning' : 'success'
    }
    if (status !== null) this.setStatus(status, tone)
    this.renderHeaderControls()
  }

  clearSelection() {
    this.selectedNodeIndex = -1
    this.updateFooter('Selection cleared', 'info')
    this.render()
  }

  async callSql(sql) {
    const result = await runtime.call('sql', 'query', sql)
    if (result.returnCode !== 0) throw new Error(decodeOutput(result) || `sql query failed: ${result.returnCode}`)
    return decodeOutput(result)
  }

  async execSql(sql) {
    const result = await runtime.call('sql', 'exec', sql)
    if (result.returnCode !== 0) throw new Error(decodeOutput(result) || `sql exec failed: ${result.returnCode}`)
    return decodeOutput(result)
  }

  async loadTree() {
    this.updateFooter(`Loading ${this.treeKey}...`, 'info')
    const csv = await this.callSql(`SELECT name, data FROM tree_storage WHERE name = ${quoteSqlValue(this.treeKey)} LIMIT 1`)
    const lines = parseCSVLines(csv.trim())
    assert(lines.length === 2, `tree '${this.treeKey}' was not found`)
    const headers = lines[0]
    const row = lines[1]
    const dataIndex = headers.indexOf('data')
    assert(dataIndex >= 0, 'tree_storage query returned no data column')
    this.setTreeData(JSON.parse(row[dataIndex]), { dirty: false, fit: true })
    this.updateFooter(`Loaded ${this.treeKey}`, 'success')
  }

  setTreeData(data, { dirty = false, fit = false } = {}) {
    this.treeData = cloneTree(data)
    this.selectedNodeIndex = -1
    this.hoverNodeIndex = -1
    this.dirty = dirty
    this.relayout({ fit })
  }

  relayout({ fit = false } = {}) {
    this.calculateLayout()
    this.contentBounds = this.calculateContentBounds()
    if (fit) this.fitToContent()
    else this.render()
    this.updateFooter()
  }

  newTreeData(name, { dirty = true, fit = true } = {}) {
    assert(typeof name === 'string' && name.length > 0, 'view-tree new requires tree name')
    this.treeKey = name
    this.setTreeData([{ parent: -1, data: {} }], { dirty, fit })
    this.selectedNodeIndex = 0
    this.updateFooter(`Created new tree ${name}`, 'success')
    this.render()
  }

  async newTree() {
    const result = await runtime.call('ui.popup', 'open', this.createNewTreePopupOptions())
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const name = typeof payload.value === 'string' ? payload.value.trim() : ''
    assert(name.length > 0, 'view-tree new requires tree_storage name')
    this.newTreeData(name, { dirty: false, fit: true })
    await this.saveToStorageName(name)
    await runtime.call('ui.toast', 'success', { message: `Created tree ${name}` })
  }

  async openTree() {
    const result = await runtime.call('ui.popup', 'open', this.createOpenTreePopupOptions())
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const name = typeof payload.value === 'string' ? payload.value : payload.row?.name
    assert(typeof name === 'string' && name.length > 0, 'view-tree open requires selected tree_storage name')
    this.treeKey = name
    await this.loadTree()
  }

  createOpenTreePopupOptions() {
    return {
      title: 'Open Tree',
      size: 'medium',
      tag: 'view-sql',
      props: {
        mode: 'chooser',
        query: 'SELECT name, length(data) AS bytes FROM tree_storage ORDER BY name LIMIT :limit OFFSET :offset',
        countQuery: 'SELECT COUNT(*) AS count FROM tree_storage',
        returnColumn: 'name',
        confirmLabel: 'Open',
        pageSize: 20,
      },
    }
  }

  async save() {
    assert(this.treeData.length > 0, 'view-tree save requires a tree')
    await this.saveToStorageName(this.treeKey)
    this.dirty = false
    this.updateFooter(`Saved ${this.treeKey}`, 'success')
    await runtime.call('ui.toast', 'success', { message: `Saved tree ${this.treeKey}` })
  }

  async saveAs() {
    assert(this.treeData.length > 0, 'view-tree save-as requires a tree')
    const result = await runtime.call('ui.popup', 'open', this.createSaveTreePopupOptions())
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const name = typeof payload.value === 'string' ? payload.value.trim() : ''
    assert(name.length > 0, 'view-tree save-as requires tree_storage name')
    await this.saveToStorageName(name)
    this.treeKey = name
    this.dirty = false
    this.updateFooter(`Saved as ${this.treeKey}`, 'success')
    await runtime.call('ui.toast', 'success', { message: `Saved tree ${this.treeKey}` })
  }

  createNewTreePopupOptions() {
    return {
      title: 'Create Tree',
      size: 'medium',
      tag: 'view-sql',
      props: {
        mode: 'saver',
        query: 'SELECT name FROM tree_storage ORDER BY name LIMIT :limit OFFSET :offset',
        countQuery: 'SELECT COUNT(*) AS count FROM tree_storage',
        returnColumn: 'name',
        confirmLabel: 'Create',
        valueLabel: 'Tree name',
        value: 'new_tree',
        pageSize: 20,
      },
    }
  }

  createSaveTreePopupOptions() {
    return {
      title: 'Save Tree As',
      size: 'medium',
      tag: 'view-sql',
      props: {
        mode: 'saver',
        query: 'SELECT name FROM tree_storage ORDER BY name LIMIT :limit OFFSET :offset',
        countQuery: 'SELECT COUNT(*) AS count FROM tree_storage',
        returnColumn: 'name',
        confirmLabel: 'Save',
        valueLabel: 'Tree name',
        value: this.treeKey,
        pageSize: 20,
      },
    }
  }

  async saveToStorageName(name) {
    assert(typeof name === 'string' && name.length > 0, 'view-tree save requires tree_storage name')
    const data = JSON.stringify(this.treeData)
    await this.execSql(`INSERT OR REPLACE INTO tree_storage (name, data) VALUES (${quoteSqlValue(name)}, ${quoteSqlValue(data)})`)
  }

  async reload() {
    assert(this.treeData.length > 0, 'view-tree reload requires a tree')
    await this.loadTree()
    await runtime.call('ui.toast', 'success', { message: `Reloaded tree ${this.treeKey}` })
  }

  async addNode() {
    assert(this.treeData.length > 0, 'view-tree add node requires a tree')
    const defaultParent = this.selectedNodeIndex >= 0 ? this.selectedNodeIndex : 0
    const result = await runtime.call('ui.popup', 'open', {
      title: 'Create Tree Node',
      size: 'medium',
      tag: 'view-tree-parent',
      props: {
        mode: 'create',
        currentParent: defaultParent,
        candidates: this.treeData.map((_node, index) => ({ index, label: this.nodeDisplayLabel(index) })),
      },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const parentIndex = Number(payload.parentIndex)
    assert(Number.isInteger(parentIndex) && parentIndex >= 0 && parentIndex < this.treeData.length, `view-tree invalid new node parent ${parentIndex}`)
    const data = cloneStringData(payload.data || {}, 'view-tree new node')
    this.treeData.push({ parent: parentIndex, data })
    this.selectedNodeIndex = this.treeData.length - 1
    this.dirty = true
    this.relayout({ fit: true })
    this.updateFooter(`Added ${this.nodeDisplayLabel(this.selectedNodeIndex)}`, 'success')
  }

  async editSelectedNodeProps() {
    const index = this.requireSelectedNodeIndex()
    const node = this.treeData[index]
    const result = await runtime.call('ui.popup', 'open', {
      title: `Node ${index} Properties`,
      size: 'medium',
      tag: 'view-props',
      props: {
        title: `Node ${index} Properties`,
        dataSource: node.data || {},
      },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    node.data = cloneStringData(payload.data, `view-tree node ${index}`)
    this.dirty = true
    this.relayout()
    this.updateFooter(`Updated node ${index} properties`, 'success')
  }

  async changeParent() {
    const index = this.requireSelectedNodeIndex()
    assert(index > 0, 'view-tree root node parent cannot be changed')
    const candidates = this.validParentCandidates(index)
    assert(candidates.length > 0, 'view-tree selected node has no valid parent candidates')
    const result = await runtime.call('ui.popup', 'open', {
      title: `Change Parent for Node ${index}`,
      size: 'medium',
      tag: 'view-tree-parent',
      props: {
        currentParent: this.treeData[index].parent,
        candidates: candidates.map((candidate) => ({ index: candidate, label: this.nodeDisplayLabel(candidate) })),
      },
    })
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return
    const parentIndex = Number(payload.parentIndex)
    assert(candidates.includes(parentIndex), `view-tree invalid parent candidate ${parentIndex}`)
    this.treeData[index].parent = parentIndex
    this.dirty = true
    this.relayout({ fit: true })
    this.updateFooter(`Changed node ${index} parent to ${parentIndex}`, 'success')
  }

  requireSelectedNodeIndex() {
    assert(this.selectedNodeIndex >= 0 && this.selectedNodeIndex < this.treeData.length, 'view-tree requires one selected node')
    return this.selectedNodeIndex
  }

  validParentCandidates(selectedIndex) {
    if (selectedIndex <= 0) return []
    const descendants = this.descendantIndexes(selectedIndex)
    const candidates = []
    for (let index = 0; index < this.treeData.length; index += 1) {
      if (index === selectedIndex) continue
      if (descendants.has(index)) continue
      candidates.push(index)
    }
    return candidates
  }

  descendantIndexes(index) {
    const descendants = new Set()
    const visit = (parent) => {
      for (let child = 0; child < this.treeData.length; child += 1) {
        if (child === parent) continue
        if (this.treeData[child].parent !== parent) continue
        descendants.add(child)
        visit(child)
      }
    }
    visit(index)
    return descendants
  }

  nodeDisplayLabel(index) {
    const node = this.treeData[index]
    assert(node, `view-tree missing node ${index}`)
    const name = String(node.data?.name || '').trim()
    return name ? `${name} (#${index})` : `unknown_${index}`
  }

  getChildren(nodeIndex) {
    const children = []
    for (let i = 0; i < this.treeData.length; i += 1) {
      if (i !== nodeIndex && this.treeData[i].parent === nodeIndex) children.push(i)
    }
    return children
  }

  calculateLayout() {
    this.nodePositions.clear()
    this.nodeSizes.clear()
    if (!this.treeData.length) return
    for (let index = 0; index < this.treeData.length; index += 1) {
      this.nodeSizes.set(index, this.measureNodeSize(index))
    }

    const levels = []
    const assignLevels = (nodeIndex, level = 0) => {
      if (!levels[level]) levels[level] = []
      levels[level].push(nodeIndex)
      for (const childIndex of this.getChildren(nodeIndex)) assignLevels(childIndex, level + 1)
    }
    assignLevels(0)

    let x = CONTENT_PADDING_X
    for (let level = 0; level < levels.length; level += 1) {
      const ids = levels[level] || []
      const totalHeight = ids.reduce((sum, id) => sum + this.nodeSizes.get(id).height, 0) + Math.max(0, ids.length - 1) * MIN_VERTICAL_SPACING
      let y = CONTENT_PADDING_Y + Math.max(0, ((this.canvas?.height || 600) / Math.max(this.scale, 0.0001) - totalHeight) * 0.5)
      let maxWidth = 0
      for (const id of ids) {
        const size = this.nodeSizes.get(id)
        this.nodePositions.set(id, { x, y: Math.round(y), width: size.width, height: size.height })
        y += size.height + MIN_VERTICAL_SPACING
        maxWidth = Math.max(maxWidth, size.width)
      }
      x += maxWidth + HORIZONTAL_SPACING
    }
  }

  measureNodeSize(index) {
    const node = this.treeData[index]
    const title = this.nodeDisplayLabel(index)
    const entries = Object.entries(node.data || {})
    const visible = entries.slice(0, MAX_VISIBLE_DATA)
    let width = Math.max(NODE_MIN_WIDTH, NODE_PADDING_X * 2 + this._measureTextWidth(title, TITLE_FONT_PX / this.atlasSize()))
    for (const [key, value] of visible) {
      width = Math.max(width, NODE_PADDING_X * 2 + this._measureTextWidth(`${key}: ${value}`, DATA_FONT_PX / this.atlasSize()))
    }
    const rows = visible.length + (entries.length > MAX_VISIBLE_DATA ? 1 : 0)
    const height = Math.max(NODE_MIN_HEIGHT, NODE_PADDING_Y * 2 + TITLE_FONT_PX + 8 + rows * LINE_HEIGHT)
    return { width: Math.ceil(width), height: Math.ceil(height) }
  }

  calculateContentBounds() {
    if (!this.nodePositions.size) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const pos of this.nodePositions.values()) {
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + pos.width)
      maxY = Math.max(maxY, pos.y + pos.height)
    }
    return {
      minX: minX - CONTENT_PADDING_X,
      minY: minY - CONTENT_PADDING_Y,
      maxX: maxX + CONTENT_PADDING_X,
      maxY: maxY + CONTENT_PADDING_Y,
    }
  }

  _bindEvents() {
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false })
    this.canvas.addEventListener('pointerdown', this._onPointerDown)
    this.canvas.addEventListener('pointermove', this._onPointerMove)
    this.canvas.addEventListener('pointerup', this._onPointerUp)
    this.canvas.addEventListener('pointerleave', this._onPointerUp)
  }

  _unbindEvents() {
    if (!(this.canvas instanceof HTMLCanvasElement)) return
    this.canvas.removeEventListener('wheel', this._onWheel)
    this.canvas.removeEventListener('pointerdown', this._onPointerDown)
    this.canvas.removeEventListener('pointermove', this._onPointerMove)
    this.canvas.removeEventListener('pointerup', this._onPointerUp)
    this.canvas.removeEventListener('pointerleave', this._onPointerUp)
  }

  _clientToCanvasPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width)),
      y: (clientY - rect.top) * (this.canvas.height / Math.max(1, rect.height)),
    }
  }

  _canvasToWorld(canvasX, canvasY) {
    return {
      x: (canvasX - this.offsetX) / Math.max(this.scale, 0.0001),
      y: (canvasY - this.offsetY) / Math.max(this.scale, 0.0001),
    }
  }

  _onWheel(event) {
    event.preventDefault()
    const canvasPoint = this._clientToCanvasPoint(event.clientX, event.clientY)
    if (event.ctrlKey || event.metaKey) {
      this._zoomAt(canvasPoint.x, canvasPoint.y, event.deltaY < 0 ? 1.1 : 0.9)
      return
    }
    this.offsetX -= event.deltaX
    this.offsetY -= event.deltaY
    this.render()
  }

  _onPointerDown(event) {
    if (event.button !== 0 && event.button !== 1) return
    this.canvas.focus()
    const canvasPoint = this._clientToCanvasPoint(event.clientX, event.clientY)
    const worldPoint = this._canvasToWorld(canvasPoint.x, canvasPoint.y)
    this._pointerStartClientX = event.clientX
    this._pointerStartClientY = event.clientY
    this._pointerStartOffsetX = this.offsetX
    this._pointerStartOffsetY = this.offsetY
    if (event.button === 1 || event.ctrlKey || event.metaKey) {
      this._pointerMode = 'pan'
      this.canvas.style.cursor = 'grabbing'
    } else {
      this._pointerMode = 'select'
      const hit = this._hitTestNode(worldPoint.x, worldPoint.y)
      this.selectedNodeIndex = Number.isInteger(hit) ? hit : -1
      this.updateFooter(this.selectedNodeIndex >= 0 ? `Selected ${this.nodeDisplayLabel(this.selectedNodeIndex)}` : 'Selection cleared', 'info')
      this.render()
    }
    this.canvas.setPointerCapture(event.pointerId)
  }

  _onPointerMove(event) {
    const canvasPoint = this._clientToCanvasPoint(event.clientX, event.clientY)
    const worldPoint = this._canvasToWorld(canvasPoint.x, canvasPoint.y)
    if (this._pointerMode === 'pan') {
      this.offsetX = this._pointerStartOffsetX + event.clientX - this._pointerStartClientX
      this.offsetY = this._pointerStartOffsetY + event.clientY - this._pointerStartClientY
      this.render()
      return
    }
    const hit = this._hitTestNode(worldPoint.x, worldPoint.y)
    const nextHover = Number.isInteger(hit) ? hit : -1
    if (nextHover !== this.hoverNodeIndex) {
      this.hoverNodeIndex = nextHover
      this.canvas.style.cursor = nextHover >= 0 ? 'pointer' : 'default'
      this.render()
    }
  }

  _onPointerUp(event) {
    if (this.canvas?.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    this._pointerMode = 'idle'
    this.canvas.style.cursor = this.hoverNodeIndex >= 0 ? 'pointer' : 'default'
  }

  _hitTestNode(worldX, worldY) {
    for (let index = this.treeData.length - 1; index >= 0; index -= 1) {
      const pos = this.nodePositions.get(index)
      if (!pos) continue
      if (worldX < pos.x || worldX > pos.x + pos.width || worldY < pos.y || worldY > pos.y + pos.height) continue
      return index
    }
    return null
  }

  zoomIn() {
    this._zoomAt(this.canvas.width * 0.5, this.canvas.height * 0.5, 1.2)
  }

  zoomOut() {
    this._zoomAt(this.canvas.width * 0.5, this.canvas.height * 0.5, 0.8)
  }

  _zoomAt(screenX, screenY, factor) {
    const old = this.scale
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * factor))
    const worldX = (screenX - this.offsetX) / old
    const worldY = (screenY - this.offsetY) / old
    this.offsetX = screenX - worldX * this.scale
    this.offsetY = screenY - worldY * this.scale
    this.render()
  }

  fitToContent() {
    this._resizeCanvas()
    this.contentBounds = this.calculateContentBounds()
    const contentWidth = this.contentBounds.maxX - this.contentBounds.minX
    const contentHeight = this.contentBounds.maxY - this.contentBounds.minY
    if (contentWidth <= 0 || contentHeight <= 0) return false
    const scaleX = this.canvas.width / contentWidth
    const scaleY = this.canvas.height / contentHeight
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)))
    const contentCenterX = (this.contentBounds.minX + this.contentBounds.maxX) * 0.5
    const contentCenterY = (this.contentBounds.minY + this.contentBounds.maxY) * 0.5
    this.offsetX = this.canvas.width * 0.5 - contentCenterX * this.scale
    this.offsetY = this.canvas.height * 0.5 - contentCenterY * this.scale
    this.render()
    return true
  }

  _resizeCanvas() {
    if (!(this.canvas instanceof HTMLCanvasElement)) return
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    const canvasRect = this.canvas.getBoundingClientRect()
    const targetRect = this._resizeTarget?.getBoundingClientRect?.() || this.parentElement?.getBoundingClientRect?.() || this.getBoundingClientRect()
    const cssWidth = Math.max(1, Math.floor(canvasRect.width || targetRect.width || window.innerWidth || 1))
    const cssHeight = Math.max(1, Math.floor(canvasRect.height || targetRect.height || window.innerHeight || 1))
    const w = Math.max(1, Math.floor(cssWidth * dpr))
    const h = Math.max(1, Math.floor(cssHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  _viewMatrix() {
    return new Float32Array([
      this.scale, 0, 0,
      0, this.scale, 0,
      this.offsetX, this.offsetY, 1,
    ])
  }

  async _loadAssets() {
    await Promise.all([
      this._loadNineSliceTextureFromAssets(),
      this._loadTextAtlasFromAssets(),
    ])
  }

  async _loadTextureFromUrl(url) {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`)
    const blob = await res.blob()
    const image = await createImageBitmap(blob)
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    return { texture: tex, width: image.width, height: image.height }
  }

  async _loadNineSliceTextureFromAssets() {
    const entries = Object.entries(this.assets.nineSlices)
    const loaded = await Promise.all(entries.map(async ([key, slice]) => {
      assert(slice.textureUrl, `view-tree nineSlices.${key} missing textureUrl`)
      const texture = await this._loadTextureFromUrl(slice.textureUrl)
      return [key, { ...slice, ...texture }]
    }))
    this.skinTextures = new Map(loaded)
  }

  async _loadTextAtlasFromAssets() {
    const [metaRes, atlasRes] = await Promise.all([
      fetch(this.assets.text.source.metaUrl, { cache: 'no-cache' }),
      fetch(this.assets.text.source.atlasUrl, { cache: 'no-cache' }),
    ])
    if (!metaRes.ok) throw new Error(`failed to fetch ${this.assets.text.source.metaUrl}: ${metaRes.status}`)
    if (!atlasRes.ok) throw new Error(`failed to fetch ${this.assets.text.source.atlasUrl}: ${atlasRes.status}`)
    const meta = await metaRes.json()
    const atlasBlob = await atlasRes.blob()
    const atlasImage = await createImageBitmap(atlasBlob)
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImage)
    this.textAtlas = {
      texture: tex,
      glyphs: buildGlyphMap(meta),
      atlasW: Number(meta.atlas.width),
      atlasH: Number(meta.atlas.height),
      atlasSize: Number(meta.atlas.size),
      distRange: Number(meta.atlas.distanceRange || 8),
    }
  }

  atlasSize() {
    return Math.max(1, this.textAtlas?.atlasSize || 48)
  }

  _measureTextWidth(text, scale = 1) {
    const value = String(text || '')
    if (!value) return 0
    const atlasSize = this.atlasSize()
    const glyphs = this.textAtlas?.glyphs
    if (!glyphs) return value.length * atlasSize * 0.58 * scale
    let widthPx = 0
    for (const ch of value) {
      const g = glyphs.get(ch.codePointAt(0))
      widthPx += g ? g.advancePx * scale : atlasSize * 0.3 * scale
    }
    return widthPx
  }

  render() {
    if (this._renderQueued) return
    this._renderQueued = true
    requestAnimationFrame(() => {
      this._renderQueued = false
      this._resizeCanvas()
      if (!this.gl) return
      const gl = this.gl
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      const clear = this.assets.theme.clear
      gl.clearColor(clear[0], clear[1], clear[2], clear[3])
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      if (!this.treeData.length) return
      const view = this._viewMatrix()
      this._drawEdges(this.canvas.width, this.canvas.height, view)
      this._drawNodes(this.canvas.width, this.canvas.height, view)
      this._drawLabels(this.canvas.width, this.canvas.height, view)
    })
  }

  _initPrograms() {
    const gl = this.gl
    const quad = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
    this.baseVao = gl.createVertexArray()
    this.baseVbo = gl.createBuffer()
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.baseVbo)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    this.edgeProgram = createProgram(gl, `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv; layout(location=1) in vec2 a_p0; layout(location=2) in vec2 a_p3; layout(location=3) in float a_h; layout(location=4) in float a_width; layout(location=5) in vec4 a_color;
      uniform mat3 u_view; uniform vec2 u_viewportPx; uniform float u_glowPx; uniform float u_aaPx;
      out vec2 v_screenPx; out vec2 v_p0; out vec2 v_p1; out vec2 v_p2; out vec2 v_p3; out float v_width; out vec4 v_color;
      vec2 applyView(vec2 p) { return (u_view * vec3(p, 1.0)).xy; }
      void main() {
        vec2 w0 = a_p0; vec2 w3 = a_p3; vec2 hdir = normalize(vec2(max(0.0001, abs(w3.x - w0.x)), 0.0)); float h = a_h; vec2 w1 = w0 + hdir * h; vec2 w2 = w3 - hdir * h;
        vec2 p0 = applyView(w0); vec2 p1 = applyView(w1); vec2 p2 = applyView(w2); vec2 p3 = applyView(w3);
        vec2 mn = min(min(p0, p1), min(p2, p3)); vec2 mx = max(max(p0, p1), max(p2, p3)); float pad = a_width + u_glowPx + u_aaPx; mn -= vec2(pad); mx += vec2(pad);
        vec2 screenPx = mix(mn, mx, a_uv); v_screenPx = screenPx; v_p0 = p0; v_p1 = p1; v_p2 = p2; v_p3 = p3; v_width = a_width; v_color = a_color;
        vec2 ndc = (screenPx / u_viewportPx) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0.0, 1.0);
      }`, `#version 300 es
      precision highp float;
      in vec2 v_screenPx; in vec2 v_p0; in vec2 v_p1; in vec2 v_p2; in vec2 v_p3; in float v_width; in vec4 v_color; uniform float u_glowPx; out vec4 outColor;
      vec2 bez(vec2 p0, vec2 p1, vec2 p2, vec2 p3, float t) { float u = 1.0 - t; return (u*u*u)*p0 + (3.0*u*u*t)*p1 + (3.0*u*t*t)*p2 + (t*t*t)*p3; }
      float segDist(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float ab2 = dot(ab, ab); float t = ab2 > 1e-6 ? clamp(dot(p - a, ab) / ab2, 0.0, 1.0) : 0.0; return length(p - (a + t * ab)); }
      void main() { const int N = 24; float minD = 1e20; vec2 prev = bez(v_p0, v_p1, v_p2, v_p3, 0.0); for (int i = 1; i <= N; i++) { float t = float(i) / float(N); vec2 cur = bez(v_p0, v_p1, v_p2, v_p3, t); minD = min(minD, segDist(v_screenPx, prev, cur)); prev = cur; } float aa = max(1.0, fwidth(minD)); float lineA = 1.0 - smoothstep(v_width - aa, v_width + aa, minD); float glowA = 0.0; if (u_glowPx > 0.0) { glowA = 1.0 - smoothstep(v_width + u_glowPx, v_width + u_glowPx + aa, minD); glowA *= 0.34; } float a = lineA + glowA; if (a <= 0.001) discard; outColor = vec4(v_color.rgb, v_color.a * a); }
    `)

    this.nodeProgram = createProgram(gl, `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv; layout(location=1) in vec4 a_rect; uniform mat3 u_view; uniform vec2 u_viewportPx; out vec2 v_local; out vec2 v_size;
      void main() { vec2 world = a_rect.xy + a_uv * a_rect.zw; vec2 screen = (u_view * vec3(world, 1.0)).xy; v_local = a_uv * a_rect.zw; v_size = a_rect.zw; vec2 ndc = (screen / u_viewportPx) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0.0, 1.0); }
    `, `#version 300 es
      precision highp float;
      in vec2 v_local; in vec2 v_size; uniform sampler2D u_skin; uniform vec2 u_skinSize; uniform vec4 u_slice; out vec4 outColor;
      float mapAxis(float p, float size, float s0, float s1, float texSize) { float inner = max(1.0, size - s0 - s1); float texInner = max(1.0, texSize - s0 - s1); if (p < s0) return (p / max(1.0, s0)) * (s0 / texSize); if (p > size - s1) { float d = size - p; return 1.0 - ((d / max(1.0, s1)) * (s1 / texSize)); } float t = (p - s0) / inner; return (s0 / texSize) + t * (texInner / texSize); }
      void main() { float u = mapAxis(v_local.x, v_size.x, u_slice.x, u_slice.y, u_skinSize.x); float v = mapAxis(v_local.y, v_size.y, u_slice.z, u_slice.w, u_skinSize.y); vec4 skin = texture(u_skin, vec2(u, v)); if (skin.a < 0.001) discard; outColor = skin; }
    `)

    this.textProgram = createProgram(gl, `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_uv; uniform mat3 u_view; uniform vec2 u_viewport; uniform vec2 uP; uniform vec4 uT; uniform vec4 u_uv; out vec2 v_uv;
      void main() { vec2 aP = a_uv * 2.0 - 1.0; vec2 world = aP * mat2(uT) + uP; vec2 screen = (u_view * vec3(world, 1.0)).xy; vec2 aP01 = aP * 0.5 + 0.5; vec2 aFlip = vec2(aP01.x, 1.0 - aP01.y); v_uv = u_uv.xy + aFlip * u_uv.zw; vec2 ndc = (screen / u_viewport) * 2.0 - 1.0; ndc.y = -ndc.y; gl_Position = vec4(ndc, 0.0, 1.0); }
    `, `#version 300 es
      precision highp float;
      in vec2 v_uv; uniform sampler2D u_tex; uniform vec4 u_color; uniform float u_aa; uniform float uDistRange; uniform int uEffect; uniform float uStroke; uniform float uGlow; uniform vec2 uShadowPx; uniform vec2 uAtlasSize; out vec4 outColor;
      float median(float r, float g, float b) { return max(min(r, g), min(max(r, g), b)); }
      void main() { vec4 tex = texture(u_tex, v_uv); float msdf = median(tex.r, tex.g, tex.b) - 0.5; float sdf = tex.a - 0.5; float fill = clamp(msdf * u_aa + 0.5, 0.0, 1.0); float distPx = sdf * uDistRange; float outline = 1.0 - smoothstep(max(0.0, uStroke - 1.0), uStroke + 1.0, abs(distPx)); float outsideDist = max(0.0, -distPx); float glow = (1.0 - smoothstep(0.0, max(0.001, uGlow), outsideDist)) * (1.0 - fill); vec2 suv = v_uv + (uShadowPx / uAtlasSize); float sdist = (texture(u_tex, suv).a - 0.5) * uDistRange; float shadowOutside = max(0.0, -sdist); float shadow = (1.0 - smoothstep(0.0, max(0.001, uGlow), shadowOutside)) * (1.0 - fill); float alpha = fill; if (uEffect == 1) alpha = max(outline, fill); else if (uEffect == 2) alpha = max(fill, glow * 0.8); else if (uEffect == 3) alpha = max(fill, shadow * 0.65); else if (uEffect == 4) alpha = max(fill, max(outline * 0.8, glow * 0.55)); if (alpha < 0.001) discard; outColor = vec4(u_color.rgb, u_color.a * alpha); }
    `)

    this.edgeBuffer = gl.createBuffer()
    this.nodeBuffer = gl.createBuffer()
  }

  _drawEdges(width, height, view) {
    if (this.treeData.length <= 1) return
    const edgeCfg = this.assets.edge
    const color = this.assets.theme.edge
    const data = []
    for (let index = 1; index < this.treeData.length; index += 1) {
      const parent = this.treeData[index].parent
      const from = this.nodePositions.get(parent)
      const to = this.nodePositions.get(index)
      if (!from || !to) continue
      const p0 = { x: from.x + from.width, y: from.y + from.height * 0.5 }
      const p3 = { x: to.x, y: to.y + to.height * 0.5 }
      const h = Math.max(edgeCfg.handleMin, Math.min(edgeCfg.handleMax, Math.abs(p3.x - p0.x) * 0.5))
      data.push(p0.x, p0.y, p3.x, p3.y, h, edgeCfg.halfWidthPx, color[0], color[1], color[2], color[3])
    }
    if (!data.length) return
    const gl = this.gl
    gl.useProgram(this.edgeProgram)
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW)
    const stride = 10 * 4
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8); gl.vertexAttribDivisor(2, 1)
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(3, 1)
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 20); gl.vertexAttribDivisor(4, 1)
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 24); gl.vertexAttribDivisor(5, 1)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.edgeProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.edgeProgram, 'u_viewportPx'), width, height)
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_glowPx'), edgeCfg.glowPx)
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'u_aaPx'), edgeCfg.aaPx)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, data.length / 10)
  }

  _getNodeSkinKey(index) {
    if (index === this.selectedNodeIndex) return 'selected'
    if (index === this.hoverNodeIndex) return 'hover'
    return 'idle'
  }

  _drawNodes(width, height, view) {
    if (!this.skinTextures) return
    const batches = new Map()
    for (let index = 0; index < this.treeData.length; index += 1) {
      const pos = this.nodePositions.get(index)
      assert(pos, `view-tree missing node position ${index}`)
      const key = this._getNodeSkinKey(index)
      if (!batches.has(key)) batches.set(key, [])
      batches.get(key).push(pos)
    }
    for (const key of ['idle', 'hover', 'selected']) {
      const rects = batches.get(key) || []
      if (!rects.length) continue
      const textureInfo = this.skinTextures.get(key)
      assert(textureInfo, `view-tree missing nineSlices texture '${key}'`)
      this._drawNodeSkinBatch(textureInfo, rects, width, height, view)
    }
  }

  _drawNodeSkinBatch(textureInfo, rects, width, height, view) {
    const gl = this.gl
    const data = new Float32Array(rects.length * 4)
    let o = 0
    for (const rect of rects) {
      data[o++] = rect.x; data[o++] = rect.y; data[o++] = rect.width; data[o++] = rect.height
    }
    gl.useProgram(this.nodeProgram)
    gl.bindVertexArray(this.baseVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture)
    gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'u_skin'), 0)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.nodeProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'u_viewportPx'), width, height)
    gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'u_skinSize'), textureInfo.width, textureInfo.height)
    gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'u_slice'), textureInfo.left, textureInfo.right, textureInfo.top, textureInfo.bottom)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rects.length)
  }

  _drawLabels(width, height, view) {
    if (!this.textAtlas) return
    const gl = this.gl
    const glyphs = this.textAtlas.glyphs
    const c = this.assets.theme.text
    const cMuted = this.assets.theme.textMuted || c
    gl.useProgram(this.textProgram)
    gl.bindVertexArray(this.baseVao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textAtlas.texture)
    gl.uniform1i(gl.getUniformLocation(this.textProgram, 'u_tex'), 0)
    gl.uniformMatrix3fv(gl.getUniformLocation(this.textProgram, 'u_view'), false, view)
    gl.uniform2f(gl.getUniformLocation(this.textProgram, 'u_viewport'), width, height)
    const colorLoc = gl.getUniformLocation(this.textProgram, 'u_color')
    const aa = Math.min(32.0, Math.max(6.0, Number(this.assets.text.aa || 8) * this.scale))
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'u_aa'), aa)
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'uDistRange'), this.textAtlas.distRange)
    gl.uniform1i(gl.getUniformLocation(this.textProgram, 'uEffect'), 0)
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'uStroke'), Number(this.assets.text.stroke || 2.5))
    gl.uniform1f(gl.getUniformLocation(this.textProgram, 'uGlow'), Number(this.assets.text.glow || 2))
    gl.uniform2f(gl.getUniformLocation(this.textProgram, 'uShadowPx'), Number(this.assets.text.shadowX || 4), Number(this.assets.text.shadowY || -4))
    gl.uniform2f(gl.getUniformLocation(this.textProgram, 'uAtlasSize'), this.textAtlas.atlasW, this.textAtlas.atlasH)
    const atlasSize = this.atlasSize()
    const titleScale = TITLE_FONT_PX / atlasSize
    const dataScale = DATA_FONT_PX / atlasSize
    const drawText = (text, startX, baselineY, scale) => {
      let x = startX
      for (const ch of String(text || '')) {
        const g = glyphs.get(ch.codePointAt(0))
        if (!g) { x += atlasSize * 0.3 * scale; continue }
        if (g.empty) { x += g.advancePx * scale; continue }
        const gw = g.widthPx * scale
        const gh = g.heightPx * scale
        const px = x + g.offsetXPx * scale
        const py = baselineY + g.baselineOffsetYPx * scale
        gl.uniform2f(gl.getUniformLocation(this.textProgram, 'uP'), px, py)
        gl.uniform4f(gl.getUniformLocation(this.textProgram, 'uT'), gw * 0.5, 0, 0, gh * 0.5)
        gl.uniform4f(gl.getUniformLocation(this.textProgram, 'u_uv'), g.uv[0], g.uv[1], g.uv[2], g.uv[3])
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        x += g.advancePx * scale
      }
    }

    for (let index = 0; index < this.treeData.length; index += 1) {
      const node = this.treeData[index]
      const pos = this.nodePositions.get(index)
      assert(pos, `view-tree missing label position ${index}`)
      gl.uniform4f(colorLoc, c[0], c[1], c[2], c[3])
      drawText(this.nodeDisplayLabel(index), pos.x + NODE_PADDING_X, pos.y + NODE_PADDING_Y + TITLE_FONT_PX, titleScale)
      gl.uniform4f(colorLoc, cMuted[0], cMuted[1], cMuted[2], cMuted[3])
      const entries = Object.entries(node.data || {})
      let y = pos.y + NODE_PADDING_Y + TITLE_FONT_PX + 8 + DATA_FONT_PX
      for (const [key, value] of entries.slice(0, MAX_VISIBLE_DATA)) {
        drawText(`${key}: ${value}`, pos.x + NODE_PADDING_X, y, dataScale)
        y += LINE_HEIGHT
      }
      if (entries.length > MAX_VISIBLE_DATA) {
        drawText(`+${entries.length - MAX_VISIBLE_DATA} more`, pos.x + NODE_PADDING_X, y, dataScale)
      }
    }
  }
}

if (!customElements.get('view-tree')) {
  customElements.define('view-tree', ViewTree)
}
