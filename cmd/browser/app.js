
// Initialize event bus first
import "./systems/event-bus.js"
import { bus as eventBus } from "./systems/event-bus.js"
import { toast } from './systems/toast.js'
import { parseCSVLines } from './util/csv.js'
import { ensureThemeStylesheetLink } from './systems/theme-stylesheet.js'

import "./systems/cache.js"
import { LayoutManager } from "./views/view-layout.js"

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
window.viewLoader = viewLoader // Expose for debugging

// Register infrastructure custom elements
customElements.define('layout-manager', LayoutManager)

// === Splash screen status helper ===
function splashStatus(message) {
  const splash = document.getElementById('splash-screen')
  if (splash?.setStatus) splash.setStatus(message)
}

function createBootDiagnostics() {
  const panel = document.createElement('pre')
  panel.id = 'boot-diagnostics'
  panel.hidden = true
  panel.style.position = 'fixed'
  panel.style.left = '16px'
  panel.style.right = '16px'
  panel.style.bottom = '16px'
  panel.style.zIndex = '1000'
  panel.style.maxHeight = '40vh'
  panel.style.overflow = 'auto'
  panel.style.margin = '0'
  panel.style.padding = '12px 14px'
  panel.style.border = '1px solid rgba(255,255,255,0.24)'
  panel.style.background = 'rgba(0,0,0,0.82)'
  panel.style.color = '#ffb4b4'
  panel.style.font = '12px/1.5 "Roboto Mono", "JetBrains Mono", monospace'
  panel.style.whiteSpace = 'pre-wrap'
  panel.style.pointerEvents = 'auto'
  panel.style.userSelect = 'text'
  document.body.appendChild(panel)

  const lines = []
  const write = (level, message) => {
    const text = typeof message === 'string' ? message : String(message)
    lines.push(`[${level}] ${text}`)
    if (lines.length > 20) lines.shift()
    panel.textContent = lines.join('\n')
  }

  return {
    info(message) {
      write('info', message)
    },
    fail(error, context = 'Boot failed') {
      const detail = error?.stack || error?.message || String(error)
      splashStatus(`${context}. Open the inspector for details.`)
      panel.hidden = false
      write('error', `${context}: ${detail}`)
      console.error(`[Boot] ${context}:`, error)
    }
  }
}

const bootDiagnostics = createBootDiagnostics()

window.addEventListener('error', event => {
  bootDiagnostics.fail(event.error || event.message, 'Unhandled error')
})

window.addEventListener('unhandledrejection', event => {
  bootDiagnostics.fail(event.reason, 'Unhandled promise rejection')
})

// === Three-phase boot ===

const decoder = new TextDecoder()
const APPEARANCE_STORAGE_KEY = 'gams.appearance'
const LEGACY_APPEARANCE_STORAGE_KEY = 'gamectl.appearance'
const THEME_STYLESHEET_ID = 'theme-stylesheet'
bootDiagnostics.info(`origin=${location.origin || '(none)'} protocol=${location.protocol}`)
bootDiagnostics.info(`crossOriginIsolated=${String(window.crossOriginIsolated)} sharedArrayBuffer=${String(typeof SharedArrayBuffer !== 'undefined')}`)
const themeManifest = await fetch('themes/themes.json').then(response => response.json())

function applyThemeStylesheet(theme) {
  const themeKey = themeManifest.themes[theme] ? theme : themeManifest.defaultTheme
  const themeHref = themeManifest.themes[themeKey]?.href
  if (!themeHref) return

  const syncRoot = (root) => {
    const link = ensureThemeStylesheetLink(root)
    if (link && link.getAttribute('href') !== themeHref) {
      link.setAttribute('href', themeHref)
    }
  }

  syncRoot(document)
  document.querySelectorAll('view-area, view-popup').forEach(el => syncRoot(el.shadowRoot))

  window.__currentTheme = themeKey
  window.__currentThemeStylesheetHref = themeHref
  window.__syncThemeStylesheetToRoot = syncRoot

  const link = document.getElementById(THEME_STYLESHEET_ID)
  if (link && link.getAttribute('href') !== themeHref) {
    link.setAttribute('href', themeHref)
  }
}

window.__applyThemeStylesheet = applyThemeStylesheet

function readAppearanceFromLocalStorage() {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY) || localStorage.getItem(LEGACY_APPEARANCE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(parsed))
    if (localStorage.getItem(LEGACY_APPEARANCE_STORAGE_KEY) !== null) {
      localStorage.removeItem(LEGACY_APPEARANCE_STORAGE_KEY)
    }
    return parsed
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
    applyThemeStylesheet(theme)

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
    applyThemeStylesheet(theme)

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
if (typeof SharedArrayBuffer === 'undefined') {
  throw new Error('SharedArrayBuffer is unavailable. The desktop webview is not cross-origin isolated.')
}

try {
  window.pluginManager = await PluginManagerProxy.create()
} catch (error) {
  bootDiagnostics.fail(error, 'Filesystem initialization failed')
  throw error
}

// Initialize database using migration system
// - Loads from /database.sqlite if exists in FS
// - Otherwise runs all migrations from /data/migrations/
// - Listens for file:save event to persist database
splashStatus('Loading database...')
import { migrationManager } from "./systems/migration.js"
try {
  await migrationManager.init()
} catch (error) {
  bootDiagnostics.fail(error, 'Database initialization failed')
  throw error
}
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


// Emit ready event so cache manager can process queued requests
// This must happen AFTER all plugins and views are loaded
eventBus.emit('plugin-manager:ready')

// Initialize keybinding manager
splashStatus('Initializing keybindings...')
import { keybindingManager } from "./systems/keybinding-manager.js"
await keybindingManager.init()
window.keybindingManager = keybindingManager // Expose for debugging

splashStatus('Ready')
toast.success("App is ready")

// Mark splash as ready now that app is fully loaded
const splashScreen = document.getElementById('splash-screen')
if (splashScreen?.markReady) splashScreen.markReady()
