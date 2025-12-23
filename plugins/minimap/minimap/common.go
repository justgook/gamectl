package minimap

import (
	"math"
)

type Grid map[Point]int
type Point = [2]int

// Layout constants for Stage 1
const (
	LevelSpacing = 1 // Spacing between levels (along primary axis)
	NodeSpacing  = 2 // Spacing between siblings (along secondary axis)
)

// LayoutDirection defines how the tree is laid out spatially
type LayoutDirection int

const (
	// TopDown places root at top, children grow downward (Y increases)
	// Siblings spread horizontally (X axis)
	TopDown LayoutDirection = iota

	// BottomUp places root at bottom, children grow upward (Y decreases)
	// Siblings spread horizontally (X axis)
	BottomUp

	// LeftToRight places root on left, children grow rightward (X increases)
	// Siblings spread vertically (Y axis)
	LeftToRight

	// RightToLeft places root on right, children grow leftward (X decreases)
	// Siblings spread vertically (Y axis)
	RightToLeft

	// Radial places root at center, children in rings around it
	// Uses packed circles approach for spacing
	Radial

	// Directional allows each branch to go in a different direction
	// Requires per-node direction hints
	Directional
)

// LayoutConfig configures how Stage1 places nodes
type LayoutConfig struct {
	// Direction is the primary layout direction
	Direction LayoutDirection

	// NodeDirections provides per-node direction overrides (for Directional mode)
	// Key is node index, value is the direction that node's children should grow
	NodeDirections map[int]LayoutDirection
}

// DefaultLayoutConfig returns the default configuration (TopDown)
func DefaultLayoutConfig() LayoutConfig {
	return LayoutConfig{
		Direction: TopDown,
	}
}

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

// PlacedShape represents a shape with its placement position
// The slice index + 1 equals the node ID used in grid/tilemap
type PlacedShape struct {
	Points   []Point // Relative tile positions (normalized, origin at 0,0)
	Position Point   // World position (top-left corner of bounding box)
	Width    int
	Height   int
}

// BuildGridFromShapes creates a Grid from placed shapes
// Each shape's index + 1 becomes its ID in the grid
func BuildGridFromShapes(shapes []PlacedShape) *Grid {
	grid := make(Grid)
	for i, shape := range shapes {
		nodeID := i + 1 // 1-based ID
		for _, relPoint := range shape.Points {
			worldPoint := Point{
				shape.Position[0] + relPoint[0],
				shape.Position[1] + relPoint[1],
			}
			grid[worldPoint] = nodeID
		}
	}
	return &grid
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

// getBoundsFromShapes calculates the bounding box for shapes and paths
func getBoundsFromShapes(shapes []PlacedShape, pathInfos []PathInfo) (minX, minY, maxX, maxY int) {
	if len(shapes) == 0 {
		return 0, 0, 0, 0
	}

	// Start with first shape's bounds
	first := shapes[0]
	minX = first.Position[0]
	minY = first.Position[1]
	maxX = first.Position[0] + first.Width - 1
	maxY = first.Position[1] + first.Height - 1

	// Expand with all shapes
	for _, shape := range shapes[1:] {
		if shape.Position[0] < minX {
			minX = shape.Position[0]
		}
		if shape.Position[1] < minY {
			minY = shape.Position[1]
		}
		rightX := shape.Position[0] + shape.Width - 1
		bottomY := shape.Position[1] + shape.Height - 1
		if rightX > maxX {
			maxX = rightX
		}
		if bottomY > maxY {
			maxY = bottomY
		}
	}

	// Expand with path tiles
	for _, pathInfo := range pathInfos {
		for _, p := range pathInfo.PathTiles {
			if p[0] < minX {
				minX = p[0]
			}
			if p[1] < minY {
				minY = p[1]
			}
			if p[0] > maxX {
				maxX = p[0]
			}
			if p[1] > maxY {
				maxY = p[1]
			}
		}
	}

	return minX, minY, maxX, maxY
}

// ApplyShapesToTilemap places shapes onto a tilemap
// Returns the tilemap data, width, and the offset applied (minX, minY)
func ApplyShapesToTilemap(shapes []PlacedShape, pathInfos []PathInfo) ([]uint32, int, Point) {
	if len(shapes) == 0 {
		return []uint32{}, 0, Point{0, 0}
	}

	minX, minY, maxX, maxY := getBoundsFromShapes(shapes, pathInfos)
	width := maxX - minX + 1
	height := maxY - minY + 1

	data := make([]uint32, width*height)

	// Place each shape (index+1 = nodeID)
	for i, shape := range shapes {
		nodeID := uint32(i + 1)
		for _, relPoint := range shape.Points {
			worldX := shape.Position[0] + relPoint[0]
			worldY := shape.Position[1] + relPoint[1]
			x := worldX - minX
			y := worldY - minY
			idx := y*width + x
			data[idx] = nodeID
		}
	}

	return data, width, Point{minX, minY}
}

// ApplyPathsToTilemap places path tiles onto an existing tilemap
// Path tiles become part of the parent room (pathInfo.ParentID)
func ApplyPathsToTilemap(pathInfos []PathInfo, data []uint32, width int, offset Point) {
	for _, pathInfo := range pathInfos {
		parentID := uint32(pathInfo.ParentID)
		for _, p := range pathInfo.PathTiles {
			x := p[0] - offset[0]
			y := p[1] - offset[1]
			idx := y*width + x
			if idx >= 0 && idx < len(data) {
				data[idx] = parentID
			}
		}
	}
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
