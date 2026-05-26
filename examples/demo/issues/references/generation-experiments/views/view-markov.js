import { runtime, unwrap } from "/core/runtime.js"
import { ViewCanvasBase } from "/util/view-canvas-base.js"

const PALETTE = {
  B: "#000000",
  I: "#1D2B53",
  P: "#7E2553",
  E: "#008751",
  N: "#AB5236",
  D: "#5F574F",
  A: "#C2C3C7",
  W: "#FFF1E8",
  R: "#FF004D",
  O: "#FFA300",
  Y: "#FFEC27",
  G: "#00E436",
  U: "#29ADFF",
  S: "#83769C",
  K: "#FF77A8",
  F: "#FFCCAA",
  b: "#291814",
  i: "#111d35",
  p: "#422136",
  e: "#125359",
  n: "#742f29",
  d: "#49333b",
  a: "#a28879",
  w: "#f3ef7d",
  r: "#be1250",
  o: "#ff6c24",
  y: "#a8e72e",
  g: "#00b543",
  u: "#065ab5",
  s: "#754665",
  k: "#ff6e59",
  f: "#ff9d81",
  C: "#00ffff",
  c: "#5fcde4",
  H: "#e4bb40",
  h: "#8a6f30",
  J: "#4b692f",
  j: "#45107e",
  L: "#847e87",
  l: "#696a6a",
  M: "#ff00ff",
  m: "#9c09cc",
  Q: "#9badb7",
  q: "#3f3f74",
  T: "#37946e",
  t: "#323c39",
  V: "#8f974a",
  v: "#524b24",
  X: "#ff0000",
  x: "#d95763",
  Z: "#ffffff",
  z: "#cbdbfc",
}

const EXAMPLES = [
  {
    id: "Basic",
    name: "Basic",
    category: "Basic",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 1000,
  },
  {
    id: "Backtracker",
    name: "Backtracker",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 89,
    height: 89,
    depth: 1,
    steps: 0,
  },
  {
    id: "BacktrackerCycle",
    name: "BacktrackerCycle",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 0,
  },
  {
    id: "BasicPartitioning",
    name: "BasicPartitioning",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 1000,
  },
  {
    id: "BiasedMazeGrowth",
    name: "BiasedMazeGrowth",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 117,
    height: 117,
    depth: 1,
    steps: 400,
  },
  {
    id: "ChainMaze",
    name: "ChainMaze",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "Division",
    name: "Division",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 75,
    height: 75,
    depth: 1,
    steps: 0,
  },
  {
    id: "IrregularMazeGrowth",
    name: "IrregularMazeGrowth",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 79,
    height: 79,
    depth: 1,
    steps: 0,
  },
  {
    id: "MazeBacktracker",
    name: "MazeBacktracker",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 359,
    height: 359,
    depth: 1,
    steps: 20000,
  },
  {
    id: "MazeBacktracker#2",
    name: "MazeBacktracker",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 967,
    height: 967,
    depth: 1,
    steps: 200000,
  },
  {
    id: "MazeGrowth",
    name: "MazeGrowth",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 359,
    height: 359,
    depth: 1,
    steps: 0,
  },
  {
    id: "MazeMap",
    name: "MazeMap",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 30,
    height: 30,
    depth: 1,
    steps: 0,
  },
  {
    id: "MazeTrail",
    name: "MazeTrail",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 1000,
  },
  {
    id: "NoDeadEnds",
    name: "NoDeadEnds",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 39,
    height: 39,
    depth: 1,
    steps: 0,
  },
  {
    id: "ParallelMazeGrowth",
    name: "ParallelMazeGrowth",
    category: "Mazes & Partitions",
    requires: "2d",
    width: 179,
    height: 179,
    depth: 1,
    steps: 0,
  },
  {
    id: "BasicDijkstraDungeon",
    name: "BasicDijkstraDungeon",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "BasicDungeonGrowth",
    name: "BasicDungeonGrowth",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 0,
  },
  {
    id: "BasicKeys",
    name: "BasicKeys",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "Cave",
    name: "Cave",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "CaveContour",
    name: "CaveContour",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 0,
  },
  {
    id: "ChainDungeon",
    name: "ChainDungeon",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "ChainDungeonMaze",
    name: "ChainDungeonMaze",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "ConnectedCaves",
    name: "ConnectedCaves",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "ConstrainedCaves",
    name: "ConstrainedCaves",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "DijkstraDungeon",
    name: "DijkstraDungeon",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 40,
    height: 40,
    depth: 1,
    steps: 0,
  },
  {
    id: "DungeonGrowth",
    name: "DungeonGrowth",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 79,
    height: 79,
    depth: 1,
    steps: 0,
  },
  {
    id: "Keys",
    name: "Keys",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 33,
    height: 33,
    depth: 1,
    steps: 0,
  },
  {
    id: "MultiHeadedDungeon",
    name: "MultiHeadedDungeon",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 55,
    height: 55,
    depth: 1,
    steps: 0,
  },
  {
    id: "MultiHeadedWalkDungeon",
    name: "MultiHeadedWalkDungeon",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 0,
  },
  {
    id: "NystromDungeon",
    name: "NystromDungeon",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 39,
    height: 39,
    depth: 1,
    steps: 0,
  },
  {
    id: "OpenCave",
    name: "OpenCave",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 0,
  },
  {
    id: "SelectLargeCaves",
    name: "SelectLargeCaves",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "Sewers",
    name: "Sewers",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 40,
    height: 40,
    depth: 1,
    steps: 0,
  },
  {
    id: "StrangeDungeon",
    name: "StrangeDungeon",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 0,
  },
  {
    id: "TileDungeon",
    name: "TileDungeon",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 12,
    height: 12,
    depth: 1,
    steps: 0,
  },
  {
    id: "WaveDungeon",
    name: "WaveDungeon",
    category: "Dungeons & Caves",
    requires: "2d",
    width: 50,
    height: 50,
    depth: 1,
    steps: 0,
  },
  {
    id: "BasicDijkstraFill",
    name: "BasicDijkstraFill",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "BasicSnake",
    name: "BasicSnake",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "BishopParity",
    name: "BishopParity",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "CentralSAW",
    name: "CentralSAW",
    category: "Paths & Walks",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 0,
  },
  {
    id: "CompleteSAW",
    name: "CompleteSAW",
    category: "Paths & Walks",
    requires: "2d",
    width: 19,
    height: 19,
    depth: 1,
    steps: 0,
  },
  {
    id: "CompleteSAWSmart",
    name: "CompleteSAWSmart",
    category: "Paths & Walks",
    requires: "2d",
    width: 23,
    height: 23,
    depth: 1,
    steps: 0,
  },
  {
    id: "Cycles",
    name: "Cycles",
    category: "Paths & Walks",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 0,
  },
  {
    id: "DenseSAW",
    name: "DenseSAW",
    category: "Paths & Walks",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 0,
  },
  {
    id: "DiagonalPath",
    name: "DiagonalPath",
    category: "Paths & Walks",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 0,
  },
  {
    id: "DwarfPath",
    name: "DwarfPath",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "EuclideanPath",
    name: "EuclideanPath",
    category: "Paths & Walks",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 0,
  },
  {
    id: "FindLongCycle",
    name: "FindLongCycle",
    category: "Paths & Walks",
    requires: "2d",
    width: 27,
    height: 27,
    depth: 1,
    steps: 0,
  },
  {
    id: "GoTo",
    name: "GoTo",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "GoToGradient",
    name: "GoToGradient",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "GrowthWalk",
    name: "GrowthWalk",
    category: "Paths & Walks",
    requires: "2d",
    width: 79,
    height: 79,
    depth: 1,
    steps: 5000,
  },
  {
    id: "HamiltonianPath",
    name: "HamiltonianPath",
    category: "Paths & Walks",
    requires: "2d",
    width: 39,
    height: 39,
    depth: 1,
    steps: 150000,
  },
  {
    id: "HamiltonianPaths",
    name: "HamiltonianPaths",
    category: "Paths & Walks",
    requires: "2d",
    width: 39,
    height: 39,
    depth: 1,
    steps: 1000,
  },
  {
    id: "IrregularSAW",
    name: "IrregularSAW",
    category: "Paths & Walks",
    requires: "2d",
    width: 79,
    height: 79,
    depth: 1,
    steps: 0,
  },
  {
    id: "KnightPatrol",
    name: "KnightPatrol",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 200,
  },
  {
    id: "LoopErasedWalk",
    name: "LoopErasedWalk",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "MultiHeadedWalk",
    name: "MultiHeadedWalk",
    category: "Paths & Walks",
    requires: "2d",
    width: 99,
    height: 99,
    depth: 1,
    steps: 0,
  },
  {
    id: "ParallelWalk",
    name: "ParallelWalk",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "RandomWalk",
    name: "RandomWalk",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "RegularPath",
    name: "RegularPath",
    category: "Paths & Walks",
    requires: "2d",
    width: 79,
    height: 79,
    depth: 1,
    steps: 0,
  },
  {
    id: "RegularSAW",
    name: "RegularSAW",
    category: "Paths & Walks",
    requires: "2d",
    width: 39,
    height: 39,
    depth: 1,
    steps: 0,
  },
  {
    id: "RegularSAWRestart",
    name: "RegularSAWRestart",
    category: "Paths & Walks",
    requires: "2d",
    width: 39,
    height: 39,
    depth: 1,
    steps: 0,
  },
  {
    id: "SAWRestart",
    name: "SAWRestart",
    category: "Paths & Walks",
    requires: "2d",
    width: 79,
    height: 79,
    depth: 1,
    steps: 2000,
  },
  {
    id: "SelfAvoidingWalk",
    name: "SelfAvoidingWalk",
    category: "Paths & Walks",
    requires: "2d",
    width: 39,
    height: 39,
    depth: 1,
    steps: 0,
  },
  {
    id: "SequentialSnake",
    name: "SequentialSnake",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "SmartSAW",
    name: "SmartSAW",
    category: "Paths & Walks",
    requires: "2d",
    width: 19,
    height: 19,
    depth: 1,
    steps: 0,
  },
  {
    id: "SmoothTrail",
    name: "SmoothTrail",
    category: "Paths & Walks",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 0,
  },
  {
    id: "Snake",
    name: "Snake",
    category: "Paths & Walks",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "SoftPath",
    name: "SoftPath",
    category: "Paths & Walks",
    requires: "2d",
    width: 180,
    height: 180,
    depth: 1,
    steps: 0,
  },
  {
    id: "TilePath",
    name: "TilePath",
    category: "Paths & Walks",
    requires: "2d",
    width: 20,
    height: 20,
    depth: 1,
    steps: 0,
  },
  {
    id: "Trail",
    name: "Trail",
    category: "Paths & Walks",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 3000,
  },
  {
    id: "BernoulliPercolation",
    name: "BernoulliPercolation",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 359,
    height: 359,
    depth: 1,
    steps: 0,
  },
  {
    id: "BiasedGrowth",
    name: "BiasedGrowth",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 120,
    height: 120,
    depth: 1,
    steps: 1000,
  },
  {
    id: "BiasedGrowthContraction",
    name: "BiasedGrowthContraction",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 120,
    height: 120,
    depth: 1,
    steps: 5000,
  },
  {
    id: "BiasedVoronoi",
    name: "BiasedVoronoi",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 1000,
  },
  {
    id: "BlueNoise",
    name: "BlueNoise",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 500,
  },
  {
    id: "CentralCrawlers",
    name: "CentralCrawlers",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 300,
  },
  {
    id: "Crawlers",
    name: "Crawlers",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "CrawlersChase",
    name: "CrawlersChase",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 200,
  },
  {
    id: "FireNoise",
    name: "FireNoise",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 300,
    height: 300,
    depth: 1,
    steps: 0,
  },
  {
    id: "Forest",
    name: "Forest",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 240,
    height: 240,
    depth: 1,
    steps: 0,
  },
  {
    id: "ForestFire",
    name: "ForestFire",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 600,
    height: 600,
    depth: 1,
    steps: 80,
  },
  {
    id: "ForestFireCA",
    name: "ForestFireCA",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 600,
    height: 600,
    depth: 1,
    steps: 80,
  },
  {
    id: "GameOfLife",
    name: "GameOfLife",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 120,
    height: 120,
    depth: 1,
    steps: 100,
  },
  {
    id: "Growth",
    name: "Growth",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 359,
    height: 359,
    depth: 1,
    steps: 40000,
  },
  {
    id: "GrowthCompetition",
    name: "GrowthCompetition",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 30000,
  },
  {
    id: "GrowthContraction",
    name: "GrowthContraction",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 79,
    height: 79,
    depth: 1,
    steps: 10000,
  },
  {
    id: "Island",
    name: "Island",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 800,
    height: 800,
    depth: 1,
    steps: -1,
  },
  {
    id: "Laplace",
    name: "Laplace",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 1000,
  },
  {
    id: "LoopGrowth",
    name: "LoopGrowth",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 37,
    height: 37,
    depth: 1,
    steps: 0,
  },
  {
    id: "NestedGrowth",
    name: "NestedGrowth",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 100,
  },
  {
    id: "Noise",
    name: "Noise",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 0,
  },
  {
    id: "Percolation",
    name: "Percolation",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 360,
    height: 360,
    depth: 1,
    steps: 0,
  },
  {
    id: "RainbowGrowth",
    name: "RainbowGrowth",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 1600,
  },
  {
    id: "River",
    name: "River",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 0,
  },
  {
    id: "StableCrawlers",
    name: "StableCrawlers",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "StochasticVoronoi",
    name: "StochasticVoronoi",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 200,
    height: 200,
    depth: 1,
    steps: 0,
  },
  {
    id: "StrangeGrowth",
    name: "StrangeGrowth",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 700,
  },
  {
    id: "StrangeNoise",
    name: "StrangeNoise",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 500,
  },
  {
    id: "Voronoi",
    name: "Voronoi",
    category: "Growth, CA & Noise",
    requires: "2d",
    width: 240,
    height: 240,
    depth: 1,
    steps: 0,
  },
  {
    id: "BasicBrickWall",
    name: "BasicBrickWall",
    category: "WFC, Tiles & Textures",
    requires: "2d",
    width: 30,
    height: 30,
    depth: 1,
    steps: 0,
  },
  {
    id: "BasicSkyline",
    name: "BasicSkyline",
    category: "WFC, Tiles & Textures",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "Flowers",
    name: "Flowers",
    category: "WFC, Tiles & Textures",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "Knots2D",
    name: "Knots2D",
    category: "WFC, Tiles & Textures",
    requires: "2d",
    width: 12,
    height: 12,
    depth: 1,
    steps: 0,
  },
  {
    id: "LostCity",
    name: "LostCity",
    category: "WFC, Tiles & Textures",
    requires: "2d",
    width: 256,
    height: 256,
    depth: 1,
    steps: 0,
  },
  {
    id: "Rosettes",
    name: "Rosettes",
    category: "WFC, Tiles & Textures",
    requires: "2d",
    width: 75,
    height: 75,
    depth: 1,
    steps: 0,
  },
  {
    id: "Texture",
    name: "Texture",
    category: "WFC, Tiles & Textures",
    requires: "2d",
    width: 240,
    height: 240,
    depth: 1,
    steps: 0,
  },
  {
    id: "WaveBrickWall",
    name: "WaveBrickWall",
    category: "WFC, Tiles & Textures",
    requires: "2d",
    width: 50,
    height: 50,
    depth: 1,
    steps: 0,
  },
  {
    id: "WaveFlowers",
    name: "WaveFlowers",
    category: "WFC, Tiles & Textures",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "Chase",
    name: "Chase",
    category: "Games & Puzzles",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "MultiSokoban8",
    name: "MultiSokoban8",
    category: "Games & Puzzles",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "MultiSokoban9",
    name: "MultiSokoban9",
    category: "Games & Puzzles",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "Push",
    name: "Push",
    category: "Games & Puzzles",
    requires: "2d",
    width: 40,
    height: 40,
    depth: 1,
    steps: 8000,
  },
  {
    id: "SequentialSokoban",
    name: "SequentialSokoban",
    category: "Games & Puzzles",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "SokobanLevel1",
    name: "SokobanLevel1",
    category: "Games & Puzzles",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "SokobanLevel2",
    name: "SokobanLevel2",
    category: "Games & Puzzles",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "Tetris",
    name: "Tetris",
    category: "Games & Puzzles",
    requires: "2d",
    width: 30,
    height: 30,
    depth: 1,
    steps: 1500,
  },
  {
    id: "Circuit",
    name: "Circuit",
    category: "Other",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 1200,
  },
  {
    id: "Coupling",
    name: "Coupling",
    category: "Other",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 0,
  },
  {
    id: "CrossCountry",
    name: "CrossCountry",
    category: "Other",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 0,
  },
  {
    id: "Digger",
    name: "Digger",
    category: "Other",
    requires: "2d",
    width: 359,
    height: 359,
    depth: 1,
    steps: 50000,
  },
  {
    id: "DualRetraction",
    name: "DualRetraction",
    category: "Other",
    requires: "2d",
    width: 59,
    height: 59,
    depth: 1,
    steps: 0,
  },
  {
    id: "Dwarves",
    name: "Dwarves",
    category: "Other",
    requires: "2d",
    width: 20,
    height: 20,
    depth: 1,
    steps: 85,
  },
  {
    id: "GrowTo",
    name: "GrowTo",
    category: "Other",
    requires: "2d",
    width: 120,
    height: 120,
    depth: 1,
    steps: 2000,
  },
  {
    id: "Lightning",
    name: "Lightning",
    category: "Other",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "MarchingSquares",
    name: "MarchingSquares",
    category: "Other",
    requires: "2d",
    width: 20,
    height: 20,
    depth: 1,
    steps: 0,
  },
  {
    id: "OddScale",
    name: "OddScale",
    category: "Other",
    requires: "2d",
    width: 8,
    height: 8,
    depth: 1,
    steps: 0,
  },
  {
    id: "OrganicMechanic",
    name: "OrganicMechanic",
    category: "Other",
    requires: "2d",
    width: 30,
    height: 30,
    depth: 1,
    steps: 200,
  },
  {
    id: "PaintCompetition",
    name: "PaintCompetition",
    category: "Other",
    requires: "2d",
    width: 48,
    height: 48,
    depth: 1,
    steps: 400,
  },
  {
    id: "PutColoredLs",
    name: "PutColoredLs",
    category: "Other",
    requires: "2d",
    width: 30,
    height: 30,
    depth: 1,
    steps: 0,
  },
  {
    id: "PutLs",
    name: "PutLs",
    category: "Other",
    requires: "2d",
    width: 50,
    height: 50,
    depth: 1,
    steps: 0,
  },
  {
    id: "Rectangle",
    name: "Rectangle",
    category: "Other",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "SmarterDigger",
    name: "SmarterDigger",
    category: "Other",
    requires: "2d",
    width: 40,
    height: 40,
    depth: 1,
    steps: 800,
  },
  {
    id: "SnellLaw",
    name: "SnellLaw",
    category: "Other",
    requires: "2d",
    width: 80,
    height: 80,
    depth: 1,
    steps: 0,
  },
  {
    id: "StormySnellLaw",
    name: "StormySnellLaw",
    category: "Other",
    requires: "2d",
    width: 120,
    height: 120,
    depth: 1,
    steps: 0,
  },
  {
    id: "Wilson",
    name: "Wilson",
    category: "Other",
    requires: "2d",
    width: 60,
    height: 60,
    depth: 1,
    steps: 0,
  },
  {
    id: "WolfBasedApproach",
    name: "WolfBasedApproach",
    category: "Other",
    requires: "2d",
    width: 70,
    height: 70,
    depth: 1,
    steps: 300,
  },
  {
    id: "Apartemazements",
    name: "Apartemazements",
    category: "VOX / 3D",
    requires: "vox",
    width: 8,
    height: 8,
    depth: 8,
    steps: 0,
  },
  {
    id: "Apartemazements#2",
    name: "Apartemazements",
    category: "VOX / 3D",
    requires: "vox",
    width: 8,
    height: 8,
    depth: 8,
    steps: 0,
  },
  {
    id: "CarmaTower",
    name: "CarmaTower",
    category: "VOX / 3D",
    requires: "vox",
    width: 12,
    height: 12,
    depth: 18,
    steps: 0,
  },
  {
    id: "CarmaTower#2",
    name: "CarmaTower",
    category: "VOX / 3D",
    requires: "vox",
    width: 12,
    height: 12,
    depth: 18,
    steps: 0,
  },
  {
    id: "ClosedSurface",
    name: "ClosedSurface",
    category: "VOX / 3D",
    requires: "vox",
    width: 12,
    height: 12,
    depth: 12,
    steps: 0,
  },
  {
    id: "ColoredKnots",
    name: "ColoredKnots",
    category: "VOX / 3D",
    requires: "vox",
    width: 12,
    height: 12,
    depth: 12,
    steps: 0,
  },
  {
    id: "Counting",
    name: "Counting",
    category: "VOX / 3D",
    requires: "vox",
    width: 8,
    height: 8,
    depth: 8,
    steps: 0,
  },
  {
    id: "DualRetraction3D",
    name: "DualRetraction3D",
    category: "VOX / 3D",
    requires: "vox",
    width: 27,
    height: 27,
    depth: 27,
    steps: 0,
  },
  {
    id: "Escher",
    name: "Escher",
    category: "VOX / 3D",
    requires: "vox",
    width: 8,
    height: 8,
    depth: 8,
    steps: 0,
  },
  {
    id: "EscherSurface",
    name: "EscherSurface",
    category: "VOX / 3D",
    requires: "vox",
    width: 8,
    height: 8,
    depth: 8,
    steps: 0,
  },
  {
    id: "Growth#2",
    name: "Growth",
    category: "VOX / 3D",
    requires: "vox",
    width: 29,
    height: 29,
    depth: 29,
    steps: 3000,
  },
  {
    id: "Hills",
    name: "Hills",
    category: "VOX / 3D",
    requires: "vox",
    width: 40,
    height: 40,
    depth: 12,
    steps: 0,
  },
  {
    id: "Keys#2",
    name: "Keys",
    category: "VOX / 3D",
    requires: "vox",
    width: 23,
    height: 23,
    depth: 23,
    steps: 0,
  },
  {
    id: "Knots3D",
    name: "Knots3D",
    category: "VOX / 3D",
    requires: "vox",
    width: 8,
    height: 8,
    depth: 8,
    steps: 0,
  },
  {
    id: "MazeGrowth#2",
    name: "MazeGrowth",
    category: "VOX / 3D",
    requires: "vox",
    width: 27,
    height: 27,
    depth: 27,
    steps: 0,
  },
  {
    id: "MazeTrail#2",
    name: "MazeTrail",
    category: "VOX / 3D",
    requires: "vox",
    width: 27,
    height: 27,
    depth: 27,
    steps: 1000,
  },
  {
    id: "ModernHouse",
    name: "ModernHouse",
    category: "VOX / 3D",
    requires: "vox",
    width: 9,
    height: 9,
    depth: 4,
    steps: 0,
  },
  {
    id: "ModernHouse#2",
    name: "ModernHouse",
    category: "VOX / 3D",
    requires: "vox",
    width: 9,
    height: 9,
    depth: 4,
    steps: 0,
  },
  {
    id: "NoDeadEnds#2",
    name: "NoDeadEnds",
    category: "VOX / 3D",
    requires: "vox",
    width: 19,
    height: 19,
    depth: 19,
    steps: 0,
  },
  {
    id: "Noise#2",
    name: "Noise",
    category: "VOX / 3D",
    requires: "vox",
    width: 24,
    height: 24,
    depth: 24,
    steps: 0,
  },
  {
    id: "OddScale3D",
    name: "OddScale3D",
    category: "VOX / 3D",
    requires: "vox",
    width: 8,
    height: 8,
    depth: 8,
    steps: 0,
  },
  {
    id: "OpenCave3D",
    name: "OpenCave3D",
    category: "VOX / 3D",
    requires: "vox",
    width: 40,
    height: 40,
    depth: 40,
    steps: 0,
  },
  {
    id: "OrientedEscher",
    name: "OrientedEscher",
    category: "VOX / 3D",
    requires: "vox",
    width: 6,
    height: 6,
    depth: 6,
    steps: 0,
  },
  {
    id: "ParallelGrowth",
    name: "ParallelGrowth",
    category: "VOX / 3D",
    requires: "vox",
    width: 29,
    height: 29,
    depth: 29,
    steps: 24,
  },
  {
    id: "Partitioning",
    name: "Partitioning",
    category: "VOX / 3D",
    requires: "vox",
    width: 11,
    height: 11,
    depth: 3,
    steps: 0,
  },
  {
    id: "PeriodicEscher",
    name: "PeriodicEscher",
    category: "VOX / 3D",
    requires: "vox",
    width: 8,
    height: 8,
    depth: 8,
    steps: 0,
  },
  {
    id: "PillarsOfEternity",
    name: "PillarsOfEternity",
    category: "VOX / 3D",
    requires: "vox",
    width: 9,
    height: 9,
    depth: 9,
    steps: 0,
  },
  {
    id: "RegularSAW#2",
    name: "RegularSAW",
    category: "VOX / 3D",
    requires: "vox",
    width: 19,
    height: 19,
    depth: 19,
    steps: 0,
  },
  {
    id: "RegularSAWRestart#2",
    name: "RegularSAWRestart",
    category: "VOX / 3D",
    requires: "vox",
    width: 19,
    height: 19,
    depth: 19,
    steps: 0,
  },
  {
    id: "River#2",
    name: "River",
    category: "VOX / 3D",
    requires: "vox",
    width: 20,
    height: 20,
    depth: 20,
    steps: 0,
  },
  {
    id: "SeaVilla",
    name: "SeaVilla",
    category: "VOX / 3D",
    requires: "vox",
    width: 10,
    height: 10,
    depth: 4,
    steps: 0,
  },
  {
    id: "SeaVilla#2",
    name: "SeaVilla",
    category: "VOX / 3D",
    requires: "vox",
    width: 10,
    height: 10,
    depth: 4,
    steps: 0,
  },
  {
    id: "SelectLongKnots",
    name: "SelectLongKnots",
    category: "VOX / 3D",
    requires: "vox",
    width: 10,
    height: 10,
    depth: 10,
    steps: 0,
  },
  {
    id: "SoftPath#2",
    name: "SoftPath",
    category: "VOX / 3D",
    requires: "vox",
    width: 80,
    height: 80,
    depth: 80,
    steps: 0,
  },
  {
    id: "StairsPath",
    name: "StairsPath",
    category: "VOX / 3D",
    requires: "vox",
    width: 33,
    height: 33,
    depth: 33,
    steps: 0,
  },
  {
    id: "StochasticVoronoi#2",
    name: "StochasticVoronoi",
    category: "VOX / 3D",
    requires: "vox",
    width: 50,
    height: 50,
    depth: 50,
    steps: -1,
  },
  {
    id: "StrangeDungeon#2",
    name: "StrangeDungeon",
    category: "VOX / 3D",
    requires: "vox",
    width: 29,
    height: 29,
    depth: 29,
    steps: 0,
  },
  {
    id: "SubmergedKnots",
    name: "SubmergedKnots",
    category: "VOX / 3D",
    requires: "vox",
    width: 12,
    height: 12,
    depth: 12,
    steps: 0,
  },
  {
    id: "Surface",
    name: "Surface",
    category: "VOX / 3D",
    requires: "vox",
    width: 10,
    height: 10,
    depth: 10,
    steps: 0,
  },
  {
    id: "Voronoi#2",
    name: "Voronoi",
    category: "VOX / 3D",
    requires: "vox",
    width: 60,
    height: 60,
    depth: 60,
    steps: 0,
  },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function exampleById(id) {
  const example = EXAMPLES.find((entry) => entry.id === id || entry.name === id)
  assert(example, `unknown markov example '${id}'`)
  return example
}

function modelPath(example) {
  return `markov/models/${example.name}.xml`
}

function exampleLabel(example) {
  const variant =
    example.id === example.name
      ? ""
      : ` (${example.width}×${example.height}×${example.depth})`
  return `${example.name}${variant} [${example.requires.toUpperCase()}]`
}

function rowsFromCells(cells, width, height) {
  assert(
    typeof cells === "string" && cells.length > 0,
    "markov result cells must be non-empty string",
  )
  const firstSlice = cells.split(" ")[0]
  const rows = firstSlice.split("/")
  assert(
    rows.length === height,
    `markov result row count ${rows.length} does not match height ${height}`,
  )
  for (const row of rows)
    assert(
      row.length === width,
      `markov result row width ${row.length} does not match width ${width}`,
    )
  return rows
}

export class ViewMarkov extends ViewCanvasBase {
  static get observedAttributes() {
    return ["data-source"]
  }

  constructor() {
    super()
    this.exampleId = "Basic"
    this.statusElement = null
    this.metaElement = null
    this.pathElement = null
    this.running = false
    this.handle = 0
    this.playing = false
    this.animationFrame = 0
  }

  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = "1"

    const source = String(
      this.getAttribute("data-source") ||
        this.viewConfig?.defaultSource ||
        "Basic",
    ).trim()
    this.exampleId = exampleById(source).id

    this.innerHTML = `
      <canvas data-element="canvas"></canvas>
      <footer data-element="footer">
        <output data-element="path"></output>
        <output data-element="meta"></output>
        <output data-element="status">Ready</output>
      </footer>
    `

    this.statusElement = this.querySelector('[data-element="status"]')
    this.metaElement = this.querySelector('[data-element="meta"]')
    this.pathElement = this.querySelector('[data-element="path"]')
    assert(
      this.statusElement instanceof HTMLOutputElement,
      "view-markov missing status output",
    )
    assert(
      this.metaElement instanceof HTMLOutputElement,
      "view-markov missing meta output",
    )
    assert(
      this.pathElement instanceof HTMLOutputElement,
      "view-markov missing path output",
    )

    super.connectedCallback()
    this.syncHeaderControls()
    void this.resetSession()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name !== "data-source") return
    const source = String(newValue || "").trim()
    assert(
      source.length > 0,
      "view-markov data-source must be non-empty example id",
    )
    this.exampleId = exampleById(source).id
    if (this.dataset.ready) {
      this.syncHeaderControls()
      void this.resetSession()
    }
  }

  createViewPluginMethods() {
    return {
      reload: async () => {
        await this.resetSession()
        return { ok: true }
      },
      run: async () => {
        await this.stepCurrent()
        return { ok: true }
      },
      zoomIn: async () => {
        this.zoomIn()
        return { ok: true }
      },
      zoomOut: async () => {
        this.zoomOut()
        return { ok: true }
      },
      zoomFit: async () => {
        this.fitToContent()
        return { ok: true }
      },
    }
  }

  createHeaderControlsElement() {
    const toolbar = document.createElement("div")
    toolbar.dataset.element = "toolbar"
    toolbar.innerHTML = `
      <div role="buttongroup" data-element="file-actions">
        <select data-field="example" aria-label="Example"></select>
        <button type="button" data-action="reset" aria-label="Reset" title="Reset"><i aria-hidden="true">restart_alt</i></button>
      </div>
      <div role="buttongroup" data-element="tool-actions">
        <input type="number" data-field="seed" aria-label="Seed" title="Seed" min="0" step="1" value="1" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <input type="number" data-field="steps" aria-label="Steps per frame" title="Steps per frame" min="1" step="1" value="1" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <button type="button" data-action="step" aria-label="Step" title="Step"><i aria-hidden="true">skip_next</i></button>
        <button type="button" data-action="play-pause" aria-label="Play" title="Play"><i aria-hidden="true">play_arrow</i></button>
        <button type="button" data-action="reroll" aria-label="Reroll" title="Reroll seed"><i aria-hidden="true">casino</i></button>
      </div>
      <div role="buttongroup" data-element="view-actions">
        <button type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out"><i aria-hidden="true">zoom_out</i></button>
        <button type="button" data-action="zoom-fit" aria-label="Fit" title="Fit"><i aria-hidden="true">fit_screen</i></button>
        <button type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in"><i aria-hidden="true">zoom_in</i></button>
      </div>
    `

    const select = toolbar.querySelector('[data-field="example"]')
    assert(
      select instanceof HTMLSelectElement,
      "view-markov example select missing",
    )
    let currentGroup = null
    for (const example of EXAMPLES) {
      if (
        !(currentGroup instanceof HTMLOptGroupElement) ||
        currentGroup.label !== example.category
      ) {
        currentGroup = document.createElement("optgroup")
        currentGroup.label = example.category
        select.appendChild(currentGroup)
      }
      const option = document.createElement("option")
      option.value = example.id
      option.textContent = exampleLabel(example)
      option.dataset.requires = example.requires
      currentGroup.appendChild(option)
    }

    select.addEventListener("change", () => {
      this.exampleId = exampleById(select.value).id
      this.setAttribute("data-source", this.exampleId)
    })
    toolbar
      .querySelector('[data-action="reset"]')
      .addEventListener("click", () => this.resetSession())
    toolbar
      .querySelector('[data-action="step"]')
      .addEventListener("click", () => this.stepCurrent())
    toolbar
      .querySelector('[data-action="play-pause"]')
      .addEventListener("click", () => this.togglePlayback())
    toolbar
      .querySelector('[data-action="reroll"]')
      .addEventListener("click", () => this.reroll())
    toolbar
      .querySelector('[data-action="zoom-out"]')
      .addEventListener("click", () => this.zoomOut())
    toolbar
      .querySelector('[data-action="zoom-fit"]')
      .addEventListener("click", () => this.zoomFit())
    toolbar
      .querySelector('[data-action="zoom-in"]')
      .addEventListener("click", () => this.zoomIn())
    return toolbar
  }

  syncHeaderControls() {
    const example = exampleById(this.exampleId)
    const select = this.queryHeaderControl('[data-field="example"]')
    const stepsInput = this.queryHeaderControl('[data-field="steps"]')
    this.dataset.requires = example.requires
    if (select instanceof HTMLSelectElement) {
      select.value = example.id
      select.dataset.requires = example.requires
    }
    if (stepsInput instanceof HTMLInputElement) stepsInput.value = "1"
    if (this.pathElement instanceof HTMLOutputElement)
      this.pathElement.textContent = `${modelPath(example)} · ${example.requires.toUpperCase()}`
  }

  setStatus(text, tone = null) {
    assert(
      this.statusElement instanceof HTMLOutputElement,
      "view-markov status output is not initialized",
    )
    this.statusElement.textContent = text
    this.statusElement.classList.remove(
      "accent",
      "success",
      "warning",
      "danger",
      "info",
    )
    if (tone) this.statusElement.classList.add(tone)
  }

  seed() {
    const input = this.queryHeaderControl('[data-field="seed"]')
    assert(input instanceof HTMLInputElement, "view-markov missing seed input")
    const value = Number(input.value)
    assert(
      Number.isInteger(value) && value >= 0,
      "view-markov seed must be a non-negative integer",
    )
    return value
  }

  steps() {
    const input = this.queryHeaderControl('[data-field="steps"]')
    assert(input instanceof HTMLInputElement, "view-markov missing steps input")
    const value = Number(input.value)
    assert(
      Number.isInteger(value) && value >= 0,
      "view-markov steps must be a non-negative integer",
    )
    return value
  }

  disconnectedCallback() {
    this.stopPlayback()
    void this.destroySession()
    super.disconnectedCallback()
  }

  async reroll() {
    const input = this.queryHeaderControl('[data-field="seed"]')
    assert(input instanceof HTMLInputElement, "view-markov missing seed input")
    input.value = String(Math.floor(Math.random() * 0x7fffffff) + 1)
    await this.resetSession()
  }

  async destroySession() {
    if (this.handle === 0) return
    const handle = this.handle
    this.handle = 0
    unwrap(await runtime.invoke("markov/markov::run", { handle }))
  }

  async resetSession() {
    if (this.running) return
    this.running = true
    this.stopPlayback()
    const example = exampleById(this.exampleId)
    this.setStatus(`Resetting ${exampleLabel(example)}...`, "info")
    try {
      await this.destroySession()
      if (example.requires === "vox") {
        this.setData(null, { autoFit: false })
        assert(
          this.metaElement instanceof HTMLOutputElement,
          "view-markov meta output is not initialized",
        )
        this.metaElement.textContent = `${example.width} × ${example.height} × ${example.depth} · VOX render not implemented`
        this.setStatus(
          `${exampleLabel(example)} requires VOX rendering`,
          "warning",
        )
        return
      }
      const started = performance.now()
      const session = unwrap(
        await runtime.invoke("markov/markov::create", {
          model: modelPath(example),
          width: example.width,
          height: example.height,
          depth: example.depth,
          seed: this.seed(),
        }),
      )
      assert(
        Number.isInteger(session.handle) && session.handle > 0,
        "markov.create returned invalid handle",
      )
      this.handle = session.handle
      this.applyGrid(session.grid, true)
      this.setStatus(
        `${example.name} ready in ${Math.round(performance.now() - started)}ms`,
        "success",
      )
    } catch (error) {
      this.handle = 0
      this.setData(null, { autoFit: false })
      this.setStatus(`Error: ${error?.message || error}`, "danger")
      console.error("view-markov reset failed:", error)
    } finally {
      this.running = false
    }
  }

  async stepCurrent() {
    if (this.running) return
    if (this.handle === 0) {
      await this.resetSession()
      if (this.handle === 0) return
    }
    this.running = true
    const started = performance.now()
    try {
      const session = unwrap(
        await runtime.invoke("markov/markov::step", {
          handle: this.handle,
          steps: this.steps(),
        }),
        "markov.step",
      )
      this.applyGrid(session.grid, false)
      const grid = session.grid
      this.setStatus(
        grid.done
          ? `Done in ${grid.stepsRun} steps`
          : `Stepped in ${Math.round(performance.now() - started)}ms`,
        grid.done ? "success" : "info",
      )
      if (grid.done) this.stopPlayback()
    } catch (error) {
      this.stopPlayback()
      this.setStatus(`Error: ${error?.message || error}`, "danger")
      console.error("view-markov step failed:", error)
    } finally {
      this.running = false
    }
  }

  applyGrid(grid, autoFit) {
    assert(
      grid && typeof grid === "object" && !Array.isArray(grid),
      "view-markov grid must be object",
    )
    const rows = rowsFromCells(grid.cells, grid.width, grid.height)
    this.setData({ ...grid, rows }, { autoFit })
    assert(
      this.metaElement instanceof HTMLOutputElement,
      "view-markov meta output is not initialized",
    )
    this.metaElement.textContent = `${grid.width} × ${grid.height} · values ${grid.values} · steps ${grid.stepsRun} · changed ${grid.changed}${grid.done ? " · done" : ""}`
  }

  togglePlayback() {
    if (this.playing) {
      this.stopPlayback()
      return
    }
    this.playing = true
    this.syncPlaybackButton()
    this.animationFrame = requestAnimationFrame(() => this.playbackTick())
  }

  stopPlayback() {
    this.playing = false
    if (this.animationFrame !== 0) cancelAnimationFrame(this.animationFrame)
    this.animationFrame = 0
    this.syncPlaybackButton()
  }

  syncPlaybackButton() {
    const button = this.queryHeaderControl('[data-action="play-pause"]')
    if (!(button instanceof HTMLButtonElement)) return
    const icon = button.querySelector("i")
    if (icon) icon.textContent = this.playing ? "pause" : "play_arrow"
    button.setAttribute("aria-label", this.playing ? "Pause" : "Play")
    button.setAttribute("title", this.playing ? "Pause" : "Play")
  }

  async playbackTick() {
    if (!this.playing) return
    await this.stepCurrent()
    if (!this.playing) return
    this.animationFrame = requestAnimationFrame(() => this.playbackTick())
  }

  calculateContentBounds(data) {
    if (!data) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    return { minX: 0, minY: 0, maxX: data.width, maxY: data.height }
  }

  drawContent(ctx, data) {
    if (!data) return

    ctx.fillStyle = "#101820"
    ctx.fillRect(0, 0, data.width, data.height)

    for (let y = 0; y < data.height; y += 1) {
      const row = data.rows[y]
      for (let x = 0; x < data.width; x += 1) {
        const symbol = row[x]
        ctx.fillStyle = PALETTE[symbol] || "#ff00ff"
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }
}

if (!customElements.get("view-markov")) {
  customElements.define("view-markov", ViewMarkov)
}
