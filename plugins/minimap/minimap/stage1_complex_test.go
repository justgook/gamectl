package minimap

import (
	"fmt"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

// TestStage1ComplexTree tests with the original complex tree structure
func TestStage1ComplexTree(t *testing.T) {
	// Create the original complex tree: [{"parent":-1},{"parent":0},{"parent":0},{"parent":2},{"parent":2},{"parent":3},{"parent":5},{"parent":3},{"parent":5},{"parent":7}]
	treeInput := &tree.Tree{
		&tree.Node{ParentId: -1}, // Node 0: root
		&tree.Node{ParentId: 0},  // Node 1: child of 0
		&tree.Node{ParentId: 0},  // Node 2: child of 0
		&tree.Node{ParentId: 2},  // Node 3: child of 2
		&tree.Node{ParentId: 2},  // Node 4: child of 2
		&tree.Node{ParentId: 3},  // Node 5: child of 3
		&tree.Node{ParentId: 5},  // Node 6: child of 5
		&tree.Node{ParentId: 3},  // Node 7: child of 3
		&tree.Node{ParentId: 5},  // Node 8: child of 5
		&tree.Node{ParentId: 7},  // Node 9: child of 7
	}

	rng := NewMockRandom()
	grid := &Grid{}

	fmt.Println("=== Testing Stage1 Complex Tree Layout ===")
	fmt.Printf("Input tree structure:\n")
	for i, node := range *treeInput {
		fmt.Printf("  Node %d: parent=%d\n", i, node.ParentId)
	}

	// Calculate and print levels
	fmt.Printf("\nCalculated levels:\n")
	for i, node := range *treeInput {
		level := GetNodeLevel(treeInput, node)
		fmt.Printf("  Node %d: level=%d\n", i, level)
	}

	// Run Stage1
	Stage1(rng, treeInput, Simple1x1Shape, grid)

	// Print results
	fmt.Printf("\nGrid contents (Point -> RoomID):\n")
	for point, roomID := range *grid {
		fmt.Printf("  [%d,%d] -> Room %d (Node %d)\n", point[0], point[1], roomID, roomID)
	}

	// Verify all 10 nodes are placed
	if len(*grid) != 10 {
		t.Errorf("Expected 10 nodes to be placed on grid, got %d", len(*grid))
	}

	// Verify no overlapping positions
	positions := make(map[Point]bool)
	for point := range *grid {
		if positions[point] {
			t.Errorf("Overlapping position detected at %v", point)
		}
		positions[point] = true
	}

	// Verify hierarchical structure (nodes at higher levels have higher Y coordinates)
	fmt.Printf("\nHierarchical verification:\n")
	for i, node := range *treeInput {
		level := GetNodeLevel(treeInput, node)
		roomID := i // Room ID = node index

		for point, gridRoomID := range *grid {
			if gridRoomID == roomID {
				expectedY := level * LevelSpacing
				if point[1] != expectedY {
					t.Errorf("Node %d (level %d) expected Y=%d, got Y=%d", i, level, expectedY, point[1])
				} else {
					fmt.Printf("  ✓ Node %d (level %d) correctly at Y=%d\n", i, level, point[1])
				}
				break
			}
		}
	}

	fmt.Printf("\n=== Complex Tree Test Complete ===\n")
}
