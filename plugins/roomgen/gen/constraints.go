package gen

// constraints.go - Movement constraint validation for guaranteed reachability
//
// This file provides validation functions that ensure paths are reachable
// by construction, eliminating the need for post-validation flood fill.

// MinPlatformSpacing is the minimum vertical distance between parallel platforms
const MinPlatformSpacing = 2

// MinLadderLength is the minimum ladder segment length
const MinLadderLength = 1

// CanJumpHorizontal checks if a horizontal gap is jumpable
func CanJumpHorizontal(gap int, abilities PlayerAbilities) bool {
	if gap < 0 {
		gap = -gap
	}
	return gap <= abilities.JumpDistance
}

// CanJumpVertical checks if a vertical height is jumpable (going up)
func CanJumpVertical(height int, abilities PlayerAbilities) bool {
	if height < 0 {
		height = -height
	}
	return height <= abilities.EffectiveJumpHeight()
}

// CanClimbVertical checks if vertical distance can be traversed with ladders
func CanClimbVertical(height int, abilities PlayerAbilities) bool {
	if !abilities.CanUseLadders {
		return false
	}
	// Ladders can traverse any vertical distance
	return true
}

// CanDropVertical checks if a drop is survivable (always true in most platformers)
func CanDropVertical(height int, abilities PlayerAbilities) bool {
	// Drops are generally always possible in platformers
	// Could add max fall damage height here if needed
	return true
}

// CanTraverseVertical checks if vertical movement is possible with any ability
func CanTraverseVertical(from, to Point, abilities PlayerAbilities) bool {
	dy := to.Y - from.Y
	goingUp := dy < 0

	height := dy
	if height < 0 {
		height = -height
	}

	if goingUp {
		// Going up requires jump, ladder, wall jump, or grapple
		if CanJumpVertical(height, abilities) {
			return true
		}
		if CanClimbVertical(height, abilities) {
			return true
		}
		if abilities.CanWallJump && height <= abilities.WallJumpHeight*4 {
			return true
		}
		if abilities.CanGrapple && height <= abilities.GrappleRange {
			return true
		}
		return false
	}

	// Going down - drops or ladder
	if abilities.CanDropThrough || abilities.CanUseLadders {
		return true
	}
	// Can always fall (with possible staircase)
	return true
}

// CanConnectDirect checks if two points can be connected with a simple path
func CanConnectDirect(from, to Point, abilities PlayerAbilities, bounds Rect) bool {
	// Check bounds
	if !bounds.Contains(from) || !bounds.Contains(to) {
		return false
	}

	dx := to.X - from.X
	dy := to.Y - from.Y

	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}

	// Pure horizontal - need walkable or jumpable
	if dy == 0 {
		return true // Can always walk or build platform
	}

	// Pure vertical - need climbable or jumpable
	if dx == 0 {
		return CanTraverseVertical(from, to, abilities)
	}

	// Combined movement - L-shaped path
	// Check if we can do horizontal then vertical, or vertical then horizontal
	intermediate1 := Point{to.X, from.Y} // Horizontal first
	intermediate2 := Point{from.X, to.Y} // Vertical first

	// Path 1: horizontal then vertical
	if bounds.Contains(intermediate1) && CanTraverseVertical(intermediate1, to, abilities) {
		return true
	}

	// Path 2: vertical then horizontal
	if bounds.Contains(intermediate2) && CanTraverseVertical(from, intermediate2, abilities) {
		return true
	}

	return false
}

// CanConnectDirectInShape checks if two points can be connected within a room shape
func CanConnectDirectInShape(from, to Point, abilities PlayerAbilities, shape *RoomShape) bool {
	if shape == nil {
		return false
	}

	// Check both points are in shape
	if !shape.Contains(from) || !shape.Contains(to) {
		return false
	}

	dx := to.X - from.X
	dy := to.Y - from.Y

	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}

	// Pure horizontal - need walkable or jumpable
	if dy == 0 {
		return true
	}

	// Pure vertical - need climbable or jumpable
	if dx == 0 {
		return CanTraverseVertical(from, to, abilities)
	}

	// Combined movement - L-shaped path
	intermediate1 := Point{to.X, from.Y} // Horizontal first
	intermediate2 := Point{from.X, to.Y} // Vertical first

	// Path 1: horizontal then vertical
	if shape.Contains(intermediate1) && CanTraverseVertical(intermediate1, to, abilities) {
		return true
	}

	// Path 2: vertical then horizontal
	if shape.Contains(intermediate2) && CanTraverseVertical(from, intermediate2, abilities) {
		return true
	}

	return false
}

// CanConnectWithHub checks if two points can be connected via a hub
func CanConnectWithHub(from, hub, to Point, abilities PlayerAbilities, bounds Rect) bool {
	return CanConnectDirect(from, hub, abilities, bounds) &&
		CanConnectDirect(hub, to, abilities, bounds)
}

// ValidateEdgeReachability checks if an edge in the navigation graph is reachable
func ValidateEdgeReachability(from, to Point, abilities PlayerAbilities, bounds Rect) bool {
	return CanConnectDirect(from, to, abilities, bounds)
}

// RequiresLadder checks if a path segment requires a ladder
func RequiresLadder(from, to Point, abilities PlayerAbilities) bool {
	dy := to.Y - from.Y
	goingUp := dy < 0

	height := dy
	if height < 0 {
		height = -height
	}

	if !goingUp {
		return false // Going down doesn't require ladder
	}

	// Requires ladder if jump can't reach
	return height > abilities.EffectiveJumpHeight()
}

// RequiresAdvancedAbility checks if a path requires intermediate/advanced abilities
func RequiresAdvancedAbility(from, to Point, abilities PlayerAbilities) bool {
	dy := to.Y - from.Y
	goingUp := dy < 0

	height := dy
	if height < 0 {
		height = -height
	}

	if !goingUp {
		return false
	}

	// Basic tier can handle jumps and ladders
	if height <= abilities.JumpHeight {
		return false
	}
	if abilities.CanUseLadders {
		return false
	}

	// Needs wall jump, double jump, or grapple
	return true
}

// CalculatePathComplexity estimates the complexity of a path between two points
// Higher values indicate more complex paths
func CalculatePathComplexity(from, to Point, abilities PlayerAbilities) int {
	dx := to.X - from.X
	dy := to.Y - from.Y

	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}

	complexity := dx + dy // Base: Manhattan distance

	// Vertical movement is more complex
	if dy > 0 {
		if dy > abilities.JumpHeight {
			complexity += dy // Extra cost for ladders
		}
	}

	// Advanced abilities add complexity
	if RequiresAdvancedAbility(from, to, abilities) {
		complexity += 10
	}

	return complexity
}

// SuggestIntermediatePoint suggests a good intermediate point for L-shaped path
// Returns the intermediate point that stays furthest from bounds edges
func SuggestIntermediatePoint(from, to Point, bounds Rect, preferHorizontalFirst bool) Point {
	if preferHorizontalFirst {
		return Point{to.X, from.Y}
	}
	return Point{from.X, to.Y}
}

// ClampToBounds clamps a point to be within bounds with given margin
func ClampToBounds(p Point, bounds Rect, margin int) Point {
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

// EnforceMinSpacing adjusts a Y coordinate to maintain minimum spacing from existing platforms
func EnforceMinSpacing(y int, existingPlatformYs []int, minSpacing int) int {
	for _, existingY := range existingPlatformYs {
		diff := y - existingY
		if diff < 0 {
			diff = -diff
		}
		if diff < minSpacing && diff > 0 {
			// Too close - move away
			if y > existingY {
				return existingY + minSpacing
			}
			return existingY - minSpacing
		}
	}
	return y
}
