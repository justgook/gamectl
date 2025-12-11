import { bus } from "../systems/event-bus.js"

export class ViewPipeline extends HTMLElement {
  constructor() {
    super()
    this.DE = new TextDecoder()
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '100%'
    
    const template = document.getElementById('view-pipeline')
    const content = template.content.cloneNode(true)
    this.appendChild(content)
    
    this.querySelector('form[name="tree"]')
      ?.addEventListener('submit', (e) => this.generateWorldTree(e))
    this.querySelector('form[name="minimap"]')
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
    console.log('[Plugin]', this.DE.decode(result.output))
  }

  async generateMinimap(e) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.target))
    const result = await pluginManager.call("minimap", "gen", JSON.stringify({
      treeId: data.inputTreeId,
      mapId: data.mapId
    }))

    console.log('[Plugin]', this.DE.decode(result.output))

    bus.emit(`cache:load:SELECT data FROM tilemap_storage WHERE name = '${data.mapId}'`)
  }
}
