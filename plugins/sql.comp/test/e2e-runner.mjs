import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginDir = resolve(here, '..');
const repoRoot = resolve(here, '../../..');
const provider = process.env.GAMS_SQL_PROVIDER ?? join(repoRoot, 'build.nosync/plugins/sql.comp.wasm');
const lua = join(repoRoot, 'build.nosync/plugins/lua.comp.wasm');
const scriptsDir = process.env.GAMS_SQL_E2E_DIR ?? join(here, 'e2e');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
    env: {
      ...process.env,
      ...options.env,
    },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result.stdout;
}

run('make', [lua, provider]);

const scripts = readdirSync(scriptsDir)
  .filter((name) => name.endsWith('.lua'))
  .sort();

if (scripts.length === 0) {
  throw new Error(`no e2e lua scripts found in ${scriptsDir}`);
}

for (const script of scripts) {
  const path = join(scriptsDir, script);
  const source = readFileSync(path, 'utf8');
  const argsJson = JSON.stringify([source]);
  const stdout = run('cargo', [
    'run',
    '--quiet',
    '--manifest-path',
    'cmd/app/src-tauri/Cargo.toml',
    '--',
    'run',
    '--plug',
    provider,
    '--plug',
    lua,
    'lua/lua::run',
    argsJson,
  ], {
    env: {
      GAMS_APP_CWD: join(repoRoot, 'examples/demo'),
      GAMS_WASMTIME_CACHE_DIR: join(repoRoot, 'build.nosync/wasmtime-cache-e2e', pluginDir.split('/').pop()),
      CARGO_TARGET_DIR: join(repoRoot, 'build.nosync/app/target'),
    },
  });
  const result = JSON.parse(stdout);
  if (result.err !== undefined) {
    throw new Error(`${script} failed: ${result.err}`);
  }
  console.log(`${script}: ${result.ok}`);
}
