
// Initialize event bus first
import "./systems/event-bus.js"
import { bus as eventBus } from "./systems/event-bus.js"
import { toast } from './systems/toast.js'
import { parseCSVLines } from './util/csv.js'

import "./systems/cache.js"

// Infrastructure components (always static - not views)
import { ViewChrome } from "./views/chrome.js"
import { ViewSplitter } from "./views/view-splitter.js"
import { LayoutParent } from "./views/layout.js"

// Popup system
import { PopupManager } from "./views/popup-manager.js"
import { PluginManagerProxy } from "./systems/plugin-manager/proxy.js"
import { ViewPopup } from "./views/view-popup.js"

// Toast system
import { ToastManager } from "./views/toast-manager.js"
import { ViewToast } from "./views/view-toast.js"

// Node graph sub-components (not views, always static)
import "./views/nodegraph/node-base.js"
import "./views/nodegraph/node-input.js"
import "./views/nodegraph/node-plugin.js"
import "./views/nodegraph/node-output.js"
import "./views/nodegraph/node-tostring.js"
import "./views/nodegraph/node-fromjson.js"
import "./views/nodegraph/node-fields.js"
import "./views/nodegraph/node-popup.js"
import "./views/nodegraph/node-code.js"

// View loader system
import { viewLoader } from "./systems/view-loader.js"

// Register infrastructure custom elements
customElements.define('layout-parent', LayoutParent)
customElements.define('view-splitter', ViewSplitter)

// === Splash screen status helper ===
function splashStatus(message) {
  const el = document.querySelector('.splash-loader-text')
  if (el) el.textContent = message
}

// === Three-phase boot ===

const decoder = new TextDecoder()
const APPEARANCE_STORAGE_KEY = 'gamectl.appearance'
const THEME_STYLESHEET_ID = 'theme-stylesheet'
const THEME_FILES = {
  current: 'themes/current.css',
  obsidian: 'themes/obsidian.css',
  neon: 'themes/neon.css',
}

function normalizeThemeName(theme) {
  if (!theme || theme === 'dark') return 'current'
  if (theme === 'current' || theme === 'obsidian' || theme === 'neon') return theme
  return 'current'
}

function applyThemeStylesheet(theme) {
  const normalizedTheme = normalizeThemeName(theme)
  const themeHref = THEME_FILES[normalizedTheme] || THEME_FILES.current
  const link = document.getElementById(THEME_STYLESHEET_ID)
  if (link && link.getAttribute('href') !== themeHref) {
    link.setAttribute('href', themeHref)
  }
}

window.__applyThemeStylesheet = applyThemeStylesheet

function readAppearanceFromLocalStorage() {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (error) {
    console.warn('[App] Failed to parse local appearance settings:', error)
    return null
  }
}

async function applyAppearanceSettings() {
  const localSettings = readAppearanceFromLocalStorage() || {}

  try {
    const result = await window.pluginManager.call(
      'sql',
      'query',
      "SELECT key, value FROM settings WHERE category='appearance'"
    )

    const csv = decoder.decode(result.output).trim()
    if (!csv) return

    const lines = parseCSVLines(csv)
    const settings = {}
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i]
      if (row.length >= 2) settings[row[0]] = row[1]
    }

    settings['appearance.theme'] = localSettings['appearance.theme'] || settings['appearance.theme']
    settings['appearance.font-family'] = localSettings['appearance.font-family'] || settings['appearance.font-family']
    settings['appearance.font-size'] = localSettings['appearance.font-size'] || settings['appearance.font-size']

    const theme = settings['appearance.theme']
    const normalizedTheme = normalizeThemeName(theme)
    applyThemeStylesheet(normalizedTheme)

    const fontFamily = settings['appearance.font-family']
    if (!fontFamily || fontFamily === 'default') {
      document.documentElement.style.removeProperty('--ui-font-body-override')
      document.documentElement.style.removeProperty('--ui-font-body')
    } else {
      document.documentElement.style.setProperty('--ui-font-body-override', fontFamily)
      document.documentElement.style.setProperty('--ui-font-body', fontFamily)
    }

    const fontSize = settings['appearance.font-size']
    if (fontSize) document.documentElement.style.setProperty('--font-size-md', `${fontSize}px`)
  } catch (error) {
    console.warn('[App] Failed to apply appearance settings:', error)

    // Fallback to localStorage only
    const theme = localSettings['appearance.theme']
    const normalizedTheme = normalizeThemeName(theme)
    applyThemeStylesheet(normalizedTheme)

    const fontFamily = localSettings['appearance.font-family']
    if (!fontFamily || fontFamily === 'default') {
      document.documentElement.style.removeProperty('--ui-font-body-override')
      document.documentElement.style.removeProperty('--ui-font-body')
    } else {
      document.documentElement.style.setProperty('--ui-font-body-override', fontFamily)
      document.documentElement.style.setProperty('--ui-font-body', fontFamily)
    }

    const fontSize = localSettings['appearance.font-size']
    if (fontSize) document.documentElement.style.setProperty('--font-size-md', `${fontSize}px`)
  }
}

// Phase 1: Initialize FS (host functions) + SQL (base WASM plugin)
splashStatus('Initializing filesystem...')
window.pluginManager = await PluginManagerProxy.create()

// Initialize database using migration system
// - Loads from /database.sqlite if exists in FS
// - Otherwise runs all migrations from /data/migrations/
// - Listens for file:save event to persist database
splashStatus('Loading database...')
import { migrationManager } from "./systems/migration.js"
await migrationManager.init()
window.migrationManager = migrationManager // Expose for debugging
await applyAppearanceSettings()

// Phase 2: Query plugin registry from DB, load enabled plugins via FS
splashStatus('Loading plugins...')
try {
  const result = await window.pluginManager.call('sql', 'query',
    "SELECT name, url FROM plugins WHERE enabled = 1 AND type != 'base' AND scope = 'global' ORDER BY rowid"
  )
  const csv = decoder.decode(result.output).trim()
  const lines = csv.split('\n')

  // Parse CSV (first line is header: name,url)
  const plugins = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const commaIdx = line.indexOf(',')
    if (commaIdx === -1) continue
    const name = line.slice(0, commaIdx)
    const url = line.slice(commaIdx + 1)
    plugins.push({ name, url })
  }

  console.log(`[App] Phase 2: loading ${plugins.length} plugins from registry`)

  for (const p of plugins) {
    splashStatus(`Loading plugin: ${p.name}...`)
  }

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

// Phase 3: Query view registry from DB, load enabled views via ViewLoader
splashStatus('Loading views...')
try {
  const result = await window.pluginManager.call('sql', 'query',
    "SELECT name, url FROM views WHERE enabled = 1 ORDER BY rowid"
  )
  const csv = decoder.decode(result.output).trim()
  const lines = csv.split('\n')

  // Parse CSV (first line is header: name,url)
  const views = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const commaIdx = line.indexOf(',')
    if (commaIdx === -1) continue
    const name = line.slice(0, commaIdx)
    const url = line.slice(commaIdx + 1)
    views.push({ name, url })
  }

  console.log(`[App] Phase 3: loading ${views.length} views from registry`)

  const viewResult = await viewLoader.loadAll(views, (name) => {
    splashStatus(`Loading view: ${name}...`)
  })

  if (viewResult.failed?.length > 0) {
    console.warn('[App] Some views failed to load:', viewResult.failed)
    for (const f of viewResult.failed) {
      toast.error(`View '${f.name}' failed: ${f.error}`)
    }
  }

  console.log(`[App] Phase 3 complete: ${viewResult.loaded?.length || 0} views loaded`)
} catch (error) {
  console.error('[App] Phase 3 view loading failed:', error)
  toast.error('Failed to load views from registry')
}

window.viewLoader = viewLoader // Expose for debugging

// Emit ready event so cache manager can process queued requests
// This must happen AFTER all plugins and views are loaded
eventBus.emit('plugin-manager:ready')

// Initialize keybinding manager
splashStatus('Initializing keybindings...')
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

splashStatus('Ready')
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
