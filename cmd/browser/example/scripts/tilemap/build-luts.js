// Build LUT images for each tilemap layer
// Each pixel encodes a tile ID as 32-bit RGBA
const tilemaps = $in.tilemaps || []
const lutImages = []

for (const tilemap of tilemaps) {
  for (let layerIdx = 0; layerIdx < tilemap.layers.length; layerIdx++) {
    const layer = tilemap.layers[layerIdx]
    const width = layer.width
    const height = Math.ceil(layer.data.length / width)

    // Create RGBA buffer for LUT
    const pixels = new Uint8Array(width * height * 4)

    for (let i = 0; i < layer.data.length; i++) {
      const tileId = layer.data[i]
      const offset = i * 4

      // Encode tile ID as 32-bit RGBA (big-endian for readability)
      // Red = high byte, Alpha = low byte
      pixels[offset + 0] = (tileId >> 24) & 0xFF // R
      pixels[offset + 1] = (tileId >> 16) & 0xFF // G
      pixels[offset + 2] = (tileId >> 8) & 0xFF  // B
      pixels[offset + 3] = tileId & 0xFF          // A
    }

    lutImages.push({
      name: `lut_${tilemap.name}_layer${layerIdx}`,
      mapName: tilemap.name,
      layerIndex: layerIdx,
      width,
      height,
      sizeKey: layer.sizeKey,
      pixels: pixels.toBase64()
    })
  }
}

$out.lutImages = lutImages
