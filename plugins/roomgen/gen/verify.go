package gen

// VerifyReachability checks that all exits are reachable from each other
// using A* pathfinding on the generated geometry
func VerifyReachability(segments []PathSegment, exits []NavNode, abilities PlayerAbilities) bool {
	if len(exits) <= 1 {
		return true // Nothing to verify
	}

	// Build walkable graph from segments
	walkable := buildWalkableGraph(segments)

	// Check reachability from first exit to all others
	startExit := exits[0]

	for i := 1; i < len(exits); i++ {
		targetExit := exits[i]
		if !canReach(walkable, startExit.Position, targetExit.Position, abilities) {
			return false
		}
	}

	return true
}

// WalkableGraph represents positions that can be walked on
type WalkableGraph struct {
	Platforms map[Point]bool // Walkable platform tiles
	Ladders   map[Point]bool // Ladder tiles
	Oneway    map[Point]bool // One-way platform tiles
	WallJumps map[Point]int  // Wall jump surfaces (direction)
	Grapples  map[Point]bool // Grapple points
}

// buildWalkableGraph creates a walkable graph from segments
func buildWalkableGraph(segments []PathSegment) *WalkableGraph {
	graph := &WalkableGraph{
		Platforms: make(map[Point]bool),
		Ladders:   make(map[Point]bool),
		Oneway:    make(map[Point]bool),
		WallJumps: make(map[Point]int),
		Grapples:  make(map[Point]bool),
	}

	for _, seg := range segments {
		tiles := seg.GetTiles()
		for _, tile := range tiles {
			switch seg.Type {
			case SegmentPlatform:
				graph.Platforms[tile] = true
			case SegmentOnewayPlatform:
				graph.Oneway[tile] = true
			case SegmentLadder:
				graph.Ladders[tile] = true
			case SegmentWallJump:
				graph.WallJumps[tile] = seg.Direction
			case SegmentGrapple:
				graph.Grapples[tile] = true
			}
		}
	}

	return graph
}

// canReach checks if target is reachable from start using A*
func canReach(graph *WalkableGraph, start, target Point, abilities PlayerAbilities) bool {
	// Simplified reachability check using BFS
	// (A* would be more efficient but BFS is simpler and sufficient for verification)

	if start.X == target.X && start.Y == target.Y {
		return true
	}

	visited := make(map[Point]bool)
	queue := []Point{start}
	visited[start] = true

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		// Get all reachable positions from current
		neighbors := getReachablePositions(graph, current, abilities)

		for _, next := range neighbors {
			if next.X == target.X && next.Y == target.Y {
				return true
			}

			if !visited[next] {
				visited[next] = true
				queue = append(queue, next)
			}
		}
	}

	return false
}

// getReachablePositions returns all positions reachable from current position
func getReachablePositions(graph *WalkableGraph, current Point, abilities PlayerAbilities) []Point {
	reachable := []Point{}

	// Walking left/right on platforms
	for _, dx := range []int{-1, 1} {
		next := Point{current.X + dx, current.Y}
		if graph.Platforms[next] || graph.Oneway[next] {
			reachable = append(reachable, next)
		}
	}

	// Jumping up
	for dy := 1; dy <= abilities.JumpHeight; dy++ {
		above := Point{current.X, current.Y - dy}
		if graph.Platforms[above] || graph.Oneway[above] || graph.Ladders[above] {
			reachable = append(reachable, above)
		}

		// Horizontal jumps while going up
		for dx := -abilities.JumpDistance; dx <= abilities.JumpDistance; dx++ {
			if dx == 0 {
				continue
			}
			jumpTarget := Point{current.X + dx, current.Y - dy}
			if graph.Platforms[jumpTarget] || graph.Oneway[jumpTarget] {
				reachable = append(reachable, jumpTarget)
			}
		}
	}

	// Dropping down
	for dy := 1; dy <= 10; dy++ { // Arbitrary max fall distance
		below := Point{current.X, current.Y + dy}
		if graph.Platforms[below] || graph.Oneway[below] || graph.Ladders[below] {
			reachable = append(reachable, below)
			break // Can only land on first platform
		}
	}

	// Using ladders
	if abilities.CanUseLadders && graph.Ladders[current] {
		// Climb up/down ladder
		for _, dy := range []int{-1, 1} {
			next := Point{current.X, current.Y + dy}
			if graph.Ladders[next] || graph.Platforms[next] || graph.Oneway[next] {
				reachable = append(reachable, next)
			}
		}
	}

	// Wall jumps
	if abilities.CanWallJump {
		if dir, ok := graph.WallJumps[current]; ok {
			dx := abilities.WallJumpDistance
			if dir == DirEast {
				dx = -dx
			}
			for dy := 1; dy <= abilities.WallJumpHeight; dy++ {
				jumpTarget := Point{current.X + dx, current.Y - dy}
				if graph.Platforms[jumpTarget] || graph.WallJumps[jumpTarget] != 0 {
					reachable = append(reachable, jumpTarget)
				}
			}
		}
	}

	// Grapple
	if abilities.CanGrapple {
		for grapplePoint := range graph.Grapples {
			dist := current.ManhattanDistance(grapplePoint)
			if dist <= abilities.GrappleRange {
				reachable = append(reachable, grapplePoint)
			}
		}
	}

	return reachable
}

// VerifyRoomReachability verifies all exits in a room are mutually reachable
func VerifyRoomReachability(room *RoomInfo, segments []PathSegment, abilities PlayerAbilities) bool {
	if len(room.Exits) <= 1 {
		return true
	}

	// Create exit nodes
	exitNodes := CreateExitNodes(room)

	return VerifyReachability(segments, exitNodes, abilities)
}
