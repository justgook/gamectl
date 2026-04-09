import { init, setupResult } from './core/runtime.js'
import { applySetupView } from './core/setup-view.js'

function readBootstrapConfig() {
  return {
    fs: localStorage.getItem('browser.fs') || 'fs.opfs',
    sql: localStorage.getItem('browser.sql') || 'sql.default',
    webdavUrl: localStorage.getItem('browser.fs.webdav.url') || '',
  }
}

async function main() {
  const root = document.body
  root.innerHTML = '<main style="font-family: sans-serif; padding: 24px; color: #e7ebf3; background:#111318; min-height:100vh">Starting browser...</main>'

  try {
    const runtime = await init(readBootstrapConfig())
    const viewSetupResult = await applySetupView(runtime)
    window.runtime = runtime
    window.runtimeSetupResult = setupResult
    window.viewSetupResult = viewSetupResult

    root.innerHTML = `
      <main style="font-family: sans-serif; padding: 24px; color: #e7ebf3; background:#111318; min-height:100vh">
        <h1>GAMS Browser</h1>
        <p>Worker-side setup bootstrap is online.</p>
        <h2>Worker Setup</h2>
        <pre style="white-space: pre-wrap; background:#171b23; padding:16px; border-radius:12px; border:1px solid #2a3140;">${escapeHtml(JSON.stringify(setupResult, null, 2))}</pre>
        <h2>Main-thread View Setup</h2>
        <pre style="white-space: pre-wrap; background:#171b23; padding:16px; border-radius:12px; border:1px solid #2a3140;">${escapeHtml(JSON.stringify(viewSetupResult, null, 2))}</pre>
      </main>
    `
  } catch (error) {
    console.error('[browser] boot failed', error)
    root.innerHTML = `
      <main style="font-family: sans-serif; padding: 24px; color: #e7ebf3; background:#111318; min-height:100vh">
        <h1>GAMS Browser</h1>
        <p>Bootstrap failed.</p>
        <pre style="white-space: pre-wrap; background:#171b23; padding:16px; border-radius:12px; border:1px solid #2a3140;">${escapeHtml(String(error?.stack || error?.message || error))}</pre>
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
