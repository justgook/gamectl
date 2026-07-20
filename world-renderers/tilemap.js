import { loadTilemapRaster } from "/util/tilemap-render.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
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
      ctx.drawImage(raster.canvas, 0, 0)
    },

    bounds(object) {
      const path = tilemapPath(object)
      const raster = rasters.get(path)
      assert(raster, `tilemap renderer raster not prepared: ${path}`)
      return { minX: 0, minY: 0, maxX: raster.width, maxY: raster.height }
    },

    dispose() {
      rasters.clear()
    },
  }
}
