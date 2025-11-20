package minimap

import (
	"github.com/justgook/gamectl/pkg/tree"
	"math"
)

type Grid map[Point]int
type Point = [2]int

// Layout constants for Stage 1
const (
	LevelSpacing = 10 // Vertical spacing between levels
	NodeSpacing  = 5  // Horizontal spacing between siblings
)

// NodePosition tracks position and metadata for tree nodes
type NodePosition struct {
	Node     *tree.Node
	Shape    RoomShape
	Position Point // Anchor position on grid
	Level    int   // Distance from root (0 = root)
}

// GetBoundingBox calculates the bounding box of a room shape
func GetBoundingBox(shape RoomShape) (minX, minY, maxX, maxY int) {
	if len(shape) == 0 {
		return 0, 0, 0, 0
	}
	minX, minY = shape[0][0], shape[0][1]
	maxX, maxY = shape[0][0], shape[0][1]

	for _, point := range shape[1:] {
		if point[0] < minX {
			minX = point[0]
		}
		if point[1] < minY {
			minY = point[1]
		}
		if point[0] > maxX {
			maxX = point[0]
		}
		if point[1] > maxY {
			maxY = point[1]
		}
	}
	return
}

// PlaceShapeOnGrid places a room shape at the given position
func PlaceShapeOnGrid(grid *Grid, shape RoomShape, position Point, roomID int) {
	for _, offset := range shape {
		point := Point{position[0] + offset[0], position[1] + offset[1]}
		(*grid)[point] = roomID
	}
}

// GetShapeWidth returns the width of a room shape
func GetShapeWidth(shape RoomShape) int {
	minX, _, maxX, _ := GetBoundingBox(shape)
	return maxX - minX + 1
}

// GetShapeHeight returns the height of a room shape
func GetShapeHeight(shape RoomShape) int {
	_, minY, _, maxY := GetBoundingBox(shape)
	return maxY - minY + 1
}

// GetRootNode finds the root node (node with ParentId pointing to itself or -1)
func GetRootNode(t *tree.Tree) *tree.Node {
	for i, node := range *t {
		if node.ParentId == i || node.ParentId == -1 {
			return node
		}
	}
	return (*t)[0] // fallback to first node
}

// GetNodeLevel calculates the level (depth) of a node from root
func GetNodeLevel(t *tree.Tree, node *tree.Node) int {
	level := 0
	current := node
	nodeIndex := t.IndexOf(node)

	for nodeIndex != current.ParentId && current.ParentId != -1 {
		current = (*t)[current.ParentId]
		nodeIndex = t.IndexOf(current) // FIX: was current.ParentId
		level++
		if level > len(*t) { // prevent infinite loops
			break
		}
	}
	return level
}

// GetNodesAtLevel returns all nodes at specified level from given root
func GetNodesAtLevel(t *tree.Tree, root *tree.Node, targetLevel int) []*tree.Node {
	var result []*tree.Node
	for node := range t.Traverse(root) {
		if GetNodeLevel(t, node) == targetLevel {
			result = append(result, node)
		}
	}
	return result
}

// GetTreeDepth returns maximum depth of tree from given root
func GetTreeDepth(t *tree.Tree, root *tree.Node) int {
	maxDepth := 0
	for node := range t.Traverse(root) {
		level := GetNodeLevel(t, node)
		if level > maxDepth {
			maxDepth = level
		}
	}
	return maxDepth
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

		// empty space = 0
		// stored item = id + 1
		data[idx] = uint32(id + 1)
	}

	return data, width
}
