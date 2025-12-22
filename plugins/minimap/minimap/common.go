package minimap

import (
	"math"
)

type Grid map[Point]int
type Point = [2]int

// Layout constants for Stage 1
const (
	LevelSpacing = 1 // Vertical spacing between levels
	NodeSpacing  = 0 // Horizontal spacing between siblings
)

// DoorConnection represents a door tile on the grid
type DoorConnection struct {
	Point     Point // Grid coordinate of the door tile
	RoomID    int   // Which room this door belongs to (1-based)
	Direction uint8 // Bit mask: North=1, East=2, South=4, West=8
}

// PathInfo represents a path connection between child and parent
type PathInfo struct {
	ChildID   int              // Child room ID (1-based)
	ParentID  int              // Parent room ID (1-based)
	PathTiles []Point          // Ordered list of path tiles (child → parent direction)
	Doors     []DoorConnection // Door connections for this path
}

// Door direction bit masks
const (
	DoorNorth = 1
	DoorEast  = 2
	DoorSouth = 4
	DoorWest  = 8
)

// calculateDirection determines the direction from one point to an adjacent point
func calculateDirection(fromPoint, toPoint Point) uint8 {
	dx := toPoint[0] - fromPoint[0]
	dy := toPoint[1] - fromPoint[1]

	if dy == -1 {
		return DoorNorth
	}
	if dx == 1 {
		return DoorEast
	}
	if dy == 1 {
		return DoorSouth
	}
	if dx == -1 {
		return DoorWest
	}
	return 0
}

func Grid2Tilemap(input *Grid) ([]uint32, int) {
	if input == nil || len(*input) == 0 {
		return []uint32{}, 0
	}

	// Determine bounding box
	var minX, minY int = ^int(0), ^int(0) // max int
	var maxX, maxY int = math.MinInt, math.MinInt

	for p := range *input {
		x, y := p[0], p[1]
		if x < minX {
			minX = x
		}
		if y < minY {
			minY = y
		}
		if x > maxX {
			maxX = x
		}
		if y > maxY {
			maxY = y
		}
	}

	width := int(maxX - minX + 1)
	height := int(maxY - minY + 1)

	// Allocate result tilemap
	data := make([]uint32, width*height)

	// Fill tilemap
	for p, id := range *input {
		x := int(p[0] - minX)
		y := int(p[1] - minY)
		idx := y*width + x

		// Grid already uses 1-based IDs for rooms
		// Paths use negative IDs, convert to positive for tilemap
		if id < 0 {
			data[idx] = uint32(-id)
		} else {
			data[idx] = uint32(id)
		}
	}

	return data, width
}

// GenerateDoorLayer converts door connections to a tilemap layer
func GenerateDoorLayer(grid *Grid, doors []DoorConnection) ([]uint32, int) {
	if grid == nil || len(*grid) == 0 {
		return []uint32{}, 0
	}

	// Determine bounding box (same as Grid2Tilemap for consistency)
	var minX, minY int = ^int(0), ^int(0) // max int
	var maxX, maxY int = math.MinInt, math.MinInt

	for p := range *grid {
		x, y := p[0], p[1]
		if x < minX {
			minX = x
		}
		if y < minY {
			minY = y
		}
		if x > maxX {
			maxX = x
		}
		if y > maxY {
			maxY = y
		}
	}

	width := int(maxX - minX + 1)
	height := int(maxY - minY + 1)

	// Allocate result tilemap
	data := make([]uint32, width*height)

	// Fill tilemap with door directions
	for _, door := range doors {
		x := int(door.Point[0] - minX)
		y := int(door.Point[1] - minY)
		idx := y*width + x

		// Combine directions if multiple doors on same tile (shouldn't happen in tree)
		data[idx] |= uint32(door.Direction)
	}

	return data, width
}
