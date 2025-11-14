export async function develop() {
  pluginManager.rawCall('random', 'setSeed', 27)
  const rrr = pluginManager.rawCall('random', 'seed')
  console.log(rrr)

  const balancedTree = {
    "nodeCount": 50,
    "maxDepth": 6,
    "maxBranching": 3,
    "minBranching": 1,
    "shapeBias": 0,
    "density": 0.7,
    "rootBranches": 0,
    "leafRatio": 0.4,
  }

  const treeName = "progresion"

  // generate initial tree
  const treeResult = await pluginManager.call("treegen", "gen", JSON.stringify({ name: treeName, ...balancedTree }))
  const DE = new TextDecoder()
  let data = DE.decode(treeResult.output)
  console.log(JSON.parse(data))
  console.log(3333)
  let treeResult2 = await pluginManager.call("tree-storage2", "get", `{"id": "${treeName}"}`)
  data = DE.decode(treeResult2.output)
  let worldTree = JSON.parse(data)
  console.log(treeResult2, worldTree)


  // assign biome names to tree

  // const biomes = await (await fetch("./data/biomes.json")).json();
  // worldTree.forEach(a => a.data = { name: biomes.splice(Math.floor(Math.random() * biomes.length), 1)[0].name })
  //
  // treeResult2 = await pluginManager.call("tree-storage2", "set", JSON.stringify({ id: treeName, tree: worldTree }))
  //
  // treeResult2 = await pluginManager.call("tree-storage2", "get", `{"id": "${treeName}"}`)
  // data = DE.decode(treeResult2.output)
  // worldTree = JSON.parse(data)
  // console.log("UPDATED IN BASE", treeResult2, worldTree)

}
