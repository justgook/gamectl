import { runtime } from '/core/runtime.js'

const app = document.querySelector('#app')
if (!app) throw new Error('missing #app')

app.innerHTML = `
  <main>
    <h1>GAMS component runtime bootstrap</h1>
    <p>Destructive cmd/app rebuild: Tauri exposes structured component runtime APIs.</p>
    <section>
      <h2>Runtime diagnostics</h2>
      <pre id="diagnostics">loading...</pre>
    </section>
  </main>
`

const diagnostics = document.querySelector('#diagnostics')
if (!diagnostics) throw new Error('missing #diagnostics')

diagnostics.textContent = JSON.stringify(await runtime.diagnostics(), null, 2)
console.log('gams.runtime ready', runtime)
