import { runtime, unwrap } from "/core/runtime.js"
import { decode as decodeQoi } from "/util/qoi/decode.js"

export const DEFAULT_TILE_SIZE = 16

const GENERATED_TILESET_PALETTE = [
  "#e6194b",
  "#3cb44b",
  "#ffe119",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#bcf60c",
  "#fabebe",
  "#008080",
  "#e6beff",
  "#9a6324",
  "#fffac8",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#808080",
  "#ffffff",
  "#000000",
  "#a9a9ff",
  "#ff7f50",
]

const DEFAULT_COLOR_TILESET_SPEC = {
  name: "colors",
  path: "generated:colors",
  columns: 16,
  firstTileId: 1,
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function normalizeStringProps(input, label) {
  if (input == null) return {}
  assert(
    input && typeof input === "object" && !Array.isArray(input),
    `${label} must be an object`,
  )
  const props = {}
  for (const [key, value] of Object.entries(input)) {
    props[String(key)] = String(value ?? "")
  }
  return props
}

function parsePositiveInt(value, label) {
  const parsed = Number.parseInt(String(value), 10)
  assert(
    Number.isInteger(parsed) && parsed > 0,
    `${label} must be positive integer`,
  )
  return parsed
}

function tilesetNameFromPath(path) {
  const clean = String(path).split("?")[0]
  const file = clean.slice(clean.lastIndexOf("/") + 1)
  return file.replace(/\.[^.]+$/, "") || "tileset"
}

export function parseTilemapData(data) {
  assert(
    typeof data === "string" && data.length > 0,
    "tilemap data must be non-empty string",
  )
  const input = JSON.parse(data)
  assert(
    input && typeof input === "object" && !Array.isArray(input),
    "tilemap file data must be object JSON",
  )
  assert(Array.isArray(input.layers), "tilemap data.layers must be array")
  assert(input.layers.length > 0, "tilemap must contain at least one layer")

  const layers = input.layers.map((layer, index) => {
    assert(
      layer && typeof layer === "object" && !Array.isArray(layer),
      `tilemap layer ${index} must be object`,
    )
    assert(
      Number.isInteger(layer.width) && layer.width > 0,
      `tilemap layer ${index}.width must be positive integer`,
    )
    assert(
      Array.isArray(layer.data),
      `tilemap layer ${index}.data must be array`,
    )
    const values = layer.data.map((tile, tileIndex) => {
      const value = Number(tile)
      assert(
        Number.isInteger(value),
        `tilemap layer ${index}.data[${tileIndex}] must be integer-like`,
      )
      return value
    })
    return {
      index,
      width: layer.width,
      data: values,
      props: normalizeStringProps(layer.props, `tilemap layer ${index}.props`),
    }
  })

  const width = Math.max(...layers.map((layer) => layer.width))
  const height = Math.max(
    ...layers.map((layer) => Math.ceil(layer.data.length / layer.width)),
  )
  assert(width > 0, "tilemap width must be positive")
  assert(height > 0, "tilemap height must be positive")
  return {
    width,
    height,
    props: normalizeStringProps(input.props, "tilemap props"),
    layers,
  }
}

export function tileSizeForTilemap(tilemap) {
  return parsePositiveInt(
    tilemap.props.tileSize ?? DEFAULT_TILE_SIZE,
    "tilemap tile size",
  )
}

export function maxTileId(tilemap) {
  let maximum = 0
  for (const layer of tilemap.layers) {
    for (const tile of layer.data) {
      if (tile > maximum) maximum = tile
    }
  }
  return maximum
}

export function collectTilesetSpecs(tilemap) {
  const value = tilemap.props.tilesets
  if (typeof value !== "string" || value.length === 0) return []
  const parsed = JSON.parse(value)
  assert(Array.isArray(parsed), "tilemap props.tilesets must be JSON array")
  return parsed.map((entry, index) => {
    assert(
      entry && typeof entry === "object" && !Array.isArray(entry),
      `tilemap tileset ${index} must be object`,
    )
    const path = String(entry.file ?? entry.path ?? entry.url ?? "")
    assert(path.length > 0, `tilemap tileset ${index} requires file`)
    const name = String(entry.name || tilesetNameFromPath(path))
    const count =
      entry.count == null
        ? 0
        : parsePositiveInt(entry.count, `tilemap tileset ${index} count`)
    return { name, path, count }
  })
}

export class TilemapTileset {
  constructor({
    name,
    path,
    tileWidth,
    tileHeight,
    firstTileId,
    columns,
    rows,
    tileCount = columns * rows,
    width,
    height,
    pixels = null,
    canvas = null,
    colorOnly = false,
  }) {
    assert(
      typeof name === "string" && name.length > 0,
      "tileset name must be non-empty string",
    )
    assert(
      typeof path === "string" && path.length > 0,
      "tileset path must be non-empty string",
    )
    assert(
      Number.isInteger(tileWidth) && tileWidth > 0,
      "tileset tileWidth must be positive integer",
    )
    assert(
      Number.isInteger(tileHeight) && tileHeight > 0,
      "tileset tileHeight must be positive integer",
    )
    assert(Number.isInteger(firstTileId), "tileset firstTileId must be integer")
    assert(
      Number.isInteger(columns) && columns > 0,
      "tileset columns must be positive integer",
    )
    assert(
      Number.isInteger(rows) && rows > 0,
      "tileset rows must be positive integer",
    )
    assert(
      Number.isInteger(tileCount) &&
        tileCount > 0 &&
        tileCount <= columns * rows,
      "tileset tileCount must fit tileset grid",
    )
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
    return TilemapTileset.createGenerated({ firstTileId: 1, tileCount: 1 })
  }

  static createGenerated({
    firstTileId,
    tileCount = firstTileId,
    tileWidth = DEFAULT_TILE_SIZE,
    tileHeight = DEFAULT_TILE_SIZE,
  }) {
    assert(
      Number.isInteger(firstTileId) && firstTileId > 0,
      "generated tileset first tile id must be positive integer",
    )
    assert(
      Number.isInteger(tileCount) && tileCount > 0,
      "generated tileset tile count must be positive integer",
    )
    assert(
      Number.isInteger(tileWidth) && tileWidth > 0,
      "generated tileset tile width must be positive integer",
    )
    assert(
      Number.isInteger(tileHeight) && tileHeight > 0,
      "generated tileset tile height must be positive integer",
    )
    const columns = TilemapTileset.generatedColumnCount(tileCount)
    const rows = tileCount / columns
    const width = columns * tileWidth
    const height = rows * tileHeight
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    assert(ctx, "generated tileset requires 2d context")
    for (let offset = 0; offset < tileCount; offset++) {
      const tile = firstTileId + offset
      const x = offset % columns
      const y = Math.floor(offset / columns)
      TilemapTileset.drawGeneratedTile(
        ctx,
        tile,
        x * tileWidth,
        y * tileHeight,
        tileWidth,
        tileHeight,
      )
    }
    const image = ctx.getImageData(0, 0, width, height)
    return new TilemapTileset({
      ...DEFAULT_COLOR_TILESET_SPEC,
      tileWidth,
      tileHeight,
      firstTileId,
      columns,
      rows,
      tileCount,
      width,
      height,
      pixels: new Uint8ClampedArray(image.data),
      canvas,
      colorOnly: true,
    })
  }

  static generatedColumnCount(count) {
    for (
      let columns = Math.min(DEFAULT_COLOR_TILESET_SPEC.columns, count);
      columns > 1;
      columns--
    ) {
      if (count % columns === 0) return columns
    }
    return count
  }

  static drawGeneratedTile(ctx, tile, x, y, width, height) {
    const primary =
      GENERATED_TILESET_PALETTE[(tile - 1) % GENERATED_TILESET_PALETTE.length]
    const secondary =
      GENERATED_TILESET_PALETTE[
        Math.floor((tile - 1) / GENERATED_TILESET_PALETTE.length) %
          GENERATED_TILESET_PALETTE.length
      ]
    const pattern = Math.floor((tile - 1) / GENERATED_TILESET_PALETTE.length)
    ctx.fillStyle = primary
    ctx.fillRect(x, y, width, height)
    if (pattern > 0) {
      ctx.fillStyle = secondary
      const halfWidth = Math.ceil(width / 2)
      const halfHeight = Math.ceil(height / 2)
      if (pattern % 4 === 1) ctx.fillRect(x, y, halfWidth, height)
      else if (pattern % 4 === 2) ctx.fillRect(x, y, width, halfHeight)
      else if (pattern % 4 === 3) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + width, y)
        ctx.lineTo(x, y + height)
        ctx.closePath()
        ctx.fill()
      } else ctx.fillRect(x + 3, y + 3, width - 6, height - 6)
    }
    ctx.strokeStyle = "rgba(0,0,0,0.35)"
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1)
    ctx.fillStyle = "rgba(255,255,255,0.22)"
    ctx.fillRect(x + 1, y + 1, width - 2, 2)
  }

  static async load(spec, firstTileId) {
    const bytes = new Uint8Array(
      unwrap(await runtime.invoke("fs/fs::read-file", spec.path)),
    )
    const decoded = decodeQoi(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
      4,
    )
    const pixels = new Uint8ClampedArray(
      decoded.data.buffer,
      decoded.data.byteOffset,
      decoded.data.byteLength,
    )
    const columns = Math.floor(decoded.width / spec.tileWidth)
    const imageRows = Math.floor(decoded.height / spec.tileHeight)
    assert(
      columns > 0 && imageRows > 0,
      `tileset ${spec.name} image is smaller than tile size`,
    )
    const tileCount = spec.count > 0 ? spec.count : columns * imageRows
    assert(
      tileCount <= columns * imageRows,
      `tileset ${spec.name} tile count exceeds image`,
    )
    const rows = Math.ceil(tileCount / columns)
    const canvas = document.createElement("canvas")
    canvas.width = decoded.width
    canvas.height = decoded.height
    const ctx = canvas.getContext("2d")
    assert(ctx, "tileset QOI canvas requires 2d context")
    ctx.putImageData(new ImageData(pixels, decoded.width, decoded.height), 0, 0)
    return new TilemapTileset({
      ...spec,
      firstTileId,
      columns,
      rows,
      tileCount,
      width: decoded.width,
      height: decoded.height,
      pixels,
      canvas,
    })
  }

  containsTile(tile) {
    return tile >= this.firstTileId && tile < this.firstTileId + this.tileCount
  }

  drawTile(ctx, tile, dx, dy, width, height) {
    assert(
      ctx instanceof CanvasRenderingContext2D,
      "tileset drawTile requires 2d context",
    )
    assert(this.containsTile(tile), `tileset ${this.name} missing tile ${tile}`)
    assert(
      this.canvas instanceof HTMLCanvasElement,
      `tileset ${this.name} missing render canvas`,
    )
    const localTile = tile - this.firstTileId
    const sx = (localTile % this.columns) * this.tileWidth
    const sy = Math.floor(localTile / this.columns) * this.tileHeight
    ctx.drawImage(
      this.canvas,
      sx,
      sy,
      this.tileWidth,
      this.tileHeight,
      dx,
      dy,
      width,
      height,
    )
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

export async function createTilemapTilesets(tilemap) {
  const specs = collectTilesetSpecs(tilemap)
  const maximum = maxTileId(tilemap)
  const tileSize = tileSizeForTilemap(tilemap)
  if (specs.length === 0) {
    return [
      TilemapTileset.createGenerated({
        firstTileId: 1,
        tileCount: Math.max(1, maximum),
        tileWidth: tileSize,
        tileHeight: tileSize,
      }),
    ]
  }

  let firstTileId = 1
  const tilesets = []
  for (const spec of specs) {
    const tileset = await TilemapTileset.load(
      { ...spec, tileWidth: tileSize, tileHeight: tileSize },
      firstTileId,
    )
    tilesets.push(tileset)
    firstTileId += tileset.tileCount
  }
  if (maximum >= firstTileId) {
    tilesets.push(
      TilemapTileset.createGenerated({
        firstTileId,
        tileCount: maximum - firstTileId + 1,
        tileWidth: tileSize,
        tileHeight: tileSize,
      }),
    )
  }
  return tilesets
}

export class TilemapRasterizer {
  constructor({
    tileWidth = DEFAULT_TILE_SIZE,
    tileHeight = DEFAULT_TILE_SIZE,
    tilesets = [TilemapTileset.createDefault()],
  } = {}) {
    assert(
      Number.isInteger(tileWidth) && tileWidth > 0,
      "tilemap rasterizer tileWidth must be positive integer",
    )
    assert(
      Number.isInteger(tileHeight) && tileHeight > 0,
      "tilemap rasterizer tileHeight must be positive integer",
    )
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    this.setTilesets(tilesets)
  }

  setTilesets(tilesets) {
    assert(Array.isArray(tilesets), "tilemap rasterizer tilesets must be array")
    this.tilesets =
      tilesets.length > 0 ? tilesets : [TilemapTileset.createDefault()]
  }

  findTileset(tile) {
    return this.tilesets.find((tileset) => tileset.containsTile(tile)) || null
  }

  bounds(tilemap) {
    this.validate(tilemap)
    return {
      minX: 0,
      minY: 0,
      maxX: tilemap.width * this.tileWidth,
      maxY: tilemap.height * this.tileHeight,
    }
  }

  draw(ctx, tilemap, { layerAlpha = () => 1 } = {}) {
    assert(
      ctx instanceof CanvasRenderingContext2D,
      "tilemap rasterizer requires 2d context",
    )
    assert(typeof layerAlpha === "function", "layerAlpha must be function")
    this.validate(tilemap)
    for (const layer of tilemap.layers) {
      if (layer.hidden === true) continue
      ctx.globalAlpha = layerAlpha(layer)
      for (let tileIndex = 0; tileIndex < layer.data.length; tileIndex++) {
        const tile = layer.data[tileIndex]
        if (tile === 0) continue
        const x = tileIndex % layer.width
        const y = Math.floor(tileIndex / layer.width)
        if (x >= tilemap.width || y >= tilemap.height) continue
        const tileset = this.findTileset(tile)
        assert(tileset, `tilemap rasterizer missing tileset for tile ${tile}`)
        tileset.drawTile(
          ctx,
          tile,
          x * this.tileWidth,
          y * this.tileHeight,
          this.tileWidth,
          this.tileHeight,
        )
      }
    }
    ctx.globalAlpha = 1
  }

  validate(tilemap) {
    assert(
      tilemap && typeof tilemap === "object" && !Array.isArray(tilemap),
      "tilemap rasterizer data must be object",
    )
    assert(
      Number.isInteger(tilemap.width) && tilemap.width > 0,
      "tilemap rasterizer width must be positive integer",
    )
    assert(
      Number.isInteger(tilemap.height) && tilemap.height > 0,
      "tilemap rasterizer height must be positive integer",
    )
    assert(Array.isArray(tilemap.layers), "tilemap rasterizer layers required")
  }
}

export async function loadTilemapRaster(path) {
  assert(
    typeof path === "string" && path.length > 0,
    "tilemap raster path must be non-empty string",
  )
  const data = unwrap(await runtime.invoke("fs/fs::read-text", path))
  const tilemap = parseTilemapData(data)
  const tilesets = await createTilemapTilesets(tilemap)
  const tileSize = tileSizeForTilemap(tilemap)
  const rasterizer = new TilemapRasterizer({
    tileWidth: tileSize,
    tileHeight: tileSize,
    tilesets,
  })
  const bounds = rasterizer.bounds(tilemap)
  const canvas = document.createElement("canvas")
  canvas.width = bounds.maxX
  canvas.height = bounds.maxY
  const ctx = canvas.getContext("2d")
  assert(ctx, "tilemap raster requires 2d context")
  ctx.imageSmoothingEnabled = false
  rasterizer.draw(ctx, tilemap)
  return { canvas, width: canvas.width, height: canvas.height }
}
