import { View } from "./view.js"
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
    super.connectedCallback('view-testing')
  }
  async createMinimap() {
    const result = await pluginManager.call('minimap', 'minimap', `{"treeId":"demo-world"}`)
    const result2 = await pluginManager.call('tilemap-storage', 'get', `{"id":"minimap"}`)
    await pluginManager.call('host', 'log', result2.output)

    // console.log(this.DE.decode(result2.output))
  }
  async getMinimap() {
    const result = await pluginManager.call('tilemap-storage', 'get', `{"id":"minimap"}`)
    console.log(this.DE.decode(result.output))
  }
  async getTree() {
    const result = await pluginManager.call('tree-storage', 'get', `{"id":"demo-world"}`)
    console.log(this.DE.decode(result.output))
  }
  async getTreeJSON() {
    const result = await pluginManager.call('tree-storage', 'toJSON', `{"id":"demo-world"}`)
    console.log(this.DE.decode(result.output))
  }
  async generateWorldgraph() {
    console.log('=== Phase 1: Worldgraph Generation ===');

    const biomes = {
      biomes: ["Start", "Caves", "Ruins", "Tower", "Lab", "Depths"],
      keys: ["DoubleJump", "KeyA", "KeyB", "Fireball"],
      treeId: "demo-world",
      storeTree: true
    };

    const input = JSON.stringify(biomes)
    const result = await pluginManager.call('worldgraph', 'worldgraph2', input)
    const result2 = await pluginManager.call('tree-storage', 'get', `{"id":"demo-world"}`)


    const tree = this.DE.decode(result.output)
    console.log(this.DE.decode(result2.output))

    return tree
  }
}

