import { runtime, unwrap } from '/core/runtime.js'
import { UndoHistory } from '/util/undo.js'
import { ViewCanvasBase } from '/util/view-canvas-base.js'
import { viewOk } from '/util/view-plugin.js'

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


const SELECT_COLORS = {
  DRAG_BORDER: 'rgba(122,162,255,0.95)',
  DRAG_FILL: 'rgba(122,162,255,0.18)',
  ADD_BORDER: 'rgba(61,220,151,0.95)',
  ADD_FILL: 'rgba(61,220,151,0.22)',
  REMOVE_BORDER: 'rgba(255,92,122,0.95)',
  REMOVE_FILL: 'rgba(255,92,122,0.22)',
  ACTIVE_BORDER: 'rgba(255,204,102,0.95)',
  ACTIVE_FILL: 'rgba(255,204,102,0.18)',
}

const SELECT_MODE = {
  REPLACE: 'replace',
  ADD: 'add',
  REMOVE: 'remove',
}

const DEFAULT_SELECT_ADD_KEY = 'Shift'
const DEFAULT_SELECT_REMOVE_KEY = 'Control'
const PASTE_PREVIEW_ALPHA = 0.55



function basename(path) {
  const normalized = String(path || '').trim()
  const parts = normalized.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : normalized
}

function tilemapNameFromPath(path) {
  const name = basename(path)
  return name.replace(/\.tilemap\.json$/i, '').replace(/\.json$/i, '')
}

function normalizeStringProps(input, label) {
  if (input == null) return {}
  assert(input && typeof input === 'object' && !Array.isArray(input), `${label} must be an object`)
  const props = {}
  for (const [key, value] of Object.entries(input)) {
    props[String(key)] = String(value ?? '')
  }
  return props
}

function layerDisplayName(layer) {
  assert(layer && typeof layer === 'object' && !Array.isArray(layer), 'tilemap layer display name requires layer')
  assert(layer.props && typeof layer.props === 'object' && !Array.isArray(layer.props), 'tilemap layer display name requires props')
  const name = layer.props.name
  return typeof name === 'string' && name.length > 0 ? name : `Layer ${layer.index}`
}

const GENERATED_TILESET_PALETTE = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
  '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3',
  '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000', '#a9a9ff', '#ff7f50',
]

const DEFAULT_COLOR_TILESET_SPEC = {
  name: 'colors',
  path: 'generated:colors',
  tileWidth: 16,
  tileHeight: 16,
  columns: 16,
  firstTileId: 1,
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class TilemapCommand {
  constructor(label, redo, undo) {
    assert(typeof label === 'string' && label.length > 0, 'tilemap command label must be non-empty string')
    assert(typeof redo === 'function', 'tilemap command redo must be function')
    assert(typeof undo === 'function', 'tilemap command undo must be function')
    this.label = label
    this.redo = redo
    this.undo = undo
  }
}

class TilemapState {
  constructor() {
    this.handle = 1
    this.path = ''
    this.name = ''
    this.width = 1
    this.height = 1
    this.props = {}
    this.layers = []
    this.nextLayerId = 1
    this.activeLayer = 0
    this.tool = TOOL.SELECT
    this.activeTile = 1
    this.dirty = false
    this.history = new UndoHistory()
    this.hasClipboard = false
  }

  open({ path, data }) {
    assert(typeof path === 'string' && path.length > 0, 'tilemap state open requires tilemap path')
    assert(typeof data === 'string' && data.length > 0, 'tilemap state open requires tilemap data')
    this.loadTilemapData(path, data)
    this.dirty = false
    this.resetHistory()
    return { handle: this.handle }
  }

  save({ path }) {
    assert(typeof path === 'string' && path.length > 0, 'tilemap state save requires tilemap path')
    this.path = path
    this.name = tilemapNameFromPath(path)
    this.dirty = false
  }

  toStorageData() {
    return JSON.stringify({
      props: { ...this.props },
      layers: this.layers.map((layer) => ({
        width: layer.width,
        data: layer.data.slice(),
        props: { ...(layer.props || {}) },
      })),
    })
  }

  loadTilemapData(path, data) {
    const tilemap = JSON.parse(data)
    assert(tilemap && typeof tilemap === 'object' && !Array.isArray(tilemap), 'tilemap file data must be object JSON')
    assert(Array.isArray(tilemap.layers), 'tilemap storage data.layers must be array')
    assert(tilemap.layers.length > 0, 'tilemap storage must contain at least one layer')

    this.nextLayerId = 1
    const layers = tilemap.layers.map((layer, index) => this.parseLayer(layer, index))
    const width = Math.max(...layers.map((layer) => layer.width))
    const height = Math.max(...layers.map((layer) => Math.ceil(layer.data.length / layer.width)))
    assert(Number.isInteger(width) && width > 0, 'tilemap storage width must be positive integer')
    assert(Number.isInteger(height) && height > 0, 'tilemap storage height must be positive integer')

    this.path = path
    this.name = tilemapNameFromPath(path)
    this.width = width
    this.height = height
    this.props = normalizeStringProps(tilemap.props, 'tilemap props')
    this.layers = layers
    this.activeLayer = 0
    this.activeTile = this.findFirstTile(layers)
  }

  parseLayer(layer, index) {
    assert(layer && typeof layer === 'object' && !Array.isArray(layer), `tilemap layer ${index} must be object`)
    assert(Number.isInteger(layer.width) && layer.width > 0, `tilemap layer ${index}.width must be positive integer`)
    assert(Array.isArray(layer.data), `tilemap layer ${index}.data must be array`)
    const props = normalizeStringProps(layer.props, `tilemap layer ${index}.props`)
    return {
      id: this.allocateLayerId(),
      index,
      hidden: false,
      width: layer.width,
      data: layer.data.map((tile, tileIndex) => {
        const value = Number(tile)
        assert(Number.isInteger(value), `tilemap layer ${index}.data[${tileIndex}] must be integer-like`)
        return value
      }),
      props,
    }
  }

  findFirstTile(layers) {
    for (const layer of layers) {
      const tile = layer.data.find((value) => value > 0)
      if (Number.isInteger(tile)) return tile
    }
    return 1
  }

  snapshot() {
    return {
      handle: this.handle,
      name: this.name,
      path: this.path,
      dirty: this.dirty,
      width: this.width,
      height: this.height,
      props: { ...this.props },
      layers: this.layers.map((layer, index) => ({ ...layer, index, props: { ...layer.props }, data: layer.data.slice() })),
      activeLayer: this.activeLayer,
      tool: this.tool,
      activeTile: this.activeTile,
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      history: this.createHistorySnapshot(),
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

  setTilesetSpecs(specs) {
    assert(Array.isArray(specs), 'tilemap state tileset specs must be array')
    const previous = this.props.tilesets
    const next = JSON.stringify(specs)
    if (previous === next) return
    this.executeDirtyCommand('Set tilesets', () => {
      this.props.tilesets = next
    }, () => {
      if (previous === undefined) delete this.props.tilesets
      else this.props.tilesets = previous
    })
  }

  setMapProps(props) {
    const previous = { ...this.props }
    const next = normalizeStringProps(props, 'tilemap map props')
    if (JSON.stringify(previous) === JSON.stringify(next)) return
    this.executeDirtyCommand('Set map properties', () => {
      this.props = { ...next }
    }, () => {
      this.props = { ...previous }
    })
  }

  setLayerProps(layer, props) {
    const target = this.requireLayer(layer)
    const previousProps = { ...target.props }
    const nextProps = normalizeStringProps(props, `tilemap layer ${layer}.props`)
    if (JSON.stringify(previousProps) === JSON.stringify(nextProps)) return
    const label = layerDisplayName(target)
    this.executeDirtyCommand(`Set ${label} properties`, () => {
      this.requireLayer(layer).props = { ...nextProps }
    }, () => {
      this.requireLayer(layer).props = { ...previousProps }
    })
  }

  setLayerHidden(layer, hidden) {
    const target = this.requireLayer(layer)
    const previous = target.hidden
    if (previous === hidden) return
    const label = layerDisplayName(target)
    this.executeDirtyCommand(`Set ${label} ${hidden ? 'hidden' : 'visible'}`, () => {
      this.requireLayer(layer).hidden = hidden
    }, () => {
      this.requireLayer(layer).hidden = previous
    })
  }


  insertLayer(index) {
    assert(index >= 0 && index <= this.layers.length, 'tilemap state insert layer index out of range')
    const previousActiveLayer = this.activeLayer
    const insertedLayer = { id: this.allocateLayerId(), index, hidden: false, width: this.width, data: new Array(this.width * this.height).fill(0), props: { name: this.createLayerName() } }
    this.executeDirtyCommand(`Insert layer ${index}`, () => {
      this.layers.splice(index, 0, insertedLayer)
      this.renumberLayers()
      this.activeLayer = index
    }, () => {
      this.layers.splice(index, 1)
      this.renumberLayers()
      this.activeLayer = previousActiveLayer
    })
  }

  deleteLayer(index) {
    assert(this.layers.length > 1, 'tilemap state must keep at least one layer')
    const sourceLayer = this.requireLayer(index)
    const deletedLayer = { ...sourceLayer, data: sourceLayer.data.slice(), props: { ...sourceLayer.props } }
    const previousActiveLayer = this.activeLayer
    this.executeDirtyCommand(`Delete ${layerDisplayName(deletedLayer)}`, () => {
      this.layers.splice(index, 1)
      this.renumberLayers()
      if (this.activeLayer === index) this.activeLayer = -1
      else if (this.activeLayer > index) this.activeLayer -= 1
    }, () => {
      this.layers.splice(index, 0, { ...deletedLayer, data: deletedLayer.data.slice(), props: { ...deletedLayer.props } })
      this.renumberLayers()
      this.activeLayer = previousActiveLayer
    })
  }

  moveLayer(from, to) {
    this.requireLayer(from)
    this.requireLayer(to)
    if (from === to) return
    const previousActiveLayer = this.activeLayer
    this.executeDirtyCommand(`Move layer ${from} to ${to}`, () => {
      this.moveLayerRaw(from, to)
      this.activeLayer = to
    }, () => {
      this.moveLayerRaw(to, from)
      this.activeLayer = previousActiveLayer
    })
  }

  eraseCellLive(layerIndexes, cell, changes) {
    assert(Array.isArray(layerIndexes), 'tilemap state eraseCellLive layerIndexes must be array')
    assert(Number.isInteger(cell.x) && Number.isInteger(cell.y), 'tilemap state eraseCellLive cell must contain integer x/y')
    assert(changes instanceof Map, 'tilemap state eraseCellLive changes must be Map')
    let changed = false

    for (const layerIndex of layerIndexes) {
      const layer = this.requireLayer(layerIndex)
      if (cell.x < 0 || cell.x >= layer.width || cell.y < 0) continue
      const tileIndex = cell.y * layer.width + cell.x
      if (tileIndex < 0 || tileIndex >= layer.data.length) continue
      const key = `${layerIndex}:${tileIndex}`
      if (changes.has(key)) continue
      const previous = layer.data[tileIndex]
      if (previous === 0) continue
      changes.set(key, { layerIndex, tileIndex, previous, next: 0 })
      layer.data[tileIndex] = 0
      changed = true
    }

    if (changed) this.dirty = true
    return changed
  }

  commitEraseChanges(changes) {
    assert(changes instanceof Map, 'tilemap state commitEraseChanges changes must be Map')
    return this.commitLiveTileChanges(changes, 'Erase')
  }

  paintCellLive(layerIndex, cell, tile, changes) {
    assert(Number.isInteger(layerIndex), 'tilemap state paintCellLive layerIndex must be integer')
    assert(Number.isInteger(cell.x) && Number.isInteger(cell.y), 'tilemap state paintCellLive cell must contain integer x/y')
    assert(Number.isInteger(tile), 'tilemap state paintCellLive tile must be integer')
    assert(changes instanceof Map, 'tilemap state paintCellLive changes must be Map')
    const layer = this.requireLayer(layerIndex)
    if (cell.x < 0 || cell.x >= layer.width || cell.y < 0) return false
    const tileIndex = cell.y * layer.width + cell.x
    if (tileIndex < 0 || tileIndex >= layer.data.length) return false
    const previous = layer.data[tileIndex]
    if (previous === tile) return false
    const key = `${layerIndex}:${tileIndex}`
    if (!changes.has(key)) changes.set(key, { layerIndex, tileIndex, previous, next: tile })
    layer.data[tileIndex] = tile
    this.dirty = true
    return true
  }

  commitPaintChanges(changes) {
    assert(changes instanceof Map, 'tilemap state commitPaintChanges changes must be Map')
    return this.commitLiveTileChanges(changes, 'Paint')
  }

  fillCells(layerIndex, cells, tile) {
    assert(Number.isInteger(layerIndex), 'tilemap state fillCells layerIndex must be integer')
    assert(Array.isArray(cells), 'tilemap state fillCells cells must be array')
    assert(Number.isInteger(tile), 'tilemap state fillCells tile must be integer')
    const changes = []
    for (const cell of cells) {
      assert(Number.isInteger(cell.x) && Number.isInteger(cell.y), 'tilemap state fillCells cell must contain integer x/y')
      const layer = this.requireLayer(layerIndex)
      if (cell.x < 0 || cell.x >= layer.width || cell.y < 0) continue
      const tileIndex = cell.y * layer.width + cell.x
      if (tileIndex < 0 || tileIndex >= layer.data.length) continue
      const previous = layer.data[tileIndex]
      if (previous === tile) continue
      changes.push({ layerIndex, tileIndex, previous, next: tile })
    }
    if (changes.length === 0) return false
    this.executeDirtyCommand(`Fill ${changes.length} tile${changes.length === 1 ? '' : 's'}`, () => {
      for (const change of changes) this.requireLayer(change.layerIndex).data[change.tileIndex] = change.next
    }, () => {
      for (const change of changes) this.requireLayer(change.layerIndex).data[change.tileIndex] = change.previous
    })
    return true
  }

  commitLiveTileChanges(changes, label) {
    assert(changes instanceof Map, 'tilemap state commitLiveTileChanges changes must be Map')
    assert(typeof label === 'string' && label.length > 0, 'tilemap state commitLiveTileChanges label must be non-empty string')
    const committed = [...changes.values()]
    if (committed.length === 0) return false
    this.history.add(new TilemapCommand(`${label} ${committed.length} tile${committed.length === 1 ? '' : 's'}`, () => {
      for (const change of committed) this.requireLayer(change.layerIndex).data[change.tileIndex] = change.next
      this.dirty = true
    }, () => {
      for (const change of committed) this.requireLayer(change.layerIndex).data[change.tileIndex] = change.previous
      this.dirty = true
    }))
    this.dirty = true
    return true
  }

  copyCells(layerIndexes, cells) {
    assert(Array.isArray(layerIndexes), 'tilemap state copyCells layerIndexes must be array')
    assert(Array.isArray(cells), 'tilemap state copyCells cells must be array')
    assert(layerIndexes.length > 0, 'tilemap state copyCells requires at least one layer')
    assert(cells.length > 0, 'tilemap state copyCells requires at least one cell')
    const minX = Math.min(...cells.map((cell) => cell.x))
    const minY = Math.min(...cells.map((cell) => cell.y))
    const maxX = Math.max(...cells.map((cell) => cell.x))
    const maxY = Math.max(...cells.map((cell) => cell.y))
    const entries = []

    for (const layerIndex of layerIndexes) {
      const layer = this.requireLayer(layerIndex)
      const tiles = []
      for (const cell of cells) {
        assert(Number.isInteger(cell.x) && Number.isInteger(cell.y), 'tilemap state copyCells cell must contain integer x/y')
        const tileIndex = cell.y * layer.width + cell.x
        const tile = cell.x >= 0 && cell.x < layer.width && tileIndex >= 0 && tileIndex < layer.data.length ? layer.data[tileIndex] : 0
        if (tile === 0) continue
        tiles.push({ dx: cell.x - minX, dy: cell.y - minY, tile })
      }
      entries.push({ sourceLayer: layerIndex, tiles })
    }

    return { width: maxX - minX + 1, height: maxY - minY + 1, entries }
  }

  cutCells(layerIndexes, cells) {
    const clipboard = this.copyCells(layerIndexes, cells)
    const changes = []
    for (const layerIndex of layerIndexes) {
      const layer = this.requireLayer(layerIndex)
      for (const cell of cells) {
        const tileIndex = cell.y * layer.width + cell.x
        if (cell.x < 0 || cell.x >= layer.width || tileIndex < 0 || tileIndex >= layer.data.length) continue
        const previous = layer.data[tileIndex]
        if (previous === 0) continue
        changes.push({ layerIndex, tileIndex, previous, next: 0 })
      }
    }
    if (changes.length > 0) {
      this.executeDirtyCommand(`Cut ${changes.length} tile${changes.length === 1 ? '' : 's'}`, () => {
        for (const change of changes) this.requireLayer(change.layerIndex).data[change.tileIndex] = change.next
      }, () => {
        for (const change of changes) this.requireLayer(change.layerIndex).data[change.tileIndex] = change.previous
      })
    }
    return { clipboard, changed: changes.length > 0 }
  }

  sampleTile(layerIndex, cell) {
    const layer = this.requireLayer(layerIndex)
    assert(Number.isInteger(cell.x) && Number.isInteger(cell.y), 'tilemap state sampleTile cell must contain integer x/y')
    if (cell.x < 0 || cell.x >= layer.width || cell.y < 0) return 0
    const tileIndex = cell.y * layer.width + cell.x
    if (tileIndex < 0 || tileIndex >= layer.data.length) return 0
    return layer.data[tileIndex]
  }

  pasteClipboard(clipboard, origin, targetLayerIndexes) {
    assert(clipboard && typeof clipboard === 'object' && !Array.isArray(clipboard), 'tilemap state pasteClipboard clipboard must be object')
    assert(Number.isInteger(origin.x) && Number.isInteger(origin.y), 'tilemap state pasteClipboard origin must contain integer x/y')
    assert(Array.isArray(targetLayerIndexes), 'tilemap state pasteClipboard targetLayerIndexes must be array')
    assert(targetLayerIndexes.length === clipboard.entries.length, 'tilemap state pasteClipboard target layer count must match clipboard entries')
    const changes = []

    clipboard.entries.forEach((entry, entryIndex) => {
      const layerIndex = targetLayerIndexes[entryIndex]
      const layer = this.requireLayer(layerIndex)
      for (const tile of entry.tiles) {
        const x = origin.x + tile.dx
        const y = origin.y + tile.dy
        const tileIndex = y * layer.width + x
        if (x < 0 || x >= layer.width || tileIndex < 0 || tileIndex >= layer.data.length) continue
        if (tile.tile === 0) continue
        const previous = layer.data[tileIndex]
        if (previous === tile.tile) continue
        changes.push({ layerIndex, tileIndex, previous, next: tile.tile })
      }
    })

    if (changes.length === 0) return false
    this.executeDirtyCommand(`Paste ${changes.length} tile${changes.length === 1 ? '' : 's'}`, () => {
      for (const change of changes) this.requireLayer(change.layerIndex).data[change.tileIndex] = change.next
    }, () => {
      for (const change of changes) this.requireLayer(change.layerIndex).data[change.tileIndex] = change.previous
    })
    return true
  }

  undo() {
    this.history.undo()
  }

  redo() {
    this.history.redo()
  }

  moveHistoryTo(index) {
    const state = this.history.toArray()[index]
    assert(state, `tilemap state missing history index ${index}`)
    this.history.moveTo(state)
    this.dirty = true
  }

  executeDirtyCommand(label, redo, undo) {
    this.history.execute(new TilemapCommand(label, () => {
      redo()
      this.dirty = true
    }, () => {
      undo()
      this.dirty = true
    }))
  }

  moveLayerRaw(from, to) {
    const [layer] = this.layers.splice(from, 1)
    assert(layer, `tilemap state missing layer ${from}`)
    this.layers.splice(to, 0, layer)
    this.renumberLayers()
  }

  resetHistory() {
    this.history.dispose()
    this.history = new UndoHistory()
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

  renumberLayers() {
    this.layers.forEach((layer, index) => {
      layer.index = index
      assert(layer.props && typeof layer.props === 'object' && !Array.isArray(layer.props), 'tilemap layer props required while renumbering')
    })
  }

  requireLayer(index) {
    const layer = this.layers[index]
    assert(layer, `tilemap state missing layer ${index}`)
    return layer
  }

  allocateLayerId() {
    const id = this.nextLayerId
    this.nextLayerId += 1
    return id
  }

  createLayerName() {
    const usedIndexes = new Set()
    let prefix = 'Layer '
    for (const layer of this.layers) {
      assert(layer.props && typeof layer.props === 'object' && !Array.isArray(layer.props), 'tilemap layer props required while creating layer name')
      const name = layer.props.name
      if (typeof name !== 'string') continue
      const match = name.match(/^(Layer |layer_)(\d+)$/)
      if (!match) continue
      prefix = match[1]
      usedIndexes.add(Number(match[2]))
    }

    let index = 0
    while (usedIndexes.has(index)) index += 1
    return `${prefix}${index}`
  }
}

class TilemapTileset {
  constructor({ name, path, tileWidth, tileHeight, firstTileId, columns, rows, tileCount = columns * rows, width, height, pixels = null, canvas = null, colorOnly = false }) {
    assert(typeof name === 'string' && name.length > 0, 'tileset name must be non-empty string')
    assert(typeof path === 'string' && path.length > 0, 'tileset path must be non-empty string')
    assert(Number.isInteger(tileWidth) && tileWidth > 0, 'tileset tileWidth must be positive integer')
    assert(Number.isInteger(tileHeight) && tileHeight > 0, 'tileset tileHeight must be positive integer')
    assert(Number.isInteger(firstTileId), 'tileset firstTileId must be integer')
    assert(Number.isInteger(columns) && columns > 0, 'tileset columns must be positive integer')
    assert(Number.isInteger(rows) && rows > 0, 'tileset rows must be positive integer')
    assert(Number.isInteger(tileCount) && tileCount > 0 && tileCount <= columns * rows, 'tileset tileCount must fit tileset grid')
    this.name = name
    this.path = path
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    this.firstTileId = firstTileId
    this.columns = columns
    this.rows = rows
    this.tileCount = tileCount
    this.width = width ?? columns * tileWidth
    this.height = height ?? rows * tileHeight
    this.pixels = pixels
    this.canvas = canvas
    this.colorOnly = colorOnly
  }

  static createDefault() {
    return TilemapTileset.createGenerated(1, 1)
  }

  static createGenerated(firstTileId, tileCount = firstTileId) {
    assert(Number.isInteger(firstTileId) && firstTileId > 0, 'generated tileset first tile id must be positive integer')
    assert(Number.isInteger(tileCount) && tileCount > 0, 'generated tileset tile count must be positive integer')
    const count = tileCount
    const columns = TilemapTileset.generatedColumnCount(count)
    const rows = count / columns
    const width = columns * DEFAULT_COLOR_TILESET_SPEC.tileWidth
    const height = rows * DEFAULT_COLOR_TILESET_SPEC.tileHeight
    const pixels = new Uint8ClampedArray(width * height * 4)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    assert(ctx, 'generated tileset requires 2d context')

    for (let tileOffset = 0; tileOffset < count; tileOffset++) {
      const tile = firstTileId + tileOffset
      const x = tileOffset % columns
      const y = Math.floor(tileOffset / columns)
      TilemapTileset.drawGeneratedTile(ctx, tile, x * DEFAULT_COLOR_TILESET_SPEC.tileWidth, y * DEFAULT_COLOR_TILESET_SPEC.tileHeight, DEFAULT_COLOR_TILESET_SPEC.tileWidth, DEFAULT_COLOR_TILESET_SPEC.tileHeight)
    }

    const image = ctx.getImageData(0, 0, width, height)
    pixels.set(image.data)
    return new TilemapTileset({ ...DEFAULT_COLOR_TILESET_SPEC, firstTileId, columns, rows, tileCount: count, width, height, pixels, canvas, colorOnly: true })
  }

  static generatedColumnCount(count) {
    for (let columns = Math.min(DEFAULT_COLOR_TILESET_SPEC.columns, count); columns > 1; columns--) {
      if (count % columns === 0) return columns
    }
    return count
  }

  static drawGeneratedTile(ctx, tile, x, y, width, height) {
    const primary = GENERATED_TILESET_PALETTE[(tile - 1) % GENERATED_TILESET_PALETTE.length]
    const secondary = GENERATED_TILESET_PALETTE[Math.floor((tile - 1) / GENERATED_TILESET_PALETTE.length) % GENERATED_TILESET_PALETTE.length]
    const pattern = Math.floor((tile - 1) / GENERATED_TILESET_PALETTE.length)

    ctx.fillStyle = primary
    ctx.fillRect(x, y, width, height)

    if (pattern > 0) {
      ctx.fillStyle = secondary
      const halfWidth = Math.ceil(width / 2)
      const halfHeight = Math.ceil(height / 2)
      if (pattern % 4 === 1) {
        ctx.fillRect(x, y, halfWidth, height)
      } else if (pattern % 4 === 2) {
        ctx.fillRect(x, y, width, halfHeight)
      } else if (pattern % 4 === 3) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + width, y)
        ctx.lineTo(x, y + height)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.fillRect(x + 3, y + 3, width - 6, height - 6)
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.fillRect(x + 1, y + 1, width - 2, 2)
  }

  static async load(spec, firstTileId) {
    let result;
    try {
      result = unwrap(await runtime.invoke("fs/fs::read-file", spec.path))
    } catch (e) {
      console.warn(`failed to load ${spec.path}; ${e}`)
    }
    const image = TilemapTileset.decodeQoi(result)
    const columns = Math.floor(image.width / spec.tileWidth)
    const imageRows = Math.floor(image.height / spec.tileHeight)
    assert(columns > 0 && imageRows > 0, `tileset ${spec.name} image is smaller than tile size`)
    const tileCount = spec.count > 0 ? spec.count : columns * imageRows
    const rows = Math.ceil(tileCount / columns)
    const canvas = TilemapTileset.createCanvas(image)
    return new TilemapTileset({ ...spec, firstTileId, columns, rows, tileCount, width: image.width, height: image.height, pixels: image.pixels, canvas })
  }

  static createCanvas(image) {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    assert(ctx, 'tileset qoi canvas requires 2d context')
    ctx.putImageData(new ImageData(image.pixels, image.width, image.height), 0, 0)
    return canvas
  }

  static decodeQoi(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
    assert(bytes.length >= 22, 'QOI data too short')
    assert(bytes[0] === 0x71 && bytes[1] === 0x6f && bytes[2] === 0x69 && bytes[3] === 0x66, 'tileset image must be QOI')
    const width = TilemapTileset.readU32(bytes, 4)
    const height = TilemapTileset.readU32(bytes, 8)
    const channels = bytes[12]
    const colorspace = bytes[13]
    assert(width > 0 && height > 0, 'QOI width and height must be positive')
    assert(channels === 3 || channels === 4, 'QOI channels must be 3 or 4')
    assert(colorspace === 0 || colorspace === 1, 'QOI colorspace must be 0 or 1')

    const pixels = new Uint8ClampedArray(width * height * 4)
    const index = Array.from({ length: 64 }, () => [0, 0, 0, 0])
    let r = 0
    let g = 0
    let b = 0
    let a = 255
    let p = 14
    let px = 0

    while (px < pixels.length) {
      const b1 = bytes[p++]
      assert(Number.isInteger(b1), 'QOI stream ended before all pixels decoded')

      if (b1 === 0xfe) {
        r = bytes[p++]; g = bytes[p++]; b = bytes[p++]
      } else if (b1 === 0xff) {
        r = bytes[p++]; g = bytes[p++]; b = bytes[p++]; a = bytes[p++]
      } else {
        const tag = b1 & 0xc0
        if (tag === 0x00) {
          const cached = index[b1]
          r = cached[0]; g = cached[1]; b = cached[2]; a = cached[3]
        } else if (tag === 0x40) {
          r = (r + ((b1 >> 4) & 0x03) - 2) & 0xff
          g = (g + ((b1 >> 2) & 0x03) - 2) & 0xff
          b = (b + (b1 & 0x03) - 2) & 0xff
        } else if (tag === 0x80) {
          const b2 = bytes[p++]
          assert(Number.isInteger(b2), 'QOI LUMA missing second byte')
          const dg = (b1 & 0x3f) - 32
          r = (r + dg - 8 + ((b2 >> 4) & 0x0f)) & 0xff
          g = (g + dg) & 0xff
          b = (b + dg - 8 + (b2 & 0x0f)) & 0xff
        } else {
          const run = (b1 & 0x3f) + 1
          for (let i = 0; i < run; i++) {
            pixels[px++] = r; pixels[px++] = g; pixels[px++] = b; pixels[px++] = a
          }
          continue
        }
      }

      index[TilemapTileset.colorHash(r, g, b, a)] = [r, g, b, a]
      pixels[px++] = r; pixels[px++] = g; pixels[px++] = b; pixels[px++] = a
    }

    return { width, height, channels, colorspace, pixels }
  }

  static readU32(bytes, offset) {
    return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]
  }

  static colorHash(r, g, b, a) {
    return (r * 3 + g * 5 + b * 7 + a * 11) % 64
  }

  containsTile(tile) {
    return tile >= this.firstTileId && tile < this.firstTileId + this.tileCount
  }

  drawTile(ctx, tile, dx, dy, width, height) {
    assert(ctx instanceof CanvasRenderingContext2D, 'tileset drawTile requires 2d context')
    assert(Number.isInteger(tile), 'tileset drawTile tile must be integer')
    assert(this.containsTile(tile), `tileset ${this.name} does not contain tile ${tile}`)
    assert(this.canvas instanceof HTMLCanvasElement, `tileset ${this.name} missing render canvas`)
    const localTile = tile - this.firstTileId
    const sx = (localTile % this.columns) * this.tileWidth
    const sy = Math.floor(localTile / this.columns) * this.tileHeight
    ctx.drawImage(this.canvas, sx, sy, this.tileWidth, this.tileHeight, dx, dy, width, height)
  }

  getData() {
    return {
      name: this.name,
      path: this.path,
      tileWidth: this.tileWidth,
      tileHeight: this.tileHeight,
      firstTileId: this.firstTileId,
      columns: this.columns,
      rows: this.rows,
      tileCount: this.tileCount,
      width: this.width,
      height: this.height,
      pixels: this.pixels,
      colorOnly: this.colorOnly,
    }
  }
}

function validateSnapshot(snapshot) {
  assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'view-tilemap snapshot must be an object')
  assert(Number.isInteger(snapshot.handle) && snapshot.handle > 0, 'view-tilemap snapshot.handle must be positive integer')
  assert(typeof snapshot.name === 'string', 'view-tilemap snapshot.name must be string')
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
  assert(Array.isArray(snapshot.history), 'view-tilemap snapshot.history must be array')
  for (const entry of snapshot.history) {
    assert(Number.isInteger(entry.index), 'view-tilemap history.index must be integer')
    assert(typeof entry.label === 'string' && entry.label.length > 0, 'view-tilemap history.label must be non-empty string')
    assert(typeof entry.current === 'boolean', 'view-tilemap history.current must be boolean')
    assert(Number.isInteger(entry.parentIndex), 'view-tilemap history.parentIndex must be integer')
  }
  for (const layer of snapshot.layers) {
    assert(Number.isInteger(layer.id) && layer.id > 0, 'view-tilemap layer.id must be positive integer')
    assert(Number.isInteger(layer.index), 'view-tilemap layer.index must be integer')
    assert(layer.props && typeof layer.props === 'object' && !Array.isArray(layer.props), 'view-tilemap layer.props must be object')
    assert(typeof layer.hidden === 'boolean', 'view-tilemap layer.hidden must be boolean')
    assert(Number.isInteger(layer.width) && layer.width > 0, 'view-tilemap layer.width must be positive integer')
    assert(Array.isArray(layer.data), 'view-tilemap layer.data must be array')
  }
  return snapshot
}

class TilemapSelectionTool {
  constructor({ getAddKey, getRemoveKey }) {
    assert(typeof getAddKey === 'function', 'tilemap selection tool getAddKey must be function')
    assert(typeof getRemoveKey === 'function', 'tilemap selection tool getRemoveKey must be function')
    this.getAddKey = getAddKey
    this.getRemoveKey = getRemoveKey
    this.selectedCells = new Set()
    this.drag = null
  }

  clear() {
    this.selectedCells.clear()
    this.drag = null
  }

  clearDrag() {
    this.drag = null
  }

  start(cell, event) {
    const mode = this.modeFromEvent(event)
    if (mode === SELECT_MODE.REPLACE) this.selectedCells.clear()
    this.drag = { mode, startX: cell.x, startY: cell.y, endX: cell.x, endY: cell.y }
  }

  update(cell) {
    assert(this.drag, 'tilemap selection update requires active drag')
    this.drag.endX = cell.x
    this.drag.endY = cell.y
  }

  finish(cell) {
    assert(this.drag, 'tilemap selection finish requires active drag')
    this.update(cell)
    const rect = this.rectFromDrag(this.drag)
    const mode = this.drag.mode
    if (rect.width === 1 && rect.height === 1 && mode === SELECT_MODE.REPLACE) {
      this.clear()
      return { status: 'Selection cleared' }
    }

    this.applyRect(rect, mode)
    this.drag = null
    return { status: this.statusText(mode) }
  }

  modeFromEvent(event) {
    if (this.eventHasKey(event, this.getAddKey())) return SELECT_MODE.ADD
    if (this.eventHasKey(event, this.getRemoveKey())) return SELECT_MODE.REMOVE
    return SELECT_MODE.REPLACE
  }

  eventHasKey(event, key) {
    const normalized = String(key || '').trim().toLowerCase()
    assert(normalized.length > 0, 'tilemap selection key must be non-empty')
    if (normalized === 'shift') return event.shiftKey
    if (normalized === 'control' || normalized === 'ctrl') return event.ctrlKey
    if (normalized === 'alt' || normalized === 'option') return event.altKey
    if (normalized === 'meta' || normalized === 'cmd' || normalized === 'command') return event.metaKey
    throw new Error(`tilemap selection unsupported modifier key ${key}`)
  }

  rectFromDrag(selection) {
    const minX = Math.min(selection.startX, selection.endX)
    const minY = Math.min(selection.startY, selection.endY)
    const maxX = Math.max(selection.startX, selection.endX)
    const maxY = Math.max(selection.startY, selection.endY)
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
  }

  applyRect(rect, mode) {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const key = this.key(x, y)
        if (mode === SELECT_MODE.REMOVE) this.selectedCells.delete(key)
        else this.selectedCells.add(key)
      }
    }
  }

  key(x, y) {
    return `${x},${y}`
  }

  containsCell(cell) {
    return this.selectedCells.has(this.key(cell.x, cell.y))
  }

  cells() {
    return [...this.selectedCells].map((key) => this.cellFromKey(key)).sort((a, b) => a.y - b.y || a.x - b.x)
  }

  statusText(mode) {
    if (mode === SELECT_MODE.ADD) return 'Selection added'
    if (mode === SELECT_MODE.REMOVE) return 'Selection removed'
    return 'Selection updated'
  }

  draw(ctx, { tileWidth, tileHeight, scale }) {
    assert(ctx instanceof CanvasRenderingContext2D, 'tilemap selection draw requires 2d context')
    assert(Number.isInteger(tileWidth) && tileWidth > 0, 'tilemap selection tileWidth must be positive integer')
    assert(Number.isInteger(tileHeight) && tileHeight > 0, 'tilemap selection tileHeight must be positive integer')
    assert(Number.isFinite(scale) && scale > 0, 'tilemap selection scale must be positive number')

    if (this.selectedCells.size > 0) {
      this.drawCells(ctx, this.selectedCells, tileWidth, tileHeight, scale, SELECT_COLORS.ACTIVE_BORDER, SELECT_COLORS.ACTIVE_FILL)
    }

    if (this.drag) {
      const colors = this.colorsForMode(this.drag.mode)
      this.drawRect(ctx, this.rectFromDrag(this.drag), tileWidth, tileHeight, scale, colors.border, colors.fill)
    }
  }

  colorsForMode(mode) {
    if (mode === SELECT_MODE.ADD) return { border: SELECT_COLORS.ADD_BORDER, fill: SELECT_COLORS.ADD_FILL }
    if (mode === SELECT_MODE.REMOVE) return { border: SELECT_COLORS.REMOVE_BORDER, fill: SELECT_COLORS.REMOVE_FILL }
    return { border: SELECT_COLORS.DRAG_BORDER, fill: SELECT_COLORS.DRAG_FILL }
  }

  drawCells(ctx, cells, tileWidth, tileHeight, scale, border, fill) {
    ctx.save()
    ctx.fillStyle = fill
    for (const key of cells) {
      const { x, y } = this.cellFromKey(key)
      ctx.fillRect(x * tileWidth, y * tileHeight, tileWidth, tileHeight)
    }

    ctx.strokeStyle = border
    ctx.lineWidth = 2 / scale
    ctx.beginPath()
    for (const key of cells) {
      const { x, y } = this.cellFromKey(key)
      const px = x * tileWidth
      const py = y * tileHeight
      if (!cells.has(this.key(x, y - 1))) {
        ctx.moveTo(px, py)
        ctx.lineTo(px + tileWidth, py)
      }
      if (!cells.has(this.key(x + 1, y))) {
        ctx.moveTo(px + tileWidth, py)
        ctx.lineTo(px + tileWidth, py + tileHeight)
      }
      if (!cells.has(this.key(x, y + 1))) {
        ctx.moveTo(px + tileWidth, py + tileHeight)
        ctx.lineTo(px, py + tileHeight)
      }
      if (!cells.has(this.key(x - 1, y))) {
        ctx.moveTo(px, py + tileHeight)
        ctx.lineTo(px, py)
      }
    }
    ctx.stroke()
    ctx.restore()
  }

  drawRect(ctx, rect, tileWidth, tileHeight, scale, border, fill) {
    const x = rect.x * tileWidth
    const y = rect.y * tileHeight
    const width = rect.width * tileWidth
    const height = rect.height * tileHeight
    ctx.save()
    ctx.fillStyle = fill
    ctx.fillRect(x, y, width, height)
    ctx.strokeStyle = border
    ctx.lineWidth = 2 / scale
    ctx.strokeRect(x, y, width, height)
    ctx.restore()
  }

  cellFromKey(key) {
    const [xText, yText] = key.split(',')
    const x = Number(xText)
    const y = Number(yText)
    assert(Number.isInteger(x) && Number.isInteger(y), `tilemap selection invalid cell key ${key}`)
    return { x, y }
  }
}

export class ViewTilemap extends ViewCanvasBase {
  static get observedAttributes() {
    return ['data-source', 'data-selection-add-key', 'data-selection-remove-key']
  }

  constructor() {
    super()
    this.state = new TilemapState()
    this.handle = 0
    this.snapshot = validateSnapshot(this.state.snapshot())
    this.sidebarElement = null
    this.statusElement = null
    this.pathElement = null
    this.dimensionsElement = null
    this.dirtyElement = null
    this.layersElement = null
    this.historyElement = null
    this.tilesetTabsElement = null
    this.tilesetPanelsElement = null
    this.activeTilesetName = ''
    this.tilesets = [TilemapTileset.createDefault()]
    this.tilesetSourceKey = ''
    this.selectedLayerIndexes = new Set()
    this.selectionTool = new TilemapSelectionTool({
      getAddKey: () => this.selectionAddKey,
      getRemoveKey: () => this.selectionRemoveKey,
    })
    this.eraseDragCells = null
    this.eraseChanges = null
    this.brushDragCells = null
    this.brushChanges = null
    this.clipboard = null
    this.pastePreviewCell = null
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
          <table>
            <tbody data-element="layers"></tbody>
          </table>
        </fieldset>
        <fieldset data-element="tilesets">
          <legend>Tilesets</legend>
          <div role="tablist" data-element="tileset-tabs" aria-label="Tileset files"></div>
          <div data-element="tileset-panels"></div>
        </fieldset>
        <fieldset>
          <legend>History</legend>
          <table data-element="undo-history">
            <thead>
              <tr><th>#</th><th>Command</th><th>Parent</th><th>State</th></tr>
            </thead>
            <tbody></tbody>
          </table>
        </fieldset>
      </aside>
      <footer>
        <output data-element="path"></output>
        <output data-element="dimensions"></output>
        <output data-element="dirty"></output>
        <output data-element="status">No tilemap loaded</output>
      </footer>
    `

    this.sidebarElement = this.querySelector('[data-element="sidebar"]')
    this.statusElement = this.querySelector('[data-element="status"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    this.dimensionsElement = this.querySelector('[data-element="dimensions"]')
    this.dirtyElement = this.querySelector('[data-element="dirty"]')
    this.layersElement = this.querySelector('[data-element="layers"]')
    this.historyElement = this.querySelector('[data-element="undo-history"]')
    this.tilesetTabsElement = this.querySelector('[data-element="tileset-tabs"]')
    this.tilesetPanelsElement = this.querySelector('[data-element="tileset-panels"]')

    assert(this.sidebarElement instanceof HTMLElement, 'view-tilemap missing sidebar')
    assert(this.statusElement instanceof HTMLOutputElement, 'view-tilemap missing status output')
    assert(this.pathElement instanceof HTMLOutputElement, 'view-tilemap missing path output')
    assert(this.dimensionsElement instanceof HTMLOutputElement, 'view-tilemap missing dimensions output')
    assert(this.dirtyElement instanceof HTMLOutputElement, 'view-tilemap missing dirty output')
    assert(this.historyElement instanceof HTMLTableElement, 'view-tilemap missing undo history table')
    assert(this.tilesetTabsElement instanceof HTMLElement, 'view-tilemap missing tileset tabs')
    assert(this.tilesetPanelsElement instanceof HTMLElement, 'view-tilemap missing tileset panels')

    super.connectedCallback()
    this.bindEvents()
    this.setData(this.snapshot, { autoFit: false })
    this.renderSnapshot(this.snapshot)
    void this.bootstrap()
  }

  createViewPluginMethods() {
    return {
      tool_1: async () => {
        await this.setTool(TOOL.SELECT)
        return viewOk()
      },
      tool_2: async () => {
        await this.setTool(TOOL.BRUSH)
        return viewOk()
      },
      tool_3: async () => {
        await this.setTool(TOOL.ERASE)
        return viewOk()
      },
      tool_4: async () => {
        await this.setTool(TOOL.EYEDROPPER)
        return viewOk()
      },
      tool_5: async () => {
        await this.setTool(TOOL.PASTE)
        return viewOk()
      },
      tool_6: async () => {
        await this.setTool(TOOL.FILL)
        return viewOk()
      },
    }
  }

  createHeaderControlsElement() {
    const controls = document.createElement('div')
    controls.dataset.element = 'header-controls'
    controls.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <button type="button" data-action="new"><i aria-hidden="true">docs</i></button>
        <button type="button" data-action="open"><i aria-hidden="true">folder_open</i></button>
        <button type="button" data-action="save" class="accent"><i aria-hidden="true">save</i></button>
        <button type="button" data-action="save-as"><i aria-hidden="true">save_as</i></button>
        <button type="button" data-action="reload"><i aria-hidden="true">refresh</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
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
      <div role="buttongroup" data-element="config-actions">
        <button type="button" data-action="map-props"><i aria-hidden="true">tune</i></button>
        <button type="button" data-action="settings"><i aria-hidden="true">settings</i></button>
      </div>
    `
    return controls
  }

  bindEvents() {
    this.tilesetTabsElement.addEventListener('click', async (event) => {
      const button = event.target.closest('button[role="tab"]')
      if (!(button instanceof HTMLButtonElement)) return
      if (button.dataset.action === 'tileset-add') {
        await this.addTilesetFromChooser()
        return
      }
      assert(button.dataset.tileset, 'view-tilemap tileset tab requires data-tileset')
      this.selectTilesetTab(button.dataset.tileset)
    })

    this.layersElement.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]')
      if (button instanceof HTMLButtonElement) {
        await this.handleLayerAction(button)
        return
      }

      const row = event.target.closest('tr[data-layer-id]')
      if (!(row instanceof HTMLTableRowElement)) return
      await this.toggleLayerSelection(this.layerIndexFromRow(row))
    })

    this.historyElement.addEventListener('click', async (event) => {
      const row = event.target.closest('tr[data-history-index]')
      if (!(row instanceof HTMLTableRowElement)) return
      this.state.moveHistoryTo(Number(row.dataset.historyIndex))
      await this.refreshSnapshot('History state selected')
    })

    this.queryHeader('[data-action="new"]').addEventListener('click', async () => this.new())
    this.queryHeader('[data-action="open"]').addEventListener('click', async () => this.open())
    this.queryHeader('[data-action="save"]').addEventListener('click', async () => this.save())
    this.queryHeader('[data-action="save-as"]').addEventListener('click', async () => this.saveAs())
    this.queryHeader('[data-action="reload"]').addEventListener('click', async () => this.reload())
    this.queryHeader('[data-action="select"]').addEventListener('click', async () => this.setTool(TOOL.SELECT))
    this.queryHeader('[data-action="brush"]').addEventListener('click', async () => this.setTool(TOOL.BRUSH))
    this.queryHeader('[data-action="erase"]').addEventListener('click', async () => this.setTool(TOOL.ERASE))
    this.queryHeader('[data-action="eyedropper"]').addEventListener('click', async () => this.setTool(TOOL.EYEDROPPER))
    this.queryHeader('[data-action="paste-tool"]').addEventListener('click', async () => {
      if (!this.clipboard) return
      await this.setTool(TOOL.PASTE)
    })
    this.queryHeader('[data-action="fill"]').addEventListener('click', async () => this.setTool(TOOL.FILL))
    this.queryHeader('[data-action="cut"]').addEventListener('click', async () => this.cutSelection())
    this.queryHeader('[data-action="copy"]').addEventListener('click', async () => this.copySelection())
    this.queryHeader('[data-action="undo"]').addEventListener('click', async () => this.command('undo', 'Undo'))
    this.queryHeader('[data-action="redo"]').addEventListener('click', async () => this.command('redo', 'Redo'))
    this.queryHeader('[data-action="grid"]').addEventListener('click', () => this.toggleGrid())
    this.queryHeader('[data-action="zoom-in"]').addEventListener('click', () => this.zoomIn())
    this.queryHeader('[data-action="zoom-out"]').addEventListener('click', () => this.zoomOut())
    this.queryHeader('[data-action="zoom-fit"]').addEventListener('click', () => this.zoomFit())
    this.queryHeader('[data-action="map-props"]').addEventListener('click', async () => this.openMapProps())
    this.queryHeader('[data-action="settings"]').addEventListener('click', async () => this.openSettings())
  }

  queryHeader(selector) {
    const element = this.queryHeaderControl(selector)
    assert(element instanceof HTMLElement, `view-tilemap missing header control ${selector}`)
    return element
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === 'data-source' && this.dataset.ready) {
      const dataSource = String(newValue || '').trim()
      if (dataSource) void this.loadDataSource(dataSource)
    }
  }

  async bootstrap() {
    const dataSource = String(this.getAttribute('data-source') || '').trim()
    if (!dataSource) {
      this.setStatus('No tilemap loaded', 'info')
      return
    }
    await this.loadDataSource(dataSource)
  }

  async loadDataSource(dataSource) {
    const path = this.normalizeTilemapDataSource(dataSource)
    this.setBusy(true)
    this.setStatus(`Opening ${path} tilemap…`, 'info')
    try {
      await this.openPath(path, { autoFit: true })
    } catch (error) {
      this.setStatus(String(error?.message || error), 'danger')
      await runtime.call('ui.toast.error', { message: String(error?.message || error) })
    } finally {
      this.setBusy(false)
    }
  }

  get selectionAddKey() {
    return String(this.dataset.selectionAddKey || DEFAULT_SELECT_ADD_KEY).trim()
  }

  get selectionRemoveKey() {
    return String(this.dataset.selectionRemoveKey || DEFAULT_SELECT_REMOVE_KEY).trim()
  }

  normalizeTilemapDataSource(dataSource) {
    const source = String(dataSource || '').trim()
    assert(source.length > 0, 'view-tilemap data-source must be non-empty filesystem path')
    assert(!source.startsWith('sql:'), 'view-tilemap data-source must be a filesystem path, not sql')
    return source
  }

  async openPath(path, { autoFit = true } = {}) {
    assert(typeof path === 'string' && path.length > 0, 'view-tilemap open requires tilemap path')
    assert(typeof autoFit === 'boolean', 'view-tilemap open autoFit must be boolean')
    const tilemap = await this.loadTilemapFile(path)
    const result = this.state.open(tilemap)
    assert(Number.isInteger(result.handle) && result.handle > 0, 'view-tilemap open returned invalid handle')
    this.handle = result.handle
    this.selectedLayerIndexes.clear()
    this.selectedLayerIndexes.add(0)
    this.selectionTool.clear()
    this.eraseDragCells = null
    this.eraseChanges = null
    this.brushDragCells = null
    this.brushChanges = null
    this.clipboard = null
    this.pastePreviewCell = null
    await this.refreshSnapshot(`Opened ${tilemap.path}`, { autoFit })
  }

  async handleLayerAction(button) {
    const layer = this.layerIndexFromActionButton(button)
    const action = button.dataset.action
    if (action === 'layer-hidden') {
      const target = this.state.requireLayer(layer)
      this.state.setLayerHidden(layer, !target.hidden)
    } else if (action === 'layer-insert') {
      const insertIndex = layer + 1
      this.state.insertLayer(insertIndex)
      this.selectedLayerIndexes.clear()
      this.selectedLayerIndexes.add(layer)
      this.state.setActiveLayer(layer)
    } else if (action === 'layer-delete') {
      this.state.deleteLayer(layer)
    } else if (action === 'layer-up') {
      const targetIndex = Math.min(this.state.layers.length - 1, layer + 1)
      this.state.moveLayer(layer, targetIndex)
      this.selectedLayerIndexes.clear()
      this.selectedLayerIndexes.add(targetIndex)
    } else if (action === 'layer-down') {
      const targetIndex = Math.max(0, layer - 1)
      this.state.moveLayer(layer, targetIndex)
      this.selectedLayerIndexes.clear()
      this.selectedLayerIndexes.add(targetIndex)
    } else if (action === 'layer-props') {
      await this.openLayerProps(layer)
      return
    } else {
      throw new Error(`view-tilemap unknown layer action ${action}`)
    }
    await this.refreshSnapshot('Layer updated')
  }

  async new() {
    const payload = unwrap(await runtime.call('ui.popup.open', {
      title: 'Create Tilemap',
      size: 'medium',
      tag: 'tilemap-settings',
      attributes: {
        'data-mode': 'create',
        'data-title': 'Create Tilemap',
      },
    }))
    if (payload?.reload) {
      await this.openPath(payload.path, { autoFit: true })
      await runtime.call('ui.toast.success', { message: `Created tilemap ${payload.path}` })
    }
  }

  async open() {
    const selection = await this.chooseTilemapFile()
    if (selection.cancelled) return
    await this.openPath(selection.path, { autoFit: true })
  }

  async chooseTilemapFile() {
    const payload = unwrap(await runtime.call('ui.popup.open', this.createOpenTilemapPopupOptions()))
    if (!payload || payload.cancelled) return { cancelled: true }
    const selection = Array.isArray(payload.selection) ? payload.selection[0] : payload.selection
    assert(selection?.path, 'view-tilemap open requires selected tilemap file path')
    return { cancelled: false, path: selection.path }
  }

  createOpenTilemapPopupOptions() {
    return {
      title: 'Open Tilemap',
      size: 'medium',
      tag: 'view-files',
      props: {
        mode: 'chooser',
        filter: '*.tilemap.json,*.json',
      },
    }
  }

  async addTilesetFromChooser() {
    assert(this.snapshot, 'view-tilemap add tileset requires current snapshot')
    const payload = unwrap(await runtime.call('ui.popup.open', {
      title: 'Choose Tileset QOI',
      size: 'medium',
      tag: 'view-files',
      props: {
        mode: 'chooser',
        filter: '*.qoi',
      },
    }))
    if (!payload || payload.cancelled) return
    const selection = Array.isArray(payload.selection) ? payload.selection[0] : payload.selection
    assert(selection?.path, 'view-tilemap add tileset requires selected QOI path')
    await this.addTilesetPath(selection.path)
  }

  async addTilesetPath(path) {
    assert(typeof path === 'string' && path.length > 0, 'view-tilemap add tileset requires path')
    assert(path.toLowerCase().endsWith('.qoi'), 'view-tilemap add tileset requires .qoi file')
    const snapshot = this.requireSnapshot()
    const specs = this.collectTilesetSpecs(snapshot)
    specs.push({
      name: this.uniqueTilesetName(this.nameFromTilesetPath(path), specs),
      path,
      tileWidth: this.parsePositiveInt(snapshot.props?.sourceTileSize ?? snapshot.props?.tileSize ?? snapshot.props?.tw ?? DEFAULT_TILE_WIDTH, 'tileset tile width'),
      tileHeight: this.parsePositiveInt(snapshot.props?.sourceTileSize ?? snapshot.props?.tileSize ?? snapshot.props?.th ?? DEFAULT_TILE_HEIGHT, 'tileset tile height'),
      count: 0,
    })
    this.state.setTilesetSpecs(specs.map((spec) => ({
      name: spec.name,
      file: spec.path,
      tileWidth: spec.tileWidth,
      tileHeight: spec.tileHeight,
      ...(spec.count > 0 ? { count: spec.count } : {}),
    })))
    this.activeTilesetName = specs[specs.length - 1].name
    await this.refreshSnapshot(`Added tileset ${this.activeTilesetName}`)
    await runtime.call('ui.toast.success', { message: `Added tileset ${this.activeTilesetName}` })
  }

  uniqueTilesetName(name, specs) {
    assert(typeof name === 'string' && name.length > 0, 'view-tilemap tileset name must be non-empty string')
    assert(Array.isArray(specs), 'view-tilemap tileset specs must be array')
    const used = new Set(specs.map((spec) => spec.name))
    if (!used.has(name)) return name
    let index = 2
    while (used.has(`${name}-${index}`)) index += 1
    return `${name}-${index}`
  }

  async loadTilemapFile(path) {
    return { path, data: unwrap(await runtime.invoke("fs/fs::read-text", path)) }
  }

  async writeTilemapFile(path, data) {
    unwrap(await runtime.invoke("fs/fs::write-text", path, data))
  }

  async saveAs() {
    const payload = await this.chooseSaveTarget()
    if (payload.cancelled) return
    await this.saveToPath(payload.path)
    await this.refreshSnapshot(`Saved as ${payload.path}`)
    await runtime.call('ui.toast.success', { message: `Saved tilemap ${payload.path}` })
  }

  async save() {
    assert(this.snapshot, 'view-tilemap save requires current snapshot')
    assert(typeof this.snapshot.path === 'string' && this.snapshot.path.length > 0, 'view-tilemap save requires current tilemap path')
    await this.saveToPath(this.snapshot.path)
    await this.refreshSnapshot('Saved')
    await runtime.call('ui.toast.success', { message: `Saved tilemap ${this.snapshot.path}` })
  }

  async chooseSaveTarget() {
    const payload = unwrap(await runtime.call('ui.popup.open', this.createSaveTilemapPopupOptions()))
    if (!payload || payload.cancelled) return { cancelled: true }
    assert(typeof payload.path === 'string' && payload.path.length > 0, 'view-tilemap save-as requires tilemap file path')
    return { cancelled: false, path: payload.path }
  }

  createSaveTilemapPopupOptions() {
    return {
      title: 'Save Tilemap As',
      size: 'medium',
      tag: 'view-files',
      props: {
        mode: 'saver',
        filter: '*.tilemap.json,*.json',
        defaultName: basename(this.snapshot?.path || 'new.tilemap.json'),
      },
    }
  }

  async saveToPath(path) {
    assert(typeof path === 'string' && path.length > 0, 'view-tilemap save requires tilemap file path')
    const data = `${this.state.toStorageData()}\n`
    await this.writeTilemapFile(path, data)
    this.state.save({ path })
  }

  async reload() {
    assert(this.snapshot, 'view-tilemap reload requires current snapshot')
    assert(typeof this.snapshot.path === 'string' && this.snapshot.path.length > 0, 'view-tilemap reload requires current tilemap path')
    await this.openPath(this.snapshot.path, { autoFit: true })
    this.setStatus(`Reloaded tilemap ${this.snapshot.path}`, 'success')
    await runtime.call('ui.toast.success', { message: `Reloaded tilemap ${this.snapshot.path}` })
  }

  async setTool(tool) {
    if (tool === TOOL.PASTE && !this.clipboard) {
      this.setStatus('Clipboard is empty', 'info')
      return
    }
    this.state.setTool(tool)
    if (tool !== TOOL.SELECT) this.selectionTool.clearDrag()
    if (tool !== TOOL.ERASE) {
      this.eraseDragCells = null
      this.eraseChanges = null
    }
    if (tool !== TOOL.BRUSH) {
      this.brushDragCells = null
      this.brushChanges = null
    }
    if (tool !== TOOL.PASTE) this.pastePreviewCell = null
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

  async copySelection() {
    if (!this.canCopySelection()) return
    const layers = this.copyLayerIndexes()
    const cells = this.selectionTool.cells()
    this.clipboard = this.state.copyCells(layers, cells)
    this.pastePreviewCell = null
    await this.refreshSnapshot('Selection copied')
  }

  async cutSelection() {
    if (!this.canCopySelection()) return
    const layers = this.copyLayerIndexes()
    const cells = this.selectionTool.cells()
    const result = this.state.cutCells(layers, cells)
    this.clipboard = result.clipboard
    this.pastePreviewCell = null
    await this.refreshSnapshot(result.changed ? 'Selection cut' : 'Selection copied')
  }

  canCopySelection() {
    return this.selectionTool.selectedCells.size > 0 && this.copyLayerIndexes().length > 0
  }

  copyLayerIndexes() {
    return [...this.selectedLayerIndexes].filter((index) => Number.isInteger(index) && index >= 0).sort((a, b) => a - b)
  }

  async sampleTileAt(cell) {
    const layerIndex = this.eyedropperLayerIndex()
    if (!Number.isInteger(layerIndex)) {
      this.setStatus('Select a layer before sampling', 'info')
      return
    }
    const tile = this.state.sampleTile(layerIndex, cell)
    this.state.setActiveTile(tile)
    await this.refreshSnapshot(`Sampled tile ${tile} from layer ${layerIndex}`)
  }

  eyedropperLayerIndex() {
    if (this.selectedLayerIndexes.size === 0) return null
    return Math.max(...this.selectedLayerIndexes)
  }

  async pasteClipboardAt(cell) {
    if (!this.clipboard) {
      this.setStatus('Clipboard is empty', 'info')
      return
    }
    const targets = this.pasteTargetLayerIndexes()
    if (targets.length === 0) {
      this.setStatus('Select a target layer before pasting', 'info')
      return
    }
    const changed = this.state.pasteClipboard(this.clipboard, cell, targets)
    if (!changed) {
      this.setStatus('Nothing pasted', 'info')
      return
    }
    await this.refreshSnapshot('Clipboard pasted')
  }

  pasteTargetLayerIndexes() {
    assert(this.clipboard, 'view-tilemap paste target requires clipboard')
    if (this.clipboard.entries.length > 1) return this.clipboard.entries.map((entry) => entry.sourceLayer)
    const selected = this.copyLayerIndexes()
    return selected.length === 1 ? selected : []
  }

  async openMapProps() {
    const snapshot = this.requireSnapshot()
    const payload = unwrap(await runtime.call('ui.popup.open', {
      title: 'Map Properties',
      size: 'medium',
      tag: 'view-props',
      props: {
        title: 'Map Properties',
        dataSource: snapshot.props,
      },
    }))
    if (!payload || payload.cancelled) return
    this.state.setMapProps(payload.data)
    await this.refreshSnapshot('Map properties updated')
  }

  async openLayerProps(layerIndex) {
    const snapshot = this.requireSnapshot()
    const layer = snapshot.layers.find((entry) => entry.index === layerIndex)
    assert(layer, `view-tilemap missing layer ${layerIndex}`)
    const label = layerDisplayName(layer)
    const payload = unwrap(await runtime.call('ui.popup.open', {
      title: `${label} Properties`,
      size: 'medium',
      tag: 'view-props',
      props: {
        title: `${label} Properties`,
        dataSource: layer.props,
      },
    }))
    if (!payload || payload.cancelled) return
    this.state.setLayerProps(layerIndex, payload.data)
    await this.refreshSnapshot(`${label} properties updated`)
  }

  async openSettings() {
    assert(this.snapshot, 'view-tilemap settings requires current snapshot')
    assert(typeof this.snapshot.path === 'string' && this.snapshot.path.length > 0, 'view-tilemap settings requires current tilemap path')
    await this.saveToPath(this.snapshot.path)
    await this.refreshSnapshot('Saved before opening settings')
    const payload = unwrap(await runtime.call('ui.popup.open', {
      title: 'Tilemap Settings',
      size: 'medium',
      tag: 'tilemap-settings',
      attributes: {
        'data-mode': 'edit',
        'data-title': 'Tilemap Settings',
        'data-source': this.snapshot.path,
      },
    }))
    if (payload?.reload) {
      await this.openPath(payload.path, { autoFit: true })
      await runtime.call('ui.toast.success', { message: `Updated tilemap ${payload.path}` })
    }
  }

  async refreshSnapshot(statusText, { autoFit = false } = {}) {
    assert(typeof autoFit === 'boolean', 'view-tilemap refreshSnapshot autoFit must be boolean')
    const snapshot = validateSnapshot(this.state.snapshot())
    await this.syncTilesets(snapshot)
    this.applyTileSize(snapshot)
    this.snapshot = snapshot
    this.setData(snapshot, { autoFit })
    this.renderSnapshot(snapshot)
    this.setStatus(statusText, snapshot.dirty ? 'warning' : 'success')
  }

  async syncTilesets(snapshot) {
    const sourceKey = this.createTilesetSourceKey(snapshot)
    if (sourceKey === this.tilesetSourceKey) return
    this.tilesets = await this.createTilesetsForSnapshot(snapshot)
    this.tilesetSourceKey = sourceKey
    this.tilemapRender.setTilesets(this.tilesets)
  }

  createTilesetSourceKey(snapshot) {
    return JSON.stringify({
      tilesets: snapshot.props?.tilesets ?? '',
      tileSize: snapshot.props?.tileSize ?? '',
      sourceTileSize: snapshot.props?.sourceTileSize ?? '',
      tw: snapshot.props?.tw ?? '',
      th: snapshot.props?.th ?? '',
    })
  }

  async createTilesetsForSnapshot(snapshot) {
    const specs = this.collectTilesetSpecs(snapshot)
    const maxTileId = this.maxTileId(snapshot)
    if (specs.length === 0) return [TilemapTileset.createGenerated(1, Math.max(1, maxTileId))]

    let firstTileId = 1
    const tilesets = []
    for (const spec of specs) {
      const tileset = await TilemapTileset.load(spec, firstTileId)
      tilesets.push(tileset)
      firstTileId += tileset.tileCount
    }
    if (maxTileId >= firstTileId) tilesets.push(TilemapTileset.createGenerated(firstTileId, maxTileId - firstTileId + 1))
    return tilesets
  }

  maxTileId(snapshot) {
    let maxTile = 0
    for (const layer of snapshot.layers) {
      for (const tile of layer.data) {
        if (tile > maxTile) maxTile = tile
      }
    }
    return maxTile
  }

  collectTilesetSpecs(snapshot) {
    const mapTilesets = snapshot.props?.tilesets
    if (typeof mapTilesets !== 'string' || mapTilesets.length === 0) return []
    const parsed = JSON.parse(mapTilesets)
    assert(Array.isArray(parsed), 'view-tilemap props.tilesets must be JSON array')
    return parsed.map((entry) => this.normalizeTilesetSpec(entry, snapshot.props))
  }

  normalizeTilesetSpec(entry, props) {
    assert(entry && typeof entry === 'object' && !Array.isArray(entry), 'view-tilemap tileset entry must be object')
    const file = String(entry.file ?? entry.path ?? entry.url ?? '')
    assert(file.length > 0, 'view-tilemap tileset entry requires file')
    const name = String(entry.name || this.nameFromTilesetPath(file))
    const tileWidth = this.parsePositiveInt(entry.tileWidth ?? entry.tw ?? props?.sourceTileSize ?? props?.tileSize ?? props?.tw ?? DEFAULT_TILE_WIDTH, 'tileset tile width')
    const tileHeight = this.parsePositiveInt(entry.tileHeight ?? entry.th ?? props?.sourceTileSize ?? props?.tileSize ?? props?.th ?? DEFAULT_TILE_HEIGHT, 'tileset tile height')
    const count = entry.count == null ? 0 : this.parsePositiveInt(entry.count, 'tileset count')
    return { name, path: file, tileWidth, tileHeight, count }
  }

  nameFromTilesetPath(path) {
    const clean = String(path).split('?')[0]
    const file = clean.slice(clean.lastIndexOf('/') + 1)
    return file.replace(/\.[^.]+$/, '') || 'tileset'
  }

  parsePositiveInt(value, label) {
    const parsed = Number.parseInt(String(value), 10)
    assert(Number.isInteger(parsed) && parsed > 0, `view-tilemap ${label} must be positive integer`)
    return parsed
  }

  applyTileSize(snapshot) {
    const tileSize = this.parsePositiveInt(snapshot.props?.tileSize ?? snapshot.props?.sourceTileSize ?? snapshot.props?.tw ?? DEFAULT_TILE_WIDTH, 'tile size')
    this.tilemapRender.tileWidth = tileSize
    this.tilemapRender.tileHeight = tileSize
  }

  requireHandle() {
    assert(Number.isInteger(this.handle) && this.handle > 0, 'view-tilemap requires open handle')
    return this.handle
  }

  renderSnapshot(snapshot) {
    if (!this.hasLoadedMap(snapshot)) {
      this.pathElement.textContent = 'No tilemap loaded'
      this.dimensionsElement.textContent = ''
      this.dirtyElement.textContent = ''
      this.dirtyElement.className = ''
    } else {
      this.pathElement.textContent = `Path: ${snapshot.path}`
      this.dimensionsElement.textContent = `Size: ${snapshot.width} × ${snapshot.height}`
      this.dirtyElement.textContent = snapshot.dirty ? 'Dirty' : 'Saved'
      this.dirtyElement.className = snapshot.dirty ? 'warning' : 'success'
    }

    this.renderHeaderControls(snapshot)
    this.renderLayers(snapshot)
    this.renderTilesets(snapshot)
    this.renderHistory(snapshot)
  }

  renderHistory(snapshot) {
    assert(this.historyElement instanceof HTMLTableElement, 'view-tilemap missing undo history table')
    assert(Array.isArray(snapshot.history), 'view-tilemap snapshot history must be array')
    const tbody = this.historyElement.querySelector('tbody')
    assert(tbody instanceof HTMLTableSectionElement, 'view-tilemap missing undo history tbody')
    tbody.replaceChildren()

    if (snapshot.history.length === 0) {
      const row = document.createElement('tr')
      const cell = document.createElement('td')
      cell.colSpan = 4
      cell.textContent = 'No history yet'
      row.appendChild(cell)
      tbody.appendChild(row)
      return
    }

    for (const entry of snapshot.history) {
      const row = document.createElement('tr')
      row.dataset.historyIndex = String(entry.index)
      if (entry.current) row.setAttribute('aria-selected', 'true')

      const indexCell = document.createElement('td')
      indexCell.textContent = String(entry.index)
      row.appendChild(indexCell)

      const labelCell = document.createElement('td')
      labelCell.textContent = entry.label
      row.appendChild(labelCell)

      const parentCell = document.createElement('td')
      parentCell.textContent = entry.parentIndex >= 0 ? String(entry.parentIndex) : 'root'
      row.appendChild(parentCell)

      const stateCell = document.createElement('td')
      stateCell.textContent = entry.current ? 'Current' : ''
      row.appendChild(stateCell)

      tbody.appendChild(row)
    }
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

  renderTilesets(snapshot) {
    assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'view-tilemap renderTilesets snapshot must be object')
    assert(Number.isInteger(snapshot.activeTile), 'view-tilemap active tile must be integer')
    assert(this.tilesetTabsElement instanceof HTMLElement, 'view-tilemap missing tileset tabs')
    assert(this.tilesetPanelsElement instanceof HTMLElement, 'view-tilemap missing tileset panels')
    this.tilesetTabsElement.replaceChildren()
    this.tilesetPanelsElement.replaceChildren()

    const tilesets = this.tilesets.length > 0 ? this.tilesets : [TilemapTileset.createDefault()]
    const activeTile = this.canShowTilesetActiveTile(snapshot.tool) ? snapshot.activeTile : null
    const clipboardTiles = snapshot.tool === TOOL.PASTE ? this.clipboardTileSet() : new Set()
    const activeTileset = Number.isInteger(activeTile) ? tilesets.find((tileset) => this.tilesetRender.containsTile(tileset, activeTile)) : null
    const activeName = tilesets.some((tileset) => tileset.name === this.activeTilesetName)
      ? this.activeTilesetName
      : activeTileset?.name || tilesets[0].name

    const addTab = document.createElement('button')
    addTab.type = 'button'
    addTab.setAttribute('role', 'tab')
    addTab.setAttribute('aria-selected', 'false')
    addTab.dataset.action = 'tileset-add'
    addTab.title = 'Add tileset'
    addTab.innerHTML = '<i aria-hidden="true">add</i>'
    this.tilesetTabsElement.appendChild(addTab)

    for (const tileset of tilesets) {
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
      this.tilesetRender.draw(canvas, tileset, activeTile, clipboardTiles)

      const status = document.createElement('output')
      status.dataset.element = 'tileset-status'
      status.textContent = this.tilesetStatusText(tileset)
      panel.appendChild(status)

      this.tilesetPanelsElement.appendChild(panel)
    }

    this.activeTilesetName = activeName
  }

  canShowTilesetActiveTile(tool) {
    return tool === TOOL.BRUSH || tool === TOOL.EYEDROPPER || tool === TOOL.PASTE || tool === TOOL.FILL
  }

  clipboardTileSet() {
    const tiles = new Set()
    if (!this.clipboard) return tiles
    for (const entry of this.clipboard.entries) {
      for (const tile of entry.tiles) {
        if (tile.tile !== 0) tiles.add(tile.tile)
      }
    }
    return tiles
  }

  tilesetStatusText(tileset) {
    if (tileset.colorOnly) return `${tileset.path} — generated color tiles; click grid cells to set active tile id`
    return `${tileset.path} — QOI ${tileset.width} × ${tileset.height}; ${tileset.columns} × ${tileset.rows} tiles; click grid cells to set active tile id`
  }

  async selectTileFromTileset(event, tileset) {
    assert(event.currentTarget instanceof HTMLCanvasElement, 'view-tilemap tileset click requires canvas')
    const tile = this.tilesetRender.tileFromPointerEvent(event, tileset)
    this.state.setActiveTile(tile)
    const snapshot = this.requireSnapshot()
    if (snapshot.tool !== TOOL.BRUSH && snapshot.tool !== TOOL.FILL) {
      await this.setTool(TOOL.BRUSH)
      this.setStatus(`Active tile ${tile} selected from ${tileset.name}`, 'info')
      return
    }
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
    const cutButton = this.queryHeader('[data-action="cut"]')
    const copyButton = this.queryHeader('[data-action="copy"]')
    const pasteButton = this.queryHeader('[data-action="paste-tool"]')
    assert(undoButton instanceof HTMLButtonElement, 'view-tilemap undo control must be a button')
    assert(redoButton instanceof HTMLButtonElement, 'view-tilemap redo control must be a button')
    assert(cutButton instanceof HTMLButtonElement, 'view-tilemap cut control must be a button')
    assert(copyButton instanceof HTMLButtonElement, 'view-tilemap copy control must be a button')
    assert(pasteButton instanceof HTMLButtonElement, 'view-tilemap paste control must be a button')
    undoButton.disabled = !snapshot.canUndo
    redoButton.disabled = !snapshot.canRedo
    cutButton.disabled = !this.canCopySelection()
    copyButton.disabled = !this.canCopySelection()
    pasteButton.disabled = !this.clipboard
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
    const snapshot = this.requireSnapshot()
    this.renderLayers(snapshot)
    this.renderHeaderControls(snapshot)
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

  clearSelection() {
    this.selectionTool.clear()
    this.renderHeaderControls(this.requireSnapshot())
    this.draw()
    this.setStatus('Selection cleared', 'info')
  }

  requireSnapshot() {
    assert(this.snapshot, 'view-tilemap requires snapshot')
    return this.snapshot
  }

  hasLoadedMap(snapshot = this.snapshot) {
    return Boolean(snapshot && Array.isArray(snapshot.layers) && snapshot.layers.length > 0)
  }

  layerIndexFromActionButton(button) {
    const row = button.closest('tr[data-layer-id]')
    assert(row instanceof HTMLTableRowElement, 'view-tilemap layer action requires containing layer row')
    return this.layerIndexFromRow(row)
  }

  layerIndexFromRow(row) {
    const layerId = Number(row.dataset.layerId)
    assert(Number.isInteger(layerId) && layerId > 0, 'view-tilemap layer row requires positive layer id')
    const layer = this.state.layers.find((entry) => entry.id === layerId)
    assert(layer, `view-tilemap missing current layer for id ${layerId}`)
    return layer.index
  }

  renderLayers(snapshot) {
    const tbody = this.layersElement
    assert(tbody instanceof HTMLTableSectionElement, 'view-tilemap missing layers tbody')
    tbody.replaceChildren()
    this.normalizeSelectedLayers(snapshot)

    for (const layer of snapshot.layers.toReversed()) {
      const row = document.createElement('tr')
      row.dataset.layerId = String(layer.id)
      if (this.selectedLayerIndexes.has(layer.index)) row.setAttribute('aria-selected', 'true')

      const nameCell = document.createElement('td')
      nameCell.textContent = layerDisplayName(layer)
      row.appendChild(nameCell)

      const actionsCell = document.createElement('td')
      actionsCell.appendChild(this.createLayerButton('layer-hidden', layer.hidden ? 'visibility_off' : 'visibility', layer.hidden ? '0' : '1'))

      actionsCell.appendChild(this.createLayerButton('layer-up', 'arrow_upward', ''))
      actionsCell.appendChild(this.createLayerButton('layer-down', 'arrow_downward', ''))
      actionsCell.appendChild(this.createLayerButton('layer-insert', 'add', ''))
      actionsCell.appendChild(this.createLayerButton('layer-props', 'tune', ''))
      actionsCell.appendChild(this.createLayerButton('layer-delete', 'delete', ''))
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
    this.selectionTool.draw(ctx, {
      tileWidth: this.tilemapRender.tileWidth,
      tileHeight: this.tilemapRender.tileHeight,
      scale: this.scale,
    })
    this.drawPastePreview(ctx, snapshot)
  }

  onCanvasMouseDown(event) {
    if (event.button !== 0) return
    const snapshot = this.requireSnapshot()
    if (!this.hasLoadedMap(snapshot)) {
      this.setStatus('No tilemap loaded', 'info')
      return
    }
    if (snapshot.tool === TOOL.SELECT) {
      event.preventDefault()
      this.focus()
      this.selectionTool.start(this.cellFromPointerEvent(event, snapshot), event)
      this.draw()
      return
    }

    if (snapshot.tool === TOOL.BRUSH) {
      event.preventDefault()
      this.focus()
      this.brushDragCells = new Map()
      this.brushChanges = new Map()
      this.addBrushDragCell(this.cellFromPointerEvent(event, snapshot))
      return
    }

    if (snapshot.tool === TOOL.ERASE) {
      event.preventDefault()
      this.focus()
      this.eraseDragCells = new Map()
      this.eraseChanges = new Map()
      this.addEraseDragCell(this.cellFromPointerEvent(event, snapshot))
      return
    }

    if (snapshot.tool === TOOL.EYEDROPPER) {
      event.preventDefault()
      this.focus()
      void this.sampleTileAt(this.cellFromPointerEvent(event, snapshot))
      return
    }

    if (snapshot.tool === TOOL.FILL) {
      event.preventDefault()
      this.focus()
      void this.fillTiles()
      return
    }

    if (snapshot.tool === TOOL.PASTE) {
      event.preventDefault()
      this.focus()
      const cell = this.pasteCellFromPointerEvent(event, snapshot)
      this.pastePreviewCell = cell
      void this.pasteClipboardAt(cell)
    }
  }

  onCanvasMouseMove(event) {
    if (this.selectionTool.drag) {
      const snapshot = this.requireSnapshot()
      this.selectionTool.update(this.cellFromPointerEvent(event, snapshot))
      this.draw()
      return
    }

    if (this.brushDragCells) {
      const snapshot = this.requireSnapshot()
      this.addBrushDragCell(this.cellFromPointerEvent(event, snapshot))
      return
    }

    if (this.eraseDragCells) {
      const snapshot = this.requireSnapshot()
      this.addEraseDragCell(this.cellFromPointerEvent(event, snapshot))
      return
    }

    const snapshot = this.requireSnapshot()
    if (!this.hasLoadedMap(snapshot)) return
    if (snapshot.tool === TOOL.PASTE && this.clipboard) {
      this.pastePreviewCell = this.pasteCellFromPointerEvent(event, snapshot)
      this.draw()
    }
  }

  onCanvasMouseUp(event) {
    if (!this.hasLoadedMap(this.snapshot)) return
    if (this.selectionTool.drag) {
      const snapshot = this.requireSnapshot()
      const result = this.selectionTool.finish(this.cellFromPointerEvent(event, snapshot))
      this.renderHeaderControls(snapshot)
      this.draw()
      this.setStatus(result.status, 'info')
      return
    }

    if (this.brushDragCells) {
      const snapshot = this.requireSnapshot()
      this.addBrushDragCell(this.cellFromPointerEvent(event, snapshot))
      void this.finishBrushGesture(snapshot)
      return
    }

    if (this.eraseDragCells) {
      const snapshot = this.requireSnapshot()
      this.addEraseDragCell(this.cellFromPointerEvent(event, snapshot))
      void this.finishEraseGesture(snapshot)
    }
  }

  addBrushDragCell(cell) {
    assert(this.brushDragCells instanceof Map, 'view-tilemap brush drag cells must be Map')
    assert(this.brushChanges instanceof Map, 'view-tilemap brush changes must be Map')
    if (this.selectionTool.selectedCells.size > 0 && !this.selectionTool.containsCell(cell)) return
    const layerIndex = this.brushLayerIndex()
    if (!Number.isInteger(layerIndex)) return
    this.brushDragCells.set(this.selectionTool.key(cell.x, cell.y), cell)
    const changed = this.state.paintCellLive(layerIndex, cell, this.requireSnapshot().activeTile, this.brushChanges)
    if (!changed) return
    this.snapshot = validateSnapshot(this.state.snapshot())
    this.setData(this.snapshot, { autoFit: false })
  }

  async finishBrushGesture(_snapshot) {
    assert(this.brushDragCells instanceof Map, 'view-tilemap finish brush requires active brush gesture')
    assert(this.brushChanges instanceof Map, 'view-tilemap finish brush requires active brush changes')
    const draggedCellCount = this.brushDragCells.size
    const changed = this.state.commitPaintChanges(this.brushChanges)
    this.brushDragCells = null
    this.brushChanges = null
    if (!changed) {
      this.setStatus(draggedCellCount === 0 ? 'Nothing painted outside active selection' : 'Nothing painted', 'info')
      return
    }
    await this.refreshSnapshot('Tiles painted')
  }

  brushLayerIndex() {
    if (this.selectedLayerIndexes.size === 0) return null
    return Math.max(...this.selectedLayerIndexes)
  }

  async fillTiles() {
    const layerIndex = this.brushLayerIndex()
    if (!Number.isInteger(layerIndex)) {
      this.setStatus('Select a layer before filling', 'info')
      return
    }
    const snapshot = this.requireSnapshot()
    const cells = this.selectionTool.selectedCells.size > 0 ? this.selectionTool.cells() : this.allTilemapCells(snapshot)
    const changed = this.state.fillCells(layerIndex, cells, snapshot.activeTile)
    if (!changed) {
      this.setStatus('Nothing filled', 'info')
      return
    }
    await this.refreshSnapshot('Tiles filled')
  }

  allTilemapCells(snapshot) {
    const cells = []
    for (let y = 0; y < snapshot.height; y++) {
      for (let x = 0; x < snapshot.width; x++) cells.push({ x, y })
    }
    return cells
  }

  addEraseDragCell(cell) {
    assert(this.eraseDragCells instanceof Map, 'view-tilemap erase drag cells must be Map')
    assert(this.eraseChanges instanceof Map, 'view-tilemap erase changes must be Map')
    if (this.selectionTool.selectedCells.size > 0 && !this.selectionTool.containsCell(cell)) return
    this.eraseDragCells.set(this.selectionTool.key(cell.x, cell.y), cell)
    const changed = this.state.eraseCellLive(this.eraseLayerIndexes(this.requireSnapshot()), cell, this.eraseChanges)
    if (!changed) return
    this.snapshot = validateSnapshot(this.state.snapshot())
    this.setData(this.snapshot, { autoFit: false })
  }

  async finishEraseGesture(_snapshot) {
    assert(this.eraseDragCells instanceof Map, 'view-tilemap finish erase requires active erase gesture')
    assert(this.eraseChanges instanceof Map, 'view-tilemap finish erase requires active erase changes')
    const draggedCellCount = this.eraseDragCells.size
    const changed = this.state.commitEraseChanges(this.eraseChanges)
    this.eraseDragCells = null
    this.eraseChanges = null
    if (!changed) {
      this.setStatus(draggedCellCount === 0 ? 'Nothing erased outside active selection' : 'Nothing erased', 'info')
      return
    }
    await this.refreshSnapshot('Tiles erased')
  }

  eraseLayerIndexes(_snapshot) {
    return [...this.selectedLayerIndexes].filter((index) => Number.isInteger(index) && index >= 0).sort((a, b) => a - b)
  }

  drawPastePreview(ctx, snapshot) {
    if (snapshot.tool !== TOOL.PASTE || !this.clipboard || !this.pastePreviewCell) return
    ctx.save()
    ctx.globalAlpha = PASTE_PREVIEW_ALPHA
    for (const entry of this.clipboard.entries) {
      for (const tile of entry.tiles) {
        if (tile.tile === 0) continue
        const tileset = this.tilemapRender.findTileset(tile.tile)
        if (!tileset) continue
        tileset.drawTile(
          ctx,
          tile.tile,
          (this.pastePreviewCell.x + tile.dx) * this.tilemapRender.tileWidth,
          (this.pastePreviewCell.y + tile.dy) * this.tilemapRender.tileHeight,
          this.tilemapRender.tileWidth,
          this.tilemapRender.tileHeight,
        )
      }
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = SELECT_COLORS.ACTIVE_BORDER
    ctx.lineWidth = 2 / this.scale
    ctx.strokeRect(
      this.pastePreviewCell.x * this.tilemapRender.tileWidth,
      this.pastePreviewCell.y * this.tilemapRender.tileHeight,
      this.clipboard.width * this.tilemapRender.tileWidth,
      this.clipboard.height * this.tilemapRender.tileHeight,
    )
    ctx.restore()
  }

  pasteCellFromPointerEvent(event, snapshot) {
    assert(this.clipboard, 'view-tilemap paste pointer requires clipboard')
    const point = this.getWorldPoint(event.clientX, event.clientY)
    const x = Math.floor(point.x / this.tilemapRender.tileWidth)
    const y = Math.floor(point.y / this.tilemapRender.tileHeight)
    return {
      x: Math.max(1 - this.clipboard.width, Math.min(snapshot.width - 1, x)),
      y: Math.max(1 - this.clipboard.height, Math.min(snapshot.height - 1, y)),
    }
  }

  cellFromPointerEvent(event, snapshot) {
    const point = this.getWorldPoint(event.clientX, event.clientY)
    return {
      x: Math.max(0, Math.min(snapshot.width - 1, Math.floor(point.x / this.tilemapRender.tileWidth))),
      y: Math.max(0, Math.min(snapshot.height - 1, Math.floor(point.y / this.tilemapRender.tileHeight))),
    }
  }

  createLayerButton(action, icon, next) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.action = action
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

const DEFAULT_TILE_WIDTH = 16
const DEFAULT_TILE_HEIGHT = 16
const DEFAULT_LAYER_COLORS = ['#7aa2ff', '#3ddc97', '#ffcc66', '#ff5c7a', '#5bd6ff']

class TilemapRender {
  constructor({ tileWidth = DEFAULT_TILE_WIDTH, tileHeight = DEFAULT_TILE_HEIGHT, layerColors = DEFAULT_LAYER_COLORS } = {}) {
    assert(Number.isInteger(tileWidth) && tileWidth > 0, 'tilemap render tileWidth must be positive integer')
    assert(Number.isInteger(tileHeight) && tileHeight > 0, 'tilemap render tileHeight must be positive integer')
    assert(Array.isArray(layerColors) && layerColors.length > 0, 'tilemap render layerColors must be non-empty array')
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    this.layerColors = layerColors
    this.tilesets = [TilemapTileset.createDefault()]
  }

  setTilesets(tilesets) {
    assert(Array.isArray(tilesets), 'tilemap render tilesets must be array')
    this.tilesets = tilesets.length > 0 ? tilesets : [TilemapTileset.createDefault()]
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
      const layerAlpha = selectedLayerIndexes.size === 0 || selectedLayerIndexes.has(layer.index) ? 1 : 0.24
      ctx.globalAlpha = layerAlpha
      const inset = 0
      for (let tileIndex = 0; tileIndex < layer.data.length; tileIndex++) {
        const tile = layer.data[tileIndex]
        if (tile === 0) continue
        const x = tileIndex % layer.width
        const y = Math.floor(tileIndex / layer.width)
        if (x >= snapshot.width || y >= snapshot.height) continue
        this.drawTile(ctx, tile, layer, x * this.tileWidth, y * this.tileHeight, inset)
      }
    }
    ctx.globalAlpha = 1
  }

  drawTile(ctx, tile, _layer, dx, dy, _inset) {
    const tileset = this.findTileset(tile)
    assert(tileset, `tilemap render missing tileset for tile ${tile}`)
    tileset.drawTile(ctx, tile, dx, dy, this.tileWidth, this.tileHeight)
  }

  findTileset(tile) {
    return this.tilesets.find((tileset) => tileset.containsTile(tile)) || null
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
    for (const layer of snapshot.layers) {
      assert(Number.isInteger(layer.index), 'tilemap render layer.index must be integer')
      assert(Number.isInteger(layer.width) && layer.width > 0, 'tilemap render layer.width must be positive integer')
      assert(Array.isArray(layer.data), 'tilemap render layer.data must be array')
    }
  }
}

class TilesetRender {
  draw(canvas, tileset, activeTile, highlightedTiles = new Set()) {
    assert(canvas instanceof HTMLCanvasElement, 'tileset render requires canvas')
    this.validateTileset(tileset)
    assert(activeTile === null || Number.isInteger(activeTile), 'tileset render activeTile must be integer or null')
    assert(highlightedTiles instanceof Set, 'tileset render highlightedTiles must be Set')

    const ctx = canvas.getContext('2d')
    assert(ctx, 'tileset render canvas requires 2d context')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#222'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#888'
    ctx.fillStyle = '#ddd'
    ctx.font = '10px monospace'

    if (tileset.canvas) {
      ctx.drawImage(tileset.canvas, 0, 0)
    }

    for (let tileOffset = 0; tileOffset < tileset.tileCount; tileOffset++) {
      const tile = tileset.firstTileId + tileOffset
      const x = tileOffset % tileset.columns
      const y = Math.floor(tileOffset / tileset.columns)
      const px = x * tileset.tileWidth
      const py = y * tileset.tileHeight
      if (tileset.colorOnly) {
        ctx.fillStyle = '#111'
        ctx.fillText(String(tile), px + 2, py + 11)
      }
      ctx.strokeStyle = '#888'
      ctx.strokeRect(px + 0.5, py + 0.5, tileset.tileWidth, tileset.tileHeight)
      if ((Number.isInteger(activeTile) && tile === activeTile) || highlightedTiles.has(tile)) this.drawActiveTile(ctx, px, py, tileset)
    }
  }

  tileFromPointerEvent(event, tileset) {
    assert(event.currentTarget instanceof HTMLCanvasElement, 'tileset render pointer event requires canvas currentTarget')
    this.validateTileset(tileset)
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) / tileset.tileWidth)
    const y = Math.floor((event.clientY - rect.top) / tileset.tileHeight)
    assert(x >= 0 && x < tileset.columns && y >= 0 && y < tileset.rows, 'tileset render pointer outside tileset bounds')
    const tileOffset = y * tileset.columns + x
    assert(tileOffset < tileset.tileCount, 'tileset render pointer outside available tiles')
    return tileset.firstTileId + tileOffset
  }

  containsTile(tileset, tile) {
    this.validateTileset(tileset)
    assert(Number.isInteger(tile), 'tileset render tile must be integer')
    return tileset.containsTile(tile)
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
    assert(Number.isInteger(tileset.tileCount) && tileset.tileCount > 0, 'tileset render tileset.tileCount must be positive integer')
  }
}

if (!customElements.get('view-tilemap')) {
  customElements.define('view-tilemap', ViewTilemap)
}
