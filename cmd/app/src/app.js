import { runtime, unwrap } from "/core/runtime.js"
import { init } from "/___/services.js"

app.innerHTML = ""

async function main() {

  console.time("runtime.ready")
  await runtime.ready
  console.timeEnd("runtime.ready")

  console.time("addPlugins")
  await runtime.addPlugins([
    "plugins/random.comp.wasm",
    "plugins/fs.comp.wasm",
    "plugins/layout.comp.wasm",
    "plugins/lua.comp.wasm",
    "plugins/treegen.comp.wasm",
  ], true)
  console.timeEnd("addPlugins")

  console.time("read gams.json")
  const gamsJsonText2 = unwrap(await runtime.invoke("fs/fs::read-text", "gams.json"))
  console.timeEnd("read gams.json")

  console.time("init UI")
  await init(JSON.parse(gamsJsonText2))
  console.timeEnd("init UI")


  /* THE DEBUG STUFF*/

  // await runtime.addPlugins(["plugins/treegen.comp.wasm"], true)
  // await runtime.invoke("tree-generator/tree-generator::gen", [{ "node-count": 40, "max-depth": 0, "max-branching": 0, "root-branches": 0 }])

}
setTimeout(main, 0)
// // DO NOT USE - JSUT FOR DEBUG
globalThis.runtime = runtime
globalThis.unwrap = unwrap
