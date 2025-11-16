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
	NodeCount    int     `json:"nodeCount"`    // target node count (0 = unlimited)
	MaxDepth     int     `json:"maxDepth"`     // maximum tree depth
	MaxBranching int     `json:"maxBranching"` // maximum children per node
	MinBranching int     `json:"minBranching"` // minimum children per node (kept for compatibility)
	ShapeBias    float64 `json:"shapeBias"`    // unused in new algorithm
	Density      float64 `json:"density"`      // decay factor for unlimited mode
	RootBranches int     `json:"rootBranches"` // specific number of root children (0 = auto)
	LeafRatio    float64 `json:"leafRatio"`    // unused in new algorithm
}

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

	// Generate tree structure using pool-based algorithm
	gen.generateStructure()

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

type poolNode struct {
	node  *tree3.Node
	depth int
}

func (g *treeGenerator) generateStructure() {
	// Pool-based random node selection algorithm

	// Create initial root children
	rootChildren := g.determineRootBranches()
	pool := make([]poolNode, 0, 64)

	// Add root children to pool
	for i := 0; i < rootChildren; i++ {
		child := g.tree.Add(0, nil)
		g.nodes++
		if g.canNodeHaveChildren(child, 2) {
			pool = append(pool, poolNode{node: child, depth: 2})
		}
	}

	// For unlimited nodeCount: determine target deep nodes
	var targetDeepNodes int
	var nodesAtMaxDepth int
	if g.config.NodeCount <= 0 {
		// Auto-determine how many nodes should reach max depth (2-5)
		targetDeepNodes = 2 + g.rng.Intn(4)
	}

	// Main generation loop: randomly pick nodes from pool and add children
	for {
		// Check termination conditions
		if g.config.NodeCount > 0 {
			// Limited: stop when target reached or no more nodes can have children
			if g.nodes >= g.config.NodeCount || len(pool) == 0 {
				break
			}
		} else {
			// Unlimited: stop when no pool or probability says stop
			if len(pool) == 0 {
				break
			}
			if nodesAtMaxDepth >= targetDeepNodes && g.shouldStopUnlimited(nodesAtMaxDepth, targetDeepNodes) {
				break
			}
		}

		// Pick random node from pool
		poolIdx := g.rng.Intn(len(pool))
		parent := pool[poolIdx]

		// Add one child to the selected parent
		child := g.tree.Add(g.tree.IndexOf(parent.node), nil)
		g.nodes++
		childDepth := parent.depth + 1

		// Track nodes that reached max depth (for unlimited mode)
		if childDepth >= g.config.MaxDepth {
			nodesAtMaxDepth++
		}

		// Add child to pool if it can have children
		if g.canNodeHaveChildren(child, childDepth) {
			pool = append(pool, poolNode{node: child, depth: childDepth})
		}

		// Update parent in pool or remove if it reached limits
		if g.canNodeHaveChildren(parent.node, parent.depth) {
			// Parent can still have more children, keep it in pool
		} else {
			// Parent reached max branching, remove from pool
			pool = append(pool[:poolIdx], pool[poolIdx+1:]...)
		}
	}
}

func (g *treeGenerator) determineRootBranches() int {
	if g.config.RootBranches > 0 {
		return g.config.RootBranches
	}

	// Simple random root branching between 1 and max
	min := 1
	max := g.config.MaxBranching
	if max < min {
		max = min
	}

	// For interesting trees, bias toward having multiple root branches
	count := min + g.rng.Intn(max-min+1)

	// 70% chance to have at least 2 branches for more variety
	if count == 1 && g.rng.Float64() < 0.7 && max > 1 {
		count = 2
	}

	return count
}

// Check if a node can have more children
func (g *treeGenerator) canNodeHaveChildren(node *tree3.Node, depth int) bool {
	if depth >= g.config.MaxDepth {
		return false
	}

	// Count current children
	nodeIdx := g.tree.IndexOf(node)
	childCount := 0
	for _, n := range *g.tree {
		if n.ParentId == nodeIdx {
			childCount++
		}
	}

	return childCount < g.config.MaxBranching
}

// Probability calculation for unlimited mode
func (g *treeGenerator) shouldStopUnlimited(nodesAtMaxDepth, targetDeepNodes int) bool {
	// Calculate remaining potential nodes (pool size represents this)
	remainingPotential := len(g.getEligiblePool())

	if remainingPotential == 0 {
		return true
	}

	// Exponential decay: probability increases as 1/remaining²
	// Modified by density parameter
	baseProbability := 1.0 / float64(remainingPotential*remainingPotential)
	probability := baseProbability * g.config.Density

	return g.rng.Float64() < probability
}

// Get pool of nodes that can still have children (for probability calculation)
func (g *treeGenerator) getEligiblePool() []poolNode {
	pool := make([]poolNode, 0)
	for i, node := range *g.tree {
		depth := g.calculateNodeDepth(i)
		if g.canNodeHaveChildren(node, depth) {
			pool = append(pool, poolNode{node: node, depth: depth})
		}
	}
	return pool
}

// Calculate depth of a node by traversing up to root
func (g *treeGenerator) calculateNodeDepth(nodeIdx int) int {
	depth := 1
	current := (*g.tree)[nodeIdx]
	for current.ParentId >= 0 {
		current = (*g.tree)[current.ParentId]
		depth++
	}
	return depth
}
