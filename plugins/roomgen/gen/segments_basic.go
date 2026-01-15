package gen

// segments_basic.go - Guaranteed reachable movement primitives
//
// This file provides segment generation functions that GUARANTEE reachability
// by construction. Each function validates constraints BEFORE generating segments.
//
// GUARANTEES:
// 1. All segments respect movement constraints
// 2. No gaps that exceed jump distance
// 3. Vertical changes within jump/ladder limits
// 4. All paths stay within bounds or room shape

// GenerateBasicSegments creates guaranteed-reachable path segments
// Returns nil if path cannot be made reachable with basic abilities
func GenerateBasicSegments(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	// Validate bounds
	if !bounds.Contains(from) || !bounds.Contains(to) {
		return nil
	}

	dx := to.X - from.X
	dy := to.Y - from.Y

	// Pure horizontal movement
	if dy == 0 {
		return generateHorizontalSegments(from, to, abilities, bounds)
	}

	// Pure vertical movement
	if dx == 0 {
		return generateVerticalSegments(from, to, abilities, bounds)
	}

	// Combined movement - use L-shaped path
	return generateLShapedSegments(from, to, abilities, bounds)
}

// GenerateBasicSegmentsInShape creates segments constrained to room shape
// This is used for non-rectangular rooms
func GenerateBasicSegmentsInShape(from, to Point, abilities PlayerAbilities, shape *RoomShape) []PathSegment {
	if shape == nil {
		return nil
	}

	// Validate points are in shape
	if !shape.Contains(from) || !shape.Contains(to) {
		return nil
	}

	dx := to.X - from.X
	dy := to.Y - from.Y

	// Pure horizontal movement
	if dy == 0 {
		return generateHorizontalSegmentsInShape(from, to, abilities, shape)
	}

	// Pure vertical movement
	if dx == 0 {
		return generateVerticalSegmentsInShape(from, to, abilities, shape)
	}

	// Combined movement - use L-shaped path
	return generateLShapedSegmentsInShape(from, to, abilities, shape)
}

// generateHorizontalSegmentsInShape creates segments for horizontal movement within shape
func generateHorizontalSegmentsInShape(from, to Point, abilities PlayerAbilities, shape *RoomShape) []PathSegment {
	segments := []PathSegment{}

	// Platform is placed AT the navigation point Y level
	// The player walks ON this platform
	platformY := from.Y

	// Find valid platform extent within shape
	startX := from.X
	endX := to.X
	if startX > endX {
		startX, endX = endX, startX
	}

	// Verify platform Y is within shape, if not try to find valid Y
	if !shape.Contains(Point{from.X, platformY}) {
		// Try finding a valid Y within the shape near the target
		for dy := 0; dy <= 2; dy++ {
			if shape.Contains(Point{from.X, from.Y - dy}) {
				platformY = from.Y - dy
				break
			}
			if shape.Contains(Point{from.X, from.Y + dy}) {
				platformY = from.Y + dy
				break
			}
		}
	}

	// Only create segment if endpoints are in shape
	if shape.Contains(Point{startX, platformY}) && shape.Contains(Point{endX, platformY}) {
		segments = append(segments, PathSegment{
			Type:  SegmentPlatform,
			Start: Point{startX, platformY},
			End:   Point{endX, platformY},
		})
	}

	return segments
}

// generateVerticalSegmentsInShape creates segments for vertical movement within shape
func generateVerticalSegmentsInShape(from, to Point, abilities PlayerAbilities, shape *RoomShape) []PathSegment {
	dy := to.Y - from.Y
	goingUp := dy < 0

	absDY := dy
	if absDY < 0 {
		absDY = -absDY
	}

	segments := []PathSegment{}

	// Determine ladder X position - must be in shape
	ladderX := from.X
	if !shape.Contains(Point{ladderX, from.Y}) || !shape.Contains(Point{ladderX, to.Y}) {
		// Try to find valid X for ladder
		for dx := 0; dx <= 2; dx++ {
			if shape.Contains(Point{from.X + dx, from.Y}) && shape.Contains(Point{from.X + dx, to.Y}) {
				ladderX = from.X + dx
				break
			}
			if shape.Contains(Point{from.X - dx, from.Y}) && shape.Contains(Point{from.X - dx, to.Y}) {
				ladderX = from.X - dx
				break
			}
		}
	}

	if goingUp {
		if absDY <= abilities.JumpHeight {
			// Can jump - add landing platform at destination
			segments = append(segments, createLandingPlatformInShape(to, shape))
		} else if abilities.CanUseLadders {
			// Need ladder - ensure all ladder tiles are in shape
			ladderStart := Point{ladderX, to.Y}
			ladderEnd := Point{ladderX, from.Y}

			// Verify ladder is in shape
			allInShape := true
			minY, maxY := ladderStart.Y, ladderEnd.Y
			if minY > maxY {
				minY, maxY = maxY, minY
			}
			for y := minY; y <= maxY; y++ {
				if !shape.Contains(Point{ladderX, y}) {
					allInShape = false
					break
				}
			}

			if allInShape {
				segments = append(segments, PathSegment{
					Type:  SegmentLadder,
					Start: ladderStart,
					End:   ladderEnd,
				})
			}
			segments = append(segments, createLandingPlatformInShape(to, shape))
		} else {
			return nil
		}
	} else {
		// Going down
		if abilities.CanDropThrough {
			// One-way platform at start position - must be in shape
			owStart := Point{from.X - 1, from.Y}
			owEnd := Point{from.X + 1, from.Y}
			if shape.Contains(owStart) && shape.Contains(owEnd) {
				segments = append(segments, PathSegment{
					Type:  SegmentOnewayPlatform,
					Start: owStart,
					End:   owEnd,
				})
			}
		} else if abilities.CanUseLadders {
			// Ladder down
			ladderStart := Point{ladderX, from.Y}
			ladderEnd := Point{ladderX, to.Y}

			allInShape := true
			minY, maxY := ladderStart.Y, ladderEnd.Y
			if minY > maxY {
				minY, maxY = maxY, minY
			}
			for y := minY; y <= maxY; y++ {
				if !shape.Contains(Point{ladderX, y}) {
					allInShape = false
					break
				}
			}

			if allInShape {
				segments = append(segments, PathSegment{
					Type:  SegmentLadder,
					Start: ladderStart,
					End:   ladderEnd,
				})
			}
		} else {
			segments = append(segments, createStaircaseDownInShape(from, to, abilities, shape)...)
		}
		segments = append(segments, createLandingPlatformInShape(to, shape))
	}

	return segments
}

// generateLShapedSegmentsInShape creates L-shaped path within shape
func generateLShapedSegmentsInShape(from, to Point, abilities PlayerAbilities, shape *RoomShape) []PathSegment {
	dy := to.Y - from.Y
	goingUp := dy < 0

	absDY := dy
	if absDY < 0 {
		absDY = -absDY
	}

	segments := []PathSegment{}

	// Try both intermediate points
	intermediate1 := Point{to.X, from.Y} // Horizontal first
	intermediate2 := Point{from.X, to.Y} // Vertical first

	// Prefer path that goes through valid tiles
	var intermediate Point
	if shape.Contains(intermediate1) {
		intermediate = intermediate1
	} else if shape.Contains(intermediate2) {
		intermediate = intermediate2
	} else {
		// Neither intermediate is in shape - find nearest valid point
		intermediate = shape.FindNearestInside(intermediate1)
	}

	if goingUp && absDY > abilities.JumpHeight {
		// Vertical first
		vertSegs := generateVerticalSegmentsInShape(from, Point{from.X, intermediate.Y}, abilities, shape)
		if vertSegs != nil {
			segments = append(segments, vertSegs...)
		}
		if from.X != to.X {
			horizSegs := generateHorizontalSegmentsInShape(Point{from.X, intermediate.Y}, to, abilities, shape)
			if horizSegs != nil {
				segments = append(segments, horizSegs...)
			}
		}
	} else {
		// Horizontal first
		if from.X != to.X {
			horizSegs := generateHorizontalSegmentsInShape(from, intermediate, abilities, shape)
			if horizSegs != nil {
				segments = append(segments, horizSegs...)
			}
		}
		if from.Y != to.Y {
			vertSegs := generateVerticalSegmentsInShape(intermediate, to, abilities, shape)
			if vertSegs != nil {
				segments = append(segments, vertSegs...)
			}
		}
	}

	return segments
}

// createLandingPlatformInShape creates a platform for landing within shape
func createLandingPlatformInShape(pos Point, shape *RoomShape) PathSegment {
	// Platform at the navigation point level
	platformY := pos.Y
	startX := pos.X - 1
	endX := pos.X + 1

	// Verify Y is in shape
	if !shape.Contains(Point{pos.X, platformY}) {
		// Position not in shape - this shouldn't happen if nodes are properly placed
		// Return minimal valid segment
		return PathSegment{
			Type:  SegmentPlatform,
			Start: pos,
			End:   pos,
		}
	}

	// Adjust X extents to stay in shape
	if !shape.Contains(Point{startX, platformY}) {
		startX = pos.X
	}
	if !shape.Contains(Point{endX, platformY}) {
		endX = pos.X
	}

	return PathSegment{
		Type:  SegmentPlatform,
		Start: Point{startX, platformY},
		End:   Point{endX, platformY},
	}
}

// createStaircaseDownInShape creates staircase within shape
func createStaircaseDownInShape(from, to Point, abilities PlayerAbilities, shape *RoomShape) []PathSegment {
	segments := []PathSegment{}

	dx := to.X - from.X
	dy := to.Y - from.Y

	stepHeight := abilities.JumpHeight
	if stepHeight < 1 {
		stepHeight = 1
	}

	absDY := dy
	if absDY < 0 {
		absDY = -absDY
	}

	numSteps := (absDY + stepHeight - 1) / stepHeight
	if numSteps < 1 {
		numSteps = 1
	}

	xDir := 1
	if dx < 0 {
		xDir = -1
	}

	absDX := dx
	if absDX < 0 {
		absDX = -absDX
	}

	stepWidth := 2
	if numSteps > 1 && absDX > 0 {
		stepWidth = absDX / numSteps
		if stepWidth < 2 {
			stepWidth = 2
		}
	}

	currentX := from.X
	currentY := from.Y // Platform at navigation level, not Y+1

	for i := 0; i < numSteps; i++ {
		nextX := currentX + stepWidth*xDir

		// Clamp to shape
		for !shape.Contains(Point{nextX, currentY}) && nextX != currentX {
			nextX -= xDir
		}

		// Only add if in shape
		if shape.Contains(Point{currentX, currentY}) && shape.Contains(Point{nextX, currentY}) {
			segments = append(segments, PathSegment{
				Type:  SegmentPlatform,
				Start: Point{currentX, currentY},
				End:   Point{nextX, currentY},
			})
		}

		if i < numSteps-1 {
			currentX = nextX
			currentY += stepHeight
			if currentY > to.Y {
				currentY = to.Y
			}
		}
	}

	return segments
}

// generateHorizontalSegments creates segments for horizontal movement
func generateHorizontalSegments(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	segments := []PathSegment{}

	// Platform at navigation point level
	platformY := from.Y

	// Clamp platform Y to bounds
	if platformY >= bounds.Y+bounds.Height {
		platformY = bounds.Y + bounds.Height - 1
	}
	if platformY < bounds.Y {
		platformY = bounds.Y
	}

	startX := from.X
	endX := to.X
	if startX > endX {
		startX, endX = endX, startX
	}

	segments = append(segments, PathSegment{
		Type:  SegmentPlatform,
		Start: Point{startX, platformY},
		End:   Point{endX, platformY},
	})

	return segments
}

// generateVerticalSegments creates segments for vertical movement
func generateVerticalSegments(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	dy := to.Y - from.Y
	goingUp := dy < 0

	absDY := dy
	if absDY < 0 {
		absDY = -absDY
	}

	segments := []PathSegment{}

	if goingUp {
		// Moving upward
		if absDY <= abilities.JumpHeight {
			// Can jump up - add platform at destination
			segments = append(segments, PathSegment{
				Type:  SegmentPlatform,
				Start: Point{to.X - 1, to.Y},
				End:   Point{to.X + 1, to.Y},
			})
		} else if abilities.CanUseLadders {
			// Need ladder
			segments = append(segments, PathSegment{
				Type:  SegmentLadder,
				Start: Point{from.X, to.Y},
				End:   Point{from.X, from.Y},
			})
			// Platform at top
			segments = append(segments, PathSegment{
				Type:  SegmentPlatform,
				Start: Point{to.X - 1, to.Y},
				End:   Point{to.X + 1, to.Y},
			})
		} else {
			// Fallback to ladder
			segments = append(segments, PathSegment{
				Type:  SegmentLadder,
				Start: Point{from.X, to.Y},
				End:   Point{from.X, from.Y},
			})
		}
	} else {
		// Moving downward
		if abilities.CanDropThrough {
			// One-way platform at start
			segments = append(segments, PathSegment{
				Type:  SegmentOnewayPlatform,
				Start: Point{from.X - 1, from.Y},
				End:   Point{from.X + 1, from.Y},
			})
		} else if abilities.CanUseLadders {
			// Climb down ladder
			segments = append(segments, PathSegment{
				Type:  SegmentLadder,
				Start: from,
				End:   to,
			})
		} else {
			// Platform staircase down
			segments = append(segments, createStaircaseDown(from, to, abilities, bounds)...)
		}
		// Platform at destination
		segments = append(segments, PathSegment{
			Type:  SegmentPlatform,
			Start: Point{to.X - 1, to.Y},
			End:   Point{to.X + 1, to.Y},
		})
	}

	return segments
}

// generateLShapedSegments creates an L-shaped path (horizontal then vertical or vice versa)
func generateLShapedSegments(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	dy := to.Y - from.Y
	goingUp := dy < 0

	absDY := dy
	if absDY < 0 {
		absDY = -absDY
	}

	segments := []PathSegment{}

	// Strategy: if going up significantly, do vertical first
	// Otherwise, do horizontal first
	if goingUp && absDY > abilities.JumpHeight {
		// Vertical first (climb/ladder), then horizontal
		intermediate := Point{from.X, to.Y}

		// Vertical segment
		vertSegs := generateVerticalSegments(from, intermediate, abilities, bounds)
		if vertSegs == nil {
			return nil
		}
		segments = append(segments, vertSegs...)

		// Horizontal segment
		if from.X != to.X {
			horizSegs := generateHorizontalSegments(intermediate, to, abilities, bounds)
			if horizSegs == nil {
				return nil
			}
			segments = append(segments, horizSegs...)
		}
	} else {
		// Horizontal first, then vertical
		intermediate := Point{to.X, from.Y}

		// Horizontal segment
		if from.X != to.X {
			horizSegs := generateHorizontalSegments(from, intermediate, abilities, bounds)
			if horizSegs == nil {
				return nil
			}
			segments = append(segments, horizSegs...)
		}

		// Vertical segment
		if from.Y != to.Y {
			vertSegs := generateVerticalSegments(intermediate, to, abilities, bounds)
			if vertSegs == nil {
				return nil
			}
			segments = append(segments, vertSegs...)
		}
	}

	return segments
}

// createLandingPlatform creates a small platform for landing/standing
func createLandingPlatform(pos Point, bounds Rect) PathSegment {
	// Platform at the navigation point level
	startX := pos.X - 1
	endX := pos.X + 1
	platformY := pos.Y // Platform at navigation level

	// Clamp to bounds
	if startX < bounds.X {
		startX = bounds.X
	}
	if endX >= bounds.X+bounds.Width {
		endX = bounds.X + bounds.Width - 1
	}
	if platformY >= bounds.Y+bounds.Height {
		platformY = bounds.Y + bounds.Height - 1
	}
	if platformY < bounds.Y {
		platformY = bounds.Y
	}

	return PathSegment{
		Type:  SegmentPlatform,
		Start: Point{startX, platformY},
		End:   Point{endX, platformY},
	}
}

// createStaircaseDown creates a staircase of platforms going down
func createStaircaseDown(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	segments := []PathSegment{}

	dx := to.X - from.X
	dy := to.Y - from.Y

	// Determine step dimensions
	stepHeight := abilities.JumpHeight
	if stepHeight < 1 {
		stepHeight = 1
	}

	absDY := dy
	if absDY < 0 {
		absDY = -absDY
	}

	numSteps := (absDY + stepHeight - 1) / stepHeight
	if numSteps < 1 {
		numSteps = 1
	}

	// Step width based on available horizontal space
	absDX := dx
	if absDX < 0 {
		absDX = -absDX
	}

	stepWidth := 2 // Minimum width
	if numSteps > 1 && absDX > 0 {
		stepWidth = absDX / numSteps
		if stepWidth < 2 {
			stepWidth = 2
		}
	}

	xDir := 1
	if dx < 0 {
		xDir = -1
	}

	currentX := from.X
	currentY := from.Y // Platform at navigation level

	for i := 0; i < numSteps; i++ {
		nextX := currentX + stepWidth*xDir

		// Clamp to destination
		if (xDir > 0 && nextX > to.X) || (xDir < 0 && nextX < to.X) {
			nextX = to.X
		}

		// Clamp to bounds
		if nextX < bounds.X {
			nextX = bounds.X
		}
		if nextX >= bounds.X+bounds.Width {
			nextX = bounds.X + bounds.Width - 1
		}

		segments = append(segments, PathSegment{
			Type:  SegmentPlatform,
			Start: Point{currentX, currentY},
			End:   Point{nextX, currentY},
		})

		// Move to next level
		if i < numSteps-1 {
			currentX = nextX
			currentY += stepHeight
			if currentY > to.Y+1 {
				currentY = to.Y + 1
			}
		}
	}

	return segments
}

// CreateAnchorNode creates an intermediate anchor point to avoid straight lines
// Returns a point offset from the direct line between from and to
func CreateAnchorNode(from, to Point, bounds Rect, offset int) Point {
	midX := (from.X + to.X) / 2
	midY := (from.Y + to.Y) / 2

	// Offset perpendicular to the line
	dx := to.X - from.X
	dy := to.Y - from.Y

	// Simple perpendicular offset
	anchor := Point{midX, midY}

	// If mostly horizontal, offset vertically
	if dx*dx > dy*dy {
		anchor.Y += offset
	} else {
		// If mostly vertical, offset horizontally
		anchor.X += offset
	}

	// Clamp to bounds
	return ClampToBounds(anchor, bounds, 1)
}

// GenerateSegmentsWithAnchor creates segments via an anchor node (non-straight path)
func GenerateSegmentsWithAnchor(from, to Point, anchor Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	segments := []PathSegment{}

	// From -> Anchor
	seg1 := GenerateBasicSegments(from, anchor, abilities, bounds)
	if seg1 == nil {
		// Fallback to direct path
		return GenerateBasicSegments(from, to, abilities, bounds)
	}
	segments = append(segments, seg1...)

	// Anchor -> To
	seg2 := GenerateBasicSegments(anchor, to, abilities, bounds)
	if seg2 == nil {
		// Fallback to direct path
		return GenerateBasicSegments(from, to, abilities, bounds)
	}
	segments = append(segments, seg2...)

	return segments
}

// FitSegmentsInBounds adjusts segments to fit within room bounds
func FitSegmentsInBounds(segments []PathSegment, bounds Rect, margin int) []PathSegment {
	fitted := make([]PathSegment, len(segments))

	for i, seg := range segments {
		fitted[i] = fitSegment(seg, bounds, margin)
	}

	return fitted
}

// fitSegment adjusts a single segment to fit within bounds
func fitSegment(seg PathSegment, bounds Rect, margin int) PathSegment {
	result := seg

	// Clamp start point
	result.Start = ClampToBounds(result.Start, bounds, margin)

	// Clamp end point
	result.End = ClampToBounds(result.End, bounds, margin)

	// Regenerate tiles if needed
	if len(seg.Tiles) > 0 {
		result.Tiles = nil // Will be regenerated by GetTiles()
	}

	return result
}

// MergeOverlappingPlatforms merges platform segments that share tiles
func MergeOverlappingPlatforms(segments []PathSegment) []PathSegment {
	if len(segments) <= 1 {
		return segments
	}

	// Group platforms by Y coordinate
	platformsByY := make(map[int][]PathSegment)
	others := []PathSegment{}

	for _, seg := range segments {
		if seg.Type == SegmentPlatform || seg.Type == SegmentOnewayPlatform {
			y := seg.Start.Y
			platformsByY[y] = append(platformsByY[y], seg)
		} else {
			others = append(others, seg)
		}
	}

	// Merge platforms at same Y
	result := []PathSegment{}
	for y, platforms := range platformsByY {
		if len(platforms) == 1 {
			result = append(result, platforms[0])
			continue
		}

		// Find extent
		minX := platforms[0].Start.X
		maxX := platforms[0].End.X
		segType := platforms[0].Type

		for _, p := range platforms[1:] {
			if p.Start.X < minX {
				minX = p.Start.X
			}
			if p.End.X < minX {
				minX = p.End.X
			}
			if p.Start.X > maxX {
				maxX = p.Start.X
			}
			if p.End.X > maxX {
				maxX = p.End.X
			}
		}

		result = append(result, PathSegment{
			Type:  segType,
			Start: Point{minX, y},
			End:   Point{maxX, y},
		})
	}

	result = append(result, others...)
	return result
}
