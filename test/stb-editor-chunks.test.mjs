import assert from 'node:assert/strict'
import test from 'node:test'

import {
  STB_EDITOR_CHUNK_SIZE,
  STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE,
  applyChunkTilemapSnapshot,
  buildChunkTilemapSnapshot,
  buildChunkedTilemapProjection,
  createLogicalTilemap,
  deleteLogicalLayer,
  forEachChunkedProjectionChunk,
  getChunkedTilemapProjectionByteLength,
  getChunkBounds,
  getChunkGrid,
  materializeChunkedProjectionToTilemap,
  insertLogicalLayer,
  moveLogicalLayer,
  readChunkedTilemapProjectionFromMemory,
  resizeLogicalTilemap,
  writeChunkedTilemapProjectionToMemory
} from '../cmd/browser/views/stb-editor-chunks.js'

test('chunk helpers build correct grid and bounds', () => {
  assert.deepEqual(getChunkGrid(512, 300), { cols: 2, rows: 2, count: 4 })
  assert.deepEqual(getChunkBounds(512, 300, 1, 1), {
    chunkX: 1,
    chunkY: 1,
    worldX: STB_EDITOR_CHUNK_SIZE,
    worldY: STB_EDITOR_CHUNK_SIZE,
    width: STB_EDITOR_CHUNK_SIZE,
    height: 44
  })
})

test('chunk snapshot roundtrip preserves logical map cells', () => {
  let tilemap = createLogicalTilemap(300, 260, 2, ['ground', 'detail'])
  tilemap.props.author = 'tester'
  tilemap.layers[1].props.kind = 'detail-layer'
  tilemap.layers[0].data[0] = 7
  tilemap.layers[1].data[(257 * 300) + 260] = 9

  const snapshot = buildChunkTilemapSnapshot(tilemap, 300, 260, 1, 1)
  assert.equal(snapshot.layers[0].width, 44)
  assert.equal(snapshot.layers[1].width, 44)
  assert.equal(snapshot.layers[1].data[(1 * 44) + 4], 9)

  snapshot.layers[0].data[0] = 13
  snapshot.layers[1].data[(1 * 44) + 4] = 17
  snapshot.layers[1].props.name = 'detail-renamed'
  snapshot.layers[1].props.kind = 'detail-renamed-kind'
  tilemap = applyChunkTilemapSnapshot(tilemap, 300, 260, 1, 1, snapshot)

  assert.equal(tilemap.layers[0].data[(256 * 300) + 256], 13)
  assert.equal(tilemap.layers[1].data[(257 * 300) + 260], 17)
  assert.equal(tilemap.layers[0].data[0], 7)
  assert.equal(tilemap.layers[1].props.name, 'detail-renamed')
  assert.equal(tilemap.layers[1].props.kind, 'detail-renamed-kind')
  assert.equal(tilemap.props.author, 'tester')
})

test('logical resize and layer mutations preserve expected structure', () => {
  let tilemap = createLogicalTilemap(20, 10, 2, ['a', 'b'])
  tilemap.layers[0].data[0] = 3
  tilemap.layers[1].data[5] = 4

  tilemap = resizeLogicalTilemap(tilemap, 30, 12)
  assert.equal(tilemap.layers[0].width, 30)
  assert.equal(tilemap.layers[0].data[0], 3)
  assert.equal(tilemap.layers[1].data[5], 4)

  tilemap = insertLogicalLayer(tilemap, 1, 'middle')
  assert.equal(tilemap.layers.length, 3)
  assert.equal(tilemap.layers[1].props.name, 'middle')

  tilemap.layers[2].data[2] = 21
  tilemap = moveLogicalLayer(tilemap, 2, 0)
  assert.equal(tilemap.layers[0].data[2], 21)

  tilemap = deleteLogicalLayer(tilemap, 1)
  assert.equal(tilemap.layers.length, 2)
})

test('chunked projection emits minimal row-major chunk payloads', () => {
  const tilemap = createLogicalTilemap(300, 260, 1, ['base'])
  tilemap.layers[0].data[0] = 5
  tilemap.layers[0].data[(257 * 300) + 260] = 11

  const projection = buildChunkedTilemapProjection(tilemap, 300, 260)
  assert.equal(projection.version, 1)
  assert.equal(projection.mapWidth, 300)
  assert.equal(projection.mapHeight, 260)
  assert.equal(projection.layerCount, 1)
  assert.equal(projection.chunkCount, 4)
  assert.equal(projection.chunks[0].layers[0][0], 5)
  assert.equal(projection.chunks[3].layers[0][(1 * STB_EDITOR_CHUNK_SIZE) + 4], 11)
})

test('chunked projection writes minimal header and contiguous body into wasm memory', () => {
  const tilemap = createLogicalTilemap(300, 260, 2, ['base', 'detail'])
  tilemap.layers[0].data[0] = 5
  tilemap.layers[1].data[(257 * 300) + 260] = 11

  const projection = buildChunkedTilemapProjection(tilemap, 300, 260)
  const required = getChunkedTilemapProjectionByteLength(projection)
  const initialPages = Math.ceil(required / 65536) || 1
  const memory = new WebAssembly.Memory({ initial: initialPages, maximum: initialPages + 1, shared: true })
  const layout = writeChunkedTilemapProjectionToMemory(memory, 0, projection)
  const view = new DataView(memory.buffer, 0, STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE)

  assert.equal(layout.headerPtr, 0)
  assert.equal(layout.bodyPtr, STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE)
  assert.equal(layout.byteLength, required)
  assert.equal(view.getUint32(0, true), 1)
  assert.equal(view.getUint32(4, true), 300)
  assert.equal(view.getUint32(8, true), 260)
  assert.equal(view.getUint32(12, true), 2)
  assert.equal(view.getUint32(16, true), STB_EDITOR_CHUNK_SIZE)
  assert.equal(view.getUint32(20, true), 4)
  assert.equal(view.getUint32(24, true), STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE)

  const body = new Uint16Array(memory.buffer, layout.bodyPtr, (layout.byteLength - layout.bodyPtr) / 2)
  const perLayer = STB_EDITOR_CHUNK_SIZE * STB_EDITOR_CHUNK_SIZE
  const perChunk = perLayer * 2
  assert.equal(body[0], 5)
  assert.equal(body[(3 * perChunk) + perLayer + (1 * STB_EDITOR_CHUNK_SIZE) + 4], 11)

  const decoded = readChunkedTilemapProjectionFromMemory(memory, layout.headerPtr)
  assert.equal(decoded.version, 1)
  assert.equal(decoded.mapWidth, 300)
  assert.equal(decoded.mapHeight, 260)
  assert.equal(decoded.layerCount, 2)
  assert.equal(decoded.chunkSize, STB_EDITOR_CHUNK_SIZE)
  assert.equal(decoded.chunkCount, 4)
  assert.equal(decoded.chunkDataPtr, STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE)
  assert.equal(decoded.chunks[0].layers[0][0], 5)
  assert.equal(decoded.chunks[3].layers[1][(1 * STB_EDITOR_CHUNK_SIZE) + 4], 11)
})

test('host helpers derive chunk positions and materialize flat layers', () => {
  const tilemap = createLogicalTilemap(300, 260, 2, ['base', 'detail'])
  tilemap.layers[0].data[0] = 5
  tilemap.layers[1].data[(257 * 300) + 260] = 11
  tilemap.layers[0].props.tileset = '/tmp/base.qoi'
  tilemap.layers[0].props.tw = '16'
  tilemap.layers[1].props.name = 'detail-layer'
  tilemap.props.tilesets = '[]'
  const projection = buildChunkedTilemapProjection(tilemap, 300, 260)

  const seen = []
  forEachChunkedProjectionChunk(projection, ({ index, bounds }) => {
    seen.push([index, bounds.worldX, bounds.worldY, bounds.width, bounds.height])
  })

  assert.deepEqual(seen, [
    [0, 0, 0, 256, 256],
    [1, 256, 0, 44, 256],
    [2, 0, 256, 256, 4],
    [3, 256, 256, 44, 4]
  ])

  const materialized = materializeChunkedProjectionToTilemap({
    ...projection,
    props: { ...tilemap.props },
    layerProps: tilemap.layers.map((layer) => ({ ...layer.props }))
  })
  assert.equal(materialized.layers.length, 2)
  assert.equal(materialized.layers[0].width, 300)
  assert.equal(materialized.layers[0].data[0], 5)
  assert.equal(materialized.layers[1].data[(257 * 300) + 260], 11)
  assert.equal(materialized.layers[0].props.tileset, '/tmp/base.qoi')
  assert.equal(materialized.layers[1].props.name, 'detail-layer')
  assert.equal(materialized.props.tilesets, '[]')
  assert.equal(materialized.props.chunked, '1')
})
