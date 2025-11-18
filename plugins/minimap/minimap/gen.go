package minimap

import (
	"container/heap"
	"errors"
	"fmt"
	"math"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
)

type Random interface {
	Intn(n int) int
	Float64() float64
}

type RoomShape [][2]int

// GetRoomShapeFunc defines the function signature for room shape selection
type GetRoomShapeFunc func(*tree.Node) RoomShape

// GenerateMinimap creates a minimap from a tree using incremental corridor generation
// This is a complete rewrite using the two-phase breadth-first algorithm:
// Phase 1: Place all rooms at ideal positions (breadth-first)
// Phase 2: Connect all parent-child relationships with corridors
func GenerateMinimap(
	rng Random,
	treeInput tree.Tree,
	getRoomShape GetRoomShapeFunc,
) (*tilemap.TileMap, error) {
	if len(treeInput) == 0 {
		return nil, errors.New("empty tree")
	}

	result := GenerateMinimap2(rng, treeInput, getRoomShape)
	rooms, w, _ := BakeToFlatArray(result)

	// Generate the final tilemap
	return &tilemap.TileMap{
		Layers: []tilemap.TileLayer{
			{Width: w, Data: rooms},
		},
		Meta: map[string]string{},
	}, nil
}

// --- The Minimap Generator ---

type Point struct {
	X, Y int
}

type NodeInput struct {
	Parent int
}

type MinimapResult struct {
	Grid      map[Point]int   // Map of Coordinate -> NodeID
	NodeTiles map[int][]Point // Map of NodeID -> List of all its tiles
}

type MapBounds struct {
	MinX, MaxX, MinY, MaxY int
}

type EscapePath struct {
	ParentID    int     // Which parent this escape path belongs to
	PathTiles   []Point // Actual path tiles (added to Grid as parent tiles)
	IsTemporary bool    // Will be removed when placing last child
}

// --- The Generator ---

func GenerateMinimap2(
	rnd Random,
	treeInput tree.Tree,
	getRoomShape GetRoomShapeFunc,
) *MinimapResult {

	// 1. Build Adjacency List
	childrenMap := make(map[int][]int)
	var rootID int = -1

	for i, node := range treeInput {
		if node.ParentId == -1 {
			rootID = i
		} else {
			childrenMap[node.ParentId] = append(childrenMap[node.ParentId], i)
		}
	}

	if rootID == -1 {
		return nil
	}

	// 2. Init Result
	result := &MinimapResult{
		Grid:      make(map[Point]int),
		NodeTiles: make(map[int][]Point),
	}

	// 3. Place Root
	rootShape := getRoomShape(treeInput[rootID])
	placeShapeOnGrid(result, rootID, rootShape, Point{0, 0})

	// 4. Track incomplete parents (parents that still have unplaced children)
	incompleteParents := make(map[int]int) // parentID -> remaining children count
	for parentID, children := range childrenMap {
		incompleteParents[parentID] = len(children)
	}

	// 5. Initialize escape path system
	escapePaths := make(map[int]*EscapePath) // parentID -> escape path
	mapBounds := calculateMapBounds(result)

	// 6. BFS Queue
	queue := []int{rootID}

	for len(queue) > 0 {
		currentID := queue[0]
		queue = queue[1:]

		childNodes := childrenMap[currentID]

		// Establish escape path for parent if they have multiple children and don't have one yet
		if len(childNodes) > 1 {
			if _, exists := escapePaths[currentID]; !exists {
				// Always try to establish an escape path - it's just actual tiles now
				if escapePath := establishEscapePath(currentID, result, &mapBounds); escapePath != nil {
					escapePaths[currentID] = escapePath
				}
			}
		}

		for _, childID := range childNodes {
			childShape := getRoomShape(treeInput[childID])

			// Try to place the child and find a valid path
			success := attemptPlaceAndConnect(result, currentID, childID, childShape, rnd, incompleteParents, escapePaths, &mapBounds, childrenMap)

			if !success {
				panic(fmt.Sprintf("Critical: Could not place Node %d (No space/path found)\n", childID))
				// In a real game, you might want to retry with a larger radius here
			} else {
				// Update incomplete parents count
				incompleteParents[currentID]--
				if incompleteParents[currentID] == 0 {
					delete(incompleteParents, currentID) // Parent is complete
				}
				queue = append(queue, childID)
			}
		}
	}

	return result
}

// --- Placement & Connection Logic ---

func attemptPlaceAndConnect(
	m *MinimapResult,
	parentID, childID int,
	childShape RoomShape,
	rnd Random,
	incompleteParents map[int]int,
	escapePaths map[int]*EscapePath,
	mapBounds *MapBounds,
	childrenMap map[int][]int,
) bool {
	parentTiles := m.NodeTiles[parentID]
	if len(parentTiles) == 0 {
		return false
	}

	// Check if this is the last child of the parent
	isLastChild := isLastChildOfParent(parentID, incompleteParents)

	maxAttempts := 150 // Balanced search parameters

	for i := 0; i < maxAttempts; i++ {
		// 1. Pick Start
		refTile := parentTiles[rnd.Intn(len(parentTiles))]

		// 2. Pick Offset (spiral out logic or random) - balanced expansion
		radius := 2 + (i / 2) // Balanced radius expansion
		dx := rnd.Intn(radius*2+1) - radius
		dy := rnd.Intn(radius*2+1) - radius

		// Don't place on top of itself
		if dx == 0 && dy == 0 {
			continue
		}

		attemptOffset := Point{X: refTile.X + dx, Y: refTile.Y + dy}

		// 3. Check if Room Fits (ignoreID = -1, we don't want to overlap ANYONE, even parent)
		if checkCollision(m, childShape, attemptOffset, -1) {
			continue
		}

		// 4. No need for special escape path collision check -
		// escape paths are real tiles, handled by normal collision detection

		// 5. Find closest connection points
		closestChildTile := Point{}
		minDist := math.MaxFloat64

		// Calculate absolute child position for A* targeting
		for _, p := range childShape {
			absP := Point{p[0] + attemptOffset.X, p[1] + attemptOffset.Y}
			d := distance(refTile, absP)
			if d < minDist {
				minDist = d
				closestChildTile = absP
			}
		}

		// 6. Run A* // Pass childID as the "TargetID" so A* can enter the room
		path, found := findPathAStar(m, refTile, closestChildTile, parentID, childID)

		if found {
			// 7. No need for special escape path or parent blocking checks!
			// Escape paths are real tiles, so they naturally block placements
			// This guarantees parents can't be completely surrounded

			// SUCCESS! Safe to commit

			// A. Place the Room
			placeShapeOnGrid(m, childID, childShape, attemptOffset)

			// B. Place the Path
			for _, p := range path {
				// Only write if empty.
				// This prevents overwriting the Child we just placed,
				// and prevents overwriting the Parent (self-intersection).
				if _, exists := m.Grid[p]; !exists {
					m.Grid[p] = parentID
					m.NodeTiles[parentID] = append(m.NodeTiles[parentID], p)
				}
			}

			// C. If this is the last child, remove parent's escape path and recreate optimal paths
			if isLastChild {
				if escapePath, exists := escapePaths[parentID]; exists {
					removeEscapePath(escapePath, m)
					// Recreate optimal paths to all children now that escape path is gone
					recreatePathsForParent(parentID, childrenMap, m)
					delete(escapePaths, parentID) // No longer needed
				}
			}

			return true
		}
	}

	return false
}

// --- A* Pathfinding ---

type Item struct {
	Point    Point
	Priority float64
	Index    int
}

// PriorityQueue boiler plate for A*
type PriorityQueue []*Item

func (pq PriorityQueue) Len() int           { return len(pq) }
func (pq PriorityQueue) Less(i, j int) bool { return pq[i].Priority < pq[j].Priority }
func (pq PriorityQueue) Swap(i, j int)      { pq[i], pq[j] = pq[j], pq[i]; pq[i].Index = i; pq[j].Index = j }
func (pq *PriorityQueue) Push(x interface{}) {
	n := len(*pq)
	item := x.(*Item)
	item.Index = n
	*pq = append(*pq, item)
}
func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil
	item.Index = -1
	*pq = old[0 : n-1]
	return item
}

// findPathAStar finds a path that avoids all nodes except the `allowedID`
func findPathAStar(m *MinimapResult, start, end Point, allowedID, targetID int) ([]Point, bool) {

	dirs := []Point{{0, 1}, {0, -1}, {1, 0}, {-1, 0}}

	pq := &PriorityQueue{}
	heap.Init(pq)
	heap.Push(pq, &Item{Point: start, Priority: 0})

	cameFrom := make(map[Point]Point)
	costSoFar := make(map[Point]float64)

	cameFrom[start] = start
	costSoFar[start] = 0

	found := false

	for pq.Len() > 0 {
		current := heap.Pop(pq).(*Item).Point

		if current == end {
			found = true
			break
		}

		for _, d := range dirs {
			next := Point{current.X + d.X, current.Y + d.Y}

			// --- LOGIC FIX HERE ---
			if owner, exists := m.Grid[next]; exists {
				// We can walk on:
				// 1. The Parent (allowedID)
				// 2. The Child we are trying to reach (targetID) <--- NEW
				if owner != allowedID && owner != targetID {
					continue // Blocked by a third-party room
				}
			}
			// ----------------------

			newCost := costSoFar[current] + 1.0

			if c, exists := costSoFar[next]; !exists || newCost < c {
				costSoFar[next] = newCost
				// Heuristic: Manhattan distance
				priority := newCost + (math.Abs(float64(next.X-end.X)) + math.Abs(float64(next.Y-end.Y)))
				heap.Push(pq, &Item{Point: next, Priority: priority})
				cameFrom[next] = current
			}
		}
	}

	if !found {
		return nil, false
	}

	// Reconstruct Path
	var path []Point
	curr := end
	for curr != start {
		path = append(path, curr)
		curr = cameFrom[curr]
	}
	return path, true
}

// --- Escape Path Management ---

// calculateMapBounds determines current map boundaries from placed tiles
func calculateMapBounds(m *MinimapResult) MapBounds {
	if len(m.Grid) == 0 {
		return MapBounds{MinX: -5, MaxX: 5, MinY: -5, MaxY: 5} // Default bounds
	}

	minX, maxX, minY, maxY := math.MaxInt32, math.MinInt32, math.MaxInt32, math.MinInt32
	for p := range m.Grid {
		if p.X < minX {
			minX = p.X
		}
		if p.X > maxX {
			maxX = p.X
		}
		if p.Y < minY {
			minY = p.Y
		}
		if p.Y > maxY {
			maxY = p.Y
		}
	}

	// Add padding around current bounds
	padding := 3
	return MapBounds{
		MinX: minX - padding,
		MaxX: maxX + padding,
		MinY: minY - padding,
		MaxY: maxY + padding,
	}
}

// findNearestBoundary finds the shortest path from parent tiles to map boundary
func findNearestBoundary(parentTiles []Point, bounds MapBounds, m *MinimapResult) (Point, []Point) {
	if len(parentTiles) == 0 {
		return Point{}, nil
	}

	// Try all four directions and find the shortest path
	directions := []Point{{0, 1}, {0, -1}, {1, 0}, {-1, 0}} // N, S, E, W
	bestDirection := Point{}
	bestPath := []Point{}
	shortestDistance := math.MaxInt32

	for _, dir := range directions {
		for _, parentTile := range parentTiles {
			path := findPathToBoundary(parentTile, dir, bounds, m)
			if len(path) > 0 && len(path) < shortestDistance {
				shortestDistance = len(path)
				bestDirection = dir
				bestPath = path
			}
		}
	}

	return bestDirection, bestPath
}

// findPathToBoundary creates a straight path from start point to boundary in given direction
func findPathToBoundary(start Point, direction Point, bounds MapBounds, m *MinimapResult) []Point {
	var path []Point
	current := start

	// Move in the direction until we reach boundary
	for {
		current.X += direction.X
		current.Y += direction.Y

		// Check if we've reached the boundary
		if current.X <= bounds.MinX || current.X >= bounds.MaxX ||
			current.Y <= bounds.MinY || current.Y >= bounds.MaxY {
			break
		}

		// Check if this tile is occupied by another room (not allowed in escape path)
		if _, exists := m.Grid[current]; exists {
			return nil // Path blocked, can't use this direction
		}

		path = append(path, current)

		// Safety check to prevent infinite loops
		if len(path) > 50 {
			break
		}
	}

	return path
}

// establishEscapePath creates an actual path from parent to boundary and places tiles
func establishEscapePath(parentID int, m *MinimapResult, bounds *MapBounds) *EscapePath {
	parentTiles := m.NodeTiles[parentID]
	if len(parentTiles) == 0 {
		return nil
	}

	direction, pathTiles := findNearestBoundary(parentTiles, *bounds, m)

	// If no path found or path is too long, extend map boundary
	maxEscapePathLength := 15
	if len(pathTiles) == 0 || len(pathTiles) > maxEscapePathLength {
		extendMapBoundary(bounds, direction)
		direction, pathTiles = findNearestBoundary(parentTiles, *bounds, m)
	}

	if len(pathTiles) == 0 {
		return nil // Still couldn't find a path
	}

	// Actually place the escape path tiles in the grid as parent tiles
	for _, tile := range pathTiles {
		m.Grid[tile] = parentID
		m.NodeTiles[parentID] = append(m.NodeTiles[parentID], tile)
	}

	return &EscapePath{
		ParentID:    parentID,
		PathTiles:   pathTiles,
		IsTemporary: true,
	}
}

// extendMapBoundary expands the map boundaries in the given direction
func extendMapBoundary(bounds *MapBounds, direction Point) {
	extension := 10 // How much to extend

	if direction.X > 0 { // East
		bounds.MaxX += extension
	} else if direction.X < 0 { // West
		bounds.MinX -= extension
	}

	if direction.Y > 0 { // North
		bounds.MaxY += extension
	} else if direction.Y < 0 { // South
		bounds.MinY -= extension
	}
}

// No need for complex escape path collision checks anymore!
// The escape paths are actual tiles in the grid, so normal collision detection handles them.

// isLastChildOfParent determines if this child is the last one for its parent
func isLastChildOfParent(parentID int, incompleteParents map[int]int) bool {
	remainingChildren := incompleteParents[parentID]
	return remainingChildren == 1 // This child is the last one
}

// removeEscapePath removes the temporary escape path tiles from the grid
func removeEscapePath(escapePath *EscapePath, m *MinimapResult) {
	if !escapePath.IsTemporary {
		return
	}

	parentID := escapePath.ParentID

	// Remove escape path tiles from grid
	for _, tile := range escapePath.PathTiles {
		delete(m.Grid, tile)
	}

	// Remove escape path tiles from parent's tile list
	newTiles := []Point{}
	escapePathMap := make(map[Point]bool)
	for _, tile := range escapePath.PathTiles {
		escapePathMap[tile] = true
	}

	for _, tile := range m.NodeTiles[parentID] {
		if !escapePathMap[tile] {
			newTiles = append(newTiles, tile)
		}
	}
	m.NodeTiles[parentID] = newTiles

	escapePath.IsTemporary = false
}

// recreatePathsForParent recreates optimal paths to all children of a parent
func recreatePathsForParent(parentID int, childrenMap map[int][]int, m *MinimapResult) {
	children := childrenMap[parentID]
	if len(children) == 0 {
		return
	}

	parentTiles := m.NodeTiles[parentID]
	if len(parentTiles) == 0 {
		return
	}

	// For each child, find the optimal path and recreate it
	for _, childID := range children {
		childTiles := m.NodeTiles[childID]
		if len(childTiles) == 0 {
			continue
		}

		// Find closest parent and child tiles
		var bestParentTile, bestChildTile Point
		minDist := math.MaxFloat64

		for _, parentTile := range parentTiles {
			for _, childTile := range childTiles {
				dist := distance(parentTile, childTile)
				if dist < minDist {
					minDist = dist
					bestParentTile = parentTile
					bestChildTile = childTile
				}
			}
		}

		// Find optimal path between these tiles
		if path, found := findPathAStar(m, bestParentTile, bestChildTile, parentID, childID); found {
			// Place the optimal path
			for _, p := range path {
				if _, exists := m.Grid[p]; !exists {
					m.Grid[p] = parentID
					m.NodeTiles[parentID] = append(m.NodeTiles[parentID], p)
				}
			}
		}
	}
}

// --- Helpers ---

func placeShapeOnGrid(m *MinimapResult, id int, relativeShape RoomShape, offset Point) {
	for _, p := range relativeShape {
		absPos := Point{p[0] + offset.X, p[1] + offset.Y}
		m.Grid[absPos] = id
		m.NodeTiles[id] = append(m.NodeTiles[id], absPos)
	}
}

func checkCollision(m *MinimapResult, shape RoomShape, offset Point, ignoreID int) bool {
	for _, p := range shape {
		abs := Point{p[0] + offset.X, p[1] + offset.Y}
		if id, exists := m.Grid[abs]; exists {
			if id != ignoreID {
				return true
			}
		}
	}
	return false
}

func distance(a, b Point) float64 {
	// Manhattan distance is often better for grid alignment heuristics
	return math.Abs(float64(a.X-b.X)) + math.Abs(float64(a.Y-b.Y))
}

// wouldBlockIncompleteParents checks if placing a room and its connection path
// would block escape routes for other incomplete parents
func wouldBlockIncompleteParents(
	m *MinimapResult,
	parentID int,
	childShape RoomShape,
	childOffset Point,
	projectedPath []Point,
	incompleteParents map[int]int,
) bool {
	// Create temporary occupation map with room + path
	tempOccupied := make(map[Point]bool)

	// Add child room tiles
	for _, p := range childShape {
		tempOccupied[Point{p[0] + childOffset.X, p[1] + childOffset.Y}] = true
	}

	// Add projected path tiles
	for _, p := range projectedPath {
		tempOccupied[p] = true
	}

	// Check each incomplete parent for blocked escape routes
	for incompleteParentID := range incompleteParents {
		if incompleteParentID == parentID { // Skip the current parent being processed
			continue
		}

		parentTiles := m.NodeTiles[incompleteParentID]

		for _, parentTile := range parentTiles {
			hasEscapeRoute := false

			// Check 4 adjacent directions
			for _, dir := range []Point{{0, 1}, {0, -1}, {1, 0}, {-1, 0}} {
				adjacent := Point{parentTile.X + dir.X, parentTile.Y + dir.Y}

				// Check if this adjacent tile would be blocked by new room or path
				if tempOccupied[adjacent] {
					continue // Blocked by new room or path
				}

				// Check if already occupied by existing rooms
				if _, exists := m.Grid[adjacent]; !exists {
					hasEscapeRoute = true
					break
				}
			}

			if !hasEscapeRoute {
				return true // This parent would be completely blocked
			}
		}
	}

	return false
}

// ConvertGridToTileLayer converts a map[Point]int into a tilemap.TileLayer.
// It automatically computes bounds and fills missing tiles with 0.
func BakeToFlatArray(m *MinimapResult) ([]uint32, int, int) {
	if len(m.Grid) == 0 {
		return nil, 0, 0
	}

	// 1. Find bounds
	minX, maxX, minY, maxY := 999999, -999999, 999999, -999999
	for p := range m.Grid {
		if p.X < minX {
			minX = p.X
		}
		if p.X > maxX {
			maxX = p.X
		}
		if p.Y < minY {
			minY = p.Y
		}
		if p.Y > maxY {
			maxY = p.Y
		}
	}

	width := (maxX - minX) + 1
	height := (maxY - minY) + 1

	flat := make([]uint32, width*height)

	for p, id := range m.Grid {
		// Shift coordinates to be 0-based relative to min
		relX := p.X - minX
		relY := p.Y - minY

		index := relY*width + relX
		flat[index] = uint32(id + 1) // ID+1 as per your request
	}

	return flat, width, height
}
