import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { planCreateEntry } from "../packages/util/files-create-path.js"

const filesRenameSource = await readFile(
  new URL("../views/files-rename.js", import.meta.url),
  "utf8",
)

test("a trailing slash plans a directory from the create-file flow", () => {
  assert.deepEqual(planCreateEntry("art/characters/", "regular-file"), {
    kind: "directory",
    relativePath: "art/characters",
    directorySegments: ["art", "characters"],
  })
})

test("a nested filename plans its parent directories", () => {
  assert.deepEqual(planCreateEntry("a/b/c/d.txt", "regular-file"), {
    kind: "regular-file",
    relativePath: "a/b/c/d.txt",
    directorySegments: ["a", "b", "c"],
  })
})

test("the create-folder flow also accepts a nested path", () => {
  assert.deepEqual(planCreateEntry("a/b/c", "directory"), {
    kind: "directory",
    relativePath: "a/b/c",
    directorySegments: ["a", "b", "c"],
  })
})

test("create paths reject absolute, empty, and reserved segments", () => {
  assert.throws(() => planCreateEntry("/a.txt", "regular-file"), /relative/)
  assert.throws(() => planCreateEntry("a//b.txt", "regular-file"), /empty/)
  assert.throws(() => planCreateEntry("a/../b.txt", "regular-file"), /Reserved/)
  assert.throws(() => planCreateEntry("/", "regular-file"), /relative/)
})

test("files-rename spreads filesystem arguments and checks the stat method", () => {
  assert.match(
    filesRenameSource,
    /runtime\.invoke\(`fs\/fs::\$\{method\}`, \.\.\.input\)/,
  )
  assert.match(filesRenameSource, /callFs\("stat", path\)/)
  assert.doesNotMatch(filesRenameSource, /callFs\("stats", path\)/)
})
