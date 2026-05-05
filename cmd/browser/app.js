import { init } from './core/runtime.js'
import { require } from "/util/require.js"
import { GAMS_CONFIG_PATH, loadDefaultGamsConfig, validateGamsConfig } from './core/gams-config.js'
import './ui-plugins/toast.js'
import './ui-plugins/layout.js'
import './ui-plugins/popup.js'
import { createUiContext } from './ui-plugins/context.js'
import { createUiKeys } from './ui-plugins/keys.js'
import './widgets/code-editor.js'
import './widgets/view-pagination.js'

let currentThemeStylesheetObjectUrl = ''
// const DEFAULT_LAYOUT = `
//   <view-sql-console />
//   <sql-table-editor setup="0:h:50"/>
//   <view-sql setup="0:v:50" />
//   <view-ai setup="1:v:50" />
// `
//
const DEFAULT_LAYOUT = `
  <view-tilemap data-source="/demo/rules.map.json" />
  <view-ng setup="0:v:50" data-source="/demo/assets.ng.json" />
`

function decodeOutput(result) {
  return new TextDecoder().decode(result?.output || new Uint8Array())
}

function createConfiguredViewRegistry(config, runtime) {
  const entries = config.ui.views
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('gams config ui.views is required')
  return new Map(Object.entries(entries).map(([tag, viewConfig]) => {
    if (!viewConfig || typeof viewConfig !== 'object' || Array.isArray(viewConfig)) throw new Error(`gams config ui.views.${tag} must be an object`)
    return [tag, {
      label: viewConfig.label || tag,
      group: viewConfig.group || '',
      internal: viewConfig.internal === true,
      async load() {
        if (customElements.get(tag)) return
        if (typeof viewConfig.url !== 'string' || viewConfig.url.length === 0) throw new Error(`gams config ui.views.${tag}.url is required`)
        await require(viewConfig.url)
        if (!customElements.get(tag)) throw new Error(`view '${tag}' did not register custom element '${tag}'`)
      },

      async create() {
        await this.load()
        const el = document.createElement(tag)
        el.runtime = runtime
        el.viewConfig = viewConfig
        if (viewConfig.config !== undefined) el.config = viewConfig.config
        if (tag === 'view-ai') el.openConfig = structuredClone(viewConfig.config)
        return el
      },
    }]
  }))
}

function createFsPluginDefinitions(config) {
  const provider = localStorage.getItem('browser.fs') || 'fs.opfs'
  const webdavUrl = localStorage.getItem('browser.fs.webdav.url') || ''
  const fsConfig = config.fs

  return [
    {
      id: 'fs',
      runtime: 'js',
      role: 'service',
      url: provider === 'fs.webdav'
        ? '../core/fs-webdav/index.js'
        : '../core/fs-opfs/index.js',
      config: {
        provider,
        webdavUrl,
        fs: fsConfig,
      },
    },
    {
      id: 'fs.opfs',
      runtime: 'js',
      role: 'service',
      url: '../core/fs-opfs/index.js',
      config: {
        provider: 'fs.opfs',
        fs: fsConfig,
      },
    },
    {
      id: 'fs.webdav',
      runtime: 'js',
      role: 'service',
      url: '../core/fs-webdav/index.js',
      config: {
        provider: 'fs.webdav',
        webdavUrl,
        fs: fsConfig,
      },
    },
  ]
}

const textDecoder = new TextDecoder()

async function loadGamsConfig(runtime, defaultConfig) {
  const existsResult = await runtime.call('fs', 'exists', GAMS_CONFIG_PATH)
  if (existsResult.returnCode !== 0) {
    throw new Error(textDecoder.decode(existsResult.output))
  }

  const exists = textDecoder.decode(existsResult.output) === 'true'
  if (!exists) return defaultConfig

  const readResult = await runtime.call('fs', 'read', GAMS_CONFIG_PATH)
  if (readResult.returnCode !== 0) {
    throw new Error(textDecoder.decode(readResult.output))
  }

  return validateGamsConfig(JSON.parse(textDecoder.decode(readResult.output)), GAMS_CONFIG_PATH)
}

async function applyThemeStylesheet(runtime, config) {
  const themePath = config?.ui?.theme?.path
  if (typeof themePath !== 'string' || themePath.length === 0) throw new Error('gams config ui.theme.path is required')
  const readResult = await runtime.call('fs', 'read', themePath)
  if (readResult.returnCode !== 0) throw new Error(decodeOutput(readResult) || `fs.read failed for theme ${themePath}`)

  const blob = new Blob([readResult.output], { type: 'text/css' })
  const themeHref = URL.createObjectURL(blob)
  const previousUrl = currentThemeStylesheetObjectUrl
  currentThemeStylesheetObjectUrl = themeHref

  const link = document.getElementById('theme-stylesheet')
  link.setAttribute('href', themeHref)
  window.__currentThemePath = themePath
  window.__currentThemeStylesheetHref = themeHref

  document.querySelectorAll('view-area, view-popup').forEach((el) => {
    const shadowLink = el.shadowRoot?.querySelector('link[data-theme-stylesheet]')
    if (shadowLink) shadowLink.setAttribute('href', themeHref)
  })

  if (previousUrl) URL.revokeObjectURL(previousUrl)
}

function errorParse(e) {
  return `${e.plugin ? "[" + e.plugin + "]: " : ""}${e.message || e.reason}`
}

async function main() {
  const root = document.body
  root.innerHTML = '<div style="padding:24px; color:var(--text);">Booting...</div>'

  try {
    const runtime = await init()
    const defaultConfig = await loadDefaultGamsConfig()
    await runtime.add(createFsPluginDefinitions(defaultConfig))
    const gamsConfig = await loadGamsConfig(runtime, defaultConfig)
    const viewRegistry = createConfiguredViewRegistry(gamsConfig, runtime)
    await runtime.add(createFsPluginDefinitions(gamsConfig))
    await applyThemeStylesheet(runtime, gamsConfig)
    await runtime.add(gamsConfig.plugins)

    await debugMigration(runtime)


    window.onerror = function (_message, _source, _lineno, _colno, error) {
      runtime.call("ui.toast", "error", errorParse(error))
      return false // prevents default logging (optional)
    }

    window.addEventListener("unhandledrejection", (e) => {
      runtime.call("ui.toast", "error", errorParse(e.reason))
    })

    document.body.innerHTML = ''

    runtime.register(createUiContext())

    const layout = document.createElement('ui-layout')
    layout.setViewRegistry(viewRegistry)
    document.body.appendChild(layout)
    runtime.register({ id: 'ui.layout', methods: layout.api })
    await layout.bindRuntime(runtime)
    await layout.load(DEFAULT_LAYOUT)

    const toast = document.createElement('toast-manager')
    document.body.appendChild(toast)
    runtime.register({ id: 'ui.toast', methods: toast.api })

    const popup = document.createElement('popup-manager')
    popup.setViewRegistry(viewRegistry)
    document.body.appendChild(popup)
    runtime.register({ id: 'ui.popup', methods: popup.api })

    runtime.register(createUiKeys(runtime, gamsConfig))

    // DO NOT USE IT - it is exposed just for debuging, use `import {call} from "./coder/runtime.js"`
    window.runtime = runtime

  } catch (error) {
    console.error('[browser] boot failed', error)
    root.innerHTML = `
      <main style="width:min(960px,calc(100vw - 48px));margin:24px auto;padding:24px;border:1px solid var(--danger, var(--border));border-radius:12px;background:var(--surface-elevated);box-shadow:var(--shadow)">
        <h1>GAMS Browser</h1>
        <p>Bootstrap failed.</p>
        <pre style="white-space: pre-wrap; background:var(--surface); padding:16px; border-radius:12px; border:1px solid var(--border);">${escapeHtml(String(error?.stack || error?.message || error))}</pre>
      </main>
    `
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

main()

/// TEMP DEBUG MIGRATIONS (REMOVE FOR PRODUCTION)
async function debugMigration(runtime) {
  await runtime.call("sql", "exec", `CREATE TABLE IF NOT EXISTS tree_storage (
    name TEXT PRIMARY KEY,
    data TEXT NOT NULL
);`)

  await runtime.call("sql", "exec", `INSERT INTO tree_storage (name, data) VALUES
(
  'progression',
  '[{"parent":-1},{"parent":0},{"parent":1},{"parent":1},{"parent":3},{"parent":4},{"parent":4},{"parent":6},{"parent":6},{"parent":0},{"parent":7},{"parent":1},{"parent":8},{"parent":1},{"parent":9},{"parent":14},{"parent":8},{"parent":11},{"parent":1},{"parent":14}]'
)
`)


}
