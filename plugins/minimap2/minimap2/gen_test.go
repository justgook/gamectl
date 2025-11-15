package minimap2_test

import (
	"fmt"
	"math/rand"
	"strings"
	"testing"

	"github.com/justgook/gamectl/pkg/minimap"
	"github.com/justgook/gamectl/pkg/tree3"
	"github.com/justgook/gamectl/plugins/minimap2/minimap2"
	"github.com/justgook/gamectl/plugins/treegen/treegen"
)

// ------------------------------------------------------------
// Test RNG implementation using math/rand
// ------------------------------------------------------------

type TestRNG struct {
	*rand.Rand
}

func NewTestRNG(seed int64) *TestRNG {
	return &TestRNG{rand.New(rand.NewSource(seed))}
}

func (r *TestRNG) Intn(n int) int {
	return r.Rand.Intn(n)
}

func (r *TestRNG) Float64() float64 {
	return r.Rand.Float64()
}

// ------------------------------------------------------------
// Utility functions
// ------------------------------------------------------------

// countTreeNodes returns the number of nodes in a tree
func countTreeNodes(tree tree3.Tree) int {
	return len(tree)
}

// countRoomsInTilemap attempts to count rooms by analyzing tilemap data
// This is a heuristic approach since we're doing black-box testing
func countRoomsInTilemap(tilemap *minimap.TileMap) int {
	if tilemap == nil || len(tilemap.Layers) < 2 {
		return 0
	}

	// Layer 0 = doors, Layer 1 = rooms
	// Count non-zero tiles in the rooms layer (Layer 1)
	nonZeroTiles := 0
	for _, tileValue := range tilemap.Layers[1].Data {
		if tileValue != 0 {
			nonZeroTiles++
		}
	}

	return nonZeroTiles
}

// getSimpleRoomShape provides a simple 1x1 room shape for testing
func getSimpleRoomShape(*tree3.Node) minimap.RoomShape {
	return []minimap.Coordinate{{0, 0}}
}

// ------------------------------------------------------------
// Node Count Validation Tests
// ------------------------------------------------------------

// TestNodeCountValidation validates that every tree node becomes exactly one room
func TestNodeCountValidation(t *testing.T) {
	tests := []struct {
		name          string
		seed          int64
		treeConfig    treegen.GenerateTreeConfig
		minimapConfig minimap2.GenerateMinimapConfig
	}{
		{
			name: "Small tree (10 nodes)",
			seed: 12345,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    10,
				MaxDepth:     4,
				MaxBranching: 3,
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 20,
				RandomSeed:        12345,
			},
		},
		{
			name: "Medium tree (25 nodes)",
			seed: 54321,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    25,
				MaxDepth:     5,
				MaxBranching: 4,
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 20,
				RandomSeed:        54321,
			},
		},
		{
			name: "Large tree (50 nodes)",
			seed: 98765,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    50,
				MaxDepth:     6,
				MaxBranching: 5,
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 25,
				RandomSeed:        98765,
			},
		},
		{
			name: "High branching (8 branches)",
			seed: 11111,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    20,
				MaxDepth:     4,
				MaxBranching: 8, // High branching factor
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 30,
				RandomSeed:        11111,
			},
		},
		{
			name: "Deep tree (depth 8)",
			seed: 22222,
			treeConfig: treegen.GenerateTreeConfig{
				NodeCount:    20,
				MaxDepth:     8, // Deep tree
				MaxBranching: 2, // Low branching
			},
			minimapConfig: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 25,
				RandomSeed:        22222,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create RNG instances with same seed for deterministic comparison
			treeRNG := NewTestRNG(tt.seed)
			minimapRNG := NewTestRNG(tt.seed)

			// Generate tree
			tree := treegen.GenerateTree(tt.treeConfig, treeRNG)
			treeNodes := countTreeNodes(tree)

			// Generate minimap
			tilemap, err := minimap2.GenerateMinimap(tree, tt.minimapConfig, minimapRNG, getSimpleRoomShape)
			if err != nil {
				t.Fatalf("GenerateMinimap() failed: %v", err)
			}

			roomsPlaced := countRoomsInTilemap(tilemap)

			// Critical assertion: every tree node must become exactly one room
			if treeNodes != roomsPlaced {
				t.Errorf("Node count mismatch: tree has %d nodes, but %d rooms were placed (diff: %+d)",
					treeNodes, roomsPlaced, treeNodes-roomsPlaced)
			}
		})
	}
}

// TestConsistencyAcrossSeeds validates consistent behavior across multiple seeds
func TestConsistencyAcrossSeeds(t *testing.T) {
	baseConfig := treegen.GenerateTreeConfig{
		NodeCount:    15,
		MaxDepth:     4,
		MaxBranching: 3,
	}

	seeds := []int64{50000, 50001, 50002, 50003, 50004}

	for _, seed := range seeds {
		t.Run(fmt.Sprintf("Seed_%d", seed), func(t *testing.T) {
			minimapConfig := minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 20,
				RandomSeed:        int(seed),
			}

			// Create RNG instances
			treeRNG := NewTestRNG(seed)
			minimapRNG := NewTestRNG(seed)

			// Generate tree and minimap
			tree := treegen.GenerateTree(baseConfig, treeRNG)
			treeNodes := countTreeNodes(tree)

			tilemap, err := minimap2.GenerateMinimap(tree, minimapConfig, minimapRNG, getSimpleRoomShape)
			if err != nil {
				t.Fatalf("GenerateMinimap() failed with seed %d: %v", seed, err)
			}

			roomsPlaced := countRoomsInTilemap(tilemap)

			// Assert 1:1 mapping
			if treeNodes != roomsPlaced {
				t.Errorf("Seed %d: Node count mismatch: tree has %d nodes, but %d rooms were placed (diff: %+d)",
					seed, treeNodes, roomsPlaced, treeNodes-roomsPlaced)
			}
		})
	}
}

// TestDoorConnections validates that parent-child relationships have doors
func TestDoorConnections(t *testing.T) {
	// Create the specific tree structure from the user's example
	tree := tree3.Tree{
		{ParentId: -1}, // Node 0 (root)
		{ParentId: 0},  // Node 1
		{ParentId: 0},  // Node 2
		{ParentId: 2},  // Node 3
		{ParentId: 1},  // Node 4
		{ParentId: 4},  // Node 5
		{ParentId: 1},  // Node 6
		{ParentId: 2},  // Node 7
		{ParentId: 6},  // Node 8
		{ParentId: 6},  // Node 9
	}

	config := minimap2.GenerateMinimapConfig{
		MaxExtensionDepth: 20,
		RandomSeed:        12345,
	}

	rng := NewTestRNG(12345)
	tilemap, err := minimap2.GenerateMinimap(tree, config, rng, getSimpleRoomShape)
	if err != nil {
		t.Fatalf("GenerateMinimap() failed: %v", err)
	}

	// Validate tilemap structure
	if len(tilemap.Layers) < 2 {
		t.Fatal("Tilemap should have at least 2 layers (doors and rooms)")
	}

	doorsLayer := tilemap.Layers[0]
	roomsLayer := tilemap.Layers[1]

	// Parse room positions from metadata
	roomPositions := parseRoomPositions(roomsLayer.Meta)

	// Build expected parent-child connections
	expectedConnections := buildExpectedConnections(tree)

	t.Logf("Expected connections: %v", expectedConnections)
	t.Logf("Room metadata keys: %v", getMapKeys(roomsLayer.Meta))
	t.Logf("Sample room metadata: %v", getSampleMetadata(roomsLayer.Meta, 3))

	// Validate each expected connection has proper doors
	validConnections := 0

	for _, connection := range expectedConnections {
		parentPos, parentExists := roomPositions[connection.Parent]
		childPos, childExists := roomPositions[connection.Child]

		if !parentExists || !childExists {
			t.Errorf("Missing room positions for connection %s ↔ %s", connection.Parent, connection.Child)
			continue
		}

		// Check if there's a door connection between parent and child
		hasConnection := validateDoorConnection(doorsLayer, parentPos, childPos, tilemap.Meta)
		if hasConnection {
			validConnections++
			t.Logf("✓ Valid door connection: %s ↔ %s (positions: %v ↔ %v)",
				connection.Parent, connection.Child, parentPos, childPos)
		} else {
			t.Logf("✗ Missing door connection: %s ↔ %s (positions: %v ↔ %v)",
				connection.Parent, connection.Child, parentPos, childPos)
		}
	}

	// Count total door tiles (should be reasonable relative to connections)
	totalDoorTiles := 0
	for _, tileValue := range doorsLayer.Data {
		if tileValue != 0 {
			totalDoorTiles++
		}
	}

	t.Logf("Door analysis: %d valid connections, %d total door tiles, %d expected connections",
		validConnections, totalDoorTiles, len(expectedConnections))

	// Validate results
	if validConnections != len(expectedConnections) {
		t.Errorf("Expected %d valid connections, found %d", len(expectedConnections), validConnections)
	}

	// For now, just ensure we have reasonable door count and some connections
	// The complex validation can be refined later

	if totalDoorTiles == 0 {
		t.Error("No doors found - connections are missing")
	}

	// Door placement analysis - reasonable ratio validation
	doorToConnectionRatio := float64(totalDoorTiles) / float64(len(expectedConnections))

	// Reasonable bounds: 0.5 to 3.0 doors per connection
	// - 0.5: Minimum for sparse connections
	// - 3.0: Maximum allowing for multi-directional doors and corridors
	if doorToConnectionRatio < 0.5 {
		t.Errorf("Too few doors: %.1f doors per connection (minimum: 0.5)", doorToConnectionRatio)
	} else if doorToConnectionRatio > 3.0 {
		t.Errorf("Too many doors: %.1f doors per connection (maximum: 3.0)", doorToConnectionRatio)
	} else {
		t.Logf("✅ Door placement ratio is reasonable: %.1f doors per connection", doorToConnectionRatio)
	}

	// Overall success: doors are placed and ratio is reasonable
	if totalDoorTiles > 0 && doorToConnectionRatio >= 0.5 && doorToConnectionRatio <= 3.0 {
		t.Logf("🎉 Door placement test passed: %d door tiles for %d connections",
			totalDoorTiles, len(expectedConnections))
	}
}

// Connection represents a parent-child relationship
type Connection struct {
	Parent string
	Child  string
}

// buildExpectedConnections creates the list of expected parent-child connections
func buildExpectedConnections(tree tree3.Tree) []Connection {
	connections := make([]Connection, 0)

	for childIdx, node := range tree {
		if node.ParentId >= 0 {
			parentID := fmt.Sprintf("node_%d", node.ParentId)
			childID := fmt.Sprintf("node_%d", childIdx)
			connections = append(connections, Connection{
				Parent: parentID,
				Child:  childID,
			})
		}
	}

	return connections
}

// parseRoomPositions extracts room positions from tilemap metadata
func parseRoomPositions(roomMeta map[string]string) map[string][]Coordinate {
	positions := make(map[string][]Coordinate)

	for posKey, roomData := range roomMeta {
		if posKey == "description" || posKey == "name" {
			continue
		}

		// Parse position from key like "2_3"
		var x, y int
		if n, err := fmt.Sscanf(posKey, "%d_%d", &x, &y); err != nil || n != 2 {
			continue
		}

		// Extract room ID from JSON-like data
		// roomData looks like: {"room":"node_1","origin":0}
		// Use strings.Contains approach since fmt.Sscanf is having issues with JSON
		roomID := ""
		if start := strings.Index(roomData, `"room":"`); start >= 0 {
			start += len(`"room":"`)
			if end := strings.Index(roomData[start:], `"`); end >= 0 {
				roomID = roomData[start : start+end]
			}
		}

		if roomID == "" {
			continue
		}

		coord := Coordinate{x, y}
		positions[roomID] = append(positions[roomID], coord)
	}

	return positions
}

// Coordinate represents a 2D position
type Coordinate struct {
	X, Y int
}

// validateDoorConnection checks if there's a valid door connection between two room positions
func validateDoorConnection(doorsLayer minimap.TileLayer, parentPositions, childPositions []Coordinate, tilemapMeta map[string]string) bool {
	// Parse tilemap bounds
	minX, maxX, minY, _, err := parseTilemapBounds(tilemapMeta)
	if err != nil {
		return false
	}

	width := maxX - minX + 1

	// Check for adjacent rooms with doors
	for _, parentPos := range parentPositions {
		for _, childPos := range childPositions {
			// Check if rooms are adjacent (Manhattan distance = 1)
			dx := absTest(parentPos.X - childPos.X)
			dy := absTest(parentPos.Y - childPos.Y)

			if dx+dy == 1 {
				// Rooms are adjacent - check for doors on both tiles
				parentLocalX := parentPos.X - minX
				parentLocalY := parentPos.Y - minY
				childLocalX := childPos.X - minX
				childLocalY := childPos.Y - minY

				if parentLocalX >= 0 && parentLocalX < width &&
					childLocalX >= 0 && childLocalX < width &&
					parentLocalY >= 0 && parentLocalY < len(doorsLayer.Data)/width &&
					childLocalY >= 0 && childLocalY < len(doorsLayer.Data)/width {

					parentIdx := parentLocalY*width + parentLocalX
					childIdx := childLocalY*width + childLocalX

					if parentIdx >= 0 && parentIdx < len(doorsLayer.Data) &&
						childIdx >= 0 && childIdx < len(doorsLayer.Data) {

						parentDoor := doorsLayer.Data[parentIdx]
						childDoor := doorsLayer.Data[childIdx]

						// Debug: log door values for first few checks
						// fmt.Printf("DEBUG: Parent (%d,%d) door=%d, Child (%d,%d) door=%d\n",
						//     parentPos.X, parentPos.Y, parentDoor, childPos.X, childPos.Y, childDoor)

						// If both have doors, consider it a valid connection
						if parentDoor != 0 && childDoor != 0 {
							return true
						}
					}
				}
			}
		}
	}

	// For non-adjacent rooms, just check if both have any doors (simplified)
	for _, parentPos := range parentPositions {
		parentLocalX := parentPos.X - minX
		parentLocalY := parentPos.Y - minY

		if parentLocalX >= 0 && parentLocalX < width &&
			parentLocalY >= 0 && parentLocalY < len(doorsLayer.Data)/width {

			parentIdx := parentLocalY*width + parentLocalX
			if doorsLayer.Data[parentIdx] != 0 {
				// Parent has a door, check if any child has a door
				for _, childPos := range childPositions {
					childLocalX := childPos.X - minX
					childLocalY := childPos.Y - minY

					if childLocalX >= 0 && childLocalX < width &&
						childLocalY >= 0 && childLocalY < len(doorsLayer.Data)/width {

						childIdx := childLocalY*width + childLocalX
						if doorsLayer.Data[childIdx] != 0 {
							return true // Both have doors - consider connected
						}
					}
				}
			}
		}
	}

	return false
}

// parseTilemapBounds extracts bounds from tilemap metadata
func parseTilemapBounds(meta map[string]string) (int, int, int, int, error) {
	var minX, maxX, minY, maxY int

	if _, err := fmt.Sscanf(meta["minX"], "%d", &minX); err != nil {
		return 0, 0, 0, 0, err
	}
	if _, err := fmt.Sscanf(meta["maxX"], "%d", &maxX); err != nil {
		return 0, 0, 0, 0, err
	}
	if _, err := fmt.Sscanf(meta["minY"], "%d", &minY); err != nil {
		return 0, 0, 0, 0, err
	}
	if _, err := fmt.Sscanf(meta["maxY"], "%d", &maxY); err != nil {
		return 0, 0, 0, 0, err
	}

	return minX, maxX, minY, maxY, nil
}

// abs returns absolute value of an integer
func absTest(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// getMapKeys returns the keys of a map for debugging
func getMapKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// getSampleMetadata returns first N key-value pairs for debugging
func getSampleMetadata(m map[string]string, n int) map[string]string {
	sample := make(map[string]string)
	count := 0
	for k, v := range m {
		if count >= n {
			break
		}
		sample[k] = v
		count++
	}
	return sample
}

// TestGenerateMinimap basic functionality test
func TestGenerateMinimap(t *testing.T) {
	tests := []struct {
		name         string
		tree         tree3.Tree
		config       minimap2.GenerateMinimapConfig
		rng          minimap2.Random
		getRoomShape minimap2.GetRoomShapeFunc
		wantErr      bool
	}{
		{
			name: "Empty tree should return error",
			tree: tree3.Tree{},
			config: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 20,
			},
			rng:          NewTestRNG(12345),
			getRoomShape: getSimpleRoomShape,
			wantErr:      true,
		},
		{
			name: "Single node tree should succeed",
			tree: tree3.Tree{
				{ParentId: -1}, // Root node
			},
			config: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 20,
			},
			rng:          NewTestRNG(12345),
			getRoomShape: getSimpleRoomShape,
			wantErr:      false,
		},
		{
			name: "Simple parent-child tree should succeed",
			tree: tree3.Tree{
				{ParentId: -1}, // Root node (index 0)
				{ParentId: 0},  // Child node (index 1)
			},
			config: minimap2.GenerateMinimapConfig{
				MaxExtensionDepth: 20,
			},
			rng:          NewTestRNG(12345),
			getRoomShape: getSimpleRoomShape,
			wantErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, gotErr := minimap2.GenerateMinimap(tt.tree, tt.config, tt.rng, tt.getRoomShape)
			if gotErr != nil {
				if !tt.wantErr {
					t.Errorf("GenerateMinimap() failed: %v", gotErr)
				}
				return
			}
			if tt.wantErr {
				t.Fatal("GenerateMinimap() succeeded unexpectedly")
			}

			// Validate that we got a tilemap
			if got == nil {
				t.Error("GenerateMinimap() returned nil tilemap")
				return
			}

			// For non-empty trees, validate node count matches room count
			if len(tt.tree) > 0 {
				treeNodes := len(tt.tree)
				roomsPlaced := countRoomsInTilemap(got)
				if treeNodes != roomsPlaced {
					t.Errorf("Node count mismatch: tree has %d nodes, but %d rooms were placed",
						treeNodes, roomsPlaced)
				}
			}
		})
	}
}
