package minimap

import "fmt"

// DoorDirection holds the door positions for connecting rooms
type DoorDirection struct {
	Exit     [3]int // [x, y, doorMask]
	Entrance [3]int // [x, y, doorMask]
}

// FindDoorDirection calculates door positions between two rooms
// existingRoom is a slice of coordinates representing the existing room
// newTile is the coordinate where the new room is being connected
func FindDoorDirection(existingRoom []Coordinate, newTile Coordinate) (*DoorDirection, error) {
	newX, newY := newTile[0], newTile[1]

	// Direction to door bitmask mappings
	directions := map[[2]int]int{
		{0, -1}: DoorNorth,
		{0, 1}:  DoorSouth,
		{1, 0}:  DoorEast,
		{-1, 0}: DoorWest,
	}

	// Opposite directions
	opposite := map[int]int{
		DoorNorth: DoorSouth,
		DoorSouth: DoorNorth,
		DoorEast:  DoorWest,
		DoorWest:  DoorEast,
	}

	// Find an adjacent tile in the existing room
	for _, coord := range existingRoom {
		roomX, roomY := coord[0], coord[1]
		dx := newX - roomX
		dy := newY - roomY

		// Check if tiles are adjacent (Manhattan distance = 1)
		if dx*dx+dy*dy == 1 {
			dirKey := [2]int{dx, dy}
			exitDir := directions[dirKey]
			entranceDir := opposite[exitDir]

			return &DoorDirection{
				Exit:     [3]int{roomX, roomY, exitDir},
				Entrance: [3]int{newX, newY, entranceDir},
			}, nil
		}
	}

	return nil, fmt.Errorf("no adjacent tiles found between existing room and new tile [%d, %d]", newX, newY)
}
