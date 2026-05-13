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

function unwrapResult(result, label) {
  if (result && Object.prototype.hasOwnProperty.call(result, 'ok')) return result.ok
  if (result && Object.prototype.hasOwnProperty.call(result, 'err')) throw new Error(`${label}: ${result.err}`)
  throw new Error(`${label}: expected WIT result object`)
}

await runtime.addPlugins(['plugins/fs.wasm'], true)

const gamsJsonText = unwrapResult(
  await runtime.invoke('gams:fs/fs::read-text', ['/gams.json']),
  'read /gams.json',
)
const entries = unwrapResult(
  await runtime.invoke('gams:fs/fs::list', ['/']),
  'list /',
)

let sampleRead = null
const firstFile = entries.find((entry) => entry.type === 'regular-file')
if (firstFile) {
  const bytes = unwrapResult(
    await runtime.invoke('gams:fs/fs::read-file', [`/${firstFile.name}`]),
    `read /${firstFile.name}`,
  )
  sampleRead = {
    name: firstFile.name,
    text: new TextDecoder().decode(new Uint8Array(bytes.slice(0, 256))),
  }
}

try {
  await runtime.addPlugins(['plugins/calculator.wasm', 'plugins/adder.wasm'], true)
  const calculatorResult = await runtime.invoke('docs:calculator/calculate::eval-expression', ['add', 2, 3])
  console.log('calculator result', calculatorResult)
} catch (error) {
  console.error(error)
}

diagnostics.textContent = JSON.stringify({
  gamsJsonText: gamsJsonText.slice(0, 512),
  entries,
  sampleRead,
  diagnostics: await runtime.diagnostics(),
}, null, 2)
console.log('gams.runtime ready', runtime)
