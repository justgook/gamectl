function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseOrigin(config) {
  const origin = config.origin
  if (origin === undefined) return [0, 0]
  assert(
    Array.isArray(origin) && origin.length === 2,
    "rectangle renderer config.origin must be [x, y]",
  )
  for (const [index, value] of origin.entries()) {
    assert(
      Number.isFinite(value) && value >= 0 && value <= 1,
      `rectangle renderer config.origin[${index}] must be between 0 and 1`,
    )
  }
  return [...origin]
}

function rectangleData(object) {
  const width = Number(object.props.width)
  const height = Number(object.props.height)
  const color = object.props.color
  assert(
    Number.isFinite(width) && width > 0,
    "rectangle renderer requires positive numeric width property",
  )
  assert(
    Number.isFinite(height) && height > 0,
    "rectangle renderer requires positive numeric height property",
  )
  assert(
    typeof color === "string" && color.length > 0,
    "rectangle renderer requires non-empty color property",
  )
  assert(
    CSS.supports("color", color),
    `rectangle renderer color is invalid: ${color}`,
  )
  return { width, height, color }
}

export function createWorldObjectRenderer({ config }) {
  assert(
    config && typeof config === "object" && !Array.isArray(config),
    "rectangle renderer config must be an object",
  )

  const origin = parseOrigin(config)

  return {
    async prepare(objects) {
      assert(Array.isArray(objects), "rectangle renderer objects must be array")
      for (const object of objects) rectangleData(object)
    },

    draw(ctx, object, frame) {
      assert(
        ctx instanceof CanvasRenderingContext2D,
        "rectangle renderer requires 2d context",
      )
      assert(
        frame && Number.isFinite(frame.scale) && frame.scale > 0,
        "rectangle renderer frame.scale must be positive",
      )
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

    dispose() {},
  }
}
