package minimap

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

// MockRandom implements the Random interface for deterministic testing
type MockRandom struct {
	*rand.Rand
}

func NewMockRandom() *MockRandom {
	return &MockRandom{rand.New(rand.NewSource(42))}
}

func (m *MockRandom) Intn(n int) int {
	return m.Rand.Intn(n)
}

func (m *MockRandom) Float64() float64 {
	return m.Rand.Float64()
}

// Simple1x1Shape returns a 1x1 square shape for all nodes
func Simple1x1Shape(node *tree.Node) RoomShape {
	return RoomShape{{0, 0}} // Single point at origin
}

// TestStage1LinearTree tests the Stage1 function with a simple linear tree
func TestStage1LinearTree(t *testing.T) {
	// Arrange: Create a simple linear tree
	// [{"parent":-1},{"parent":0},{"parent":1},{"parent":2},{"parent":3}]
	treeInput := &tree.Tree{
		&tree.Node{ParentId: -1}, // Node 0: root
		&tree.Node{ParentId: 0},  // Node 1: child of 0
		&tree.Node{ParentId: 1},  // Node 2: child of 1
		&tree.Node{ParentId: 2},  // Node 3: child of 2
		&tree.Node{ParentId: 3},  // Node 4: child of 3
	}

	rng := NewMockRandom()
	grid := &Grid{}

	fmt.Println("=== Testing Stage1 Linear Tree Layout ===")
	fmt.Printf("Input tree structure:\n")
	for i, node := range *treeInput {
		fmt.Printf("  Node %d: parent=%d\n", i, node.ParentId)
	}

	// Act: Run Stage1 function
	Stage1(rng, treeInput, Simple1x1Shape, grid)

	// Debug: Print calculated levels for each node
	fmt.Printf("\nCalculated levels:\n")
	for i, node := range *treeInput {
		level := GetNodeLevel(treeInput, node)
		fmt.Printf("  Node %d: level=%d\n", i, level)
	}

	// Debug: Print final positions
	fmt.Printf("\nGrid contents (Point -> RoomID):\n")
	for point, roomID := range *grid {
		fmt.Printf("  [%d,%d] -> Room %d (Node %d)\n", point[0], point[1], roomID, roomID)
	}

	// Verify: Check that all 5 nodes are placed
	if len(*grid) != 5 {
		t.Errorf("Expected 5 nodes to be placed on grid, got %d", len(*grid))
	}

	// Verify: Check specific positions and levels
	expectedPositions := map[int]Point{
		0: {0, 0},  // Node 0 (Room 0): root at Y=0
		1: {0, 10}, // Node 1 (Room 1): level 1 at Y=10
		2: {0, 20}, // Node 2 (Room 2): level 2 at Y=20
		3: {0, 30}, // Node 3 (Room 3): level 3 at Y=30
		4: {0, 40}, // Node 4 (Room 4): level 4 at Y=40
	}

	fmt.Printf("\nPosition verification:\n")
	for roomID, expectedPos := range expectedPositions {
		found := false
		for point, actualRoomID := range *grid {
			if actualRoomID == roomID {
				found = true
				if point != expectedPos {
					t.Errorf("Room %d (Node %d) expected at %v, got %v",
						roomID, roomID, expectedPos, point)
				} else {
					fmt.Printf("  ✓ Room %d (Node %d) correctly placed at %v\n",
						roomID, roomID, point)
				}
				break
			}
		}
		if !found {
			t.Errorf("Room %d (Node %d) not found on grid", roomID, roomID)
		}
	}

	// Verify: Check no overlapping positions
	positions := make(map[Point]bool)
	for point := range *grid {
		if positions[point] {
			t.Errorf("Overlapping position detected at %v", point)
		}
		positions[point] = true
	}

	// Verify: Check hierarchical structure (Y coordinates increase with level)
	fmt.Printf("\nHierarchical structure verification:\n")
	for i := 0; i < 4; i++ {
		var currentY, nextY int
		currentFound, nextFound := false, false

		for point, roomID := range *grid {
			if roomID == i {
				currentY = point[1]
				currentFound = true
			}
			if roomID == i+1 {
				nextY = point[1]
				nextFound = true
			}
		}

		if currentFound && nextFound {
			if nextY <= currentY {
				t.Errorf("Node %d (Y=%d) should be above Node %d (Y=%d)",
					i, currentY, i+1, nextY)
			} else {
				fmt.Printf("  ✓ Node %d (Y=%d) correctly above Node %d (Y=%d)\n",
					i, currentY, i+1, nextY)
			}
		}
	}

	// Verify: Check level spacing (should be 10 units apart)
	fmt.Printf("\nLevel spacing verification:\n")
	for i := 0; i < 4; i++ {
		var currentY, nextY int
		currentFound, nextFound := false, false

		for point, roomID := range *grid {
			if roomID == i {
				currentY = point[1]
				currentFound = true
			}
			if roomID == i+1 {
				nextY = point[1]
				nextFound = true
			}
		}

		if currentFound && nextFound {
			spacing := nextY - currentY
			if spacing != LevelSpacing {
				t.Errorf("Expected spacing of %d between levels, got %d (between Node %d and Node %d)",
					LevelSpacing, spacing, i, i+1)
			} else {
				fmt.Printf("  ✓ Correct spacing of %d between Node %d and Node %d\n",
					spacing, i, i+1)
			}
		}
	}

	fmt.Printf("\n=== Test Complete ===\n")
}

// TestStage1EmptyTree tests Stage1 with an empty tree
func TestStage1EmptyTree(t *testing.T) {
	treeInput := &tree.Tree{}
	rng := NewMockRandom()
	grid := &Grid{}

	Stage1(rng, treeInput, Simple1x1Shape, grid)

	if len(*grid) != 0 {
		t.Errorf("Expected empty grid for empty tree, got %d nodes", len(*grid))
	}
}

// TestStage1SingleNode tests Stage1 with a single root node
func TestStage1SingleNode(t *testing.T) {
	treeInput := &tree.Tree{
		&tree.Node{ParentId: -1}, // Single root node
	}
	rng := NewMockRandom()
	grid := &Grid{}

	Stage1(rng, treeInput, Simple1x1Shape, grid)

	if len(*grid) != 1 {
		t.Errorf("Expected 1 node on grid for single node tree, got %d", len(*grid))
	}

	// Check root is at Y=0
	for point, roomID := range *grid {
		if roomID == 0 && point[1] != 0 {
			t.Errorf("Root node should be at Y=0, got Y=%d", point[1])
		}
	}
}

// TestUtilityFunctions tests the helper functions used by Stage1
func TestUtilityFunctions(t *testing.T) {
	// Create test tree
	treeInput := &tree.Tree{
		&tree.Node{ParentId: -1}, // Node 0: root
		&tree.Node{ParentId: 0},  // Node 1: child of 0
		&tree.Node{ParentId: 1},  // Node 2: child of 1
	}

	// Test GetRootNode
	root := GetRootNode(treeInput)
	if root != (*treeInput)[0] {
		t.Errorf("GetRootNode should return first node (root)")
	}

	// Test GetNodeLevel
	levels := []int{0, 1, 2}
	for i, expectedLevel := range levels {
		actualLevel := GetNodeLevel(treeInput, (*treeInput)[i])
		if actualLevel != expectedLevel {
			t.Errorf("Node %d expected level %d, got %d", i, expectedLevel, actualLevel)
		}
	}

	// Test GetTreeDepth
	expectedDepth := 2
	actualDepth := GetTreeDepth(treeInput, root)
	if actualDepth != expectedDepth {
		t.Errorf("Expected tree depth %d, got %d", expectedDepth, actualDepth)
	}

	// Test GetNodesAtLevel
	nodesAtLevel1 := GetNodesAtLevel(treeInput, root, 1)
	if len(nodesAtLevel1) != 1 || nodesAtLevel1[0] != (*treeInput)[1] {
		t.Errorf("Expected 1 node at level 1 (Node 1)")
	}

	// Test shape functions
	shape := Simple1x1Shape(root)
	width := GetShapeWidth(shape)
	height := GetShapeHeight(shape)
	if width != 1 || height != 1 {
		t.Errorf("Expected 1x1 shape, got %dx%d", width, height)
	}
}
