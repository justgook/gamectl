function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readU32(view, offset) {
  return view.getUint32(offset, true)
}

function chunkId(bytes, offset) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

/**
 * Decode a MagicaVoxel .vox file.
 *
 * This decoder intentionally supports the core preview path first: VOX header,
 * MAIN, SIZE, XYZI, and RGBA. Unknown chunks are skipped, including their child
 * ranges. Scene graph/material chunks can be added when a caller needs them.
 *
 * @param {ArrayBuffer} arrayBuffer ArrayBuffer containing the VOX file.
 * @param {number|null} [byteOffset] Offset to the start of the VOX file.
 * @param {number|null} [byteLength] Length of the VOX file in bytes.
 * @returns {{version: number, models: Array<{width: number, height: number, depth: number, voxels: Uint8Array}>, palette: Uint8Array|null}}
 */
export function decode(arrayBuffer, byteOffset, byteLength) {
  if (byteOffset === undefined || byteOffset === null) byteOffset = 0
  if (byteLength === undefined || byteLength === null) byteLength = arrayBuffer.byteLength - byteOffset

  assert(arrayBuffer instanceof ArrayBuffer, 'VOX.decode: arrayBuffer must be an ArrayBuffer')
  assert(Number.isInteger(byteOffset) && byteOffset >= 0, 'VOX.decode: invalid byteOffset')
  assert(Number.isInteger(byteLength) && byteLength >= 0, 'VOX.decode: invalid byteLength')
  assert(byteOffset + byteLength <= arrayBuffer.byteLength, 'VOX.decode: byte range exceeds ArrayBuffer')

  const bytes = new Uint8Array(arrayBuffer, byteOffset, byteLength)
  const view = new DataView(arrayBuffer, byteOffset, byteLength)

  assert(byteLength >= 8, 'VOX.decode: file is too short')
  assert(chunkId(bytes, 0) === 'VOX ', 'VOX.decode: invalid VOX signature')

  const version = readU32(view, 4)
  const models = []
  let palette = null
  let pendingSize = null

  function parseChunks(start, end) {
    let pos = start
    while (pos < end) {
      assert(pos + 12 <= end, 'VOX.decode: truncated chunk header')

      const id = chunkId(bytes, pos)
      const contentSize = readU32(view, pos + 4)
      const childrenSize = readU32(view, pos + 8)
      const contentStart = pos + 12
      const contentEnd = contentStart + contentSize
      const childrenEnd = contentEnd + childrenSize

      assert(contentEnd <= end, `VOX.decode: truncated ${id} chunk content`)
      assert(childrenEnd <= end, `VOX.decode: truncated ${id} chunk children`)

      if (id === 'nTRN' || id === 'nGRP' || id === 'nSHP') {
        throw new Error(`VOX.decode: ${id} scene graph chunks are under construction and are not supported by the browser vox preview yet`)
      } else if (id === 'SIZE') {
        assert(contentSize >= 12, 'VOX.decode: SIZE chunk is too small')
        pendingSize = {
          width: readU32(view, contentStart),
          height: readU32(view, contentStart + 4),
          depth: readU32(view, contentStart + 8),
        }
      } else if (id === 'XYZI') {
        assert(pendingSize, 'VOX.decode: XYZI chunk appeared before SIZE chunk')
        assert(contentSize >= 4, 'VOX.decode: XYZI chunk is too small')

        const count = readU32(view, contentStart)
        const requiredSize = 4 + count * 4
        assert(contentSize >= requiredSize, 'VOX.decode: XYZI chunk voxel data is truncated')

        const voxels = new Uint8Array(count * 4)
        voxels.set(bytes.subarray(contentStart + 4, contentStart + 4 + count * 4))
        models.push({ ...pendingSize, voxels })
        pendingSize = null
      } else if (id === 'RGBA') {
        assert(contentSize >= 256 * 4, 'VOX.decode: RGBA chunk is too small')
        palette = new Uint8Array(256 * 4)
        palette.set(bytes.subarray(contentStart, contentStart + 256 * 4))
      }

      if (childrenSize > 0) parseChunks(contentEnd, childrenEnd)
      pos = childrenEnd
    }
    assert(pos === end, 'VOX.decode: malformed chunk range')
  }

  parseChunks(8, byteLength)
  assert(models.length > 0, 'VOX.decode: missing SIZE/XYZI model data')

  return { version, models, palette }
}
