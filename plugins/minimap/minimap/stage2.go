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
// Detects oscillations by tracking position history
func compactLevel(
	depth int,
	treeInput *tree.Tree,
	shapes []PlacedShape,
	childrenMap map[int][]int,
) {
	// Get all nodes at this depth
	nodesAtDepth := getNodesAtDepth(treeInput, depth)

	// Track position history to detect oscillations
	// Key: node index, Value: set of positions seen
	positionHistory := make(map[int]map[Point]bool)
	for _, nodeIndex := range nodesAtDepth {
		positionHistory[nodeIndex] = make(map[Point]bool)
	}

	// Keep compacting until no changes (with max iterations as safety)
	maxIterations := len(nodesAtDepth) * 10 // proportional to number of nodes
	if maxIterations < 20 {
		maxIterations = 20
	}
	if maxIterations > 100 {
		maxIterations = 100
	}

	for iteration := 0; iteration < maxIterations; iteration++ {
		anyMoved := false

		for _, nodeIndex := range nodesAtDepth {
			parentIndex := (*treeInput)[nodeIndex].ParentId
			if parentIndex == -1 {
				continue
			}

			// Check for oscillation - if we've seen this position before, skip
			currentPos := shapes[nodeIndex].Position
			if positionHistory[nodeIndex][currentPos] {
				continue // already tried from this position, skip to avoid oscillation
			}
			positionHistory[nodeIndex][currentPos] = true

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
// Tries vertical movement first, then horizontal if vertical not possible
// Returns true if any movement was made
func compactNode(
	nodeIndex, parentIndex int,
	treeInput *tree.Tree,
	shapes []PlacedShape,
	childrenMap map[int][]int,
) bool {
	// Try vertical compaction first (most common for hierarchical layouts)
	if tryCompactAxis(nodeIndex, parentIndex, treeInput, shapes, childrenMap, true) {
		return true
	}

	// Then try horizontal
	return tryCompactAxis(nodeIndex, parentIndex, treeInput, shapes, childrenMap, false)
}

// tryCompactAxis attempts to compact along a single axis
func tryCompactAxis(
	nodeIndex, parentIndex int,
	treeInput *tree.Tree,
	shapes []PlacedShape,
	childrenMap map[int][]int,
	isVertical bool,
) bool {
	child := shapes[nodeIndex]
	parent := shapes[parentIndex]

	var gap, moveDir int

	if isVertical {
		// Calculate vertical gap
		if child.Position[1] >= parent.Position[1]+parent.Height {
			// Child is below parent
			gap = child.Position[1] - (parent.Position[1] + parent.Height)
			moveDir = -1 // move up
		} else if child.Position[1]+child.Height <= parent.Position[1] {
			// Child is above parent
			gap = parent.Position[1] - (child.Position[1] + child.Height)
			moveDir = 1 // move down
		} else {
			return false // vertically overlapping
		}
	} else {
		// Calculate horizontal gap
		if child.Position[0] >= parent.Position[0]+parent.Width {
			// Child is right of parent
			gap = child.Position[0] - (parent.Position[0] + parent.Width)
			moveDir = -1 // move left
		} else if child.Position[0]+child.Width <= parent.Position[0] {
			// Child is left of parent
			gap = parent.Position[0] - (child.Position[0] + child.Width)
			moveDir = 1 // move right
		} else {
			return false // horizontally overlapping
		}
	}

	if gap <= 0 {
		return false
	}

	// Try halving approach
	moveAmount := gap / 2
	if moveAmount < 1 {
		moveAmount = 1
	}

	totalMoved := 0

	for moveAmount >= 1 {
		var offset Point
		if isVertical {
			offset = Point{0, moveDir * moveAmount}
		} else {
			offset = Point{moveDir * moveAmount, 0}
		}

		if isValidMove(nodeIndex, offset, treeInput, shapes, childrenMap) {
			moveSubtree(nodeIndex, offset, shapes, childrenMap)
			totalMoved += moveAmount

			// Recalculate gap
			child = shapes[nodeIndex]
			if isVertical {
				if moveDir == -1 {
					gap = child.Position[1] - (parent.Position[1] + parent.Height)
				} else {
					gap = parent.Position[1] - (child.Position[1] + child.Height)
				}
			} else {
				if moveDir == -1 {
					gap = child.Position[0] - (parent.Position[0] + parent.Width)
				} else {
					gap = parent.Position[0] - (child.Position[0] + child.Width)
				}
			}

			if gap <= 0 {
				break
			}
			continue
		}

		moveAmount /= 2
	}

	// Try single tile movements
	maxSingleMoves := gap + 5
	for singleMoveCount := 0; singleMoveCount < maxSingleMoves; singleMoveCount++ {
		var offset Point
		if isVertical {
			offset = Point{0, moveDir * 1}
		} else {
			offset = Point{moveDir * 1, 0}
		}

		if !isValidMove(nodeIndex, offset, treeInput, shapes, childrenMap) {
			break
		}

		moveSubtree(nodeIndex, offset, shapes, childrenMap)
		totalMoved++

		child = shapes[nodeIndex]
		if isVertical {
			if moveDir == -1 {
				gap = child.Position[1] - (parent.Position[1] + parent.Height)
			} else {
				gap = parent.Position[1] - (child.Position[1] + child.Height)
			}
		} else {
			if moveDir == -1 {
				gap = child.Position[0] - (parent.Position[0] + parent.Width)
			} else {
				gap = parent.Position[0] - (child.Position[0] + child.Width)
			}
		}

		if gap <= 0 {
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
// 2. ALL parent-child paths in the tree still exist
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

	// Check 2: ALL parent-child paths must exist
	// This is more expensive but necessary to prevent blocking cousin paths
	for i := 1; i < len(*treeInput); i++ {
		parentIndex := (*treeInput)[i].ParentId
		if !pathExists(grid, i+1, parentIndex+1) {
			return false
		}
	}

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

	// BFS with search limit
	maxSearchNodes := 5000 // safety limit for path existence check
	nodesSearched := 0

	for len(queue) > 0 {
		nodesSearched++
		if nodesSearched > maxSearchNodes {
			return false // exceeded search limit
		}

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
