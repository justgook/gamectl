package minimap

import (
	"github.com/justgook/gamectl/pkg/tree"
)

// Stage2 compresses the layout by moving children toward their parents
// to minimize path tiles (empty space between rooms).
// Uses a halving approach: try to move by half the distance, if invalid,
// halve again until reaching 1 tile, then try 1 tile at a time.
// Modifies shapes[] in place.
func Stage2(
	treeInput *tree.Tree,
	shapes []PlacedShape,
) error {
	if len(*treeInput) <= 1 {
		return nil // nothing to compact
	}

	// Build helper structures
	_, childrenMap, maxDepth := buildDepthMap(treeInput)

	// Process level by level (BFS order)
	// For each level, keep iterating until no more compaction possible
	for depth := 1; depth <= maxDepth; depth++ {
		compactLevel(depth, treeInput, shapes, childrenMap)
	}

	return nil
}

// compactLevel compacts all nodes at a given depth level
// Iterates until no node can be moved closer to its parent
func compactLevel(
	depth int,
	treeInput *tree.Tree,
	shapes []PlacedShape,
	childrenMap map[int][]int,
) {
	// Get all nodes at this depth
	nodesAtDepth := getNodesAtDepth(treeInput, depth)

	// Keep compacting until no changes (with max iterations as safety)
	maxIterations := 100
	for iteration := 0; iteration < maxIterations; iteration++ {
		anyMoved := false

		for _, nodeIndex := range nodesAtDepth {
			parentIndex := (*treeInput)[nodeIndex].ParentId
			if parentIndex == -1 {
				continue
			}

			moved := compactNode(nodeIndex, parentIndex, treeInput, shapes, childrenMap)
			if moved {
				anyMoved = true
			}
		}

		if !anyMoved {
			break
		}
	}
}

// getNodesAtDepth returns all node indices at a specific depth
func getNodesAtDepth(treeInput *tree.Tree, targetDepth int) []int {
	depthMap, _, _ := buildDepthMap(treeInput)
	return depthMap[targetDepth]
}

// compactNode tries to move a node (and its subtree) toward its parent
// using halving approach: try half distance, halve again if invalid, down to 1 tile
// Returns true if any movement was made
func compactNode(
	nodeIndex, parentIndex int,
	treeInput *tree.Tree,
	shapes []PlacedShape,
	childrenMap map[int][]int,
) bool {
	// Calculate direction vector from child center toward parent center
	childCenter := getShapeCenter(shapes[nodeIndex])
	parentCenter := getShapeCenter(shapes[parentIndex])

	dx := parentCenter[0] - childCenter[0]
	dy := parentCenter[1] - childCenter[1]

	// Current distance (use max of dx/dy for grid-aligned movement)
	absDx := abs(dx)
	absDy := abs(dy)

	// If already adjacent, nothing to compact
	if absDx <= 1 && absDy <= 1 {
		return false
	}

	// Calculate current gap (distance minus room sizes along movement axis)
	currentGap := calculateGap(shapes[nodeIndex], shapes[parentIndex], dx, dy)
	if currentGap <= 0 {
		return false // already touching or overlapping
	}

	// Try halving approach: start with half the gap, halve until 1
	moveAmount := currentGap / 2
	if moveAmount < 1 {
		moveAmount = 1
	}

	totalMoved := 0

	for moveAmount >= 1 {
		// Calculate offset for this move amount (along the direction vector)
		offset := calculateMoveOffset(dx, dy, moveAmount)

		// Validate this movement
		if isValidMove(nodeIndex, offset, treeInput, shapes, childrenMap) {
			// Apply the move
			moveSubtree(nodeIndex, offset, shapes, childrenMap)
			totalMoved += moveAmount

			// Update direction for next iteration
			childCenter = getShapeCenter(shapes[nodeIndex])
			dx = parentCenter[0] - childCenter[0]
			dy = parentCenter[1] - childCenter[1]

			// Recalculate gap
			currentGap = calculateGap(shapes[nodeIndex], shapes[parentIndex], dx, dy)
			if currentGap <= 0 {
				break
			}

			// Try same move amount again (might have more room)
			continue
		}

		// Can't move by this amount, try smaller
		moveAmount /= 2
	}

	// Try single tile movements
	for {
		offset := calculateMoveOffset(dx, dy, 1)
		if offset[0] == 0 && offset[1] == 0 {
			break
		}

		if !isValidMove(nodeIndex, offset, treeInput, shapes, childrenMap) {
			break
		}

		moveSubtree(nodeIndex, offset, shapes, childrenMap)
		totalMoved++

		// Update direction
		childCenter = getShapeCenter(shapes[nodeIndex])
		dx = parentCenter[0] - childCenter[0]
		dy = parentCenter[1] - childCenter[1]

		currentGap = calculateGap(shapes[nodeIndex], shapes[parentIndex], dx, dy)
		if currentGap <= 0 {
			break
		}
	}

	return totalMoved > 0
}

// getShapeCenter returns the center point of a shape
func getShapeCenter(shape PlacedShape) Point {
	return Point{
		shape.Position[0] + shape.Width/2,
		shape.Position[1] + shape.Height/2,
	}
}

// calculateGap returns the distance between two shapes along the movement axis
func calculateGap(child, parent PlacedShape, dx, dy int) int {
	// Determine primary movement axis
	absDx := abs(dx)
	absDy := abs(dy)

	if absDx >= absDy {
		// Moving primarily horizontally
		if dx > 0 {
			// Child is left of parent, gap is parent.left - child.right
			childRight := child.Position[0] + child.Width
			return parent.Position[0] - childRight
		}
		// Child is right of parent
		parentRight := parent.Position[0] + parent.Width
		return child.Position[0] - parentRight
	}

	// Moving primarily vertically
	if dy > 0 {
		// Child is above parent, gap is parent.top - child.bottom
		childBottom := child.Position[1] + child.Height
		return parent.Position[1] - childBottom
	}
	// Child is below parent
	parentBottom := parent.Position[1] + parent.Height
	return child.Position[1] - parentBottom
}

// calculateMoveOffset returns the offset to move by given amount toward parent
func calculateMoveOffset(dx, dy, amount int) Point {
	absDx := abs(dx)
	absDy := abs(dy)

	if absDx == 0 && absDy == 0 {
		return Point{0, 0}
	}

	// Move along the dominant axis
	if absDx >= absDy {
		if dx > 0 {
			return Point{amount, 0}
		}
		return Point{-amount, 0}
	}

	if dy > 0 {
		return Point{0, amount}
	}
	return Point{0, -amount}
}

// isValidMove checks if moving nodeIndex by offset is valid:
// 1. No room overlaps with any other room
// 2. Path from node to parent still possible
// 3. Paths from node's children to node still possible
func isValidMove(
	nodeIndex int,
	offset Point,
	treeInput *tree.Tree,
	shapes []PlacedShape,
	childrenMap map[int][]int,
) bool {
	// Create temporary shapes with subtree moved
	tempShapes := cloneShapes(shapes)
	moveSubtree(nodeIndex, offset, tempShapes, childrenMap)

	// Check 1: No room overlaps
	if hasAnyOverlap(tempShapes) {
		return false
	}

	// Build grid from temp shapes for pathfinding
	grid := BuildGridFromShapes(tempShapes)

	// Check 2: Path from node to parent exists
	parentIndex := (*treeInput)[nodeIndex].ParentId
	if !pathExists(grid, nodeIndex+1, parentIndex+1) {
		return false
	}

	// Check 3: Paths from each child to node exist
	for _, childIndex := range childrenMap[nodeIndex] {
		if !pathExists(grid, childIndex+1, nodeIndex+1) {
			return false
		}
	}

	// Note: Path crossing validation is implicitly handled by:
	// - Stage3 which enforces that paths from different parents don't overlap
	// - The fact that we're only moving toward parent, not sideways
	// - Rooms don't overlap (checked above), so paths have clear corridors

	return true
}

// cloneShapes creates a deep copy of shapes slice
func cloneShapes(shapes []PlacedShape) []PlacedShape {
	result := make([]PlacedShape, len(shapes))
	for i, s := range shapes {
		result[i] = PlacedShape{
			Points:   append([]Point(nil), s.Points...),
			Position: s.Position,
			Width:    s.Width,
			Height:   s.Height,
		}
	}
	return result
}

// moveSubtree translates a node and all its descendants by offset
func moveSubtree(
	nodeIndex int,
	offset Point,
	shapes []PlacedShape,
	childrenMap map[int][]int,
) {
	// Move this node
	shapes[nodeIndex].Position[0] += offset[0]
	shapes[nodeIndex].Position[1] += offset[1]

	// Recursively move all descendants
	for _, childIndex := range childrenMap[nodeIndex] {
		moveSubtree(childIndex, offset, shapes, childrenMap)
	}
}

// hasAnyOverlap checks if any two shapes in the slice overlap
func hasAnyOverlap(shapes []PlacedShape) bool {
	// Build a set of all occupied points
	occupied := make(map[Point]int) // point -> shapeIndex

	for i, shape := range shapes {
		for _, relPoint := range shape.Points {
			worldPoint := Point{
				shape.Position[0] + relPoint[0],
				shape.Position[1] + relPoint[1],
			}
			if existingIdx, exists := occupied[worldPoint]; exists {
				if existingIdx != i {
					return true // overlap found
				}
			}
			occupied[worldPoint] = i
		}
	}

	return false
}

// pathExists checks if a path exists between two shapes (fast version)
// Uses BFS which is simpler and often faster than A* for existence check
func pathExists(grid *Grid, fromShapeID, toShapeID int) bool {
	// Get edge tiles of both shapes
	fromEdges := getShapeEdgeTiles(grid, fromShapeID)
	toEdges := getShapeEdgeTiles(grid, toShapeID)

	if len(fromEdges) == 0 || len(toEdges) == 0 {
		return false
	}

	// Create target set
	targetSet := make(map[Point]bool)
	for _, p := range toEdges {
		targetSet[p] = true
	}

	// BFS from all fromEdges neighbors
	visited := make(map[Point]bool)
	queue := make([]Point, 0)

	// Start with neighbors of from edges (not the shape tiles themselves)
	for _, start := range fromEdges {
		neighbors := []Point{
			{start[0] + 1, start[1]},
			{start[0] - 1, start[1]},
			{start[0], start[1] + 1},
			{start[0], start[1] - 1},
		}

		for _, n := range neighbors {
			// Check if we immediately reached target
			if targetSet[n] {
				return true
			}

			// Skip if occupied by anything other than target shape
			if id, exists := (*grid)[n]; exists && id != toShapeID {
				continue
			}

			// Only empty tiles are valid path candidates
			if _, exists := (*grid)[n]; exists {
				continue
			}

			if !visited[n] {
				visited[n] = true
				queue = append(queue, n)
			}
		}
	}

	// BFS
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		neighbors := []Point{
			{current[0] + 1, current[1]},
			{current[0] - 1, current[1]},
			{current[0], current[1] + 1},
			{current[0], current[1] - 1},
		}

		for _, n := range neighbors {
			if visited[n] {
				continue
			}

			// Check if reached target
			if targetSet[n] {
				return true
			}

			// Skip if occupied
			if _, exists := (*grid)[n]; exists {
				continue
			}

			visited[n] = true
			queue = append(queue, n)
		}
	}

	return false
}

// abs returns absolute value of an integer
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
