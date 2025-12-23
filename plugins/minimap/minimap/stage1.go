package minimap

import "github.com/justgook/gamectl/pkg/tree"

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
		Position: Point{0, 0}, // Will be set during placement
		Width:    maxX - minX + 1,
		Height:   maxY - minY + 1,
	}
}

// nodeLayout stores positioning information for a node
type nodeLayout struct {
	nodeIndex  int
	depth      int
	unitSize   int // size along secondary axis (width for vertical, height for horizontal)
	centerPos  int // center position along secondary axis
	levelPos   int // position along primary axis (topY for vertical, leftX for horizontal)
	normalized PlacedShape
}

// buildDepthMap organizes nodes by their depth in the tree
func buildDepthMap(treeInput *tree.Tree) (map[int][]int, map[int][]int, int) {
	depthMap := make(map[int][]int)    // depth -> []nodeIndex
	childrenMap := make(map[int][]int) // parentIndex -> []childIndex
	maxDepth := 0

	// Build children map and calculate depths
	depths := make([]int, len(*treeInput))
	for i, node := range *treeInput {
		parentId := node.ParentId
		if parentId == -1 {
			depths[i] = 0
		} else {
			depths[i] = depths[parentId] + 1
			childrenMap[parentId] = append(childrenMap[parentId], i)
		}

		if depths[i] > maxDepth {
			maxDepth = depths[i]
		}
		depthMap[depths[i]] = append(depthMap[depths[i]], i)
	}

	return depthMap, childrenMap, maxDepth
}

// getSecondarySize returns the shape dimension used for sibling spreading
func getSecondarySize(shape PlacedShape, dir LayoutDirection) int {
	switch dir {
	case TopDown, BottomUp:
		return shape.Width
	case LeftToRight, RightToLeft:
		return shape.Height
	default:
		return shape.Width
	}
}

// getPrimarySize returns the shape dimension used for level progression
func getPrimarySize(shape PlacedShape, dir LayoutDirection) int {
	switch dir {
	case TopDown, BottomUp:
		return shape.Height
	case LeftToRight, RightToLeft:
		return shape.Width
	default:
		return shape.Height
	}
}

// Stage1 places nodes using a bottom-up unit calculation followed by top-down placement
// Returns []PlacedShape where index corresponds to tree node index (ID = index + 1)
func Stage1(
	rng Random,
	treeInput *tree.Tree,
	getRoomShape GetRoomShapeFunc,
	config LayoutConfig,
) []PlacedShape {
	if len(*treeInput) == 0 {
		return []PlacedShape{}
	}

	dir := config.Direction

	// For Radial and Directional, fall back to TopDown for now
	// These will be implemented separately
	if dir == Radial || dir == Directional {
		dir = TopDown
	}

	// Build depth map and relationships
	depthMap, childrenMap, maxDepth := buildDepthMap(treeInput)

	// Prepare layouts for all nodes
	layouts := make([]nodeLayout, len(*treeInput))
	for i, node := range *treeInput {
		shape := getRoomShape(node)
		layouts[i] = nodeLayout{
			nodeIndex:  i,
			normalized: normalizeShape(shape),
		}
	}

	// Step 1: Calculate unit sizes (bottom-up)
	// unitSize = space needed along secondary axis
	for depth := maxDepth; depth >= 0; depth-- {
		for _, nodeIndex := range depthMap[depth] {
			children := childrenMap[nodeIndex]
			shapeSecondarySize := getSecondarySize(layouts[nodeIndex].normalized, dir)

			if len(children) == 0 {
				// Leaf node: unit size is just its shape's secondary dimension
				layouts[nodeIndex].unitSize = shapeSecondarySize
			} else {
				// Parent node: max of (children total size, own shape size)
				childrenTotalSize := 0
				for _, childIndex := range children {
					childrenTotalSize += layouts[childIndex].unitSize
				}
				// Add spacing between children
				childrenTotalSize += (len(children) - 1) * NodeSpacing

				if childrenTotalSize > shapeSecondarySize {
					layouts[nodeIndex].unitSize = childrenTotalSize
				} else {
					layouts[nodeIndex].unitSize = shapeSecondarySize
				}
			}
		}
	}

	// Step 2: Calculate positions based on direction
	switch dir {
	case TopDown:
		placeTopDown(depthMap, childrenMap, layouts, treeInput, maxDepth)
	case BottomUp:
		placeBottomUp(depthMap, childrenMap, layouts, treeInput, maxDepth)
	case LeftToRight:
		placeLeftToRight(depthMap, childrenMap, layouts, treeInput, maxDepth)
	case RightToLeft:
		placeRightToLeft(depthMap, childrenMap, layouts, treeInput, maxDepth)
	}

	// Step 3: Build PlacedShape results with calculated positions
	result := make([]PlacedShape, len(layouts))
	for nodeIndex, layout := range layouts {
		var posX, posY int

		switch dir {
		case TopDown:
			// centerPos is X, levelPos is top Y
			posX = layout.centerPos - layout.normalized.Width/2
			posY = layout.levelPos
		case BottomUp:
			// centerPos is X, levelPos is bottom Y
			posX = layout.centerPos - layout.normalized.Width/2
			posY = layout.levelPos - layout.normalized.Height + 1
		case LeftToRight:
			// centerPos is Y, levelPos is left X
			posX = layout.levelPos
			posY = layout.centerPos - layout.normalized.Height/2
		case RightToLeft:
			// centerPos is Y, levelPos is right X
			posX = layout.levelPos - layout.normalized.Width + 1
			posY = layout.centerPos - layout.normalized.Height/2
		}

		result[nodeIndex] = PlacedShape{
			Points:   layout.normalized.Points,
			Position: Point{posX, posY},
			Width:    layout.normalized.Width,
			Height:   layout.normalized.Height,
		}
	}

	return result
}

// placeTopDown positions nodes with root at top, children below
func placeTopDown(depthMap, childrenMap map[int][]int, layouts []nodeLayout, treeInput *tree.Tree, maxDepth int) {
	previousLevelMaxBottom := 0

	for depth := 0; depth <= maxDepth; depth++ {
		var levelTop int
		if depth == 0 {
			levelTop = 0
		} else {
			levelTop = previousLevelMaxBottom + LevelSpacing + 1
		}

		levelMaxBottom := levelTop

		for _, nodeIndex := range depthMap[depth] {
			layouts[nodeIndex].levelPos = levelTop

			// Update level max bottom
			nodeBottom := levelTop + layouts[nodeIndex].normalized.Height - 1
			if nodeBottom > levelMaxBottom {
				levelMaxBottom = nodeBottom
			}

			// Calculate secondary position (X)
			if depth == 0 {
				layouts[nodeIndex].centerPos = 0
			} else {
				parentIndex := (*treeInput)[nodeIndex].ParentId
				parentLayout := layouts[parentIndex]

				siblings := childrenMap[parentIndex]
				siblingIndex := findSiblingIndex(siblings, nodeIndex)

				parentStart := parentLayout.centerPos - parentLayout.unitSize/2
				accumulated := 0
				for i := 0; i < siblingIndex; i++ {
					accumulated += layouts[siblings[i]].unitSize + NodeSpacing
				}

				layouts[nodeIndex].centerPos = parentStart + accumulated + layouts[nodeIndex].unitSize/2
			}
		}

		previousLevelMaxBottom = levelMaxBottom
	}
}

// placeBottomUp positions nodes with root at bottom, children above
func placeBottomUp(depthMap, childrenMap map[int][]int, layouts []nodeLayout, treeInput *tree.Tree, maxDepth int) {
	previousLevelMinTop := 0

	for depth := 0; depth <= maxDepth; depth++ {
		var levelBottom int
		if depth == 0 {
			levelBottom = 0
		} else {
			levelBottom = previousLevelMinTop - LevelSpacing - 1
		}

		levelMinTop := levelBottom

		for _, nodeIndex := range depthMap[depth] {
			layouts[nodeIndex].levelPos = levelBottom // levelPos = bottom Y for BottomUp

			// Update level min top
			nodeTop := levelBottom - layouts[nodeIndex].normalized.Height + 1
			if nodeTop < levelMinTop {
				levelMinTop = nodeTop
			}

			// Calculate secondary position (X) - same logic as TopDown
			if depth == 0 {
				layouts[nodeIndex].centerPos = 0
			} else {
				parentIndex := (*treeInput)[nodeIndex].ParentId
				parentLayout := layouts[parentIndex]

				siblings := childrenMap[parentIndex]
				siblingIndex := findSiblingIndex(siblings, nodeIndex)

				parentStart := parentLayout.centerPos - parentLayout.unitSize/2
				accumulated := 0
				for i := 0; i < siblingIndex; i++ {
					accumulated += layouts[siblings[i]].unitSize + NodeSpacing
				}

				layouts[nodeIndex].centerPos = parentStart + accumulated + layouts[nodeIndex].unitSize/2
			}
		}

		previousLevelMinTop = levelMinTop
	}
}

// placeLeftToRight positions nodes with root on left, children to the right
func placeLeftToRight(depthMap, childrenMap map[int][]int, layouts []nodeLayout, treeInput *tree.Tree, maxDepth int) {
	previousLevelMaxRight := 0

	for depth := 0; depth <= maxDepth; depth++ {
		var levelLeft int
		if depth == 0 {
			levelLeft = 0
		} else {
			levelLeft = previousLevelMaxRight + LevelSpacing + 1
		}

		levelMaxRight := levelLeft

		for _, nodeIndex := range depthMap[depth] {
			layouts[nodeIndex].levelPos = levelLeft // levelPos = left X for LeftToRight

			// Update level max right
			nodeRight := levelLeft + layouts[nodeIndex].normalized.Width - 1
			if nodeRight > levelMaxRight {
				levelMaxRight = nodeRight
			}

			// Calculate secondary position (Y)
			if depth == 0 {
				layouts[nodeIndex].centerPos = 0
			} else {
				parentIndex := (*treeInput)[nodeIndex].ParentId
				parentLayout := layouts[parentIndex]

				siblings := childrenMap[parentIndex]
				siblingIndex := findSiblingIndex(siblings, nodeIndex)

				parentStart := parentLayout.centerPos - parentLayout.unitSize/2
				accumulated := 0
				for i := 0; i < siblingIndex; i++ {
					accumulated += layouts[siblings[i]].unitSize + NodeSpacing
				}

				layouts[nodeIndex].centerPos = parentStart + accumulated + layouts[nodeIndex].unitSize/2
			}
		}

		previousLevelMaxRight = levelMaxRight
	}
}

// placeRightToLeft positions nodes with root on right, children to the left
func placeRightToLeft(depthMap, childrenMap map[int][]int, layouts []nodeLayout, treeInput *tree.Tree, maxDepth int) {
	previousLevelMinLeft := 0

	for depth := 0; depth <= maxDepth; depth++ {
		var levelRight int
		if depth == 0 {
			levelRight = 0
		} else {
			levelRight = previousLevelMinLeft - LevelSpacing - 1
		}

		levelMinLeft := levelRight

		for _, nodeIndex := range depthMap[depth] {
			layouts[nodeIndex].levelPos = levelRight // levelPos = right X for RightToLeft

			// Update level min left
			nodeLeft := levelRight - layouts[nodeIndex].normalized.Width + 1
			if nodeLeft < levelMinLeft {
				levelMinLeft = nodeLeft
			}

			// Calculate secondary position (Y) - same logic as LeftToRight
			if depth == 0 {
				layouts[nodeIndex].centerPos = 0
			} else {
				parentIndex := (*treeInput)[nodeIndex].ParentId
				parentLayout := layouts[parentIndex]

				siblings := childrenMap[parentIndex]
				siblingIndex := findSiblingIndex(siblings, nodeIndex)

				parentStart := parentLayout.centerPos - parentLayout.unitSize/2
				accumulated := 0
				for i := 0; i < siblingIndex; i++ {
					accumulated += layouts[siblings[i]].unitSize + NodeSpacing
				}

				layouts[nodeIndex].centerPos = parentStart + accumulated + layouts[nodeIndex].unitSize/2
			}
		}

		previousLevelMinLeft = levelMinLeft
	}
}

// findSiblingIndex returns the index of nodeIndex within siblings slice
func findSiblingIndex(siblings []int, nodeIndex int) int {
	for i, sibId := range siblings {
		if sibId == nodeIndex {
			return i
		}
	}
	return 0
}
