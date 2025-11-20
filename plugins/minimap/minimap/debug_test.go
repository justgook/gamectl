package minimap

import (
	"fmt"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

// TestActualTreeDebug tests with the exact tree structure from your data
func TestActualTreeDebug(t *testing.T) {
	// Create the exact tree from your data: [{"parent":-1},{"parent":0},{"parent":0},{"parent":2},{"parent":2},{"parent":3},{"parent":5},{"parent":3},{"parent":5},{"parent":7}]
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

	// Test with different shape sizes to match your actual data
	shapeFunc := func(node *tree.Node) RoomShape {
		nodeIndex := treeInput.IndexOf(node)
		switch nodeIndex {
		case 0: // Root - larger room
			return RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}}
		case 8: // Node 8 - larger room (based on your tilemap)
			return RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}}
		case 9: // Node 9 - larger room
			return RoomShape{{0, 0}, {1, 0}, {2, 0}, {0, 1}, {1, 1}, {2, 1}}
		default:
			return RoomShape{{0, 0}} // Simple 1x1 for others
		}
	}

	rng := NewMockRandom()
	grid := &Grid{}

	fmt.Println("=== Debugging Actual Tree Layout ===")
	fmt.Printf("Tree structure:\n")
	for i, node := range *treeInput {
		fmt.Printf("  Node %d: parent=%d\n", i, node.ParentId)
	}

	// Print parent-child relationships
	fmt.Printf("\nParent-child relationships:\n")
	for i := range *treeInput {
		children := make([]int, 0)
		for j, child := range *treeInput {
			if child.ParentId == i {
				children = append(children, j)
			}
		}
		fmt.Printf("  Node %d → children: %v\n", i, children)
	}

	// Calculate and print levels
	fmt.Printf("\nCalculated levels:\n")
	for i, node := range *treeInput {
		level := GetNodeLevel(treeInput, node)
		fmt.Printf("  Node %d: level=%d\n", i, level)
	}

	// Print expected level groupings
	fmt.Printf("\nLevel groupings:\n")
	root := GetRootNode(treeInput)
	maxDepth := GetTreeDepth(treeInput, root)
	for level := 0; level <= maxDepth; level++ {
		nodes := GetNodesAtLevel(treeInput, root, level)
		nodeIndices := make([]int, len(nodes))
		for i, node := range nodes {
			nodeIndices[i] = treeInput.IndexOf(node)
		}
		fmt.Printf("  Level %d: nodes %v\n", level, nodeIndices)
	}

	// Run Stage1
	Stage1(rng, treeInput, shapeFunc, grid)

	// Print detailed results
	fmt.Printf("\nDetailed grid contents:\n")
	for point, roomID := range *grid {
		fmt.Printf("  [%2d,%2d] -> Room %d (Node %d)\n", point[0], point[1], roomID, roomID)
	}

	// Analyze spacing issues
	fmt.Printf("\nSpacing analysis:\n")
	for level := 1; level <= maxDepth; level++ {
		nodes := GetNodesAtLevel(treeInput, root, level)
		if len(nodes) <= 1 {
			continue
		}

		fmt.Printf("  Level %d spacing:\n", level)
		positions := make(map[int]Point)
		for _, node := range nodes {
			nodeIndex := treeInput.IndexOf(node)
			for point, roomID := range *grid {
				if roomID == nodeIndex {
					positions[nodeIndex] = point
					break
				}
			}
		}

		// Check spacing between siblings
		for i := 0; i < len(nodes)-1; i++ {
			node1Index := treeInput.IndexOf(nodes[i])
			node2Index := treeInput.IndexOf(nodes[i+1])
			if pos1, ok1 := positions[node1Index]; ok1 {
				if pos2, ok2 := positions[node2Index]; ok2 {
					spacing := abs(pos2[0] - pos1[0])
					fmt.Printf("    Node %d to Node %d: %d units\n", node1Index, node2Index, spacing)
				}
			}
		}
	}

	// Convert to tilemap format for comparison
	data, width := Grid2Tilemap(grid)
	fmt.Printf("\nTilemap data (width=%d): %v\n", width, data)
}

// abs returns absolute value
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
