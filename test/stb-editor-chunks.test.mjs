import assert from 'node:assert/strict'
import test from 'node:test'

import {
  STB_EDITOR_CHUNK_SIZE,
  applyChunkTilemapSnapshot,
  buildChunkTilemapSnapshot,
  buildChunkedTilemapProjection,
  createLogicalTilemap,
  deleteLogicalLayer,
  getChunkBounds,
  getChunkGrid,
  insertLogicalLayer,
  moveLogicalLayer,
  resizeLogicalTilemap
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
  assert.equal(projection.chunks[3].layers[0][(1 * 44) + 4], 11)
})
