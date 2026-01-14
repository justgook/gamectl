package gen

import (
	"github.com/justgook/gamectl/pkg/tilemap"
)

// RoomInfo contains information about a single room extracted from tilemap
type RoomInfo struct {
	ID     int        // Room ID (from rooms layer)
	Bounds Rect       // Bounding box of the room
	Tiles  []Point    // All tiles belonging to this room
	Shape  *RoomShape // Actual shape for non-rectangular rooms
	Exits  []ExitInfo // All exits (doors) for this room
}

// ExtractRooms extracts room information from a tilemap
// The tilemap should have a "rooms" layer and a "doors" layer
func ExtractRooms(tm *tilemap.TileMap) (map[int]*RoomInfo, error) {
	rooms := make(map[int]*RoomInfo)

	// Find the rooms layer
	var roomsLayer *tilemap.TileLayer
	var doorsLayer *tilemap.TileLayer

	for i := range tm.Layers {
		layer := &tm.Layers[i]
		if name, ok := layer.Props["name"]; ok && name == "rooms" {
			roomsLayer = layer
		}
		if layerType, ok := layer.Props["type"]; ok && layerType == "doors" {
			doorsLayer = layer
		}
	}

	if roomsLayer == nil {
		return rooms, nil // No rooms layer, return empty
	}

	width := roomsLayer.Width
	height := roomsLayer.Height()

	// Extract room tiles
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			idx := y*width + x
			roomID := int(roomsLayer.Data[idx])
			if roomID == 0 {
				continue // Empty tile
			}

			room, exists := rooms[roomID]
			if !exists {
				room = &RoomInfo{
					ID:    roomID,
					Tiles: []Point{},
					Exits: []ExitInfo{},
					Bounds: Rect{
						X:      x,
						Y:      y,
						Width:  1,
						Height: 1,
					},
				}
				rooms[roomID] = room
			}

			room.Tiles = append(room.Tiles, Point{x, y})

			// Update bounding box
			if x < room.Bounds.X {
				room.Bounds.Width += room.Bounds.X - x
				room.Bounds.X = x
			}
			if y < room.Bounds.Y {
				room.Bounds.Height += room.Bounds.Y - y
				room.Bounds.Y = y
			}
			if x >= room.Bounds.X+room.Bounds.Width {
				room.Bounds.Width = x - room.Bounds.X + 1
			}
			if y >= room.Bounds.Y+room.Bounds.Height {
				room.Bounds.Height = y - room.Bounds.Y + 1
			}
		}
	}

	// Build room shapes from tile sets
	for _, room := range rooms {
		room.Shape = NewRoomShape(room.Tiles)
	}

	// Extract door information if doors layer exists
	if doorsLayer != nil {
		extractDoors(rooms, roomsLayer, doorsLayer)
	}

	return rooms, nil
}

// extractDoors extracts door information and associates with rooms
func extractDoors(rooms map[int]*RoomInfo, roomsLayer, doorsLayer *tilemap.TileLayer) {
	width := doorsLayer.Width
	height := doorsLayer.Height()

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			idx := y*width + x
			doorMask := uint8(doorsLayer.Data[idx])
			if doorMask == 0 {
				continue // No door here
			}

			// Find which room this door belongs to
			roomID := int(roomsLayer.Data[idx])
			room, exists := rooms[roomID]
			if !exists {
				continue // Door tile not in any room
			}

			// Process each direction in the door mask
			if doorMask&DoorNorth != 0 {
				addDoorToRoom(room, Point{x, y}, DoorNorth, roomID)
			}
			if doorMask&DoorEast != 0 {
				addDoorToRoom(room, Point{x, y}, DoorEast, roomID)
			}
			if doorMask&DoorSouth != 0 {
				addDoorToRoom(room, Point{x, y}, DoorSouth, roomID)
			}
			if doorMask&DoorWest != 0 {
				addDoorToRoom(room, Point{x, y}, DoorWest, roomID)
			}
		}
	}

	// Merge adjacent door tiles into single exits
	for _, room := range rooms {
		room.Exits = mergeDoors(room.Exits)
	}
}

// addDoorToRoom adds a door tile to a room's exit list
func addDoorToRoom(room *RoomInfo, pos Point, direction uint8, roomID int) {
	// Check if we can merge with existing exit
	for i := range room.Exits {
		exit := &room.Exits[i]
		if exit.Direction == direction {
			// Check if adjacent to existing door tiles
			for _, tile := range exit.DoorTiles {
				if isAdjacent(pos, tile) {
					exit.DoorTiles = append(exit.DoorTiles, pos)
					return
				}
			}
		}
	}

	// Create new exit
	room.Exits = append(room.Exits, ExitInfo{
		Direction: direction,
		DoorTiles: []Point{pos},
		RoomID:    roomID,
	})
}

// isAdjacent checks if two points are orthogonally adjacent
func isAdjacent(a, b Point) bool {
	dx := a.X - b.X
	dy := a.Y - b.Y
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}
	return (dx == 1 && dy == 0) || (dx == 0 && dy == 1)
}

// mergeDoors merges adjacent door tiles with same direction
func mergeDoors(exits []ExitInfo) []ExitInfo {
	if len(exits) <= 1 {
		return exits
	}

	merged := []ExitInfo{}

	for _, exit := range exits {
		foundMerge := false

		for i := range merged {
			if merged[i].Direction != exit.Direction {
				continue
			}

			// Check if any tiles are adjacent
			canMerge := false
			for _, newTile := range exit.DoorTiles {
				for _, existingTile := range merged[i].DoorTiles {
					if isAdjacent(newTile, existingTile) {
						canMerge = true
						break
					}
				}
				if canMerge {
					break
				}
			}

			if canMerge {
				merged[i].DoorTiles = append(merged[i].DoorTiles, exit.DoorTiles...)
				foundMerge = true
				break
			}
		}

		if !foundMerge {
			merged = append(merged, exit)
		}
	}

	return merged
}

// ExitCenter calculates the center point of an exit
func ExitCenter(exit *ExitInfo) Point {
	if len(exit.DoorTiles) == 0 {
		return Point{}
	}

	sumX, sumY := 0, 0
	for _, tile := range exit.DoorTiles {
		sumX += tile.X
		sumY += tile.Y
	}

	return Point{
		X: sumX / len(exit.DoorTiles),
		Y: sumY / len(exit.DoorTiles),
	}
}

// CreateExitNodes creates navigation nodes from room exits
func CreateExitNodes(room *RoomInfo) []NavNode {
	nodes := make([]NavNode, len(room.Exits))

	for i := range room.Exits {
		exit := &room.Exits[i]
		center := ExitCenter(exit)

		// Adjust center to be inside room (1 tile inward from edge)
		switch exit.Direction {
		case DoorNorth:
			center.Y++ // Move down into room
		case DoorSouth:
			center.Y-- // Move up into room
		case DoorEast:
			center.X-- // Move left into room
		case DoorWest:
			center.X++ // Move right into room
		}

		// Ensure the position is actually inside the room tiles
		// This handles non-rectangular rooms
		if room.Shape != nil && !room.Shape.Contains(center) {
			center = room.Shape.FindNearestInside(center)
		}

		nodes[i] = NavNode{
			ID:       i,
			Position: center,
			Type:     NodeExit,
			Exit:     exit,
		}
	}

	return nodes
}
