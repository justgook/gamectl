package gen

// HubStrategy determines how hubs are placed
type HubStrategy int

const (
	// HubStrategyNone creates direct connections without hubs
	HubStrategyNone HubStrategy = iota
	// HubStrategyCenter places a single hub at room center
	HubStrategyCenter
	// HubStrategyWeighted places hub at weighted center of exits
	HubStrategyWeighted
	// HubStrategyYShaped places hub for 3 exits in Y configuration
	HubStrategyYShaped
	// HubStrategyMultiple places multiple hubs for many exits
	HubStrategyMultiple
)

// SelectHubStrategy chooses appropriate strategy based on exit configuration
func SelectHubStrategy(exits []NavNode, bounds Rect) HubStrategy {
	numExits := len(exits)

	switch {
	case numExits <= 1:
		return HubStrategyNone // Single exit needs no internal paths
	case numExits == 2:
		// For 2 exits, check if they're aligned
		if areExitsAligned(exits) {
			return HubStrategyNone // Direct path is fine
		}
		return HubStrategyWeighted // Need hub for L-shaped path
	case numExits == 3:
		return HubStrategyYShaped // Y-shaped hub works well
	default:
		return HubStrategyMultiple // Multiple hubs for complex rooms
	}
}

// areExitsAligned checks if exits are roughly on same horizontal or vertical line
func areExitsAligned(exits []NavNode) bool {
	if len(exits) < 2 {
		return true
	}

	dx := exits[0].Position.X - exits[1].Position.X
	dy := exits[0].Position.Y - exits[1].Position.Y
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}

	// Aligned if one dimension is small relative to the other
	threshold := 2
	return dx <= threshold || dy <= threshold
}

// PlaceHubs creates hub nodes based on selected strategy
func PlaceHubs(exits []NavNode, bounds Rect, rng Random, variety VarietyConfig) []NavNode {
	strategy := SelectHubStrategy(exits, bounds)
	return placeHubsWithStrategy(exits, bounds, rng, variety, strategy)
}

// placeHubsWithStrategy creates hubs using specified strategy
func placeHubsWithStrategy(exits []NavNode, bounds Rect, rng Random, variety VarietyConfig, strategy HubStrategy) []NavNode {
	switch strategy {
	case HubStrategyNone:
		return nil
	case HubStrategyCenter:
		return placeCenterHub(exits, bounds, rng, variety)
	case HubStrategyWeighted:
		return placeWeightedHub(exits, bounds, rng, variety)
	case HubStrategyYShaped:
		return placeYShapedHub(exits, bounds, rng, variety)
	case HubStrategyMultiple:
		return placeMultipleHubs(exits, bounds, rng, variety)
	default:
		return nil
	}
}

// placeCenterHub places a single hub at room center with optional offset
func placeCenterHub(exits []NavNode, bounds Rect, rng Random, variety VarietyConfig) []NavNode {
	center := bounds.Center()

	// Apply random offset based on variety
	if variety.HubOffsetRange > 0 && rng != nil {
		offset := variety.HubOffsetRange
		center.X += rng.Intn(offset*2+1) - offset
		center.Y += rng.Intn(offset*2+1) - offset
	}

	// Clamp to room bounds with margin
	margin := 1
	center = clampToRect(center, bounds, margin)

	return []NavNode{{
		ID:       len(exits), // IDs continue after exits
		Position: center,
		Type:     NodeHub,
	}}
}

// placeWeightedHub places hub at weighted center of exit positions
func placeWeightedHub(exits []NavNode, bounds Rect, rng Random, variety VarietyConfig) []NavNode {
	if len(exits) == 0 {
		return placeCenterHub(exits, bounds, rng, variety)
	}

	// Calculate weighted center
	sumX, sumY := 0, 0
	for _, exit := range exits {
		sumX += exit.Position.X
		sumY += exit.Position.Y
	}
	center := Point{
		X: sumX / len(exits),
		Y: sumY / len(exits),
	}

	// Apply random offset
	if variety.HubOffsetRange > 0 && rng != nil {
		offset := variety.HubOffsetRange
		center.X += rng.Intn(offset*2+1) - offset
		center.Y += rng.Intn(offset*2+1) - offset
	}

	// Clamp to bounds
	margin := 1
	center = clampToRect(center, bounds, margin)

	return []NavNode{{
		ID:       len(exits),
		Position: center,
		Type:     NodeHub,
	}}
}

// placeYShapedHub places hub optimized for 3-exit Y configuration
func placeYShapedHub(exits []NavNode, bounds Rect, rng Random, variety VarietyConfig) []NavNode {
	if len(exits) != 3 {
		return placeWeightedHub(exits, bounds, rng, variety)
	}

	// Find the exit closest to center - hub goes between it and center
	center := bounds.Center()
	closestIdx := 0
	closestDist := exits[0].Position.ManhattanDistance(center)

	for i := 1; i < len(exits); i++ {
		dist := exits[i].Position.ManhattanDistance(center)
		if dist < closestDist {
			closestDist = dist
			closestIdx = i
		}
	}

	// Place hub between center and closest exit
	hubPos := Point{
		X: (center.X + exits[closestIdx].Position.X) / 2,
		Y: (center.Y + exits[closestIdx].Position.Y) / 2,
	}

	// Apply variety offset
	if variety.HubOffsetRange > 0 && rng != nil {
		offset := variety.HubOffsetRange
		hubPos.X += rng.Intn(offset*2+1) - offset
		hubPos.Y += rng.Intn(offset*2+1) - offset
	}

	margin := 1
	hubPos = clampToRect(hubPos, bounds, margin)

	return []NavNode{{
		ID:       len(exits),
		Position: hubPos,
		Type:     NodeHub,
	}}
}

// placeMultipleHubs places multiple hubs for rooms with many exits
func placeMultipleHubs(exits []NavNode, bounds Rect, rng Random, variety VarietyConfig) []NavNode {
	if len(exits) <= 4 {
		return placeWeightedHub(exits, bounds, rng, variety)
	}

	hubs := []NavNode{}
	nextID := len(exits)

	// Group exits by quadrant
	center := bounds.Center()
	quadrants := make([][]NavNode, 4) // NW, NE, SW, SE

	for _, exit := range exits {
		qIdx := 0
		if exit.Position.X >= center.X {
			qIdx |= 1 // East
		}
		if exit.Position.Y >= center.Y {
			qIdx |= 2 // South
		}
		quadrants[qIdx] = append(quadrants[qIdx], exit)
	}

	// Create hub for each non-empty quadrant with 2+ exits
	for qIdx, qExits := range quadrants {
		if len(qExits) < 2 {
			continue
		}

		// Calculate quadrant center
		sumX, sumY := 0, 0
		for _, e := range qExits {
			sumX += e.Position.X
			sumY += e.Position.Y
		}
		qCenter := Point{
			X: sumX / len(qExits),
			Y: sumY / len(qExits),
		}

		// Apply variety
		if variety.HubOffsetRange > 0 && rng != nil {
			offset := variety.HubOffsetRange
			qCenter.X += rng.Intn(offset*2+1) - offset
			qCenter.Y += rng.Intn(offset*2+1) - offset
		}

		qCenter = clampToRect(qCenter, bounds, 1)

		hubs = append(hubs, NavNode{
			ID:       nextID,
			Position: qCenter,
			Type:     NodeHub,
		})
		nextID++

		_ = qIdx // Suppress unused warning
	}

	// If we have multiple hubs, add a central hub to connect them
	if len(hubs) >= 2 {
		centralHub := NavNode{
			ID:       nextID,
			Position: center,
			Type:     NodeHub,
		}
		if variety.HubOffsetRange > 0 && rng != nil {
			offset := variety.HubOffsetRange / 2 // Less offset for central hub
			centralHub.Position.X += rng.Intn(offset*2+1) - offset
			centralHub.Position.Y += rng.Intn(offset*2+1) - offset
		}
		centralHub.Position = clampToRect(centralHub.Position, bounds, 1)
		hubs = append(hubs, centralHub)
	}

	return hubs
}

// clampToRect clamps a point to be within bounds with given margin
func clampToRect(p Point, bounds Rect, margin int) Point {
	result := p

	minX := bounds.X + margin
	maxX := bounds.X + bounds.Width - 1 - margin
	minY := bounds.Y + margin
	maxY := bounds.Y + bounds.Height - 1 - margin

	if result.X < minX {
		result.X = minX
	}
	if result.X > maxX {
		result.X = maxX
	}
	if result.Y < minY {
		result.Y = minY
	}
	if result.Y > maxY {
		result.Y = maxY
	}

	return result
}
