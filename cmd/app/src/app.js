import { runtime } from "/core/runtime.js"

const app = document.querySelector("#app")
if (!app) throw new Error("missing #app")

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

const diagnostics = document.querySelector("#diagnostics")
if (!diagnostics) throw new Error("missing #diagnostics")

await runtime.ready
/* THE Real app Start */
window.onerror = function (_message, _source, _lineno, _colno, error) {
  runtime.call("ui.toast", "error", errorParse(error))
  return false // prevents default logging (optional)
}

window.addEventListener("unhandledrejection", (e) => {
  runtime.call("ui.toast", "error", errorParse(e.reason))
})

await runtime.addPlugins(["plugins/layout3.wasm", "plugins/fs.wasm"])
document.body.appendChild(await (await import("/___/services.js")).init())

// const dir = unwrapResult(
//   await runtime.invoke("fs/fs::list", ["plugins"]),
//   "list plugins",
// )
// console.log(layoutView, dir)


/* THE DEBUG STUFF*/


const viewCalls = []
runtime.onCallView(async (target, args) => {
  const call = { target, args }
  viewCalls.push(call)
  console.log("got view call", call)
  if (target !== "benchmark:view") throw new Error(`unknown view ${target}`)
  return JSON.stringify({ ok: true, received: call })
})

function unwrapResult(result, label) {
  if (result && Object.prototype.hasOwnProperty.call(result, "ok")) return result.ok
  if (result && Object.prototype.hasOwnProperty.call(result, "err")) throw new Error(`${label}: ${result.err}`)
  throw new Error(`${label}: expected WIT result object`)
}

await runtime.addPlugins(["plugins/benchmark.wasm"], true)

const gamsJsonText = unwrapResult(
  await runtime.invoke("fs/fs::read-text", ["gams.json"]),
  "read /gams.json",
)
const entries = unwrapResult(
  await runtime.invoke("fs/fs::list", ["."]),
  "list /",
)

let sampleRead = null
const firstFile = entries.find((entry) => entry.type === "regular-file")
if (firstFile) {
  const bytes = unwrapResult(
    await runtime.invoke("fs/fs::read-file", [`${firstFile.name}`]),
    `read /${firstFile.name}`,
  )
  sampleRead = {
    name: firstFile.name,
    text: new TextDecoder().decode(new Uint8Array(bytes.slice(0, 256))),
  }
}

const viewCallResult = unwrapResult(
  await runtime.invoke("benchmark/benchmark::call-runtime-view", ["benchmark:view", `{"ping":true}`]),
  "benchmark runtime.call",
)
const wasiBenchmark = unwrapResult(
  await runtime.invoke("benchmark/benchmark::check-wasi-filesystem", ["."]),
  "benchmark wasi filesystem",
)

try {
  await runtime.addPlugins(["plugins/calculator.wasm", "plugins/adder.wasm"], true)
  const calculatorResult = await runtime.invoke("calculator/calculate::eval-expression", ["add", 2, 3])
  console.log("calculator result", calculatorResult)
} catch (error) {
  console.error(error)
}

diagnostics.textContent = JSON.stringify({
  gamsJsonText: gamsJsonText.slice(0, 512),
  entries,
  sampleRead,
  viewCalls,
  viewCallResult,
  wasiBenchmark,
  diagnostics: await runtime.diagnostics(),
}, null, 2)
console.log("gams.runtime ready", runtime)
