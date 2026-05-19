import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const lua = join(repoRoot, 'build.nosync/plugins/lua.comp.wasm');

function runLua(source) {
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
  const output = JSON.parse(result.stdout);
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

const topLevelNil = runLua(`
function main()
  return json.encode(nil)
end
`);
assert.equal(topLevelNil, 'null');

console.log('lua.comp json.null: ok');
