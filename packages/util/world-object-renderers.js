import { require } from "/util/require.js"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function validateRendererInstance(id, renderer) {
  assert(
    isPlainObject(renderer),
    `world object renderer ${id} factory must return an object`,
  )
  for (const method of ["prepare", "draw", "bounds", "dispose"]) {
    assert(
      typeof renderer[method] === "function",
      `world object renderer ${id} must implement ${method}()`,
    )
  }
  return renderer
}

function validateBounds(id, bounds) {
  assert(
    isPlainObject(bounds),
    `world object renderer ${id} bounds must be an object`,
  )
  for (const field of ["minX", "minY", "maxX", "maxY"]) {
    assert(
      Number.isFinite(bounds[field]),
      `world object renderer ${id} bounds.${field} must be finite`,
    )
  }
  assert(
    bounds.maxX > bounds.minX,
    `world object renderer ${id} bounds must have positive width`,
  )
  assert(
    bounds.maxY > bounds.minY,
    `world object renderer ${id} bounds must have positive height`,
  )
  return bounds
}

function validateRendererConfig(config) {
  assert(isPlainObject(config), "view-world config must be an object")
  assert(
    isPlainObject(config.renderers),
    "view-world config.renderers must be an object map",
  )
  return Object.entries(config.renderers).map(([id, descriptor]) => {
    assert(id.length > 0, "world object renderer id must be non-empty")
    assert(
      isPlainObject(descriptor),
      `world object renderer ${id} config must be an object`,
    )
    assert(
      typeof descriptor.url === "string" && descriptor.url.length > 0,
      `world object renderer ${id}.url must be non-empty string`,
    )
    assert(
      isPlainObject(descriptor.match),
      `world object renderer ${id}.match must be an object`,
    )
    const matcher = Object.entries(descriptor.match)
    assert(
      matcher.length > 0,
      `world object renderer ${id}.match must not be empty`,
    )
    for (const [property, value] of matcher) {
      assert(
        property.length > 0,
        `world object renderer ${id}.match property must be non-empty`,
      )
      assert(
        typeof value === "string",
        `world object renderer ${id}.match.${property} must be string`,
      )
    }
    assert(
      isPlainObject(descriptor.config),
      `world object renderer ${id}.config must be an object`,
    )
    return {
      id,
      url: descriptor.url,
      matcher,
      config: descriptor.config,
    }
  })
}

export class WorldObjectRendererRegistry {
  static async create(config, fallbackRenderer) {
    const descriptors = validateRendererConfig(config)
    const fallback = validateRendererInstance("point", fallbackRenderer)
    const records = await Promise.all(
      descriptors.map(async (descriptor) => {
        const module = await require(descriptor.url)
        assert(
          typeof module.createWorldObjectRenderer === "function",
          `world object renderer ${descriptor.id} module must export createWorldObjectRenderer()`,
        )
        const renderer = validateRendererInstance(
          descriptor.id,
          module.createWorldObjectRenderer({ config: descriptor.config }),
        )
        return { ...descriptor, renderer }
      }),
    )
    return new WorldObjectRendererRegistry(records, fallback)
  }

  constructor(records, fallbackRenderer) {
    assert(
      Array.isArray(records),
      "world object renderer records must be array",
    )
    this.records = records
    this.fallbackRenderer = fallbackRenderer
  }

  matches(record, object) {
    return record.matcher.every(
      ([property, value]) => object.props[property] === value,
    )
  }

  recordForObject(object) {
    const matches = this.records.filter((record) =>
      this.matches(record, object),
    )
    assert(
      matches.length <= 1,
      `world object ${this.objectLabel(object)} matches multiple renderers: ${matches
        .map((record) => record.id)
        .join(", ")}`,
    )
    return matches.length === 1 ? matches[0] : null
  }

  rendererForObject(object) {
    const record = this.recordForObject(object)
    return record
      ? { id: record.id, renderer: record.renderer }
      : { id: "point", renderer: this.fallbackRenderer }
  }

  async prepare(objects) {
    assert(
      Array.isArray(objects),
      "world renderer prepare objects must be array",
    )
    const matching = new Map(this.records.map((record) => [record.id, []]))
    const fallbackObjects = []
    for (const object of objects) {
      const record = this.recordForObject(object)
      if (record) matching.get(record.id).push(object)
      else fallbackObjects.push(object)
    }
    await Promise.all([
      this.fallbackRenderer.prepare(fallbackObjects),
      ...this.records.map((record) =>
        record.renderer.prepare(matching.get(record.id)),
      ),
    ])
  }

  draw(ctx, object, frame) {
    assert(
      ctx instanceof CanvasRenderingContext2D,
      "world renderer draw requires 2d context",
    )
    const { renderer } = this.rendererForObject(object)
    ctx.save()
    ctx.translate(object.x, object.y)
    try {
      renderer.draw(ctx, object, frame)
    } finally {
      ctx.restore()
    }
  }

  bounds(object) {
    const { id, renderer } = this.rendererForObject(object)
    return validateBounds(id, renderer.bounds(object))
  }

  dispose() {
    this.fallbackRenderer.dispose()
    for (const record of this.records) record.renderer.dispose()
    this.records = []
  }

  objectLabel(object) {
    return (
      object.props.name || object.props.id || `at (${object.x}, ${object.y})`
    )
  }
}
