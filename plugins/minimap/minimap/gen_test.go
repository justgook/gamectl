package minimap_test

import (
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap"
)

// Simple test random implementation
type TestRandom struct {
	rng *rand.Rand
}

func NewTestRandom(seed int64) *TestRandom {
	return &TestRandom{
		rng: rand.New(rand.NewSource(seed)),
	}
}

func (r *TestRandom) Intn(n int) int {
	return r.rng.Intn(n)
}

func (r *TestRandom) Float64() float64 {
	return r.rng.Float64()
}

// Simple room shape functions
func SingleTile(*tree.Node) minimap.RoomShape {
	return minimap.RoomShape{{0, 0}}
}

func TwoTileHorizontal(*tree.Node) minimap.RoomShape {
	return minimap.RoomShape{{0, 0}, {1, 0}}
}

func LShape(*tree.Node) minimap.RoomShape {
	return minimap.RoomShape{{0, 0}, {1, 0}, {0, 1}}
}

// Helper to create a simple tree
func createTestTree() tree.Tree {
	var testTree tree.Tree

	// Root node
	testTree = append(testTree, &tree.Node{ParentId: -1, Data: map[string]string{}})

	// Two children
	testTree = append(testTree, &tree.Node{ParentId: 0, Data: map[string]string{}})
	testTree = append(testTree, &tree.Node{ParentId: 0, Data: map[string]string{}})

	// One grandchild
	testTree = append(testTree, &tree.Node{ParentId: 1, Data: map[string]string{}})

	return testTree
}

func TestGenerateMinimap_Simple(t *testing.T) {
	tree := createTestTree()
	rng := NewTestRandom(42)

	result, err := minimap.GenerateMinimap(rng, tree, SingleTile)
	if err != nil {
		t.Fatalf("GenerateMinimap failed: %v", err)
	}

	// Check that we have the expected layers
	if len(result.Layers) != 2 {
		t.Errorf("Expected 2 layers, got %d", len(result.Layers))
	}

	roomLayer := result.Layers[0]
	doorLayer := result.Layers[1]

	// Count unique room IDs in room layer
	roomIds := make(map[uint32]bool)
	for _, tile := range roomLayer.Data {
		if tile != 0 {
			roomIds[tile] = true
		}
	}

	// Should have 4 rooms (one for each node)
	if len(roomIds) != 4 {
		t.Errorf("Expected 4 unique rooms, got %d", len(roomIds))
	}

	// Count total doors
	totalDoors := 0
	for _, doors := range doorLayer.Data {
		// Count set bits
		for i := 0; i < 4; i++ {
			if doors&(1<<i) != 0 {
				totalDoors++
			}
		}
	}

	// Should have doors connecting the rooms
	if totalDoors == 0 {
		t.Error("Expected some doors, got 0")
	}

	t.Logf("Generated minimap: %dx%d with %d rooms and %d doors",
		roomLayer.Width, roomLayer.Height(), len(roomIds), totalDoors)
}

func TestGenerateMinimap_ComplexShapes(t *testing.T) {
	tree := createTestTree()
	rng := NewTestRandom(42)

	result, err := minimap.GenerateMinimap(rng, tree, LShape)
	if err != nil {
		t.Fatalf("GenerateMinimap with L-shapes failed: %v", err)
	}

	// Just verify it doesn't crash and produces output
	if len(result.Layers) != 2 {
		t.Errorf("Expected 2 layers, got %d", len(result.Layers))
	}

	roomLayer := result.Layers[0]
	t.Logf("L-shape minimap: %dx%d", roomLayer.Width, roomLayer.Height())
}

func TestGenerateMinimap_HighBranching(t *testing.T) {
	// Create a tree with root having many children (stress test)
	var testTree tree.Tree

	// Root node
	testTree = append(testTree, &tree.Node{ParentId: -1, Data: map[string]string{}})

	// Add 10 children to root
	for i := 0; i < 10; i++ {
		testTree = append(testTree, &tree.Node{ParentId: 0, Data: map[string]string{}})
	}

	// Add children to first child (so first child needs corridors)
	for i := 0; i < 5; i++ {
		testTree = append(testTree, &tree.Node{ParentId: 1, Data: map[string]string{}})
	}

	rng := NewTestRandom(42)

	result, err := minimap.GenerateMinimap(rng, testTree, SingleTile)
	if err != nil {
		t.Fatalf("GenerateMinimap with high branching failed: %v", err)
	}

	roomLayer := result.Layers[0]

	// Count rooms
	roomIds := make(map[uint32]bool)
	for _, tile := range roomLayer.Data {
		if tile != 0 {
			roomIds[tile] = true
		}
	}

	// Should have 16 rooms (1 root + 10 children + 5 grandchildren)
	expectedRooms := 16
	if len(roomIds) != expectedRooms {
		t.Errorf("Expected %d rooms, got %d", expectedRooms, len(roomIds))
	}

	t.Logf("High branching minimap: %dx%d with %d rooms",
		roomLayer.Width, roomLayer.Height(), len(roomIds))
}

func TestGenerateMinimap_EmptyTree(t *testing.T) {
	var testTree tree.Tree // Empty
	rng := NewTestRandom(42)

	_, err := minimap.GenerateMinimap(rng, testTree, SingleTile)
	if err == nil {
		t.Error("Expected error for empty tree, got nil")
	}
}

// Test connectivity: verify all rooms are reachable
func TestGenerateMinimap_Connectivity(t *testing.T) {
	tree := createTestTree()
	rng := NewTestRandom(42)

	result, err := minimap.GenerateMinimap(rng, tree, SingleTile)
	if err != nil {
		t.Fatalf("GenerateMinimap failed: %v", err)
	}

	if !isConnected(result) {
		t.Error("Generated minimap is not fully connected")
	}
}

// isConnected checks if all rooms in the minimap are reachable from each other
func isConnected(tm *tilemap.TileMap) bool {
	if len(tm.Layers) < 2 {
		return false
	}

	roomLayer := tm.Layers[0]
	doorLayer := tm.Layers[1]
	width := roomLayer.Width
	height := roomLayer.Height()

	// Find all room IDs
	rooms := make(map[uint32]bool)
	for _, tile := range roomLayer.Data {
		if tile != 0 {
			rooms[tile] = true
		}
	}

	if len(rooms) == 0 {
		return true // Empty map is connected
	}

	// Find starting room
	var startRoom uint32
	for room := range rooms {
		startRoom = room
		break
	}

	// BFS from starting room
	visited := make(map[uint32]bool)
	queue := []uint32{startRoom}
	visited[startRoom] = true

	directions := [][2]int{{0, -1}, {1, 0}, {0, 1}, {-1, 0}} // N, E, S, W
	doorBits := []uint32{1, 2, 4, 8}                         // N, E, S, W

	for len(queue) > 0 {
		currentRoom := queue[0]
		queue = queue[1:]

		// Find all tiles of current room and check their doors
		for i, tile := range roomLayer.Data {
			if tile != currentRoom {
				continue
			}

			x := i % width
			y := i / width
			doors := doorLayer.Data[i]

			// Check each door direction
			for j, dir := range directions {
				doorBit := doorBits[j]
				if doors&doorBit == 0 {
					continue // No door in this direction
				}

				// Get adjacent tile
				adjX := x + dir[0]
				adjY := y + dir[1]

				if adjX < 0 || adjX >= width || adjY < 0 || adjY >= height {
					continue
				}

				adjI := adjY*width + adjX
				adjRoom := roomLayer.Data[adjI]

				if adjRoom != 0 && !visited[adjRoom] {
					visited[adjRoom] = true
					queue = append(queue, adjRoom)
				}
			}
		}
	}

	// Check if all rooms were visited
	return len(visited) == len(rooms)
}

func TestGenerateMinimap_Extreme60Children(t *testing.T) {
	// Test the extreme scenario: single tile parent with 60 children
	var testTree tree.Tree

	// Root node (single tile)
	testTree = append(testTree, &tree.Node{ParentId: -1, Data: map[string]string{}})

	// Add 60 children to root
	for i := 0; i < 60; i++ {
		testTree = append(testTree, &tree.Node{ParentId: 0, Data: map[string]string{}})
	}

	rng := NewTestRandom(42)

	result, err := minimap.GenerateMinimap(rng, testTree, SingleTile)
	if err != nil {
		t.Fatalf("GenerateMinimap with 60 children failed: %v", err)
	}

	// Verify connectivity
	if !isConnected(result) {
		t.Error("60-children minimap is not fully connected")
	}

	roomLayer := result.Layers[0]
	doorLayer := result.Layers[1]

	// Count total tiles (should include corridors)
	totalTiles := 0
	for _, tile := range roomLayer.Data {
		if tile != 0 {
			totalTiles++
		}
	}

	// Count doors
	totalDoors := 0
	for _, doors := range doorLayer.Data {
		for i := 0; i < 4; i++ {
			if doors&(1<<i) != 0 {
				totalDoors++
			}
		}
	}

	t.Logf("Extreme 60-children minimap: %dx%d with %d tiles and %d doors",
		roomLayer.Width, roomLayer.Height(), totalTiles, totalDoors)

	// The parent room should have grown significantly with corridors
	if totalTiles < 61 { // At least 61 tiles (1 parent + 60 children)
		t.Errorf("Expected at least 61 tiles, got %d", totalTiles)
	}

	// Should have many doors connecting everything
	if totalDoors < 120 { // At least 60 connections * 2 doors each
		t.Errorf("Expected at least 120 doors, got %d", totalDoors)
	}
}
