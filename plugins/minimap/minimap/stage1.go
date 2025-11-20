package minimap

import (
	"github.com/justgook/gamectl/pkg/tree"
)

// Stage1 implements linear hierarchical layout with top-aligned rows
// and parent-child horizontal centering
func Stage1(rng Random,
	treeInput *tree.Tree,
	getRoomShape GetRoomShapeFunc,
	grid *Grid,
) {
	if len(*treeInput) == 0 {
		return
	}

	// 1. Find root and analyze tree structure
	root := GetRootNode(treeInput)

	// 2. Calculate positions for all nodes level by level
	positions := make(map[*tree.Node]Point)
	maxDepth := GetTreeDepth(treeInput, root)

	// Debug: Print tree structure
	// fmt.Printf("Tree depth: %d, Root index: %d\n", maxDepth, treeInput.IndexOf(root))

	// 3. Place root at origin (0,0) with top edge alignment
	rootShape := getRoomShape(root)
	_, rootMinY, _, _ := GetBoundingBox(rootShape)
	rootPos := Point{0, -rootMinY} // Adjust so top edge is at Y=0
	positions[root] = rootPos

	// 4. Process each level from top to bottom
	for level := 1; level <= maxDepth; level++ {
		nodesAtLevel := GetNodesAtLevel(treeInput, root, level)
		if len(nodesAtLevel) == 0 {
			continue
		}

		// Group nodes by their parent to process sibling groups together
		parentGroups := make(map[*tree.Node][]*tree.Node)
		for _, node := range nodesAtLevel {
			parent := treeInput.Parent(node)
			if parent != nil {
				parentGroups[parent] = append(parentGroups[parent], node)
			}
		}

		// Debug: Print parent groups for this level
		// fmt.Printf("Level %d parent groups:\n", level)
		// for parent, children := range parentGroups {
		//     parentIndex := treeInput.IndexOf(parent)
		//     childIndices := make([]int, len(children))
		//     for i, child := range children {
		//         childIndices[i] = treeInput.IndexOf(child)
		//     }
		//     fmt.Printf("  Parent %d → children %v\n", parentIndex, childIndices)
		// }

		// Process each parent's children as a group
		for parent, children := range parentGroups {
			// Calculate the horizontal span needed for all children
			totalWidth := 0
			for _, child := range children {
				shape := getRoomShape(child)
				totalWidth += GetShapeWidth(shape) + NodeSpacing
			}
			if totalWidth > 0 {
				totalWidth -= NodeSpacing // remove last spacing
			}

			// Center the children group under the parent
			parentPos := positions[parent]
			parentShape := getRoomShape(parent)
			parentWidth := GetShapeWidth(parentShape)

			// Start position for children (leftmost position)
			startX := parentPos[0] + parentWidth/2 - totalWidth/2

			// Position each child
			currentX := startX
			for _, child := range children {
				shape := getRoomShape(child)
				_, shapeMinY, _, _ := GetBoundingBox(shape)

				// Top-align: place shape so its top edge is at level Y
				levelY := level * LevelSpacing
				childPos := Point{currentX, levelY - shapeMinY}
				positions[child] = childPos

				currentX += GetShapeWidth(shape) + NodeSpacing
			}
		}
	}

	// 5. Place all shapes on the grid
	for node, position := range positions {
		shape := getRoomShape(node)
		roomID := treeInput.IndexOf(node) // Use node index directly (0-based)
		PlaceShapeOnGrid(grid, shape, position, roomID)
	}
}
