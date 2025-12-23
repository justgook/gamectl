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
	unitWidth  int
	centerX    int
	topY       int
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

// Stage1 places nodes using a bottom-up unit calculation followed by top-down placement
// Returns []PlacedShape where index corresponds to tree node index (ID = index + 1)
func Stage1(
	rng Random,
	treeInput *tree.Tree,
	getRoomShape GetRoomShapeFunc,
) []PlacedShape {
	if len(*treeInput) == 0 {
		return []PlacedShape{}
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

	// Step 1: Calculate unit widths (bottom-up)
	for depth := maxDepth; depth >= 0; depth-- {
		for _, nodeIndex := range depthMap[depth] {
			children := childrenMap[nodeIndex]

			if len(children) == 0 {
				// Leaf node: unit width is just its shape width
				layouts[nodeIndex].unitWidth = layouts[nodeIndex].normalized.Width
			} else {
				// Parent node: max of (children total width, own shape width)
				// Calculate total width needed for children including spacing between them
				childrenTotalWidth := 0
				for _, childIndex := range children {
					childrenTotalWidth += layouts[childIndex].unitWidth
				}
				// Add spacing between children (not before first or after last)
				childrenTotalWidth += (len(children) - 1) * NodeSpacing

				// Parent needs enough width for its own shape
				parentShapeWidth := layouts[nodeIndex].normalized.Width

				// Use the maximum to ensure both parent and children fit without overlapping
				if childrenTotalWidth > parentShapeWidth {
					layouts[nodeIndex].unitWidth = childrenTotalWidth
				} else {
					layouts[nodeIndex].unitWidth = parentShapeWidth
				}
			}
		}
	}

	// Step 2: Calculate positions (top-down)
	previousLevelMaxBottomY := 0

	for depth := 0; depth <= maxDepth; depth++ {
		// Calculate Y position for this level
		var levelTopY int
		if depth == 0 {
			levelTopY = 0
		} else {
			levelTopY = previousLevelMaxBottomY + LevelSpacing + 1
		}

		// Track max bottom Y for this level
		levelMaxBottomY := levelTopY

		for _, nodeIndex := range depthMap[depth] {
			layouts[nodeIndex].topY = levelTopY

			// Update level max bottom
			nodeBottomY := levelTopY + layouts[nodeIndex].normalized.Height - 1
			if nodeBottomY > levelMaxBottomY {
				levelMaxBottomY = nodeBottomY
			}

			// Calculate X position
			if depth == 0 {
				// Root: centered at X=0
				layouts[nodeIndex].centerX = 0
			} else {
				// Position within parent's unit space
				parentIndex := (*treeInput)[nodeIndex].ParentId
				parentLayout := layouts[parentIndex]

				// Find this node's position among siblings
				siblings := childrenMap[parentIndex]
				siblingIndex := 0
				for i, sibId := range siblings {
					if sibId == nodeIndex {
						siblingIndex = i
						break
					}
				}

				// Calculate starting X for parent's children
				parentStartX := parentLayout.centerX - parentLayout.unitWidth/2

				// Calculate accumulated width before this child
				accumulatedWidth := 0
				for i := 0; i < siblingIndex; i++ {
					accumulatedWidth += layouts[siblings[i]].unitWidth + NodeSpacing
				}

				// This child's center is at the center of its unit allocation
				layouts[nodeIndex].centerX = parentStartX + accumulatedWidth + layouts[nodeIndex].unitWidth/2
			}
		}

		previousLevelMaxBottomY = levelMaxBottomY
	}

	// Step 3: Build PlacedShape results with calculated positions
	result := make([]PlacedShape, len(layouts))
	for nodeIndex, layout := range layouts {
		// Calculate offset to center the shape horizontally
		shapeOffsetX := layout.centerX - layout.normalized.Width/2

		result[nodeIndex] = PlacedShape{
			Points:   layout.normalized.Points,
			Position: Point{shapeOffsetX, layout.topY},
			Width:    layout.normalized.Width,
			Height:   layout.normalized.Height,
		}
	}

	return result
}
