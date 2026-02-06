// Extract unique tiles from animation data
const rows = $in.data || []
const tiles = []
const seen = new Set()

for (const row of rows) {
  const animData = JSON.parse(row.data)
  const sourceFile = row.source_file
  const tileW = +row.tile_width
  const tileH = +row.tile_height

  for (const frame of animData.frames) {
    const key = `${sourceFile}:${frame.tileId}:${tileW}:${tileH}`
    if (!seen.has(key)) {
      seen.add(key)
      tiles.push({
        path: sourceFile,
        name: key,
        tileId: +frame.tileId,
        tileW: tileW,
        tileH: tileH
      })
    }
  }
}

$out.tiles = tiles
