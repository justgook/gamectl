import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

test("glob preset traverses explicit directory symlinks", () => {
  const result = spawnSync("lua", ["test/fixtures/glob-preset.lua"], { encoding: "utf8" })
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`)
})
