package main

import (
	"math"

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
	NodeCount              int
	MaxDepth               int
	MaxBranching           int
	MinBranching           int
	BranchingProbability   float64
	DepthFalloff           float64
	BalanceBias            float64
	RequireLeafCount       int
	RequireRootBranchCount int
}

func DefaultConfig(rng Random) GenerateTreeConfig {
	return GenerateTreeConfig{
		NodeCount:              0,
		MaxDepth:               6,
		MaxBranching:           4,
		MinBranching:           0,
		BranchingProbability:   0.9,
		DepthFalloff:           0.8,
		BalanceBias:            0.0,
		RequireLeafCount:       0,
		RequireRootBranchCount: 0,
	}
}

// ------------------------------------------------------------
// GenerateTree
// ------------------------------------------------------------

func GenerateTree(cfg GenerateTreeConfig, rng Random) tree3.Tree {

	t := tree3.Tree{}
	t.Add(-1, nil) // Set root

	// --- Step 1: Generate required root branches ---------------------------------

	rootBranchCount := cfg.RequireRootBranchCount
	if rootBranchCount < cfg.MinBranching {
		rootBranchCount = cfg.MinBranching
	}
	if rootBranchCount > cfg.MaxBranching {
		rootBranchCount = cfg.MaxBranching
	}

	frontier := make([]frontierNode, 0, 64)

	// Attach required root children
	totalNodes := 1
	if cfg.MaxDepth > 1 {
		for i := 0; i < rootBranchCount; i++ {
			if cfg.NodeCount > 0 && totalNodes >= cfg.NodeCount {
				return t
			}
			child := t.Add(0, nil)
			totalNodes++
			frontier = append(frontier, frontierNode{node: child, depth: 2})
		}
	}

	// --- Step 2: Normal generation for all other nodes -----------------------------

	for len(frontier) > 0 {
		fn := frontier[0]
		frontier = frontier[1:]

		if cfg.MaxDepth > 0 && fn.depth >= cfg.MaxDepth {
			continue
		}

		// skip branching decision for root (already processed)
		if fn.depth != 1 {
			depthFactor := math.Pow(cfg.DepthFalloff, float64(fn.depth-1))
			effectiveProb := cfg.BranchingProbability * depthFactor
			if rng.Float64() > effectiveProb {
				continue
			}
		}

		// Determine number of children
		minB, maxB := cfg.MinBranching, cfg.MaxBranching
		if maxB < minB {
			maxB = minB
		}

		count := minB
		if maxB > minB {
			count += rng.Intn(maxB - minB + 1)
		}

		// Apply bias
		if cfg.BalanceBias != 0 {
			b := cfg.BalanceBias
			if b > 0 {
				if rng.Float64() < b {
					count++
				}
			} else {
				if rng.Float64() < -b && count > minB {
					count--
				}
			}
		}

		// Create children
		parentIdx := t.IndexOf(fn.node)
		for i := 0; i < count; i++ {
			if cfg.NodeCount > 0 && totalNodes >= cfg.NodeCount {
				goto LEAF_FIX
			}
			child := t.Add(parentIdx, nil)
			totalNodes++
			frontier = append(frontier, frontierNode{
				node:  child,
				depth: fn.depth + 1,
			})
		}
	}

LEAF_FIX:

	// --- Step 3: Fix minimum leaf count if required -------------------------------

	if cfg.RequireLeafCount > 0 {
		fixLeafCount(rng, &t, cfg, &totalNodes)
	}

	return t
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

type frontierNode struct {
	node  *tree3.Node
	depth int
}

// Expand leaves until minimum required leaf count is reached
func fixLeafCount(rng Random, t *tree3.Tree, cfg GenerateTreeConfig, totalNodes *int) {
	leaves := collectLeaves(t)

	for len(leaves) < cfg.RequireLeafCount {
		// pick leaf at random
		leaf := leaves[rng.Intn(len(leaves))]

		depth := getDepth(t, leaf)
		if cfg.MaxDepth > 0 && depth >= cfg.MaxDepth {
			// this leaf cannot expand; choose another
			// if *all* leaves can't grow, then we break
			exhausted := true
			for _, l := range leaves {
				if getDepth(t, l) < cfg.MaxDepth {
					exhausted = false
					break
				}
			}
			if exhausted {
				return
			}
			continue
		}

		parentIdx := t.IndexOf(leaf)
		t.Add(parentIdx, nil) // set child node
		*totalNodes++

		// re-collect leaves after expansion
		leaves = collectLeaves(t)

		// stop if NodeCount hits limit
		if cfg.NodeCount > 0 && *totalNodes >= cfg.NodeCount {
			return
		}
	}
}

func collectLeaves(t *tree3.Tree) []*tree3.Node {
	childrenCount := make([]int, len(*t))

	// Count children for each node
	for _, n := range *t {
		if n.ParentId >= 0 {
			childrenCount[n.ParentId]++
		}
	}

	// Collect leaves
	leaves := []*tree3.Node{}
	for i, n := range *t {
		if childrenCount[i] == 0 {
			leaves = append(leaves, n)
		}
	}
	return leaves
}

func getDepth(t *tree3.Tree, n *tree3.Node) int {
	depth := 1
	curr := n
	for curr.ParentId != -1 {
		curr = (*t)[curr.ParentId]
		depth++
	}
	return depth
}
