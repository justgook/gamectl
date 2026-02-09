import { bus } from "../systems/event-bus.js"
import { toast } from "../systems/toast.js"

export class ViewPipeline extends HTMLElement {
  static get viewMeta() { return { displayName: 'Pipeline', category: 'Utilities' } }

  constructor() {
    super()
    this.DE = new TextDecoder()
    // Track which steps have been completed
    this.completedSteps = {
      tree: false,
      biomes: false,
      keylock: false,
      minimap: false,
      automap: false
    }
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
    this.querySelector('form[name="biomes"]')
      ?.addEventListener('submit', (e) => this.handleBiomesSubmit(e))
    this.querySelector('form[name="keylock"]')
      ?.addEventListener('submit', (e) => this.handleKeylockSubmit(e))
    this.querySelector('form[name="minimap"]')
      ?.addEventListener('submit', (e) => this.handleMinimapSubmit(e))
    this.querySelector('form[name="automap"]')
      ?.addEventListener('submit', (e) => this.handleAutomapSubmit(e))
  }

  async generateWorldTree(e, skipToast = false) {
    if (e) e.preventDefault()

    const form = this.querySelector('form[name="tree"]')
    const data = Object.fromEntries(new FormData(form))

    try {
      const result = await pluginManager.call("treegen", "gen", JSON.stringify({
        name: data.treeId,
        nodeCount: +data.nodeCount,
        maxDepth: +data.maxDepth,
        maxBranching: +data.maxBranching,
        rootBranches: +data.rootBranches
      }))

      const response = JSON.parse(this.DE.decode(result.output))

      if (response.success) {
        this.completedSteps.tree = true
        if (!skipToast) {
          toast.success(`World tree generated: ${data.treeId}`, { duration: 3000 })
        }
        console.log('[Tree] Success:', response)
        return { success: true, treeId: data.treeId }
      } else {
        toast.error(`Tree generation failed: ${response.error || 'Unknown error'}`, { duration: 5000 })
        console.error('[Tree] Error:', response)
        return { success: false, error: response.error }
      }
    } catch (error) {
      toast.error(`Tree generation error: ${error.message}`, { duration: 5000 })
      console.error('[Tree] Exception:', error)
      return { success: false, error: error.message }
    }
  }

  async generateMinimap(e, skipToast = false) {
    if (e) e.preventDefault()

    const form = this.querySelector('form[name="minimap"]')
    const data = Object.fromEntries(new FormData(form))

    try {
      const result = await pluginManager.call("minimap2", "gen", JSON.stringify({
        treeId: data.inputTreeId,
        mapId: data.mapId,
        direction: data.direction || 'radial'
      }))

      const response = JSON.parse(this.DE.decode(result.output))

      if (response.success) {
        this.completedSteps.minimap = true
        if (!skipToast) {
          toast.success(`Minimap generated: ${data.mapId}`, { duration: 3000 })
        }
        console.log('[Minimap] Success:', response)

        // Reload the map in cache/views
        bus.emit(`cache:load:SELECT data FROM tilemap_storage WHERE name = '${data.mapId}'`)
        return { success: true, mapId: data.mapId }
      } else {
        toast.error(`Minimap generation failed: ${response.error || 'Unknown error'}`, { duration: 5000 })
        console.error('[Minimap] Error:', response)
        return { success: false, error: response.error }
      }
    } catch (error) {
      toast.error(`Minimap generation error: ${error.message}`, { duration: 5000 })
      console.error('[Minimap] Exception:', error)
      return { success: false, error: error.message }
    }
  }

  async handleBiomesSubmit(e) {
    e.preventDefault()

    // Auto-generate tree if not done yet
    if (!this.completedSteps.tree) {
      toast.info('Generating world tree first...', { duration: 2000 })
      const treeResult = await this.generateWorldTree(null, true)
      if (!treeResult.success) {
        return // Stop if tree generation failed
      }
    }

    // Generate biomes
    await this.generateBiomes(null, false)
  }

  async generateBiomes(e, skipToast = false) {
    if (e) e.preventDefault()

    const form = this.querySelector('form[name="biomes"]')
    const data = Object.fromEntries(new FormData(form))

    try {
      const result = await pluginManager.call("biomes", "gen", JSON.stringify({
        treeId: data.treeId,
        biomesQuery: data.biomesQuery
      }))

      const response = JSON.parse(this.DE.decode(result.output))

      if (response.success) {
        this.completedSteps.biomes = true
        if (!skipToast) {
          toast.success(`Biomes assigned to: ${data.treeId}`, { duration: 3000 })
        }
        console.log('[Biomes] Success:', response)
        return { success: true, treeId: data.treeId }
      } else {
        toast.error(`Biomes failed: ${response.error || 'Unknown error'}`, { duration: 5000 })
        console.error('[Biomes] Error:', response)
        return { success: false, error: response.error }
      }
    } catch (error) {
      toast.error(`Biomes error: ${error.message}`, { duration: 5000 })
      console.error('[Biomes] Exception:', error)
      return { success: false, error: error.message }
    }
  }

  async handleKeylockSubmit(e) {
    e.preventDefault()

    // Auto-generate tree if not done yet
    if (!this.completedSteps.tree) {
      toast.info('Generating world tree first...', { duration: 2000 })
      const treeResult = await this.generateWorldTree(null, true)
      if (!treeResult.success) {
        return // Stop if tree generation failed
      }
    }

    // Auto-generate biomes if not done yet
    if (!this.completedSteps.biomes) {
      toast.info('Assigning biomes...', { duration: 2000 })
      const biomesResult = await this.generateBiomes(null, true)
      if (!biomesResult.success) {
        return // Stop if biomes failed
      }
    }

    // Generate keylock
    await this.generateKeylock(null, false)
  }

  async generateKeylock(e, skipToast = false) {
    if (e) e.preventDefault()

    const form = this.querySelector('form[name="keylock"]')
    const data = Object.fromEntries(new FormData(form))

    try {
      const result = await pluginManager.call("keylock", "gen", JSON.stringify({
        treeId: data.treeId,
        keysQuery: data.keysQuery,
        keyChance: +data.keyChance,
        lockChance: +data.lockChance,
        maxKeysPerLock: +data.maxKeysPerLock
      }))

      const response = JSON.parse(this.DE.decode(result.output))

      if (response.success) {
        this.completedSteps.keylock = true
        if (!skipToast) {
          toast.success(`Keys and locks assigned to: ${data.treeId}`, { duration: 3000 })
        }
        console.log('[Keylock] Success:', response)
        return { success: true, treeId: data.treeId }
      } else {
        toast.error(`Keylock failed: ${response.error || 'Unknown error'}`, { duration: 5000 })
        console.error('[Keylock] Error:', response)
        return { success: false, error: response.error }
      }
    } catch (error) {
      toast.error(`Keylock error: ${error.message}`, { duration: 5000 })
      console.error('[Keylock] Exception:', error)
      return { success: false, error: error.message }
    }
  }

  async handleMinimapSubmit(e) {
    e.preventDefault()

    // Auto-generate tree if not done yet
    if (!this.completedSteps.tree) {
      toast.info('Generating world tree first...', { duration: 2000 })
      const treeResult = await this.generateWorldTree(null, true)
      if (!treeResult.success) {
        return // Stop if tree generation failed
      }
    }

    // Auto-generate biomes if not done yet
    if (!this.completedSteps.biomes) {
      toast.info('Assigning biomes...', { duration: 2000 })
      const biomesResult = await this.generateBiomes(null, true)
      if (!biomesResult.success) {
        return // Stop if biomes failed
      }
    }

    // Auto-generate keylock if not done yet
    if (!this.completedSteps.keylock) {
      toast.info('Assigning keys and locks...', { duration: 2000 })
      const keylockResult = await this.generateKeylock(null, true)
      if (!keylockResult.success) {
        return // Stop if keylock failed
      }
    }

    // Generate minimap
    await this.generateMinimap(null, false)
  }

  async handleAutomapSubmit(e) {
    e.preventDefault()

    // Auto-generate tree if not done yet
    if (!this.completedSteps.tree) {
      toast.info('Generating world tree first...', { duration: 2000 })
      const treeResult = await this.generateWorldTree(null, true)
      if (!treeResult.success) {
        return // Stop if tree generation failed
      }
    }

    // Auto-generate biomes if not done yet
    if (!this.completedSteps.biomes) {
      toast.info('Assigning biomes...', { duration: 2000 })
      const biomesResult = await this.generateBiomes(null, true)
      if (!biomesResult.success) {
        return // Stop if biomes failed
      }
    }

    // Auto-generate keylock if not done yet
    if (!this.completedSteps.keylock) {
      toast.info('Assigning keys and locks...', { duration: 2000 })
      const keylockResult = await this.generateKeylock(null, true)
      if (!keylockResult.success) {
        return // Stop if keylock failed
      }
    }

    // Auto-generate minimap if not done yet
    if (!this.completedSteps.minimap) {
      toast.info('Generating minimap...', { duration: 2000 })
      const minimapResult = await this.generateMinimap(null, true)
      if (!minimapResult.success) {
        return // Stop if minimap generation failed
      }
    }

    // Generate automap
    await this.generateAutomap(null, false)
  }

  async generateAutomap(e, skipToast = false) {
    if (e) e.preventDefault()

    const form = this.querySelector('form[name="automap"]')
    const data = Object.fromEntries(new FormData(form))

    try {
      const result = await pluginManager.call("automap", "automap", JSON.stringify({
        rulesMapId: data.rulesMapId,
        inputMapId: data.inputMapId,
        outputMapId: data.outputMapId
      }))

      const response = JSON.parse(this.DE.decode(result.output))

      if (response.success) {
        this.completedSteps.automap = true
        if (!skipToast) {
          toast.success(`Automap generated: ${response.outputMapId}`, { duration: 4000 })
        }
        console.log('[Automap] Success:', response)

        // Reload the output map in cache/views
        bus.emit(`cache:load:SELECT data FROM tilemap_storage WHERE name = '${response.outputMapId}'`)
        return { success: true, outputMapId: response.outputMapId }
      } else {
        toast.error(`Automap failed: ${response.error}`, { duration: 5000 })
        console.error('[Automap] Error:', response.error)
        return { success: false, error: response.error }
      }
    } catch (error) {
      toast.error(`Automap error: ${error.message}`, { duration: 5000 })
      console.error('[Automap] Exception:', error)
      return { success: false, error: error.message }
    }
  }
}

export default ViewPipeline
