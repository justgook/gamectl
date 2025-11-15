const DE = new TextDecoder()

export async function develop() {
  pluginManager.rawCall('random', 'setSeed', 27)
  const rrr = pluginManager.rawCall('random', 'seed')
  console.log(rrr)

  const balancedTree = {
    "nodeCount": 50,
    "maxDepth": 6,
    "maxBranching": 3,
    "minBranching": 1,
    "shapeBias": 0.55,
    "density": 0.8,
    "rootBranches": 2,
    "leafRatio": 0.2,
  }


  const treeName = "progresion"

  // generate initial tree
  const treeResult = await pluginManager.call("treegen", "gen", JSON.stringify({ name: treeName, ...balancedTree }))
  let data = DE.decode(treeResult.output)
  console.log(JSON.parse(data))
  console.log(3333)
  let treeResult2 = await pluginManager.call("tree-storage2", "get", `{"id": "${treeName}"}`)
  data = DE.decode(treeResult2.output)
  let worldTree = JSON.parse(data)
  console.log(treeResult2, worldTree)


  // assign biome names to tree

  const biomes = await (await fetch("./data/biomes.json")).json();
  worldTree.forEach(a => a.data = { name: biomes.splice(Math.floor(Math.random() * biomes.length), 1)[0].name })

  treeResult2 = await pluginManager.call("tree-storage2", "set", JSON.stringify({ id: treeName, tree: worldTree }))

  treeResult2 = await pluginManager.call("tree-storage2", "get", `{"id": "${treeName}"}`)
  data = DE.decode(treeResult2.output)
  worldTree = JSON.parse(data)
  console.log("UPDATED IN BASE", treeResult2, worldTree)

  // ===============================MINIMAP==========================================
  const minimapInput = {
    "treeId": treeName,     // Required: tree to read from tree-storage2
    "mapId": "new_map",      // Required: map ID to save in tilemap-storage
    "config": {             // Optional: generation configuration
      "maxAttempts": 20,    // Maximum placement attempts per room
      "roomSpacing": 0,     // Minimum spacing between rooms
      "layoutStyle": "bfs", // Layout generation style
      "allowOverlap": false,// Allow room overlap
      "preferCompact": true // Prefer compact layouts
    }
  }
  const minimapResult = await pluginManager.call("minimap2", "gen", JSON.stringify(minimapInput))
  console.log("minimapResult", minimapResult)
  console.log(await readFromStorage("tilemap-storage", "new_map"))
}

async function readFromStorage(storage, id) {
  const result = await pluginManager.call(storage, "get", `{"id": "${id}"}`)
  const data = DE.decode(result.output)
  return JSON.parse(data)

}
