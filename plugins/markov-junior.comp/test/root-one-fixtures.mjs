export const rootOneModels = [
  'Basic',
  'BlueNoise',
  'CentralSAW',
  'Growth',
  'GrowthContraction',
  'GrowthWalk',
  'IrregularMazeGrowth',
  'IrregularSAW',
  'Laplace',
  'LoopErasedWalk',
  'MazeGrowth',
  'MazeTrail',
  'RainbowGrowth',
  'RandomWalk',
  'RegularSAW',
  'SelfAvoidingWalk',
  'StrangeGrowth',
  'Trail',
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

export const rootConvolutionModels = [
  'Counting',
  'ForestFireCA',
]

export const rootConvChainModels = [
  'ChainDungeon',
  'ChainDungeonMaze',
  'ChainMaze',
]

export const rootWfcModels = [
  'Sewers',
  'WaveBrickWall',
  'WaveDungeon',
  'WaveFlowers',
]

export const explicitModelConfigs = {
  BasicKeys: { size: 33 },
  BasicSkyline: { size: 30 },
  Crawlers: { size: 60 },
  DwarfPath: { size: 20 },
  GoTo: { size: 60 },
  GoToGradient: { size: 60 },
  Lightning: { size: 60 },
  LoopErasedWalk: { size: 59 },
  ParallelWalk: { size: 60 },
  RandomWalk: { size: 59 },
  Rectangle: { size: 30 },
  SequentialSnake: { size: 23, steps: 100 },
  Snake: { size: 23 },
  StableCrawlers: { size: 60 },
}

export const knownParityMismatchModels = []

export const noGenericOriginalOutputModels = [
  'BasicSnake',
  'Chase',
  'Wilson',
]

export const rootMarkovModels = [
  'Backtracker',
  'Digger',
  'GoTo',
  'GoToGradient',
  'KnightPatrol',
  'MazeBacktracker',
  'NoDeadEnds',
  'PutColoredLs',
  'RegularSAWRestart',
  'SAWRestart',
  'SmarterDigger',
]

export const rootSequenceModels = [
  'BacktrackerCycle',
  'BasicBrickWall',
  'BasicKeys',
  'BasicSkyline',
  'BasicDijkstraDungeon',
  'BasicDijkstraFill',
  'BasicDungeonGrowth',
  'BernoulliPercolation',
  'BasicPartitioning',
  'BishopParity',
  'BiasedGrowth',
  'BiasedGrowthContraction',
  'BiasedMazeGrowth',
  'BiasedVoronoi',
  'CarmaTower',
  'Cave',
  'CaveContour',
  'CentralCrawlers',
  'Circuit',
  'ConnectedCaves',
  'ConstrainedCaves',
  'Coupling',
  'Crawlers',
  'CrawlersChase',
  'CrossCountry',
  'Cycles',
  'DenseSAW',
  'DiagonalPath',
  'Division',
  'DijkstraDungeon',
  'DualRetraction',
  'DualRetraction3D',
  'DwarfPath',
  'DungeonGrowth',
  'Dwarves',
  'EuclideanPath',
  'FindLongCycle',
  'FireNoise',
  'Flowers',
  'Forest',
  'GameOfLife',
  'GrowthCompetition',
  'GrowTo',
  'HamiltonianPath',
  'HamiltonianPaths',
  'Hills',
  'Island',
  'Keys',
  'Lightning',
  'LoopGrowth',
  'LostCity',
  'MarchingSquares',
  'MazeMap',
  'MultiHeadedDungeon',
  'MultiHeadedWalk',
  'MultiHeadedWalkDungeon',
  'Noise',
  'NystromDungeon',
  'OpenCave',
  'OddScale',
  'OddScale3D',
  'OpenCave3D',
  'OrganicMechanic',
  'PaintCompetition',
  'ParallelWalk',
  'Percolation',
  'Push',
  'Rectangle',
  'RegularPath',
  'River',
  'Rosettes',
  'SelectLargeCaves',
  'SequentialSnake',
  'SmartSAW',
  'SmoothTrail',
  'Snake',
  'SnellLaw',
  'SoftPath',
  'StableCrawlers',
  'StairsPath',
  'StochasticVoronoi',
  'StrangeDungeon',
  'StrangeNoise',
  'StormySnellLaw',
  'Tetris',
  'Texture',
  'Voronoi',
  'WolfBasedApproach',
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
    skipMissingOriginal: defaults.skipMissingOriginal ?? false,
  }

  for (const arg of argv) {
    if (arg.startsWith('--model=')) options.models = [arg.slice('--model='.length)]
    else if (arg.startsWith('--models=')) options.models = parseList(arg.slice('--models='.length))
    else if (arg.startsWith('--runs=')) options.runs = Number(arg.slice('--runs='.length))
    else if (arg.startsWith('--steps=')) options.steps = Number(arg.slice('--steps='.length))
    else if (arg.startsWith('--seed=')) options.seed = Number(arg.slice('--seed='.length))
    else if (arg === '--skip-missing-original') options.skipMissingOriginal = true
    else throw new Error(`unknown argument: ${arg}`)
  }

  if (!Number.isInteger(options.runs) || options.runs <= 0) throw new Error(`invalid --runs: ${options.runs}`)
  if (!Number.isInteger(options.steps) || options.steps < 0) throw new Error(`invalid --steps: ${options.steps}`)
  if (options.seed !== undefined && !Number.isInteger(options.seed)) throw new Error(`invalid --seed: ${options.seed}`)
  return options
}

export function modelConfigTag(name) {
  const config = explicitModelConfigs[name]
  if (!config) return undefined
  const attrs = [`name="${name}"`]
  if (config.size !== undefined) attrs.push(`size="${config.size}"`)
  if (config.length !== undefined) attrs.push(`length="${config.length}"`)
  if (config.width !== undefined) attrs.push(`width="${config.width}"`)
  if (config.height !== undefined) attrs.push(`height="${config.height}"`)
  if (config.depth === 3 || config.d === 3) attrs.push('d="3"')
  if (config.steps !== undefined) attrs.push(`steps="${config.steps}"`)
  return `<model ${attrs.join(' ')}/>`
}

export function configForModel(modelsXml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = modelsXml.match(new RegExp(`<model\\s+[^>]*name="${escaped}"[^>]*>`))
  const tag = match?.[0] ?? modelConfigTag(name)
  if (!tag) throw new Error(`${name}: not listed in models.xml; add explicit fixture metadata before fuzzing`)
  const size = Number(tag.match(/\bsize="(\d+)"/)?.[1])
  const width = Number(tag.match(/\bwidth="(\d+)"/)?.[1] ?? size)
  const height = Number(tag.match(/\bheight="(\d+)"/)?.[1] ?? (tag.match(/\bd="3"/) ? size : 1))
  if (!Number.isInteger(size) && (!Number.isInteger(width) || !Number.isInteger(height))) throw new Error(`${name}: models.xml entry missing size`)
  const depth = tag.match(/\bheight="(\d+)"/) ? height : (tag.match(/\bd="3"/) ? height : 1)
  return { width: Number(tag.match(/\blength="(\d+)"/)?.[1] ?? width), height: Number(tag.match(/\bwidth="(\d+)"/)?.[1] ?? size), depth }
}
