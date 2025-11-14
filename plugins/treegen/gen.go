package main

import (
	"github.com/justgook/gamectl/pkg/tree3"
)

// ------------------------------------------------------------
// Config + RNG interface
// ------------------------------------------------------------

type Random interface {
	Intn(n int) int
	Float64() float64
}

type GenerateTreeConfig struct {
	NodeCount    int     `json:"nodeCount"`    // 0 = generate until MaxDepth reached
	MaxDepth     int     `json:"maxDepth"`     // maximum tree depth
	MaxBranching int     `json:"maxBranching"` // maximum children per node
	MinBranching int     `json:"minBranching"` // minimum children per node
	ShapeBias    float64 `json:"shapeBias"`    // -1.0 to +1.0: negative = tall/deep, positive = wide/shallow
	Density      float64 `json:"density"`      // 0.0 to 1.0: probability of branching at each node
	RootBranches int     `json:"rootBranches"` // specific number of root children (0 = auto)
	LeafRatio    float64 `json:"leafRatio"`    // 0.0 to 1.0: desired ratio of leaf nodes
}

// Example preset configurations (no defaults in code):
//
// Balanced Tree:
//   NodeCount: 50, MaxDepth: 6, MaxBranching: 3, MinBranching: 1
//   ShapeBias: 0.0, Density: 0.7, RootBranches: 0, LeafRatio: 0.4
//
// Wide/Bushy Tree:
//   NodeCount: 100, MaxDepth: 4, MaxBranching: 5, MinBranching: 2
//   ShapeBias: 0.8, Density: 0.9, RootBranches: 4, LeafRatio: 0.6
//
// Tall/Deep Tree:
//   NodeCount: 30, MaxDepth: 10, MaxBranching: 2, MinBranching: 1
//   ShapeBias: -0.7, Density: 0.5, RootBranches: 1, LeafRatio: 0.2
//
// Sparse Tree:
//   NodeCount: 20, MaxDepth: 8, MaxBranching: 3, MinBranching: 0
//   ShapeBias: 0.0, Density: 0.3, RootBranches: 2, LeafRatio: 0.7

// ------------------------------------------------------------
// GenerateTree
// ------------------------------------------------------------

func GenerateTree(cfg GenerateTreeConfig, rng Random) tree3.Tree {
	t := tree3.Tree{}
	t.Add(-1, nil) // Add root node

	gen := &treeGenerator{
		tree:   &t,
		config: cfg,
		rng:    rng,
		nodes:  1,
	}

	// Generate tree structure
	gen.generateStructure()

	// Apply leaf ratio constraint if needed
	if cfg.LeafRatio > 0 {
		gen.adjustLeafRatio()
	}

	return t
}

// ------------------------------------------------------------
// Tree Generator
// ------------------------------------------------------------

type treeGenerator struct {
	tree   *tree3.Tree
	config GenerateTreeConfig
	rng    Random
	nodes  int
}

type queueNode struct {
	node  *tree3.Node
	depth int
}

func (g *treeGenerator) generateStructure() {
	// Create root branches
	rootChildren := g.determineRootBranches()
	queue := make([]queueNode, 0, 64)

	// Add root children to queue
	for i := 0; i < rootChildren && g.canAddNode(); i++ {
		child := g.tree.Add(0, nil)
		g.nodes++
		queue = append(queue, queueNode{node: child, depth: 2})
	}

	// Ensure minimum viable tree - if no root children, create at least one
	if len(queue) == 0 && g.config.NodeCount <= 0 {
		child := g.tree.Add(0, nil)
		g.nodes++
		queue = append(queue, queueNode{node: child, depth: 2})
	}

	// Process queue (breadth-first with shape bias)
	for len(queue) > 0 {
		// Shape bias affects processing order
		current := g.selectNextNode(queue)
		queue = g.removeFromQueue(queue, current)

		if current.depth >= g.config.MaxDepth {
			continue
		}

		// Decide if this node should branch
		if !g.shouldBranch(current.depth) {
			continue
		}

		// Determine number of children
		childCount := g.determineChildCount(current.depth)

		// Add children
		parentIdx := g.tree.IndexOf(current.node)
		for i := 0; i < childCount; i++ {
			if !g.canAddNode() {
				return // Stop if we hit node limit
			}
			child := g.tree.Add(parentIdx, nil)
			g.nodes++
			queue = append(queue, queueNode{
				node:  child,
				depth: current.depth + 1,
			})
		}
	}
}

func (g *treeGenerator) determineRootBranches() int {
	if g.config.RootBranches > 0 {
		return g.config.RootBranches
	}

	// Auto-determine based on other parameters
	min := g.config.MinBranching
	max := g.config.MaxBranching
	if max < min {
		max = min
	}

	if min == max {
		return min
	}

	count := min + g.rng.Intn(max-min+1)

	// Apply shape bias to root branching
	if g.config.ShapeBias > 0 {
		// Positive bias = wider trees = more root branches
		if g.rng.Float64() < g.config.ShapeBias && count < max {
			count++
		}
	}

	return count
}

func (g *treeGenerator) selectNextNode(queue []queueNode) queueNode {
	if len(queue) == 0 {
		panic("empty queue")
	}

	// Shape bias affects selection strategy
	if g.config.ShapeBias > 0 {
		// Positive bias = wider trees = process shallower nodes first (breadth-first)
		minDepth := queue[0].depth
		minIdx := 0
		for i, node := range queue {
			if node.depth < minDepth {
				minDepth = node.depth
				minIdx = i
			}
		}
		return queue[minIdx]
	} else if g.config.ShapeBias < 0 {
		// Negative bias = taller trees = process deeper nodes first (depth-first)
		maxDepth := queue[0].depth
		maxIdx := 0
		for i, node := range queue {
			if node.depth > maxDepth {
				maxDepth = node.depth
				maxIdx = i
			}
		}
		return queue[maxIdx]
	}

	// No bias = random selection
	return queue[g.rng.Intn(len(queue))]
}

func (g *treeGenerator) removeFromQueue(queue []queueNode, target queueNode) []queueNode {
	for i, node := range queue {
		if node.node == target.node {
			return append(queue[:i], queue[i+1:]...)
		}
	}
	return queue
}

func (g *treeGenerator) shouldBranch(depth int) bool {
	// Base probability from density
	prob := g.config.Density

	// When nodeCount is 0 (unlimited), ensure minimum viable branching
	// at shallow depths to avoid degenerate trees
	if g.config.NodeCount <= 0 && depth <= 3 && g.nodes < 6 {
		// Increase probability for shallow depths when tree is too small
		minProbAtShallow := 0.8
		if prob < minProbAtShallow {
			prob = minProbAtShallow
		}
	}

	// Shape bias affects branching probability by depth
	if g.config.ShapeBias > 0 {
		// Positive bias = wider trees = higher probability at shallow depths
		depthFactor := 1.0 - float64(depth-1)/float64(g.config.MaxDepth)
		prob *= 1.0 + g.config.ShapeBias*depthFactor
	} else if g.config.ShapeBias < 0 {
		// Negative bias = taller trees = higher probability at deeper depths
		depthFactor := float64(depth-1) / float64(g.config.MaxDepth)
		prob *= 1.0 + (-g.config.ShapeBias)*depthFactor
	}

	// Clamp probability
	if prob > 1.0 {
		prob = 1.0
	}
	if prob < 0.0 {
		prob = 0.0
	}

	return g.rng.Float64() < prob
}

func (g *treeGenerator) determineChildCount(depth int) int {
	min := g.config.MinBranching
	max := g.config.MaxBranching
	if max < min {
		max = min
	}

	if min == max {
		return min
	}

	// Base count
	count := min + g.rng.Intn(max-min+1)

	// Shape bias affects child count
	if g.config.ShapeBias > 0 {
		// Positive bias = wider trees = more children at shallow depths
		if depth <= g.config.MaxDepth/2 && g.rng.Float64() < g.config.ShapeBias {
			if count < max {
				count++
			}
		}
	} else if g.config.ShapeBias < 0 {
		// Negative bias = taller trees = fewer children overall
		if g.rng.Float64() < -g.config.ShapeBias {
			if count > min {
				count--
			}
		}
	}

	return count
}

func (g *treeGenerator) canAddNode() bool {
	if g.config.NodeCount <= 0 {
		return true // No limit
	}
	return g.nodes < g.config.NodeCount
}

func (g *treeGenerator) adjustLeafRatio() {
	currentLeaves := g.countLeaves()
	targetLeaves := int(float64(g.nodes) * g.config.LeafRatio)

	if currentLeaves >= targetLeaves {
		return // Already have enough leaves
	}

	// Need more leaves - convert some internal nodes to leaves by removing their children
	// This is a simplified approach - in practice, you might want more sophisticated logic
	_ = targetLeaves // TODO: Implement if needed
}

func (g *treeGenerator) countLeaves() int {
	childCount := make([]int, len(*g.tree))

	// Count children for each node
	for _, node := range *g.tree {
		if node.ParentId >= 0 {
			childCount[node.ParentId]++
		}
	}

	// Count nodes with no children
	leaves := 0
	for i := range *g.tree {
		if childCount[i] == 0 {
			leaves++
		}
	}

	return leaves
}
