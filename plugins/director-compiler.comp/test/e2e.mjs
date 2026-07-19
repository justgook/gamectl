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
  value_paths: [],
  path_steps: [],
  symbols: { entities: {}, words: {} },
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
  value_paths: [],
  path_steps: [],
  symbols: {
    entities: { player: 0, torch: 1, cave: 2 },
    words: { money: 0, mp: 1, hp: 2, item: 3, illumination: 4, current_location: 5, location: 6, dark: 7 },
  },
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

const mockLike = invokeCompiler(String.raw`
PLAYER.hp = 100.money = 0.dialog
-COIN.coin
GOBLIN.enemy

ON: "ENTER_\"ROOM\\A#1"
DO: +COIN
    PLAYER.money + 1.dialog
.hp - 2
    PLAYER.-dialog
    -GOBLIN
    -(*.enemy)
    (*.enemy).stunned.hp = 3
`)
assert.equal(mockLike.err, undefined, `mock-like lifecycle compilation failed: ${JSON.stringify(mockLike.err)}`)
const mockLikeIr = JSON.parse(mockLike.ok)
assert.equal(mockLikeIr.entities[1].removed, true, 'prefixed declarations must start removed')
assert.equal(mockLikeIr.entities[0].removed, undefined, 'ordinary declarations must start available')
assert.equal(mockLikeIr.entities[2].removed, undefined, 'remove changes must not alter initial availability')
assert.deepEqual(mockLikeIr.rules[0], {
  id: 0,
  trigger: { kind: 'Signal', signal: 5, matcher_index: 0 },
  conditions: { offset: 0, count: 0 },
  changes: { offset: 0, count: 9 },
  weight: 0,
})
assert.equal(mockLikeIr.symbols.entities.player, 0, 'entity symbols must use canonical lowercase names')
assert.equal(mockLikeIr.symbols.words['enter_"room\\a#1'], 5, 'word symbols must use canonical unescaped names')
assert.deepEqual(mockLikeIr.changes.map(({ target, kind, key, int_value }) => ({
  target: target.kind,
  matcher_index: target.matcher_index,
  kind,
  key,
  int_value,
})), [
  { target: 'Entity', matcher_index: 0, kind: 'Add_Entity', key: 0, int_value: 0 },
  { target: 'Entity', matcher_index: 0, kind: 'Inc_Stat', key: 1, int_value: 1 },
  { target: 'Entity', matcher_index: 0, kind: 'Add_Tag', key: 2, int_value: 0 },
  { target: 'Entity', matcher_index: 0, kind: 'Dec_Stat', key: 0, int_value: 2 },
  { target: 'Entity', matcher_index: 0, kind: 'Remove_Property', key: 2, int_value: 0 },
  { target: 'Entity', matcher_index: 0, kind: 'Remove_Entity', key: 0, int_value: 0 },
  { target: 'All_Matching', matcher_index: 0, kind: 'Remove_Entity', key: 0, int_value: 0 },
  { target: 'All_Matching', matcher_index: 1, kind: 'Add_Tag', key: 6, int_value: 0 },
  { target: 'All_Matching', matcher_index: 1, kind: 'Set_Stat', key: 0, int_value: 3 },
])

const cyberpunkSource = readFileSync(join(repoRoot, 'examples/demo/CYBERPUNK/director.director'), 'utf8')
const cyberpunk = invokeCompiler(cyberpunkSource)
assert.equal(cyberpunk.err, undefined, `CYBERPUNK Director source failed: ${JSON.stringify(cyberpunk.err)}`)
const cyberpunkIr = JSON.parse(cyberpunk.ok)
assert.equal(cyberpunkIr.entities.length, 20)
assert.equal(cyberpunkIr.rules.length, 16)
assert.deepEqual(cyberpunkIr.symbols, {
  entities: {
    player: 0,
    segment_trigger: 1,
    coin_a: 2,
    coin_b: 3,
    coin_prefab: 4,
    enemy_a: 5,
    enemy_prefab: 6,
    world_trigger: 7,
    dialog_root: 8,
    dialog_job_result: 9,
    dialog_damage_result: 10,
    dialog_heal_result: 11,
    job_answer: 12,
    damage_answer: 13,
    heal_answer: 14,
    leave_dialog_answer: 15,
    leave_answer: 16,
    patrolling: 17,
    chasing: 18,
    attacking: 19,
  },
  words: {
    hp: 0,
    money: 1,
    enter_room_001: 2,
    coin: 3,
    prefab: 4,
    spawn_x: 5,
    spawn_y: 6,
    prefab_id: 7,
    enemy: 8,
    world_entity: 9,
    dialog: 10,
    text_id: 11,
    answer_1: 12,
    answer_2: 13,
    answer_3: 14,
    answer_4: 15,
    behavior: 16,
    spawn: 17,
    vision_enter: 18,
    attack_range: 19,
    sees: 20,
    target: 21,
    firing: 22,
    vision_exit: 23,
    attack_enter: 24,
    attack_exit: 25,
  },
})
assert.deepEqual(cyberpunkIr.changes.map(({ kind }) => kind), [
  'Add_Tag', 'Add_Tag', 'Add_Tag', 'Set_Link', 'Inc_Stat',
  'Remove_Property', 'Inc_Stat', 'Remove_Property', 'Set_Link', 'Set_Link',
  'Set_Link', 'Add_Tag', 'Set_Link', 'Set_Link', 'Set_Link',
  'Remove_Property', 'Set_Link', 'Add_Tag', 'Remove_Property', 'Remove_Property',
  'Remove_Property', 'Set_Link', 'Set_Link', 'Set_Link', 'Set_Link', 'Add_Tag',
  'Remove_Property', 'Remove_Property', 'Set_Link', 'Remove_Property',
  'Remove_Property', 'Remove_Property', 'Set_Link', 'Set_Link', 'Dec_Stat',
  'Inc_Stat', 'Set_Link', 'Dec_Stat', 'Inc_Stat', 'Set_Link', 'Inc_Stat',
  'Set_Link', 'Remove_Property', 'Remove_Property',
])
assert.equal(cyberpunkIr.entities[2].removed, undefined)
assert.equal(cyberpunkIr.entities[3].removed, undefined)
assert.equal(cyberpunkIr.entities[5].removed, undefined)

const cyberpunkDirectorEntities = JSON.parse(readFileSync(
  join(repoRoot, 'examples/demo/CYBERPUNK/mock_director_entities.json'),
  'utf8',
))
assert.equal(
  cyberpunkDirectorEntities.components[0].id,
  cyberpunkIr.symbols.entities.world_trigger,
  'dialogue trigger world entity must track the compiled WORLD_TRIGGER id',
)

const invalidSignalTriggerReference = invokeCompiler(`
PLAYER
ON: "signal"
DO: -$
`)
assert.equal(invalidSignalTriggerReference.ok, undefined)
assert.equal(invalidSignalTriggerReference.err[0].code, 'semantic-invalid-trigger-reference')

const invalidAddTarget = invokeCompiler(`
ENEMY.enemy
ON: "reset"
DO: +(*.enemy)
`)
assert.equal(invalidAddTarget.ok, undefined)
assert.equal(invalidAddTarget.err[0].code, 'semantic-invalid-add-target')

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
