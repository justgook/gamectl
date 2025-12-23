package minimap

import (
	"container/heap"
	"errors"

	"github.com/justgook/gamectl/pkg/tree"
)

// Stage3 error constants for clear error handling
var (
	ErrEmptyTree   = errors.New("stage3: tree cannot be empty")
	ErrNoPathFound = errors.New("stage3: cannot find path between rooms")
)

// Stage3 creates paths between all parent-child pairs using A* pathfinding
// Siblings (children of same parent) can share path tiles
// But paths from different parent groups cannot overlap
// Returns PathInfo for all parent-child relationships (does not mutate shapes)
func Stage3(
	treeInput *tree.Tree,
	shapes []PlacedShape,
) ([]PathInfo, error) {
	if len(*treeInput) == 0 {
		return nil, ErrEmptyTree
	}

	// Build internal grid from shapes for pathfinding
	grid := BuildGridFromShapes(shapes)

	var allPathInfos []PathInfo

	// Group children by parent
	childrenByParent := make(map[int][]int)
	for nodeIndex, node := range *treeInput {
		parentIndex := node.ParentId
		if parentIndex == -1 {
			continue // skip root
		}
		childrenByParent[parentIndex] = append(childrenByParent[parentIndex], nodeIndex)
	}

	// Process each parent group: find all sibling paths, then commit together
	for parentIndex, children := range childrenByParent {
		var allPaths [][]Point

		// Find paths for all children of this parent (without committing)
		// Use 1-based IDs for shape lookup
		for _, childIndex := range children {
			fromEdges := getShapeEdgeTiles(grid, childIndex+1)
			toEdges := getShapeEdgeTiles(grid, parentIndex+1)
			path := findPathBetweenShapes(grid, childIndex+1, parentIndex+1)
			if path == nil {
				return nil, ErrNoPathFound
			}
			allPaths = append(allPaths, path)

			// Detect door tiles for this connection
			doors := detectDoorTiles(childIndex+1, parentIndex+1, fromEdges, toEdges, path)

			// Store PathInfo (path tiles are already in child→parent order from A*)
			allPathInfos = append(allPathInfos, PathInfo{
				ChildID:   childIndex + 1,
				ParentID:  parentIndex + 1,
				PathTiles: path,
				Doors:     doors,
			})
		}

		// Mark paths in the internal grid (for subsequent pathfinding in same call)
		// Use negative of 1-based parent ID for paths
		pathID := -(parentIndex + 1)
		for _, path := range allPaths {
			for _, point := range path {
				(*grid)[point] = pathID
			}
		}
	}

	return allPathInfos, nil
}

// findPathBetweenShapes finds the shortest orthogonal path between two shapes
// Returns nil if no path exists
func findPathBetweenShapes(grid *Grid, fromShapeID, toShapeID int) []Point {
	// Collect edge tiles of both shapes
	fromEdges := getShapeEdgeTiles(grid, fromShapeID)
	toEdges := getShapeEdgeTiles(grid, toShapeID)

	if len(fromEdges) == 0 || len(toEdges) == 0 {
		return nil
	}

	// Create set of target tiles for fast lookup
	targetSet := make(map[Point]bool)
	for _, p := range toEdges {
		targetSet[p] = true
	}

	// A* from any fromEdge to any toEdge
	return astarMultiSourceMultiTarget(grid, fromEdges, targetSet, toShapeID)
}

// getShapeEdgeTiles returns tiles of a shape that have at least one empty neighbor
func getShapeEdgeTiles(grid *Grid, shapeID int) []Point {
	var edges []Point

	for point, id := range *grid {
		if id != shapeID {
			continue
		}

		// Check 4 orthogonal neighbors
		neighbors := []Point{
			{point[0] + 1, point[1]},
			{point[0] - 1, point[1]},
			{point[0], point[1] + 1},
			{point[0], point[1] - 1},
		}

		for _, n := range neighbors {
			if _, exists := (*grid)[n]; !exists {
				// Has empty neighbor - this is an edge tile
				edges = append(edges, point)
				break
			}
		}
	}

	return edges
}

// astarMultiSourceMultiTarget runs A* from multiple start points to multiple targets
func astarMultiSourceMultiTarget(
	grid *Grid,
	starts []Point,
	targets map[Point]bool,
	toShapeID int,
) []Point {
	// Find any target point for heuristic (use centroid)
	var targetCenterX, targetCenterY int
	for p := range targets {
		targetCenterX += p[0]
		targetCenterY += p[1]
	}
	targetCenterX /= len(targets)
	targetCenterY /= len(targets)

	// Priority queue
	pq := &priorityQueue{}
	heap.Init(pq)

	// Track visited and came-from
	visited := make(map[Point]bool)
	cameFrom := make(map[Point]Point)
	gScore := make(map[Point]int)

	// Initialize with all start neighbors (not the shape tiles themselves)
	for _, start := range starts {
		neighbors := []Point{
			{start[0] + 1, start[1]},
			{start[0] - 1, start[1]},
			{start[0], start[1] + 1},
			{start[0], start[1] - 1},
		}

		for _, n := range neighbors {
			// Skip if occupied by anything other than target shape
			if id, exists := (*grid)[n]; exists && id != toShapeID {
				continue
			}

			// Check if we immediately reached target
			if targets[n] {
				// Direct neighbor - no path tiles needed
				return []Point{}
			}

			// Only consider empty tiles as path candidates
			if _, exists := (*grid)[n]; exists {
				continue
			}

			h := manhattanDistance(n, Point{targetCenterX, targetCenterY})
			gScore[n] = 1
			cameFrom[n] = start
			heap.Push(pq, &pqItem{point: n, priority: 1 + h})
		}
	}

	// A* main loop
	for pq.Len() > 0 {
		current := heap.Pop(pq).(*pqItem).point

		if visited[current] {
			continue
		}
		visited[current] = true

		// Check neighbors
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

			// Check if reached target shape edge
			if targets[n] {
				// Reconstruct path (excluding start and end shape tiles)
				return reconstructPath(cameFrom, current)
			}

			// Skip if occupied (not empty)
			if _, exists := (*grid)[n]; exists {
				continue
			}

			tentativeG := gScore[current] + 1
			if oldG, exists := gScore[n]; exists && tentativeG >= oldG {
				continue
			}

			gScore[n] = tentativeG
			cameFrom[n] = current
			h := manhattanDistance(n, Point{targetCenterX, targetCenterY})
			heap.Push(pq, &pqItem{point: n, priority: tentativeG + h})
		}
	}

	return nil // no path found
}

// reconstructPath builds the path from cameFrom map
func reconstructPath(cameFrom map[Point]Point, end Point) []Point {
	path := []Point{end}
	current := end

	for {
		prev, exists := cameFrom[current]
		if !exists {
			break
		}

		// Stop if we reached a start point (which was a shape tile)
		if _, hasPrev := cameFrom[prev]; !hasPrev {
			break
		}

		path = append([]Point{prev}, path...)
		current = prev
	}

	return path
}

// manhattanDistance calculates Manhattan distance between two points
func manhattanDistance(a, b Point) int {
	dx := a[0] - b[0]
	dy := a[1] - b[1]
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}
	return dx + dy
}

// Priority queue implementation for A*
type pqItem struct {
	point    Point
	priority int
	index    int
}

type priorityQueue []*pqItem

func (pq priorityQueue) Len() int { return len(pq) }

func (pq priorityQueue) Less(i, j int) bool {
	return pq[i].priority < pq[j].priority
}

func (pq priorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}

func (pq *priorityQueue) Push(x any) {
	n := len(*pq)
	item := x.(*pqItem)
	item.index = n
	*pq = append(*pq, item)
}

func (pq *priorityQueue) Pop() any {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil
	item.index = -1
	*pq = old[0 : n-1]
	return item
}

// detectDoorTiles identifies door tiles for a parent-child connection
// Returns two DoorConnections: one for child room, one for parent room
func detectDoorTiles(
	childID int,
	parentID int,
	childEdges []Point,
	parentEdges []Point,
	path []Point,
) []DoorConnection {
	var doors []DoorConnection

	if len(path) == 0 {
		// Direct neighbors case: rooms touch directly
		// Find the edge tiles that are adjacent to each other
		for _, childEdge := range childEdges {
			for _, parentEdge := range parentEdges {
				if areAdjacent(childEdge, parentEdge) {
					// Child door: edge tile pointing toward parent
					childDir := calculateDirection(childEdge, parentEdge)
					doors = append(doors, DoorConnection{
						Point:     childEdge,
						RoomID:    childID,
						Direction: childDir,
					})

					// Parent door: edge tile pointing toward child
					parentDir := calculateDirection(parentEdge, childEdge)
					doors = append(doors, DoorConnection{
						Point:     parentEdge,
						RoomID:    parentID,
						Direction: parentDir,
					})

					return doors // Found the connection, done
				}
			}
		}
	} else {
		// Path exists between rooms
		// After conversion, path tiles become parent tiles
		// So we have: [Child edge] ↔ [path...] ↔ [Parent edge]
		// After: [Child edge] ↔ [parent tiles (was path)] ↔ [Parent edge]

		firstPathPoint := path[0]

		// Child door: on child edge tile, pointing toward first path point
		for _, childEdge := range childEdges {
			if areAdjacent(childEdge, firstPathPoint) {
				childDir := calculateDirection(childEdge, firstPathPoint)
				doors = append(doors, DoorConnection{
					Point:     childEdge,
					RoomID:    childID,
					Direction: childDir,
				})

				// Parent door: on first path point (becomes parent), pointing toward child edge
				parentDir := calculateDirection(firstPathPoint, childEdge)
				doors = append(doors, DoorConnection{
					Point:     firstPathPoint,
					RoomID:    parentID, // Path becomes parent after conversion
					Direction: parentDir,
				})

				return doors // Found the door pair
			}
		}
	}

	return doors
}

// areAdjacent checks if two points are orthogonally adjacent
func areAdjacent(a, b Point) bool {
	dx := a[0] - b[0]
	dy := a[1] - b[1]
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}
	return (dx == 1 && dy == 0) || (dx == 0 && dy == 1)
}
