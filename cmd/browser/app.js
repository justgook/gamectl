
// Initialize event bus first
import "./systems/event-bus.js"
import "./systems/cache.js"

// current
import { ViewEmpty } from "./views/view-empty.js"
import { ViewSplitter } from "./views/view-splitter.js"
import { LayoutParent } from "./views/layout.js"
import { ViewTree } from "./views/view-tree.js"
import { ViewConsole } from "./views/view-console.js"
import { ViewTilemap } from "./views/view-tilemap.js"
import { ViewTesting } from "./views/view-testing.js"
import { ViewPipeline } from "./views/view-pipeline.js"
import { ViewNodeGraph } from "./views/view-nodegraph.js"

// Popup system
import { PopupManager } from "./views/popup-manager.js"
import { PluginManagerProxy } from "./systems/plugin-manager/proxy.js"
import { ViewPopup } from "./views/view-popup.js"

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
// customElements.define('view-nodegraph', ViewNodeGraph) //already registered in file

/// THE PLUGIN MANAGER TESTING!!!
window.pluginManager = await PluginManagerProxy.create()

const DE = new TextDecoder()

// TESTING SQL PLUGIN WITH DUMP/RESTORE
const result2 = await window.pluginManager.call("sql", "open", "")

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

// Initialize keybinding manager
import { keybindingManager } from "./systems/keybinding-manager.js"
await keybindingManager.init()
window.keybindingManager = keybindingManager // Expose for debugging

