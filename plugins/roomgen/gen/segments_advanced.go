package gen

// segments_advanced.go - Optional advanced movement abilities
//
// This file provides segment generation for intermediate and advanced movement
// abilities like wall jump, double jump, and grapple. These are opt-in and
// always fall back to basic abilities if the advanced path cannot be created.

// GenerateAdvancedSegments attempts to use advanced abilities for path generation
// Returns nil if advanced path cannot be created (caller should fall back to basic)
func GenerateAdvancedSegments(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	tier := abilities.GetTier()

	switch tier {
	case TierAdvanced:
		// Try grapple first, then wall jump, then double jump
		if segs := tryGrapplePath(from, to, abilities, bounds); segs != nil {
			return segs
		}
		fallthrough
	case TierIntermediate:
		// Try wall jump or double jump
		if segs := tryWallJumpPath(from, to, abilities, bounds); segs != nil {
			return segs
		}
		if segs := tryDoubleJumpPath(from, to, abilities, bounds); segs != nil {
			return segs
		}
	}

	return nil // Fall back to basic
}

// tryGrapplePath attempts to create a grapple-based path
func tryGrapplePath(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	if !abilities.CanGrapple {
		return nil
	}

	// Calculate distance
	dist := from.ManhattanDistance(to)
	if dist > abilities.GrappleRange {
		return nil // Too far
	}

	// Grapple point should be near the destination
	grapplePoint := to

	// Check if grapple point is reachable and in bounds
	if !bounds.Contains(grapplePoint) {
		return nil
	}

	segments := []PathSegment{
		{
			Type:  SegmentGrapple,
			Start: from,
			End:   grapplePoint,
		},
	}

	// Add landing platform at destination
	segments = append(segments, createLandingPlatform(to, bounds))

	return segments
}

// tryWallJumpPath attempts to create a wall-jump based path
func tryWallJumpPath(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	if !abilities.CanWallJump {
		return nil
	}

	dy := to.Y - from.Y
	if dy >= 0 {
		return nil // Wall jump is for going UP
	}

	height := -dy
	if height > abilities.WallJumpHeight*4 {
		return nil // Too high even with wall jumps
	}

	segments := []PathSegment{}

	currentX := from.X
	currentY := from.Y
	wallSide := DirWest // Start with left wall

	// Calculate number of wall jumps needed
	numJumps := (height + abilities.WallJumpHeight - 1) / abilities.WallJumpHeight

	for i := 0; i < numJumps; i++ {
		// Jump height for this segment
		jumpUp := abilities.WallJumpHeight
		if currentY-jumpUp < to.Y {
			jumpUp = currentY - to.Y
		}

		nextY := currentY - jumpUp

		// Determine wall position
		wallX := currentX
		if wallSide == DirEast {
			wallX = currentX + 1
		} else {
			wallX = currentX - 1
		}

		// Check bounds
		if wallX < bounds.X || wallX >= bounds.X+bounds.Width {
			// Switch wall side
			if wallSide == DirWest {
				wallSide = DirEast
				wallX = currentX + 1
			} else {
				wallSide = DirWest
				wallX = currentX - 1
			}
		}

		if wallX < bounds.X || wallX >= bounds.X+bounds.Width {
			return nil // No valid wall position
		}

		// Add wall jump surface
		segments = append(segments, PathSegment{
			Type:      SegmentWallJump,
			Start:     Point{wallX, currentY},
			End:       Point{wallX, nextY},
			Direction: wallSide,
		})

		currentY = nextY

		// Alternate walls and move horizontally
		if wallSide == DirWest {
			wallSide = DirEast
			currentX += abilities.WallJumpDistance
		} else {
			wallSide = DirWest
			currentX -= abilities.WallJumpDistance
		}

		// Clamp X to bounds
		if currentX < bounds.X {
			currentX = bounds.X
		}
		if currentX >= bounds.X+bounds.Width {
			currentX = bounds.X + bounds.Width - 1
		}
	}

	// Final platform at destination
	segments = append(segments, createLandingPlatform(to, bounds))

	// If we ended up far from target X, add horizontal platform
	if currentX != to.X {
		finalY := to.Y + 1
		minX := currentX
		maxX := to.X
		if minX > maxX {
			minX, maxX = maxX, minX
		}
		segments = append(segments, PathSegment{
			Type:  SegmentPlatform,
			Start: Point{minX, finalY},
			End:   Point{maxX, finalY},
		})
	}

	return segments
}

// tryDoubleJumpPath attempts to create a double-jump based path
func tryDoubleJumpPath(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	if !abilities.CanDoubleJump {
		return nil
	}

	dy := to.Y - from.Y
	if dy >= 0 {
		return nil // Double jump is for going UP
	}

	height := -dy
	maxHeight := abilities.JumpHeight + abilities.DoubleJumpHeight

	if height > maxHeight {
		return nil // Too high even with double jump
	}

	segments := []PathSegment{}

	// Calculate midpoint for double jump
	midY := from.Y - abilities.JumpHeight

	// First jump segment (implicit - no tile)
	// Double jump at midpoint
	segments = append(segments, PathSegment{
		Type:  SegmentDoubleJump,
		Start: Point{from.X, midY},
		End:   to,
	})

	// Landing platform
	segments = append(segments, createLandingPlatform(to, bounds))

	// Starting platform
	segments = append(segments, PathSegment{
		Type:  SegmentPlatform,
		Start: Point{from.X - 1, from.Y + 1},
		End:   Point{from.X + 1, from.Y + 1},
	})

	return segments
}

// GenerateSegmentsWithTier generates segments using appropriate tier abilities
func GenerateSegmentsWithTier(from, to Point, abilities PlayerAbilities, bounds Rect) []PathSegment {
	// Try advanced abilities first if available
	if abilities.GetTier() >= TierIntermediate {
		if segs := GenerateAdvancedSegments(from, to, abilities, bounds); segs != nil {
			return segs
		}
	}

	// Fall back to basic
	return GenerateBasicSegments(from, to, abilities, bounds)
}

// CanUseAdvancedPath checks if an advanced path is possible and beneficial
func CanUseAdvancedPath(from, to Point, abilities PlayerAbilities, bounds Rect) bool {
	if abilities.GetTier() < TierIntermediate {
		return false
	}

	// Check if basic path is sufficient
	basicSegs := GenerateBasicSegments(from, to, abilities, bounds)
	if basicSegs == nil {
		// Basic can't do it - advanced might help
		return true
	}

	// Calculate segment complexity
	dy := to.Y - from.Y
	if dy >= 0 {
		return false // Going down - basic is fine
	}

	height := -dy

	// Advanced is useful for tall vertical climbs
	if height > abilities.JumpHeight*2 {
		return true
	}

	return false
}

// OptimizePathWithAdvancedAbilities replaces basic segments with advanced when beneficial
func OptimizePathWithAdvancedAbilities(segments []PathSegment, abilities PlayerAbilities, bounds Rect) []PathSegment {
	if abilities.GetTier() < TierIntermediate {
		return segments // No advanced abilities
	}

	// Look for opportunities to use advanced abilities
	// This is a simple pass that doesn't change the overall path structure
	result := make([]PathSegment, 0, len(segments))

	for _, seg := range segments {
		// Don't replace non-movement segments
		if seg.Type != SegmentLadder {
			result = append(result, seg)
			continue
		}

		// Try to replace tall ladders with advanced movement
		length := seg.Length()
		if length < abilities.JumpHeight*2 {
			result = append(result, seg)
			continue
		}

		// Try wall jump replacement
		if abilities.CanWallJump {
			wallSegs := tryWallJumpPath(seg.End, seg.Start, abilities, bounds)
			if wallSegs != nil {
				result = append(result, wallSegs...)
				continue
			}
		}

		// Keep original
		result = append(result, seg)
	}

	return result
}
