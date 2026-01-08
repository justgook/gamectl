
// Initialize event bus first
import "./systems/event-bus.js"
import { bus as eventBus } from "./systems/event-bus.js"
import { toast } from './systems/toast.js'

import "./systems/cache.js"

// current
import { ViewChrome } from "./views/chrome.js"
import { ViewEmpty } from "./views/view-empty.js"
import { ViewSplitter } from "./views/view-splitter.js"
import { LayoutParent } from "./views/layout.js"
import { ViewTree } from "./views/view-tree.js"
import { ViewConsole } from "./views/view-console.js"
import { ViewTilemap } from "./views/view-tilemap.js"
import { ViewTesting } from "./views/view-testing.js"
import { ViewPipeline } from "./views/view-pipeline.js"
import { ViewNodeGraph } from "./views/view-nodegraph.js"
import { ViewOPRUnitBuilder } from "./views/view-opr-unit-builder.js"
import { ViewSkeleton } from "./views/view-skeleton.js"
import "./views/view-timeline.js"

// Popup system
import { PopupManager } from "./views/popup-manager.js"
import { PluginManagerProxy } from "./systems/plugin-manager/proxy.js"
import { ViewPopup } from "./views/view-popup.js"

// Toast system
import { ToastManager } from "./views/toast-manager.js"
import { ViewToast } from "./views/view-toast.js"

// Node graph components
import "./views/nodegraph/node-base.js"
import "./views/nodegraph/node-input.js"
import "./views/nodegraph/node-plugin.js"
import "./views/nodegraph/node-output.js"
import "./views/nodegraph/node-tostring.js"
import "./views/nodegraph/node-fromjson.js"
import "./views/nodegraph/node-fields.js"
import "./views/nodegraph/node-popup.js"

//current stuff
customElements.define('layout-parent', LayoutParent)
customElements.define('view-empty', ViewEmpty)
customElements.define('view-testing', ViewTesting)
customElements.define('view-splitter', ViewSplitter)
customElements.define('view-tilemap', ViewTilemap)
customElements.define('view-tree', ViewTree)
customElements.define('view-console', ViewConsole)
customElements.define('view-pipeline', ViewPipeline)
customElements.define('view-opr-unit-builder', ViewOPRUnitBuilder)
// customElements.define('view-skeleton', ViewSkeleton) //already registered in file
// customElements.define('view-nodegraph', ViewNodeGraph) //already registered in file

/// THE PLUGIN MANAGER TESTING!!!
window.pluginManager = await PluginManagerProxy.create()

// Emit ready event so cache manager can process queued requests
eventBus.emit('plugin-manager:ready')

const DE = new TextDecoder()

// TESTING SQL PLUGIN WITH DUMP/RESTORE
const result2 = await window.pluginManager.call("sql", "open", "")

async function initBiomes() {
  const response = await fetch('/data/biomes.sql')
  if (!response.ok) {
    console.error('Failed to load biomes.sql:', response.statusText)
    return
  }

  const migrationSql = await response.text()

  // Execute migration (uses restore since it's a SQL script)
  const result = await window.pluginManager.call('sql', 'restore', migrationSql)
  const verifyResult = await window.pluginManager.call('sql', 'query',
    'SELECT COUNT(*) as count FROM biomes'
  )

  console.log('biomes loaded:', DE.decode(verifyResult.output))
}
await initBiomes()

async function initKeysLock() {
  const response = await fetch('/data/keys.sql')
  if (!response.ok) {
    console.error('Failed to load keys.sql:', response.statusText)
    return
  }

  const migrationSql = await response.text()

  // Execute migration (uses restore since it's a SQL script)
  const result = await window.pluginManager.call('sql', 'restore', migrationSql)
  const verifyResult = await window.pluginManager.call('sql', 'query',
    'SELECT COUNT(*) as count FROM keys'
  )

  console.log('keys loaded:', DE.decode(verifyResult.output))
}
await initKeysLock()

// Initialize Node Templates Database
async function initNodeTemplates() {
  try {
    // Fetch migration file
    const response = await fetch('/data/node-templates.sql')
    if (!response.ok) {
      console.error('Failed to load node-templates.sql:', response.statusText)
      return
    }

    const migrationSql = await response.text()

    // Execute migration (uses restore since it's a SQL script)
    const result = await window.pluginManager.call('sql', 'restore', migrationSql)
    console.log('Node templates initialized:', DE.decode(result.output))

    // Verify templates loaded
    const verifyResult = await window.pluginManager.call('sql', 'query',
      'SELECT COUNT(*) as count FROM node_templates'
    )
    console.log('Templates loaded:', DE.decode(verifyResult.output))
  } catch (error) {
    console.error('Error initializing node templates:', error)
  }
}

await initNodeTemplates()

// Initialize Tree Storage Database
async function initTreeStorage() {
  try {
    // Fetch migration file
    const response = await fetch('/data/tree-storage.sql')
    if (!response.ok) {
      console.error('Failed to load tree-storage.sql:', response.statusText)
      return
    }

    const migrationSql = await response.text()

    // Execute migration (uses restore since it's a SQL script)
    const result = await window.pluginManager.call('sql', 'restore', migrationSql)
    console.log('Tree storage initialized:', DE.decode(result.output))

    // Verify table created
    const verifyResult = await window.pluginManager.call('sql', 'query',
      'SELECT name FROM sqlite_schema WHERE type="table" AND name="tree_storage"'
    )
    console.log('Tree storage table check:', DE.decode(verifyResult.output))
  } catch (error) {
    console.error('Error initializing tree storage:', error)
  }
}

await initTreeStorage()

// Initialize Tilemap Storage Database
async function initTilemapStorage() {
  try {
    // Fetch migration file
    const response = await fetch('/data/tilemap-storage.sql')
    if (!response.ok) {
      console.error('Failed to load tilemap-storage.sql:', response.statusText)
      return
    }

    const migrationSql = await response.text()

    // Execute migration (uses restore since it's a SQL script)
    const result = await window.pluginManager.call('sql', 'restore', migrationSql)
    console.log('Tilemap storage initialized:', DE.decode(result.output))

    // Verify table created
    const verifyResult = await window.pluginManager.call('sql', 'query',
      'SELECT name FROM sqlite_schema WHERE type="table" AND name="tilemap_storage"'
    )
    console.log('Tilemap storage table check:', DE.decode(verifyResult.output))
  } catch (error) {
    console.error('Error initializing tilemap storage:', error)
  }
}

await initTilemapStorage()

// Initialize Skeleton Storage Database
async function initSkeletonStorage() {
  try {
    // Fetch migration file
    const response = await fetch('/data/skeleton-storage.sql')
    if (!response.ok) {
      console.error('Failed to load skeleton-storage.sql:', response.statusText)
      return
    }

    const migrationSql = await response.text()

    // Execute migration (uses restore since it's a SQL script)
    const result = await window.pluginManager.call('sql', 'restore', migrationSql)
    console.log('Skeleton storage initialized:', DE.decode(result.output))

    // Verify table created
    const verifyResult = await window.pluginManager.call('sql', 'query',
      'SELECT name FROM sqlite_schema WHERE type="table" AND name="skeleton_storage"'
    )
    console.log('Skeleton storage table check:', DE.decode(verifyResult.output))
  } catch (error) {
    console.error('Error initializing skeleton storage:', error)
  }
}

await initSkeletonStorage()

// Initialize Keybindings System
async function initKeybindings() {
  try {
    // Detect OS (for future multi-platform support)
    const platform = navigator.platform.toLowerCase()
    let keybindingsFile = 'keybindings-macos.sql' // Default to macOS for now

    /* Future OS detection:
    if (platform.includes('win')) {
      keybindingsFile = 'keybindings-windows.sql'
    } else if (platform.includes('linux')) {
      keybindingsFile = 'keybindings-linux.sql'
    }
    */

    const response = await fetch(`/data/${keybindingsFile}`)
    if (!response.ok) {
      console.error('Failed to load keybindings:', response.statusText)
      return
    }

    const migrationSql = await response.text()
    const result = await window.pluginManager.call('sql', 'restore', migrationSql)
    console.log('Keybindings initialized:', DE.decode(result.output))

    // Verify bindings loaded
    const verifyResult = await window.pluginManager.call('sql', 'query',
      'SELECT COUNT(*) as count FROM keybindings WHERE enabled=1'
    )
    console.log('Active keybindings:', DE.decode(verifyResult.output))
  } catch (error) {
    console.error('Error initializing keybindings:', error)
  }
}

await initKeybindings()

// Initialize OPR Database (One Page Rules - Grimdark Future, Age of Fantasy, etc.)
async function initOPRDatabase() {
  const sqlFiles = [
    '00-schema.sql',
    '01-universes.sql',
    '10-gf-armies.sql',
    '15-gf-battle-brothers.sql',
    '16-gf-alien-hives.sql',
    '20-aof-armies.sql',
  ]

  try {
    for (const file of sqlFiles) {
      const response = await fetch(`/data/opr/${file}`)
      if (!response.ok) {
        console.warn(`OPR: Skipping ${file} (not found)`)
        continue
      }

      const sql = await response.text()
      await window.pluginManager.call('sql', 'restore', sql)
      console.log(`OPR: Loaded ${file}`)
    }

    // Verify data loaded
    const armyResult = await window.pluginManager.call('sql', 'query',
      'SELECT COUNT(*) as count FROM opr_armies'
    )
    const unitResult = await window.pluginManager.call('sql', 'query',
      'SELECT COUNT(*) as count FROM opr_units'
    )
    console.log('OPR Database:', DE.decode(armyResult.output), 'armies,', DE.decode(unitResult.output), 'units')
  } catch (error) {
    console.error('Error initializing OPR database:', error)
  }
}

await initOPRDatabase()

// Initialize keybinding manager
import { keybindingManager } from "./systems/keybinding-manager.js"
await keybindingManager.init()
window.keybindingManager = keybindingManager // Expose for debugging

toast.success("App is ready")
