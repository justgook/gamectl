package minimap

import (
	"github.com/justgook/gams/sdk/go/tree"
)

// Stage2Result contains the output of the grow-from-parent algorithm
// Grid values:
//   - Positive: room ID (1-based, corresponds to node index + 1)
//   - Negative: corridor belonging to room |ID| (e.g., -5 means corridor of room 5)
//   - Zero: empty
type Stage2Result struct {
	Grid      Grid             // The generated grid (point -> roomID or negative corridor ID)
	Doors     []DoorConnection // Door connections between rooms
	RoomTiles map[int][]Point  // For each room ID (1-based), list of room tiles (not corridors)
}

// Stage2 grows the minimap from root, placing each child adjacent to its parent.
// This guarantees that every child shares at least one edge with its parent (or parent's corridor).
//
// Key rules:
//   - Corridors use negative IDs: corridor of room N has ID -N
//   - Children can share parent's corridors (they're "parent territory")
//   - Children of different parents cannot cross each other's corridors
//   - This preserves the tree structure in the spatial layout
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
	placeShape(result, 1, rootShape, Point{0, 0})

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
		for _, childIdx := range children {
			placeChildAdjacentToParent(result, parentIdx, childIdx, shapes[childIdx])
		}
	}

	return result, nil
}

// placeShape places a room shape at the given position
func placeShape(result *Stage2Result, roomID int, shape PlacedShape, pos Point) {
	for _, relPoint := range shape.Points {
		worldPoint := Point{pos[0] + relPoint[0], pos[1] + relPoint[1]}
		result.Grid[worldPoint] = roomID
		result.RoomTiles[roomID] = append(result.RoomTiles[roomID], worldPoint)
	}
}

// placeChildAdjacentToParent places a child room adjacent to its parent
// If direct placement isn't possible, creates minimal corridors
func placeChildAdjacentToParent(
	result *Stage2Result,
	parentIdx int,
	childIdx int,
	childShape PlacedShape,
) {
	parentID := parentIdx + 1
	childID := childIdx + 1

	// Get all tiles belonging to parent (room tiles + corridor tiles)
	parentTiles := getParentTerritory(result, parentID)

	// Try to place child directly adjacent to parent territory
	placed := tryPlaceChildAdjacent(result, parentID, childID, childShape, parentTiles)

	if !placed {
		// Need to extend with corridor and place child
		extendAndPlaceChild(result, parentID, childID, childShape, parentTiles)
	}

	// Create door connection
	createDoorConnection(result, childID, parentID)
}

// getParentTerritory returns all tiles that belong to a parent (room + corridors)
// This includes the room tiles and any corridor tiles (negative ID)
func getParentTerritory(result *Stage2Result, parentID int) []Point {
	var tiles []Point

	// Add room tiles
	tiles = append(tiles, result.RoomTiles[parentID]...)

	// Add corridor tiles (negative parent ID)
	corridorID := -parentID
	for pt, id := range result.Grid {
		if id == corridorID {
			tiles = append(tiles, pt)
		}
	}

	return tiles
}

// getEdgeTiles returns tiles from the list that have at least one empty neighbor
func getEdgeTiles(result *Stage2Result, tiles []Point) []Point {
	var edges []Point

	for _, tile := range tiles {
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

// tryPlaceChildAdjacent tries to place child shape adjacent to parent territory
func tryPlaceChildAdjacent(
	result *Stage2Result,
	parentID int,
	childID int,
	childShape PlacedShape,
	parentTiles []Point,
) bool {
	parentEdges := getEdgeTiles(result, parentTiles)
	if len(parentEdges) == 0 {
		return false
	}

	directions := []Point{
		{1, 0},  // East
		{-1, 0}, // West
		{0, 1},  // South
		{0, -1}, // North
	}

	type placement struct {
		pos      Point
		adjacent int
	}

	var validPlacements []placement

	for _, parentEdge := range parentEdges {
		for _, dir := range directions {
			connPoint := Point{parentEdge[0] + dir[0], parentEdge[1] + dir[1]}

			if _, exists := result.Grid[connPoint]; exists {
				continue
			}

			for _, childRelPoint := range childShape.Points {
				childPos := Point{
					connPoint[0] - childRelPoint[0],
					connPoint[1] - childRelPoint[1],
				}

				if canPlaceShape(result, childShape, childPos) {
					adjCount := countAdjacentToParentTerritory(
						result,
						childShape,
						childPos,
						parentID,
					)
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

	// Pick placement with most adjacent tiles
	best := validPlacements[0]
	for _, p := range validPlacements[1:] {
		if p.adjacent > best.adjacent {
			best = p
		}
	}

	placeShape(result, childID, childShape, best.pos)
	return true
}

// canPlaceShape checks if a shape can be placed without overlapping existing tiles
func canPlaceShape(result *Stage2Result, shape PlacedShape, pos Point) bool {
	for _, relPoint := range shape.Points {
		worldPoint := Point{pos[0] + relPoint[0], pos[1] + relPoint[1]}
		if _, exists := result.Grid[worldPoint]; exists {
			return false
		}
	}
	return true
}

// countAdjacentToParentTerritory counts tiles adjacent to parent room or corridor
func countAdjacentToParentTerritory(
	result *Stage2Result,
	shape PlacedShape,
	pos Point,
	parentID int,
) int {
	corridorID := -parentID
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
			id := result.Grid[n]
			if id == parentID || id == corridorID {
				count++
				break
			}
		}
	}
	return count
}

// extendAndPlaceChild places child with minimal corridor extension
func extendAndPlaceChild(
	result *Stage2Result,
	parentID int,
	childID int,
	childShape PlacedShape,
	parentTiles []Point,
) {
	// BFS to find nearest valid position for child
	// We search through BOTH empty tiles AND other room tiles (not other corridors)
	// This allows us to find a path even when parent is surrounded
	type searchNode struct {
		pos  Point
		dist int
		path []Point // corridor path to reach this position
	}

	visited := make(map[Point]bool)
	var queue []searchNode

	// Mark parent tiles as visited (we start from their neighbors)
	for _, tile := range parentTiles {
		visited[tile] = true
	}

	// Start from tiles adjacent to parent territory
	for _, tile := range parentTiles {
		neighbors := []Point{
			{tile[0] + 1, tile[1]},
			{tile[0] - 1, tile[1]},
			{tile[0], tile[1] + 1},
			{tile[0], tile[1] - 1},
		}
		for _, n := range neighbors {
			if !visited[n] {
				visited[n] = true
				// Check if this is empty or occupied by a sibling room
				if _, exists := result.Grid[n]; !exists {
					// Empty tile - add to path
					queue = append(queue, searchNode{pos: n, dist: 1, path: []Point{n}})
				} else {
					// Occupied tile - we can path through it but don't add to corridor
					queue = append(queue, searchNode{pos: n, dist: 1, path: []Point{}})
				}
			}
		}
	}

	corridorID := -parentID

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]

		// Only try to place child at EMPTY positions
		if _, occupied := result.Grid[curr.pos]; occupied {
			// Can't place child on occupied tile, but continue searching through it
			goto expandSearch
		}

		// Try to place child such that one of its tiles occupies curr.pos
		for _, anchorPt := range childShape.Points {
			childPos := Point{
				curr.pos[0] - anchorPt[0],
				curr.pos[1] - anchorPt[1],
			}

			if canPlaceShape(result, childShape, childPos) {
				// Place corridor tiles (all tiles in path that are empty)
				for _, pt := range curr.path {
					if _, exists := result.Grid[pt]; !exists {
						result.Grid[pt] = corridorID
					}
				}

				// Place the child
				placeShape(result, childID, childShape, childPos)
				return
			}
		}

	expandSearch:

		// Limit search distance
		if curr.dist >= 20 {
			continue
		}

		// Expand search - can go through empty tiles or sibling rooms
		neighbors := []Point{
			{curr.pos[0] + 1, curr.pos[1]},
			{curr.pos[0] - 1, curr.pos[1]},
			{curr.pos[0], curr.pos[1] + 1},
			{curr.pos[0], curr.pos[1] - 1},
		}
		for _, n := range neighbors {
			if visited[n] {
				continue
			}
			visited[n] = true

			existingID, exists := result.Grid[n]
			if !exists {
				// Empty tile - add to corridor path
				newPath := make([]Point, len(curr.path)+1)
				copy(newPath, curr.path)
				newPath[len(curr.path)] = n
				queue = append(queue, searchNode{pos: n, dist: curr.dist + 1, path: newPath})
			} else if existingID > 0 && existingID != parentID {
				// Sibling room tile - can path through but don't add to corridor
				// Keep the same path (corridor doesn't go through sibling rooms)
				newPath := make([]Point, len(curr.path))
				copy(newPath, curr.path)
				queue = append(queue, searchNode{pos: n, dist: curr.dist + 1, path: newPath})
			}
			// Skip corridor tiles (negative IDs) - don't cross other parents' corridors
		}
	}

	// Fallback: place far away with corridor
	minX, minY, maxX, maxY := getBounds(result)
	_ = minX
	_ = maxY
	farPos := Point{maxX + 3, minY}
	placeShape(result, childID, childShape, farPos)

	// Build corridor to connect
	buildCorridor(result, parentID, childID, parentTiles)
}

// getBounds returns bounding box of all tiles
func getBounds(result *Stage2Result) (minX, minY, maxX, maxY int) {
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
	return
}

// buildCorridor builds minimal corridor from parent territory to child
func buildCorridor(result *Stage2Result, parentID, childID int, parentTiles []Point) {
	childTiles := result.RoomTiles[childID]
	if len(childTiles) == 0 {
		return
	}

	childSet := make(map[Point]bool)
	for _, t := range childTiles {
		childSet[t] = true
	}

	// Check if already adjacent
	corridorID := -parentID
	for _, pTile := range parentTiles {
		neighbors := []Point{
			{pTile[0] + 1, pTile[1]},
			{pTile[0] - 1, pTile[1]},
			{pTile[0], pTile[1] + 1},
			{pTile[0], pTile[1] - 1},
		}
		for _, n := range neighbors {
			if childSet[n] {
				return // Already connected
			}
		}
	}

	// BFS to find shortest path
	type node struct {
		pt   Point
		prev *node
	}

	visited := make(map[Point]bool)
	for pt := range result.Grid {
		visited[pt] = true
	}

	var queue []*node
	for _, tile := range parentTiles {
		neighbors := []Point{
			{tile[0] + 1, tile[1]},
			{tile[0] - 1, tile[1]},
			{tile[0], tile[1] + 1},
			{tile[0], tile[1] - 1},
		}
		for _, n := range neighbors {
			if !visited[n] {
				visited[n] = true
				queue = append(queue, &node{pt: n, prev: nil})
			}
		}
	}

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]

		neighbors := []Point{
			{curr.pt[0] + 1, curr.pt[1]},
			{curr.pt[0] - 1, curr.pt[1]},
			{curr.pt[0], curr.pt[1] + 1},
			{curr.pt[0], curr.pt[1] - 1},
		}

		for _, n := range neighbors {
			if childSet[n] {
				// Found! Add corridor tiles
				for c := curr; c != nil; c = c.prev {
					result.Grid[c.pt] = corridorID
				}
				return
			}
		}

		for _, n := range neighbors {
			if visited[n] {
				continue
			}
			visited[n] = true
			queue = append(queue, &node{pt: n, prev: curr})
		}
	}
}

// createDoorConnection creates door between child and parent/corridor
func createDoorConnection(result *Stage2Result, childID, parentID int) {
	childTiles := result.RoomTiles[childID]
	corridorID := -parentID

	// Build set of parent territory
	parentSet := make(map[Point]bool)
	for _, pt := range result.RoomTiles[parentID] {
		parentSet[pt] = true
	}
	for pt, id := range result.Grid {
		if id == corridorID {
			parentSet[pt] = true
		}
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
				return
			}
		}
	}
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
