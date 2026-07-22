import { runtime, unwrap } from "/core/runtime.js"
import { decode as decodeQoi } from "/util/qoi/decode.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseOrigin(config) {
  const origin = config.origin
  if (origin === undefined) return [0, 0]
  assert(
    Array.isArray(origin) && origin.length === 2,
    "sprite renderer config.origin must be [x, y]",
  )
  for (const [index, value] of origin.entries()) {
    assert(
      Number.isFinite(value) && value >= 0 && value <= 1,
      `sprite renderer config.origin[${index}] must be between 0 and 1`,
    )
  }
  return [...origin]
}

function extension(path) {
  const name = path.split("/").pop()
  assert(name, "sprite renderer URL must contain filename")
  const parts = name.split(".")
  return parts.length > 1 ? parts.pop().toLowerCase() : ""
}

function mimeType(path) {
  const ext = extension(path)
  if (ext === "png") return "image/png"
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  if (ext === "webp") return "image/webp"
  if (ext === "gif") return "image/gif"
  if (ext === "bmp") return "image/bmp"
  throw new Error(`sprite renderer unsupported image extension: ${ext}`)
}

function createCanvasFromQoi(bytes) {
  const decoded = decodeQoi(bytes.buffer, bytes.byteOffset, bytes.byteLength, 4)
  const pixels = new Uint8ClampedArray(
    decoded.data.buffer,
    decoded.data.byteOffset,
    decoded.data.byteLength,
  )
  const canvas = document.createElement("canvas")
  canvas.width = decoded.width
  canvas.height = decoded.height
  const ctx = canvas.getContext("2d")
  assert(ctx, "sprite renderer QOI requires 2d context")
  ctx.putImageData(new ImageData(pixels, decoded.width, decoded.height), 0, 0)
  return canvas
}

async function loadImage(path) {
  const bytes = new Uint8Array(
    unwrap(await runtime.invoke("fs/fs::read-file", path)),
  )
  const source =
    extension(path) === "qoi"
      ? createCanvasFromQoi(bytes)
      : await createImageBitmap(new Blob([bytes], { type: mimeType(path) }))
  assert(
    Number.isFinite(source.width) && source.width > 0,
    `sprite renderer image ${path} must have positive width`,
  )
  assert(
    Number.isFinite(source.height) && source.height > 0,
    `sprite renderer image ${path} must have positive height`,
  )
  return source
}

function hasUrl(object) {
  return Object.hasOwn(object.props, "url")
}

function objectUrl(object) {
  const url = object.props.url
  assert(
    typeof url === "string" && url.length > 0,
    "sprite renderer url property must be non-empty string",
  )
  return url
}

function dimensionsFromProps(object, label) {
  const hasWidth = Object.hasOwn(object.props, "width")
  const hasHeight = Object.hasOwn(object.props, "height")
  assert(
    hasWidth === hasHeight,
    `${label} width and height properties must be provided together`,
  )
  if (!hasWidth) return null
  const width = Number(object.props.width)
  const height = Number(object.props.height)
  assert(
    Number.isFinite(width) && width > 0,
    `${label} requires positive numeric width property`,
  )
  assert(
    Number.isFinite(height) && height > 0,
    `${label} requires positive numeric height property`,
  )
  return { width, height }
}

function imageData(object, source) {
  const dimensions = dimensionsFromProps(object, "sprite image")
  return {
    source,
    width: dimensions ? dimensions.width : source.width,
    height: dimensions ? dimensions.height : source.height,
  }
}

function rectangleData(object) {
  const dimensions = dimensionsFromProps(object, "sprite rectangle")
  assert(dimensions, "sprite rectangle requires width and height properties")
  const { width, height } = dimensions
  const color = object.props.color
  assert(
    typeof color === "string" && color.length > 0,
    "sprite rectangle requires non-empty color property",
  )
  assert(
    CSS.supports("color", color),
    `sprite rectangle color is invalid: ${color}`,
  )
  return { width, height, color }
}

function closeSource(source) {
  if (source instanceof ImageBitmap) source.close()
}

export function createWorldObjectRenderer({ config }) {
  assert(
    config && typeof config === "object" && !Array.isArray(config),
    "sprite renderer config must be an object",
  )
  const origin = parseOrigin(config)
  const sources = new Map()

  return {
    async prepare(objects) {
      assert(Array.isArray(objects), "sprite renderer objects must be array")
      const requiredUrls = new Set()
      for (const object of objects) {
        if (hasUrl(object)) requiredUrls.add(objectUrl(object))
        else rectangleData(object)
      }

      const loaded = new Map()
      try {
        for (const url of requiredUrls) {
          if (!sources.has(url)) loaded.set(url, await loadImage(url))
        }
      } catch (error) {
        for (const source of loaded.values()) closeSource(source)
        throw error
      }

      for (const [url, source] of sources) {
        if (requiredUrls.has(url)) continue
        closeSource(source)
        sources.delete(url)
      }
      for (const [url, source] of loaded) sources.set(url, source)
      for (const object of objects) {
        if (!hasUrl(object)) continue
        const url = objectUrl(object)
        const source = sources.get(url)
        assert(source, `sprite renderer image not prepared: ${url}`)
        imageData(object, source)
      }
    },

    draw(ctx, object, frame) {
      assert(
        ctx instanceof CanvasRenderingContext2D,
        "sprite renderer requires 2d context",
      )
      assert(
        frame && Number.isFinite(frame.scale) && frame.scale > 0,
        "sprite renderer frame.scale must be positive",
      )
      if (hasUrl(object)) {
        const url = objectUrl(object)
        const source = sources.get(url)
        assert(source, `sprite renderer image not prepared: ${url}`)
        const image = imageData(object, source)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(
          image.source,
          -image.width * origin[0],
          -image.height * origin[1],
          image.width,
          image.height,
        )
        return
      }

      const rectangle = rectangleData(object)
      const x = -rectangle.width * origin[0]
      const y = -rectangle.height * origin[1]
      ctx.fillStyle = rectangle.color
      ctx.fillRect(x, y, rectangle.width, rectangle.height)
      ctx.strokeStyle = "rgba(255,255,255,0.9)"
      ctx.lineWidth = 1 / frame.scale
      ctx.strokeRect(x, y, rectangle.width, rectangle.height)
    },

    bounds(object) {
      if (hasUrl(object)) {
        const url = objectUrl(object)
        const source = sources.get(url)
        assert(source, `sprite renderer image not prepared: ${url}`)
        const image = imageData(object, source)
        const minX = -image.width * origin[0]
        const minY = -image.height * origin[1]
        return {
          minX,
          minY,
          maxX: minX + image.width,
          maxY: minY + image.height,
        }
      }
      const rectangle = rectangleData(object)
      const minX = -rectangle.width * origin[0]
      const minY = -rectangle.height * origin[1]
      return {
        minX,
        minY,
        maxX: minX + rectangle.width,
        maxY: minY + rectangle.height,
      }
    },

    dispose() {
      for (const source of sources.values()) closeSource(source)
      sources.clear()
    },
  }
}
