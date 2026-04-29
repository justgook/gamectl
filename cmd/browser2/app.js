import { init } from './core/runtime.js'
import { GAMS_CONFIG_PATH, loadDefaultGamsConfig, validateGamsConfig } from './core/gams-config.js'
import './ui-plugins/toast.js'
import './ui-plugins/layout.js'
import './ui-plugins/popup.js'
import './widgets/code-editor.js'
import './widgets/view-pagination.js'
import './views/view-sql.js'
import './views/view-sql-console.js'
import './views/view-files.js'
import './views/view-tree.js'
import './views/view-ng.js'
import './views/view-ng-node.js'
import './views/view-tilemap.js'
import './views/files-rename.js'
import './views/files-json.js'
import './views/files-default.js'
import './views/view-ai.js'
import './views/view-setting-fs.js'
import './views/view-setting-theme.js'
import './views/view-setting-plugins.js'
import './views/sql-table-editor.js'

const THEME_STORAGE_KEY = 'browser.theme'
const DEFAULT_THEME = 'the98'
// const DEFAULT_LAYOUT = `
//   <view-sql-console />
//   <sql-table-editor setup="0:h:50"/>
//   <view-sql setup="0:v:50" />
//   <view-ai setup="1:v:50" />
// `
//
const DEFAULT_LAYOUT = `
  <view-tilemap />
`

const AI_OPEN_CONFIG = {
  provider: 'ai.provider.mock',
  model: 'mock-default',
  context: [
    {
      kind: 'system',
      source: 'browser2.app',
      label: 'Default browser2 AI context',
      content: {
        text: 'You are the GAMS browser2 AI assistant. Use tools when useful and explain tool results clearly.',
      },
    },
  ],
  tools: [
    {
      name: 'fs_list',
      description: 'List files from the current workspace path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
        additionalProperties: false,
      },
      target: { plugin: 'fs', method: 'list' },
    },
    {
      name: 'fs_read',
      description: 'Read a file from the current workspace path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
        additionalProperties: false,
      },
      target: { plugin: 'fs', method: 'read' },
    },
    {
      name: 'sql_query',
      description: 'Execute a SQL query against the current database.',
      parameters: {
        type: 'string',
        // additionalProperties: false,
      },
      target: { plugin: 'sql', method: 'query' },
    },
  ],
  persist: {
    driver: 'fs',
    format: 'jsonl',
    path: '/ai/sessions/view-ai-default.jsonl',
  },
}

function placeholderView(tag, label, group = "TODO") {
  return {
    label,
    group,
    create: () => {
      const el = document.createElement('view-empty')
      el.setAttribute('data-view-tag', tag)
      el.setAttribute('data-view-label', label)
      return el
    },
  }
}

const viewRegistry = new Map([
  ['view-sql', {
    label: 'SQL',
    create: () => document.createElement('view-sql'),
  }],
  ['view-sql-console', {
    label: 'SQL Console',
    create: () => document.createElement('view-sql-console'),
  }],
  ['view-ai', {
    label: 'AI',
    create: () => {
      const el = document.createElement('view-ai')
      el.openConfig = structuredClone(AI_OPEN_CONFIG)
      return el
    },
  }],
  ['view-files', {
    label: 'Files',
    create: () => document.createElement('view-files'),
  }],
  ['view-animation', placeholderView('view-animation', 'Animation')],
  ['view-tilemap', {
    label: 'Tilemap',
    create: () => document.createElement('view-tilemap'),
  }],
  ['view-ng', {
    label: 'Nodegraph',
    create: () => {
      const el = document.createElement('view-ng')
      return el
    },
  }],
  ['view-font', placeholderView('view-font', 'Artery Font')],
  ['view-bullet', placeholderView('view-bullet', 'BulletML')],
  ['view-particle', placeholderView('view-particle', 'Particle')],
  ['view-tree', {
    label: 'Tree',
    create: () => document.createElement('view-tree'),
  }],
  ['view-game-runner', placeholderView('view-game-runner', 'Game Runner')],
  ['view-setting-plugins', {
    label: 'Setting GAMS Config',
    group: 'Settings',
    create: () => document.createElement('view-setting-plugins'),
  }],
  ['view-setting-ai', placeholderView('view-setting-ai', 'Setting AI', 'Settings')],
  ['view-setting-keys', placeholderView('view-setting-keys', 'Setting Keybinding', 'Settings')],
  ['view-setting-fs', {
    label: 'Setting FileSystem',
    group: 'Settings',
    create: () => document.createElement('view-setting-fs'),
  }],
  ['view-setting-theme', {
    label: 'Setting Theme',
    group: 'Settings',
    create: () => document.createElement('view-setting-theme'),
  }],
])



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

function applyThemeStylesheet(nextTheme = null) {
  const theme = nextTheme || localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME
  const themeHref = `./themes/${theme}.css`
  const link = document.getElementById('theme-stylesheet')
  link.setAttribute('href', themeHref)
  window.__currentTheme = theme
  window.__currentThemeStylesheetHref = themeHref

  document.querySelectorAll('view-area, view-popup').forEach((el) => {
    const shadowLink = el.shadowRoot?.querySelector('link[data-theme-stylesheet]')
    if (shadowLink) {
      shadowLink.setAttribute('href', themeHref)
    }
  })
}

function errorParse(e) {
  return `${e.plugin ? "[" + e.plugin + "]: " : ""}${e.message || e.reason}`
}

window.__applyThemeStylesheet = applyThemeStylesheet

async function main() {
  const root = document.body
  applyThemeStylesheet()
  root.innerHTML = '<div style="padding:24px; color:var(--text);">Booting...</div>'

  try {
    const runtime = await init()
    const defaultConfig = await loadDefaultGamsConfig()
    await runtime.add(createFsPluginDefinitions(defaultConfig))
    const gamsConfig = await loadGamsConfig(runtime, defaultConfig)
    await runtime.add(createFsPluginDefinitions(gamsConfig))
    await runtime.add(gamsConfig.plugins)
    await runtime.call("sql", "open") // TODO move init of sql to plugin it self
    window.onerror = function (_message, _source, _lineno, _colno, error) {
      runtime.call("ui.toast", "error", errorParse(error))
      return false // prevents default logging (optional)
    }

    window.addEventListener("unhandledrejection", (e) => {
      runtime.call("ui.toast", "error", errorParse(e.reason))
    })

    document.body.innerHTML = ''

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
    document.body.appendChild(popup)
    runtime.register({ id: 'ui.popup', methods: popup.api })

    // DO NOT USE IT - it is exposed just for debuging, use `import {call} from "./coder/runtime.js"`
    window.runtime = runtime
    debugMigration(runtime)

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
function debugMigration(runtime) {
  runtime.call("sql", "exec", `CREATE TABLE IF NOT EXISTS tilemap_storage (
    name TEXT PRIMARY KEY,     -- Tilemap identifier (e.g., 'new_map', 'rules-basic-walls')
    data TEXT NOT NULL         -- JSON data as-is from current tilemap-storage format
);`)
  runtime.call("sql", "exec", `INSERT INTO tilemap_storage (name, data) VALUES
(
  'default',
  '{"layers":[{"width":10,"data":[1,1,1,1,1,1,1,1,1,1,1,2,2,2,1,1,3,3,3,1,1,2,1,2,1,1,3,1,3,1,1,2,2,2,1,1,3,3,3,1,1,1,1,1,1,1,1,1,1,1,1,4,4,1,1,1,1,4,4,1,1,4,1,1,1,1,1,1,4,1,1,1,1,1,1,1,1,1,1,1],"props":{"name":"Terrain"}},{"width":10,"data":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,0,0,5,5,0,0,0,5,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0],"props":{"name":"Details"}},{"width":10,"data":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"props":{"name":"Overlay"}}],"props":{"tileSize":"32","sourceTileSize":"16","tilesets":"[{\\"file\\":\\"local:/example/floor-16x16.png\\",\\"name\\":\\"Floor\\"}]"}}'
),
(
  'tileset_demo',
  '{"layers":[{"data":[2,3,4, 0,0,0, 0,0,0],"width":3,"props":{"tw":"16","th":"16", "tileset":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABQBAMAAABsc2MHAAAAEnRFWHRBdXRob3IARGF2aWQgU21pdGhp1FRuAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABJQTFRFR3BM2dnZzMzM////8vLy5eXlv3qrMgAAAAF0Uk5TAEDm2GYAAAF8SURBVFjD7ZhRboQwDES5QrbaAzTdE8CeAIUDrNTc/yptldjBszF123xR+8fCkCeEomEmU/5lLUpN13L//dpfp85VYCgPpNBfqM514MtXu6fSsfS5Ax3owGfgHOPbvhMQ52bgPUbZKxDnduD6KjsBYW4HpqlWkMCE663AjYAPCdzqde12YCZglsBcr2v/wbYh4LB96EAHnhA4RwIO00MGjtJDAg7TQ+x/1kOpewP0UOreAD105+DAfw68xM+6pdKx9LkOLE+kELulzlVgfYHbpb9QnatAdlWmfNy+qTZnoJaLjcCmh+xMlVxsBDY9lFb3u+2hbaPON3SgA88JPNS9lpNlfl4W6Q+bj5yOda/l5AB+EHJ0Ax7rXsvJAfwg5OiVdRA9NH2r/j9H9418fghA1rcA/g98YQLfuPH5IQBZ3wL4P/CFCXxjnvAIALfB8TZ5/p060IEnBVZ/KPMw1RwJiDIkgfu8XHVP5mF+AyNwl5fJH8o8zMDVCGR9/ABC9Zf1svGALwAAAABJRU5ErkJggg=="}}]}'
),
(
  'rules',
  '{"props":{"tw":"16","th":"16","rule_Negate":"1","rule_Ignore":"2","rule_NonEmpty":"3","rule_Empty":"4","rule_Other":"5","rule_MatchOutsideMap":"true","rule_OverflowBorder":"true"},"layers":[{"props":{"tw":"16","th":"16","tileset":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAQBAMAAAAblGfKAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURUdwTL5KL////9IAAAAAAFSAC4CAgLdcgScAAAABdFJOUwBA5thmAAAA6UlEQVQoz6WSQYrDMAxFP3Hofm5gZNO1iS5QjHODel+y6P2PMN92m8YkGRgqTLKQHnq2BACq/ODxvPAAUgMIanjwjp9X1PpCXFrhY2h5+yoNY2J0gFERDVhEfBS52lY4hPY3e4D14hRDA6wFC24Y3ipj9NIBZiKgGhaJnrmrHXPO902HI8CpI+B9jARmAvnWK1FqBYqRTqJUSqkozTnNBFalA8CVay8tQaVUgU4p9wAbbACMvdIecNVqVSJwTzhXMlNpsLk0wFfF+aWN1kF8nrV0wB/PCq2D2AyuAaeDO1iNvdJ3y/fP9f4Fk9tT0A+X6MoAAAAASUVORK5CYII=","rule_role":"input","rule_target_layer":"#0"},"width":39,"data":[0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,3,3,3,0,3,3,3,0,3,3,3,4,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,3,3,3,0,3,3,3,0,3,3,3,0,3,0,0,0,3,3,0,3,3,3,0,3,3,0,0,0,3,4,0,4,3,4,0,4,3,0,0,3,3,4,0,4,3,4,0,4,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,3,3,0,3,3,3,0,3,3,0,0,0,3,4,0,0,0,0,0,4,3,0,0,3,3,4,0,4,3,4,0,4,3,3,4,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,4,3,3,0,0,0,0,0,3,3,4,0,3,3,3,0,3,3,3,0,3,3,3,0,3,0,0,0,3,3,0,3,3,3,0,3,3,0,0,0,3,4,0,0,0,0,0,4,3,0,0,3,3,4,0,4,3,4,0,4,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,3,3,0,3,3,3,0,3,3,0,0,0,3,4,0,4,3,4,0,4,3,0,0,3,3,4,0,4,3,4,0,4,3,3,4,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,3,3,3,0,3,3,3,0,3,3,3,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,3,3,3,0,3,3,3,0,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,3,3,0,0,0,3,3,0,0,4,0,0,3,3,4,0,4,3,3,0,0,0,0,4,3,3,0,3,3,3,0,3,3,4,0,3,3,3,0,3,3,4,0,4,3,3,0,3,3,3,0,3,3,3,0,3,3,3,0,0,0,0,0,4,0,0,0,4,0,0,0,4,0,0,3,3,4,0,4,3,0,0,0,3,4,0,4,3,3,0,4,3,4,0,4,3,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,3,3,4,0,4,3,3,0,0,3,4,0,4,3,3,0,3,3,4,0,4,3,0,0,4,3,4,0,4,3,4,4,3,4,0,0,0,0,0,3,0,3,0,3,0,3,0,4,3,3,0,3,3,3,0,3,3,3,0,3,0,4,0,3,3,3,0,3,3,3,0,4,0,0,0,0,0,0,4,3,3,0,3,3,4,0,0,3,3,0,0,4,0,0,0,4,0,0,3,3,0,0,3,3,4,0,4,3,3]},{"data":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,12,0,0,0,13,0,0,0,14,0,0,0,15,0,0,0,0,0,0,0,17,0,0,0,18,0,0,0,19,0,0,0,20,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,21,0,0,0,22,0,0,0,23,0,0,0,24,0,0,0,25,0,0,0,26,0,0,0,27,0,0,0,28,0,0,0,29,0,0,0,30,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,32,0,0,0,33,0,0,0,34,0,0,0,35,0,0,0,36,0,0,0,37,0,0,0,38,0,0,0,39,0,0,0,40,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,41,0,0,0,0,0,0,0,43,0,0,0,44,0,0,0,45,0,0,0,46,0,0,0,47,0,0,0,48,0,0,0,49,0,0,0,50,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"width":39,"props":{"readonly":"true","tw":"16","th":"16","name":"output","tileset":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABQBAMAAABsc2MHAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAASUExURUdwTADZzgDl3f///wDLvQDy7qoVo5gAAAABdFJOUwBA5thmAAABfElEQVRYw+2YUW6EMAxEc4Vs9wJF6glgD1A1ewFE7n+Vtkrs4NmYddt8UfvHwpAnhKJhJmH6Zc1KhUu5/3bpr1PnKjCWB3LsL1TnOvDlu91y6Vj63IEOdOAjcEnpY98JiHMz8JaS7BWIcztwe5edgDC3A3OoFSUw43orcCXgqwSu9bp2O3Ai4CSBU72u/QfbhoDD9qEDHXhC4JIIOEwPGThKDwk4TA+x/1kPpe4N0EOpewP00J2DA/858Jq+6p5Lx9LnOrA8kWPqljpXgfUF7tf+QnWuAtlVmfJx+6banIFaLjYCmx6yM1VysRHY9FBa3WfbQ9tGnW/oQAeeE3ioey0ny/w8z9IfNh8ZjnWv5eQIfhBydAMe617LyRH8IOTojXUQPTR9q/4/R/eNfH4IQNa3CP4PfGEG37jy+SEAWd8i+D/whRl84xTwCAC3wfE2efydOtCBJwVWfyjzMNWSCIgyJIH7vFx1T+ZhfgMjcJeXyR/KPMzAzQhkffwEdnWVJTANfbYAAAAASUVORK5CYII=","rule_role":"output","rule_target_layer":"#0"}}]}'
),
(
  'new_rules',
  '{"layers":[{"width":60,"data":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1027,0,1027,1027,1028,0,1028,1027,1027,0,1027,1027,1027,0,1027,1027,1027,0,0,1028,0,0,0,0,0,0,1027,0,0,0,0,1027,0,0,1027,0,0,1027,0,0,0,1028,0,0,0,1028,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1027,1027,1027,0,1027,1027,1027,0,1027,1027,1027,0,1027,1027,1027,0,1027,1027,1027,0,1027,1027,1027,0,1027,1028,0,0,1028,1027,0,1028,1027,0,0,1027,1028,0,1028,1027,0,0,0,1027,1028,0,0,0,0,0,0,0,0,0,0,0,0,0,1028,0,1027,1027,1027,0,1027,1027,1027,0,1027,1027,1028,0,1028,1027,1027,0,0,0,0,0,0,1028,0,0,1027,0,0,0,0,1027,0,0,1028,0,0,1028,0,0,0,1027,0,0,0,1027,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"props":{"rule_role":"input","rule_target_layer":"#0","name":"Input"}},{"width":60,"data":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,131,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1025,0,0,0,1025,0,0,0,0,0,0,0,0,0,0,1025,0,0,1025,0,0,0,1025,0,0,0,1025,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1025,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"props":{"name":"Output_0","rule_role":"output","rule_target_layer":"#0"}},{"width":60,"data":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1025,0,0,0,0,0,0,0,0,0,0,289,0,0,0,290,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,355,0,0,356,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,321,0,0,0,322,0,0,0,324,0,0,0,323,0,0,0,3,0,0,0,35,0,0,324,0,0,0,0,323,0,0,34,0,0,36,0,0,0,259,0,0,0,260,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1025,0,0,353,0,0,0,354,0,0,0,324,0,0,0,323,0,0,0,35,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,291,0,0,0,292,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"props":{"name":"Output_1","rule_role":"output","rule_target_layer":"#1"}}],"props":{"rule_Negate":"1025","rule_Ignore":"1026","rule_NonEmpty":"1027","rule_Empty":"1028","rule_Other":"1029","rule_MatchOutsideMap":"true","tileSize":"16","tilesets":"[{\\"name\\":\\"atlas\\",\\"file\\":\\"demo/assets/the_atlas.qoi\\",\\"count\\":1024},{\\"name\\":\\"Rules\\",\\"file\\":\\"demo/assets/rules.qoi\\",\\"count\\":8}]"}}'
);
`)
}
