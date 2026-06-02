function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseTranslation(value) {
  if (typeof value !== "string" || value.length === 0)
    return { x: 0, y: 0, z: 0 }
  const parts = value.trim().split(/\s+/).map((part) => Number.parseInt(part, 10))
  assert(parts.length === 3 && parts.every(Number.isInteger), `VOX scene invalid nTRN translation: ${value}`)
  return { x: parts[0], y: parts[1], z: parts[2] }
}

function decodeRotation(value) {
  if (typeof value !== "string" || value.length === 0) return null
  const packed = Number.parseInt(value, 10)
  assert(Number.isInteger(packed) && packed >= 0 && packed <= 255, `VOX scene invalid nTRN rotation: ${value}`)
  const row0 = packed & 3
  const row1 = (packed >> 2) & 3
  const row2 = [0, 1, 2].find((axis) => axis !== row0 && axis !== row1)
  assert(row2 !== undefined, `VOX scene invalid nTRN rotation axes: ${value}`)
  const signs = [packed & 16 ? -1 : 1, packed & 32 ? -1 : 1, packed & 64 ? -1 : 1]
  return [
    { axis: row0, sign: signs[0] },
    { axis: row1, sign: signs[1] },
    { axis: row2, sign: signs[2] },
  ]
}

function applyRotation(point, rotation) {
  if (!rotation) return point
  const values = [point.x, point.y, point.z]
  return {
    x: values[rotation[0].axis] * rotation[0].sign,
    y: values[rotation[1].axis] * rotation[1].sign,
    z: values[rotation[2].axis] * rotation[2].sign,
  }
}

function composeTransform(parent, frame) {
  const translation = parseTranslation(frame?._t)
  const rotation = decodeRotation(frame?._r)
  return {
    x: parent.x + translation.x,
    y: parent.y + translation.y,
    z: parent.z + translation.z,
    rotation: rotation || parent.rotation,
  }
}

export function collectVoxInstances(vox) {
  const scene = vox.scene
  if (!scene || scene.shapes.length === 0 || scene.transforms.length === 0) {
    return vox.models.map((model, modelId) => ({
      modelId,
      model,
      transform: { x: 0, y: 0, z: 0, rotation: null },
    }))
  }

  const transforms = new Map(scene.transforms.map((node) => [node.nodeId, node]))
  const groups = new Map(scene.groups.map((node) => [node.nodeId, node]))
  const shapes = new Map(scene.shapes.map((node) => [node.nodeId, node]))
  const childIds = new Set()
  for (const node of scene.transforms) childIds.add(node.childNodeId)
  for (const node of scene.groups) for (const childNodeId of node.childNodeIds) childIds.add(childNodeId)
  const roots = scene.transforms.filter((node) => !childIds.has(node.nodeId))
  assert(roots.length > 0, "VOX scene graph has no root transform")

  const instances = []
  function visit(nodeId, transform) {
    if (transforms.has(nodeId)) {
      const node = transforms.get(nodeId)
      const next = composeTransform(transform, node.frames[0] || {})
      visit(node.childNodeId, next)
      return
    }
    if (groups.has(nodeId)) {
      const node = groups.get(nodeId)
      for (const childNodeId of node.childNodeIds) visit(childNodeId, transform)
      return
    }
    if (shapes.has(nodeId)) {
      const node = shapes.get(nodeId)
      for (const entry of node.models) {
        const model = vox.models[entry.modelId]
        assert(model, `VOX scene references missing model ${entry.modelId}`)
        instances.push({ modelId: entry.modelId, model, transform })
      }
      return
    }
    throw new Error(`VOX scene references missing node ${nodeId}`)
  }

  for (const root of roots) visit(root.nodeId, { x: 0, y: 0, z: 0, rotation: null })
  assert(instances.length > 0, "VOX scene graph produced no model instances")
  return instances
}

function ensureDefaultPalette(palette) {
  if (palette instanceof Uint8Array) return { palette, paletteWidth: 256 }
  const out = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i += 1) {
    const hue = (i * 47) % 360
    const c = hslToRgb(hue, 68, 56)
    out[i * 4] = c.r
    out[i * 4 + 1] = c.g
    out[i * 4 + 2] = c.b
    out[i * 4 + 3] = 255
  }
  return { palette: out, paletteWidth: 256 }
}

function hslToRgb(h, s, l) {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

export function voxelRenderDataFromVox(vox, instances = collectVoxInstances(vox)) {
  let count = 0
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const instance of instances) count += instance.model.voxels.length / 4
  const data = new Float32Array(count * 4)
  let o = 0
  for (const instance of instances) {
    const voxels = instance.model.voxels
    for (let p = 0; p < voxels.length; p += 4) {
      const local = applyRotation({ x: voxels[p], y: voxels[p + 1], z: voxels[p + 2] }, instance.transform.rotation)
      const x = local.x + instance.transform.x
      const y = local.z + instance.transform.z
      const z = local.y + instance.transform.y
      data[o++] = x
      data[o++] = y
      data[o++] = z
      data[o++] = Math.max(0, voxels[p + 3] - 1)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x + 1)
      maxY = Math.max(maxY, y + 1)
      maxZ = Math.max(maxZ, z + 1)
    }
  }
  if (count === 0) {
    minX = 0; minY = 0; minZ = 0; maxX = 1; maxY = 1; maxZ = 1
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] -= minX
    data[i + 1] -= minY
    data[i + 2] -= minZ
  }
  const palette = ensureDefaultPalette(vox.palette)
  return { bounds: { width: maxX - minX, height: maxY - minY, depth: maxZ - minZ }, instances: data, ...palette }
}
