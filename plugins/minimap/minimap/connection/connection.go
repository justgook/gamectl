package connection

import (
	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap/placement"
	"github.com/justgook/gamectl/plugins/minimap/minimap/roomgen"
)

// Corridor represents a corridor connecting two rooms
type Corridor struct {
	Tiles    [][2]int // All tiles that make up the corridor
	FromRoom int      // NodeID of the source room
	ToRoom   int      // NodeID of the destination room
}

// ConnectionEngine handles connecting rooms that aren't directly adjacent
type ConnectionEngine struct {
	roomGen *roomgen.RoomGenerator
	rng     roomgen.Random
}

// NewConnectionEngine creates a new connection engine
func NewConnectionEngine(roomGen *roomgen.RoomGenerator, rng roomgen.Random) *ConnectionEngine {
	return &ConnectionEngine{
		roomGen: roomGen,
		rng:     rng,
	}
}

// ConnectRooms ensures all parent-child room pairs are connected
// With the new placement algorithm, most rooms should already be adjacent
func (ce *ConnectionEngine) ConnectRooms(t *tree.Tree, rooms []*placement.PlacedRoom) ([]*Corridor, error) {
	var corridors []*Corridor

	// Check each parent-child relationship
	for _, room := range rooms {
		if room.Node.ParentId >= 0 && room.Node.ParentId < len(*t) {
			// Find parent room
			var parentRoom *placement.PlacedRoom
			for _, r := range rooms {
				if r.Room.NodeID == room.Node.ParentId {
					parentRoom = r
					break
				}
			}

			if parentRoom != nil {
				// Check if rooms are already adjacent
				if !ce.roomGen.AreRoomsAdjacent(room.Room, parentRoom.Room) {
					// Try to extend parent room to connect with child
					ce.ExtendParentToConnectChild(parentRoom, room)

					// If still not adjacent, create corridor as last resort
					if !ce.roomGen.AreRoomsAdjacent(room.Room, parentRoom.Room) {
						corridor := ce.createCorridor(room, parentRoom, rooms)
						if corridor != nil {
							corridors = append(corridors, corridor)
						}
					}
				}
			}
		}
	}

	return corridors, nil
}

// createCorridor creates a corridor between two rooms
func (ce *ConnectionEngine) createCorridor(room1, room2 *placement.PlacedRoom, allRooms []*placement.PlacedRoom) *Corridor {
	// Find the closest tiles between the two rooms
	tiles1 := ce.roomGen.GetRoomTiles(room1.Room)
	tiles2 := ce.roomGen.GetRoomTiles(room2.Room)

	var closestTile1, closestTile2 [2]int
	minDistance := float64(999999)

	for _, tile1 := range tiles1 {
		for _, tile2 := range tiles2 {
			distance := ce.manhattanDistance(tile1, tile2)
			if distance < minDistance {
				minDistance = distance
				closestTile1 = tile1
				closestTile2 = tile2
			}
		}
	}

	// Create L-shaped corridor between the closest tiles
	corridorTiles := ce.createLShapedPath(closestTile1, closestTile2, allRooms)

	return &Corridor{
		Tiles:    corridorTiles,
		FromRoom: room1.Room.NodeID,
		ToRoom:   room2.Room.NodeID,
	}
}

// createLShapedPath creates an L-shaped path between two points
func (ce *ConnectionEngine) createLShapedPath(start, end [2]int, allRooms []*placement.PlacedRoom) [][2]int {
	var path [][2]int

	// Decide whether to go horizontal first or vertical first
	// Use randomness to add variety
	horizontalFirst := ce.rng.Float64() < 0.5

	if horizontalFirst {
		// Go horizontal first, then vertical
		current := start

		// Horizontal movement
		if start[0] < end[0] {
			for x := start[0] + 1; x <= end[0]; x++ {
				current = [2]int{x, start[1]}
				if !ce.tileOccupiedByRoom(current, allRooms) {
					path = append(path, current)
				}
			}
		} else {
			for x := start[0] - 1; x >= end[0]; x-- {
				current = [2]int{x, start[1]}
				if !ce.tileOccupiedByRoom(current, allRooms) {
					path = append(path, current)
				}
			}
		}

		// Vertical movement
		if start[1] < end[1] {
			for y := start[1] + 1; y <= end[1]; y++ {
				current = [2]int{end[0], y}
				if !ce.tileOccupiedByRoom(current, allRooms) {
					path = append(path, current)
				}
			}
		} else {
			for y := start[1] - 1; y >= end[1]; y-- {
				current = [2]int{end[0], y}
				if !ce.tileOccupiedByRoom(current, allRooms) {
					path = append(path, current)
				}
			}
		}
	} else {
		// Go vertical first, then horizontal
		current := start

		// Vertical movement
		if start[1] < end[1] {
			for y := start[1] + 1; y <= end[1]; y++ {
				current = [2]int{start[0], y}
				if !ce.tileOccupiedByRoom(current, allRooms) {
					path = append(path, current)
				}
			}
		} else {
			for y := start[1] - 1; y >= end[1]; y-- {
				current = [2]int{start[0], y}
				if !ce.tileOccupiedByRoom(current, allRooms) {
					path = append(path, current)
				}
			}
		}

		// Horizontal movement
		if start[0] < end[0] {
			for x := start[0] + 1; x <= end[0]; x++ {
				current = [2]int{x, end[1]}
				if !ce.tileOccupiedByRoom(current, allRooms) {
					path = append(path, current)
				}
			}
		} else {
			for x := start[0] - 1; x >= end[0]; x-- {
				current = [2]int{x, end[1]}
				if !ce.tileOccupiedByRoom(current, allRooms) {
					path = append(path, current)
				}
			}
		}
	}

	return path
}

// tileOccupiedByRoom checks if a tile is occupied by any room
func (ce *ConnectionEngine) tileOccupiedByRoom(tile [2]int, allRooms []*placement.PlacedRoom) bool {
	for _, room := range allRooms {
		roomTiles := ce.roomGen.GetRoomTiles(room.Room)
		for _, roomTile := range roomTiles {
			if roomTile[0] == tile[0] && roomTile[1] == tile[1] {
				return true
			}
		}
	}
	return false
}

// manhattanDistance calculates the Manhattan distance between two points
func (ce *ConnectionEngine) manhattanDistance(p1, p2 [2]int) float64 {
	return float64(abs(p1[0]-p2[0]) + abs(p1[1]-p2[1]))
}

// ExtendParentToConnectChild extends a parent room's shape to connect with its child
func (ce *ConnectionEngine) ExtendParentToConnectChild(parent, child *placement.PlacedRoom) {
	// Find the closest tiles between parent and child
	parentTiles := ce.roomGen.GetRoomTiles(parent.Room)
	childTiles := ce.roomGen.GetRoomTiles(child.Room)

	var closestParentTile, closestChildTile [2]int
	minDistance := float64(999999)

	for _, pTile := range parentTiles {
		for _, cTile := range childTiles {
			distance := ce.manhattanDistance(pTile, cTile)
			if distance < minDistance {
				minDistance = distance
				closestParentTile = pTile
				closestChildTile = cTile
			}
		}
	}

	// Create a direct path from parent to child
	extensionTiles := ce.createDirectPath(closestParentTile, closestChildTile)

	// Add extension tiles to parent room (excluding the last tile which belongs to child)
	for i, tile := range extensionTiles {
		if i < len(extensionTiles)-1 { // Don't include the child's tile
			relativeTile := [2]int{
				tile[0] - parent.Position[0],
				tile[1] - parent.Position[1],
			}
			parent.Room.Shape = append(parent.Room.Shape, relativeTile)
		}
	}
}

// ExtendRoomForConnection extends a room's shape to connect with another room
func (ce *ConnectionEngine) ExtendRoomForConnection(room *placement.PlacedRoom, targetTile [2]int) {
	// Find the closest tile in the room to the target
	roomTiles := ce.roomGen.GetRoomTiles(room.Room)
	var closestTile [2]int
	minDistance := float64(999999)

	for _, tile := range roomTiles {
		distance := ce.manhattanDistance(tile, targetTile)
		if distance < minDistance {
			minDistance = distance
			closestTile = tile
		}
	}

	// Add tiles to extend the room toward the target
	extensionTiles := ce.createDirectPath(closestTile, targetTile)

	// Convert absolute positions to relative positions for the room shape
	for _, tile := range extensionTiles {
		relativeTile := [2]int{
			tile[0] - room.Position[0],
			tile[1] - room.Position[1],
		}
		room.Room.Shape = append(room.Room.Shape, relativeTile)
	}
}

// createDirectPath creates a direct path between two points
func (ce *ConnectionEngine) createDirectPath(start, end [2]int) [][2]int {
	var path [][2]int
	current := start

	// Move horizontally first
	for current[0] != end[0] {
		if current[0] < end[0] {
			current[0]++
		} else {
			current[0]--
		}
		path = append(path, current)
	}

	// Then move vertically
	for current[1] != end[1] {
		if current[1] < end[1] {
			current[1]++
		} else {
			current[1]--
		}
		path = append(path, current)
	}

	return path
}

// ValidateConnections checks if all parent-child pairs are connected
func (ce *ConnectionEngine) ValidateConnections(t *tree.Tree, rooms []*placement.PlacedRoom, corridors []*Corridor) map[string]interface{} {
	validation := make(map[string]interface{})

	connectedPairs := 0
	totalPairs := 0

	for _, room := range rooms {
		if room.Node.ParentId >= 0 && room.Node.ParentId < len(*t) {
			totalPairs++

			// Find parent room
			var parentRoom *placement.PlacedRoom
			for _, r := range rooms {
				if r.Room.NodeID == room.Node.ParentId {
					parentRoom = r
					break
				}
			}

			if parentRoom != nil {
				// Check if directly adjacent
				if ce.roomGen.AreRoomsAdjacent(room.Room, parentRoom.Room) {
					connectedPairs++
				} else {
					// Check if connected via corridor
					connected := false
					for _, corridor := range corridors {
						if (corridor.FromRoom == room.Room.NodeID && corridor.ToRoom == parentRoom.Room.NodeID) ||
							(corridor.FromRoom == parentRoom.Room.NodeID && corridor.ToRoom == room.Room.NodeID) {
							connected = true
							break
						}
					}
					if connected {
						connectedPairs++
					}
				}
			}
		}
	}

	validation["totalParentChildPairs"] = totalPairs
	validation["connectedPairs"] = connectedPairs
	validation["connectionRate"] = float64(connectedPairs) / float64(totalPairs)
	validation["totalCorridors"] = len(corridors)

	return validation
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
