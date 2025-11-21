package minimap

import (
	"math"
)

type Grid map[Point]int
type Point = [2]int

// Layout constants for Stage 1
const (
	LevelSpacing = 1 // Vertical spacing between levels
	NodeSpacing  = 2 // Horizontal spacing between siblings
)

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

		// empty space = 0
		// stored item = id + 1
		data[idx] = uint32(id + 1)
	}

	return data, width
}
