import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  createMountRegistry,
  listMountedPath,
  mountedPathExists,
  readMountedPath,
  statMountedPath,
} from '../cmd/browser/core/mounts.js'

const config = JSON.parse(await readFile(new URL('../gams.json', import.meta.url), 'utf8'))
const registry = createMountRegistry(config.fs)

test('browser demo mount lists root and preset directories', () => {
  assert.deepEqual(listMountedPath(registry, '/'), ['builtin', 'demo'])
  assert.ok(listMountedPath(registry, '/demo').includes('ng'))
  assert.ok(listMountedPath(registry, '/demo/ng/presets').includes('array.lua'))
})

test('browser demo mount supports exists with slash and non-slash paths', () => {
  assert.equal(mountedPathExists(registry, '/demo'), true)
  assert.equal(mountedPathExists(registry, 'demo'), true)
  assert.equal(mountedPathExists(registry, '/demo/ng/presets/array.lua'), true)
  assert.equal(mountedPathExists(registry, 'demo/ng/presets/array.lua'), true)
  assert.equal(mountedPathExists(registry, '/missing/demo/ng/presets/array.lua'), null)
})

test('browser demo mount stats files and directories', () => {
  assert.deepEqual(statMountedPath(registry, '/demo'), { size: 0, type: 'directory' })
  assert.deepEqual(statMountedPath(registry, '/demo/ng/presets/array.lua'), { size: 0, type: 'file' })
})

test('browser demo mount resolves reads through manifest urls', () => {
  const urls = []
  const result = readMountedPath(registry, '/demo/ng/presets/array.lua', (url) => {
    urls.push(url)
    return new TextEncoder().encode('ok')
  })

  assert.equal(new TextDecoder().decode(result), 'ok')
  assert.equal(urls.length, 1)
  assert.equal(new URL(urls[0]).pathname, '/demo/ng/presets/array.lua')
})
