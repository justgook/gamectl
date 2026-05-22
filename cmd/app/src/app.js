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
  const gamsJsonText2 = unwrap(await runtime.invoke("fs/fs::read-text", "gams.json"))
  console.timeEnd("read gams.json")

  console.time("addPlugins")
  await runtime.addPlugins([
    "plugins/sql-vec.comp.wasm",
    "plugins/respack.comp.wasm",
    "plugins/pack.comp.wasm",
    "plugins/random.comp.wasm",
    "plugins/automap.comp.wasm",
    "plugins/layout.comp.wasm",
    "plugins/lua.comp.wasm",
    "plugins/scaler.comp.wasm",
    "plugins/treegen.comp.wasm",
    "plugins/minimap.comp.wasm",
    "plugins/image.comp.wasm",
    "plugins/respack.comp.wasm",
  ], true)
  console.timeEnd("addPlugins")


  console.time("init UI")
  await init(JSON.parse(gamsJsonText2))
  console.timeEnd("init UI")
}

await main()
// // DO NOT USE - JSUT FOR DEBUG
globalThis.runtime = runtime
globalThis.unwrap = unwrap
const { sql } = await import("/util/sql.js")
globalThis.sql = sql
console.time("open sql-vec")
console.log("sql-vec version", await sql.value("select vec_version() as version"))
console.timeEnd("open sql-vec")

fpsMetter()

function fpsMetter() {
  const id = "__fps_overlay__";
  document.getElementById(id)?.remove();

  const el = document.createElement("div");
  el.id = id;
  Object.assign(el.style, {
    position: "fixed",
    top: "8px",
    left: "8px",
    zIndex: "2147483647",
    padding: "4px 8px",
    font: "12px monospace",
    color: "#0f0",
    background: "rgba(0,0,0,0.75)",
    borderRadius: "4px",
    pointerEvents: "none",
    userSelect: "none",
  });
  el.textContent = "FPS: --";
  document.documentElement.appendChild(el);

  let frames = 0;
  let last = performance.now();

  function loop(now) {
    frames++;
    if (now - last >= 500) {
      const fps = Math.round((frames * 1000) / (now - last));
      el.textContent = `FPS: ${fps}`;
      frames = 0;
      last = now;
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}
