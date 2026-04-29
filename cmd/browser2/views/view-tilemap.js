import { runtime } from '../core/runtime.js'
import { parseCSVLines } from '../util/csv.js'
import { UndoHistory } from '../util/undo.js'
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

const textDecoder = new TextDecoder()

function decodeOutput(result) {
  return textDecoder.decode(result.output || new Uint8Array())
}

function quoteSqlValue(value) {
  return `'${String(value).replace(/'/g, "''")}'`
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
    this.path = 'maps/mock.tilemap.json'
    this.name = 'mock'
    this.width = 32
    this.height = 24
    this.props = {}
    this.layers = [
      { index: 0, name: 'Layer 0', hidden: false, locked: false, width: 32, data: [] },
      { index: 1, name: 'Layer 1', hidden: false, locked: false, width: 32, data: [] },
      { index: 2, name: 'Layer 2', hidden: false, locked: false, width: 32, data: [] },
    ]
    this.activeLayer = 0
    this.tool = TOOL.BRUSH
    this.activeTile = 1
    this.dirty = false
    this.history = new UndoHistory()
    this.hasClipboard = false
  }

  create({ path, width, height, layers }) {
    this.path = path
    this.name = String(path)
    this.width = width
    this.height = height
    this.props = {}
    this.layers = Array.from({ length: layers }, (_item, index) => ({
      index,
      name: `Layer ${index}`,
      hidden: false,
      locked: false,
      width,
      data: new Array(width * height).fill(0),
    }))
    this.activeLayer = layers > 0 ? 0 : -1
    this.dirty = false
    this.resetHistory()
    return { handle: this.handle }
  }

  open({ name, data }) {
    assert(typeof name === 'string' && name.length > 0, 'tilemap state open requires tilemap name')
    assert(typeof data === 'string' && data.length > 0, 'tilemap state open requires tilemap data')
    this.loadTilemapData(name, data)
    this.dirty = false
    this.resetHistory()
    return { handle: this.handle }
  }

  save({ path }) {
    this.path = path
    this.dirty = false
  }

  loadTilemapData(name, data) {
    const tilemap = JSON.parse(data)
    assert(tilemap && typeof tilemap === 'object' && !Array.isArray(tilemap), 'tilemap storage data must be object JSON')
    assert(Array.isArray(tilemap.layers), 'tilemap storage data.layers must be array')
    assert(tilemap.layers.length > 0, 'tilemap storage must contain at least one layer')

    const layers = tilemap.layers.map((layer, index) => this.parseLayer(layer, index))
    const width = Math.max(...layers.map((layer) => layer.width))
    const height = Math.max(...layers.map((layer) => Math.ceil(layer.data.length / layer.width)))
    assert(Number.isInteger(width) && width > 0, 'tilemap storage width must be positive integer')
    assert(Number.isInteger(height) && height > 0, 'tilemap storage height must be positive integer')

    this.name = name
    this.path = `sql:tilemap_storage/${name}`
    this.width = width
    this.height = height
    this.props = tilemap.props && typeof tilemap.props === 'object' && !Array.isArray(tilemap.props) ? { ...tilemap.props } : {}
    this.layers = layers
    this.activeLayer = 0
    this.activeTile = this.findFirstTile(layers)
  }

  parseLayer(layer, index) {
    assert(layer && typeof layer === 'object' && !Array.isArray(layer), `tilemap layer ${index} must be object`)
    assert(Number.isInteger(layer.width) && layer.width > 0, `tilemap layer ${index}.width must be positive integer`)
    assert(Array.isArray(layer.data), `tilemap layer ${index}.data must be array`)
    const props = layer.props && typeof layer.props === 'object' && !Array.isArray(layer.props) ? { ...layer.props } : {}
    const name = typeof props.name === 'string' && props.name.length > 0 ? props.name : `Layer ${index}`
    const readonly = props.readonly === true || props.readonly === 'true'
    return {
      index,
      name,
      hidden: false,
      locked: readonly,
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
      layers: this.layers.map((layer, index) => ({ ...layer, index, data: layer.data.slice() })),
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

  setLayerHidden(layer, hidden) {
    const target = this.requireLayer(layer)
    const previous = target.hidden
    if (previous === hidden) return
    this.executeDirtyCommand(`Set ${target.name} ${hidden ? 'hidden' : 'visible'}`, () => {
      this.requireLayer(layer).hidden = hidden
    }, () => {
      this.requireLayer(layer).hidden = previous
    })
  }

  setLayerLocked(layer, locked) {
    const target = this.requireLayer(layer)
    const previous = target.locked
    if (previous === locked) return
    this.executeDirtyCommand(`Set ${target.name} ${locked ? 'locked' : 'unlocked'}`, () => {
      this.requireLayer(layer).locked = locked
    }, () => {
      this.requireLayer(layer).locked = previous
    })
  }

  insertLayer(index) {
    assert(index >= 0 && index <= this.layers.length, 'tilemap state insert layer index out of range')
    const previousActiveLayer = this.activeLayer
    this.executeDirtyCommand(`Insert layer ${index}`, () => {
      this.layers.splice(index, 0, { index, name: `Layer ${index}`, hidden: false, locked: false, width: this.width, data: new Array(this.width * this.height).fill(0), props: {} })
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
    const deletedLayer = { ...this.requireLayer(index) }
    const previousActiveLayer = this.activeLayer
    this.executeDirtyCommand(`Delete ${deletedLayer.name}`, () => {
      this.layers.splice(index, 1)
      this.renumberLayers()
      if (this.activeLayer === index) this.activeLayer = -1
      else if (this.activeLayer > index) this.activeLayer -= 1
    }, () => {
      this.layers.splice(index, 0, { ...deletedLayer })
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

  cut() {
    const previousClipboard = this.hasClipboard
    this.executeDirtyCommand('Cut selection', () => {
      this.hasClipboard = true
    }, () => {
      this.hasClipboard = previousClipboard
    })
  }

  copy() {
    this.hasClipboard = true
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
      const previousDefaultName = `Layer ${layer.index}`
      layer.index = index
      if (layer.name === previousDefaultName) layer.name = `Layer ${index}`
    })
  }

  requireLayer(index) {
    const layer = this.layers[index]
    assert(layer, `tilemap state missing layer ${index}`)
    return layer
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
    return TilemapTileset.createGenerated(1)
  }

  static createGenerated(maxTileId) {
    assert(Number.isInteger(maxTileId) && maxTileId >= 0, 'generated tileset max tile id must be non-negative integer')
    const count = Math.max(1, maxTileId)
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

    for (let tile = 1; tile <= count; tile++) {
      const localTile = tile - 1
      const x = localTile % columns
      const y = Math.floor(localTile / columns)
      TilemapTileset.drawGeneratedTile(ctx, tile, x * DEFAULT_COLOR_TILESET_SPEC.tileWidth, y * DEFAULT_COLOR_TILESET_SPEC.tileHeight, DEFAULT_COLOR_TILESET_SPEC.tileWidth, DEFAULT_COLOR_TILESET_SPEC.tileHeight)
    }

    const image = ctx.getImageData(0, 0, width, height)
    pixels.set(image.data)
    return new TilemapTileset({ ...DEFAULT_COLOR_TILESET_SPEC, columns, rows, tileCount: count, width, height, pixels, canvas, colorOnly: true })
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
    const result = await runtime.call('fs', 'read', spec.path)
    if (result.returnCode !== 0) throw new Error(decodeOutput(result) || `fs.read failed for tileset ${spec.path}: ${result.returnCode}`)
    const image = TilemapTileset.decodeQoi(result.output)
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
    assert(Number.isInteger(layer.index), 'view-tilemap layer.index must be integer')
    assert(typeof layer.name === 'string', 'view-tilemap layer.name must be string')
    assert(typeof layer.hidden === 'boolean', 'view-tilemap layer.hidden must be boolean')
    assert(typeof layer.locked === 'boolean', 'view-tilemap layer.locked must be boolean')
    assert(Number.isInteger(layer.width) && layer.width > 0, 'view-tilemap layer.width must be positive integer')
    assert(Array.isArray(layer.data), 'view-tilemap layer.data must be array')
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
    this.historyElement = null
    this.tilesetTabsElement = null
    this.tilesetPanelsElement = null
    this.activeTilesetName = ''
    this.tilesets = [TilemapTileset.createDefault()]
    this.tilesetSourceKey = ''
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
        <output data-element="status">Loading tilemap…</output>
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
    assert(this.layersElement instanceof HTMLTableElement, 'view-tilemap missing layers table')
    assert(this.historyElement instanceof HTMLTableElement, 'view-tilemap missing undo history table')
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

    this.historyElement.addEventListener('click', async (event) => {
      const row = event.target.closest('tr[data-history-index]')
      if (!(row instanceof HTMLTableRowElement)) return
      this.state.moveHistoryTo(Number(row.dataset.historyIndex))
      await this.refreshSnapshot('History state selected')
    })

    this.queryHeader('[data-action="open"]').addEventListener('click', async () => this.openTilemap())
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
      await this.refreshSnapshot('Ready', { autoFit: true })
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
      assert(this.snapshot, 'view-tilemap missing snapshot for layer-up')
      this.state.moveLayer(layer, Math.min(this.snapshot.layers.length - 1, layer + 1))
    } else if (action === 'layer-down') {
      this.state.moveLayer(layer, Math.max(0, layer - 1))
    } else {
      throw new Error(`view-tilemap unknown layer action ${action}`)
    }
    await this.refreshSnapshot('Layer updated')
  }

  async openTilemap() {
    const selection = await this.chooseTilemapFromStorage()
    if (selection.cancelled) return
    const tilemap = await this.loadTilemapStorageRecord(selection.name)
    const result = this.state.open(tilemap)
    assert(Number.isInteger(result.handle) && result.handle > 0, 'view-tilemap open returned invalid handle')
    this.handle = result.handle
    this.selectedLayerIndexes.clear()
    await this.refreshSnapshot(`Opened ${tilemap.name}`, { autoFit: true })
  }

  async chooseTilemapFromStorage() {
    const result = await runtime.call('ui.popup', 'open', this.createOpenTilemapPopupOptions())
    const payload = JSON.parse(decodeOutput(result) || 'null')
    if (!payload || payload.cancelled) return { cancelled: true }
    const name = typeof payload.value === 'string' ? payload.value : payload.row.name
    assert(typeof name === 'string' && name.length > 0, 'view-tilemap open requires selected tilemap_storage name')
    return { cancelled: false, name }
  }

  createOpenTilemapPopupOptions() {
    return {
      title: 'Open Tilemap',
      size: 'medium',
      tag: 'view-sql',
      props: {
        mode: 'chooser',
        query: 'SELECT name FROM tilemap_storage ORDER BY name LIMIT :limit OFFSET :offset',
        countQuery: 'SELECT COUNT(*) AS count FROM tilemap_storage',
        returnColumn: 'name',
        confirmLabel: 'Open',
        pageSize: 20,
      },
    }
  }

  async loadTilemapStorageRecord(name) {
    assert(typeof name === 'string' && name.length > 0, 'view-tilemap load requires tilemap_storage name')
    const csv = await this.callSql(`SELECT name, data FROM tilemap_storage WHERE name = ${quoteSqlValue(name)} LIMIT 1`)
    const lines = parseCSVLines(csv.trim())
    assert(lines.length === 2, `tilemap_storage missing selected tilemap ${name}`)
    const headers = lines[0]
    const row = lines[1]
    const nameIndex = headers.indexOf('name')
    const dataIndex = headers.indexOf('data')
    assert(nameIndex >= 0 && dataIndex >= 0, 'tilemap_storage query returned unexpected columns')
    return { name: row[nameIndex], data: row[dataIndex] }
  }

  async callSql(sql) {
    const result = await runtime.call('sql', 'query', sql)
    if (result.returnCode !== 0) {
      throw new Error(decodeOutput(result) || `sql query failed: ${result.returnCode}`)
    }
    return decodeOutput(result)
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

  async refreshSnapshot(statusText, { autoFit = false } = {}) {
    assert(typeof autoFit === 'boolean', 'view-tilemap refreshSnapshot autoFit must be boolean')
    const snapshot = validateSnapshot(this.state.snapshot())
    await this.syncTilesets(snapshot)
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
    if (specs.length === 0) return [TilemapTileset.createGenerated(this.maxTileId(snapshot))]

    let firstTileId = 1
    const tilesets = []
    for (const spec of specs) {
      const tileset = await TilemapTileset.load(spec, firstTileId)
      tilesets.push(tileset)
      firstTileId += tileset.columns * tileset.rows
    }
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

  renderTilesets(activeTile) {
    assert(Number.isInteger(activeTile), 'view-tilemap active tile must be integer')
    assert(this.tilesetTabsElement instanceof HTMLElement, 'view-tilemap missing tileset tabs')
    assert(this.tilesetPanelsElement instanceof HTMLElement, 'view-tilemap missing tileset panels')
    this.tilesetTabsElement.replaceChildren()
    this.tilesetPanelsElement.replaceChildren()

    const tilesets = this.tilesets.length > 0 ? this.tilesets : [TilemapTileset.createDefault()]
    const activeTileset = tilesets.find((tileset) => this.tilesetRender.containsTile(tileset, activeTile))
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
      this.tilesetRender.draw(canvas, tileset, activeTile)

      const status = document.createElement('output')
      status.dataset.element = 'tileset-status'
      status.textContent = this.tilesetStatusText(tileset)
      panel.appendChild(status)

      this.tilesetPanelsElement.appendChild(panel)
    }

    this.activeTilesetName = activeName
  }

  tilesetStatusText(tileset) {
    if (tileset.colorOnly) return `${tileset.path} — generated color tiles; click grid cells to set active tile id`
    return `${tileset.path} — QOI ${tileset.width} × ${tileset.height}; ${tileset.columns} × ${tileset.rows} tiles; click grid cells to set active tile id`
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

    for (const layer of snapshot.layers.toReversed()) {
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
      if (tile === activeTile) this.drawActiveTile(ctx, px, py, tileset)
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
