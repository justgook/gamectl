import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const repoRoot = resolve(projectRoot, '../..')
const generated = join(projectRoot, 'content/generated')
const compilerPlugin = join(repoRoot, 'build.nosync/plugins/director-compiler.comp.wasm')

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8' })
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed\n${result.stderr}\n${result.stdout}`)
  return result.stdout
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function invokeCompiler(source) {
  const result = spawnSync('cargo', [
    'run', '--quiet', '--manifest-path', 'cmd/app/src-tauri/Cargo.toml', '--',
    'run', '--plug', compilerPlugin,
    'director-compiler/director-compiler::compile', JSON.stringify([source]),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GAMS_APP_CWD: projectRoot,
      GAMS_WASMTIME_CACHE_DIR: join(repoRoot, 'build.nosync/wasmtime-cache-e2e/station-demo'),
      CARGO_TARGET_DIR: join(repoRoot, 'build.nosync/app/target'),
    },
  })
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
  return JSON.parse(result.stdout)
}

const generatedFixtures = [
  'decoder.odin',
  ...['power', 'key'].flatMap((name) => [
    `${name}.director.json`, `${name}.bindings.json`, `${name}.slots.json`, `${name}.rspk`,
  ]),
]
const before = Object.fromEntries(generatedFixtures.map((name) => [name, digest(join(generated, name))]))
run('node', ['examples/station-demo/content/build.mjs', '--check', '--generate-decoder'])
run('node', ['examples/station-demo/content/build.mjs', '--check', '--generate-decoder'])
const after = Object.fromEntries(generatedFixtures.map((name) => [name, digest(join(generated, name))]))
assert.deepEqual(after, before, 'drift checks must not rewrite checked-in generated fixtures')
assert.notEqual(before['power.rspk'], before['key.rspk'], 'the guided source edit must change packed content')

for (const variant of ['power', 'key']) {
  const source = readFileSync(join(projectRoot, `content/${variant}.director`), 'utf8')
  const compiled = invokeCompiler(source)
  assert.equal(compiled.err, undefined, `${variant} source failed compilation`)
  const bindings = JSON.parse(readFileSync(join(generated, `${variant}.bindings.json`), 'utf8'))
  const expected = new Map(bindings.map(({ kind, name, value }) => [`${kind}:${name}`, value]))
  assert.equal(expected.get('Entity:PLAYER'), compiled.ok && JSON.parse(compiled.ok).symbols.entities.player)
  assert.equal(expected.get('Entity:POWER_SWITCH'), JSON.parse(compiled.ok).symbols.entities.power_switch)
  assert.equal(expected.get('Entity:ACCESS_KEY'), JSON.parse(compiled.ok).symbols.entities.access_key)
  assert.equal(expected.get('Entity:EXIT'), JSON.parse(compiled.ok).symbols.entities.exit)
  assert.equal(expected.get('Word:powered'), JSON.parse(compiled.ok).symbols.words.powered)
  assert.equal(expected.get('Word:carrying_key'), JSON.parse(compiled.ok).symbols.words.carrying_key)
  assert.equal(expected.get('Word:locked'), JSON.parse(compiled.ok).symbols.words.locked)
}

const invalid = invokeCompiler('PLAYER\nON: EXIT.locked\nIF: PLAYER.powered\n')
assert.equal(invalid.ok, undefined, 'invalid source must not produce IR')
assert.ok(Array.isArray(invalid.err) && invalid.err.length > 0, 'invalid source must return diagnostics')
assert.equal(invalid.err[0].code, 'semantic-unknown-entity')

const powerBytes = readFileSync(join(generated, 'power.rspk'))
assert.equal(powerBytes.subarray(0, 4).toString(), 'RSPK')
assert.equal(powerBytes.readUInt16LE(4), 1)
assert.equal(powerBytes.readUInt16LE(6), 2)

console.log('station-demo compiler -> symbols -> respack e2e ok')
