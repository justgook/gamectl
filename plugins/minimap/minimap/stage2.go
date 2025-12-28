package minimap

import (
	"github.com/justgook/gamectl/pkg/tree"
)

// Stage2Result contains the output of the grow-from-parent algorithm
type Stage2Result struct {
	Grid      Grid             // The generated grid (point -> roomID, where roomID is 1-based)
	Doors     []DoorConnection // Door connections between rooms
	RoomTiles map[int][]Point  // For each room ID (1-based), list of tiles
}

// Stage2 grows the minimap from root, placing each child adjacent to its parent.
// This guarantees that every child shares at least one edge with its parent.
// If a child's predefined shape can't fit adjacent to parent, the parent is extended
// with corridor tiles (stored with negative ID internally, converted to parent ID on output).
//
// The algorithm:
// 1. Place root shape at origin
// 2. Process children in BFS order (level by level)
// 3. For each child, find the best position adjacent to parent
// 4. If no valid position exists, extend parent with corridor tiles
func Stage2(treeInput *tree.Tree, shapes []PlacedShape) (*Stage2Result, error) {
	n := len(*treeInput)
	if n == 0 {
		return &Stage2Result{
			Grid:      make(Grid),
			Doors:     nil,
			RoomTiles: make(map[int][]Point),
		}, nil
	}

	result := &Stage2Result{
		Grid:      make(Grid),
		Doors:     nil,
		RoomTiles: make(map[int][]Point),
	}

	// Build children map
	childrenMap := make(map[int][]int)
	for i, node := range *treeInput {
		if node.ParentId != -1 {
			childrenMap[node.ParentId] = append(childrenMap[node.ParentId], i)
		}
	}

	// Place root at origin (nodeIndex 0, roomID 1)
	rootShape := shapes[0]
	placeShapeAt(result, 0, rootShape, Point{0, 0})

	// BFS queue: process nodes level by level
	queue := []int{0}

	for len(queue) > 0 {
		parentIdx := queue[0]
		queue = queue[1:]

		children := childrenMap[parentIdx]
		for _, childIdx := range children {
			queue = append(queue, childIdx)
		}

		// Place all children of this parent
		if len(children) > 0 {
			placeChildrenAdjacentToParent(result, parentIdx, children, shapes, childrenMap)
		}
	}

	return result, nil
}

// placeShapeAt places a shape at the given position in the grid
func placeShapeAt(result *Stage2Result, nodeIdx int, shape PlacedShape, pos Point) {
	roomID := nodeIdx + 1 // 1-based room ID

	for _, relPoint := range shape.Points {
		worldPoint := Point{pos[0] + relPoint[0], pos[1] + relPoint[1]}
		result.Grid[worldPoint] = roomID
		result.RoomTiles[roomID] = append(result.RoomTiles[roomID], worldPoint)
	}
}

// placeChildrenAdjacentToParent places all children of a parent, ensuring each shares an edge
func placeChildrenAdjacentToParent(
	result *Stage2Result,
	parentIdx int,
	children []int,
	shapes []PlacedShape,
	childrenMap map[int][]int,
) {
	parentID := parentIdx + 1

	// Get parent's edge tiles (tiles with at least one empty neighbor)
	parentEdges := getEdgeTiles(result, parentID)

	// For each child, find the best placement
	for _, childIdx := range children {
		childShape := shapes[childIdx]
		childID := childIdx + 1

		// Try to find a valid placement adjacent to parent
		placed := tryPlaceChildAdjacent(result, parentID, childID, childShape, parentEdges)

		if !placed {
			// No valid placement found - need to extend parent with corridor
			extendAndPlaceChild(result, parentIdx, childIdx, childShape, parentEdges, childrenMap)
			// Update parent edges after extension
			parentEdges = getEdgeTiles(result, parentID)
		} else {
			// Placement successful - create door connection
			createDoorConnection(result, childID, parentID)
			// Update parent edges for next child
			parentEdges = getEdgeTiles(result, parentID)
		}
	}
}

// getEdgeTiles returns all tiles of a room that have at least one empty orthogonal neighbor
func getEdgeTiles(result *Stage2Result, roomID int) []Point {
	var edges []Point

	for _, tile := range result.RoomTiles[roomID] {
		neighbors := []Point{
			{tile[0] + 1, tile[1]},
			{tile[0] - 1, tile[1]},
			{tile[0], tile[1] + 1},
			{tile[0], tile[1] - 1},
		}

		for _, n := range neighbors {
			if _, exists := result.Grid[n]; !exists {
				edges = append(edges, tile)
				break
			}
		}
	}

	return edges
}

// getAllRoomTiles returns all tiles belonging to a room (including corridor extensions)
// Used when we need to find ANY edge, not just edges with empty neighbors
func getAllRoomTiles(result *Stage2Result, roomID int) []Point {
	return result.RoomTiles[roomID]
}

// getAnyEdgeTile returns any tile on the edge of the room
// Unlike getEdgeTiles, this considers tiles adjacent to other rooms as edges
func getAnyEdgeTile(result *Stage2Result, roomID int) []Point {
	tiles := result.RoomTiles[roomID]
	if len(tiles) == 0 {
		return nil
	}

	// Find the outermost tiles (those with neighbors not belonging to this room)
	var edges []Point
	for _, tile := range tiles {
		neighbors := []Point{
			{tile[0] + 1, tile[1]},
			{tile[0] - 1, tile[1]},
			{tile[0], tile[1] + 1},
			{tile[0], tile[1] - 1},
		}

		for _, n := range neighbors {
			if id, exists := result.Grid[n]; !exists || id != roomID {
				edges = append(edges, tile)
				break
			}
		}
	}

	if len(edges) == 0 {
		// Fallback: return first tile
		return []Point{tiles[0]}
	}
	return edges
}

// tryPlaceChildAdjacent tries to place child shape adjacent to parent
// Returns true if placement was successful
func tryPlaceChildAdjacent(
	result *Stage2Result,
	parentID int,
	childID int,
	childShape PlacedShape,
	parentEdges []Point,
) bool {
	// For each parent edge tile, try each direction
	directions := []Point{
		{1, 0},  // East
		{-1, 0}, // West
		{0, 1},  // South
		{0, -1}, // North
	}

	type placement struct {
		pos      Point
		adjacent int // number of adjacent tiles to parent (prefer more connection)
	}

	var validPlacements []placement

	for _, parentEdge := range parentEdges {
		for _, dir := range directions {
			// The position where child's "connection point" would be
			connPoint := Point{parentEdge[0] + dir[0], parentEdge[1] + dir[1]}

			// Skip if this point is already occupied
			if _, exists := result.Grid[connPoint]; exists {
				continue
			}

			// Try to place child shape such that one of its tiles is at connPoint
			for _, childRelPoint := range childShape.Points {
				// Calculate position so that childRelPoint aligns with connPoint
				childPos := Point{
					connPoint[0] - childRelPoint[0],
					connPoint[1] - childRelPoint[1],
				}

				// Check if this placement is valid (no overlaps)
				if canPlaceShape(result, childShape, childPos) {
					// Count how many tiles would be adjacent to parent
					adjCount := countAdjacentToRoom(result, childShape, childPos, parentID)
					validPlacements = append(validPlacements, placement{
						pos:      childPos,
						adjacent: adjCount,
					})
				}
			}
		}
	}

	if len(validPlacements) == 0 {
		return false
	}

	// Pick the placement with most adjacent tiles (better connection)
	best := validPlacements[0]
	for _, p := range validPlacements[1:] {
		if p.adjacent > best.adjacent {
			best = p
		}
	}

	// Place the child
	placeShapeAtPos(result, childID, childShape, best.pos)
	return true
}

// canPlaceShape checks if a shape can be placed at the given position without overlapping
func canPlaceShape(result *Stage2Result, shape PlacedShape, pos Point) bool {
	for _, relPoint := range shape.Points {
		worldPoint := Point{pos[0] + relPoint[0], pos[1] + relPoint[1]}
		if _, exists := result.Grid[worldPoint]; exists {
			return false
		}
	}
	return true
}

// countAdjacentToRoom counts how many tiles of a shape would be adjacent to a room
func countAdjacentToRoom(result *Stage2Result, shape PlacedShape, pos Point, roomID int) int {
	count := 0
	for _, relPoint := range shape.Points {
		worldPoint := Point{pos[0] + relPoint[0], pos[1] + relPoint[1]}
		neighbors := []Point{
			{worldPoint[0] + 1, worldPoint[1]},
			{worldPoint[0] - 1, worldPoint[1]},
			{worldPoint[0], worldPoint[1] + 1},
			{worldPoint[0], worldPoint[1] - 1},
		}
		for _, n := range neighbors {
			if result.Grid[n] == roomID {
				count++
				break // Count each shape tile only once
			}
		}
	}
	return count
}

// placeShapeAtPos places a shape at a specific position
func placeShapeAtPos(result *Stage2Result, roomID int, shape PlacedShape, pos Point) {
	for _, relPoint := range shape.Points {
		worldPoint := Point{pos[0] + relPoint[0], pos[1] + relPoint[1]}
		result.Grid[worldPoint] = roomID
		result.RoomTiles[roomID] = append(result.RoomTiles[roomID], worldPoint)
	}
}

// extendAndPlaceChild extends the parent room to reach and place the child
func extendAndPlaceChild(
	result *Stage2Result,
	parentIdx int,
	childIdx int,
	childShape PlacedShape,
	parentEdges []Point,
	childrenMap map[int][]int,
) {
	parentID := parentIdx + 1
	childID := childIdx + 1

	// If parentEdges is empty (all sides occupied), use getAnyEdgeTile
	edgesToTry := parentEdges
	if len(edgesToTry) == 0 {
		edgesToTry = getAnyEdgeTile(result, parentID)
	}

	// Strategy: find the best direction to extend parent, then place child
	// We'll try extending in each cardinal direction from each edge tile

	directions := []Point{
		{1, 0},  // East
		{-1, 0}, // West
		{0, 1},  // South
		{0, -1}, // North
	}

	// Try each parent edge tile
	for _, edge := range edgesToTry {
		for _, dir := range directions {
			// Try extending 1-5 tiles in this direction
			for extLen := 1; extLen <= 5; extLen++ {
				extPoint := Point{edge[0] + dir[0]*extLen, edge[1] + dir[1]*extLen}

				// Skip if occupied
				if _, exists := result.Grid[extPoint]; exists {
					break // Can't extend further in this direction
				}

				// Temporarily add extension tiles to parent
				extensionTiles := make([]Point, extLen)
				canExtend := true
				for i := 1; i <= extLen; i++ {
					pt := Point{edge[0] + dir[0]*i, edge[1] + dir[1]*i}
					if _, exists := result.Grid[pt]; exists {
						canExtend = false
						break
					}
					extensionTiles[i-1] = pt
				}

				if !canExtend {
					break
				}

				// Add extension tiles temporarily
				for _, pt := range extensionTiles {
					result.Grid[pt] = -parentID // Negative = corridor/extension
					result.RoomTiles[parentID] = append(result.RoomTiles[parentID], pt)
				}

				// Now try to place child adjacent to extended parent
				newEdges := getEdgeTiles(result, parentID)
				placed := tryPlaceChildAdjacent(result, parentID, childID, childShape, newEdges)

				if placed {
					// Success! Convert extension tiles to parent ID (they were marked negative)
					for pt, id := range result.Grid {
						if id == -parentID {
							result.Grid[pt] = parentID
						}
					}
					createDoorConnection(result, childID, parentID)
					return
				}

				// Failed - remove extension tiles and try longer extension
				for _, pt := range extensionTiles {
					delete(result.Grid, pt)
				}
				// Remove from RoomTiles
				tiles := result.RoomTiles[parentID]
				result.RoomTiles[parentID] = tiles[:len(tiles)-len(extensionTiles)]
			}
		}
	}

	// If we get here, we couldn't place the child at all
	// Fall back: just place it somewhere with a long corridor
	forcePlace(result, parentIdx, childIdx, childShape)
}

// forcePlace places a child even if it requires a long corridor
func forcePlace(result *Stage2Result, parentIdx int, childIdx int, childShape PlacedShape) {
	parentID := parentIdx + 1
	childID := childIdx + 1

	// Get bounds of current grid
	var minX, minY, maxX, maxY int
	first := true
	for pt := range result.Grid {
		if first {
			minX, maxX = pt[0], pt[0]
			minY, maxY = pt[1], pt[1]
			first = false
		} else {
			if pt[0] < minX {
				minX = pt[0]
			}
			if pt[0] > maxX {
				maxX = pt[0]
			}
			if pt[1] < minY {
				minY = pt[1]
			}
			if pt[1] > maxY {
				maxY = pt[1]
			}
		}
	}

	// Try placing outside the current bounds in each direction
	// Using gap of 1 to leave room for corridor
	positions := []Point{
		{maxX + 2, minY},                        // Right
		{minX - childShape.Width - 1, minY},     // Left
		{minX, maxY + 2},                        // Below
		{minX, minY - childShape.Height - 1},    // Above
		{maxX + 2, maxY + 2},                    // Bottom-right corner
		{minX - childShape.Width - 1, maxY + 2}, // Bottom-left corner
	}

	for _, pos := range positions {
		if canPlaceShape(result, childShape, pos) {
			placeShapeAtPos(result, childID, childShape, pos)

			// Build corridor from parent edge to child edge (finding nearest)
			// Use getAnyEdgeTile since regular edges might all be occupied
			parentEdges := getAnyEdgeTile(result, parentID)
			childEdges := getAnyEdgeTile(result, childID)

			if len(parentEdges) > 0 && len(childEdges) > 0 {
				// Find the nearest pair of edges
				parentEdge, childEdge := findNearestEdgePair(parentEdges, childEdges)
				buildCorridor(result, parentID, parentEdge, childEdge)
			}

			createDoorConnection(result, childID, parentID)
			return
		}
	}

	// Last resort: place far away with longer corridor
	farPos := Point{maxX + 5, maxY + 5}
	placeShapeAtPos(result, childID, childShape, farPos)

	parentEdges := getAnyEdgeTile(result, parentID)
	childEdges := getAnyEdgeTile(result, childID)
	if len(parentEdges) > 0 && len(childEdges) > 0 {
		parentEdge, childEdge := findNearestEdgePair(parentEdges, childEdges)
		buildCorridor(result, parentID, parentEdge, childEdge)
	}
	createDoorConnection(result, childID, parentID)
}

// findNearestEdgePair finds the pair of edges with minimum Manhattan distance
func findNearestEdgePair(edges1, edges2 []Point) (Point, Point) {
	minDist := -1
	var best1, best2 Point

	for _, e1 := range edges1 {
		for _, e2 := range edges2 {
			dist := abs(e1[0]-e2[0]) + abs(e1[1]-e2[1])
			if minDist < 0 || dist < minDist {
				minDist = dist
				best1 = e1
				best2 = e2
			}
		}
	}

	return best1, best2
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// buildCorridor builds a corridor from parent to child using BFS pathfinding
// The corridor tiles become part of the parent room
// If necessary, it will convert tiles from sibling rooms to parent room tiles
func buildCorridor(result *Stage2Result, parentID int, parentEdge, childEdge Point) {
	childID := result.Grid[childEdge]

	type node struct {
		pt   Point
		path []Point
	}

	// Track visited tiles
	visited := make(map[Point]bool)

	// Start from parent room tiles
	var queue []node
	for _, tile := range result.RoomTiles[parentID] {
		visited[tile] = true
		queue = append(queue, node{pt: tile, path: nil})
	}

	// Also mark child room tiles - we want to reach them, not start from them
	for _, tile := range result.RoomTiles[childID] {
		visited[tile] = true
	}

	// Limit search area
	maxSearchDist := 100

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]

		// Check if we're adjacent to the child room
		neighbors := []Point{
			{curr.pt[0] + 1, curr.pt[1]},
			{curr.pt[0] - 1, curr.pt[1]},
			{curr.pt[0], curr.pt[1] + 1},
			{curr.pt[0], curr.pt[1] - 1},
		}

		for _, n := range neighbors {
			if result.Grid[n] == childID {
				// Found! Add all path tiles to parent room
				for _, pathPt := range curr.path {
					existingID := result.Grid[pathPt]
					if existingID != parentID && existingID != childID {
						// Convert this tile to parent room
						result.Grid[pathPt] = parentID
						result.RoomTiles[parentID] = append(result.RoomTiles[parentID], pathPt)
						// Note: we don't remove from the original room's RoomTiles
						// because that would require more complex bookkeeping
						// The Grid is the source of truth
					}
				}
				return
			}
		}

		// Limit search distance
		if len(curr.path) > maxSearchDist {
			continue
		}

		// Explore neighbors - can go through empty tiles OR other rooms (not parent/child)
		for _, n := range neighbors {
			if visited[n] {
				continue
			}

			visited[n] = true
			newPath := append([]Point{}, curr.path...)

			// If this is an occupied tile (sibling room), add to path for conversion
			// If empty, also add to path
			existingID, exists := result.Grid[n]
			if !exists || (existingID != parentID && existingID != childID) {
				newPath = append(newPath, n)
			}

			queue = append(queue, node{pt: n, path: newPath})
		}
	}
}

// createDoorConnection creates door connections between child and parent
func createDoorConnection(result *Stage2Result, childID, parentID int) {
	childTiles := result.RoomTiles[childID]
	parentTiles := result.RoomTiles[parentID]

	// Find adjacent tiles between child and parent
	parentSet := make(map[Point]bool)
	for _, pt := range parentTiles {
		parentSet[pt] = true
	}

	for _, childTile := range childTiles {
		neighbors := []Point{
			{childTile[0] + 1, childTile[1]},
			{childTile[0] - 1, childTile[1]},
			{childTile[0], childTile[1] + 1},
			{childTile[0], childTile[1] - 1},
		}

		for _, n := range neighbors {
			if parentSet[n] {
				// Found connection point
				childDir := calculateDirection(childTile, n)
				parentDir := calculateDirection(n, childTile)

				result.Doors = append(result.Doors, DoorConnection{
					Point:     childTile,
					RoomID:    childID,
					Direction: childDir,
				})
				result.Doors = append(result.Doors, DoorConnection{
					Point:     n,
					RoomID:    parentID,
					Direction: parentDir,
				})

				return // One door pair per connection is enough
			}
		}
	}
}
