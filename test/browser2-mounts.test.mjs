import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  createMountRegistry,
  listMountedPath,
  mountedPathExists,
  readMountedPath,
  statMountedPath,
} from '../cmd/browser2/builtin/mounts.js'

const config = JSON.parse(await readFile(new URL('../cmd/browser2/core/gams.json', import.meta.url), 'utf8'))
const registry = createMountRegistry(config.fs)

test('browser2 builtin mount lists root and child directories', () => {
  assert.deepEqual(listMountedPath(registry, '/'), ['builtin'])
  assert.ok(listMountedPath(registry, '/builtin').includes('assets'))
  assert.ok(listMountedPath(registry, '/builtin/assets/ng/nodegraph2').includes('array.lua'))
})

test('browser2 builtin mount supports exists with slash and non-slash paths', () => {
  assert.equal(mountedPathExists(registry, '/builtin'), true)
  assert.equal(mountedPathExists(registry, 'builtin'), true)
  assert.equal(mountedPathExists(registry, '/builtin/assets/ng/nodegraph2/array.lua'), true)
  assert.equal(mountedPathExists(registry, 'builtin/assets/ng/nodegraph2/array.lua'), true)
  assert.equal(mountedPathExists(registry, '/buildin/assets/ng/nodegraph2/array.lua'), null)
})

test('browser2 builtin mount stats files and directories', () => {
  assert.deepEqual(statMountedPath(registry, '/builtin'), { size: 0, type: 'directory' })
  assert.deepEqual(statMountedPath(registry, '/builtin/assets/ng/nodegraph2/array.lua'), { size: 0, type: 'file' })
})

test('browser2 builtin mount resolves reads through manifest urls', () => {
  const urls = []
  const result = readMountedPath(registry, '/builtin/assets/ng/nodegraph2/array.lua', (url) => {
    urls.push(url)
    return new TextEncoder().encode('ok')
  })

  assert.equal(new TextDecoder().decode(result), 'ok')
  assert.equal(urls.length, 1)
  assert.equal(new URL(urls[0]).pathname, '/assets/ng/nodegraph2/array.lua')
})
