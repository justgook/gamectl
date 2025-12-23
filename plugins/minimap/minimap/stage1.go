package minimap

import (
	"math"

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

	// Handle Radial layout separately
	if dir == Radial {
		return placeRadial(treeInput, getRoomShape)
	}

	// Handle Directional layout separately
	if dir == Directional {
		return placeDirectional(treeInput, getRoomShape, config)
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

// radialLayout stores positioning information for radial placement
type radialLayout struct {
	nodeIndex    int
	normalized   PlacedShape
	radius       float64 // bounding circle radius (half of max dimension + spacing)
	angle        float64 // center angle in radians
	angularWidth float64 // angular span needed for this subtree
	ringRadius   float64 // distance from center
}

// placeRadial positions nodes in concentric rings around the center
// Uses a packed circles approach where each depth level forms a ring
func placeRadial(treeInput *tree.Tree, getRoomShape GetRoomShapeFunc) []PlacedShape {
	if len(*treeInput) == 0 {
		return []PlacedShape{}
	}

	// Build depth map and relationships
	depthMap, childrenMap, maxDepth := buildDepthMap(treeInput)

	// Prepare layouts for all nodes
	layouts := make([]radialLayout, len(*treeInput))
	for i, node := range *treeInput {
		shape := getRoomShape(node)
		normalized := normalizeShape(shape)
		// Bounding circle radius is half the diagonal + spacing for clearance
		maxDim := normalized.Width
		if normalized.Height > maxDim {
			maxDim = normalized.Height
		}
		layouts[i] = radialLayout{
			nodeIndex:  i,
			normalized: normalized,
			radius:     float64(maxDim)/2.0 + float64(NodeSpacing)/2.0,
		}
	}

	// Calculate ring radii (cumulative max radius at each depth)
	ringRadii := make([]float64, maxDepth+1)
	for depth := 0; depth <= maxDepth; depth++ {
		maxRadius := 0.0
		for _, nodeIndex := range depthMap[depth] {
			if layouts[nodeIndex].radius > maxRadius {
				maxRadius = layouts[nodeIndex].radius
			}
		}
		if depth == 0 {
			ringRadii[depth] = 0 // Root at center
		} else {
			// Ring radius = previous ring + previous max radius + current max radius + level spacing
			prevMaxRadius := 0.0
			for _, nodeIndex := range depthMap[depth-1] {
				if layouts[nodeIndex].radius > prevMaxRadius {
					prevMaxRadius = layouts[nodeIndex].radius
				}
			}
			ringRadii[depth] = ringRadii[depth-1] + prevMaxRadius + maxRadius + float64(LevelSpacing)
		}
	}

	// Step 1: Calculate angular widths bottom-up
	// Each leaf needs enough angle to fit its bounding circle at its ring radius
	for depth := maxDepth; depth >= 0; depth-- {
		for _, nodeIndex := range depthMap[depth] {
			children := childrenMap[nodeIndex]
			ringRadius := ringRadii[depth]

			if len(children) == 0 {
				// Leaf node: angular width based on fitting bounding circle at ring radius
				if ringRadius < 1 {
					ringRadius = 1 // Prevent division by zero for root
				}
				// Arc length needed = 2 * radius, angular width = arc_length / ring_radius
				arcLength := 2 * layouts[nodeIndex].radius
				layouts[nodeIndex].angularWidth = arcLength / ringRadius
			} else {
				// Parent node: sum of children's angular widths
				totalAngularWidth := 0.0
				for _, childIndex := range children {
					totalAngularWidth += layouts[childIndex].angularWidth
				}
				// Also ensure parent itself fits
				if ringRadius < 1 {
					ringRadius = 1
				}
				ownAngularWidth := (2 * layouts[nodeIndex].radius) / ringRadius
				if totalAngularWidth < ownAngularWidth {
					totalAngularWidth = ownAngularWidth
				}
				layouts[nodeIndex].angularWidth = totalAngularWidth
			}
		}
	}

	// Step 2: Assign angles top-down
	// Root starts at angle 0, children spread around it
	for depth := 0; depth <= maxDepth; depth++ {
		for _, nodeIndex := range depthMap[depth] {
			layouts[nodeIndex].ringRadius = ringRadii[depth]

			if depth == 0 {
				// Root at center, angle doesn't matter much but set to 0
				layouts[nodeIndex].angle = 0
			} else {
				parentIndex := (*treeInput)[nodeIndex].ParentId
				parentLayout := layouts[parentIndex]

				siblings := childrenMap[parentIndex]
				siblingIndex := findSiblingIndex(siblings, nodeIndex)

				// Calculate starting angle for children (centered on parent's angle)
				totalSiblingWidth := 0.0
				for _, sibIndex := range siblings {
					totalSiblingWidth += layouts[sibIndex].angularWidth
				}

				startAngle := parentLayout.angle - totalSiblingWidth/2

				// Accumulate angle for siblings before this one
				accumulatedAngle := 0.0
				for i := 0; i < siblingIndex; i++ {
					accumulatedAngle += layouts[siblings[i]].angularWidth
				}

				// This node's center angle
				layouts[nodeIndex].angle = startAngle + accumulatedAngle + layouts[nodeIndex].angularWidth/2
			}
		}
	}

	// Step 3: Convert polar to Cartesian coordinates
	result := make([]PlacedShape, len(layouts))
	for nodeIndex, layout := range layouts {
		// Convert polar (ringRadius, angle) to Cartesian (x, y)
		centerX := layout.ringRadius * math.Cos(layout.angle)
		centerY := layout.ringRadius * math.Sin(layout.angle)

		// Position is top-left corner of bounding box
		posX := int(math.Round(centerX)) - layout.normalized.Width/2
		posY := int(math.Round(centerY)) - layout.normalized.Height/2

		result[nodeIndex] = PlacedShape{
			Points:   layout.normalized.Points,
			Position: Point{posX, posY},
			Width:    layout.normalized.Width,
			Height:   layout.normalized.Height,
		}
	}

	return result
}

// directionalLayout stores positioning for directional placement
type directionalLayout struct {
	nodeIndex  int
	normalized PlacedShape
	direction  LayoutDirection // direction this node's children grow
	centerX    int
	centerY    int
	unitWidth  int // spread size perpendicular to direction
	unitDepth  int // depth size along direction
}

// placeDirectional positions nodes where each branch can go in a different direction
// Children of each node are distributed across available directions
func placeDirectional(treeInput *tree.Tree, getRoomShape GetRoomShapeFunc, config LayoutConfig) []PlacedShape {
	if len(*treeInput) == 0 {
		return []PlacedShape{}
	}

	// Build depth map and relationships
	_, childrenMap, _ := buildDepthMap(treeInput)

	// Prepare layouts for all nodes
	layouts := make([]directionalLayout, len(*treeInput))
	for i, node := range *treeInput {
		shape := getRoomShape(node)
		layouts[i] = directionalLayout{
			nodeIndex:  i,
			normalized: normalizeShape(shape),
		}
	}

	// Assign directions to each node's children
	// If NodeDirections is provided, use it; otherwise distribute children across 4 directions
	nodeDirections := assignDirections(treeInput, childrenMap, config.NodeDirections)

	// Calculate unit sizes bottom-up (need to know direction first)
	depths := make([]int, len(*treeInput))
	var maxDepth int
	for i, node := range *treeInput {
		if node.ParentId == -1 {
			depths[i] = 0
		} else {
			depths[i] = depths[node.ParentId] + 1
		}
		if depths[i] > maxDepth {
			maxDepth = depths[i]
		}
	}

	// Build depthMap for iteration order
	depthMap := make(map[int][]int)
	for i := range *treeInput {
		depthMap[depths[i]] = append(depthMap[depths[i]], i)
	}

	// Bottom-up: calculate space needed
	for depth := maxDepth; depth >= 0; depth-- {
		for _, nodeIndex := range depthMap[depth] {
			children := childrenMap[nodeIndex]
			layout := &layouts[nodeIndex]

			if len(children) == 0 {
				// Leaf: unit size is just the shape
				layout.unitWidth = max(layout.normalized.Width, layout.normalized.Height)
				layout.unitDepth = max(layout.normalized.Width, layout.normalized.Height)
			} else {
				// Group children by their assigned direction
				dirGroups := make(map[LayoutDirection][]int)
				for _, childIndex := range children {
					dir := nodeDirections[childIndex]
					dirGroups[dir] = append(dirGroups[dir], childIndex)
				}

				// Calculate space needed in each direction
				maxExtent := 0
				maxPerpendicular := 0

				for dir, groupChildren := range dirGroups {
					// Sum of children's depths along this direction
					depthSum := 0
					perpMax := 0
					for _, childIndex := range groupChildren {
						childLayout := layouts[childIndex]
						if dir == TopDown || dir == BottomUp {
							depthSum += childLayout.unitDepth + LevelSpacing
							if childLayout.unitWidth > perpMax {
								perpMax = childLayout.unitWidth
							}
						} else {
							depthSum += childLayout.unitWidth + LevelSpacing
							if childLayout.unitDepth > perpMax {
								perpMax = childLayout.unitDepth
							}
						}
					}
					if depthSum > maxExtent {
						maxExtent = depthSum
					}
					if perpMax > maxPerpendicular {
						maxPerpendicular = perpMax
					}
				}

				// Node's own size
				ownSize := max(layout.normalized.Width, layout.normalized.Height)
				layout.unitWidth = max(ownSize, maxPerpendicular+maxExtent)
				layout.unitDepth = max(ownSize, maxExtent)
			}
		}
	}

	// Top-down: assign positions
	layouts[0].centerX = 0
	layouts[0].centerY = 0

	for depth := 0; depth <= maxDepth; depth++ {
		for _, nodeIndex := range depthMap[depth] {
			children := childrenMap[nodeIndex]
			if len(children) == 0 {
				continue
			}

			parentLayout := layouts[nodeIndex]

			// Group children by direction
			dirGroups := make(map[LayoutDirection][]int)
			for _, childIndex := range children {
				dir := nodeDirections[childIndex]
				dirGroups[dir] = append(dirGroups[dir], childIndex)
			}

			// Position children in each direction
			for dir, groupChildren := range dirGroups {
				placeChildrenInDirection(
					parentLayout.centerX,
					parentLayout.centerY,
					max(parentLayout.normalized.Width, parentLayout.normalized.Height)/2,
					dir,
					groupChildren,
					layouts,
				)
			}
		}
	}

	// Convert to PlacedShape results
	result := make([]PlacedShape, len(layouts))
	for nodeIndex, layout := range layouts {
		posX := layout.centerX - layout.normalized.Width/2
		posY := layout.centerY - layout.normalized.Height/2

		result[nodeIndex] = PlacedShape{
			Points:   layout.normalized.Points,
			Position: Point{posX, posY},
			Width:    layout.normalized.Width,
			Height:   layout.normalized.Height,
		}
	}

	return result
}

// assignDirections determines which direction each node's children should grow
func assignDirections(treeInput *tree.Tree, childrenMap map[int][]int, overrides map[int]LayoutDirection) map[int]LayoutDirection {
	result := make(map[int]LayoutDirection)

	// Available directions for distribution
	directions := []LayoutDirection{TopDown, RightToLeft, BottomUp, LeftToRight}

	for parentIndex, children := range childrenMap {
		// Check if parent has an override that applies to all children
		if override, ok := overrides[parentIndex]; ok {
			for _, childIndex := range children {
				result[childIndex] = override
			}
			continue
		}

		// Distribute children across directions
		for i, childIndex := range children {
			// Check for per-child override
			if override, ok := overrides[childIndex]; ok {
				result[childIndex] = override
			} else {
				// Round-robin distribution
				result[childIndex] = directions[i%len(directions)]
			}
		}
	}

	return result
}

// placeChildrenInDirection positions a group of children in a specific direction from parent
func placeChildrenInDirection(
	parentX, parentY, parentRadius int,
	dir LayoutDirection,
	children []int,
	layouts []directionalLayout,
) {
	if len(children) == 0 {
		return
	}

	// Calculate total perpendicular size needed
	totalPerpSize := 0
	for _, childIndex := range children {
		childLayout := layouts[childIndex]
		if dir == TopDown || dir == BottomUp {
			totalPerpSize += childLayout.unitWidth
		} else {
			totalPerpSize += childLayout.unitDepth
		}
	}
	totalPerpSize += (len(children) - 1) * NodeSpacing

	// Starting offset for perpendicular axis (centered)
	perpOffset := -totalPerpSize / 2

	for _, childIndex := range children {
		childLayout := &layouts[childIndex]

		// Distance from parent center
		spacing := parentRadius + LevelSpacing + max(childLayout.normalized.Width, childLayout.normalized.Height)/2

		var perpSize int
		if dir == TopDown || dir == BottomUp {
			perpSize = childLayout.unitWidth
		} else {
			perpSize = childLayout.unitDepth
		}

		// Center position in perpendicular direction
		perpCenter := perpOffset + perpSize/2

		switch dir {
		case TopDown:
			childLayout.centerX = parentX + perpCenter
			childLayout.centerY = parentY + spacing
		case BottomUp:
			childLayout.centerX = parentX + perpCenter
			childLayout.centerY = parentY - spacing
		case LeftToRight:
			childLayout.centerX = parentX + spacing
			childLayout.centerY = parentY + perpCenter
		case RightToLeft:
			childLayout.centerX = parentX - spacing
			childLayout.centerY = parentY + perpCenter
		}

		perpOffset += perpSize + NodeSpacing
	}
}
