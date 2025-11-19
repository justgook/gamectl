package roomgen

import (
	"github.com/justgook/gamectl/pkg/tree"
)

// RoomShape represents a room as a collection of relative tile positions
type RoomShape [][2]int

// Room represents a placed room with its shape and position
type Room struct {
	Shape    RoomShape
	Position [2]int // Top-left position in grid
	NodeID   int    // Index of the tree node this room represents
}

// GetRoomShapeFunc is a function that determines the shape for a given tree node
type GetRoomShapeFunc func(*tree.Node) RoomShape

// Random interface for randomization
type Random interface {
	Intn(n int) int
	Float64() float64
}

// RoomGenerator handles room shape selection and basic room operations
type RoomGenerator struct {
	getShape Random
	rng      Random
}

// NewRoomGenerator creates a new room generator
func NewRoomGenerator(rng Random) *RoomGenerator {
	return &RoomGenerator{
		rng: rng,
	}
}

// GetRoomShape returns a room shape for the given node
func (rg *RoomGenerator) GetRoomShape(node *tree.Node) RoomShape {
	idx := rg.rng.Intn(len(PredefinedShapes))
	return PredefinedShapes[idx]
}

// GetRoomBounds returns the bounding box of a room shape
func (rg *RoomGenerator) GetRoomBounds(shape RoomShape) (minX, minY, maxX, maxY int) {
	if len(shape) == 0 {
		return 0, 0, 0, 0
	}

	minX, minY = shape[0][0], shape[0][1]
	maxX, maxY = shape[0][0], shape[0][1]

	for _, tile := range shape {
		if tile[0] < minX {
			minX = tile[0]
		}
		if tile[0] > maxX {
			maxX = tile[0]
		}
		if tile[1] < minY {
			minY = tile[1]
		}
		if tile[1] > maxY {
			maxY = tile[1]
		}
	}

	return minX, minY, maxX, maxY
}

// GetRoomSize returns the width and height of a room shape
func (rg *RoomGenerator) GetRoomSize(shape RoomShape) (width, height int) {
	minX, minY, maxX, maxY := rg.GetRoomBounds(shape)
	return maxX - minX + 1, maxY - minY + 1
}

// NormalizeShape normalizes a room shape so its top-left corner is at (0,0)
func (rg *RoomGenerator) NormalizeShape(shape RoomShape) RoomShape {
	if len(shape) == 0 {
		return shape
	}

	minX, minY, _, _ := rg.GetRoomBounds(shape)

	normalized := make(RoomShape, len(shape))
	for i, tile := range shape {
		normalized[i] = [2]int{tile[0] - minX, tile[1] - minY}
	}

	return normalized
}

// DoesRoomOverlap checks if two rooms overlap
func (rg *RoomGenerator) DoesRoomOverlap(room1, room2 *Room) bool {
	// Create sets of occupied tiles for each room
	tiles1 := make(map[[2]int]bool)
	for _, tile := range room1.Shape {
		pos := [2]int{room1.Position[0] + tile[0], room1.Position[1] + tile[1]}
		tiles1[pos] = true
	}

	for _, tile := range room2.Shape {
		pos := [2]int{room2.Position[0] + tile[0], room2.Position[1] + tile[1]}
		if tiles1[pos] {
			return true
		}
	}

	return false
}

// GetRoomTiles returns all absolute tile positions for a room
func (rg *RoomGenerator) GetRoomTiles(room *Room) [][2]int {
	tiles := make([][2]int, len(room.Shape))
	for i, tile := range room.Shape {
		tiles[i] = [2]int{room.Position[0] + tile[0], room.Position[1] + tile[1]}
	}
	return tiles
}

// AreRoomsAdjacent checks if two rooms share at least one edge tile
func (rg *RoomGenerator) AreRoomsAdjacent(room1, room2 *Room) bool {
	tiles1 := rg.GetRoomTiles(room1)
	tiles2 := rg.GetRoomTiles(room2)

	// Check if any tile from room1 is adjacent to any tile from room2
	for _, tile1 := range tiles1 {
		for _, tile2 := range tiles2 {
			// Check 4-directional adjacency
			dx := abs(tile1[0] - tile2[0])
			dy := abs(tile1[1] - tile2[1])
			if (dx == 1 && dy == 0) || (dx == 0 && dy == 1) {
				return true
			}
		}
	}

	return false
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// PredefinedShapes contains all available room shapes
var PredefinedShapes = []RoomShape{
	// Single tiles - most flexible for tight spaces
	{{0, 0}},
	// 2-tile shapes
	{{0, 0}, {0, 1}},
	{{0, 0}, {1, 0}},
	{{0, 0}, {0, -1}},
	{{0, 0}, {-1, 0}},
	// Small L-shapes
	{{0, 0}, {1, 0}, {0, 1}},
	{{0, 0}, {-1, 0}, {0, 1}},
	{{0, 0}, {1, 0}, {0, -1}},
	{{0, 0}, {-1, 0}, {0, -1}},
	// 2x2 squares
	{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
	// Larger rectangles
	{{0, 0}, {1, 0}, {0, 1}, {1, 1}, {0, 2}, {1, 2}},
	{{0, 0}, {0, 1}, {1, 0}, {1, 1}, {2, 0}, {2, 1}},
	// T-shapes
	{{0, 0}, {1, 0}, {0, 1}, {0, 2}},
	{{0, 0}, {1, 0}, {1, 1}, {1, 2}},
	{{0, 0}, {0, 1}, {1, 1}, {2, 1}},
	{{0, 0}, {0, 1}, {-1, 1}, {-2, 1}},
	// Cross shapes
	{{0, 0}, {1, 0}, {2, 0}, {1, 1}},
	{{0, 0}, {0, 1}, {0, 2}, {-1, 1}},
}
