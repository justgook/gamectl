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

function tilemapPath(object) {
  const path = object.props.tilemap
  assert(
    typeof path === "string" && path.length > 0,
    "tilemap renderer requires non-empty tilemap property",
  )
  return path
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
      const requiredPaths = new Set(objects.map(tilemapPath))
      const loaded = new Map()
      for (const path of requiredPaths) {
        if (!rasters.has(path)) loaded.set(path, await loadTilemapRaster(path))
      }
      for (const path of rasters.keys()) {
        if (!requiredPaths.has(path)) rasters.delete(path)
      }
      for (const [path, raster] of loaded) rasters.set(path, raster)
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
      const path = tilemapPath(object)
      const raster = rasters.get(path)
      assert(raster, `tilemap renderer raster not prepared: ${path}`)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(
        raster.canvas,
        -raster.width * origin[0],
        -raster.height * origin[1],
      )
    },

    bounds(object) {
      const path = tilemapPath(object)
      const raster = rasters.get(path)
      assert(raster, `tilemap renderer raster not prepared: ${path}`)
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
