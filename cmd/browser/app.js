
// Initialize event bus first
import "./systems/event-bus.js"
import { bus as eventBus } from "./systems/event-bus.js"
import { toast } from './systems/toast.js'

import "./systems/cache.js"

// current
import { ViewChrome } from "./views/chrome.js"
import { ViewSplitter } from "./views/view-splitter.js"
import { LayoutParent } from "./views/layout.js"
import { ViewTree } from "./views/view-tree.js"
import { ViewConsole } from "./views/view-console.js"
import { ViewSqlConsole } from "./views/view-sql-console.js"
import { ViewSqlTable } from "./views/view-sql-table.js"
import { ViewSqlTables } from "./views/view-sql-tables.js"
import "./views/view-files.js" // Self-registers
import { ViewTilemap } from "./views/view-tilemap.js"
import { ViewPipeline } from "./views/view-pipeline.js"
import { ViewNodeGraph } from "./views/view-nodegraph.js"
import { ViewOPRUnitBuilder } from "./views/view-opr-unit-builder.js"
import { ViewSkeleton } from "./views/view-skeleton.js"
import "./views/view-timeline.js"

// Sprite tools
import "./views/sprite-extractor/view-sprite-extractor.js" // Self-registers
import "./views/sprite-packer/view-sprite-packer.js" // Self-registers
import "./views/tile-extractor/view-tile-extractor.js" // Self-registers

// Animation editor
import "./views/view-animation-editor.js" // Self-registers

// Settings
import { ViewSettings } from "./views/view-settings.js"

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
import "./views/nodegraph/node-code.js"
// import "./views/nodegraph/node-fsread.js"
// import "./views/nodegraph/node-fswrite.js"

//current stuff
customElements.define('layout-parent', LayoutParent)
customElements.define('view-splitter', ViewSplitter)
customElements.define('view-tilemap', ViewTilemap)
customElements.define('view-tree', ViewTree)
customElements.define('view-console', ViewConsole)
customElements.define('view-sql-console', ViewSqlConsole)
customElements.define('view-sql-table', ViewSqlTable)
customElements.define('view-sql-tables', ViewSqlTables)
// view-files self-registers on import
customElements.define('view-pipeline', ViewPipeline)
customElements.define('view-opr-unit-builder', ViewOPRUnitBuilder)
// customElements.define('view-skeleton', ViewSkeleton) //already registered in file
// customElements.define('view-nodegraph', ViewNodeGraph) //already registered in file
customElements.define('view-settings', ViewSettings)

// === Two-phase plugin boot ===

// Phase 1: Initialize FS (host functions) + SQL (base WASM plugin)
window.pluginManager = await PluginManagerProxy.create()

// Initialize database using migration system
// - Loads from /database.sqlite if exists in FS
// - Otherwise runs all migrations from /data/migrations/
// - Listens for file:save event to persist database
import { migrationManager } from "./systems/migration.js"
await migrationManager.init()
window.migrationManager = migrationManager // Expose for debugging

// Phase 2: Query plugin registry from DB, load enabled plugins via FS
const decoder = new TextDecoder()
try {
  const result = await window.pluginManager.call('sql', 'query',
    "SELECT name, url FROM plugins WHERE enabled = 1 AND type != 'base' ORDER BY rowid"
  )
  const csv = decoder.decode(result.output).trim()
  const lines = csv.split('\n')

  // Parse CSV (first line is header: name,url)
  const plugins = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // CSV: name,url - split on first comma only (url may not contain commas but be safe)
    const commaIdx = line.indexOf(',')
    if (commaIdx === -1) continue
    const name = line.slice(0, commaIdx)
    const url = line.slice(commaIdx + 1)
    plugins.push({ name, url })
  }

  console.log(`[App] Phase 2: loading ${plugins.length} plugins from registry`)
  const loadResult = await window.pluginManager.loadPlugins(plugins)

  if (loadResult.failed?.length > 0) {
    console.warn('[App] Some plugins failed to load:', loadResult.failed)
    for (const f of loadResult.failed) {
      toast.error(`Plugin '${f.name}' failed: ${f.error}`)
    }
  }

  console.log(`[App] Phase 2 complete: ${loadResult.loaded?.length || 0} plugins loaded`)
} catch (error) {
  console.error('[App] Phase 2 plugin loading failed:', error)
  toast.error('Failed to load plugins from registry')
}

// Emit ready event so cache manager can process queued requests
// This must happen AFTER all plugins are loaded to avoid calling non-existent plugins
eventBus.emit('plugin-manager:ready')

// Initialize keybinding manager
import { keybindingManager } from "./systems/keybinding-manager.js"
await keybindingManager.init()
window.keybindingManager = keybindingManager // Expose for debugging

// Wire app:settings keybinding (Ctrl+,) to open settings view
eventBus.on('app:settings', () => {
  // Find the focused chrome panel, or fall back to the first one
  const chromes = document.querySelectorAll('view-chrome')
  let target = chromes[0]
  for (const chrome of chromes) {
    const slot = chrome.shadowRoot?.querySelector('slot:not([name])')
    const assigned = slot?.assignedElements?.()[0]
    if (assigned && document.activeElement && chrome.contains(document.activeElement)) {
      target = chrome
      break
    }
  }
  if (target) {
    target.switchView('view-settings')
  }
})

toast.success("App is ready")

// Enable splash screen Enter button now that app is fully loaded
const splashScreen = document.getElementById('splash-screen')
if (splashScreen) {
  splashScreen.setAttribute('data-ready', '')

  const dismissSplash = () => {
    splashScreen.classList.add('splash-hidden')
    splashScreen.addEventListener('transitionend', () => {
      splashScreen.remove()
    }, { once: true })
  }

  const enterBtn = splashScreen.querySelector('.splash-enter')
  if (enterBtn) {
    enterBtn.disabled = false
    enterBtn.addEventListener('click', dismissSplash)
  }

  // Click on backdrop (outside panel) also dismisses
  splashScreen.addEventListener('click', (e) => {
    if (e.target === splashScreen) dismissSplash()
  })
}
