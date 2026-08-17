import { loadTilemapRaster } from "/util/tilemap-render.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseOrigin(config) {
  const origin = config.origin
  if (origin === undefined) return [0, 0]
  assert(
    Array.isArray(origin) && origin.length === 2,
    "tilemap renderer config.origin must be [x, y]",
  )
  for (const [index, value] of origin.entries()) {
    assert(
      Number.isFinite(value) && value >= 0 && value <= 1,
      `tilemap renderer config.origin[${index}] must be between 0 and 1`,
    )
  }
  return [...origin]
}

function parseRepeat(object) {
  const repeat = object.props.repeat
  if (repeat === undefined) return [0, 0]
  assert(
    Array.isArray(repeat) && repeat.length === 2,
    "tilemap renderer repeat must be [x, y]",
  )
  for (const [index, value] of repeat.entries()) {
    assert(
      value === 0 || value === 1,
      `tilemap renderer repeat[${index}] must be 0 or 1`,
    )
  }
  return repeat
}

function tilemapSource(object) {
  const path = object.props.tilemap
  assert(
    typeof path === "string" && path.length > 0,
    "tilemap renderer requires non-empty tilemap property",
  )
  const layer = object.props.layer
  assert(
    layer === undefined || (Number.isInteger(layer) && layer > 0),
    "tilemap renderer layer must be a positive integer",
  )
  return { path, layer, key: JSON.stringify([path, layer ?? null]) }
}

export function createWorldObjectRenderer({ config }) {
  assert(
    config && typeof config === "object" && !Array.isArray(config),
    "tilemap renderer config must be an object",
  )
  const origin = parseOrigin(config)
  const rasters = new Map()

  return {
    async prepare(objects) {
      assert(Array.isArray(objects), "tilemap renderer objects must be array")
      const requiredSources = new Map(
        objects.map((object) => {
          const source = tilemapSource(object)
          parseRepeat(object)
          return [source.key, source]
        }),
      )
      const loaded = new Map()
      for (const [key, source] of requiredSources) {
        if (!rasters.has(key)) {
          loaded.set(
            key,
            await loadTilemapRaster(source.path, { layer: source.layer }),
          )
        }
      }
      for (const key of rasters.keys()) {
        if (!requiredSources.has(key)) rasters.delete(key)
      }
      for (const [key, raster] of loaded) rasters.set(key, raster)
    },

    draw(ctx, object, frame) {
      assert(
        ctx instanceof CanvasRenderingContext2D,
        "tilemap renderer requires 2d context",
      )
      assert(
        frame && Number.isFinite(frame.scale) && frame.scale > 0,
        "tilemap renderer frame.scale must be positive",
      )
      const source = tilemapSource(object)
      const raster = rasters.get(source.key)
      assert(raster, `tilemap renderer raster not prepared: ${source.path}`)
      const repeat = parseRepeat(object)
      const minX = -raster.width * origin[0]
      const minY = -raster.height * origin[1]
      const viewport = frame.viewport
      assert(
        viewport && typeof viewport === "object" && !Array.isArray(viewport),
        "tilemap renderer frame.viewport must be an object",
      )
      for (const field of ["minX", "minY", "maxX", "maxY"]) {
        assert(
          Number.isFinite(viewport[field]),
          `tilemap renderer frame.viewport.${field} must be finite`,
        )
      }
      const firstX = repeat[0]
        ? Math.floor((viewport.minX - minX) / raster.width)
        : 0
      const lastX = repeat[0]
        ? Math.floor((viewport.maxX - minX) / raster.width)
        : 0
      const firstY = repeat[1]
        ? Math.floor((viewport.minY - minY) / raster.height)
        : 0
      const lastY = repeat[1]
        ? Math.floor((viewport.maxY - minY) / raster.height)
        : 0
      ctx.imageSmoothingEnabled = false
      for (let y = firstY; y <= lastY; y++) {
        for (let x = firstX; x <= lastX; x++) {
          ctx.drawImage(
            raster.canvas,
            minX + x * raster.width,
            minY + y * raster.height,
          )
        }
      }
    },

    bounds(object) {
      const source = tilemapSource(object)
      const raster = rasters.get(source.key)
      assert(raster, `tilemap renderer raster not prepared: ${source.path}`)
      parseRepeat(object)
      const minX = -raster.width * origin[0]
      const minY = -raster.height * origin[1]
      return {
        minX,
        minY,
        maxX: minX + raster.width,
        maxY: minY + raster.height,
      }
    },

    dispose() {
      rasters.clear()
    },
  }
}
