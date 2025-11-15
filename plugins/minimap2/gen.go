package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/minimap"
	"github.com/justgook/gamectl/pkg/tree3"
)

// ------------------------------------------------------------
// Config + interfaces
// ------------------------------------------------------------

// GenerateMinimapConfig defines parameters for minimap generation
type GenerateMinimapConfig struct {
	MaxAttempts   int    `json:"maxAttempts"`   // Maximum placement attempts per room (default: 20)
	RoomSpacing   int    `json:"roomSpacing"`   // Minimum spacing between rooms (default: 0)
	LayoutStyle   string `json:"layoutStyle"`   // Layout generation style (default: "bfs")
	AllowOverlap  bool   `json:"allowOverlap"`  // Allow room overlap (default: false)
	PreferCompact bool   `json:"preferCompact"` // Prefer compact layouts (default: true)
}

// GetRoomShapeFunc defines the function signature for room shape selection
type GetRoomShapeFunc func(*tree3.Node) minimap.RoomShape

// ------------------------------------------------------------
// Main generation function
// ------------------------------------------------------------

// GenerateMinimap generates a 2D spatial layout from a tree3.Tree structure
func GenerateMinimap(
	tree tree3.Tree,
	config GenerateMinimapConfig,
	rng Random,
	getRoomShape GetRoomShapeFunc,
) (*minimap.TileMap, error) {
	if len(tree) == 0 {
		return nil, fmt.Errorf("empty tree provided")
	}

	// Apply default config values
	config = applyDefaultConfig(config)

	// Create minimap generator
	generator := minimap.NewMinimapGenerator()

	// Generate layout using tree3 structure
	if err := generateMinimapLayout(generator, tree, config, rng, getRoomShape); err != nil {
		return nil, fmt.Errorf("layout generation failed: %w", err)
	}

	// Convert to tilemap for storage
	tileMap := generator.ConvertToTileMap()
	return &tileMap, nil
}

// ------------------------------------------------------------
// Layout generation logic
// ------------------------------------------------------------

// generateMinimapLayout places rooms in the minimap based on tree3 structure
func generateMinimapLayout(
	gen *minimap.MinimapGenerator,
	tree tree3.Tree,
	config GenerateMinimapConfig,
	rng Random,
	getRoomShape GetRoomShapeFunc,
) error {
	// Find root node (ParentId == -1)
	var rootNode *tree3.Node
	var rootIdx int
	for i, node := range tree {
		if node.ParentId == -1 {
			rootNode = node
			rootIdx = i
			break
		}
	}
	if rootNode == nil {
		return fmt.Errorf("no root node found (ParentId == -1)")
	}

	// Build parent-to-children mapping for efficient traversal
	childrenMap := buildChildrenMap(tree)

	// Calculate required doors for each room
	requiredDoors := make(map[int]int)
	for nodeIdx, children := range childrenMap {
		requiredDoors[nodeIdx] = len(children)
	}

	// Try to place root with enough door capacity
	rootPlaced := false
	for attempt := 0; attempt < config.MaxAttempts && !rootPlaced; attempt++ {
		rootShape := getRoomShape(rootNode)
		rootID := nodeIDFromIndex(rootIdx)

		_, err := gen.PlaceRoom(rootID, rootShape, minimap.Coordinate{0, 0})
		if err != nil {
			return fmt.Errorf("failed to place root: %w", err)
		}

		// Check if root has enough positions for all its children
		rootTiles, _ := gen.GetRoomTiles(rootID)
		doorCapacity := gen.CountAvailableDoorPositions(rootTiles)

		if doorCapacity >= requiredDoors[rootIdx] {
			rootPlaced = true
		} else {
			// Try to expand the room to add more exits
			openDoors := make(map[string]int)
			if requiredDoors[rootIdx] > 0 {
				openDoors[rootID] = requiredDoors[rootIdx]
			}

			if gen.ExpandRoomForDoors(rootID, requiredDoors[rootIdx], openDoors) {
				rootPlaced = true
			} else {
				// Expansion failed, try different shape
				gen.RemoveRoom(rootID)
			}
		}
	}

	if !rootPlaced {
		return fmt.Errorf("could not place root with enough door capacity after %d attempts", config.MaxAttempts)
	}

	// Track open doors (rooms with unplaced children)
	openDoors := make(map[string]int)
	if requiredDoors[rootIdx] > 0 {
		openDoors[nodeIDFromIndex(rootIdx)] = requiredDoors[rootIdx]
	}

	// Process tree BFS to place remaining rooms
	visited := make(map[int]bool)
	visited[rootIdx] = true
	queue := []int{rootIdx}

	for len(queue) > 0 {
		currentIdx := queue[0]
		queue = queue[1:]
		currentID := nodeIDFromIndex(currentIdx)

		// Get children of current node
		children := childrenMap[currentIdx]
		if len(children) == 0 {
			delete(openDoors, currentID)
			continue
		}

		currentTiles, _ := gen.GetRoomTiles(currentID)
		if len(currentTiles) == 0 {
			continue
		}

		// Place each child room
		for _, childIdx := range children {
			if visited[childIdx] {
				continue
			}

			childID := nodeIDFromIndex(childIdx)
			childNode := tree[childIdx]

			// Try to place this child with validation
			placed := tryPlaceChildWithValidation(
				gen, childID, currentID, currentTiles, childNode,
				requiredDoors[childIdx], openDoors, config, rng, getRoomShape,
			)

			if placed {
				visited[childIdx] = true
				queue = append(queue, childIdx)

				// Update open doors
				openDoors[currentID]--
				if openDoors[currentID] <= 0 {
					delete(openDoors, currentID)
				}
				if requiredDoors[childIdx] > 0 {
					openDoors[childID] = requiredDoors[childIdx]
				}
			}
		}
	}

	return nil
}

// ------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------

// buildChildrenMap creates a mapping from parent index to child indices
func buildChildrenMap(tree tree3.Tree) map[int][]int {
	childrenMap := make(map[int][]int)

	for childIdx, node := range tree {
		if node.ParentId >= 0 && node.ParentId < len(tree) {
			parentIdx := node.ParentId
			childrenMap[parentIdx] = append(childrenMap[parentIdx], childIdx)
		}
	}

	return childrenMap
}

// tryPlaceChildWithValidation attempts to place a child with full constraint validation
func tryPlaceChildWithValidation(
	gen *minimap.MinimapGenerator,
	childID, parentID string,
	parentTiles []minimap.Coordinate,
	childNode *tree3.Node,
	childDoorRequirement int,
	openDoors map[string]int,
	config GenerateMinimapConfig,
	rng Random,
	getRoomShape GetRoomShapeFunc,
) bool {
	// Find placement neighbors
	neighbors := gen.GetUnblockedNeighbors(parentTiles)
	if len(neighbors) == 0 {
		return false
	}

	// Try multiple shape variants
	for attempt := 0; attempt < config.MaxAttempts; attempt++ {
		// Get child room shape
		childShape := getRoomShape(childNode)

		// Shuffle neighbors for randomness
		shuffledNeighbors := shuffleCoordinates(neighbors, rng)

		// Try to place at available neighbors
		for _, neighbor := range shuffledNeighbors {
			if !gen.CanPlaceRoom(childShape, neighbor) {
				continue
			}

			// Translate shape to position
			testTiles := minimap.TranslateShape(childShape, neighbor)

			// Validate freedom constraint for the new room
			if !gen.HasFreePathFrom(testTiles) {
				continue
			}

			// Place the room temporarily
			placedTiles, err := gen.PlaceRoom(childID, childShape, neighbor)
			if err != nil || len(placedTiles) == 0 {
				continue
			}

			// Check if child has enough door capacity for its children
			testDoorCapacity := gen.CountAvailableDoorPositions(placedTiles)
			if testDoorCapacity < childDoorRequirement {
				// Try to expand the child room to add more exits
				testOpenDoors := copyOpenDoors(openDoors)
				testOpenDoors[parentID]--
				if testOpenDoors[parentID] <= 0 {
					delete(testOpenDoors, parentID)
				}
				if childDoorRequirement > 0 {
					testOpenDoors[childID] = childDoorRequirement
				}

				if !gen.ExpandRoomForDoors(childID, childDoorRequirement, testOpenDoors) {
					// Can't expand enough, remove and try next
					gen.RemoveRoom(childID)
					continue
				}
				// Re-get tiles after expansion
				placedTiles, _ = gen.GetRoomTiles(childID)
			}

			// Update open doors temporarily to check constraint
			testOpenDoors := copyOpenDoors(openDoors)
			testOpenDoors[parentID]-- // One less open door on parent
			if testOpenDoors[parentID] <= 0 {
				delete(testOpenDoors, parentID)
			}

			// Check all open doors still have paths
			if !gen.ValidateAllOpenDoorsHavePath(testOpenDoors) {
				// This placement blocks future rooms, remove and try next
				gen.RemoveRoom(childID)
				continue
			}

			// Placement is valid! Add doors
			childEntrance := placedTiles[0]
			doors, err := minimap.FindDoorDirection(parentTiles, childEntrance)
			if err == nil {
				gen.AddDoor(doors.Exit[0], doors.Exit[1], doors.Exit[2])
				gen.AddDoor(doors.Entrance[0], doors.Entrance[1], doors.Entrance[2])
			}

			return true
		}
	}

	return false
}

// applyDefaultConfig applies default values to configuration
func applyDefaultConfig(config GenerateMinimapConfig) GenerateMinimapConfig {
	if config.MaxAttempts <= 0 {
		config.MaxAttempts = 20
	}
	if config.LayoutStyle == "" {
		config.LayoutStyle = "bfs"
	}
	// Other defaults are already zero-values or false which are appropriate
	return config
}

// nodeIDFromIndex converts tree index to string ID for minimap generator
func nodeIDFromIndex(idx int) string {
	return fmt.Sprintf("node_%d", idx)
}

// shuffleCoordinates randomizes the order of coordinates using Fisher-Yates shuffle
func shuffleCoordinates(coords []minimap.Coordinate, rng Random) []minimap.Coordinate {
	shuffled := make([]minimap.Coordinate, len(coords))
	copy(shuffled, coords)

	for i := len(shuffled) - 1; i > 0; i-- {
		j := rng.Intn(i + 1)
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}

	return shuffled
}

// copyOpenDoors creates a copy of the open doors map
func copyOpenDoors(openDoors map[string]int) map[string]int {
	copy := make(map[string]int)
	for k, v := range openDoors {
		copy[k] = v
	}
	return copy
}
