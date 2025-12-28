package minimap

import (
	"github.com/justgook/gamectl/pkg/tree"
)

// normalizeShape takes a shape and returns a PlacedShape with normalized points
// (minX=0, minY=0) and Position at origin. Width/Height are calculated.
func normalizeShape(shape RoomShape) PlacedShape {
	if len(shape) == 0 {
		return PlacedShape{Points: []Point{}, Width: 0, Height: 0}
	}

	// Find bounds
	minX, maxX := shape[0][0], shape[0][0]
	minY, maxY := shape[0][1], shape[0][1]
	for _, point := range shape[1:] {
		if point[0] < minX {
			minX = point[0]
		}
		if point[0] > maxX {
			maxX = point[0]
		}
		if point[1] < minY {
			minY = point[1]
		}
		if point[1] > maxY {
			maxY = point[1]
		}
	}

	// Normalize points
	normalized := make([]Point, len(shape))
	for i, point := range shape {
		normalized[i] = Point{point[0] - minX, point[1] - minY}
	}

	return PlacedShape{
		Points:   normalized,
		Position: Point{0, 0}, // Will be set during placement in Stage2
		Width:    maxX - minX + 1,
		Height:   maxY - minY + 1,
	}
}

// Stage1 collects and normalizes shapes for each node in the tree.
// The actual placement is done in Stage2 using the "grow from parent" approach.
// Returns []PlacedShape where index corresponds to tree node index (ID = index + 1)
func Stage1(
	treeInput *tree.Tree,
	getRoomShape GetRoomShapeFunc,
) []PlacedShape {
	if len(*treeInput) == 0 {
		return []PlacedShape{}
	}

	result := make([]PlacedShape, len(*treeInput))

	for i, node := range *treeInput {
		shape := getRoomShape(node)
		result[i] = normalizeShape(shape)
	}

	return result
}
