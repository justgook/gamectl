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

	// 4. BFS Queue
	queue := []int{rootID}

	for len(queue) > 0 {
		currentID := queue[0]
		queue = queue[1:]

		childNodes := childrenMap[currentID]

		for _, childID := range childNodes {
			childShape := getRoomShape(treeInput[childID])

			// Try to place the child and find a valid path
			success := attemptPlaceAndConnect(result, currentID, childID, childShape, rnd)

			if !success {
				panic(fmt.Sprintf("Critical: Could not place Node %d (No space/path found)\n", childID))
				// In a real game, you might want to retry with a larger radius here
			} else {
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
) bool {
	parentTiles := m.NodeTiles[parentID]
	if len(parentTiles) == 0 {
		return false
	}

	maxAttempts := 50 // Reduced for speed, increase if map is very dense

	for i := 0; i < maxAttempts; i++ {
		// 1. Pick Start
		refTile := parentTiles[rnd.Intn(len(parentTiles))]

		// 2. Pick Offset (spiral out logic or random)
		radius := 2 + (i / 5)
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

		// 4. Find closest connection points
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

		// 5. Run A* // Pass childID as the "TargetID" so A* can enter the room
		path, found := findPathAStar(m, refTile, closestChildTile, parentID, childID)

		if found {
			// SUCCESS!

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
