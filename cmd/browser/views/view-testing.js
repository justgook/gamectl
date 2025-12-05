import { View } from "./view.js"
import { parseCSVLines } from "../util/csv.js"
export class ViewTesting extends View {
  // static get observedAttributes() { return View.observedAttributes }
  // constructor() {
  //   super()
  // }
  constructor() {
    super('view-testing')
    this.DE = new TextDecoder()
  }

  connectedCallback() {
    super.connectedCallback()
    this.treeId = "progression"
    this.mapId = "new_map"
  }

  async createMinimap() {
    const minimapInput = {
      "treeId": this.treeId,  // Required: tree to read from tree-storage
      "mapId": this.mapId,    // Required: map ID to save in tilemap-storage
      "config": {             // Optional: generation configuration
        "maxAttempts": 20,    // Maximum placement attempts per room
        "roomSpacing": 0,     // Minimum spacing between rooms
        "layoutStyle": "bfs", // Layout generation style
        "allowOverlap": false,// Allow room overlap
        "preferCompact": true // Prefer compact layouts
      }
    }
    const minimapResult = await pluginManager.call("minimap", "gen", JSON.stringify(minimapInput))
    await pluginManager.call('host', 'log', minimapResult.output)
  }
  async getMinimap() {
    const result = await this.readFromSqlStorage("tilemap_storage", this.mapId)
    await pluginManager.call('host', 'log', JSON.stringify(result))
  }

  async getTree() {
    const result = await this.readFromSqlStorage("tree_storage", this.treeId)
    await pluginManager.call('host', 'log', JSON.stringify(result))
  }

  assignBiomeNames = async () => {
    if (!this.biomesNames) {
      this.biomesNames = await (await fetch("./data/biomes.json")).json();
    }
    const biomesNames = [...this.biomesNames]
    console.log(this.biomesNames)
    const worldTree = await this.readFromSqlStorage("tree_storage", this.treeId)
    worldTree.forEach(a => a.data = { name: biomesNames.splice(Math.floor(Math.random() * biomesNames.length), 1)[0].name })

    // Store tree back via SQL
    const treeJSON = JSON.stringify(worldTree)
    const escapedData = treeJSON.replace(/'/g, "''")
    const sqlQuery = `INSERT OR REPLACE INTO tree_storage (name, data) VALUES ('${this.treeId}', '${escapedData}')`
    const result = await pluginManager.call("sql", "exec", sqlQuery)
    await pluginManager.call('host', 'log', result.output)
  }

  async generateWorldgraph() {
    const balancedTree = {
      "nodeCount": 25,
      "maxDepth": 0,
      "maxBranching": 0,
      "rootBranches": 2,
    }
    const result = await pluginManager.call("treegen", "gen", JSON.stringify({ name: this.treeId, ...balancedTree }))
    await pluginManager.call('host', 'log', result.output)
  }

  async readFromStorage(storage, id) {
    const result = await pluginManager.call(storage, "get", `{"id": "${id}"}`)
    const data = this.DE.decode(result.output)
    return JSON.parse(data)
  }

  async readFromSqlStorage(tableName, name) {
    const sqlQuery = `SELECT data FROM ${tableName} WHERE name = '${name}'`
    const result = await pluginManager.call('sql', 'query', sqlQuery)
    const csv = this.DE.decode(result.output)

    // Parse CSV to get JSON data
    const lines = parseCSVLines(csv.trim())
    if (lines.length < 2 || lines[1].length < 1) {
      throw new Error(`Data not found in ${tableName}: ${name}`)
    }

    const data = lines[1][0] // First column of second row
    return JSON.parse(data)
  }
}

