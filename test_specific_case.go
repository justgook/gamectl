package main

import (
	"encoding/json"
	"fmt"
	"math/rand"

	"github.com/justgook/gamectl/pkg/minimap"
	"github.com/justgook/gamectl/pkg/tree3"
)

// Test random implementation
type TestRandom struct {
	*rand.Rand
}

func (r *TestRandom) Intn(n int) int {
	return r.Rand.Intn(n)
}

func (r *TestRandom) Float64() float64 {
	return r.Rand.Float64()
}

func getTestRoomShape(node *tree3.Node) minimap.RoomShape {
	return minimap.RoomShape{{0, 0}} // Simple single tile
}

// Copy configuration from the plugin
type GenerateMinimapConfig struct {
	MaxExtensionDepth       int  `json:"maxExtensionDepth"`
	RandomSeed              int  `json:"randomSeed"`
	PreferCompactExtensions bool `json:"preferCompactExtensions"`
	MaxDoorsPerRoom         int  `json:"maxDoorsPerRoom"`
}

// Simulate the plugin's GenerateMinimap function
func simulateGenerateMinimap(tree tree3.Tree) (*minimap.TileMap, int, error) {
	// Use the basic minimap generator (like the simplified algorithm)
	generator := minimap.NewMinimapGenerator()

	// Find root and place it
	var rootIdx int
	for i, node := range tree {
		if node.ParentId == -1 {
			rootIdx = i
			break
		}
	}

	rootID := fmt.Sprintf("node_%d", rootIdx)
	_, err := generator.PlaceRoom(rootID, minimap.RoomShape{{0, 0}}, minimap.Coordinate{0, 0})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to place root: %w", err)
	}

	// Build children map
	childrenMap := make(map[int][]int)
	for childIdx, node := range tree {
		if node.ParentId >= 0 && node.ParentId < len(tree) {
			parentIdx := node.ParentId
			childrenMap[parentIdx] = append(childrenMap[parentIdx], childIdx)
		}
	}

	// BFS placement
	visited := make(map[int]bool)
	visited[rootIdx] = true
	queue := []int{rootIdx}
	placedCount := 1

	for len(queue) > 0 {
		currentIdx := queue[0]
		queue = queue[1:]
		currentID := fmt.Sprintf("node_%d", currentIdx)

		children := childrenMap[currentIdx]
		if len(children) == 0 {
			continue
		}

		currentTiles, _ := generator.GetRoomTiles(currentID)
		doorPositions := generator.GetUnblockedNeighbors(currentTiles)

		// Check if we need to expand the room
		remainingChildren := 0
		for _, childIdx := range children {
			if !visited[childIdx] {
				remainingChildren++
			}
		}

		// If not enough door positions, expand the room
		if len(doorPositions) < remainingChildren {
			neededDoors := remainingChildren - len(doorPositions)
			fmt.Printf("  Node %d needs %d more doors (has %d, needs %d total)\n",
				currentIdx, neededDoors, len(doorPositions), remainingChildren)

			// Try multiple expansion attempts
			for attempt := 0; attempt < 3 && len(doorPositions) < remainingChildren; attempt++ {
				success := generator.ExpandRoomForDoors(currentID, neededDoors, make(map[string]int))
				if success {
					currentTiles, _ = generator.GetRoomTiles(currentID)
					doorPositions = generator.GetUnblockedNeighbors(currentTiles)
					fmt.Printf("  ✅ Expansion attempt %d: now has %d door positions\n", attempt+1, len(doorPositions))

					if len(doorPositions) < remainingChildren {
						neededDoors = remainingChildren - len(doorPositions)
						fmt.Printf("  Still need %d more doors, trying again...\n", neededDoors)
					}
				} else {
					fmt.Printf("  ❌ Expansion attempt %d failed\n", attempt+1)
					break
				}
			}
		}

		// Place children
		doorIndex := 0
		for _, childIdx := range children {
			if visited[childIdx] {
				continue
			}

			childID := fmt.Sprintf("node_%d", childIdx)

			if doorIndex < len(doorPositions) {
				doorPos := doorPositions[doorIndex]
				doorIndex++

				_, err := generator.PlaceRoom(childID, minimap.RoomShape{{0, 0}}, doorPos)
				if err == nil {
					// Add doors
					childTiles, _ := generator.GetRoomTiles(childID)
					if len(childTiles) > 0 {
						doors, err := minimap.FindDoorDirection(currentTiles, childTiles[0])
						if err == nil {
							generator.AddDoor(doors.Exit[0], doors.Exit[1], doors.Exit[2])
							generator.AddDoor(doors.Entrance[0], doors.Entrance[1], doors.Entrance[2])
						}
					}

					visited[childIdx] = true
					queue = append(queue, childIdx)
					placedCount++
					fmt.Printf("  ✅ Placed child %d\n", childIdx)
				} else {
					fmt.Printf("  ❌ Failed to place child %d: %v\n", childIdx, err)
				}
			} else {
				fmt.Printf("  ❌ No door position available for child %d\n", childIdx)
			}
		}
	}

	tilemap := generator.ConvertToTileMap()
	return &tilemap, placedCount, nil
}

func main() {
	fmt.Println("=== Testing Your Specific Failing Case ===")

	// Your exact tree structure
	tree := tree3.Tree{}
	treeData := []map[string]int{
		{"parent": -1}, {"parent": 0}, {"parent": 0}, {"parent": 2},
		{"parent": 3}, {"parent": 2}, {"parent": 2}, {"parent": 4},
		{"parent": 1}, {"parent": 8},
	}

	for _, nodeData := range treeData {
		tree.Add(nodeData["parent"], nil)
	}

	fmt.Printf("Tree structure (%d nodes):\n", len(tree))
	for i, node := range tree {
		fmt.Printf("  Node %d: parent = %d\n", i, node.ParentId)
	}

	// Count children for each node
	childrenCount := make(map[int]int)
	for _, node := range tree {
		if node.ParentId >= 0 {
			childrenCount[node.ParentId]++
		}
	}

	fmt.Printf("\nChildren count per node:\n")
	for nodeIdx := 0; nodeIdx < len(tree); nodeIdx++ {
		count := childrenCount[nodeIdx]
		if count > 0 {
			fmt.Printf("  Node %d has %d children\n", nodeIdx, count)
		}
	}

	fmt.Printf("\n=== Testing with improved algorithm ===\n")
	tilemap, placedCount, err := simulateGenerateMinimap(tree)

	if err != nil {
		fmt.Printf("❌ Generation failed: %v\n", err)
		return
	}

	// Analyze result
	roomTileCount := 0
	doorTileCount := 0

	if len(tilemap.Layers) >= 2 {
		for _, tile := range tilemap.Layers[0].Data {
			if tile > 0 {
				doorTileCount++
			}
		}

		for _, tile := range tilemap.Layers[1].Data {
			if tile > 0 {
				roomTileCount++
			}
		}
	}

	fmt.Printf("\nResult Summary:\n")
	fmt.Printf("  Expected nodes: %d\n", len(tree))
	fmt.Printf("  Placed nodes: %d\n", placedCount)
	fmt.Printf("  Room tiles: %d\n", roomTileCount)
	fmt.Printf("  Door tiles: %d\n", doorTileCount)

	if placedCount == len(tree) {
		fmt.Printf("  ✅ SUCCESS: All %d nodes placed!\n", len(tree))
	} else {
		fmt.Printf("  ❌ FAILURE: Only %d out of %d nodes placed\n", placedCount, len(tree))
	}

	// Show the tilemap for comparison
	tilemapJSON, _ := json.Marshal(tilemap)
	fmt.Printf("\nGenerated tilemap:\n%s\n", string(tilemapJSON))
}
