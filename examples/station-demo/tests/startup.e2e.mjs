import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const repoRoot = resolve(projectRoot, '../..')
const config = JSON.parse(readFileSync(join(projectRoot, 'gams.json'), 'utf8'))

assert.ok(Array.isArray(config.plugins), 'gams.json plugins must be an array')
assert.ok(config.plugins.length > 0, 'gams.json must register at least one plugin')

const pluginPaths = config.plugins.map((path) => isAbsolute(path) ? path : resolve(projectRoot, path))
const pluginArgs = pluginPaths.flatMap((path) => ['--plug', path])
const request = {
  w: 1280,
  h: 720,
  config: {
    'max-areas': 16,
    'max-handles': 15,
    'min-panel-size': 120,
    'handle-half-size': 6,
  },
  'root-content-id': '46',
}

const result = spawnSync('cargo', [
  'run', '--quiet', '--manifest-path', 'cmd/app/src-tauri/Cargo.toml', '--',
  'run', ...pluginArgs,
  'layout/layout::init-screen', JSON.stringify([request]),
], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: {
    ...process.env,
    GAMS_APP_CWD: projectRoot,
    GAMS_WASMTIME_CACHE_DIR: join(repoRoot, 'build.nosync/wasmtime-cache-e2e/station-demo-startup'),
    CARGO_TARGET_DIR: join(repoRoot, 'build.nosync/app/target'),
  },
})

assert.equal(
  result.status,
  0,
  `station-demo startup plugins could not invoke layout/layout::init-screen\nconfigured plugins: ${config.plugins.join(', ')}\n${result.stderr}\n${result.stdout}`,
)

const response = JSON.parse(result.stdout)
assert.equal(response.err, undefined, 'layout init-screen returned an error result')
assert.equal(response.ok.document['screen-w'], request.w)
assert.equal(response.ok.document['screen-h'], request.h)
assert.equal(response.ok.document.areas[0]['content-id'], request['root-content-id'])

console.log('station-demo configured plugins -> layout init-screen e2e ok')
