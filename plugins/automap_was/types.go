package main

// Point represents a 2D coordinate
type Point struct {
	X, Y int
}

// Tile represents a positioned tile with its value
type Tile struct {
	Point Point
	Value uint32
}

// TileShape represents a collection of tile positions (like RoomShape)
// This defines the "match shape" - arbitrary tile arrangements
type TileShape []Point

// Rule represents one pattern alternative (one input_index)
// Contains multiple InputLayers that define the matching conditions
type Rule struct {
	// All input layers for this rule (grouped by target selector)
	// Same target = OR across tile variants
	// Different targets = AND across layers
	InputLayers []*InputLayer

	// Outputs to apply when rule matches
	Outputs []*OutputLayer

	// Rule constraints (inherited from first input or global)
	ModX, ModY       int
	OffsetX, OffsetY int
	Probability      float64
}

// InputLayer represents one input pattern layer
// Tiles are stored as coordinate+value pairs (no bounding box assumption)
type InputLayer struct {
	// Tile positions and values (0 = empty)
	Tiles []Tile

	// Which layer to match against in target map
	TargetSelector string

	// Matching flags
	IsNegated bool
	AutoEmpty bool
}

// OutputLayer represents tiles to place when rule matches
type OutputLayer struct {
	// Tile positions and values to write
	Tiles []Tile

	// Which layer to write to
	TargetSelector string

	// For probability-based selection
	OutputIndex string
	Probability float64
}

// OccupiedTracker tracks written tiles for NoOverlappingOutput
type OccupiedTracker struct {
	// [targetLayerSelector][x][y] = occupied
	occupied map[string]map[int]map[int]bool
}

// NewOccupiedTracker creates a new tracker
func NewOccupiedTracker() *OccupiedTracker {
	return &OccupiedTracker{
		occupied: make(map[string]map[int]map[int]bool),
	}
}

// MarkOccupied marks a tile position as written
func (t *OccupiedTracker) MarkOccupied(selector string, x, y int) {
	if t.occupied[selector] == nil {
		t.occupied[selector] = make(map[int]map[int]bool)
	}
	if t.occupied[selector][x] == nil {
		t.occupied[selector][x] = make(map[int]bool)
	}
	t.occupied[selector][x][y] = true
}

// IsOccupied checks if a tile position has been written
func (t *OccupiedTracker) IsOccupied(selector string, x, y int) bool {
	if t.occupied[selector] == nil {
		return false
	}
	if t.occupied[selector][x] == nil {
		return false
	}
	return t.occupied[selector][x][y]
}

// GetBounds calculates the bounding box of a tile shape
// Returns minX, minY, maxX, maxY
func (s TileShape) GetBounds() (int, int, int, int) {
	if len(s) == 0 {
		return 0, 0, 0, 0
	}

	minX, minY := s[0].X, s[0].Y
	maxX, maxY := s[0].X, s[0].Y

	for _, p := range s[1:] {
		if p.X < minX {
			minX = p.X
		}
		if p.X > maxX {
			maxX = p.X
		}
		if p.Y < minY {
			minY = p.Y
		}
		if p.Y > maxY {
			maxY = p.Y
		}
	}

	return minX, minY, maxX, maxY
}

// NormalizeTiles adjusts tile positions relative to (0, 0)
// Used to make patterns position-independent
func NormalizeTiles(tiles []Tile) []Tile {
	if len(tiles) == 0 {
		return tiles
	}

	// Find minimum coordinates
	minX, minY := tiles[0].Point.X, tiles[0].Point.Y
	for _, t := range tiles[1:] {
		if t.Point.X < minX {
			minX = t.Point.X
		}
		if t.Point.Y < minY {
			minY = t.Point.Y
		}
	}

	// Normalize
	normalized := make([]Tile, len(tiles))
	for i, t := range tiles {
		normalized[i] = Tile{
			Point: Point{X: t.Point.X - minX, Y: t.Point.Y - minY},
			Value: t.Value,
		}
	}

	return normalized
}
