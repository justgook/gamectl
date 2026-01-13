package gen

// GenerateSegments converts navigation edges into movement segments
// based on player abilities
func GenerateSegments(graph *NavigationGraph, abilities PlayerAbilities, bounds Rect) {
	for i := range graph.Edges {
		edge := &graph.Edges[i]
		fromNode := graph.GetNodeByID(edge.FromID)
		toNode := graph.GetNodeByID(edge.ToID)

		if fromNode == nil || toNode == nil {
			continue
		}

		edge.Segments = generateEdgeSegments(
			fromNode.Position,
			toNode.Position,
			abilities,
			bounds,
		)
	}
}

// generateEdgeSegments creates segments for a single edge
func generateEdgeSegments(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	dx := to.X - from.X
	dy := to.Y - from.Y // Positive = downward

	segments := []PathSegment{}

	// Analyze movement requirements
	needsHorizontal := dx != 0
	needsVertical := dy != 0
	goingUp := dy < 0

	absY := dy
	if absY < 0 {
		absY = -absY
	}

	// Strategy depends on vertical distance and abilities
	if !needsVertical {
		// Pure horizontal movement
		segments = append(segments, createHorizontalPath(from, to, abilities)...)
	} else if !needsHorizontal {
		// Pure vertical movement
		segments = append(segments, createVerticalPath(from, to, abilities, goingUp, absY)...)
	} else {
		// Combined movement - choose best approach
		segments = append(segments, createCombinedPath(from, to, abilities, bounds)...)
	}

	return segments
}

// createHorizontalPath creates segments for horizontal movement
func createHorizontalPath(from, to Point, abilities PlayerAbilities) []PathSegment {
	segments := []PathSegment{}

	dx := to.X - from.X
	absDX := dx
	if absDX < 0 {
		absDX = -absDX
	}

	// Check if we can jump the gap
	if absDX <= abilities.JumpDistance {
		// Single jump
		segments = append(segments, PathSegment{
			Type:  SegmentPlatform,
			Start: from,
			End:   from,
			Tiles: []Point{from},
		})
		segments = append(segments, PathSegment{
			Type:  SegmentJump,
			Start: from,
			End:   to,
		})
		segments = append(segments, PathSegment{
			Type:  SegmentPlatform,
			Start: to,
			End:   to,
			Tiles: []Point{to},
		})
	} else {
		// Need platform(s) - create walkable path
		segments = append(segments, PathSegment{
			Type:  SegmentPlatform,
			Start: from,
			End:   to,
		})
	}

	return segments
}

// createVerticalPath creates segments for vertical movement
func createVerticalPath(from, to Point, abilities PlayerAbilities, goingUp bool, absY int) []PathSegment {
	segments := []PathSegment{}

	if goingUp {
		// Moving upward
		if absY <= abilities.JumpHeight {
			// Can jump up
			segments = append(segments, PathSegment{
				Type:  SegmentPlatform,
				Start: from,
				End:   from,
			})
			segments = append(segments, PathSegment{
				Type:  SegmentJump,
				Start: from,
				End:   to,
			})
			segments = append(segments, PathSegment{
				Type:  SegmentPlatform,
				Start: to,
				End:   to,
			})
		} else if abilities.CanUseLadders {
			// Need ladder
			segments = append(segments, PathSegment{
				Type:  SegmentLadder,
				Start: from,
				End:   to,
			})
		} else if abilities.CanWallJump && absY <= abilities.WallJumpHeight*3 {
			// Use wall jumps
			segments = append(segments, createWallJumpPath(from, to, abilities)...)
		} else if abilities.CanDoubleJump && absY <= abilities.JumpHeight+abilities.DoubleJumpHeight {
			// Use double jump
			midPoint := Point{from.X, from.Y - abilities.JumpHeight}
			segments = append(segments, PathSegment{
				Type:  SegmentJump,
				Start: from,
				End:   midPoint,
			})
			segments = append(segments, PathSegment{
				Type:  SegmentDoubleJump,
				Start: midPoint,
				End:   to,
			})
		} else if abilities.CanGrapple {
			// Use grapple
			segments = append(segments, PathSegment{
				Type:  SegmentGrapple,
				Start: from,
				End:   to,
			})
		} else {
			// Fallback to ladder if nothing else works
			segments = append(segments, PathSegment{
				Type:  SegmentLadder,
				Start: from,
				End:   to,
			})
		}
	} else {
		// Moving downward
		if abilities.CanDropThrough {
			// Drop through one-way platforms
			segments = append(segments, PathSegment{
				Type:  SegmentOnewayPlatform,
				Start: from,
				End:   from,
			})
			segments = append(segments, PathSegment{
				Type:  SegmentDrop,
				Start: from,
				End:   to,
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
			segments = append(segments, createStaircasePath(from, to, abilities)...)
		}
	}

	return segments
}

// createCombinedPath creates segments for movement with both horizontal and vertical components
func createCombinedPath(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	_ = bounds // Reserved for future use in path fitting

	segments := []PathSegment{}

	dy := to.Y - from.Y
	goingUp := dy < 0

	absY := dy
	if absY < 0 {
		absY = -absY
	}

	// Strategy: Move horizontally first, then vertically (L-shaped path)
	// Or move vertically first if going up and horizontal is short

	if goingUp && absY > abilities.JumpHeight {
		// Going up significantly - vertical first is often better
		intermediateY := to.Y // Same Y as destination

		// Create vertical segment
		verticalEnd := Point{from.X, intermediateY}
		vertSegments := createVerticalPath(from, verticalEnd, abilities, true, absY)
		segments = append(segments, vertSegments...)

		// Then horizontal
		if from.X != to.X {
			horizSegments := createHorizontalPath(verticalEnd, to, abilities)
			segments = append(segments, horizSegments...)
		}
	} else {
		// Going down or small up - horizontal first
		intermediateX := to.X

		// Create horizontal platform
		horizEnd := Point{intermediateX, from.Y}
		if from.X != to.X {
			segments = append(segments, PathSegment{
				Type:  SegmentPlatform,
				Start: from,
				End:   horizEnd,
			})
		}

		// Then vertical
		if from.Y != to.Y {
			vertSegments := createVerticalPath(horizEnd, to, abilities, goingUp, absY)
			segments = append(segments, vertSegments...)
		}
	}

	return segments
}

// createWallJumpPath creates a wall-jump sequence
func createWallJumpPath(from, to Point, abilities PlayerAbilities) []PathSegment {
	segments := []PathSegment{}

	currentY := from.Y
	wallSide := DirWest // Alternate between walls
	x := from.X

	for currentY > to.Y {
		// Jump height per wall jump
		jumpUp := abilities.WallJumpHeight
		if currentY-jumpUp < to.Y {
			jumpUp = currentY - to.Y
		}

		nextY := currentY - jumpUp

		// Add wall jump surface
		segments = append(segments, PathSegment{
			Type:      SegmentWallJump,
			Start:     Point{x, currentY},
			End:       Point{x, nextY},
			Direction: wallSide,
		})

		currentY = nextY

		// Alternate walls
		if wallSide == DirWest {
			wallSide = DirEast
			x += abilities.WallJumpDistance
		} else {
			wallSide = DirWest
			x -= abilities.WallJumpDistance
		}
	}

	// Final platform at destination
	if len(segments) > 0 {
		lastSeg := segments[len(segments)-1]
		segments = append(segments, PathSegment{
			Type:  SegmentPlatform,
			Start: lastSeg.End,
			End:   to,
		})
	}

	return segments
}

// createStaircasePath creates a staircase of platforms
func createStaircasePath(from, to Point, abilities PlayerAbilities) []PathSegment {
	segments := []PathSegment{}

	dx := to.X - from.X
	dy := to.Y - from.Y
	goingDown := dy > 0

	absDY := dy
	if absDY < 0 {
		absDY = -absDY
	}

	// Calculate step dimensions
	stepHeight := abilities.JumpHeight
	if stepHeight < 1 {
		stepHeight = 1
	}

	numSteps := (absDY + stepHeight - 1) / stepHeight
	if numSteps < 1 {
		numSteps = 1
	}

	stepWidth := 2 // Minimum platform width
	if dx != 0 {
		absDX := dx
		if absDX < 0 {
			absDX = -absDX
		}
		stepWidth = absDX / numSteps
		if stepWidth < 2 {
			stepWidth = 2
		}
	}

	currentX := from.X
	currentY := from.Y
	xDirection := 1
	if dx < 0 {
		xDirection = -1
	}

	for i := 0; i < numSteps; i++ {
		// Platform at current level
		nextX := currentX + stepWidth*xDirection
		if (xDirection > 0 && nextX > to.X) || (xDirection < 0 && nextX < to.X) {
			nextX = to.X
		}

		segments = append(segments, PathSegment{
			Type:  SegmentPlatform,
			Start: Point{currentX, currentY},
			End:   Point{nextX, currentY},
		})

		// Move to next level
		if i < numSteps-1 {
			nextY := currentY + stepHeight
			if goingDown && nextY > to.Y {
				nextY = to.Y
			}

			// Small vertical segment (drop or jump)
			if goingDown {
				segments = append(segments, PathSegment{
					Type:  SegmentDrop,
					Start: Point{nextX, currentY},
					End:   Point{nextX, nextY},
				})
			} else {
				segments = append(segments, PathSegment{
					Type:  SegmentJump,
					Start: Point{nextX, currentY},
					End:   Point{nextX, nextY},
				})
			}

			currentX = nextX
			currentY = nextY
		}
	}

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
	result.Start = clampToRect(result.Start, bounds, margin)

	// Clamp end point
	result.End = clampToRect(result.End, bounds, margin)

	// Regenerate tiles if needed
	if len(seg.Tiles) > 0 {
		result.Tiles = nil // Will be regenerated by GetTiles()
	}

	return result
}
