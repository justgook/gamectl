import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const pack = join(repoRoot, 'build.nosync/plugins/pack.comp.wasm')

function runPack(request) {
  const result = spawnSync('cargo', [
    'run',
    '--quiet',
    '--manifest-path',
    'cmd/app/src-tauri/Cargo.toml',
    '--',
    'run',
    '--plug',
    pack,
    'pack/pack::pack',
    JSON.stringify([request]),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GAMS_APP_CWD: join(repoRoot, 'examples/demo'),
      GAMS_WASMTIME_CACHE_DIR: join(repoRoot, 'build.nosync/wasmtime-cache-e2e/pack.comp'),
      CARGO_TARGET_DIR: join(repoRoot, 'build.nosync/app/target'),
    },
  })

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
  return JSON.parse(result.stdout)
}

const success = runPack({
  width: 8,
  height: 8,
  padding: 1,
  'auto-size': false,
  rects: [
    { id: null, width: 3, height: 2 },
    { id: 9, width: 2, height: 2 },
    { id: null, width: 10, height: 1 },
  ],
})

assert.ok(success.ok, `pack failed: ${JSON.stringify(success)}`)
assert.equal(success.ok.width, 8)
assert.equal(success.ok.height, 8)
assert.equal(success.ok.padding, 1)
assert.equal(success.ok['packed-all'], false)
assert.equal(success.ok['packed-count'], 2)
assert.equal(success.ok['failed-count'], 1)
assert.equal(success.ok.rects.length, 3)
assert.equal(success.ok.rects[0].id, 0)
assert.equal(success.ok.rects[0].packed, true)
assert.equal(typeof success.ok.rects[0].x, 'number')
assert.equal(typeof success.ok.rects[0].y, 'number')
assert.equal(success.ok.rects[1].id, 9)
assert.equal(success.ok.rects[1].packed, true)
assert.equal(success.ok.rects[2].id, 2)
assert.equal(success.ok.rects[2].packed, false)
assert.equal(success.ok.rects[2].x, null)
assert.equal(success.ok.rects[2].y, null)

const autoSized = runPack({
  width: 3,
  height: 5,
  padding: 0,
  'auto-size': true,
  rects: [
    { id: null, width: 5, height: 3 },
    { id: null, width: 3, height: 3 },
    { id: null, width: 2, height: 2 },
  ],
})

assert.ok(autoSized.ok, `autoSize pack failed: ${JSON.stringify(autoSized)}`)
assert.equal(autoSized.ok['packed-all'], true)
assert.equal(autoSized.ok['packed-count'], 3)
assert.equal(autoSized.ok['failed-count'], 0)
assert.equal(autoSized.ok.width, 8)
assert.equal(autoSized.ok.height, 8)
assert.equal(autoSized.ok.rects.every((rect) => rect.packed), true)

const badInput = runPack({
  width: 0,
  height: 4,
  padding: 0,
  'auto-size': false,
  rects: [],
})

assert.ok(badInput.err, 'expected bad input to fail')
assert.equal(badInput.err.code, 'invalid-arg')

console.log('pack.comp e2e ok')
