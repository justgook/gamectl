package minimap

import (
	"container/heap"
	"fmt"
	"math"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
)

// tree.Node mock (assuming your existing structure)
type TreeNode struct {
	ID       int
	ParentID int
	Children []*TreeNode
}

type Random interface {
	Intn(n int) int
	Float64() float64
}

type RoomShape [][2]int
type GetRoomShapeFunc func(*tree.Node) RoomShape // Adjusted to take ID for simplicity in this snippet

// --- Generator Logic ---

type Point [2]int

type MinimapGenerator struct {
	Grid         map[Point]int  // The final map: Coord -> NodeIndex (or TileID)
	Reservations map[Point]bool // Temporary paths to outside
	Bounds       struct {
		MinX, MinY, MaxX, MaxY int
	}
	Rng Random
}

func NewMinimapGenerator(rng Random) *MinimapGenerator {
	return &MinimapGenerator{
		Grid:         make(map[Point]int),
		Reservations: make(map[Point]bool),
		Rng:          rng,
		Bounds: struct{ MinX, MinY, MaxX, MaxY int }{
			MinX: 0, MinY: 0, MaxX: 0, MaxY: 0,
		},
	}
}

// GenerateMinimap is the entry point
func GenerateMinimap(rng Random, inputTree tree.Tree, getShape GetRoomShapeFunc) (*tilemap.TileMap, error) {
	nodes := make([]*TreeNode, len(inputTree))
	for i := range nodes {
		nodes[i] = &TreeNode{ID: i, ParentID: inputTree[i].ParentId}
	}
	var root *TreeNode
	for i, n := range nodes {
		if n.ParentID == -1 {
			root = n
		} else {
			// simple safety check
			if n.ParentID >= 0 && n.ParentID < len(nodes) {
				nodes[n.ParentID].Children = append(nodes[n.ParentID].Children, nodes[i])
			}
		}
	}

	gen := NewMinimapGenerator(rng)

	// 2. Place Root
	rootShape := getShape(inputTree[root.ID])
	gen.PlaceShape(root.ID, Point{0, 0}, rootShape)

	// Reserve path for root to outside immediately
	rootExitPath := gen.FindPathToOutside(Point{0, 0})
	gen.AddReservation(rootExitPath)

	// 3. Process Tree (BFS to grow outward)
	queue := []*TreeNode{root}

	// Map to track the specific exit path used by a node so we can remove it later
	nodeExitPaths := make(map[int][]Point)
	nodeExitPaths[root.ID] = rootExitPath

	for len(queue) > 0 {
		parent := queue[0]
		queue = queue[1:]

		// We are about to process children.
		// Current state: Parent is placed, Parent has a Reserved Path to outside.

		for i, child := range parent.Children {
			childShape := getShape(inputTree[child.ID])
			placed := false

			// Try to place child around parent
			// We try multiple attempts to find a spot that respects eisting rooms AND reservations
			attempts := 0
			maxAttempts := 20

			parentCenter := gen.GetNodeCenter(parent.ID, getShape(inputTree[parent.ID])) // Simplified center find

			for attempts < maxAttempts {
				// Pick a candidate spot near parent
				candidate := gen.GetRandomPointNear(parentCenter, 5, 15)

				// 1. Check basic collision (rooms + current reservations)
				if gen.CheckCollision(candidate, childShape) {
					attempts++
					continue
				}

				// 2. Check if this new child can reach the outside?
				// We temporarily place to check pathing
				pathOutside := gen.FindPathToOutside(candidate)
				if len(pathOutside) == 0 {
					attempts++
					continue
				}

				// 3. SUCCESS: Commit placement
				gen.PlaceShape(child.ID, candidate, childShape)
				gen.AddReservation(pathOutside)
				nodeExitPaths[child.ID] = pathOutside

				// 4. Connect to Parent (Draw Corridor)
				// Using A* ignoring the parent's specific reservation (logic below)
				corridor := gen.FindPath(candidate, parentCenter, true)
				for _, p := range corridor {
					gen.Grid[p] = child.ID // Mark corridor as part of child or separate ID
				}

				placed = true
				queue = append(queue, child)
				break
			}

			if !placed {
				fmt.Printf("Warning: Could not place child %d of parent %d\n", child.ID, parent.ID)
			}

			// LOGIC: "Before last child of parent is placed remove that parent tmp child"
			// If this is the last child, we can remove the PARENT'S reservation to allow
			// the last child to potentially use that space.
			if i == len(parent.Children)-2 { // -2 because we are currently *on* the second to last?
				// The prompt says "before last child".
				// Actually, safer logic: Once we start placing children, the parent is "surrounded".
				// The parent's reservation is to ensure *at least one* child can get out or be placed.
				// If we remove it now, we free up space for the remaining children.
				gen.RemoveReservation(nodeExitPaths[parent.ID])
			}
		}

		// Fallback: ensure parent reservation is gone if it wasn't removed in loop
		gen.RemoveReservation(nodeExitPaths[parent.ID])
	}

	// 4. Convert to TileLayer (Flatten)
	layer := gen.Export()
	return &tilemap.TileMap{
		Layers: []tilemap.TileLayer{*layer},
	}, nil
}

// --- Helper Methods ---

func (g *MinimapGenerator) PlaceShape(id int, pos Point, shape RoomShape) {
	for _, offset := range shape {
		p := Point{pos[0] + offset[0], pos[1] + offset[1]}
		g.Grid[p] = id
		g.UpdateBounds(p)
	}
}

func (g *MinimapGenerator) UpdateBounds(p Point) {
	if p[0] < g.Bounds.MinX {
		g.Bounds.MinX = p[0]
	}
	if p[0] > g.Bounds.MaxX {
		g.Bounds.MaxX = p[0]
	}
	if p[1] < g.Bounds.MinY {
		g.Bounds.MinY = p[1]
	}
	if p[1] > g.Bounds.MaxY {
		g.Bounds.MaxY = p[1]
	}
}

func (g *MinimapGenerator) CheckCollision(pos Point, shape RoomShape) bool {
	for _, offset := range shape {
		p := Point{pos[0] + offset[0], pos[1] + offset[1]}
		// Check against existing rooms
		if _, exists := g.Grid[p]; exists {
			return true
		}
		// Check against reservations
		if _, reserved := g.Reservations[p]; reserved {
			return true
		}
	}
	return false
}

func (g *MinimapGenerator) AddReservation(path []Point) {
	for _, p := range path {
		g.Reservations[p] = true
	}
}

func (g *MinimapGenerator) RemoveReservation(path []Point) {
	for _, p := range path {
		delete(g.Reservations, p)
	}
}

// FindPathToOutside finds a path from start to outside the current bounding box
func (g *MinimapGenerator) FindPathToOutside(start Point) []Point {
	// Target is any point outside Bounds + Padding
	// Simplified A*: Heuristic is distance to nearest bound edge
	// We treat Reservations as obstacles here (we can't cross another reservation)
	// But we treat Empty Space as Walkable.

	// BFS is usually sufficient for "nearest exit" on unweighted grid
	queue := []Point{start}
	cameFrom := make(map[Point]Point)
	visited := make(map[Point]bool)
	visited[start] = true

	// Limit search depth to prevent infinite loops
	limit := 200

	for len(queue) > 0 && len(visited) < limit*limit {
		current := queue[0]
		queue = queue[1:]

		// Check if outside bounds (plus padding of 2)
		if current[0] < g.Bounds.MinX-2 || current[0] > g.Bounds.MaxX+2 ||
			current[1] < g.Bounds.MinY-2 || current[1] > g.Bounds.MaxY+2 {
			return reconstructPath(cameFrom, current)
		}

		// Neighbors
		dirs := [][2]int{{0, 1}, {0, -1}, {1, 0}, {-1, 0}}
		for _, d := range dirs {
			next := Point{current[0] + d[0], current[1] + d[1]}

			if visited[next] {
				continue
			}

			// Obstacle Check:
			// 1. Cannot walk on existing Grid nodes
			if _, isRoom := g.Grid[next]; isRoom {
				continue
			}
			// 2. Cannot walk on Reservations
			if _, isRes := g.Reservations[next]; isRes {
				continue
			}

			visited[next] = true
			cameFrom[next] = current
			queue = append(queue, next)
		}
	}
	return nil // No path found
}

// FindPath generic A* for connecting rooms
func (g *MinimapGenerator) FindPath(start, end Point, ignoreReservations bool) []Point {
	// Standard A* implementation
	// cost = 1 for empty, high cost for walls (if we allowed digging through rooms)
	// Here we assume we walk through empty space

	type Node struct {
		Pt   Point
		F, G int
	}

	openSet := make(PriorityQueue, 0)
	heap.Init(&openSet)
	heap.Push(&openSet, &Item{Value: Node{Pt: start, G: 0, F: manhattan(start, end)}, Priority: 0})

	cameFrom := make(map[Point]Point)
	gScore := make(map[Point]int)
	gScore[start] = 0

	for openSet.Len() > 0 {
		current := heap.Pop(&openSet).(*Item).Value.(Node).Pt

		if current == end {
			return reconstructPath(cameFrom, end)
		}

		dirs := [][2]int{{0, 1}, {0, -1}, {1, 0}, {-1, 0}}
		for _, d := range dirs {
			next := Point{current[0] + d[0], current[1] + d[1]}

			// Collision logic for corridor:
			// Can walk on empty or the target room.
			_, isRoom := g.Grid[next]
			// We allow walking on the End node (to connect) but not other rooms
			if isRoom && next != end {
				continue
			}

			if !ignoreReservations {
				if _, isRes := g.Reservations[next]; isRes {
					continue
				}
			}

			newG := gScore[current] + 1
			if val, ok := gScore[next]; !ok || newG < val {
				gScore[next] = newG
				f := newG + manhattan(next, end)
				cameFrom[next] = current
				heap.Push(&openSet, &Item{Value: Node{Pt: next, G: newG, F: f}, Priority: f})
			}
		}
	}
	return nil
}

func (g *MinimapGenerator) GetRandomPointNear(center Point, minR, maxR int) Point {
	angle := g.Rng.Float64() * 2 * math.Pi
	dist := float64(minR) + g.Rng.Float64()*float64(maxR-minR)
	return Point{
		center[0] + int(math.Cos(angle)*dist),
		center[1] + int(math.Sin(angle)*dist),
	}
}

func (g *MinimapGenerator) GetNodeCenter(id int, shape RoomShape) Point {
	// scan grid for this ID to find center (slow) or just return first point found
	// optimization: store centers in map
	for p, nodeID := range g.Grid {
		if nodeID == id {
			return p
		}
	}
	return Point{0, 0}
}

func (g *MinimapGenerator) Export() *tilemap.TileLayer {
	width := (g.Bounds.MaxX - g.Bounds.MinX) + 1
	height := (g.Bounds.MaxY - g.Bounds.MinY) + 1

	data := make([]uint32, width*height)

	for p, val := range g.Grid {
		// Normalize coordinates to 0..Width
		x := p[0] - g.Bounds.MinX
		y := p[1] - g.Bounds.MinY
		idx := y*width + x
		if idx >= 0 && idx < len(data) {
			data[idx] = uint32(val + 1) // 0 is empty, so shift IDs by 1
		}
	}

	return &tilemap.TileLayer{
		Width: width,
		Data:  data,
	}
}

// --- Boilerplate Helpers (PQ, Math) ---

func reconstructPath(cameFrom map[Point]Point, current Point) []Point {
	totalPath := []Point{current}
	for {
		prev, ok := cameFrom[current]
		if !ok {
			break
		}
		current = prev
		totalPath = append([]Point{current}, totalPath...)
	}
	return totalPath
}

func manhattan(a, b Point) int {
	return int(math.Abs(float64(a[0]-b[0])) + math.Abs(float64(a[1]-b[1])))
}

// Priority Queue Implementation for A*
type Item struct {
	Value    interface{}
	Priority int
	Index    int
}
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
