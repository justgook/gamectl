package placement

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap/roomgen"
)

// PlacedRoom represents a room that has been placed in the grid
type PlacedRoom struct {
	*roomgen.Room
	Node   *tree.Node
	Placed bool
}

// Grid represents a dynamic grid that can grow as needed
type Grid struct {
	minX, minY, maxX, maxY int
	rooms                  map[[2]int]*PlacedRoom // Position -> Room mapping for quick lookup
	allRooms               []*PlacedRoom          // All placed rooms
}

// NewGrid creates a new dynamic grid
func NewGrid() *Grid {
	return &Grid{
		rooms:    make(map[[2]int]*PlacedRoom),
		allRooms: make([]*PlacedRoom, 0),
	}
}

// PlacementEngine implements the TinyKeep-inspired physics-based placement algorithm
type PlacementEngine struct {
	grid      *Grid
	roomGen   *roomgen.RoomGenerator
	rng       roomgen.Random
	maxTries  int
	gridScale int // How much to expand search area each iteration
}

// NewPlacementEngine creates a new placement engine
func NewPlacementEngine(roomGen *roomgen.RoomGenerator, rng roomgen.Random) *PlacementEngine {
	return &PlacementEngine{
		grid:      NewGrid(),
		roomGen:   roomGen,
		rng:       rng,
		maxTries:  1000, // Maximum attempts per room
		gridScale: 2,    // Grid expansion factor
	}
}

// PlaceTree places all nodes from a tree into the grid ensuring parent-child adjacency
func (pe *PlacementEngine) PlaceTree(t *tree.Tree) ([]*PlacedRoom, error) {
	if len(*t) == 0 {
		return nil, nil
	}

	// Reset grid
	pe.grid = NewGrid()

	// Create rooms for all nodes
	rooms := make([]*PlacedRoom, len(*t))
	for i, node := range *t {
		shape := pe.roomGen.GetRoomShape(node)
		normalizedShape := pe.roomGen.NormalizeShape(shape)

		rooms[i] = &PlacedRoom{
			Room: &roomgen.Room{
				Shape:  normalizedShape,
				NodeID: i,
			},
			Node:   node,
			Placed: false,
		}
	}

	// Place root first at origin
	root := rooms[0]
	root.Position = [2]int{0, 0}
	root.Placed = true
	pe.grid.addRoom(root)

	// Place remaining rooms using parent-centric placement
	queue := []*PlacedRoom{root}

	for len(queue) > 0 {
		parent := queue[0]
		queue = queue[1:]

		// Find all children of this parent
		children := pe.getChildren(t, parent, rooms)

		// Place each child adjacent to its parent, extending parent if needed
		for _, child := range children {
			if child.Placed {
				continue
			}

			success := pe.placeChildAdjacentToParent(child, parent)
			if !success {
				// If we can't place adjacent, extend the parent's shape
				pe.extendParentForChild(parent, child)
				success = pe.placeChildAdjacentToParent(child, parent)
			}

			if success {
				child.Placed = true
				pe.grid.addRoom(child)
				queue = append(queue, child)
			} else {
				// Last resort: place safely and create corridor later
				pe.placeRoomSafely(child)
				child.Placed = true
				pe.grid.addRoom(child)
				queue = append(queue, child)
			}
		}
	}

	return pe.grid.allRooms, nil
}

// getChildren returns all child rooms of a parent room
func (pe *PlacementEngine) getChildren(t *tree.Tree, parent *PlacedRoom, allRooms []*PlacedRoom) []*PlacedRoom {
	var children []*PlacedRoom
	parentIdx := parent.Room.NodeID

	for _, room := range allRooms {
		if room.Node.ParentId == parentIdx && !room.Placed {
			children = append(children, room)
		}
	}

	return children
}

// placeChildAdjacentToParent attempts to place a child room directly adjacent to its parent
func (pe *PlacementEngine) placeChildAdjacentToParent(child, parent *PlacedRoom) bool {
	// Get all tiles of the parent room
	parentTiles := pe.roomGen.GetRoomTiles(parent.Room)

	// Try to place adjacent to each parent tile
	for _, parentTile := range parentTiles {
		// Try all 4 directions from this parent tile
		directions := [][2]int{{0, 1}, {1, 0}, {0, -1}, {-1, 0}}

		for _, dir := range directions {
			// Calculate potential position for child room
			// Position the child so that one of its tiles is adjacent to the parent tile
			testPos := [2]int{
				parentTile[0] + dir[0],
				parentTile[1] + dir[1],
			}

			// Try different alignments of the child room shape
			for _, childTile := range child.Room.Shape {
				// Calculate room position so this child tile ends up at testPos
				roomPos := [2]int{
					testPos[0] - childTile[0],
					testPos[1] - childTile[1],
				}

				if pe.canPlaceRoomAt(child.Room, roomPos) {
					// Verify adjacency after placement
					tempChild := &roomgen.Room{
						Shape:    child.Room.Shape,
						Position: roomPos,
						NodeID:   child.Room.NodeID,
					}

					if pe.roomGen.AreRoomsAdjacent(tempChild, parent.Room) {
						child.Position = roomPos
						return true
					}
				}
			}
		}
	}

	return false
}

// placeRoomAnywhere tries to place a room anywhere in the current grid
func (pe *PlacementEngine) placeRoomAnywhere(room *PlacedRoom) bool {
	// Try random positions within the current grid bounds
	for attempt := 0; attempt < pe.maxTries; attempt++ {
		x := pe.grid.minX - 5 + pe.rng.Intn((pe.grid.maxX-pe.grid.minX)+10)
		y := pe.grid.minY - 5 + pe.rng.Intn((pe.grid.maxY-pe.grid.minY)+10)

		pos := [2]int{x, y}
		if pe.canPlaceRoomAt(room.Room, pos) {
			room.Position = pos
			return true
		}
	}

	return false
}

// placeRoomSafely places a room at a guaranteed safe location (fallback)
func (pe *PlacementEngine) placeRoomSafely(room *PlacedRoom) {
	// Find a position that's guaranteed to not overlap
	// Place it far enough from all existing rooms
	safeDistance := 20

	// Try positions in a grid pattern
	for x := pe.grid.minX - safeDistance; ; x += safeDistance {
		for y := pe.grid.minY - safeDistance; y <= pe.grid.maxY+safeDistance; y += safeDistance {
			pos := [2]int{x, y}
			if pe.canPlaceRoomAt(room.Room, pos) {
				room.Position = pos
				return
			}
		}
	}
}

// canPlaceRoomAt checks if a room can be placed at the given position
func (pe *PlacementEngine) canPlaceRoomAt(room *roomgen.Room, pos [2]int) bool {
	// Create a temporary room at this position
	tempRoom := &roomgen.Room{
		Shape:    room.Shape,
		Position: pos,
		NodeID:   room.NodeID,
	}

	// Check for overlaps with all existing rooms
	for _, existingRoom := range pe.grid.allRooms {
		if pe.roomGen.DoesRoomOverlap(tempRoom, existingRoom.Room) {
			return false
		}
	}

	return true
}

// addRoom adds a room to the grid and updates bounds
func (g *Grid) addRoom(room *PlacedRoom) {
	// Add to rooms map for quick lookup
	g.rooms[room.Position] = room
	g.allRooms = append(g.allRooms, room)

	// Update grid bounds
	roomTiles := make([][2]int, len(room.Shape))
	for i, tile := range room.Shape {
		roomTiles[i] = [2]int{room.Position[0] + tile[0], room.Position[1] + tile[1]}
	}

	for _, tile := range roomTiles {
		if len(g.allRooms) == 1 { // First room
			g.minX, g.maxX = tile[0], tile[0]
			g.minY, g.maxY = tile[1], tile[1]
		} else {
			if tile[0] < g.minX {
				g.minX = tile[0]
			}
			if tile[0] > g.maxX {
				g.maxX = tile[0]
			}
			if tile[1] < g.minY {
				g.minY = tile[1]
			}
			if tile[1] > g.maxY {
				g.maxY = tile[1]
			}
		}
	}
}

// GetBounds returns the current bounds of the grid
func (g *Grid) GetBounds() (minX, minY, maxX, maxY int) {
	return g.minX, g.minY, g.maxX, g.maxY
}

// GetRoomAt returns the room at the given position, if any
func (g *Grid) GetRoomAt(pos [2]int) *PlacedRoom {
	return g.rooms[pos]
}

// GetAllRooms returns all placed rooms
func (g *Grid) GetAllRooms() []*PlacedRoom {
	return g.allRooms
}

// extendParentForChild extends the parent room's shape to create space for a child
func (pe *PlacementEngine) extendParentForChild(parent, child *PlacedRoom) {
	// Find the best direction to extend the parent
	parentTiles := pe.roomGen.GetRoomTiles(parent.Room)

	// Try extending in each direction
	directions := [][2]int{{0, 1}, {1, 0}, {0, -1}, {-1, 0}}

	for _, dir := range directions {
		// Find edge tiles in this direction
		edgeTiles := pe.findEdgeTiles(parentTiles, dir)

		// Try extending from each edge tile
		for _, edgeTile := range edgeTiles {
			extensionTile := [2]int{
				edgeTile[0] + dir[0],
				edgeTile[1] + dir[1],
			}

			// Check if this extension tile is free
			if pe.isTileFree(extensionTile) {
				// Add this tile to the parent's shape
				relativeTile := [2]int{
					extensionTile[0] - parent.Position[0],
					extensionTile[1] - parent.Position[1],
				}
				parent.Room.Shape = append(parent.Room.Shape, relativeTile)

				// Update grid bounds
				pe.grid.updateBoundsForTile(extensionTile)

				// Try to place child adjacent to this new tile
				if pe.tryPlaceChildAdjacentToTile(child, extensionTile, parent) {
					return
				}
			}
		}
	}
}

// findEdgeTiles finds tiles on the edge of a room in a given direction
func (pe *PlacementEngine) findEdgeTiles(roomTiles [][2]int, direction [2]int) [][2]int {
	var edgeTiles [][2]int
	tileSet := make(map[[2]int]bool)

	// Create a set for quick lookup
	for _, tile := range roomTiles {
		tileSet[tile] = true
	}

	// Find tiles that have no neighbor in the given direction
	for _, tile := range roomTiles {
		neighborTile := [2]int{
			tile[0] + direction[0],
			tile[1] + direction[1],
		}

		if !tileSet[neighborTile] {
			edgeTiles = append(edgeTiles, tile)
		}
	}

	return edgeTiles
}

// isTileFree checks if a tile position is not occupied by any room
func (pe *PlacementEngine) isTileFree(tile [2]int) bool {
	for _, room := range pe.grid.allRooms {
		roomTiles := pe.roomGen.GetRoomTiles(room.Room)
		for _, roomTile := range roomTiles {
			if roomTile[0] == tile[0] && roomTile[1] == tile[1] {
				return false
			}
		}
	}
	return true
}

// tryPlaceChildAdjacentToTile tries to place a child room adjacent to a specific tile
func (pe *PlacementEngine) tryPlaceChildAdjacentToTile(child *PlacedRoom, targetTile [2]int, parent *PlacedRoom) bool {
	directions := [][2]int{{0, 1}, {1, 0}, {0, -1}, {-1, 0}}

	for _, dir := range directions {
		testPos := [2]int{
			targetTile[0] + dir[0],
			targetTile[1] + dir[1],
		}

		// Try different alignments of the child room shape
		for _, childTile := range child.Room.Shape {
			roomPos := [2]int{
				testPos[0] - childTile[0],
				testPos[1] - childTile[1],
			}

			if pe.canPlaceRoomAt(child.Room, roomPos) {
				// Verify adjacency
				tempChild := &roomgen.Room{
					Shape:    child.Room.Shape,
					Position: roomPos,
					NodeID:   child.Room.NodeID,
				}

				if pe.roomGen.AreRoomsAdjacent(tempChild, parent.Room) {
					child.Position = roomPos
					return true
				}
			}
		}
	}

	return false
}

// updateBoundsForTile updates grid bounds for a single tile
func (g *Grid) updateBoundsForTile(tile [2]int) {
	if len(g.allRooms) == 0 {
		g.minX, g.maxX = tile[0], tile[0]
		g.minY, g.maxY = tile[1], tile[1]
	} else {
		if tile[0] < g.minX {
			g.minX = tile[0]
		}
		if tile[0] > g.maxX {
			g.maxX = tile[0]
		}
		if tile[1] < g.minY {
			g.minY = tile[1]
		}
		if tile[1] > g.maxY {
			g.maxY = tile[1]
		}
	}
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// GetPlacementStats returns statistics about the placement
func (pe *PlacementEngine) GetPlacementStats() map[string]interface{} {
	stats := make(map[string]interface{})

	minX, minY, maxX, maxY := pe.grid.GetBounds()
	stats["gridWidth"] = maxX - minX + 1
	stats["gridHeight"] = maxY - minY + 1
	stats["totalRooms"] = len(pe.grid.allRooms)
	stats["gridArea"] = (maxX - minX + 1) * (maxY - minY + 1)

	// Calculate room density
	totalRoomTiles := 0
	for _, room := range pe.grid.allRooms {
		totalRoomTiles += len(room.Shape)
	}
	stats["roomDensity"] = float64(totalRoomTiles) / float64(stats["gridArea"].(int))

	return stats
}

// ValidatePlacement checks if all parent-child relationships are properly connected
func (pe *PlacementEngine) ValidatePlacement(t *tree.Tree) map[string]interface{} {
	validation := make(map[string]interface{})

	connectedPairs := 0
	totalPairs := 0
	disconnectedPairs := make([]string, 0)
	parentChildDetails := make([]map[string]interface{}, 0)

	for _, room := range pe.grid.allRooms {
		if room.Node.ParentId >= 0 && room.Node.ParentId < len(*t) {
			totalPairs++

			// Find parent room
			var parentRoom *PlacedRoom
			for _, r := range pe.grid.allRooms {
				if r.Room.NodeID == room.Node.ParentId {
					parentRoom = r
					break
				}
			}

			if parentRoom != nil {
				isAdjacent := pe.roomGen.AreRoomsAdjacent(room.Room, parentRoom.Room)

				detail := map[string]interface{}{
					"childNode":  room.Room.NodeID,
					"parentNode": room.Node.ParentId,
					"isAdjacent": isAdjacent,
					"childPos":   room.Position,
					"parentPos":  parentRoom.Position,
				}
				parentChildDetails = append(parentChildDetails, detail)

				if isAdjacent {
					connectedPairs++
				} else {
					disconnectedPairs = append(disconnectedPairs,
						fmt.Sprintf("Node %d -> Parent %d", room.Room.NodeID, room.Node.ParentId))
				}
			}
		}
	}

	validation["totalParentChildPairs"] = totalPairs
	validation["connectedPairs"] = connectedPairs
	validation["disconnectedPairs"] = disconnectedPairs
	validation["connectionRate"] = float64(connectedPairs) / float64(totalPairs)
	validation["parentChildDetails"] = parentChildDetails

	return validation
}
