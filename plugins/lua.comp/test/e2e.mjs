import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const lua = join(repoRoot, 'build.nosync/plugins/lua.comp.wasm');

function runLuaRaw(source) {
  const result = spawnSync('cargo', [
    'run',
    '--quiet',
    '--manifest-path',
    'cmd/app/src-tauri/Cargo.toml',
    '--',
    'run',
    '--plug',
    lua,
    'lua/lua::run',
    JSON.stringify([source]),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GAMS_APP_CWD: join(repoRoot, 'examples/demo'),
      GAMS_WASMTIME_CACHE_DIR: join(repoRoot, 'build.nosync/wasmtime-cache-e2e/lua.comp'),
      CARGO_TARGET_DIR: join(repoRoot, 'build.nosync/app/target'),
    },
  });

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  return JSON.parse(result.stdout);
}

function runLua(source) {
  const output = runLuaRaw(source);
  assert.equal(output.err, undefined, output.err);
  return output.ok;
}

const encodedObject = runLua(`
function main()
  return json.encode({ a = json.null, b = 1 })
end
`);
const parsedObject = JSON.parse(encodedObject);
assert.deepEqual(parsedObject, { a: null, b: 1 });

const absentNilField = runLua(`
function main()
  return json.encode({ a = nil, b = 1 })
end
`);
assert.deepEqual(JSON.parse(absentNilField), { b: 1 });

const missingRead = runLuaRaw(`
function main()
  return fs.read_text('missing.lua')
end
`);
assert.match(missingRead.err, /fs\.read_text failed for 'missing\.lua': file not found or not readable/);

const topLevelNil = runLua(`
function main()
  return json.encode(nil)
end
`);
assert.equal(topLevelNil, 'null');

const manyValueGraph = [];
const manyGoalInputs = [];
for (let id = 1; id <= 101; id += 1) {
  manyValueGraph.push({
    id,
    kind: 4,
    name: `v${id}`,
    inputs: [],
    outputs: [{ id: 1, name: `v${id}`, value: String(id) }],
  });
  manyGoalInputs.push({ id, name: `v${id}`, srcNodeId: id, srcOutputId: 1 });
}
manyValueGraph.push({ id: 102, kind: 1, name: 'result', inputs: manyGoalInputs, outputs: [] });

const compiler = readFileSync(join(repoRoot, 'examples/demo/ng/compile-graph.lua'), 'utf8');
const generatedGraphSource = runLua(`
_G.input = ${JSON.stringify(JSON.stringify(manyValueGraph))}
${compiler}
`);
const graphResult = JSON.parse(runLua(generatedGraphSource));
assert.equal(graphResult.result.inputs.v101, 101);
assert.equal(graphResult.result.active.v101, true);

console.log('lua.comp json.null: ok');
console.log('lua.comp view-ng large value graph: ok');
