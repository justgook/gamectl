// Build tilemap binary for opcode 3
// Format per layer:
// [opcode: u16 = 3]
// [position_x: f32] [position_y: f32]
// [tile_size_x: f32] [tile_size_y: f32]
// [tileset_uv_index: u32] [lut_uv_index: u32]
// [map_width: u32] [map_height: u32]

const tilemaps = $in.tilemaps || []
const lutImages = $in.lutImages || []

// Parse pack result to get UV indices
let packResult = null
if ($in.packResult?.output) {
  const decoder = new TextDecoder()
  packResult = JSON.parse(decoder.decode($in.packResult.output))
}

// Build name -> UV index mapping from placements
const uvIndexMap = new Map()
if (packResult?.placements) {
  for (let i = 0; i < packResult.placements.length; i++) {
    uvIndexMap.set(packResult.placements[i].name, i)
  }
}

const b = bytes()
const layerRecords = []

for (const tilemap of tilemaps) {
  for (let layerIdx = 0; layerIdx < tilemap.layers.length; layerIdx++) {
    const layer = tilemap.layers[layerIdx]
    const [tw, th] = (layer.sizeKey || '16x16').split('x').map(Number)
    const width = layer.width
    const height = Math.ceil(layer.data.length / width)

    // Find UV indices
    const tilesetName = `tileset_${layer.sizeKey}`
    const lutName = `lut_${tilemap.name}_layer${layerIdx}`
    const tilesetUvIndex = uvIndexMap.get(tilesetName) ?? 0
    const lutUvIndex = uvIndexMap.get(lutName) ?? 0

    // Position (default to 0,0 - can be extended later)
    const posX = 0
    const posY = 0

    // Write opcode 3 record
    b.setUint16(3) // opcode
    b.setFloat32(posX)
    b.setFloat32(posY)
    b.setFloat32(tw)
    b.setFloat32(th)
    b.setUint32(tilesetUvIndex)
    b.setUint32(lutUvIndex)
    b.setUint32(width)
    b.setUint32(height)

    layerRecords.push({
      mapName: tilemap.name,
      layerIndex: layerIdx,
      position: [posX, posY],
      tileSize: [tw, th],
      tilesetUvIndex,
      lutUvIndex,
      dimensions: [width, height]
    })
  }
}

const buffer = b.commit()
$out.binary = new Uint8Array(buffer).toBase64()
$out.metadata = {
  layerCount: layerRecords.length,
  layers: layerRecords,
  packResult
}
