package main

import (
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree3"
)

// GoRNG implements the Random interface using math/rand
type GoRNG struct{ *rand.Rand }

func NewGoRNG(seed int64) *GoRNG {
	return &GoRNG{rand.New(rand.NewSource(seed))}
}

// Helper to count nodes in a tree
func countNodes(t tree3.Tree) int {
	return len(t)
}

// Helper to get max depth of a tree
func getMaxDepth(t tree3.Tree) int {
	maxDepth := 0
	for _, node := range t {
		depth := getDepth(&t, node)
		if depth > maxDepth {
			maxDepth = depth
		}
	}
	return maxDepth
}

func TestGenerateTree_Skinny(t *testing.T) {
	seed := int64(123)
	rng := NewGoRNG(seed)

	cfg := DefaultConfig(rng)
	cfg.MaxDepth = 20
	cfg.MaxBranching = 2
	cfg.MinBranching = 0
	cfg.BranchingProbability = 0.6
	cfg.BalanceBias = -0.8 // very tall

	tree := GenerateTree(cfg, rng)

	if countNodes(tree) < 1 {
		t.Errorf("Skinny tree should have at least 1 node, got %d", countNodes(tree))
	}
	if getMaxDepth(tree) > cfg.MaxDepth+1 { // +1 because root is depth 1, children depth 2 etc.
		t.Errorf("Skinny tree max depth %d exceeded configured max depth %d", getMaxDepth(tree), cfg.MaxDepth)
	}
	// For a skinny tree, we expect a relatively low node count and high depth
	// Exact numbers are hard to assert due to randomness, but we can check general characteristics
	if countNodes(tree) > 100 { // Arbitrary upper bound for a "skinny" tree with these settings
		t.Errorf("Skinny tree node count %d seems too high for a skinny tree", countNodes(tree))
	}
	if getMaxDepth(tree) < 5 { // Arbitrary lower bound for depth
		t.Errorf("Skinny tree max depth %d seems too low for a skinny tree", getMaxDepth(tree))
	}
}

func TestGenerateTree_Bushy(t *testing.T) {
	seed := int64(456)
	rng := NewGoRNG(seed)

	cfg := DefaultConfig(rng)
	cfg.MaxDepth = 4
	cfg.MaxBranching = 5
	cfg.MinBranching = 2
	cfg.BranchingProbability = 0.95
	cfg.BalanceBias = +0.7 // wide

	tree := GenerateTree(cfg, rng)

	if countNodes(tree) < 1 {
		t.Errorf("Bushy tree should have at least 1 node, got %d", countNodes(tree))
	}
	if getMaxDepth(tree) > cfg.MaxDepth+1 {
		t.Errorf("Bushy tree max depth %d exceeded configured max depth %d", getMaxDepth(tree), cfg.MaxDepth)
	}
	// For a bushy tree, we expect a relatively high node count and low depth
	if countNodes(tree) < 20 { // Arbitrary lower bound for a "bushy" tree
		t.Errorf("Bushy tree node count %d seems too low for a bushy tree", countNodes(tree))
	}
	if getMaxDepth(tree) > 5 { // Should be close to MaxDepth
		t.Errorf("Bushy tree max depth %d seems too high for a bushy tree", getMaxDepth(tree))
	}
}

func TestGenerateTree_Balanced(t *testing.T) {
	seed := int64(789)
	rng := NewGoRNG(seed)

	cfg := DefaultConfig(rng)
	cfg.MaxDepth = 6
	cfg.MaxBranching = 3
	cfg.MinBranching = 1
	cfg.BranchingProbability = 0.85
	cfg.DepthFalloff = 0.65
	cfg.BalanceBias = 0

	tree := GenerateTree(cfg, rng)

	if countNodes(tree) < 1 {
		t.Errorf("Balanced tree should have at least 1 node, got %d", countNodes(tree))
	}
	if getMaxDepth(tree) > cfg.MaxDepth+1 {
		t.Errorf("Balanced tree max depth %d exceeded configured max depth %d", getMaxDepth(tree), cfg.MaxDepth)
	}
	// For a balanced tree, node count and depth should be within reasonable bounds
	if countNodes(tree) < 10 || countNodes(tree) > 150 {
		t.Errorf("Balanced tree node count %d seems out of expected range", countNodes(tree))
	}
	if getMaxDepth(tree) < 3 || getMaxDepth(tree) > 7 {
		t.Errorf("Balanced tree max depth %d seems out of expected range", getMaxDepth(tree))
	}
}

func TestGenerateTree_TargetNodeCount(t *testing.T) {
	seed := int64(101112)
	rng := NewGoRNG(seed)

	cfg := DefaultConfig(rng)
	cfg.NodeCount = 100
	cfg.MaxDepth = 10 // Provide a max depth to prevent infinite loops if branching is too low
	cfg.MaxBranching = 4
	cfg.MinBranching = 1

	tree := GenerateTree(cfg, rng)

	if countNodes(tree) != cfg.NodeCount {
		t.Errorf("Tree with target node count %d, got %d nodes", cfg.NodeCount, countNodes(tree))
	}
	if getMaxDepth(tree) > cfg.MaxDepth+1 {
		t.Errorf("Tree with target node count max depth %d exceeded configured max depth %d", getMaxDepth(tree), cfg.MaxDepth)
	}
}

func TestGenerateTree_RequiredRootBranches(t *testing.T) {
	seed := int64(131415)
	rng := NewGoRNG(seed)

	cfg := DefaultConfig(rng)
	cfg.MaxDepth = 3
	cfg.MaxBranching = 5
	cfg.MinBranching = 0
	cfg.BranchingProbability = 0.1 // Low probability to see if required branches are guaranteed
	cfg.RequireRootBranchCount = 3

	tree := GenerateTree(cfg, rng)

	rootNode := tree[0] // Assuming root is always at index 0

	rootChildrenCount := 0
	for range tree.Children(rootNode) {
		rootChildrenCount++
	}

	if rootChildrenCount != cfg.RequireRootBranchCount {
		t.Errorf("Expected %d root children, got %d", cfg.RequireRootBranchCount, rootChildrenCount)
	}

	// Check if children of required root branches also branch (subject to probability)
	// This is harder to assert precisely due to randomness, but we can check if they exist
	hasGrandchildren := false
	for child := range tree.Children(rootNode) { // Iterate over children of the root
		grandchildCount := 0
		for range tree.Children(child) { // Iterate over children of the current child (grandchildren)
			grandchildCount++
		}
		if grandchildCount > 0 {
			hasGrandchildren = true
			break
		}
	}
	if !hasGrandchildren {
		t.Errorf("Expected at least one grandchild from required root branches, but found none. Branching probability might be too aggressive.")
	}
}
