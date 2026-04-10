import { init, setupResult } from './core/runtime.js'
import { applySetupView } from './core/setup-view.js'
import './ui-plugins/toast.js'
import './ui-plugins/layout.js'

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

async function main() {
  const root = document.body
  applyThemeStylesheet()
  root.innerHTML = '<div style="padding:24px; color:var(--text);">Booting...</div>'

  try {
    const runtime = await init(readBootstrapConfig())

    document.body.innerHTML = ''

    const layout = document.createElement('ui-layout')
    document.body.appendChild(layout)
    runtime.register({ id: 'ui.layout', methods: layout.api })
    await layout.bindRuntime(runtime)

    const toast = document.createElement('toast-manager')
    document.body.appendChild(toast)
    runtime.register({ id: 'ui.toast', methods: toast.api })

    const viewSetupResult = await applySetupView(runtime)
    window.runtime = runtime
    window.runtimeSetupResult = setupResult
    window.viewSetupResult = viewSetupResult
    window.uiToast = toast
    window.uiLayout = layout

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
