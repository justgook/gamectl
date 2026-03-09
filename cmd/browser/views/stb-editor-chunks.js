export const STB_EDITOR_CHUNK_SIZE = 256

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
      chunks.push({
        layers: snapshot.layers.map((layer) => Uint16Array.from(layer.data.map((value) => Math.max(0, Number(value) || 0))))
      })
    }
  }

  return {
    version: 1,
    mapWidth: width,
    mapHeight: height,
    layerCount: logical.layers.length,
    chunkSize: size,
    chunkCount: count,
    chunks
  }
}
