package gen

// AddVariety introduces bends, zig-zags, and spacing to segments
func AddVariety(segments []PathSegment, rng Random, config VarietyConfig, bounds Rect) []PathSegment {
	if config.Level == VarietyNone || rng == nil {
		return segments
	}

	result := []PathSegment{}

	for _, seg := range segments {
		varied := applyVarietyToSegment(seg, rng, config, bounds)
		result = append(result, varied...)
	}

	return result
}

// applyVarietyToSegment applies variety transformations to a single segment
func applyVarietyToSegment(seg PathSegment, rng Random, config VarietyConfig, bounds Rect) []PathSegment {
	switch seg.Type {
	case SegmentPlatform:
		return varyPlatform(seg, rng, config, bounds)
	case SegmentLadder:
		return varyLadder(seg, rng, config, bounds)
	case SegmentOnewayPlatform:
		return varyOnewayPlatform(seg, rng, config, bounds)
	default:
		return []PathSegment{seg}
	}
}

// varyPlatform adds variety to platform segments
func varyPlatform(seg PathSegment, rng Random, config VarietyConfig, bounds Rect) []PathSegment {
	length := seg.Length()

	// Short platforms don't need variety
	if length <= 3 {
		return []PathSegment{seg}
	}

	// Maybe convert to staircase
	if rng.Float64() < config.StaircaseProb {
		return createVariedStaircase(seg, rng, config, bounds)
	}

	// Maybe add small vertical offset
	if config.Level >= VarietyMedium && rng.Float64() < 0.3 {
		return addPlatformJog(seg, rng, config, bounds)
	}

	return []PathSegment{seg}
}

// createVariedStaircase breaks a long platform into ascending/descending steps
func createVariedStaircase(seg PathSegment, rng Random, config VarietyConfig, bounds Rect) []PathSegment {
	steps := []PathSegment{}

	// Determine direction (ascending or descending)
	direction := 1
	if rng.Float64() < 0.5 {
		direction = -1
	}

	// Calculate step parameters
	length := seg.Length()
	stepWidth := 2 + rng.Intn(2) // 2-3 tiles per step
	numSteps := length / stepWidth
	if numSteps < 2 {
		return []PathSegment{seg}
	}

	startX := seg.Start.X
	endX := seg.End.X
	xDir := 1
	if endX < startX {
		xDir = -1
	}

	currentX := startX
	currentY := seg.Start.Y

	for i := 0; i < numSteps; i++ {
		nextX := currentX + stepWidth*xDir

		// Ensure we don't overshoot
		if (xDir > 0 && nextX > endX) || (xDir < 0 && nextX < endX) {
			nextX = endX
		}

		// Check bounds for Y variation
		newY := currentY + direction
		if !bounds.Contains(Point{currentX, newY}) {
			direction = -direction
			newY = currentY + direction
		}

		steps = append(steps, PathSegment{
			Type:  SegmentPlatform,
			Start: Point{currentX, currentY},
			End:   Point{nextX, currentY},
		})

		// Step up/down for next platform (except last)
		if i < numSteps-1 {
			currentX = nextX
			currentY = newY
		}
	}

	return steps
}

// addPlatformJog adds a small vertical offset mid-platform
func addPlatformJog(seg PathSegment, rng Random, config VarietyConfig, bounds Rect) []PathSegment {
	length := seg.Length()
	if length < 4 {
		return []PathSegment{seg}
	}

	// Split at random point
	splitPoint := length/3 + rng.Intn(length/3)

	startX := seg.Start.X
	xDir := 1
	if seg.End.X < startX {
		xDir = -1
	}

	midX := startX + splitPoint*xDir
	jogDir := 1
	if rng.Float64() < 0.5 {
		jogDir = -1
	}
	jogY := seg.Start.Y + jogDir

	// Check bounds
	if !bounds.Contains(Point{midX, jogY}) {
		return []PathSegment{seg}
	}

	return []PathSegment{
		{
			Type:  SegmentPlatform,
			Start: seg.Start,
			End:   Point{midX, seg.Start.Y},
		},
		{
			Type:  SegmentPlatform,
			Start: Point{midX, jogY},
			End:   Point{seg.End.X, jogY},
		},
	}
}

// varyLadder adds variety to ladder segments
func varyLadder(seg PathSegment, rng Random, config VarietyConfig, bounds Rect) []PathSegment {
	length := seg.Length()

	// Short ladders don't need variety
	if length <= 2 {
		return []PathSegment{seg}
	}

	// Maybe add horizontal jog
	if rng.Float64() < config.LadderJogProb {
		return addLadderJog(seg, rng, config, bounds)
	}

	return []PathSegment{seg}
}

// addLadderJog adds a horizontal offset mid-ladder
func addLadderJog(seg PathSegment, rng Random, config VarietyConfig, bounds Rect) []PathSegment {
	length := seg.Length()
	if length < 3 {
		return []PathSegment{seg}
	}

	// Split at random point
	splitY := seg.Start.Y
	yDir := 1
	if seg.End.Y < seg.Start.Y {
		yDir = -1
	}

	splitOffset := length/3 + rng.Intn(length/3)
	midY := splitY + splitOffset*yDir

	// Jog direction
	jogDir := 1
	if rng.Float64() < 0.5 {
		jogDir = -1
	}
	jogX := seg.Start.X + jogDir*2

	// Check bounds
	if !bounds.Contains(Point{jogX, midY}) {
		return []PathSegment{seg}
	}

	return []PathSegment{
		// First part of ladder
		{
			Type:  SegmentLadder,
			Start: seg.Start,
			End:   Point{seg.Start.X, midY},
		},
		// Horizontal platform at jog
		{
			Type:  SegmentPlatform,
			Start: Point{seg.Start.X, midY},
			End:   Point{jogX, midY},
		},
		// Second part of ladder
		{
			Type:  SegmentLadder,
			Start: Point{jogX, midY},
			End:   Point{jogX, seg.End.Y},
		},
		// Platform at end to connect back
		{
			Type:  SegmentPlatform,
			Start: Point{jogX, seg.End.Y},
			End:   seg.End,
		},
	}
}

// varyOnewayPlatform adds variety to one-way platforms
func varyOnewayPlatform(seg PathSegment, rng Random, config VarietyConfig, bounds Rect) []PathSegment {
	// One-way platforms usually shouldn't vary much for gameplay clarity
	// But we can slightly offset position
	if config.Level >= VarietyHigh && rng.Float64() < 0.2 {
		offset := rng.Intn(2) - 1 // -1, 0, or 1
		if offset != 0 {
			newY := seg.Start.Y + offset
			if bounds.Contains(Point{seg.Start.X, newY}) {
				return []PathSegment{{
					Type:  SegmentOnewayPlatform,
					Start: Point{seg.Start.X, newY},
					End:   Point{seg.End.X, newY},
				}}
			}
		}
	}

	return []PathSegment{seg}
}
