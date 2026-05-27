import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileXmlToMjir, xmlRootTag } from '../compiler/xml-to-mjir.mjs'
import { configForModel } from './root-one-fixtures.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const mjRoot = process.env.MARKOV_JUNIOR_REPO ?? resolve(repoRoot, '../MarkovJunior')
const modelsDir = join(mjRoot, 'models')
const modelsXml = readFileSync(join(mjRoot, 'models.xml'), 'utf8')
const requestedRoot = process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length)

const supported = []
const unsupported = []

for (const file of readdirSync(modelsDir).filter((entry) => entry.endsWith('.xml')).sort()) {
  const name = file.replace(/\.xml$/, '')
  const xml = readFileSync(join(modelsDir, file), 'utf8')
  const root = xmlRootTag(xml)
  if (requestedRoot && root !== requestedRoot) continue

  try {
    configForModel(modelsXml, name)
    compileXmlToMjir(xml)
    supported.push({ name, root })
  } catch (error) {
    unsupported.push({ name, root, reason: error.message })
  }
}

console.log(`supported=${supported.length} unsupported=${unsupported.length}`)
for (const item of supported) console.log(`ok ${item.root} ${item.name}`)

if (process.argv.includes('--show-unsupported')) {
  for (const item of unsupported) console.log(`skip ${item.root || '?'} ${item.name}: ${item.reason}`)
}
