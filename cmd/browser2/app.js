import { init } from './core/runtime.js'
import './ui-plugins/toast.js'
import './ui-plugins/layout.js'
import './ui-plugins/popup.js'
import './widgets/code-editor.js'
import './widgets/view-pagination.js'
import './views/view-sql.js'
import './views/view-sql-console.js'
import './views/view-files.js'
import './views/view-tree.js'
import './views/files-rename.js'
import './views/files-json.js'
import './views/files-default.js'
import './views/view-ai.js'
import './views/sql-table-editor.js'

const THEME_STORAGE_KEY = 'browser.theme'
const DEFAULT_THEME = 'the98'
const DEFAULT_LAYOUT = `
  <view-sql-console />
  <sql-table-editor setup="0:h:50"/>
  <view-sql setup="0:v:50" />
  <view-ai setup="1:v:50" />
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

function placeholderView(tag, label) {
  return {
    label,
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
  ['view-nodegraph', placeholderView('view-nodegraph', 'Nodegraph')],
  ['view-font', placeholderView('view-font', 'Artery Font')],
  ['view-bullet', placeholderView('view-bullet', 'BulletMl')],
  ['view-particle', placeholderView('view-particle', 'Particle')],
  ['view-tree', {
    label: 'Tree',
    create: () => document.createElement('view-tree'),
  }],
  ['view-game-runner', placeholderView('view-game-runner', 'Game Runner')],
  ['view-setting-plugins', placeholderView('view-setting-plugins', 'Setting Plugins')],
  ['view-setting-ai', placeholderView('view-setting-ai', 'Setting AI')],
  ['view-setting-keys', placeholderView('view-setting-keys', 'Setting Keybinding')],
  ['view-setting-fs', placeholderView('view-setting-fs', 'Setting FileSystem')],
])


const buildinPlugins = [
  {
    id: 'fs',
    runtime: 'js',
    role: 'service',
    url: 'local:../builtin/fs-opfs/index.js',
  },
  {
    id: 'fs.opfs',
    runtime: 'js',
    role: 'service',
    url: 'local:../builtin/fs-opfs/index.js',
  },
  {
    id: 'fs.webdav',
    runtime: 'js',
    role: 'service',
    url: 'local:../builtin/fs-webdav/index.js',
  },
  {
    id: 'sql',
    runtime: 'wasm',
    role: 'service',
    url: `/plugins/sql.wasm?t=${Date.now()}`,
  },
  {
    id: 'random',
    runtime: 'wasm',
    role: 'service',
    url: `/plugins/random.wasm?t=${Date.now()}`,
  },
  {
    id: 'treegen',
    runtime: 'wasm',
    role: 'service',
    deps: ['random'],
    url: `/plugins/treegen.wasm?t=${Date.now()}`,
  },
  {
    id: 'echo',
    runtime: 'wasm',
    role: 'service',
    url: `/plugins/echo.wasm?t=${Date.now()}`,
  },
  {
    id: 'layout',
    runtime: 'wasm',
    role: 'service',
    url: `/plugins/layout2.wasm?t=${Date.now()}`,
    memory: {
      import: true,
      shared: true,
      initialPages: 288,
      maximumPages: 512,
    },
  },
  {
    id: 'ai.provider.mock',
    runtime: 'js',
    role: 'service',
    url: 'local:/plugins/ai_provider_mock/index.js',
  },
  {
    id: 'ai.agent',
    runtime: 'js',
    role: 'service',
    deps: ['fs', 'ai.provider.mock'],
    url: 'local:/plugins/ai_agent/index.js',
  }
]

function applyThemeStylesheet() {
  const theme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME
  const themeHref = `./themes/${theme}.css`
  const link = document.getElementById('theme-stylesheet')
  link.setAttribute('href', themeHref)
  window.__currentTheme = theme
  window.__currentThemeStylesheetHref = themeHref
}

function errorParse(e) {
  return `${e.plugin ? "[" + e.plugin + "]: " : ""}${e.message || e.reason}`
}

async function main() {
  const root = document.body
  applyThemeStylesheet()
  root.innerHTML = '<div style="padding:24px; color:var(--text);">Booting...</div>'

  try {
    const runtime = await init()
    await runtime.add(buildinPlugins)
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
