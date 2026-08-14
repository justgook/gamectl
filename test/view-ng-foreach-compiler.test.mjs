import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

const result = spawnSync("lua", ["test/fixtures/view-ng-foreach-compiler.lua"], { encoding: "utf8" })

test("view-ng compiler executes nested longest-input For Each with global Skip and Break", () => {
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`)
})
