import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("../views/view-tilemap.js", import.meta.url), "utf8")

function tilemapOpenPath() {
  const match = source.match(/  async openPath\(path, \{ autoFit = true \} = \{}\) \{[\s\S]*?\n  \}\n\n  async handleLayerAction/)
  assert.ok(match, "view-tilemap openPath method must be present")
  const method = match[0].replace(/\n\n  async handleLayerAction[\s\S]*$/, "")
  return Function("assert", `return ({${method}}).openPath`)(assert)
}

test("opening a tilemap publishes its path through data-source", async () => {
  const attributes = new Map([["data-source", "maps/old.tilemap.json"]])
  const view = {
    loadTilemapFile: async (path) => ({ path, data: "{}" }),
    state: { open: () => ({ handle: 1 }) },
    tilesetSourceKey: "old",
    selectedLayerIndexes: new Set(),
    selectionTool: { clear() {} },
    refreshSnapshot: async () => {},
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
  }

  await tilemapOpenPath().call(view, "maps/new.tilemap.json")

  assert.equal(attributes.get("data-source"), "maps/new.tilemap.json")
})
