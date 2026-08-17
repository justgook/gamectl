import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(
  new URL("../world-renderers/tilemap.js", import.meta.url),
  "utf8",
)
const worldSource = await readFile(
  new URL("../views/view-world.js", import.meta.url),
  "utf8",
)
const calls = []
class FakeCanvasRenderingContext2D {
  constructor() {
    this.drawCalls = []
    this.imageSmoothingEnabled = true
  }

  drawImage(...args) {
    this.drawCalls.push(args)
  }
}
globalThis.CanvasRenderingContext2D = FakeCanvasRenderingContext2D
globalThis.__loadTilemapRaster = async (path, options) => {
  calls.push({ path, options })
  return { canvas: {}, width: 64, height: 32 }
}
const moduleSource = source.replace(
  'import { loadTilemapRaster } from "/util/tilemap-render.js"',
  "const loadTilemapRaster = globalThis.__loadTilemapRaster",
)
const { createWorldObjectRenderer } = await import(
  `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`
)

function object(tilemap, { layer, repeat } = {}) {
  const props = { tilemap }
  if (layer !== undefined) props.layer = layer
  if (repeat !== undefined) props.repeat = repeat
  return { x: 0, y: 0, props }
}

test.beforeEach(() => calls.splice(0))

test("view-world passes object-local viewport bounds to renderers", () => {
  assert.match(worldSource, /viewport: \{/)
  assert.match(worldSource, /minX: viewport\.minX - anchor\.x/)
  assert.match(worldSource, /maxY: viewport\.maxY - anchor\.y/)
})

test("tilemap renderer renders all layers when layer is omitted", async () => {
  const renderer = createWorldObjectRenderer({ config: {} })
  await renderer.prepare([object("maps/level.tilemap.json")])

  assert.deepEqual(calls, [
    {
      path: "maps/level.tilemap.json",
      options: { layer: undefined },
    },
  ])
  assert.deepEqual(renderer.bounds(object("maps/level.tilemap.json")), {
    minX: -0,
    minY: -0,
    maxX: 64,
    maxY: 32,
  })
})

test("tilemap renderer caches each one-based layer separately", async () => {
  const renderer = createWorldObjectRenderer({ config: {} })
  await renderer.prepare([
    object("maps/level.tilemap.json", { layer: 1 }),
    object("maps/level.tilemap.json", { layer: 2 }),
  ])
  await renderer.prepare([
    object("maps/level.tilemap.json", { layer: 2 }),
  ])

  assert.deepEqual(calls, [
    { path: "maps/level.tilemap.json", options: { layer: 1 } },
    { path: "maps/level.tilemap.json", options: { layer: 2 } },
  ])
  assert.deepEqual(
    renderer.bounds(object("maps/level.tilemap.json", { layer: 2 })),
    { minX: -0, minY: -0, maxX: 64, maxY: 32 },
  )
  assert.throws(
    () =>
      renderer.bounds(object("maps/level.tilemap.json", { layer: 1 })),
    /raster not prepared/,
  )
})

test("tilemap renderer rejects invalid layer values", async () => {
  const renderer = createWorldObjectRenderer({ config: {} })

  await assert.rejects(
    renderer.prepare([object("maps/level.tilemap.json", { layer: 0 })]),
    /layer must be a positive integer/,
  )
  await assert.rejects(
    renderer.prepare([object("maps/level.tilemap.json", { layer: "1" })]),
    /layer must be a positive integer/,
  )
})

test("tilemap renderer repeats enabled axes across the viewport", async () => {
  const renderer = createWorldObjectRenderer({
    config: { origin: [0.5, 0.5] },
  })
  const repeated = object("maps/level.tilemap.json", { repeat: [1, 0] })
  await renderer.prepare([repeated])

  assert.deepEqual(renderer.bounds(repeated), {
    minX: -32,
    minY: -16,
    maxX: 32,
    maxY: 16,
  })

  const ctx = new FakeCanvasRenderingContext2D()
  renderer.draw(ctx, repeated, {
    scale: 1,
    viewport: { minX: -100, minY: -60, maxX: 100, maxY: 60 },
  })
  assert.equal(ctx.imageSmoothingEnabled, false)
  assert.deepEqual(
    ctx.drawCalls.map(([, x, y]) => [x, y]),
    [
      [-160, -16],
      [-96, -16],
      [-32, -16],
      [32, -16],
      [96, -16],
    ],
  )
})

test("tilemap renderer rejects invalid repeat flags", async () => {
  const renderer = createWorldObjectRenderer({ config: {} })
  await renderer.prepare([object("maps/level.tilemap.json")])

  for (const repeat of [[1], [-1, 0], [2, 0], ["1", 0]]) {
    const invalid = object("maps/level.tilemap.json", { repeat })
    assert.throws(() => renderer.bounds(invalid), /tilemap renderer repeat/)
  }
})
