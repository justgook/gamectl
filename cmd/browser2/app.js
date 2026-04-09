import { init, setupResult } from './core/runtime.js'
import { applySetupView } from './core/setup-view.js'
import './ui-plugins/toast.js'

const THEME_STORAGE_KEY = 'browser.theme'
const DEFAULT_THEME = 'the98'

function readBootstrapConfig() {
  return {
    fs: localStorage.getItem('browser.fs') || 'fs.opfs',
    sql: localStorage.getItem('browser.sql') || 'sql.default',
    webdavUrl: localStorage.getItem('browser.fs.webdav.url') || '',
  }
}

function applyThemeStylesheet() {
  const theme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME
  const themeHref = `./themes/${theme}.css`
  const link = document.getElementById('theme-stylesheet')
  link.setAttribute('href', themeHref)
  window.__currentTheme = theme
  window.__currentThemeStylesheetHref = themeHref
}

function renderShell(content) {
  const shell = document.getElementById('app-shell')
  shell.innerHTML = content
}

async function main() {
  const root = document.body
  applyThemeStylesheet()
  root.innerHTML = '<main id="app-shell" style="width:min(960px,calc(100vw - 48px));margin:24px auto;padding:24px;border:1px solid var(--border);border-radius:12px;background:var(--surface-elevated);box-shadow:var(--shadow)">Starting browser...</main>'

  try {
    const runtime = await init(readBootstrapConfig())
    const toast = document.createElement('toast-manager')
    document.body.appendChild(toast)
    runtime.register({ id: 'ui.toast', methods: toast.api })
    const viewSetupResult = await applySetupView(runtime)
    window.runtime = runtime
    window.runtimeSetupResult = setupResult
    window.viewSetupResult = viewSetupResult
    window.uiToast = toast

    renderShell(`
      <h1>GAMS Browser</h1>
      <p>Worker-side setup bootstrap is online.</p>
      <h2>Worker Setup</h2>
      <pre style="white-space: pre-wrap; background:var(--surface); padding:16px; border-radius:12px; border:1px solid var(--border);">${escapeHtml(JSON.stringify(setupResult, null, 2))}</pre>
      <h2>Main-thread View Setup</h2>
      <pre style="white-space: pre-wrap; background:var(--surface); padding:16px; border-radius:12px; border:1px solid var(--border);">${escapeHtml(JSON.stringify(viewSetupResult, null, 2))}</pre>
    `)
  } catch (error) {
    console.error('[browser] boot failed', error)
    renderShell(`
      <h1>GAMS Browser</h1>
      <p>Bootstrap failed.</p>
      <pre style="white-space: pre-wrap; background:var(--surface); padding:16px; border-radius:12px; border:1px solid var(--border);">${escapeHtml(String(error?.stack || error?.message || error))}</pre>
    `)
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

main()
