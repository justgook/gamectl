package minimap

type Grid map[Point]int
type Point = [2]int

// DoorConnection represents a door tile on the grid
type DoorConnection struct {
	Point     Point // Grid coordinate of the door tile
	RoomID    int   // Which room this door belongs to (1-based)
	Direction uint8 // Bit mask: North=1, East=2, South=4, West=8
}

// Door direction bit masks
const (
	DoorNorth = 1
	DoorEast  = 2
	DoorSouth = 4
	DoorWest  = 8
)

// PlacedShape represents a shape with its placement position
// The slice index + 1 equals the node ID used in grid/tilemap
type PlacedShape struct {
	Points   []Point // Relative tile positions (normalized, origin at 0,0)
	Position Point   // World position (top-left corner of bounding box)
	Width    int
	Height   int
}

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
