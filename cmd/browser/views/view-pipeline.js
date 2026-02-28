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
    this.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3);">
        <details>
          <summary>1. Create World Tree</summary>
          <form name="tree" style="display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3);">
            <label>Node Count: <span>10</span> <input type="range" name="nodeCount" min="5" max="100" value="10" oninput="this.previousElementSibling.textContent=this.value"></label>
            <label>Max Depth: <span>0</span> <input type="range" name="maxDepth" min="0" max="10" value="0" oninput="this.previousElementSibling.textContent=this.value"></label>
            <label>Max Branching: <span>0</span> <input type="range" name="maxBranching" min="0" max="10" value="0" oninput="this.previousElementSibling.textContent=this.value"></label>
            <label>Root Branches: <span>0</span> <input type="range" name="rootBranches" min="0" max="20" value="0" oninput="this.previousElementSibling.textContent=this.value"></label>
            <label>Output Name: <input type="text" name="treeId" value="progression"></label>
            <button type="submit">Generate Tree</button>
          </form>
        </details>
        <details>
          <summary>2. Assign Biomes</summary>
          <form name="biomes" style="display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3);">
            <label>Tree ID: <input type="text" name="treeId" value="progression"></label>
            <label>Biomes Query: <input type="text" name="biomesQuery" value="SELECT name FROM biomes ORDER BY RANDOM()" style="width: 100%;"></label>
            <button type="submit">Assign Biomes</button>
          </form>
        </details>
        <details>
          <summary>3. Assign Keys & Locks</summary>
          <form name="keylock" style="display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3);">
            <label>Tree ID: <input type="text" name="treeId" value="progression"></label>
            <label>Keys Query: <input type="text" name="keysQuery" value="SELECT name FROM keys ORDER BY RANDOM() LIMIT 15" style="width: 100%;"></label>
            <label>Key Chance: <span>0.5</span> <input type="range" name="keyChance" min="0" max="1" step="0.1" value="0.5" oninput="this.previousElementSibling.textContent=this.value"></label>
            <label>Lock Chance: <span>0.7</span> <input type="range" name="lockChance" min="0" max="1" step="0.1" value="0.7" oninput="this.previousElementSibling.textContent=this.value"></label>
            <label>Max Keys Per Lock: <span>2</span> <input type="range" name="maxKeysPerLock" min="1" max="5" value="2" oninput="this.previousElementSibling.textContent=this.value"></label>
            <button type="submit">Assign Keys & Locks</button>
          </form>
        </details>
        <details open>
          <summary>4. Create Minimap</summary>
          <form name="minimap" style="display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3);">
            <label>Input Tree: <input type="text" name="inputTreeId" value="progression"></label>
            <label>Output Map: <input type="text" name="mapId" value="new_map"></label>
            <label>Layout Direction:
              <select name="direction">
                <option value="radial" selected>Radial</option>
                <option value="topDown">Top Down</option>
                <option value="bottomUp">Bottom Up</option>
                <option value="leftToRight">Left to Right</option>
                <option value="rightToLeft">Right to Left</option>
                <option value="directional">Directional</option>
              </select>
            </label>
            <button type="submit">Generate Minimap</button>
          </form>
        </details>
        <details>
          <summary>5. Apply Automap Rules</summary>
          <form name="automap" style="display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3);">
            <label>Rules Map: <input type="text" name="rulesMapId" value="rules"></label>
            <label>Input Map: <input type="text" name="inputMapId" value="new_map"></label>
            <label>Output Map: <input type="text" name="outputMapId" value="automap_result"></label>
            <button type="submit">Apply Automap</button>
          </form>
        </details>
      </div>
    `

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
