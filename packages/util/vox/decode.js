function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readU32(view, offset) {
  return view.getUint32(offset, true)
}

function readI32(view, offset) {
  return view.getInt32(offset, true)
}

function chunkId(bytes, offset) {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  )
}

/**
 * Decode a MagicaVoxel .vox file.
 *
 * This decoder supports the core preview path first: VOX header, MAIN, SIZE,
 * XYZI, RGBA, plus the minimal scene graph chunks nTRN, nGRP, and nSHP needed
 * to place model instances. Unknown chunks are skipped, including their child
 * ranges. Material/render/layer metadata can be added when a caller needs it.
 *
 * @param {ArrayBuffer} arrayBuffer ArrayBuffer containing the VOX file.
 * @param {number|null} [byteOffset] Offset to the start of the VOX file.
 * @param {number|null} [byteLength] Length of the VOX file in bytes.
 * @returns {{version: number, models: Array<{width: number, height: number, depth: number, voxels: Uint8Array}>, palette: Uint8Array|null, scene: {transforms: Array<object>, groups: Array<object>, shapes: Array<object>}}}
 */
export function decode(arrayBuffer, byteOffset, byteLength) {
  if (byteOffset === undefined || byteOffset === null) byteOffset = 0
  if (byteLength === undefined || byteLength === null)
    byteLength = arrayBuffer.byteLength - byteOffset

  assert(
    arrayBuffer instanceof ArrayBuffer,
    "VOX.decode: arrayBuffer must be an ArrayBuffer",
  )
  assert(
    Number.isInteger(byteOffset) && byteOffset >= 0,
    "VOX.decode: invalid byteOffset",
  )
  assert(
    Number.isInteger(byteLength) && byteLength >= 0,
    "VOX.decode: invalid byteLength",
  )
  assert(
    byteOffset + byteLength <= arrayBuffer.byteLength,
    "VOX.decode: byte range exceeds ArrayBuffer",
  )

  const bytes = new Uint8Array(arrayBuffer, byteOffset, byteLength)
  const view = new DataView(arrayBuffer, byteOffset, byteLength)

  assert(byteLength >= 8, "VOX.decode: file is too short")
  assert(chunkId(bytes, 0) === "VOX ", "VOX.decode: invalid VOX signature")

  const version = readU32(view, 4)
  const models = []
  const scene = { transforms: [], groups: [], shapes: [] }
  let palette = null
  let pendingSize = null

  function readStringAt(offset, end) {
    assert(offset + 4 <= end, "VOX.decode: truncated STRING size")
    const size = readU32(view, offset)
    const start = offset + 4
    const next = start + size
    assert(next <= end, "VOX.decode: truncated STRING data")
    return {
      value: new TextDecoder().decode(bytes.subarray(start, next)),
      offset: next,
    }
  }

  function readDictAt(offset, end) {
    assert(offset + 4 <= end, "VOX.decode: truncated DICT size")
    const count = readU32(view, offset)
    let cursor = offset + 4
    const value = {}
    for (let i = 0; i < count; i += 1) {
      const key = readStringAt(cursor, end)
      cursor = key.offset
      const item = readStringAt(cursor, end)
      cursor = item.offset
      value[key.value] = item.value
    }
    return { value, offset: cursor }
  }

  function parseTransform(contentStart, contentEnd) {
    assert(contentStart + 4 <= contentEnd, "VOX.decode: nTRN missing node id")
    let cursor = contentStart
    const nodeId = readI32(view, cursor)
    cursor += 4
    const attributes = readDictAt(cursor, contentEnd)
    cursor = attributes.offset
    assert(
      cursor + 16 <= contentEnd,
      "VOX.decode: nTRN fixed fields are truncated",
    )
    const childNodeId = readI32(view, cursor)
    cursor += 4
    const reservedId = readI32(view, cursor)
    cursor += 4
    const layerId = readI32(view, cursor)
    cursor += 4
    const frameCount = readU32(view, cursor)
    cursor += 4
    const frames = []
    for (let i = 0; i < frameCount; i += 1) {
      const frame = readDictAt(cursor, contentEnd)
      cursor = frame.offset
      frames.push(frame.value)
    }
    assert(
      cursor === contentEnd,
      "VOX.decode: nTRN has trailing malformed data",
    )
    scene.transforms.push({
      nodeId,
      attributes: attributes.value,
      childNodeId,
      reservedId,
      layerId,
      frames,
    })
  }

  function parseGroup(contentStart, contentEnd) {
    assert(contentStart + 4 <= contentEnd, "VOX.decode: nGRP missing node id")
    let cursor = contentStart
    const nodeId = readI32(view, cursor)
    cursor += 4
    const attributes = readDictAt(cursor, contentEnd)
    cursor = attributes.offset
    assert(cursor + 4 <= contentEnd, "VOX.decode: nGRP missing child count")
    const childCount = readU32(view, cursor)
    cursor += 4
    const childNodeIds = []
    for (let i = 0; i < childCount; i += 1) {
      assert(
        cursor + 4 <= contentEnd,
        "VOX.decode: nGRP child ids are truncated",
      )
      childNodeIds.push(readI32(view, cursor))
      cursor += 4
    }
    assert(
      cursor === contentEnd,
      "VOX.decode: nGRP has trailing malformed data",
    )
    scene.groups.push({ nodeId, attributes: attributes.value, childNodeIds })
  }

  function parseShape(contentStart, contentEnd) {
    assert(contentStart + 4 <= contentEnd, "VOX.decode: nSHP missing node id")
    let cursor = contentStart
    const nodeId = readI32(view, cursor)
    cursor += 4
    const attributes = readDictAt(cursor, contentEnd)
    cursor = attributes.offset
    assert(cursor + 4 <= contentEnd, "VOX.decode: nSHP missing model count")
    const modelCount = readU32(view, cursor)
    cursor += 4
    const models = []
    for (let i = 0; i < modelCount; i += 1) {
      assert(cursor + 4 <= contentEnd, "VOX.decode: nSHP model id is truncated")
      const modelId = readI32(view, cursor)
      cursor += 4
      const modelAttributes = readDictAt(cursor, contentEnd)
      cursor = modelAttributes.offset
      models.push({ modelId, attributes: modelAttributes.value })
    }
    assert(
      cursor === contentEnd,
      "VOX.decode: nSHP has trailing malformed data",
    )
    scene.shapes.push({ nodeId, attributes: attributes.value, models })
  }

  function parseChunks(start, end) {
    let pos = start
    while (pos < end) {
      assert(pos + 12 <= end, "VOX.decode: truncated chunk header")

      const id = chunkId(bytes, pos)
      const contentSize = readU32(view, pos + 4)
      const childrenSize = readU32(view, pos + 8)
      const contentStart = pos + 12
      const contentEnd = contentStart + contentSize
      const childrenEnd = contentEnd + childrenSize

      assert(contentEnd <= end, `VOX.decode: truncated ${id} chunk content`)
      assert(childrenEnd <= end, `VOX.decode: truncated ${id} chunk children`)

      if (id === "nTRN") {
        parseTransform(contentStart, contentEnd)
      } else if (id === "nGRP") {
        parseGroup(contentStart, contentEnd)
      } else if (id === "nSHP") {
        parseShape(contentStart, contentEnd)
      } else if (id === "SIZE") {
        assert(contentSize >= 12, "VOX.decode: SIZE chunk is too small")
        pendingSize = {
          width: readU32(view, contentStart),
          height: readU32(view, contentStart + 4),
          depth: readU32(view, contentStart + 8),
        }
      } else if (id === "XYZI") {
        assert(pendingSize, "VOX.decode: XYZI chunk appeared before SIZE chunk")
        assert(contentSize >= 4, "VOX.decode: XYZI chunk is too small")

        const count = readU32(view, contentStart)
        const requiredSize = 4 + count * 4
        assert(
          contentSize >= requiredSize,
          "VOX.decode: XYZI chunk voxel data is truncated",
        )

        const voxels = new Uint8Array(count * 4)
        voxels.set(
          bytes.subarray(contentStart + 4, contentStart + 4 + count * 4),
        )
        models.push({ ...pendingSize, voxels })
        pendingSize = null
      } else if (id === "RGBA") {
        assert(contentSize >= 256 * 4, "VOX.decode: RGBA chunk is too small")
        palette = new Uint8Array(256 * 4)
        palette.set(bytes.subarray(contentStart, contentStart + 256 * 4))
      }

      if (childrenSize > 0) parseChunks(contentEnd, childrenEnd)
      pos = childrenEnd
    }
    assert(pos === end, "VOX.decode: malformed chunk range")
  }

  parseChunks(8, byteLength)
  assert(models.length > 0, "VOX.decode: missing SIZE/XYZI model data")

  return { version, models, palette, scene }
}
