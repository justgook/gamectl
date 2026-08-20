import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

const result = spawnSync("lua", ["test/fixtures/view-ng-state-compiler.lua"], { encoding: "utf8" })

test("view-ng compiler carries GetVar and SetVar Iteration State", () => {
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`)
})
