import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const wasmPath = path.resolve(__dirname, '../build.nosync/plugins/stbte.wasm')

const TOOL_BRUSH = 1
const TOOL_ERASE = 2
const TOOL_EYEDROPPER = 3
const TOOL_PASTE = 4

const TILE_BACKGROUND = 99
const TILE_GROUND = 10
const TILE_LAYER1 = 11
const TILE_LAYER2 = 12

async function createRuntime({ width = 4, height = 4, layers = 3, maxTiles = 32 } = {}) {
  const bytes = await readFile(wasmPath)
  const memory = new WebAssembly.Memory({
    initial: 288,
    maximum: 512,
    shared: true
  })
  const { instance } = await WebAssembly.instantiate(bytes, { env: { memory } })
  instance.exports._initialize?.()

  const runtime = {
    memory,
    exports: instance.exports,
    offsets: loadOffsets(instance.exports),
    tilemap: 0,
    indices: {
      background: 0,
      ground: 1,
      layer1Only: 2,
      layer2Only: 3
    }
  }

  runtime.tilemap = runtime.exports.stbte_create(width, height, layers, 0, 0, maxTiles)
  assert.notEqual(runtime.tilemap, 0, 'expected stbte_create to return a pointer')

  runtime.exports.stbte_define_tile(runtime.tilemap, TILE_BACKGROUND, 0b11111111, 0)
  runtime.exports.stbte_define_tile(runtime.tilemap, TILE_GROUND, 0b11111111, 0)
  runtime.exports.stbte_define_tile(runtime.tilemap, TILE_LAYER1, 0b010, 0)
  runtime.exports.stbte_define_tile(runtime.tilemap, TILE_LAYER2, 0b100, 0)
  runtime.exports.stbte_set_background_tile(runtime.tilemap, TILE_BACKGROUND)

  return runtime
}

function loadOffsets(exports) {
  return {
    tmMaxX: exports.stbte_offset_tilemap_max_x(),
    tmMaxY: exports.stbte_offset_tilemap_max_y(),
    tmNumLayers: exports.stbte_offset_tilemap_num_layers(),
    tmCurTile: exports.stbte_offset_tilemap_cur_tile(),
    tmCurLayer: exports.stbte_offset_tilemap_cur_layer(),
    tmSoloLayer: exports.stbte_offset_tilemap_solo_layer(),
    tmNumTiles: exports.stbte_offset_tilemap_num_tiles(),
    tmUndoAvailable: exports.stbte_offset_tilemap_undo_available(),
    tmRedoAvailable: exports.stbte_offset_tilemap_redo_available(),
    tmLayerinfo: exports.stbte_offset_tilemap_layerinfo(),
    tmTiles: exports.stbte_offset_tilemap_tiles(),
    layerHidden: exports.stbte_offset_layer_hidden(),
    layerLocked: exports.stbte_offset_layer_locked(),
    tileinfoLayermask: exports.stbte_offset_tileinfo_layermask(),
    uiHasSelection: exports.stbte_offset_ui_has_selection(),
    uiHasCopy: exports.stbte_offset_ui_has_copy(),
    uiCopyWidth: exports.stbte_offset_ui_copy_width(),
    uiCopyHeight: exports.stbte_offset_ui_copy_height(),
    sizeofLayer: exports.stbte_sizeof_layer(),
    sizeofTileinfo: exports.stbte_sizeof_tileinfo(),
    uiPtr: exports.stbte_ui_ptr()
  }
}

function i32(runtime, ptr, offset) {
  return new DataView(runtime.memory.buffer, ptr + offset, 4).getInt32(0, true)
}

function i8(runtime, ptr, offset) {
  return new DataView(runtime.memory.buffer, ptr + offset, 1).getInt8(0)
}

function u32(runtime, ptr, offset) {
  return new DataView(runtime.memory.buffer, ptr + offset, 4).getUint32(0, true)
}

function tileAt(runtime, x, y, layer) {
  return runtime.exports.stbte_get_tile_id(runtime.tilemap, x, y, layer)
}

function tilemapState(runtime) {
  return {
    width: i32(runtime, runtime.tilemap, runtime.offsets.tmMaxX),
    height: i32(runtime, runtime.tilemap, runtime.offsets.tmMaxY),
    numLayers: i32(runtime, runtime.tilemap, runtime.offsets.tmNumLayers),
    numTiles: i32(runtime, runtime.tilemap, runtime.offsets.tmNumTiles),
    curTile: i32(runtime, runtime.tilemap, runtime.offsets.tmCurTile),
    curLayer: i32(runtime, runtime.tilemap, runtime.offsets.tmCurLayer),
    soloLayer: i32(runtime, runtime.tilemap, runtime.offsets.tmSoloLayer),
    undoAvailable: i8(runtime, runtime.tilemap, runtime.offsets.tmUndoAvailable),
    redoAvailable: i8(runtime, runtime.tilemap, runtime.offsets.tmRedoAvailable)
  }
}

function uiState(runtime) {
  return {
    hasSelection: i32(runtime, runtime.offsets.uiPtr, runtime.offsets.uiHasSelection),
    hasCopy: i32(runtime, runtime.offsets.uiPtr, runtime.offsets.uiHasCopy),
    copyWidth: i32(runtime, runtime.offsets.uiPtr, runtime.offsets.uiCopyWidth),
    copyHeight: i32(runtime, runtime.offsets.uiPtr, runtime.offsets.uiCopyHeight)
  }
}

function layerState(runtime, index) {
  const ptr = runtime.tilemap + runtime.offsets.tmLayerinfo + (index * runtime.offsets.sizeofLayer)
  return {
    hidden: i32(runtime, ptr, runtime.offsets.layerHidden),
    locked: i32(runtime, ptr, runtime.offsets.layerLocked)
  }
}

function tileLayermask(runtime, tileIndex) {
  const tilesPtr = u32(runtime, runtime.tilemap, runtime.offsets.tmTiles)
  const ptr = tilesPtr + (tileIndex * runtime.offsets.sizeofTileinfo)
  return u32(runtime, ptr, runtime.offsets.tileinfoLayermask)
}

function setBrush(runtime, tileIndex, layer) {
  runtime.exports.stbte_set_tool(runtime.tilemap, TOOL_BRUSH)
  runtime.exports.stbte_set_active_tile(runtime.tilemap, tileIndex)
  runtime.exports.stbte_set_active_layer(runtime.tilemap, layer)
}

function paint(runtime, layer, tileIndex, x0, y0, x1 = x0, y1 = y0) {
  setBrush(runtime, tileIndex, layer)
  runtime.exports.stbte_apply(runtime.tilemap, x0, y0, x1, y1)
}

function erase(runtime, layer, x0, y0, x1 = x0, y1 = y0) {
  runtime.exports.stbte_set_tool(runtime.tilemap, TOOL_ERASE)
  runtime.exports.stbte_set_active_layer(runtime.tilemap, layer)
  runtime.exports.stbte_apply(runtime.tilemap, x0, y0, x1, y1)
}

test('stbte wasm headless functional coverage', async (t) => {
  await t.test('create, define, brush, erase, and clamp', async () => {
    const runtime = await createRuntime()

    assert.deepEqual(tilemapState(runtime), {
      width: 4,
      height: 4,
      numLayers: 3,
      numTiles: 4,
      curTile: 0,
      curLayer: 0,
      soloLayer: -1,
      undoAvailable: 0,
      redoAvailable: 0
    })

    paint(runtime, 0, runtime.indices.ground, 1, 1)
    assert.equal(tileAt(runtime, 1, 1, 0), TILE_GROUND)

    paint(runtime, 1, runtime.indices.layer1Only, 1, 1)
    assert.equal(tileAt(runtime, 1, 1, 1), TILE_LAYER1)
    assert.equal(tileAt(runtime, 1, 1, 2), -1)

    erase(runtime, 0, 1, 1)
    assert.equal(tileAt(runtime, 1, 1, 0), TILE_BACKGROUND)

    paint(runtime, 1, runtime.indices.layer1Only, -10, -10)
    assert.equal(tileAt(runtime, 0, 0, 1), TILE_LAYER1)
  })

  await t.test('selection, copy, paste, undo, and redo', async () => {
    const runtime = await createRuntime()

    paint(runtime, 1, runtime.indices.layer1Only, 0, 0, 1, 1)
    runtime.exports.stbte_set_selection(runtime.tilemap, 0, 0, 1, 1)
    runtime.exports.stbte_copy(runtime.tilemap)

    assert.deepEqual(uiState(runtime), {
      hasSelection: 1,
      hasCopy: 1,
      copyWidth: 2,
      copyHeight: 2
    })

    runtime.exports.stbte_set_tool(runtime.tilemap, TOOL_PASTE)
    runtime.exports.stbte_set_active_layer(runtime.tilemap, 1)
    runtime.exports.stbte_apply(runtime.tilemap, 3, 3, 3, 3)
    assert.equal(tileAt(runtime, 2, 2, 1), TILE_LAYER1)
    assert.equal(tileAt(runtime, 3, 3, 1), TILE_LAYER1)
    assert.equal(tilemapState(runtime).undoAvailable, 1)

    runtime.exports.stbte_undo(runtime.tilemap)
    assert.equal(tileAt(runtime, 2, 2, 1), -1)
    assert.equal(tileAt(runtime, 3, 3, 1), -1)
    assert.equal(tilemapState(runtime).redoAvailable, 1)

    runtime.exports.stbte_redo(runtime.tilemap)
    assert.equal(tileAt(runtime, 2, 2, 1), TILE_LAYER1)
    assert.equal(tileAt(runtime, 3, 3, 1), TILE_LAYER1)

    runtime.exports.stbte_set_tool(runtime.tilemap, TOOL_EYEDROPPER)
    runtime.exports.stbte_set_active_layer(runtime.tilemap, 1)
    runtime.exports.stbte_apply(runtime.tilemap, 0, 0, 0, 0)
    assert.equal(tilemapState(runtime).curTile, runtime.indices.layer1Only)
  })

  await t.test('hidden, locked, current layer, and solo layer behavior', async () => {
    const runtime = await createRuntime()

    runtime.exports.stbte_set_layer_hidden(runtime.tilemap, 1, 1)
    paint(runtime, 1, runtime.indices.layer1Only, 0, 0)
    assert.equal(tileAt(runtime, 0, 0, 1), -1)

    runtime.exports.stbte_set_layer_hidden(runtime.tilemap, 1, 0)
    runtime.exports.stbte_set_layer_locked(runtime.tilemap, 1, 1)
    paint(runtime, 1, runtime.indices.layer1Only, 0, 0)
    assert.equal(tileAt(runtime, 0, 0, 1), -1)

    runtime.exports.stbte_set_layer_locked(runtime.tilemap, 1, 0)
    paint(runtime, 1, runtime.indices.layer1Only, 0, 0)
    assert.equal(tileAt(runtime, 0, 0, 1), TILE_LAYER1)

    runtime.exports.stbte_set_layer_hidden(runtime.tilemap, 1, 1)
    runtime.exports.stbte_set_layer_locked(runtime.tilemap, 1, 1)
    runtime.exports.stbte_set_solo_layer(runtime.tilemap, 1)
    paint(runtime, 0, runtime.indices.layer1Only, 1, 0)
    assert.equal(tileAt(runtime, 1, 0, 1), TILE_LAYER1)
  })

  await t.test('insert layer shifts data, flags, and layer masks', async () => {
    const runtime = await createRuntime()

    paint(runtime, 1, runtime.indices.layer1Only, 1, 1)
    runtime.exports.stbte_set_layer_hidden(runtime.tilemap, 1, 1)
    runtime.exports.stbte_set_active_layer(runtime.tilemap, 1)
    runtime.exports.stbte_set_solo_layer(runtime.tilemap, 1)
    runtime.exports.stbte_set_selection(runtime.tilemap, 0, 0, 1, 1)
    runtime.exports.stbte_copy(runtime.tilemap)
    paint(runtime, 1, runtime.indices.layer1Only, 2, 2)

    assert.equal(runtime.exports.stbte_insert_layer(runtime.tilemap, 1), 1)
    assert.equal(tilemapState(runtime).numLayers, 4)
    assert.equal(tileAt(runtime, 1, 1, 1), -1)
    assert.equal(tileAt(runtime, 1, 1, 2), TILE_LAYER1)
    assert.deepEqual(layerState(runtime, 1), { hidden: 0, locked: 0 })
    assert.deepEqual(layerState(runtime, 2), { hidden: 1, locked: 0 })
    assert.equal(tilemapState(runtime).curLayer, 2)
    assert.equal(tilemapState(runtime).soloLayer, 2)
    assert.equal(tileLayermask(runtime, runtime.indices.layer1Only), 0b100)
    assert.deepEqual(uiState(runtime), {
      hasSelection: 0,
      hasCopy: 0,
      copyWidth: 0,
      copyHeight: 0
    })
    assert.equal(tilemapState(runtime).undoAvailable, 0)
  })

  await t.test('delete layer shifts data, flags, and layer masks', async () => {
    const runtime = await createRuntime()

    paint(runtime, 1, runtime.indices.layer1Only, 1, 1)
    paint(runtime, 2, runtime.indices.layer2Only, 1, 1)
    runtime.exports.stbte_set_layer_hidden(runtime.tilemap, 2, 1)
    runtime.exports.stbte_set_active_layer(runtime.tilemap, 2)
    runtime.exports.stbte_set_solo_layer(runtime.tilemap, 2)
    runtime.exports.stbte_set_selection(runtime.tilemap, 0, 0, 1, 1)
    runtime.exports.stbte_copy(runtime.tilemap)

    assert.equal(runtime.exports.stbte_delete_layer(runtime.tilemap, 1), 1)
    assert.equal(tilemapState(runtime).numLayers, 2)
    assert.equal(tileAt(runtime, 1, 1, 1), TILE_LAYER2)
    assert.deepEqual(layerState(runtime, 1), { hidden: 1, locked: 0 })
    assert.equal(tilemapState(runtime).curLayer, 1)
    assert.equal(tilemapState(runtime).soloLayer, 1)
    assert.equal(tileLayermask(runtime, runtime.indices.layer2Only), 0b10)
    assert.equal(uiState(runtime).hasCopy, 0)
  })

  await t.test('move layer reorders data, flags, and layer masks', async () => {
    const runtime = await createRuntime()

    paint(runtime, 2, runtime.indices.layer2Only, 2, 1)
    runtime.exports.stbte_set_layer_hidden(runtime.tilemap, 2, 1)
    runtime.exports.stbte_set_active_layer(runtime.tilemap, 2)
    runtime.exports.stbte_set_solo_layer(runtime.tilemap, 2)
    runtime.exports.stbte_set_selection(runtime.tilemap, 0, 0, 0, 0)
    runtime.exports.stbte_copy(runtime.tilemap)

    assert.equal(runtime.exports.stbte_move_layer(runtime.tilemap, 2, 0), 1)
    assert.equal(tileAt(runtime, 2, 1, 0), TILE_LAYER2)
    assert.deepEqual(layerState(runtime, 0), { hidden: 1, locked: 0 })
    assert.equal(tilemapState(runtime).curLayer, 0)
    assert.equal(tilemapState(runtime).soloLayer, 0)
    assert.equal(tileLayermask(runtime, runtime.indices.layer2Only), 0b001)
    assert.equal(uiState(runtime).hasSelection, 0)
  })

  await t.test('background layer structural ops at index 0 preserve serialized layer data', async () => {
    const runtime = await createRuntime({ width: 2, height: 2 })

    paint(runtime, 0, runtime.indices.ground, 0, 0)
    assert.equal(runtime.exports.stbte_insert_layer(runtime.tilemap, 0), 1)
    assert.equal(tileAt(runtime, 0, 0, 0), TILE_BACKGROUND)
    assert.equal(tileAt(runtime, 0, 0, 1), TILE_GROUND)
    assert.equal(tileAt(runtime, 1, 1, 1), TILE_BACKGROUND)

    assert.equal(runtime.exports.stbte_move_layer(runtime.tilemap, 0, 2), 1)
    assert.equal(tileAt(runtime, 1, 1, 2), TILE_BACKGROUND)
    assert.equal(tileAt(runtime, 1, 1, 0), TILE_BACKGROUND)

    assert.equal(runtime.exports.stbte_delete_layer(runtime.tilemap, 0), 1)
    assert.equal(tilemapState(runtime).numLayers, 3)
  })

  await t.test('invalid structural requests are rejected', async () => {
    const runtime = await createRuntime()
    const maxedRuntime = await createRuntime({ layers: 8 })

    assert.equal(runtime.exports.stbte_insert_layer(runtime.tilemap, -1), 0)
    assert.equal(runtime.exports.stbte_delete_layer(runtime.tilemap, 99), 0)
    assert.equal(runtime.exports.stbte_move_layer(runtime.tilemap, 0, 99), 0)
    assert.equal(maxedRuntime.exports.stbte_insert_layer(maxedRuntime.tilemap, 8), 0)
  })

  await t.test('resize preserves overlap, clears new space, and rejects invalid sizes', async () => {
    const runtime = await createRuntime()

    paint(runtime, 0, runtime.indices.ground, 0, 0)
    paint(runtime, 1, runtime.indices.layer1Only, 3, 3)
    runtime.exports.stbte_set_selection(runtime.tilemap, 0, 0, 1, 1)
    runtime.exports.stbte_copy(runtime.tilemap)

    assert.equal(runtime.exports.stbte_resize_map(runtime.tilemap, 2, 2), 1)
    assert.deepEqual(tilemapState(runtime), {
      width: 2,
      height: 2,
      numLayers: 3,
      numTiles: 4,
      curTile: 2,
      curLayer: 1,
      soloLayer: -1,
      undoAvailable: 0,
      redoAvailable: 0
    })
    assert.equal(tileAt(runtime, 0, 0, 0), TILE_GROUND)
    assert.equal(uiState(runtime).hasCopy, 0)

    assert.equal(runtime.exports.stbte_resize_map(runtime.tilemap, 5, 5), 1)
    assert.equal(tileAt(runtime, 0, 0, 0), TILE_GROUND)
    assert.equal(tileAt(runtime, 4, 4, 0), TILE_BACKGROUND)
    assert.equal(tileAt(runtime, 4, 4, 1), -1)
    assert.equal(runtime.exports.stbte_resize_map(runtime.tilemap, 0, 5), 0)
  })

  await t.test('chunk export header and body serialize current tilemap', async () => {
    const runtime = await createRuntime({ width: 4, height: 3, layers: 2 })

    paint(runtime, 0, runtime.indices.ground, 0, 0)
    paint(runtime, 1, runtime.indices.layer1Only, 2, 1)

    const chunkSize = 4
    const chunkCount = 3
    const required = runtime.exports.stbte_chunk_export_required_bytes(
      runtime.tilemap,
      10,
      6,
      chunkSize,
      chunkCount
    )
    const headerSize = runtime.exports.stbte_chunk_export_header_size()
    const bytesPerChunk = runtime.exports.stbte_chunk_export_bytes_per_chunk(runtime.tilemap, chunkSize)
    const headerPtr = runtime.memory.buffer.byteLength
    runtime.memory.grow(Math.ceil(required / 65536) || 1)

    assert.equal(runtime.exports.stbte_chunk_export_version(), 1)
    assert.equal(required, headerSize + (bytesPerChunk * chunkCount))
    assert.equal(
      runtime.exports.stbte_chunk_export_write_header(runtime.tilemap, headerPtr, required, 10, 6, chunkSize, chunkCount),
      1
    )
    assert.equal(
      runtime.exports.stbte_chunk_export_write_current_chunk(runtime.tilemap, headerPtr, required, chunkSize, 1),
      1
    )
    assert.equal(
      runtime.exports.stbte_chunk_export_write_current_chunk(runtime.tilemap, headerPtr, required, chunkSize, chunkCount),
      0
    )

    const header = new DataView(runtime.memory.buffer, headerPtr, headerSize)
    assert.equal(header.getUint32(0, true), 1)
    assert.equal(header.getUint32(4, true), 10)
    assert.equal(header.getUint32(8, true), 6)
    assert.equal(header.getUint32(12, true), 2)
    assert.equal(header.getUint32(16, true), 4)
    assert.equal(header.getUint32(20, true), 3)
    const bodyPtr = header.getUint32(24, true)
    assert.equal(bodyPtr, headerPtr + headerSize)

    const body = new Uint16Array(runtime.memory.buffer, bodyPtr, (required - headerSize) / 2)
    const chunkOffset = bytesPerChunk / 2
    const perLayer = chunkSize * chunkSize
    assert.equal(body[chunkOffset + 0], TILE_GROUND + 1)
    assert.equal(body[chunkOffset + perLayer + (1 * chunkSize) + 2], TILE_LAYER1 + 1)
    assert.equal(body[chunkOffset + perLayer + (3 * chunkSize) + 3], 0)
  })

  await t.test('chunk import payload loads padded chunk data into scratch tilemap', async () => {
    const runtime = await createRuntime({ width: 4, height: 4, layers: 2 })
    const chunkSize = 4
    const payload = new Uint16Array(chunkSize * chunkSize * 2)
    payload[0] = TILE_GROUND + 1
    payload[(1 * chunkSize) + 2] = TILE_GROUND + 1
    payload[(chunkSize * chunkSize) + (2 * chunkSize) + 1] = TILE_LAYER1 + 1

    const payloadPtr = runtime.memory.buffer.byteLength
    runtime.memory.grow(1)
    new Uint16Array(runtime.memory.buffer, payloadPtr, payload.length).set(payload)

    assert.equal(
      runtime.exports.stbte_chunk_import_payload(runtime.tilemap, payloadPtr, payload.byteLength, chunkSize, 3, 3),
      1
    )
    assert.equal(tilemapState(runtime).width, 3)
    assert.equal(tilemapState(runtime).height, 3)
    assert.equal(tileAt(runtime, 0, 0, 0), TILE_GROUND)
    assert.equal(tileAt(runtime, 2, 1, 0), TILE_GROUND)
    assert.equal(tileAt(runtime, 1, 2, 1), TILE_LAYER1)
    assert.equal(tileAt(runtime, 3, 3, 0), -1)
    assert.equal(
      runtime.exports.stbte_chunk_import_payload(runtime.tilemap, payloadPtr, payload.byteLength, chunkSize, 5, 5),
      0
    )
  })

  await t.test('chunk import from flat logical payload slices the requested chunk', async () => {
    const runtime = await createRuntime({ width: 4, height: 4, layers: 2 })
    const mapWidth = 6
    const mapHeight = 5
    const chunkSize = 4
    const layerStride = mapWidth * mapHeight
    const payload = new Uint16Array(layerStride * 2)

    payload[(0 * layerStride) + 2 + (0 * mapWidth)] = TILE_GROUND + 1
    payload[(0 * layerStride) + 4 + (3 * mapWidth)] = TILE_GROUND + 1
    payload[(0 * layerStride) + 5 + (3 * mapWidth)] = TILE_GROUND + 1
    payload[(1 * layerStride) + 5 + (4 * mapWidth)] = TILE_LAYER1 + 1

    const payloadPtr = runtime.memory.buffer.byteLength
    runtime.memory.grow(1)
    new Uint16Array(runtime.memory.buffer, payloadPtr, payload.length).set(payload)

    assert.equal(
      runtime.exports.stbte_chunk_import_from_flat_payload(
        runtime.tilemap,
        payloadPtr,
        payload.byteLength,
        mapWidth,
        mapHeight,
        chunkSize,
        1,
        0
      ),
      1
    )
    assert.equal(tilemapState(runtime).width, 2)
    assert.equal(tilemapState(runtime).height, 4)
    assert.equal(tileAt(runtime, 0, 3, 0), TILE_GROUND)
    assert.equal(tileAt(runtime, 1, 3, 0), TILE_GROUND)
    assert.equal(tileAt(runtime, 1, 0, 1), -1)

    assert.equal(
      runtime.exports.stbte_chunk_import_from_flat_payload(
        runtime.tilemap,
        payloadPtr,
        payload.byteLength,
        mapWidth,
        mapHeight,
        chunkSize,
        1,
        1
      ),
      1
    )
    assert.equal(tilemapState(runtime).width, 2)
    assert.equal(tilemapState(runtime).height, 1)
    assert.equal(tileAt(runtime, 1, 0, 1), TILE_LAYER1)
    assert.equal(
      runtime.exports.stbte_chunk_import_from_flat_payload(
        runtime.tilemap,
        payloadPtr,
        payload.byteLength,
        mapWidth,
        mapHeight,
        chunkSize,
        2,
        0
      ),
      0
    )
  })

  await t.test('logical store loads, writes chunks, and exports directly', async () => {
    const runtime = await createRuntime({ width: 4, height: 4, layers: 2 })
    const mapWidth = 6
    const mapHeight = 5
    const chunkSize = 4
    const layerStride = mapWidth * mapHeight
    const payload = new Uint16Array(layerStride * 2)
    payload[0] = TILE_GROUND + 1
    payload[layerStride + (4 * mapWidth) + 5] = TILE_LAYER1 + 1

    const store = runtime.exports.stbte_logical_create(mapWidth, mapHeight, 2)
    assert.notEqual(store, 0)
    const dataPtr = runtime.exports.stbte_logical_data_ptr(store)
    new Uint16Array(runtime.memory.buffer, dataPtr, payload.length).set(payload)
    assert.equal(runtime.exports.stbte_logical_set_all(store, dataPtr, payload.byteLength), 1)

    assert.equal(
      runtime.exports.stbte_logical_load_chunk_into_tilemap(store, runtime.tilemap, chunkSize, 1, 1),
      1
    )
    assert.equal(tilemapState(runtime).width, 2)
    assert.equal(tilemapState(runtime).height, 1)
    assert.equal(tileAt(runtime, 1, 0, 1), TILE_LAYER1)

    runtime.exports.stbte_set_tile(runtime.tilemap, 0, 0, 0, TILE_GROUND)
    assert.equal(
      runtime.exports.stbte_logical_write_chunk_from_tilemap(store, runtime.tilemap, chunkSize, 1, 1),
      1
    )
    const storeData = new Uint16Array(runtime.memory.buffer, dataPtr, payload.length)
    assert.equal(storeData[(4 * mapWidth) + 4], TILE_GROUND + 1)

    const chunkCount = 4
    const headerSize = runtime.exports.stbte_chunk_export_header_size()
    const bytesPerChunk = chunkSize * chunkSize * 2 * 2
    const required = headerSize + (bytesPerChunk * chunkCount)
    const headerPtr = runtime.memory.buffer.byteLength
    runtime.memory.grow(Math.ceil(required / 65536) || 1)
    assert.equal(runtime.exports.stbte_logical_export_write_header(store, headerPtr, required, chunkSize), 1)
    assert.equal(runtime.exports.stbte_logical_export_write_chunk(store, headerPtr, required, chunkSize, 3), 1)
    const header = new DataView(runtime.memory.buffer, headerPtr, headerSize)
    assert.equal(header.getUint32(4, true), mapWidth)
    assert.equal(header.getUint32(8, true), mapHeight)
    assert.equal(header.getUint32(20, true), chunkCount)
    const body = new Uint16Array(runtime.memory.buffer, header.getUint32(24, true), (required - headerSize) / 2)
    const chunkOffset = (3 * bytesPerChunk) / 2
    const perLayer = chunkSize * chunkSize
    assert.equal(body[chunkOffset + 0], TILE_GROUND + 1)
    assert.equal(body[chunkOffset + perLayer + 1], TILE_LAYER1 + 1)
  })

  await t.test('logical store structural operations preserve payload order', async () => {
    const runtime = await createRuntime({ width: 4, height: 4, layers: 2 })
    const store = runtime.exports.stbte_logical_create(3, 2, 2)
    assert.notEqual(store, 0)
    let dataPtr = runtime.exports.stbte_logical_data_ptr(store)
    const source = new Uint16Array(runtime.memory.buffer, dataPtr, 12)

    source[0] = TILE_GROUND + 1
    source[6 + 1] = TILE_LAYER1 + 1

    assert.equal(runtime.exports.stbte_logical_insert_layer(store, 1), 1)
    dataPtr = runtime.exports.stbte_logical_data_ptr(store)
    let data = new Uint16Array(runtime.memory.buffer, dataPtr, 18)
    assert.equal(data[0], TILE_GROUND + 1)
    assert.equal(data[(2 * 6) + 1], TILE_LAYER1 + 1)

    assert.equal(runtime.exports.stbte_logical_move_layer(store, 2, 0), 1)
    dataPtr = runtime.exports.stbte_logical_data_ptr(store)
    data = new Uint16Array(runtime.memory.buffer, dataPtr, 18)
    assert.equal(data[1], TILE_LAYER1 + 1)
    assert.equal(data[(1 * 6) + 0], TILE_GROUND + 1)

    assert.equal(runtime.exports.stbte_logical_delete_layer(store, 1), 1)
    dataPtr = runtime.exports.stbte_logical_data_ptr(store)
    data = new Uint16Array(runtime.memory.buffer, dataPtr, 12)
    assert.equal(data[1], TILE_LAYER1 + 1)

    assert.equal(runtime.exports.stbte_logical_resize(store, 4, 3, 2), 1)
    dataPtr = runtime.exports.stbte_logical_data_ptr(store)
    data = new Uint16Array(runtime.memory.buffer, dataPtr, 24)
    assert.equal(data[1], TILE_LAYER1 + 1)
    assert.equal(data[12 + 0], 0)
  })
})
