import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(new URL("../views/view-animation-graph.js", import.meta.url), "utf8")

test("animation graph does not shadow the DOM nodeName property", () => {
  assert.doesNotMatch(
    source,
    /^\s+nodeName\s*\(/m,
    "custom elements must preserve Node.nodeName as a string for host DOM code",
  )
})
