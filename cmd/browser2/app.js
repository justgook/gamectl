import { createRuntime } from './core/runtime.js'

async function main() {
  const root = document.body
  root.innerHTML = '<main style="font-family: sans-serif; padding: 24px; color: #e7ebf3; background:#111318; min-height:100vh">Starting browser...</main>'

  try {
    const runtime = await createRuntime()
    runtime.registerMainPlugin({
      id: 'view.debug',
      methods: {
        async ping(input) {
          return { returnCode: 0, output: new TextEncoder().encode(`view.debug pong: ${String(input ?? '')}`) }
        },
      },
    })
    window.runtime = runtime

    root.innerHTML = `
      <main style="font-family: sans-serif; padding: 24px; color: #e7ebf3; background:#111318; min-height:100vh">
        <h1>GAMS Browser</h1>
        <p>Worker-side setup bootstrap is online.</p>
        <pre style="white-space: pre-wrap; background:#171b23; padding:16px; border-radius:12px; border:1px solid #2a3140;">${escapeHtml(JSON.stringify(runtime.setupResult, null, 2))}</pre>
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
