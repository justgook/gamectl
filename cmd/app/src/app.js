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

const preopens = await runtime.invoke('wasi:filesystem/preopens@0.2.0::get-directories', [])
const root = preopens[0][0]
const stream = await runtime.invoke('wasi:filesystem/types@0.2.0::descriptor.read-directory', [root])
const entries = []
while (true) {
  const entry = await runtime.invoke('wasi:filesystem/types@0.2.0::directory-entry-stream.read-directory-entry', [stream])
  if (entry === null) break
  entries.push(entry)
}

diagnostics.textContent = JSON.stringify({
  preopens,
  entries,
  diagnostics: await runtime.diagnostics(),
}, null, 2)
console.log('gams.runtime ready', runtime)
