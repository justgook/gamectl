package main_test

import (
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree3"
	"github.com/justgook/gamectl/plugins/treegen"
)

// GoRNG implements the Random interface using math/rand
type GoRNG struct{ *rand.Rand }

func NewGoRNG(seed int64) *GoRNG {
	return &GoRNG{rand.New(rand.NewSource(seed))}
}

// Test helpers
func countNodes(t tree3.Tree) int {
	return len(t)
}

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

func getDepth(t *tree3.Tree, n *tree3.Node) int {
	depth := 1
	curr := n
	for curr.ParentId != -1 {
		curr = (*t)[curr.ParentId]
		depth++
	}
	return depth
}

func countRootChildren(t tree3.Tree) int {
	if len(t) == 0 {
		return 0
	}
	root := t[0]
	count := 0
	for range t.Children(root) {
		count++
	}
	return count
}

func countLeaves(t tree3.Tree) int {
	childCount := make([]int, len(t))
	for _, node := range t {
		if node.ParentId >= 0 {
			childCount[node.ParentId]++
		}
	}

	leaves := 0
	for i := range t {
		if childCount[i] == 0 {
			leaves++
		}
	}
	return leaves
}

// Test basic functionality
func TestGenerateTree_Basic(t *testing.T) {
	rng := NewGoRNG(123)

	cfg := main.GenerateTreeConfig{
		NodeCount:    10,
		MaxDepth:     5,
		MaxBranching: 3,
		MinBranching: 1,
		ShapeBias:    0.0,
		Density:      0.7,
		RootBranches: 0,
		LeafRatio:    0.0,
	}

	tree := main.GenerateTree(cfg, rng)

	if countNodes(tree) != cfg.NodeCount {
		t.Errorf("Expected %d nodes, got %d", cfg.NodeCount, countNodes(tree))
	}

	if getMaxDepth(tree) > cfg.MaxDepth {
		t.Errorf("Max depth %d exceeded configured max depth %d", getMaxDepth(tree), cfg.MaxDepth)
	}

	if countNodes(tree) < 1 {
		t.Errorf("Tree should have at least 1 node (root)")
	}
}

// Test NodeCount = 0 (generate until MaxDepth)
func TestGenerateTree_NoNodeLimit(t *testing.T) {
	rng := NewGoRNG(456)

	cfg := main.GenerateTreeConfig{
		NodeCount:    0, // No limit
		MaxDepth:     4,
		MaxBranching: 2,
		MinBranching: 1,
		ShapeBias:    0.0,
		Density:      0.8,
		RootBranches: 2,
		LeafRatio:    0.0,
	}

	tree := main.GenerateTree(cfg, rng)

	if countNodes(tree) < 1 {
		t.Errorf("Tree should have at least 1 node (root)")
	}

	if getMaxDepth(tree) > cfg.MaxDepth {
		t.Errorf("Max depth %d exceeded configured max depth %d", getMaxDepth(tree), cfg.MaxDepth)
	}

	// Should reach max depth when no node limit
	if getMaxDepth(tree) < cfg.MaxDepth {
		t.Errorf("Expected tree to reach max depth %d, got %d", cfg.MaxDepth, getMaxDepth(tree))
	}
}

// Test RootBranches constraint
func TestGenerateTree_RootBranches(t *testing.T) {
	rng := NewGoRNG(789)

	cfg := main.GenerateTreeConfig{
		NodeCount:    20,
		MaxDepth:     4,
		MaxBranching: 3,
		MinBranching: 1,
		ShapeBias:    0.0,
		Density:      0.9,
		RootBranches: 3, // Specific root branches
		LeafRatio:    0.0,
	}

	tree := main.GenerateTree(cfg, rng)

	rootChildren := countRootChildren(tree)
	if rootChildren != cfg.RootBranches {
		t.Errorf("Expected %d root children, got %d", cfg.RootBranches, rootChildren)
	}
}

// Test ShapeBias - Wide trees (positive bias)
func TestGenerateTree_WideBias(t *testing.T) {
	rng := NewGoRNG(101)

	cfg := main.GenerateTreeConfig{
		NodeCount:    50,
		MaxDepth:     6,
		MaxBranching: 4,
		MinBranching: 1,
		ShapeBias:    0.8, // Strong wide bias
		Density:      0.7,
		RootBranches: 0,
		LeafRatio:    0.0,
	}

	tree := main.GenerateTree(cfg, rng)

	// Wide trees should have more nodes at shallow depths
	// This is hard to test precisely, but we can check basic properties
	if countNodes(tree) != cfg.NodeCount {
		t.Errorf("Expected %d nodes, got %d", cfg.NodeCount, countNodes(tree))
	}

	// Wide trees should have more root children on average
	rootChildren := countRootChildren(tree)
	if rootChildren < 2 {
		t.Errorf("Wide tree should have multiple root children, got %d", rootChildren)
	}
}

// Test ShapeBias - Tall trees (negative bias)
func TestGenerateTree_TallBias(t *testing.T) {
	rng := NewGoRNG(202)

	cfg := main.GenerateTreeConfig{
		NodeCount:    30,
		MaxDepth:     8,
		MaxBranching: 3,
		MinBranching: 1,
		ShapeBias:    -0.7, // Strong tall bias
		Density:      0.6,
		RootBranches: 0,
		LeafRatio:    0.0,
	}

	tree := main.GenerateTree(cfg, rng)

	if countNodes(tree) != cfg.NodeCount {
		t.Errorf("Expected %d nodes, got %d", cfg.NodeCount, countNodes(tree))
	}

	// Tall trees should reach deeper depths
	if getMaxDepth(tree) < 4 {
		t.Errorf("Tall tree should reach reasonable depth, got %d", getMaxDepth(tree))
	}
}

// Test Density parameter
func TestGenerateTree_Density(t *testing.T) {
	rng1 := NewGoRNG(303)
	rng2 := NewGoRNG(303) // Same seed for comparison

	// Low density
	cfgSparse := main.GenerateTreeConfig{
		NodeCount:    0,
		MaxDepth:     6,
		MaxBranching: 4,
		MinBranching: 1,
		ShapeBias:    0.0,
		Density:      0.2, // Low density
		RootBranches: 2,
		LeafRatio:    0.0,
	}

	// High density
	cfgDense := main.GenerateTreeConfig{
		NodeCount:    0,
		MaxDepth:     6,
		MaxBranching: 4,
		MinBranching: 1,
		ShapeBias:    0.0,
		Density:      0.9, // High density
		RootBranches: 2,
		LeafRatio:    0.0,
	}

	sparseTree := main.GenerateTree(cfgSparse, rng1)
	denseTree := main.GenerateTree(cfgDense, rng2)

	// Dense tree should have more nodes
	if countNodes(denseTree) <= countNodes(sparseTree) {
		t.Errorf("Dense tree (%d nodes) should have more nodes than sparse tree (%d nodes)",
			countNodes(denseTree), countNodes(sparseTree))
	}
}

// Test constraint priority: NodeCount > MaxDepth > Branching
func TestGenerateTree_ConstraintPriority(t *testing.T) {
	rng := NewGoRNG(404)

	cfg := main.GenerateTreeConfig{
		NodeCount:    5,  // Very small limit
		MaxDepth:     10, // Large depth
		MaxBranching: 5,  // Large branching
		MinBranching: 3,  // Large min branching
		ShapeBias:    0.0,
		Density:      1.0, // Maximum density
		RootBranches: 0,
		LeafRatio:    0.0,
	}

	tree := main.GenerateTree(cfg, rng)

	// NodeCount should be respected above all else
	if countNodes(tree) != cfg.NodeCount {
		t.Errorf("NodeCount constraint violated: expected %d, got %d", cfg.NodeCount, countNodes(tree))
	}
}

// Test edge cases
func TestGenerateTree_EdgeCases(t *testing.T) {
	rng := NewGoRNG(505)

	// Single node tree
	cfg := main.GenerateTreeConfig{
		NodeCount:    1,
		MaxDepth:     1,
		MaxBranching: 0,
		MinBranching: 0,
		ShapeBias:    0.0,
		Density:      0.0,
		RootBranches: 0,
		LeafRatio:    0.0,
	}

	tree := main.GenerateTree(cfg, rng)

	if countNodes(tree) != 1 {
		t.Errorf("Single node tree should have exactly 1 node, got %d", countNodes(tree))
	}

	if getMaxDepth(tree) != 1 {
		t.Errorf("Single node tree should have depth 1, got %d", getMaxDepth(tree))
	}
}

// Test branching limits
func TestGenerateTree_BranchingLimits(t *testing.T) {
	rng := NewGoRNG(606)

	cfg := main.GenerateTreeConfig{
		NodeCount:    15, // Reduced to match tree structure: 1 root + 2 children + 4 grandchildren + 8 great-grandchildren = 15
		MaxDepth:     4,
		MaxBranching: 2,
		MinBranching: 2, // Force exactly 2 children per node
		ShapeBias:    0.0,
		Density:      1.0, // Always branch
		RootBranches: 2,
		LeafRatio:    0.0,
	}

	tree := main.GenerateTree(cfg, rng)

	// Check that branching limits are respected
	// This is complex to verify precisely, but basic checks
	if countNodes(tree) != cfg.NodeCount {
		t.Errorf("Expected %d nodes, got %d", cfg.NodeCount, countNodes(tree))
	}

	if countRootChildren(tree) != cfg.RootBranches {
		t.Errorf("Expected %d root children, got %d", cfg.RootBranches, countRootChildren(tree))
	}
}
