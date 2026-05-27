import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { compileXmlToMjir, initialGridFromXml, parseMjstate } from './mjir-v1.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const mjRoot = process.env.MARKOV_JUNIOR_REPO ?? resolve(repoRoot, '../MarkovJunior')
const plugin = join(repoRoot, 'build.nosync/plugins/markov-junior.comp.wasm')
const tempRoot = join(repoRoot, 'build.nosync/markov-junior-parity')
const maxSteps = 10
const models = [
  'Basic',
  'Growth',
  'MazeGrowth',
  'RegularSAW',
  'SelfAvoidingWalk',
  'IrregularMazeGrowth',
  'IrregularSAW',
  'StrangeGrowth',
]

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...options.env },
    maxBuffer: 64 * 1024 * 1024,
  })
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
  return result.stdout
}

function runComponent(modelIr, initialCells, config) {
  const stdout = run('cargo', [
    'run',
    '--quiet',
    '--manifest-path',
    'cmd/app/src-tauri/Cargo.toml',
    '--',
    'run',
    '--plug',
    plugin,
    'markov-junior/markov-junior::run',
    JSON.stringify([modelIr, initialCells, config]),
  ], {
    env: {
      GAMS_APP_CWD: join(repoRoot, 'examples/demo'),
      GAMS_WASMTIME_CACHE_DIR: join(repoRoot, 'build.nosync/wasmtime-cache-e2e/markov-junior-parity'),
      CARGO_TARGET_DIR: join(repoRoot, 'build.nosync/app/target'),
    },
  })
  const payload = JSON.parse(stdout)
  assert.equal(payload.err, undefined, payload.err)
  return payload.ok
}

function parityModel(name) {
  const tempDir = join(tempRoot, name)
  rmSync(tempDir, { recursive: true, force: true })
  mkdirSync(tempDir, { recursive: true })

  run('./bin/markovjunior-odin', [name, '--amount=1', `--steps=${maxSteps}`, '--format=text', `--output=${tempDir}`], { cwd: mjRoot })

  const outputs = readdirSync(tempDir).filter((entry) => entry.endsWith('.txt'))
  assert.equal(outputs.length, 1, `${name}: expected one original output, got ${outputs.join(', ')}`)
  const golden = parseMjstate(readFileSync(join(tempDir, outputs[0]), 'utf8'))
  const seed = Number(outputs[0].match(new RegExp(`${name}_(\\d+)\\.txt$`))?.[1])
  assert.ok(Number.isInteger(seed), `${name}: could not extract seed from ${outputs[0]}`)

  const xml = readFileSync(join(mjRoot, `models/${name}.xml`), 'utf8')
  const actual = runComponent(
    compileXmlToMjir(xml),
    initialGridFromXml(xml, golden.width, golden.height, golden.depth),
    { width: golden.width, height: golden.height, depth: golden.depth, seed, 'max-steps': maxSteps },
  )

  assert.equal(actual.width, golden.width, `${name}: width`)
  assert.equal(actual.height, golden.height, `${name}: height`)
  assert.equal(actual.depth, golden.depth, `${name}: depth`)
  assert.equal(actual.values, golden.values, `${name}: values`)
  assert.equal(actual.cells.length, golden.cells.length, `${name}: cell count`)
  for (let i = 0; i < golden.cells.length; i++) {
    assert.equal(actual.cells[i], golden.cells[i], `${name}: cell ${i}`)
  }
  console.log(`markov-junior ${name} parity ok`)
}

if (!existsSync(join(mjRoot, 'odin'))) {
  throw new Error(`MarkovJunior repo not found at ${mjRoot}; set MARKOV_JUNIOR_REPO`)
}

run('make', [plugin])
run('make', ['odin'], { cwd: mjRoot })
for (const model of models) parityModel(model)
