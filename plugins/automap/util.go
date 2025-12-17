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
