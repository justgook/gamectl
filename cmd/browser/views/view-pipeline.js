import { View } from "./view.js"

export class ViewPipeline extends View {
  constructor() {
    super('view-pipeline')
    this.DE = new TextDecoder()
  }

  connectedCallback() {
    super.connectedCallback('view-pipeline')
    this.content.querySelector('form[name="tree"]')
      ?.addEventListener('submit', (e) => this.generateWorldTree(e))
    this.content.querySelector('form[name="minimap"]')
      ?.addEventListener('submit', (e) => this.generateMinimap(e))
  }

  async generateWorldTree(e) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.target))
    const result = await pluginManager.call("treegen", "gen", JSON.stringify({
      name: data.treeId,
      nodeCount: +data.nodeCount,
      maxDepth: +data.maxDepth,
      maxBranching: +data.maxBranching,
      rootBranches: +data.rootBranches
    }))
    await pluginManager.call('host', 'log', result.output)
  }

  async generateMinimap(e) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.target))
    const result = await pluginManager.call("minimap", "gen", JSON.stringify({
      treeId: data.inputTreeId,
      mapId: data.mapId
    }))
    await pluginManager.call('host', 'log', result.output)
  }
}
