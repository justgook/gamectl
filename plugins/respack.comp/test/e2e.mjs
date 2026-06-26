import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const plugin = join(repoRoot, 'build.nosync/plugins/respack.comp.wasm')
const exampleSchemaPath = join(repoRoot, 'plugins/respack.comp/example.respack.json')
const exampleSlotsPath = join(repoRoot, 'plugins/respack.comp/testdata/example.slots.json')

function invokeRespack(target, args) {
  const result = spawnSync('cargo', [
    'run',
    '--quiet',
    '--manifest-path',
    'cmd/app/src-tauri/Cargo.toml',
    '--',
    'run',
    '--plug',
    plugin,
    target,
    JSON.stringify(args),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GAMS_APP_CWD: join(repoRoot, 'examples/demo'),
      GAMS_WASMTIME_CACHE_DIR: join(repoRoot, 'build.nosync/wasmtime-cache-e2e/respack.comp'),
      CARGO_TARGET_DIR: join(repoRoot, 'build.nosync/app/target'),
    },
  })

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
  return JSON.parse(result.stdout)
}

function readU16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readU32LE(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

function inspectDump(bytes) {
  assert.ok(bytes.length >= 8, 'dump too small')
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), 'RSPK')
  const version = readU16LE(bytes, 4)
  const slotCount = readU16LE(bytes, 6)
  const slots = []
  for (let i = 0; i < slotCount; i += 1) {
    const entry = 8 + i * 8
    slots.push({
      offset: readU32LE(bytes, entry),
      length: readU32LE(bytes, entry + 4),
    })
  }
  return { version, slotCount, slots }
}

const schema = readFileSync(exampleSchemaPath, 'utf8')
const slotsJson = readFileSync(exampleSlotsPath, 'utf8')

const odin = invokeRespack('respack/respack::generate-odin', [schema])
assert.equal(odin.err, undefined, `respack.generate-odin failed for restored gams2 example: ${odin.err}`)
assert.match(odin.ok, /read_slot_0_atlas/)
assert.match(odin.ok, /read_slot_2_level/)
assert.match(odin.ok, /read_slot_3_animation/)

const packed = invokeRespack('respack/respack::build', [schema, slotsJson])
assert.equal(packed.err, undefined, `respack.build failed for restored gams2 example data: ${packed.err}`)
assert.ok(Array.isArray(packed.ok), 'build should return byte array')

const dump = inspectDump(packed.ok)
assert.equal(dump.version, 1)
assert.equal(dump.slotCount, 4)
for (const [index, slot] of dump.slots.entries()) {
  assert.ok(slot.length > 0, `slot ${index} should be populated`)
}

console.log('respack.comp restored gams2 example e2e ok')
