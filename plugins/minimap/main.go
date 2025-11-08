// Package main implements the minimap WASM plugin for GameCtl.
//
// This plugin converts a world tree into a 2D spatial layout for Metroidvania-style
// minimap generation. It takes a tree of rooms and produces a grid-based layout with
// room positions and door placements.
//
// The plugin handles all randomness through closures:
// - GetRoomShape: selects room shapes with randomness built into the closure
// - GetDoorPlacement: selects door placements with randomness built into the closure
//
// Input:
//   - tree: World tree from worldgraph plugin (nodes and edges)
//   - config: Generation configuration
//
// Output:
//   - rooms: Map of room IDs to their tile positions and doors
//   - bounds: Min/max X/Y coordinates of the generated layout
package main

import (
	"encoding/json"
	"fmt"
	"maps"

	"github.com/justgook/gamectl/pkg/minimap"
	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input
type Input struct {
	// Direct tree input (backwards compatible)
	TreeData *tree.Tree `json:"tree,omitempty"`

	// Or reference to tree-storage
	TreeID string `json:"treeId,omitempty"`

	// Legacy: accept tree directly at root level for backwards compatibility
	Nodes map[string]*tree.Node `json:"nodes,omitempty"`
	Root  string                `json:"root,omitempty"`
}

//go:wasmimport random next
func nextRand() float32

//export minimap
func Minimap() int32 {
	inputBytes := pdk.Input()
	input := Input{}
	if err := json.Unmarshal(inputBytes, &input); err != nil {
		return 1
	}

	// Resolve tree: try TreeID first, then TreeData field, then embedded tree
	var worldTree *tree.Tree

	if input.TreeID != "" {
		// Load from tree-storage
		getInput := map[string]string{"id": input.TreeID}
		getJSON, err := json.Marshal(getInput)
		if err != nil {
			return 1
		}

		status, output, callErr := pdk.Call("tree-storage", "get", getJSON)
		if status != 0 || callErr != nil {
			// Storage failed - log but don't fail
			_ = fmt.Sprintf("Failed to load tree from tree-storage: %s", input.TreeID)
			return 1
		}

		worldTree = &tree.Tree{}
		if err := json.Unmarshal(output, worldTree); err != nil {
			return 1
		}
	} else if input.TreeData != nil {
		worldTree = input.TreeData
	} else if input.Nodes != nil {
		// Legacy: tree embedded at root level
		worldTree = &tree.Tree{
			Nodes: input.Nodes,
			Root:  input.Root,
		}
	} else {
		return 1
	}

	// Build edges map from Children arrays in nodes
	// Worldgraph outputs tree.Tree structure with Children []Edge,
	// but we need a separate Edges map[parent][]child for BFS traversal
	edges := make(map[string][]string)
	for nodeID, node := range worldTree.Nodes {
		if len(node.Children) > 0 {
			children := make([]string, len(node.Children))
			for i, child := range node.Children {
				children[i] = child.To
			}
			edges[nodeID] = children
		}
	}

	// Create generator
	generator := minimap.NewMinimapGenerator()

	// Generate minimap from tree
	// Note: We pass nil for callbacks and use direct nextRand() calls instead
	// because TinyGo doesn't support passing //go:wasmimport functions as values
	if err := generateMinimapLayout(generator, worldTree, edges); err != nil {
		return 1
	}

	// Convert to tilemap and store in tilemap-storage plugin
	tileMap := generator.ConvertToTileMap()
	storeInput := map[string]interface{}{
		"id":  "minimap",
		"map": tileMap,
	}
	storeJSON, err := json.Marshal(storeInput)
	if err == nil {
		// Call tilemap-storage plugin (ignore errors - storage is optional)
		status, _, callErr := pdk.Call("tilemap-storage", "set", storeJSON)
		// Log storage result for debugging
		if status != 0 || callErr != nil {
			// Storage failed, but we continue since it's optional
		}
	}

	// Return original output format for backwards compatibility
	output, err := json.Marshal(generator.ConvertToOutput())
	if err != nil {
		return 1
	}

	pdk.Output(output)

	return 0
}

// generateMinimapLayout places rooms in the minimap based on the tree structure
func generateMinimapLayout(
	gen *minimap.MinimapGenerator,
	t *tree.Tree,
	edges map[string][]string,
) error {
	if t.Root == "" {
		return fmt.Errorf("no root node in tree")
	}

	// Calculate required doors for each room (number of children that need to connect)
	requiredDoors := make(map[string]int)
	for parentID, children := range edges {
		requiredDoors[parentID] = len(children)
	}

	// Get root node data
	rootNodeData := map[string]string{}
	if rootNode, exists := t.Nodes[t.Root]; exists {
		rootNodeData = rootNode.Data
	}

	// Track open doors (rooms with unplaced children)
	openDoors := make(map[string]int)

	// Try to place root with enough door capacity
	rootPlaced := false
	for attempt := 0; attempt < 20 && !rootPlaced; attempt++ {
		rootShape := getRoomShape(t.Root, rootNodeData)
		_, err := gen.PlaceRoom(t.Root, rootShape, minimap.Coordinate{0, 0})
		if err != nil {
			return err
		}

		// Check if root has enough positions for all its children
		rootTiles, _ := gen.GetRoomTiles(t.Root)
		doorCapacity := gen.CountAvailableDoorPositions(rootTiles)
		if doorCapacity >= requiredDoors[t.Root] {
			rootPlaced = true
		} else {
			// Try to expand the room to add more exits
			if requiredDoors[t.Root] > 0 {
				openDoors[t.Root] = requiredDoors[t.Root]
			}
			if gen.ExpandRoomForDoors(t.Root, requiredDoors[t.Root], openDoors) {
				rootPlaced = true
			} else {
				// Expansion failed, try different shape
				gen.RemoveRoom(t.Root)
				delete(openDoors, t.Root)
			}
		}
	}

	if !rootPlaced {
		return fmt.Errorf("could not place root with enough door capacity")
	}

	// Set open doors for root
	if requiredDoors[t.Root] > 0 {
		openDoors[t.Root] = requiredDoors[t.Root]
	}

	// Process tree BFS to place remaining rooms
	visited := make(map[string]bool)
	visited[t.Root] = true
	queue := []string{t.Root}

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		// Get children of current node
		children := edges[current]
		if len(children) == 0 {
			delete(openDoors, current)
			continue
		}

		currentTiles, _ := gen.GetRoomTiles(current)
		if len(currentTiles) == 0 {
			continue
		}

		// Place each child room
		for _, childID := range children {
			if visited[childID] {
				continue
			}

			// Try to place this child with validation
			placed := tryPlaceChildWithValidation(gen, childID, current, currentTiles, t, requiredDoors, openDoors)
			if placed {
				visited[childID] = true
				queue = append(queue, childID)

				// Update open doors
				openDoors[current]--
				if openDoors[current] <= 0 {
					delete(openDoors, current)
				}
				if requiredDoors[childID] > 0 {
					openDoors[childID] = requiredDoors[childID]
				}
			}
		}
	}

	return nil
}

// tryPlaceChildWithValidation attempts to place a child with full constraint validation
func tryPlaceChildWithValidation(gen *minimap.MinimapGenerator, childID, parentID string, parentTiles []minimap.Coordinate, t *tree.Tree, requiredDoors, openDoors map[string]int) bool {
	// Get child node data
	childNodeData := map[string]string{}
	if childNode, exists := t.Nodes[childID]; exists {
		childNodeData = childNode.Data
	}

	// Find placement neighbors
	neighbors := gen.GetUnblockedNeighbors(parentTiles)
	if len(neighbors) == 0 {
		return false
	}

	childDoorRequirement := requiredDoors[childID]

	// Try multiple shape variants
	for range 10 {
		// Get child room shape
		childShape := getRoomShape(childID, childNodeData)

		// Try to place at available neighbors
		for _, neighbor := range neighbors {
			if !gen.CanPlaceRoom(childShape, neighbor) {
				continue
			}

			// Translate shape to position
			testTiles := minimap.TranslateShape(childShape, neighbor)

			// Validate freedom constraint for the new room
			if !gen.HasFreePathFrom(testTiles) {
				continue
			}

			// CRITICAL: Check if placement blocks any existing open doors
			// We simulate the placement and check all open doors still have paths
			placedTiles, err := gen.PlaceRoom(childID, childShape, neighbor)
			if err != nil || len(placedTiles) == 0 {
				continue
			}

			// Check if child has enough door capacity for its children
			testDoorCapacity := gen.CountAvailableDoorPositions(placedTiles)
			if testDoorCapacity < childDoorRequirement {
				// Try to expand the child room to add more exits
				testOpenDoors := make(map[string]int)
				maps.Copy(testOpenDoors, openDoors)
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
			testOpenDoors := make(map[string]int)
			maps.Copy(testOpenDoors, openDoors)

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

// getRoomShape selects a room shape based on room ID and node data
// Calls nextRand() directly since TinyGo doesn't support passing imported functions as values
func getRoomShape(_ string, _ map[string]string) minimap.RoomShape {
	// Pick random shape variant using nextRand()
	idx := int(nextRand() * float32(len(roomShapesToChooseFrom)))
	if idx >= len(roomShapesToChooseFrom) {
		idx = len(roomShapesToChooseFrom) - 1
	}
	return roomShapesToChooseFrom[idx]
}

var roomShapesToChooseFrom = []minimap.RoomShape{
	// Single tiles - most flexible for tight spaces
	{{0, 0}},
	// 2-tile shapes
	{{0, 0}, {0, -1}},
	{{0, 0}, {0, 1}},
	{{0, 0}, {1, 0}},
	{{0, 0}, {-1, 0}},
	// Small L-shapes
	{{0, 0}, {1, 0}, {0, 1}},
	{{0, 0}, {-1, 0}, {0, 1}},
	// Larger rooms
	{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
	{{0, 0}, {1, 0}, {0, 1}, {1, 1}, {0, 2}, {1, 2}},
	{{0, 0}, {0, 1}, {1, 0}, {1, 1}, {2, 0}, {2, 1}},
	{{0, 0}, {1, 0}, {0, 1}, {0, 2}},
	{{0, 0}, {1, 0}, {1, 1}, {1, 2}},
	{{0, 0}, {0, 1}, {1, 1}, {2, 1}},
	{{0, 0}, {0, 1}, {-1, 1}, {-2, 1}},
	{{0, 0}, {1, 0}, {2, 0}, {1, 1}},
	{{0, 0}, {0, 1}, {0, 2}, {-1, 1}},
}
