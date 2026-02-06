// Build animation binary matching Odin AnimationAtlas format
// Binary format:
// Header: Uint16(magic=2), Uint32(def_count), Uint32(frame_count)
// Data: [AnimDef x def_count], [AnimFrame x frame_count]
//
// AnimDef (12 bytes): Int32 frame_start, Int32 frame_count, Uint8 looping, Uint8[3] padding
// AnimFrame (20 bytes): Int32 uv_index, Int32 offset[0], Int32 offset[1], Float32 duration, Uint8 flip, Uint8[3] padding

const animations = $in.data || []
const packResult = $in.packResult

// Build tileId -> uvIndex mapping from atlas placements
const uvMap = new Map()
if (packResult?.placements) {
  for (let i = 0; i < packResult.placements.length; i++) {
    const p = packResult.placements[i]
    uvMap.set(p.name, i) // name is "sourceFile:tileId:tileW:tileH"
  }
}

// Collect all AnimDefs and AnimFrames
const defs = []
const frames = []

for (const anim of animations) {
  const animData = JSON.parse(anim.data)
  const sourceFile = anim.source_file
  const tileW = +anim.tile_width
  const tileH = +anim.tile_height

  const def = {
    frame_start: frames.length,
    frame_count: animData.frames.length,
    looping: animData.loop !== false
  }
  defs.push(def)

  for (const frame of animData.frames) {
    const key = `${sourceFile}:${frame.tileId}:${tileW}:${tileH}`
    const uvIndex = uvMap.get(key) ?? -1

    frames.push({
      uv_index: uvIndex,
      offset: [0, 0], // TODO: Calculate from trim data in stage 2
      duration: frame.duration / 1000, // ms -> seconds
      flip: frame.flip || 0 // Flip flags from animation editor (0-7)
    })
  }
}

// Build binary
const b = bytes()

// Header (10 bytes)
b.setUint16(2) // magic: animations
b.setUint32(defs.length)
b.setUint32(frames.length)

// AnimDefs (12 bytes each)
for (const def of defs) {
  b.setUint32(def.frame_start)
  b.setUint32(def.frame_count)
  b.setUint8(def.looping ? 1 : 0)
  b.setUint8(0) // padding
  b.setUint8(0)
  b.setUint8(0)
}

// AnimFrames (20 bytes each)
for (const frame of frames) {
  b.setUint32(frame.uv_index)
  b.setInt32(frame.offset[0])
  b.setInt32(frame.offset[1])
  b.setFloat32(frame.duration)
  b.setUint8(frame.flip)
  b.setUint8(0) // padding
  b.setUint8(0)
  b.setUint8(0)
}

const buffer = b.commit()
$out.binary = new Uint8Array(buffer).toBase64()
$out.metadata = { defCount: defs.length, frameCount: frames.length, defs, frames }
