import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileXmlToMjir, xmlRootTag } from '../compiler/xml-to-mjir.mjs'
import {
  configForModel,
  knownParityMismatchModels,
  noGenericOriginalOutputModels,
  rootAllModels,
  rootConvolutionModels,
  rootMarkovModels,
  rootOneModels,
  rootPrlModels,
  rootSequenceModels,
} from './root-one-fixtures.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const mjRoot = process.env.MARKOV_JUNIOR_REPO ?? resolve(repoRoot, '../MarkovJunior')
const modelsDir = join(mjRoot, 'models')
const modelsXml = readFileSync(join(mjRoot, 'models.xml'), 'utf8')
const requestedRoot = process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length)
const knownParityMismatchNames = new Set(knownParityMismatchModels)
const noGenericOriginalOutputNames = new Set(noGenericOriginalOutputModels)
const parityFixtureNames = new Set([
  ...rootOneModels,
  ...rootAllModels,
  ...rootPrlModels,
  ...rootConvolutionModels,
  ...rootMarkovModels,
  ...rootSequenceModels,
])

const parityFixtured = []
const knownParityMismatch = []
const noGenericOriginalOutput = []
const fixtureReadyUnlisted = []
const compilerSupportedNeedsConfig = []
const unsupported = []

for (const file of readdirSync(modelsDir).filter((entry) => entry.endsWith('.xml')).sort()) {
  const name = file.replace(/\.xml$/, '')
  const xml = readFileSync(join(modelsDir, file), 'utf8')
  const root = xmlRootTag(xml)
  if (requestedRoot && root !== requestedRoot) continue

  try {
    compileXmlToMjir(xml)
  } catch (error) {
    unsupported.push({ name, root, reason: error.message })
    continue
  }

  try {
    configForModel(modelsXml, name)
  } catch (error) {
    compilerSupportedNeedsConfig.push({ name, root, reason: error.message })
    continue
  }

  if (parityFixtureNames.has(name)) parityFixtured.push({ name, root })
  else if (knownParityMismatchNames.has(name)) knownParityMismatch.push({ name, root, reason: 'compiler-supported and fixture-configured, but byte-for-byte parity currently mismatches' })
  else if (noGenericOriginalOutputNames.has(name)) noGenericOriginalOutput.push({ name, root, reason: 'compiler-supported and has models.xml config, but original runner emits no output under the generic parity command' })
  else fixtureReadyUnlisted.push({ name, root, reason: 'compiler-supported and has models.xml config, but is not in a parity fixture list' })
}

const compilerSupported = parityFixtured.length + knownParityMismatch.length + noGenericOriginalOutput.length + fixtureReadyUnlisted.length + compilerSupportedNeedsConfig.length
const fixtureReady = parityFixtured.length + knownParityMismatch.length + noGenericOriginalOutput.length + fixtureReadyUnlisted.length
console.log(`compiler-supported=${compilerSupported} fixture-ready=${fixtureReady} parity-fixtured=${parityFixtured.length} known-mismatch=${knownParityMismatch.length} no-generic-original-output=${noGenericOriginalOutput.length} unlisted-fixture-ready=${fixtureReadyUnlisted.length} needs-config=${compilerSupportedNeedsConfig.length} unsupported=${unsupported.length}`)
for (const item of parityFixtured) console.log(`parity ${item.root} ${item.name}`)
for (const item of knownParityMismatch) console.log(`mismatch ${item.root} ${item.name}: ${item.reason}`)
for (const item of noGenericOriginalOutput) console.log(`no-output ${item.root} ${item.name}: ${item.reason}`)
for (const item of fixtureReadyUnlisted) console.log(`unlisted ${item.root} ${item.name}: ${item.reason}`)

if (process.argv.includes('--show-unsupported')) {
  for (const item of compilerSupportedNeedsConfig) console.log(`needs-config ${item.root || '?'} ${item.name}: ${item.reason}`)
  for (const item of unsupported) console.log(`unsupported ${item.root || '?'} ${item.name}: ${item.reason}`)
}
