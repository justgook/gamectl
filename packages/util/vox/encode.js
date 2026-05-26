function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function writeId(out, offset, id) {
  assert(
    typeof id === "string" && id.length === 4,
    "VOX.encode: chunk id must be four characters",
  )
  out[offset] = id.charCodeAt(0)
  out[offset + 1] = id.charCodeAt(1)
  out[offset + 2] = id.charCodeAt(2)
  out[offset + 3] = id.charCodeAt(3)
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true)
}

function createChunk(id, content, children) {
  const contentBytes = content || new Uint8Array()
  const childBytes = children || new Uint8Array()
  const out = new Uint8Array(
    12 + contentBytes.byteLength + childBytes.byteLength,
  )
  const view = new DataView(out.buffer)

  writeId(out, 0, id)
  writeU32(view, 4, contentBytes.byteLength)
  writeU32(view, 8, childBytes.byteLength)
  out.set(contentBytes, 12)
  out.set(childBytes, 12 + contentBytes.byteLength)
  return out
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.byteLength
  }
  return out
}

function validateModel(model, index) {
  assert(
    model && typeof model === "object",
    `VOX.encode: model ${index} must be an object`,
  )

  const width = Number(model.width)
  const height = Number(model.height)
  const depth = Number(model.depth)
  assert(
    Number.isInteger(width) && width > 0 && width <= 256,
    `VOX.encode: model ${index} has invalid width`,
  )
  assert(
    Number.isInteger(height) && height > 0 && height <= 256,
    `VOX.encode: model ${index} has invalid height`,
  )
  assert(
    Number.isInteger(depth) && depth > 0 && depth <= 256,
    `VOX.encode: model ${index} has invalid depth`,
  )

  const voxels = model.voxels
  assert(
    voxels instanceof Uint8Array,
    `VOX.encode: model ${index} voxels must be a Uint8Array`,
  )
  assert(
    voxels.byteLength % 4 === 0,
    `VOX.encode: model ${index} voxels length must be a multiple of 4`,
  )

  for (let p = 0; p < voxels.byteLength; p += 4) {
    const x = voxels[p]
    const y = voxels[p + 1]
    const z = voxels[p + 2]
    const colorIndex = voxels[p + 3]
    assert(
      x < width,
      `VOX.encode: model ${index} voxel ${p / 4} x exceeds width`,
    )
    assert(
      y < height,
      `VOX.encode: model ${index} voxel ${p / 4} y exceeds height`,
    )
    assert(
      z < depth,
      `VOX.encode: model ${index} voxel ${p / 4} z exceeds depth`,
    )
    assert(
      colorIndex >= 1,
      `VOX.encode: model ${index} voxel ${p / 4} color index must be 1-based`,
    )
  }

  return { width, height, depth, voxels }
}

function encodeModel(model, index) {
  const valid = validateModel(model, index)

  const sizeContent = new Uint8Array(12)
  const sizeView = new DataView(sizeContent.buffer)
  writeU32(sizeView, 0, valid.width)
  writeU32(sizeView, 4, valid.height)
  writeU32(sizeView, 8, valid.depth)

  const count = valid.voxels.byteLength / 4
  const xyziContent = new Uint8Array(4 + valid.voxels.byteLength)
  const xyziView = new DataView(xyziContent.buffer)
  writeU32(xyziView, 0, count)
  xyziContent.set(valid.voxels, 4)

  return [createChunk("SIZE", sizeContent), createChunk("XYZI", xyziContent)]
}

/**
 * Encode a minimal MagicaVoxel .vox file.
 *
 * Input shape matches decode(): { models, palette }. Scene graph/material chunks
 * are intentionally not emitted by this first-pass utility.
 *
 * @param {{version?: number, models: Array<{width: number, height: number, depth: number, voxels: Uint8Array}>, palette?: Uint8Array|null}} vox
 * @returns {ArrayBuffer}
 */
export function encode(vox) {
  assert(vox && typeof vox === "object", "VOX.encode: input must be an object")
  assert(
    Array.isArray(vox.models) && vox.models.length > 0,
    "VOX.encode: input.models must be a non-empty array",
  )

  const version =
    vox.version === undefined || vox.version === null
      ? 150
      : Number(vox.version)
  assert(
    Number.isInteger(version) && version >= 0,
    "VOX.encode: invalid version",
  )

  const childParts = []
  vox.models.forEach((model, index) =>
    childParts.push(...encodeModel(model, index)),
  )

  if (vox.palette !== undefined && vox.palette !== null) {
    assert(
      vox.palette instanceof Uint8Array,
      "VOX.encode: palette must be a Uint8Array",
    )
    assert(
      vox.palette.byteLength === 256 * 4,
      "VOX.encode: palette must contain 256 RGBA colors",
    )
    childParts.push(createChunk("RGBA", vox.palette))
  }

  const main = createChunk("MAIN", null, concat(childParts))
  const out = new Uint8Array(8 + main.byteLength)
  const view = new DataView(out.buffer)
  writeId(out, 0, "VOX ")
  writeU32(view, 4, version)
  out.set(main, 8)
  return out.buffer
}
