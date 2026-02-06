// Extract unique tiles from all tilemaps, grouped by tile size
// Track original tile ID -> new sequential ID mapping
const tilemaps = $in.tilemaps || []

// Group tiles by size: Map<"WxH", Map<dedupeKey, tileInfo>>
const tilesBySize = new Map()
const nextIdBySize = new Map()

// Process all tilemaps and build deduplicated tile sets
const processedMaps = []

for (const tilemap of tilemaps) {
  const processedLayers = []

  for (const layer of tilemap.layers || []) {
    const tw = parseFloat(layer.props?.tw) || 16
    const th = parseFloat(layer.props?.th) || 16
    const sizeKey = `${tw}x${th}`
    const tilesetPath = layer.props?.tileset || ''

    // Initialize size group if needed
    if (!tilesBySize.has(sizeKey)) {
      tilesBySize.set(sizeKey, new Map())
      nextIdBySize.set(sizeKey, 1) // Start from 1 (0 = empty)
    }

    const tilesForSize = tilesBySize.get(sizeKey)
    const newData = []

    // Process each tile in the layer
    for (let i = 0; i < layer.data.length; i++) {
      const originalId = layer.data[i]

      // Empty tile stays 0
      if (originalId === 0) {
        newData.push(0)
        continue
      }

      // Deduplication key: tileset + original tile ID
      const dedupeKey = `${tilesetPath}:${originalId}:${tw}:${th}`

      // Check if we've seen this tile before
      let tileInfo = tilesForSize.get(dedupeKey)

      if (!tileInfo) {
        // New tile - assign next sequential ID
        const newId = nextIdBySize.get(sizeKey)
        nextIdBySize.set(sizeKey, newId + 1)

        tileInfo = {
          originalId,
          newId,
          tilesetPath,
          tileW: tw,
          tileH: th,
          dedupeKey
        }
        tilesForSize.set(dedupeKey, tileInfo)
      }

      newData.push(tileInfo.newId)
    }

    processedLayers.push({
      ...layer,
      originalData: layer.data,
      data: newData,
      sizeKey
    })
  }

  processedMaps.push({
    name: tilemap.name,
    layers: processedLayers
  })
}

// Convert Maps to arrays for output
const tilesBySizeArray = []
for (const [sizeKey, tiles] of tilesBySize) {
  tilesBySizeArray.push({
    sizeKey,
    tiles: Array.from(tiles.values())
  })
}

$out.extractedData = {
  tilesBySize: tilesBySizeArray,
  tilemaps: processedMaps
}
