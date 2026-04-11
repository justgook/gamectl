import { init } from './core/runtime.js'
import './ui-plugins/toast.js'
import './ui-plugins/layout.js'
import './views/view-sql.js'

const THEME_STORAGE_KEY = 'browser.theme'
const DEFAULT_THEME = 'the98'
const DEFAULT_LAYOUT = `
  <view-empty />
  <view-empty setup="0:v:50" />
`

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
  ['view-empty', placeholderView('view-empty', 'Empty')],
  ['view-nodegraph2', placeholderView('view-nodegraph2', 'Nodegraph 2')],
  ['view-settings', placeholderView('view-settings', 'Settings')],
  ['view-sql', {
    label: 'SQL',
    create: () => document.createElement('view-sql'),
  }],
  ['view-assets', placeholderView('view-assets', 'Assets')],
  ['view-debug', placeholderView('view-debug', 'Debug')],
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

async function main() {
  const root = document.body
  applyThemeStylesheet()
  root.innerHTML = '<div style="padding:24px; color:var(--text);">Booting...</div>'

  try {
    const runtime = await init()
    runtime.add(buildinPlugins)
    runtime.call("sql", "open") // TODO move init of sql to plugin it self

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
