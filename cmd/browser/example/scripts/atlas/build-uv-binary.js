// Parse pack result
const decoder = new TextDecoder()
const resultStr = decoder.decode($in.result.output)
const result = JSON.parse(resultStr)
const { placements, atlasW, atlasH } = result

// Build binary UV data
const b = bytes()

// Header (16 bytes)
b.setUint16(1) // atlas magic
b.setUint32(placements.length) // sprite count

// UV data (16 bytes each)
for (const p of placements) {
  // If duplicate, use canonical sprite position
  const src = p.duplicateOf >= 0 ? placements[p.duplicateOf] : p
  b.setFloat32(src.x / atlasW) // min_u
  b.setFloat32(src.y / atlasH) // min_v
  b.setFloat32((src.x + src.width) / atlasW) // max_u
  b.setFloat32((src.y + src.height) / atlasH) // max_v
}

const buffer = b.commit()
$out.binary = new Uint8Array(buffer).toBase64()
$out.metadata = result // Pass through for debugging
