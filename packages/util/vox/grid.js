function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function paletteFromSymbolColors(symbolColors) {
  assert(symbolColors && typeof symbolColors === "object" && !Array.isArray(symbolColors), "paletteFromSymbolColors requires symbol color map")
  const symbols = Object.keys(symbolColors)
  assert(symbols.length > 0, "paletteFromSymbolColors requires at least one color")
  const palette = new Uint8Array(symbols.length * 4)
  const symbolToPaletteIndex = new Map()
  symbols.forEach((symbol, index) => {
    const hex = String(symbolColors[symbol]).replace(/^#/, "")
    assert(/^[0-9a-fA-F]{6}$/.test(hex), `invalid color for symbol ${symbol}`)
    palette[index * 4] = Number.parseInt(hex.slice(0, 2), 16)
    palette[index * 4 + 1] = Number.parseInt(hex.slice(2, 4), 16)
    palette[index * 4 + 2] = Number.parseInt(hex.slice(4, 6), 16)
    palette[index * 4 + 3] = 255
    symbolToPaletteIndex.set(symbol, index)
  })
  return { palette, paletteWidth: symbols.length, symbolToPaletteIndex }
}

export function voxelRenderDataFromIndexedGrid(grid, { symbolToPaletteIndex, palette, paletteWidth, transparent } = {}) {
  assert(grid && typeof grid === "object" && !Array.isArray(grid), "voxel grid must be object")
  assert(Number.isInteger(grid.width) && grid.width > 0, "voxel grid width must be positive integer")
  assert(Number.isInteger(grid.height) && grid.height > 0, "voxel grid height must be positive integer")
  assert(Number.isInteger(grid.depth) && grid.depth > 0, "voxel grid depth must be positive integer")
  assert(Array.isArray(grid.cells), "voxel grid cells must be array")
  assert(typeof grid.values === "string", "voxel grid values must be string")
  assert(symbolToPaletteIndex instanceof Map, "voxel grid requires symbolToPaletteIndex Map")
  assert(palette instanceof Uint8Array, "voxel grid requires palette Uint8Array")
  assert(Number.isInteger(paletteWidth) && paletteWidth > 0, "voxel grid requires paletteWidth")
  assert(typeof transparent === "string", "voxel grid requires transparent symbols string")
  const total = grid.width * grid.height * grid.depth
  assert(grid.cells.length >= total, "voxel grid cells length does not match dimensions")
  const transparentSet = new Set([...transparent])
  let count = 0
  for (let i = 0; i < total; i += 1) {
    const symbol = grid.values[grid.cells[i]]
    assert(typeof symbol === "string", `voxel grid cell ${i} references missing symbol`)
    if (!transparentSet.has(symbol)) count += 1
  }
  const instances = new Float32Array(count * 4)
  let o = 0
  for (let z = 0; z < grid.depth; z += 1) {
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const index = x + y * grid.width + z * grid.width * grid.height
        const symbol = grid.values[grid.cells[index]]
        if (transparentSet.has(symbol)) continue
        const paletteIndex = symbolToPaletteIndex.get(symbol)
        assert(Number.isInteger(paletteIndex), `voxel grid symbol ${symbol} missing palette color`)
        instances[o++] = x
        instances[o++] = z
        instances[o++] = y
        instances[o++] = paletteIndex
      }
    }
  }
  return { bounds: { width: grid.width, height: grid.depth, depth: grid.height }, instances, palette, paletteWidth }
}
