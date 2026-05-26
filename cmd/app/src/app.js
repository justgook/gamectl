import { runtime, unwrap } from "/core/runtime.js"
// import { openSqlVecConnection, sql } from "/core/sql.js"
import { init } from "/___/services.js"

app.innerHTML = ""

async function main() {
  console.time("runtime.ready")
  await runtime.ready
  console.timeEnd("runtime.ready")

  await runtime.addPlugins(["plugins/fs.comp.wasm"], true)
  console.time("read gams.json")
  const gamsJsonText2 = unwrap(
    await runtime.invoke("fs/fs::read-text", "gams.json"),
  )
  const config = JSON.parse(gamsJsonText2)
  console.timeEnd("read gams.json")

  console.time("addPlugins")
  await runtime.addPlugins(config.plugins, true)
  console.timeEnd("addPlugins")

  console.time("init UI")
  await init(config)
  console.timeEnd("init UI")
}

await main()

//Runtime debut
globalThis.runtime = runtime
