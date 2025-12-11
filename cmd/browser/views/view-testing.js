import { parseCSVLines } from "../util/csv.js"

export class ViewTesting extends HTMLElement {
  constructor() {
    super()
    this.DE = new TextDecoder()
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '100%'
    
    const template = document.getElementById('view-testing')
    const content = template.content.cloneNode(true)
    this.appendChild(content)
    
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
    console.log('[Plugin]', this.DE.decode(minimapResult.output))
  }
  async getMinimap() {
    const result = await this.readFromSqlStorage("tilemap_storage", this.mapId)
    console.log('[Plugin]', JSON.stringify(result))
  }

  async getTree() {
    const result = await this.readFromSqlStorage("tree_storage", this.treeId)
    console.log('[Plugin]', JSON.stringify(result))
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
    console.log('[Plugin]', this.DE.decode(result.output))
  }

  async generateWorldgraph() {
    const balancedTree = {
      "nodeCount": 25,
      "maxDepth": 0,
      "maxBranching": 0,
      "rootBranches": 2,
    }
    const result = await pluginManager.call("treegen", "gen", JSON.stringify({ name: this.treeId, ...balancedTree }))
    console.log('[Plugin]', this.DE.decode(result.output))
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

