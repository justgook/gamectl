import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(
  new URL("../views/view-tilemap.js", import.meta.url),
  "utf8",
)

function deleteSelected() {
  const match = source.match(
    /  async deleteSelected\(\) \{[\s\S]*?\n  \}\n\n  canCopySelection/,
  )
  assert.ok(match, "view-tilemap deleteSelected method must be present")
  const method = match[0].replace(/\n\n  canCopySelection[\s\S]*$/, "")
  return Function(`return ({${method}}).deleteSelected`)()
}

test("deleting selected tiles leaves the clipboard unchanged", async () => {
  const clipboard = { entries: [{ tiles: [{ tile: 7 }] }] }
  const layers = [1, 3]
  const cells = [{ x: 2, y: 4 }]
  const calls = []
  const view = {
    clipboard,
    canCopySelection: () => true,
    copyLayerIndexes: () => layers,
    selectionTool: { cells: () => cells },
    state: {
      deleteCells(actualLayers, actualCells) {
        calls.push({ actualLayers, actualCells })
        return true
      },
    },
    refreshSnapshot: async (status) => calls.push({ status }),
  }

  await deleteSelected().call(view)

  assert.strictEqual(view.clipboard, clipboard)
  assert.deepEqual(calls, [
    { actualLayers: layers, actualCells: cells },
    { status: "Selection deleted" },
  ])
})
