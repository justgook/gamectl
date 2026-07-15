import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const plugin = join(repoRoot, 'build.nosync/plugins/director-compiler.comp.wasm')

function invokeCompiler(source) {
  const result = spawnSync('cargo', [
    'run',
    '--quiet',
    '--manifest-path',
    'cmd/app/src-tauri/Cargo.toml',
    '--',
    'run',
    '--plug',
    plugin,
    'director-compiler/director-compiler::compile',
    JSON.stringify([source]),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GAMS_APP_CWD: join(repoRoot, 'examples/demo'),
      GAMS_WASMTIME_CACHE_DIR: join(repoRoot, 'build.nosync/wasmtime-cache-e2e/director-compiler.comp'),
      CARGO_TARGET_DIR: join(repoRoot, 'build.nosync/app/target'),
    },
  })

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
  return JSON.parse(result.stdout)
}

const result = invokeCompiler('  # an empty Director document\n\n')
assert.equal(result.err, undefined, `blank source compilation failed: ${JSON.stringify(result.err)}`)
assert.deepEqual(JSON.parse(result.ok), {
  entities: [],
  rules: [],
  matchers: [],
  queries: [],
  changes: [],
  words: [],
  value_paths: [],
  path_steps: [],
})

const entities = invokeCompiler(`
PLAYER.money = 10
  .mp = 124
.hp = 32
TORCH.item.illumination = 7.current_location = player
CAVE.location.dark
`)
assert.equal(entities.err, undefined, `entity compilation failed: ${JSON.stringify(entities.err)}`)
assert.deepEqual(JSON.parse(entities.ok), {
  entities: [
    {
      id: 0,
      tags: [],
      stats: [
        { key: 0, value: 10 },
        { key: 1, value: 124 },
        { key: 2, value: 32 },
      ],
      links: [],
    },
    {
      id: 1,
      tags: [3],
      stats: [{ key: 4, value: 7 }],
      links: [{ key: 5, target: 0 }],
    },
    { id: 2, tags: [6, 7], stats: [], links: [] },
  ],
  rules: [],
  matchers: [],
  queries: [],
  changes: [],
  words: ['money', 'mp', 'hp', 'item', 'illumination', 'current_location', 'location', 'dark'],
  value_paths: [],
  path_steps: [],
})

const interaction = invokeCompiler(`
PLAYER
CLASSROOM_101.location
DESK.item.fixed.current_location = CLASSROOM_101
APPLE.item.current_location = CLASSROOM_101

ON: *.item.!fixed.!current_location = PLAYER
DO: $.current_location = PLAYER
`)
assert.equal(interaction.err, undefined, `interaction rule compilation failed: ${JSON.stringify(interaction.err)}`)
const interactionIr = JSON.parse(interaction.ok)
assert.equal(interactionIr.rules.length, 1)
assert.deepEqual(interactionIr.rules[0], {
  id: 0,
  trigger: { kind: 'Entity_Matcher', signal: 0, matcher_index: 0 },
  conditions: { offset: 0, count: 0 },
  changes: { offset: 0, count: 1 },
  weight: 3,
})
assert.deepEqual(interactionIr.matchers.map(({ selector, queries }) => ({ selector, queries })), [
  { selector: { kind: 'Any', entity: 0 }, queries: { offset: 0, count: 3 } },
  { selector: { kind: 'Entity', entity: 0 }, queries: { offset: 5, count: 0 } },
])
assert.deepEqual(interactionIr.queries.map(({ kind, key, nested }) => ({ kind, key, nested })), [
  { kind: 'Has_Tag', key: 1, nested: 0 },
  { kind: 'Not', key: 0, nested: 3 },
  { kind: 'Not', key: 0, nested: 4 },
  { kind: 'Has_Tag', key: 2, nested: 0 },
  { kind: 'Has_Link', key: 3, nested: 0 },
])
assert.deepEqual(interactionIr.changes, [
  {
    target: { kind: 'Trigger', entity: 0, matcher_index: 0 },
    kind: 'Set_Link',
    key: 3,
    int_value: 0,
    link_target: { kind: 'Entity', entity: 0, key: 0 },
  },
])

const conditionedRule = invokeCompiler(`
PLAYER.chapter = 1.fear = 4
BROADWAY_STREET.leaving_plot = 1
BRIEFCASE
THIEF

ON: *.line
IF: PLAYER.chapter = 1
    BROADWAY_STREET.leaving_plot = 1
    PLAYER.fear < 5
DO: BRIEFCASE.location = THIEF
    BROADWAY_STREET.leaving_plot = 2
`)
assert.equal(conditionedRule.err, undefined, `conditioned rule compilation failed: ${JSON.stringify(conditionedRule.err)}`)
const conditionedIr = JSON.parse(conditionedRule.ok)
assert.deepEqual(conditionedIr.rules[0].conditions, { offset: 1, count: 3 })
assert.deepEqual(conditionedIr.rules[0].changes, { offset: 0, count: 2 })
assert.equal(conditionedIr.rules[0].weight, 34)
assert.deepEqual(conditionedIr.changes.map(({ kind, key, int_value }) => ({ kind, key, int_value })), [
  { kind: 'Set_Link', key: 4, int_value: 0 },
  { kind: 'Set_Stat', key: 2, int_value: 2 },
])

const minimumInteger = invokeCompiler('DEBT.value = -2147483648\n')
assert.equal(minimumInteger.err, undefined, 'minimum i32 value must compile')
assert.deepEqual(JSON.parse(minimumInteger.ok).entities[0].stats, [{ key: 0, value: -2147483648 }])

const invalidEscape = invokeCompiler('ON: "bad\\ntrigger"\nDO: PLAYER.ready\n')
assert.equal(invalidEscape.ok, undefined, 'invalid signal escape must fail compilation')
assert.deepEqual(invalidEscape.err, [
  {
    code: 'lex-invalid-escape',
    message: 'quoted signals support only \\" and \\\\ escapes',
    span: {
      start: { 'byte-offset': 8, line: 1, column: 9 },
      end: { 'byte-offset': 10, line: 1, column: 11 },
    },
  },
])

const unicodeSignal = invokeCompiler('ON: "café"\nDO: PLAYER.ready\n')
assert.equal(unicodeSignal.ok, undefined, 'Unicode signal characters must fail compilation')
assert.deepEqual(unicodeSignal.err, [
  {
    code: 'lex-invalid-signal-character',
    message: 'quoted signals support printable ASCII only',
    span: {
      start: { 'byte-offset': 8, line: 1, column: 9 },
      end: { 'byte-offset': 10, line: 1, column: 10 },
    },
  },
])

const oversizedInteger = invokeCompiler('PLAYER.hp=2147483648\n')
assert.equal(oversizedInteger.ok, undefined, 'out-of-range integers must fail compilation')
assert.deepEqual(oversizedInteger.err, [
  {
    code: 'lex-integer-out-of-range',
    message: 'integer must fit in signed 32-bit range',
    span: {
      start: { 'byte-offset': 10, line: 1, column: 11 },
      end: { 'byte-offset': 20, line: 1, column: 21 },
    },
  },
])

const invalidCharacter = invokeCompiler('PLAYER.[bad\n')
assert.equal(invalidCharacter.ok, undefined, 'unknown punctuation must fail compilation')
assert.deepEqual(invalidCharacter.err, [
  {
    code: 'lex-invalid-character',
    message: 'invalid character',
    span: {
      start: { 'byte-offset': 7, line: 1, column: 8 },
      end: { 'byte-offset': 8, line: 1, column: 9 },
    },
  },
])

const projectConfig = JSON.parse(readFileSync(join(repoRoot, 'examples/demo/gams.json'), 'utf8'))
assert.ok(
  projectConfig.plugins.includes('plugins/director-compiler.comp.wasm'),
  'demo Project must register director-compiler.comp',
)

console.log('director-compiler.comp source compilation e2e ok')
