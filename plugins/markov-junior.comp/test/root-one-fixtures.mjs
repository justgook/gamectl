export const rootOneModels = [
  'Basic',
  'Growth',
  'MazeGrowth',
  'RegularSAW',
  'SelfAvoidingWalk',
  'IrregularMazeGrowth',
  'IrregularSAW',
  'StrangeGrowth',
]

export const rootAllModels = [
  'ParallelGrowth',
  'ParallelMazeGrowth',
  'PutLs',
  'NestedGrowth',
]

export const rootPrlModels = [
  'ForestFire',
]

export const rootMarkovModels = [
  'Backtracker',
  'MazeBacktracker',
  'RegularSAWRestart',
  'SAWRestart',
]

export function parseList(value) {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean)
}

export function parseArgs(argv, defaults = {}) {
  const options = {
    models: defaults.models ?? rootOneModels,
    runs: defaults.runs ?? 1,
    steps: defaults.steps ?? 10,
    seed: defaults.seed,
  }

  for (const arg of argv) {
    if (arg.startsWith('--model=')) options.models = [arg.slice('--model='.length)]
    else if (arg.startsWith('--models=')) options.models = parseList(arg.slice('--models='.length))
    else if (arg.startsWith('--runs=')) options.runs = Number(arg.slice('--runs='.length))
    else if (arg.startsWith('--steps=')) options.steps = Number(arg.slice('--steps='.length))
    else if (arg.startsWith('--seed=')) options.seed = Number(arg.slice('--seed='.length))
    else throw new Error(`unknown argument: ${arg}`)
  }

  if (!Number.isInteger(options.runs) || options.runs <= 0) throw new Error(`invalid --runs: ${options.runs}`)
  if (!Number.isInteger(options.steps) || options.steps < 0) throw new Error(`invalid --steps: ${options.steps}`)
  if (options.seed !== undefined && !Number.isInteger(options.seed)) throw new Error(`invalid --seed: ${options.seed}`)
  return options
}

export function configForModel(modelsXml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = modelsXml.match(new RegExp(`<model\\s+[^>]*name="${escaped}"[^>]*>`))
  if (!match) throw new Error(`${name}: not listed in models.xml; add explicit fixture metadata before fuzzing`)
  const tag = match[0]
  const size = Number(tag.match(/\bsize="(\d+)"/)?.[1])
  if (!Number.isInteger(size)) throw new Error(`${name}: models.xml entry missing size`)
  const depth = tag.match(/\bd="3"/) ? size : 1
  return { width: size, height: size, depth }
}
