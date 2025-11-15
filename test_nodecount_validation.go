package main

import (
	"fmt"
	"math/rand"

	"github.com/justgook/gamectl/pkg/minimap"
	"github.com/justgook/gamectl/pkg/tree3"
	"github.com/justgook/gamectl/plugins/minimap2/minimap2"
	"github.com/justgook/gamectl/plugins/treegen/treegen"
)

// ------------------------------------------------------------
// Test RNG implementation using math/rand
// ------------------------------------------------------------

type TestRNG struct {
	*rand.Rand
}

func NewTestRNG(seed int64) *TestRNG {
	return &TestRNG{rand.New(rand.NewSource(seed))}
}

func (r *TestRNG) Intn(n int) int {
	return r.Rand.Intn(n)
}

func (r *TestRNG) Float64() float64 {
	return r.Rand.Float64()
}

// ------------------------------------------------------------
// Utility functions
// ------------------------------------------------------------

// countTreeNodes returns the number of nodes in a tree
func countTreeNodes(tree tree3.Tree) int {
	return len(tree)
}

// countRoomsInTilemap attempts to count rooms by analyzing tilemap data
// This is a heuristic approach since we're doing black-box testing
func countRoomsInTilemap(tilemap *minimap.TileMap) int {
	if tilemap == nil || len(tilemap.Layers) < 2 {
		return 0
	}

	// Layer 0 = doors, Layer 1 = rooms
	// Count non-zero tiles in the rooms layer (Layer 1)
	nonZeroTiles := 0
	for _, tileValue := range tilemap.Layers[1].Data {
		if tileValue != 0 {
			nonZeroTiles++
		}
	}

	return nonZeroTiles
}

// getSimpleRoomShape provides a simple 1x1 room shape for testing
func getSimpleRoomShape(*tree3.Node) minimap.RoomShape {
	return []minimap.Coordinate{{0, 0}}
}

// ------------------------------------------------------------
// Test execution
// ------------------------------------------------------------

type TestResult struct {
	Name        string
	Success     bool
	TreeNodes   int
	RoomsPlaced int
	Error       error
	Match       bool
}

func runTest(name string, seed int64, treeConfig treegen.GenerateTreeConfig, minimapConfig minimap2.GenerateMinimapConfig) TestResult {
	result := TestResult{Name: name}

	// Create RNG instances with same seed for deterministic comparison
	treeRNG := NewTestRNG(seed)
	minimapRNG := NewTestRNG(seed)

	// Generate tree
	tree := treegen.GenerateTree(treeConfig, treeRNG)
	result.TreeNodes = countTreeNodes(tree)

	// Generate minimap
	tilemap, err := minimap2.GenerateMinimap(tree, minimapConfig, minimapRNG, getSimpleRoomShape)
	if err != nil {
		result.Error = err
		return result
	}

	result.Success = true
	result.RoomsPlaced = countRoomsInTilemap(tilemap)
	result.Match = (result.TreeNodes == result.RoomsPlaced)

	return result
}

func printResult(result TestResult) {
	status := "❌ FAIL"
	if result.Success {
		if result.Match {
			status = "✅ PASS"
		} else {
			status = "⚠️  MISMATCH"
		}
	}

	fmt.Printf("  %s: %s", result.Name, status)

	if result.Success {
		fmt.Printf(" (tree: %d, rooms: %d)", result.TreeNodes, result.RoomsPlaced)
		if !result.Match {
			diff := result.TreeNodes - result.RoomsPlaced
			fmt.Printf(" [diff: %+d]", diff)
		}
	} else {
		fmt.Printf(" - Error: %v", result.Error)
	}

	fmt.Println()
}

func main() {
	fmt.Println("🧪 Minimap2 Node Count Validation Test")
	fmt.Println("======================================")
	fmt.Println()

	// Define test cases
	tests := []struct {
		name          string
		seed          int64
		treeConfig    treegen.GenerateTreeConfig
		minimapConfig minimap2.GenerateMinimapConfig
	}{
		{
			name: "Small tree (10 nodes)",
			seed: 12345,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    10,
				MaxDepth:     4,
				MaxBranching: 3,
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 20,
				RandomSeed:        12345,
			},
		},
		{
			name: "Medium tree (25 nodes)",
			seed: 54321,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    25,
				MaxDepth:     5,
				MaxBranching: 4,
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 20,
				RandomSeed:        54321,
			},
		},
		{
			name: "Large tree (50 nodes)",
			seed: 98765,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    50,
				MaxDepth:     6,
				MaxBranching: 5,
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 25,
				RandomSeed:        98765,
			},
		},
		{
			name: "High branching (8 branches)",
			seed: 11111,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    20,
				MaxDepth:     4,
				MaxBranching: 8, // High branching factor
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 30,
				RandomSeed:        11111,
			},
		},
		{
			name: "Deep tree (depth 8)",
			seed: 22222,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    20,
				MaxDepth:     8, // Deep tree
				MaxBranching: 2, // Low branching
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 25,
				RandomSeed:        22222,
			},
		},
		{
			name: "Unlimited mode",
			seed: 33333,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    0, // Unlimited mode
				MaxDepth:     5,
				MaxBranching: 4,
				Density:      2.0, // Density parameter
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 20,
				RandomSeed:        33333,
			},
		},
	}

	// Run basic tests
	fmt.Println("🔍 Basic Test Cases:")
	var totalTests, passedTests, failedTests, mismatchedTests int

	for _, test := range tests {
		result := runTest(test.name, test.seed, test.treeConfig, test.minimapConfig)
		printResult(result)

		totalTests++
		if result.Success {
			if result.Match {
				passedTests++
			} else {
				mismatchedTests++
			}
		} else {
			failedTests++
		}
	}

	fmt.Println()

	// Run consistency tests with multiple seeds
	fmt.Println("🔍 Consistency Test (Multiple Seeds):")
	baseConfig := treegen.GenerateTreeConfig{
		NodeCount:    15,
		MaxDepth:     4,
		MaxBranching: 3,
	}

	var consistencyPassed, consistencyFailed, consistencyMismatched int
	seedCount := 5

	for i := 0; i < seedCount; i++ {
		seed := int64(50000 + i)
		minimapConfig := minimap2.GenerateMinimapConfig{
			MaxExtensionDepth: 20,
			RandomSeed:        int(seed),
		}

		name := fmt.Sprintf("Consistency seed %d", seed)
		result := runTest(name, seed, baseConfig, minimapConfig)
		printResult(result)

		if result.Success {
			if result.Match {
				consistencyPassed++
			} else {
				consistencyMismatched++
			}
		} else {
			consistencyFailed++
		}
	}

	// Summary
	fmt.Println()
	fmt.Println("📊 Test Summary:")
	fmt.Printf("  Basic tests: %d total, %d passed, %d failed, %d mismatched\n",
		totalTests, passedTests, failedTests, mismatchedTests)
	fmt.Printf("  Consistency tests: %d passed, %d failed, %d mismatched\n",
		consistencyPassed, consistencyFailed, consistencyMismatched)

	// Analysis
	fmt.Println()
	fmt.Println("🔍 Analysis:")

	if failedTests > 0 || consistencyFailed > 0 {
		fmt.Printf("  ⚠️  Generation failures detected - minimap2 has critical issues\n")
	}

	if mismatchedTests > 0 || consistencyMismatched > 0 {
		fmt.Printf("  ⚠️  Node count mismatches detected - rooms are not being placed correctly\n")
		fmt.Printf("     This could indicate:\n")
		fmt.Printf("     - Rooms being placed multiple times (more rooms than nodes)\n")
		fmt.Printf("     - Rooms failing to place (fewer rooms than nodes)\n")
		fmt.Printf("     - Issues in room counting logic\n")
	}

	if failedTests == 0 && consistencyFailed == 0 &&
		mismatchedTests == 0 && consistencyMismatched == 0 {
		fmt.Printf("  ✅ All tests passed! Node count validation successful.\n")
	}

	fmt.Println()
	fmt.Println("🎯 Test completed! Use results to identify minimap2 refactoring priorities.")
}
