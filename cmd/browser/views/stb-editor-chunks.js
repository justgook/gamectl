export const STB_EDITOR_CHUNK_SIZE = 256
export const STB_EDITOR_CHUNK_EXPORT_VERSION = 1
export const STB_EDITOR_CHUNK_EXPORT_HEADER_U32_COUNT = 7
export const STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE = STB_EDITOR_CHUNK_EXPORT_HEADER_U32_COUNT * 4

export function cloneTilemap(tilemap) {
  return {
    layers: Array.isArray(tilemap?.layers) ? tilemap.layers.map((layer) => ({
      width: Math.max(1, Number(layer?.width) || 1),
      data: Array.isArray(layer?.data) ? [...layer.data] : [],
      props: layer?.props ? { ...layer.props } : {}
    })) : [],
    props: tilemap?.props ? { ...tilemap.props } : {}
  }
}

export function getChunkGrid(mapWidth, mapHeight, chunkSize = STB_EDITOR_CHUNK_SIZE) {
  const width = Math.max(1, Number(mapWidth) || 1)
  const height = Math.max(1, Number(mapHeight) || 1)
  const size = Math.max(1, Number(chunkSize) || 1)
  const cols = Math.max(1, Math.ceil(width / size))
  const rows = Math.max(1, Math.ceil(height / size))
  return { cols, rows, count: cols * rows }
}

export function getChunkPositionForIndex(mapWidth, mapHeight, chunkIndex, chunkSize = STB_EDITOR_CHUNK_SIZE) {
  const { cols, count } = getChunkGrid(mapWidth, mapHeight, chunkSize)
  const index = Math.max(0, Math.min(count - 1, Number(chunkIndex) || 0))
  return {
    chunkX: index % cols,
    chunkY: Math.floor(index / cols)
  }
}

export function clampChunkPosition(mapWidth, mapHeight, chunkX, chunkY, chunkSize = STB_EDITOR_CHUNK_SIZE) {
  const { cols, rows } = getChunkGrid(mapWidth, mapHeight, chunkSize)
  return {
    chunkX: Math.max(0, Math.min(cols - 1, Number(chunkX) || 0)),
    chunkY: Math.max(0, Math.min(rows - 1, Number(chunkY) || 0))
  }
}

export function getChunkBounds(mapWidth, mapHeight, chunkX, chunkY, chunkSize = STB_EDITOR_CHUNK_SIZE) {
  const width = Math.max(1, Number(mapWidth) || 1)
  const height = Math.max(1, Number(mapHeight) || 1)
  const size = Math.max(1, Number(chunkSize) || 1)
  const { chunkX: x, chunkY: y } = clampChunkPosition(width, height, chunkX, chunkY, size)
  const worldX = x * size
  const worldY = y * size
  return {
    chunkX: x,
    chunkY: y,
    worldX,
    worldY,
    width: Math.max(1, Math.min(size, width - worldX)),
    height: Math.max(1, Math.min(size, height - worldY))
  }
}

export function createLogicalTilemap(mapWidth, mapHeight, layers, layerNames = [], props = {}) {
  const width = Math.max(1, Number(mapWidth) || 1)
  const height = Math.max(1, Number(mapHeight) || 1)
  const layerCount = Math.max(1, Number(layers) || 1)
  const dataSize = width * height
  return {
    layers: Array.from({ length: layerCount }, (_value, index) => ({
      width,
      data: new Array(dataSize).fill(0),
      props: {
        name: String(layerNames[index] || `layer ${index + 1}`)
      }
    })),
    props: { ...props }
  }
}

export function buildChunkTilemapSnapshot(tilemap, mapWidth, mapHeight, chunkX, chunkY, chunkSize = STB_EDITOR_CHUNK_SIZE) {
  const logical = cloneTilemap(tilemap)
  const bounds = getChunkBounds(mapWidth, mapHeight, chunkX, chunkY, chunkSize)
  return {
    layers: logical.layers.map((layer, layerIndex) => {
      const sourceWidth = Math.max(1, Number(layer?.width) || mapWidth)
      const sourceData = Array.isArray(layer?.data) ? layer.data : []
      const data = new Array(bounds.width * bounds.height).fill(0)
      for (let y = 0; y < bounds.height; y++) {
        for (let x = 0; x < bounds.width; x++) {
          const sourceIndex = (bounds.worldY + y) * sourceWidth + bounds.worldX + x
          const targetIndex = y * bounds.width + x
          data[targetIndex] = Number(sourceData[sourceIndex]) || 0
        }
      }
      return {
        width: bounds.width,
        data,
        props: {
          ...(layer?.props || {}),
          name: String(layer?.props?.name || `layer ${layerIndex + 1}`)
        }
      }
    }),
    props: logical.props ? { ...logical.props } : {}
  }
}

export function encodeChunkSnapshotPayload(chunkSnapshot, chunkSize = STB_EDITOR_CHUNK_SIZE) {
  const size = Math.max(1, Number(chunkSize) || 1)
  const layers = Array.isArray(chunkSnapshot?.layers) ? chunkSnapshot.layers : []
  const payload = new Uint16Array(layers.length * size * size)

  layers.forEach((layer, layerIndex) => {
    const layerWidth = Math.max(1, Number(layer?.width) || size)
    const layerData = Array.isArray(layer?.data) ? layer.data : []
    const layerHeight = Math.max(0, Math.ceil(layerData.length / layerWidth))
    const layerOffset = layerIndex * size * size
    for (let y = 0; y < layerHeight; y++) {
      for (let x = 0; x < layerWidth; x++) {
        payload[layerOffset + (y * size) + x] = Math.max(0, Number(layerData[(y * layerWidth) + x]) || 0)
      }
    }
  })

  return payload
}

export function encodeLogicalTilemapPayload(tilemap, mapWidth, mapHeight) {
  const width = Math.max(1, Number(mapWidth) || 1)
  const height = Math.max(1, Number(mapHeight) || 1)
  const layers = Array.isArray(tilemap?.layers) ? tilemap.layers : []
  const payload = new Uint16Array(layers.length * width * height)

  layers.forEach((layer, layerIndex) => {
    const layerWidth = Math.max(1, Number(layer?.width) || width)
    const layerData = Array.isArray(layer?.data) ? layer.data : []
    const layerOffset = layerIndex * width * height
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sourceIndex = (y * layerWidth) + x
        payload[layerOffset + (y * width) + x] = Math.max(0, Number(layerData[sourceIndex]) || 0)
      }
    }
  })

  return payload
}

export function applyChunkTilemapSnapshot(tilemap, mapWidth, mapHeight, chunkX, chunkY, chunkSnapshot, chunkSize = STB_EDITOR_CHUNK_SIZE) {
  const bounds = getChunkBounds(mapWidth, mapHeight, chunkX, chunkY, chunkSize)
  const logical = cloneTilemap(tilemap)
  logical.layers = logical.layers.map((layer, layerIndex) => {
    const nextLayer = {
      width: Math.max(1, Number(layer?.width) || mapWidth),
      data: Array.isArray(layer?.data) ? [...layer.data] : new Array(mapWidth * mapHeight).fill(0),
      props: layer?.props ? { ...layer.props } : {}
    }
    const snapshotLayer = chunkSnapshot?.layers?.[layerIndex]
    const snapshotData = Array.isArray(snapshotLayer?.data) ? snapshotLayer.data : []
    const snapshotWidth = Math.max(1, Number(snapshotLayer?.width) || bounds.width)

    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        const logicalIndex = (bounds.worldY + y) * nextLayer.width + bounds.worldX + x
        const snapshotIndex = y * snapshotWidth + x
        nextLayer.data[logicalIndex] = Number(snapshotData[snapshotIndex]) || 0
      }
    }

    nextLayer.props = {
      ...(nextLayer.props || {}),
      ...(snapshotLayer?.props || {})
    }

    return nextLayer
  })
  return logical
}

export function resizeLogicalTilemap(tilemap, nextWidth, nextHeight) {
  const logical = cloneTilemap(tilemap)
  const width = Math.max(1, Number(nextWidth) || 1)
  const height = Math.max(1, Number(nextHeight) || 1)

  logical.layers = logical.layers.map((layer) => {
    const previousWidth = Math.max(1, Number(layer?.width) || width)
    const previousData = Array.isArray(layer?.data) ? layer.data : []
    const nextData = new Array(width * height).fill(0)
    const previousHeight = Math.max(0, Math.ceil(previousData.length / previousWidth))
    const copyWidth = Math.min(previousWidth, width)
    const copyHeight = Math.min(previousHeight, height)

    for (let y = 0; y < copyHeight; y++) {
      for (let x = 0; x < copyWidth; x++) {
        nextData[y * width + x] = Number(previousData[y * previousWidth + x]) || 0
      }
    }

    return {
      ...layer,
      props: layer?.props ? { ...layer.props } : {},
      width,
      data: nextData
    }
  })

  return logical
}

export function insertLogicalLayer(tilemap, index, name) {
  const logical = cloneTilemap(tilemap)
  const layerIndex = Math.max(0, Math.min(logical.layers.length, Number(index) || 0))
  const width = Math.max(1, Number(logical.layers[0]?.width) || 1)
  const height = Math.max(1, Math.ceil((logical.layers[0]?.data?.length || width) / width))
  logical.layers.splice(layerIndex, 0, {
    width,
    data: new Array(width * height).fill(0),
    props: { name: String(name || `layer ${layerIndex + 1}`) }
  })
  return logical
}

export function deleteLogicalLayer(tilemap, index) {
  const logical = cloneTilemap(tilemap)
  if (logical.layers.length <= 1) return logical
  logical.layers = logical.layers.filter((_layer, layerIndex) => layerIndex !== index)
  return logical
}

export function moveLogicalLayer(tilemap, fromIndex, toIndex) {
  const logical = cloneTilemap(tilemap)
  if (fromIndex < 0 || fromIndex >= logical.layers.length) return logical
  if (toIndex < 0 || toIndex >= logical.layers.length) return logical
  const [layer] = logical.layers.splice(fromIndex, 1)
  logical.layers.splice(toIndex, 0, layer)
  return logical
}

export function buildChunkedTilemapProjection(tilemap, mapWidth, mapHeight, chunkSize = STB_EDITOR_CHUNK_SIZE) {
  const logical = cloneTilemap(tilemap)
  const width = Math.max(1, Number(mapWidth) || 1)
  const height = Math.max(1, Number(mapHeight) || 1)
  const size = Math.max(1, Number(chunkSize) || 1)
  const { cols, rows, count } = getChunkGrid(width, height, size)
  const chunks = []

  for (let chunkY = 0; chunkY < rows; chunkY++) {
    for (let chunkX = 0; chunkX < cols; chunkX++) {
      const snapshot = buildChunkTilemapSnapshot(logical, width, height, chunkX, chunkY, size)
      const payload = encodeChunkSnapshotPayload(snapshot, size)
      chunks.push({
        layers: snapshot.layers.map((_layer, layerIndex) => payload.subarray(layerIndex * size * size, (layerIndex + 1) * size * size))
      })
    }
  }

  return {
    version: STB_EDITOR_CHUNK_EXPORT_VERSION,
    mapWidth: width,
    mapHeight: height,
    layerCount: logical.layers.length,
    chunkSize: size,
    chunkCount: count,
    chunks
  }
}

export function getChunkedTilemapProjectionBodyBytes(projection) {
  const layerCount = Math.max(1, Number(projection?.layerCount) || 1)
  const chunkSize = Math.max(1, Number(projection?.chunkSize) || 1)
  const chunkCount = Math.max(0, Number(projection?.chunkCount) || 0)
  return chunkCount * layerCount * chunkSize * chunkSize * Uint16Array.BYTES_PER_ELEMENT
}

export function getChunkedTilemapProjectionByteLength(projection) {
  return STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE + getChunkedTilemapProjectionBodyBytes(projection)
}

export function writeChunkedTilemapProjectionToMemory(memory, basePtr, projection) {
  const ptr = Math.max(0, Number(basePtr) || 0)
  const byteLength = getChunkedTilemapProjectionByteLength(projection)
  const bodyPtr = ptr + STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE
  const view = new DataView(memory.buffer, ptr, byteLength)

  view.setUint32(0, Number(projection?.version) || STB_EDITOR_CHUNK_EXPORT_VERSION, true)
  view.setUint32(4, Math.max(1, Number(projection?.mapWidth) || 1), true)
  view.setUint32(8, Math.max(1, Number(projection?.mapHeight) || 1), true)
  view.setUint32(12, Math.max(1, Number(projection?.layerCount) || 1), true)
  view.setUint32(16, Math.max(1, Number(projection?.chunkSize) || 1), true)
  view.setUint32(20, Math.max(0, Number(projection?.chunkCount) || 0), true)
  view.setUint32(24, bodyPtr, true)

  let offset = STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE
  for (const chunk of projection?.chunks || []) {
    for (const layer of chunk?.layers || []) {
      const data = layer instanceof Uint16Array ? layer : Uint16Array.from(layer || [])
      new Uint16Array(memory.buffer, ptr + offset, data.length).set(data)
      offset += data.length * Uint16Array.BYTES_PER_ELEMENT
    }
  }

  return {
    headerPtr: ptr,
    bodyPtr,
    byteLength
  }
}

export function readChunkedTilemapProjectionFromMemory(memory, headerPtr = 0) {
  const ptr = Math.max(0, Number(headerPtr) || 0)
  const header = new DataView(memory.buffer, ptr, STB_EDITOR_CHUNK_EXPORT_HEADER_SIZE)
  const version = header.getUint32(0, true)
  const mapWidth = header.getUint32(4, true)
  const mapHeight = header.getUint32(8, true)
  const layerCount = header.getUint32(12, true)
  const chunkSize = header.getUint32(16, true)
  const chunkCount = header.getUint32(20, true)
  const chunkDataPtr = header.getUint32(24, true)
  const perLayer = chunkSize * chunkSize
  const perChunk = perLayer * layerCount
  const body = new Uint16Array(memory.buffer, chunkDataPtr, perChunk * chunkCount)
  const chunks = []

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const layers = []
    for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
      const start = (chunkIndex * perChunk) + (layerIndex * perLayer)
      layers.push(body.subarray(start, start + perLayer))
    }
    chunks.push({ layers })
  }

  return {
    version,
    mapWidth,
    mapHeight,
    layerCount,
    chunkSize,
    chunkCount,
    chunkDataPtr,
    chunks
  }
}

export function forEachChunkedProjectionChunk(projection, callback) {
  const mapWidth = Math.max(1, Number(projection?.mapWidth) || 1)
  const mapHeight = Math.max(1, Number(projection?.mapHeight) || 1)
  const chunkSize = Math.max(1, Number(projection?.chunkSize) || 1)
  const chunks = Array.isArray(projection?.chunks) ? projection.chunks : []

  chunks.forEach((chunk, index) => {
    const { chunkX, chunkY } = getChunkPositionForIndex(mapWidth, mapHeight, index, chunkSize)
    const bounds = getChunkBounds(mapWidth, mapHeight, chunkX, chunkY, chunkSize)
    callback({ index, chunkX, chunkY, bounds, chunk })
  })
}

export function materializeChunkedProjectionToTilemap(projection, layerProps = projection?.layerProps || []) {
  const mapWidth = Math.max(1, Number(projection?.mapWidth) || 1)
  const mapHeight = Math.max(1, Number(projection?.mapHeight) || 1)
  const layerCount = Math.max(1, Number(projection?.layerCount) || 1)
  const chunkSize = Math.max(1, Number(projection?.chunkSize) || 1)
  const layers = Array.from({ length: layerCount }, (_value, layerIndex) => ({
    width: mapWidth,
    data: new Array(mapWidth * mapHeight).fill(0),
    props: { ...(layerProps[layerIndex] || {}) }
  }))

  forEachChunkedProjectionChunk(projection, ({ bounds, chunk }) => {
    for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
      const source = chunk?.layers?.[layerIndex]
      if (!source) continue
      for (let y = 0; y < bounds.height; y++) {
        for (let x = 0; x < bounds.width; x++) {
          const targetIndex = (bounds.worldY + y) * mapWidth + bounds.worldX + x
          const sourceIndex = (y * chunkSize) + x
          layers[layerIndex].data[targetIndex] = Number(source[sourceIndex]) || 0
        }
      }
    }
  })

  return {
    layers,
    props: {
      ...(projection?.props || {}),
      chunked: '1',
      chunkSize: String(chunkSize)
    }
  }
}
