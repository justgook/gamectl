package placement

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
)

// Random interface for pluggable random number generation
type Random interface {
	Intn(n int) int
}

// GetRoomShapeFunc is a function that returns the shape for a given node
type GetRoomShapeFunc func(node *tree.Node) RoomShape

// GetExtensionTileFunc is a function that selects which tile to extend with
// Given a list of valid extension tiles, returns the selected one
type GetExtensionTileFunc func(validTiles []Point, rng Random) Point

// DefaultGetExtensionTile randomly selects an extension tile
func DefaultGetExtensionTile(validTiles []Point, rng Random) Point {
	return validTiles[rng.Intn(len(validTiles))]
}

// Generator handles the room placement generation
type Generator struct {
	Tree             *tree.Tree
	GetRoomShape     GetRoomShapeFunc
	GetExtensionTile GetExtensionTileFunc
	Rng              Random
	Placement        *Placement
	Reservations     *ReservationSystem
}

// NewGenerator creates a new generator
func NewGenerator(t *tree.Tree, getRoomShape GetRoomShapeFunc, rng Random) *Generator {
	return &Generator{
		Tree:             t,
		GetRoomShape:     getRoomShape,
		GetExtensionTile: DefaultGetExtensionTile,
		Rng:              rng,
		Placement:        NewPlacement(),
		Reservations:     NewReservationSystem(),
	}
}

// Generate performs the full room placement algorithm
func (g *Generator) Generate() (*Placement, error) {
	return g.generateWithRetry(0)
}

// generateWithRetry attempts placement, retrying if it fails
func (g *Generator) generateWithRetry(attempt int) (*Placement, error) {
	// Reset state for retry
	if attempt > 0 {
		g.Placement = NewPlacement()
		g.Reservations = NewReservationSystem()
		// Consume some random values to create variation on retry
		for i := 0; i < attempt*7; i++ {
			g.Rng.Intn(100)
		}
	}

	if len(*g.Tree) == 0 {
		return g.Placement, nil
	}

	// Get root node
	root := (*g.Tree)[0]
	rootShape := g.GetRoomShape(root)

	// Place root at origin
	rootTiles := rootShape.Translate(Point{0, 0})
	g.Placement.PlaceRoom(0, rootTiles)

	// Check if root has children
	if g.hasChildren(0) {
		g.Placement.MarkUnfinished(0)
		// Initial reservation calculation for root
		g.Placement.UpdateReservations(g.Reservations)
	}

	// BFS traversal
	queue := []int{0} // Node indices to process

	for len(queue) > 0 {
		parentIdx := queue[0]
		queue = queue[1:]

		// Get all children of this node
		children := g.getChildrenIndices(parentIdx)

		for i, childIdx := range children {
			isLastChild := i == len(children)-1

			// Place this child
			err := g.placeChildSafe(parentIdx, childIdx, isLastChild)
			if err != nil {
				// Placement failed - retry if we haven't exceeded max attempts
				if attempt < 10 {
					return g.generateWithRetry(attempt + 1)
				}
				return nil, fmt.Errorf("failed to place node %d after %d attempts: %v", childIdx, attempt+1, err)
			}

			// IMPORTANT: Mark child as unfinished IMMEDIATELY after placing,
			// so that when placing subsequent siblings, we check that they
			// don't block this child's path to outside.
			if g.hasChildren(childIdx) {
				queue = append(queue, childIdx)
				g.Placement.MarkUnfinished(childIdx)
			}

			// Update reservations after each child placement
			// This recalculates critical tiles for all unfinished rooms
			g.Placement.UpdateReservations(g.Reservations)
		}

		// Parent is now finished (all children placed)
		g.Placement.MarkFinished(parentIdx)
		// Update reservations since parent is no longer unfinished
		g.Placement.UpdateReservations(g.Reservations)
	}

	return g.Placement, nil
}

// placeChildSafe is like placeChild but returns error instead of panicking
func (g *Generator) placeChildSafe(parentIdx, childIdx int, isLastChild bool) error {
	parent := g.Placement.Rooms[RoomID(parentIdx+1)]
	childShape := g.GetRoomShape((*g.Tree)[childIdx])
	childHasChildren := g.hasChildren(childIdx)

	// Track extension tiles for cleanup
	extensionTiles := make([]Point, 0)
	originalParentShape := make([]Point, len(parent.CurrentShape))
	copy(originalParentShape, parent.CurrentShape)

	maxIterations := 1000 // Prevent infinite loops
	for iterations := 0; iterations < maxIterations; iterations++ {
		// Find valid positions where child touches parent
		positions := g.Placement.FindTouchingPositions(parent, childShape)

		// Filter positions using reservations and path validation
		positions = g.Placement.FilterValidPositionsWithReservations(
			positions, childShape, childIdx, childHasChildren, g.Reservations,
		)

		if len(positions) > 0 {
			// Pick random valid position
			pos := positions[g.Rng.Intn(len(positions))]
			absoluteTiles := childShape.Translate(pos)

			// Place the child
			g.Placement.PlaceRoom(childIdx, absoluteTiles)

			// Cleanup: find minimal path and remove unnecessary extension tiles
			if len(extensionTiles) > 0 {
				g.cleanupExtensions(parent, originalParentShape, extensionTiles, absoluteTiles)
			}

			return nil
		}

		// No valid position found - extend parent
		extensionTile := g.extendParent(parent)
		if extensionTile == nil {
			return fmt.Errorf("cannot extend parent node %d", parentIdx)
		}
		extensionTiles = append(extensionTiles, *extensionTile)
	}

	return fmt.Errorf("max iterations reached for placing child %d", childIdx)
}

// extendParent adds one tile to parent, ensuring it doesn't block any unfinished room
// and respects reservations (except for the parent's own reservations)
func (g *Generator) extendParent(parent *PlacedRoom) *Point {
	validExtensions := g.Placement.GetValidExtensionTiles(parent)
	if len(validExtensions) == 0 {
		return nil
	}

	// Filter extensions that don't block any unfinished room
	safeExtensions := make([]Point, 0)
	parentRoomID := RoomID(parent.NodeIndex + 1)

	for _, ext := range validExtensions {
		// Check if this extension is on a reserved tile (that's not ours)
		if g.Reservations != nil && !g.Reservations.CanPlaceTile(ext, parentRoomID) {
			continue
		}

		// Temporarily add extension
		g.Placement.Grid[ext] = parentRoomID

		// Check all unfinished rooms still have path to outside
		allSafe := true
		for roomID := range g.Placement.Unfinished {
			room := g.Placement.Rooms[roomID]
			if room == nil {
				continue
			}
			// Include the extension in parent's shape temporarily
			originalShape := parent.CurrentShape
			parent.CurrentShape = append(parent.CurrentShape, ext)

			if !g.Placement.HasPathToOutside(room) {
				allSafe = false
			}

			parent.CurrentShape = originalShape

			if !allSafe {
				break
			}
		}

		// Remove temporary extension
		delete(g.Placement.Grid, ext)

		if allSafe {
			safeExtensions = append(safeExtensions, ext)
		}
	}

	if len(safeExtensions) == 0 {
		// All extensions would block something - this shouldn't happen
		// if the algorithm is working correctly
		return nil
	}

	// Pick random safe extension
	selected := g.GetExtensionTile(safeExtensions, g.Rng)
	g.Placement.ExtendRoom(parent, selected)

	return &selected
}

// cleanupExtensions removes unnecessary extension tiles, keeping only the minimal path
// from original parent shape to the placed child
func (g *Generator) cleanupExtensions(
	parent *PlacedRoom,
	originalShape []Point,
	extensionTiles []Point,
	childTiles []Point,
) {
	// Build set of original parent tiles
	originalSet := make(map[Point]bool)
	for _, p := range originalShape {
		originalSet[p] = true
	}

	// Build set of extension tiles
	extensionSet := make(map[Point]bool)
	for _, p := range extensionTiles {
		extensionSet[p] = true
	}

	// Build set of child tiles
	childSet := make(map[Point]bool)
	for _, p := range childTiles {
		childSet[p] = true
	}

	// Find minimal path from original parent to child through extension tiles
	// BFS from all original parent edges
	type pathNode struct {
		point Point
		path  []Point // extension tiles in path
	}

	visited := make(map[Point]bool)
	queue := make([]pathNode, 0)

	// Start from edges of original parent that touch extension tiles
	for _, p := range originalShape {
		for _, n := range p.Neighbors() {
			if extensionSet[n] && !visited[n] {
				visited[n] = true
				queue = append(queue, pathNode{point: n, path: []Point{n}})
			}
		}
	}

	var minimalPath []Point

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		// Check if we reached the child
		for _, n := range current.point.Neighbors() {
			if childSet[n] {
				// Found path to child!
				minimalPath = current.path
				goto foundPath
			}
		}

		// Continue through extension tiles
		for _, n := range current.point.Neighbors() {
			if extensionSet[n] && !visited[n] {
				visited[n] = true
				newPath := make([]Point, len(current.path)+1)
				copy(newPath, current.path)
				newPath[len(current.path)] = n
				queue = append(queue, pathNode{point: n, path: newPath})
			}
		}
	}

foundPath:
	if minimalPath == nil {
		// Child is directly adjacent to original parent, no extensions needed
		minimalPath = []Point{}
	}

	// Build set of tiles to keep
	keepSet := make(map[Point]bool)
	for _, p := range minimalPath {
		keepSet[p] = true
	}

	// Remove extension tiles not in minimal path
	for _, ext := range extensionTiles {
		if !keepSet[ext] {
			g.Placement.RemoveTile(parent, ext)
		}
	}
}

// hasChildren checks if a node has children in the tree
func (g *Generator) hasChildren(nodeIdx int) bool {
	for _, node := range *g.Tree {
		if node.ParentId == nodeIdx && g.Tree.IndexOf(node) != nodeIdx {
			return true
		}
	}
	return false
}

// getChildrenIndices returns indices of all children of a node
func (g *Generator) getChildrenIndices(parentIdx int) []int {
	children := make([]int, 0)
	for i, node := range *g.Tree {
		if node.ParentId == parentIdx && i != parentIdx {
			children = append(children, i)
		}
	}
	return children
}

// ToTileMap converts the placement to a TileMap
func (p *Placement) ToTileMap() *tilemap.TileMap {
	if len(p.Grid) == 0 {
		return tilemap.NewTileMap()
	}

	// Get bounding box
	minX, minY, maxX, maxY := p.GetBoundingBox()
	width := maxX - minX + 1
	height := maxY - minY + 1

	// Create layer
	layer := tilemap.NewTileLayer(width, height)

	// Fill in room IDs (offset by 1, as RoomID is already nodeIndex+1)
	for pos, roomID := range p.Grid {
		x := pos.X - minX
		y := pos.Y - minY
		idx := y*width + x
		layer.Data[idx] = uint32(roomID)
	}

	tm := tilemap.NewTileMap()
	tm.Layers = append(tm.Layers, *layer)

	return tm
}
