package gen

// BuildConnectivityTree creates a minimum spanning tree connecting all nodes
// Uses Prim's algorithm with Manhattan distance + height penalty as edge weight
func BuildConnectivityTree(exits []NavNode, hubs []NavNode) []NavEdge {
	// Combine all nodes
	allNodes := make([]NavNode, 0, len(exits)+len(hubs))
	allNodes = append(allNodes, exits...)
	allNodes = append(allNodes, hubs...)

	if len(allNodes) <= 1 {
		return nil // Nothing to connect
	}

	// If we have hubs, connect exits to nearest hub, then connect hubs together
	if len(hubs) > 0 {
		return buildHubCentricTree(exits, hubs)
	}

	// No hubs - create MST between all exits
	return buildMST(allNodes)
}

// buildHubCentricTree creates a tree where exits connect to hubs,
// and hubs connect to each other
func buildHubCentricTree(exits []NavNode, hubs []NavNode) []NavEdge {
	edges := []NavEdge{}

	// Connect each exit to its nearest hub
	for _, exit := range exits {
		nearestHub := findNearestNode(exit, hubs)
		if nearestHub == nil {
			continue
		}

		edges = append(edges, NavEdge{
			FromID: exit.ID,
			ToID:   nearestHub.ID,
			Cost:   edgeCost(exit.Position, nearestHub.Position),
		})
	}

	// Connect hubs together using MST
	if len(hubs) > 1 {
		hubEdges := buildMST(hubs)
		edges = append(edges, hubEdges...)
	}

	return edges
}

// buildMST creates minimum spanning tree using Prim's algorithm
func buildMST(nodes []NavNode) []NavEdge {
	if len(nodes) <= 1 {
		return nil
	}

	edges := []NavEdge{}
	inTree := make(map[int]bool)

	// Start with first node
	inTree[nodes[0].ID] = true

	// Keep adding edges until all nodes are in tree
	for len(inTree) < len(nodes) {
		var bestEdge *NavEdge
		bestCost := -1

		// Find minimum cost edge from tree to non-tree node
		for _, fromNode := range nodes {
			if !inTree[fromNode.ID] {
				continue
			}

			for _, toNode := range nodes {
				if inTree[toNode.ID] {
					continue
				}

				cost := edgeCost(fromNode.Position, toNode.Position)
				if bestCost == -1 || cost < bestCost {
					bestCost = cost
					bestEdge = &NavEdge{
						FromID: fromNode.ID,
						ToID:   toNode.ID,
						Cost:   cost,
					}
				}
			}
		}

		if bestEdge != nil {
			edges = append(edges, *bestEdge)
			inTree[bestEdge.ToID] = true
		} else {
			break // No more edges (disconnected graph)
		}
	}

	return edges
}

// findNearestNode finds the node closest to the given node
func findNearestNode(from NavNode, candidates []NavNode) *NavNode {
	if len(candidates) == 0 {
		return nil
	}

	nearest := &candidates[0]
	nearestCost := edgeCost(from.Position, nearest.Position)

	for i := 1; i < len(candidates); i++ {
		cost := edgeCost(from.Position, candidates[i].Position)
		if cost < nearestCost {
			nearestCost = cost
			nearest = &candidates[i]
		}
	}

	return nearest
}

// edgeCost calculates the cost of connecting two positions
// Uses Manhattan distance with penalty for vertical movement
func edgeCost(from, to Point) int {
	dx := from.X - to.X
	dy := from.Y - to.Y
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}

	// Vertical movement is more expensive (requires ladders/jumps)
	verticalPenalty := dy / 2
	return dx + dy + verticalPenalty
}

// CreateNavigationGraph builds the complete navigation graph for a room
func CreateNavigationGraph(room *RoomInfo, rng Random, variety VarietyConfig) *NavigationGraph {
	// Create exit nodes
	exitNodes := CreateExitNodes(room)

	if len(exitNodes) == 0 {
		return &NavigationGraph{
			Nodes: nil,
			Edges: nil,
		}
	}

	// Place hubs
	hubNodes := PlaceHubs(exitNodes, room.Bounds, rng, variety)

	// Combine all nodes
	allNodes := make([]NavNode, 0, len(exitNodes)+len(hubNodes))
	allNodes = append(allNodes, exitNodes...)
	allNodes = append(allNodes, hubNodes...)

	// Build connectivity tree
	edges := BuildConnectivityTree(exitNodes, hubNodes)

	return &NavigationGraph{
		Nodes: allNodes,
		Edges: edges,
	}
}

// GetNodeByID finds a node by its ID
func (g *NavigationGraph) GetNodeByID(id int) *NavNode {
	for i := range g.Nodes {
		if g.Nodes[i].ID == id {
			return &g.Nodes[i]
		}
	}
	return nil
}

// GetExitNodes returns only exit nodes
func (g *NavigationGraph) GetExitNodes() []NavNode {
	exits := []NavNode{}
	for _, node := range g.Nodes {
		if node.Type == NodeExit {
			exits = append(exits, node)
		}
	}
	return exits
}

// GetHubNodes returns only hub nodes
func (g *NavigationGraph) GetHubNodes() []NavNode {
	hubs := []NavNode{}
	for _, node := range g.Nodes {
		if node.Type == NodeHub {
			hubs = append(hubs, node)
		}
	}
	return hubs
}
