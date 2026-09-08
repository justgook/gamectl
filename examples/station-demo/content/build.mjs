import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const repoRoot = resolve(projectRoot, '../..')
const generatedDir = join(here, 'generated')
const schemaPath = join(here, 'director.rspk.json')
const compilerPlugin = join(repoRoot, 'build.nosync/plugins/director-compiler.comp.wasm')
const respackPlugin = join(repoRoot, 'build.nosync/plugins/respack.comp.wasm')
const args = process.argv.slice(2)
const generateDecoder = args.includes('--generate-decoder')
const check = args.includes('--check')
const supportedFlags = new Set(['--generate-decoder', '--check'])
for (const arg of args.filter((value) => value.startsWith('--'))) {
  assert.ok(supportedFlags.has(arg), `unknown option: ${arg}`)
}
const requestedVariants = args.filter((arg) => !arg.startsWith('--'))
const variants = requestedVariants.length === 0 ? ['power', 'key'] : requestedVariants

for (const variant of variants) {
  assert.ok(['power', 'key'].includes(variant), `unknown variant: ${variant}`)
}

function emit(path, contents) {
  const expected = Buffer.isBuffer(contents) ? contents : Buffer.from(contents)
  if (check) {
    const actual = readFileSync(path)
    assert.ok(actual.equals(expected),
      `${path} is stale; regenerate the checked-in fixtures with content/build.mjs`)
    return
  }
  writeFileSync(path, expected)
}

function invoke(plugin, target, args) {
  const result = spawnSync('cargo', [
    'run', '--quiet', '--manifest-path', 'cmd/app/src-tauri/Cargo.toml', '--',
    'run', '--plug', plugin, target, JSON.stringify(args),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GAMS_APP_CWD: projectRoot,
      GAMS_WASMTIME_CACHE_DIR: join(repoRoot, 'build.nosync/wasmtime-cache-e2e/station-demo'),
      CARGO_TARGET_DIR: join(repoRoot, 'build.nosync/app/target'),
    },
  })
  assert.equal(result.status, 0, `${target} failed\n${result.stderr}\n${result.stdout}`)
  return JSON.parse(result.stdout)
}

function isUint32(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff
}

function requireId(symbols, group, name) {
  assert.ok(symbols[group] !== null && typeof symbols[group] === 'object',
    `compiler output missing symbols.${group}`)
  const id = symbols[group][name]
  assert.ok(isUint32(id), `compiler output missing or invalid symbols.${group}.${name}`)
  return id
}

function validateRange(range, poolLength, label) {
  assert.ok(range !== null && typeof range === 'object' && !Array.isArray(range),
    `${label} must be an object`)
  assert.ok(isUint32(range.offset) && isUint32(range.count),
    `${label} offset and count must be uint32 integers`)
  assert.ok(range.offset <= poolLength && range.count <= poolLength - range.offset,
    `${label} exceeds its IR pool`)
}

function validateIr(ir) {
  for (const field of ['entities', 'rules', 'matchers', 'queries', 'changes']) {
    assert.ok(Array.isArray(ir[field]), `compiler output ${field} must be an array`)
  }
  assert.equal(ir.entities.length, 4, 'showcase source must declare exactly four entities')
  assert.equal(ir.rules.length, 3, 'showcase source must compile exactly three rules')

  for (const [index, entity] of ir.entities.entries()) {
    assert.ok(isUint32(entity.id), `entity ${index} id must be a uint32 integer`)
    assert.equal(entity.id, index, `entity ${index} violates contiguous runtime ID invariant`)
  }
  for (const rule of ir.rules) {
    assert.ok(isUint32(rule.id), 'rule id must be a uint32 integer')
    validateRange(rule.conditions, ir.matchers.length, `rule ${rule.id} conditions range`)
    validateRange(rule.changes, ir.changes.length, `rule ${rule.id} changes range`)
    if (rule.trigger.kind === 'Entity_Matcher') {
      assert.ok(isUint32(rule.trigger.matcher_index) && rule.trigger.matcher_index < ir.matchers.length,
        `rule ${rule.id} trigger matcher is out of range`)
    }
  }
  for (const [index, matcher] of ir.matchers.entries()) {
    validateRange(matcher.queries, ir.queries.length, `matcher ${index} query range`)
  }
}

function makeBindings(symbols) {
  const binding = (kind, outputName, symbolGroup, symbolName) => ({
    kind,
    name: outputName,
    value: requireId(symbols, symbolGroup, symbolName),
  })
  return [
    binding('Entity', 'PLAYER', 'entities', 'player'),
    binding('Entity', 'POWER_SWITCH', 'entities', 'power_switch'),
    binding('Entity', 'ACCESS_KEY', 'entities', 'access_key'),
    binding('Entity', 'EXIT', 'entities', 'exit'),
    binding('Word', 'powered', 'words', 'powered'),
    binding('Word', 'carrying_key', 'words', 'carrying_key'),
    binding('Word', 'locked', 'words', 'locked'),
  ]
}

if (!check) mkdirSync(generatedDir, { recursive: true })
const schema = readFileSync(schemaPath, 'utf8')

if (generateDecoder) {
  const generated = invoke(respackPlugin, 'respack/respack::generate-odin', [schema])
  assert.equal(generated.err, undefined, `decoder generation failed: ${generated.err}`)
  emit(join(generatedDir, 'decoder.odin'), generated.ok)
}

for (const variant of variants) {
  const source = readFileSync(join(here, `${variant}.director`), 'utf8')
  const compiled = invoke(compilerPlugin, 'director-compiler/director-compiler::compile', [source])
  assert.equal(compiled.err, undefined,
    `${variant}.director failed:\n${JSON.stringify(compiled.err, null, 2)}`)
  const ir = JSON.parse(compiled.ok)
  const symbols = ir.symbols
  assert.ok(symbols !== null && typeof symbols === 'object',
    'compiler output must contain symbol metadata')
  const bindings = makeBindings(symbols)
  delete ir.symbols
  // value_paths/path_steps are emitted placeholders for planned IR and are not
  // part of the currently implemented game runtime or this packing schema.
  delete ir.value_paths
  delete ir.path_steps
  validateIr(ir)

  const slots = [ir, bindings]
  const slotsJson = JSON.stringify(slots)
  const packed = invoke(respackPlugin, 'respack/respack::build', [schema, slotsJson])
  assert.equal(packed.err, undefined, `${variant} pack failed: ${packed.err}`)
  assert.ok(Array.isArray(packed.ok), `${variant} pack did not return bytes`)

  emit(join(generatedDir, `${variant}.director.json`), `${JSON.stringify(ir, null, 2)}\n`)
  emit(join(generatedDir, `${variant}.bindings.json`), `${JSON.stringify(bindings, null, 2)}\n`)
  emit(join(generatedDir, `${variant}.slots.json`), `${JSON.stringify(slots, null, 2)}\n`)
  emit(join(generatedDir, `${variant}.rspk`), Buffer.from(packed.ok))
  console.log(`${variant}: ${packed.ok.length} bytes${check ? ' (checked)' : ''}`)
}
