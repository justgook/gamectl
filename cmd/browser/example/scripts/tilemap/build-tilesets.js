// Build reduced tileset images from extracted tiles
// Each size group becomes one tileset image
const { tilesBySize, tilemaps } = $in.extractedData || { tilesBySize: [], tilemaps: [] }
const tilesetImages = []

for (const { sizeKey, tiles } of tilesBySize) {
  if (tiles.length === 0) continue

  const [tw, th] = sizeKey.split('x').map(Number)

  // Calculate grid dimensions for reduced tileset
  const cols = Math.ceil(Math.sqrt(tiles.length))
  const rows = Math.ceil(tiles.length / cols)
  const imageW = cols * tw
  const imageH = rows * th

  // Group tiles by tileset path for efficient loading
  const tilesByTileset = new Map()
  for (const tile of tiles) {
    if (!tilesByTileset.has(tile.tilesetPath)) {
      tilesByTileset.set(tile.tilesetPath, [])
    }
    tilesByTileset.get(tile.tilesetPath).push(tile)
  }

  tilesetImages.push({
    name: `tileset_${sizeKey}`,
    sizeKey,
    tileW: tw,
    tileH: th,
    cols,
    rows,
    imageW,
    imageH,
    tiles,
    tilesByTileset: Array.from(tilesByTileset.entries()).map(([path, t]) => ({ path, tiles: t }))
  })
}

$out.tilesetImages = tilesetImages
$out.tilesBySize = tilesBySize
$out.tilemaps = tilemaps
