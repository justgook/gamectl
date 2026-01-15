package gen

// decoration.go - Simplified variety system for visual interest
//
// This file provides simple visual variety transformations that do NOT
// break reachability guarantees. All transformations are limited to
// small offsets (±1-2 tiles) that maintain traversability.
//
// REMOVED from old variety.go:
// - Staircase generation (too complex, can break reachability)
// - Multi-segment jogs (replaced with simple 1-tile offsets)
//
// KEPT/SIMPLIFIED:
// - Small platform Y-offsets (±1 tile, visually interesting but still walkable)
// - Hub position randomization (already in hubs.go)

// DecorationConfig controls simple visual variety
type DecorationConfig struct {
	Enabled        bool    // Whether to apply any decoration
	PlatformJitter int     // Max Y offset for platforms (0-2)
	LadderJitter   int     // Max X offset for ladders (0-1)
	JitterProb     float64 // Probability of applying jitter to each segment
}

// DefaultDecorationConfig returns a safe default configuration
func DefaultDecorationConfig() DecorationConfig {
	return DecorationConfig{
		Enabled:        true,
		PlatformJitter: 1,
		LadderJitter:   1,
		JitterProb:     0.3,
	}
}

// DecorationConfigFromVariety converts old VarietyConfig to DecorationConfig
func DecorationConfigFromVariety(v VarietyConfig) DecorationConfig {
	switch v.Level {
	case VarietyNone:
		return DecorationConfig{Enabled: false}
	case VarietyLow:
		return DecorationConfig{
			Enabled:        true,
			PlatformJitter: 1,
			LadderJitter:   0,
			JitterProb:     0.2,
		}
	case VarietyMedium:
		return DecorationConfig{
			Enabled:        true,
			PlatformJitter: 1,
			LadderJitter:   1,
			JitterProb:     0.3,
		}
	case VarietyHigh:
		return DecorationConfig{
			Enabled:        true,
			PlatformJitter: 2,
			LadderJitter:   1,
			JitterProb:     0.4,
		}
	default:
		return DefaultDecorationConfig()
	}
}

// ApplyDecoration adds simple visual variety to segments
func ApplyDecoration(segments []PathSegment, rng Random, config DecorationConfig, bounds Rect) []PathSegment {
	if !config.Enabled || rng == nil {
		return segments
	}

	result := make([]PathSegment, 0, len(segments))

	for _, seg := range segments {
		decorated := applySegmentDecoration(seg, rng, config, bounds)
		result = append(result, decorated)
	}

	return result
}

// applySegmentDecoration applies decoration to a single segment
func applySegmentDecoration(seg PathSegment, rng Random, config DecorationConfig, bounds Rect) PathSegment {
	// Only decorate platforms and ladders
	switch seg.Type {
	case SegmentPlatform:
		return decoratePlatform(seg, rng, config, bounds)
	case SegmentLadder:
		return decorateLadder(seg, rng, config, bounds)
	default:
		return seg
	}
}

// decoratePlatform applies small Y-offset to platform
func decoratePlatform(seg PathSegment, rng Random, config DecorationConfig, bounds Rect) PathSegment {
	if config.PlatformJitter == 0 || rng.Float64() > config.JitterProb {
		return seg
	}

	// Calculate offset
	offset := rng.Intn(config.PlatformJitter*2+1) - config.PlatformJitter

	if offset == 0 {
		return seg
	}

	// Check if new Y is valid
	newStartY := seg.Start.Y + offset
	newEndY := seg.End.Y + offset

	// Verify within bounds
	if newStartY < bounds.Y+1 || newStartY >= bounds.Y+bounds.Height-1 {
		return seg
	}
	if newEndY < bounds.Y+1 || newEndY >= bounds.Y+bounds.Height-1 {
		return seg
	}

	return PathSegment{
		Type:      seg.Type,
		Start:     Point{seg.Start.X, newStartY},
		End:       Point{seg.End.X, newEndY},
		Tiles:     nil, // Will be regenerated
		Direction: seg.Direction,
	}
}

// decorateLadder applies small X-offset to ladder
func decorateLadder(seg PathSegment, rng Random, config DecorationConfig, bounds Rect) PathSegment {
	if config.LadderJitter == 0 || rng.Float64() > config.JitterProb {
		return seg
	}

	// Calculate offset
	offset := rng.Intn(config.LadderJitter*2+1) - config.LadderJitter

	if offset == 0 {
		return seg
	}

	// Check if new X is valid
	newStartX := seg.Start.X + offset
	newEndX := seg.End.X + offset

	// Verify within bounds
	if newStartX < bounds.X+1 || newStartX >= bounds.X+bounds.Width-1 {
		return seg
	}
	if newEndX < bounds.X+1 || newEndX >= bounds.X+bounds.Width-1 {
		return seg
	}

	return PathSegment{
		Type:      seg.Type,
		Start:     Point{newStartX, seg.Start.Y},
		End:       Point{newEndX, seg.End.Y},
		Tiles:     nil, // Will be regenerated
		Direction: seg.Direction,
	}
}

// AddAnchorVariety creates variety by using non-straight paths
// Returns original segments if anchor-based path fails
func AddAnchorVariety(from, to Point, abilities PlayerAbilities, bounds Rect, rng Random) []PathSegment {
	// Only add anchor variety for longer paths
	dist := from.ManhattanDistance(to)
	if dist < 6 {
		return nil // Too short for anchor
	}

	// 50% chance to add anchor variety
	if rng.Float64() < 0.5 {
		return nil
	}

	// Calculate perpendicular offset (±2 tiles)
	offset := rng.Intn(5) - 2
	if offset == 0 {
		offset = 1
	}

	anchor := CreateAnchorNode(from, to, bounds, offset)

	// Verify anchor is valid
	if !bounds.Contains(anchor) {
		return nil
	}

	// Generate path via anchor
	return GenerateSegmentsWithAnchor(from, to, anchor, abilities, bounds)
}

// EnforceParallelSpacing ensures minimum vertical spacing between platforms
func EnforceParallelSpacing(segments []PathSegment, minSpacing int) []PathSegment {
	if len(segments) <= 1 || minSpacing <= 0 {
		return segments
	}

	// Collect platform Y coordinates
	platformYs := make(map[int][]int) // Y -> indices
	for i, seg := range segments {
		if seg.Type == SegmentPlatform || seg.Type == SegmentOnewayPlatform {
			y := seg.Start.Y
			platformYs[y] = append(platformYs[y], i)
		}
	}

	// Adjust platforms that are too close
	result := make([]PathSegment, len(segments))
	copy(result, segments)

	sortedYs := make([]int, 0, len(platformYs))
	for y := range platformYs {
		sortedYs = append(sortedYs, y)
	}

	// Simple bubble sort for small lists
	for i := 0; i < len(sortedYs)-1; i++ {
		for j := 0; j < len(sortedYs)-i-1; j++ {
			if sortedYs[j] > sortedYs[j+1] {
				sortedYs[j], sortedYs[j+1] = sortedYs[j+1], sortedYs[j]
			}
		}
	}

	for i := 1; i < len(sortedYs); i++ {
		prevY := sortedYs[i-1]
		currY := sortedYs[i]

		if currY-prevY < minSpacing {
			// Move current platform down
			newY := prevY + minSpacing
			for _, idx := range platformYs[currY] {
				seg := &result[idx]
				seg.Start.Y = newY
				seg.End.Y = newY
				seg.Tiles = nil // Regenerate
			}
			sortedYs[i] = newY
		}
	}

	return result
}
