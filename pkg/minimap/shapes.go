package minimap

// RoomShape defines a room layout as a set of relative tile coordinates
// Coordinates are relative to [0, 0] anchor point
type RoomShape []Coordinate

// RoomShapeLibrary contains predefined room shapes
// Each shape type maps to one or more variants that can be selected by the plugin
var RoomShapeLibrary = map[string][]RoomShape{
	// Single tile rooms
	"ENTER": {
		{{0, 0}},
	},

	// Vertical corridor (2-4 tiles)
	"CORRIDOR_VERT_2": {
		{{0, 0}, {0, -1}},
		{{0, 0}, {0, 1}},
	},
	"CORRIDOR_VERT_3": {
		{{0, 0}, {0, -1}, {0, -2}},
		{{0, 0}, {0, 1}, {0, 2}},
	},
	"CORRIDOR_VERT_4": {
		{{0, 0}, {0, -1}, {0, -2}, {0, -3}},
		{{0, 0}, {0, 1}, {0, 2}, {0, 3}},
	},

	// Horizontal corridor (2-4 tiles)
	"CORRIDOR_HORIZ_2": {
		{{0, 0}, {1, 0}},
		{{0, 0}, {-1, 0}},
	},
	"CORRIDOR_HORIZ_3": {
		{{0, 0}, {1, 0}, {2, 0}},
		{{0, 0}, {-1, 0}, {-2, 0}},
	},
	"CORRIDOR_HORIZ_4": {
		{{0, 0}, {1, 0}, {2, 0}, {3, 0}},
		{{0, 0}, {-1, 0}, {-2, 0}, {-3, 0}},
	},

	// 2x2 square
	"SQUARE_2x2": {
		{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
	},

	// 2x3 rectangle
	"RECT_2x3": {
		{{0, 0}, {1, 0}, {0, 1}, {1, 1}, {0, 2}, {1, 2}},
		{{0, 0}, {0, 1}, {1, 0}, {1, 1}, {2, 0}, {2, 1}},
	},

	// Boss room (larger - 2x4 or 4x2)
	"BOSS": {
		{{0, 0}, {1, 0}, {0, 1}, {1, 1}, {0, 2}, {1, 2}, {0, 3}, {1, 3}},
		{{0, 0}, {0, 1}, {1, 0}, {1, 1}, {2, 0}, {2, 1}, {3, 0}, {3, 1}},
		{{0, 0}, {1, 0}, {2, 0}, {3, 0}, {0, 1}, {1, 1}, {2, 1}, {3, 1}},
	},

	// L-shaped room
	"L_SHAPE": {
		{{0, 0}, {1, 0}, {0, 1}, {0, 2}},
		{{0, 0}, {1, 0}, {1, 1}, {1, 2}},
		{{0, 0}, {0, 1}, {1, 1}, {2, 1}},
		{{0, 0}, {0, 1}, {-1, 1}, {-2, 1}},
	},

	// T-shaped room
	"T_SHAPE": {
		{{0, 0}, {1, 0}, {2, 0}, {1, 1}},
		{{0, 0}, {0, 1}, {0, 2}, {-1, 1}},
	},
}

// TranslateShape translates a room shape to a specific position
// This creates absolute coordinates from relative coordinates
func TranslateShape(shape RoomShape, pos Coordinate) []Coordinate {
	translated := make([]Coordinate, len(shape))
	for i, coord := range shape {
		translated[i] = [2]int{coord[0] + pos[0], coord[1] + pos[1]}
	}
	return translated
}
