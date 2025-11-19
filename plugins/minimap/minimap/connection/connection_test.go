package connection_test

import (
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap/connection"
	"github.com/justgook/gamectl/plugins/minimap/minimap/placement"
	"github.com/justgook/gamectl/plugins/minimap/minimap/roomgen"
)

// MockRandom implements the Random interface for deterministic testing
type MockRandom struct {
	values []int
	floats []float64
	index  int
}

func NewMockRandom(values []int, floats []float64) *MockRandom {
	return &MockRandom{
		values: values,
		floats: floats,
		index:  0,
	}
}

func (m *MockRandom) Intn(n int) int {
	if m.index >= len(m.values) {
		return 0
	}
	val := m.values[m.index] % n
	m.index++
	return val
}

func (m *MockRandom) Float64() float64 {
	if m.index >= len(m.floats) {
		return 0.5
	}
	val := m.floats[m.index]
	m.index++
	return val
}

func createTestTree(nodeCount int) *tree.Tree {
	t := &tree.Tree{}

	// Add root node
	t.Add(-1, map[string]string{"type": "root"})

	// Add child nodes in a simple chain
	for i := 1; i < nodeCount; i++ {
		parentId := i - 1
		t.Add(parentId, map[string]string{"type": "room"})
	}

	return t
}

func createTestRooms() []*placement.PlacedRoom {
	return []*placement.PlacedRoom{
		{
			Room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			Node:   &tree.Node{Data: map[string]string{"type": "root"}, ParentId: -1},
			Placed: true,
		},
		{
			Room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{5, 5}, // Far from parent - needs corridor
				NodeID:   1,
			},
			Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
			Placed: true,
		},
		{
			Room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{1, 0}, // Adjacent to root - no corridor needed
				NodeID:   2,
			},
			Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
			Placed: true,
		},
	}
}

func TestNewConnectionEngine(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	if ce == nil {
		t.Fatal("NewConnectionEngine() returned nil")
	}
}

func TestConnectRooms_EmptyTree(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	emptyTree := &tree.Tree{}
	var rooms []*placement.PlacedRoom

	corridors, err := ce.ConnectRooms(emptyTree, rooms)

	if err != nil {
		t.Errorf("ConnectRooms() with empty tree returned error: %v", err)
	}

	if len(corridors) != 0 {
		t.Errorf("ConnectRooms() with empty tree returned %d corridors, want 0", len(corridors))
	}
}

func TestConnectRooms_SingleRoom(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	singleTree := createTestTree(1)
	rooms := []*placement.PlacedRoom{
		{
			Room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			Node:   &tree.Node{Data: map[string]string{"type": "root"}, ParentId: -1},
			Placed: true,
		},
	}

	corridors, err := ce.ConnectRooms(singleTree, rooms)

	if err != nil {
		t.Errorf("ConnectRooms() with single room returned error: %v", err)
	}

	if len(corridors) != 0 {
		t.Errorf("ConnectRooms() with single room returned %d corridors, want 0", len(corridors))
	}
}

func TestConnectRooms_AdjacentRooms(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	testTree := createTestTree(2)
	rooms := []*placement.PlacedRoom{
		{
			Room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			Node:   &tree.Node{Data: map[string]string{"type": "root"}, ParentId: -1},
			Placed: true,
		},
		{
			Room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{1, 0}, // Adjacent to parent
				NodeID:   1,
			},
			Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
			Placed: true,
		},
	}

	corridors, err := ce.ConnectRooms(testTree, rooms)

	if err != nil {
		t.Errorf("ConnectRooms() with adjacent rooms returned error: %v", err)
	}

	// Should not create corridors for adjacent rooms
	if len(corridors) != 0 {
		t.Errorf("ConnectRooms() with adjacent rooms returned %d corridors, want 0", len(corridors))
	}
}

func TestConnectRooms_DisconnectedRooms(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	testTree := createTestTree(2)
	rooms := []*placement.PlacedRoom{
		{
			Room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			Node:   &tree.Node{Data: map[string]string{"type": "root"}, ParentId: -1},
			Placed: true,
		},
		{
			Room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{5, 5}, // Far from parent
				NodeID:   1,
			},
			Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
			Placed: true,
		},
	}

	// Store original parent room shape length
	originalParentShapeLen := len(rooms[0].Room.Shape)

	corridors, err := ce.ConnectRooms(testTree, rooms)

	if err != nil {
		t.Errorf("ConnectRooms() with disconnected rooms returned error: %v", err)
	}

	// With new algorithm, parent room should be extended to connect to child
	// Check if parent room shape was extended
	if len(rooms[0].Room.Shape) <= originalParentShapeLen {
		t.Errorf("Parent room shape was not extended: %d -> %d tiles",
			originalParentShapeLen, len(rooms[0].Room.Shape))
	}

	// After extension, rooms should be adjacent, so no corridors needed
	// OR if extension wasn't sufficient, a corridor should be created as last resort
	if !roomGen.AreRoomsAdjacent(rooms[0].Room, rooms[1].Room) && len(corridors) == 0 {
		t.Error("Rooms are not adjacent and no corridor was created")
	}

	// If a corridor was created, validate it
	if len(corridors) > 0 {
		corridor := corridors[0]
		if corridor.FromRoom != 1 || corridor.ToRoom != 0 {
			t.Errorf("ConnectRooms() corridor connects %d->%d, want 1->0",
				corridor.FromRoom, corridor.ToRoom)
		}

		if len(corridor.Tiles) == 0 {
			t.Error("ConnectRooms() corridor has no tiles")
		}
	}
}

func TestConnectRooms_MultipleRooms(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	testTree := createTestTree(3)
	rooms := createTestRooms()

	// Store original room shapes to verify extensions
	originalShapes := make([]int, len(rooms))
	for i, room := range rooms {
		originalShapes[i] = len(room.Room.Shape)
	}

	corridors, err := ce.ConnectRooms(testTree, rooms)

	if err != nil {
		t.Errorf("ConnectRooms() returned error: %v", err)
	}

	// Validate direct parent-child adjacency for each child
	for _, room := range rooms {
		if room.Node.ParentId >= 0 {
			// Find parent room
			var parentRoom *placement.PlacedRoom
			for _, r := range rooms {
				if r.Room.NodeID == room.Node.ParentId {
					parentRoom = r
					break
				}
			}

			if parentRoom != nil {
				// Each child must be directly adjacent to its specific parent
				if !roomGen.AreRoomsAdjacent(room.Room, parentRoom.Room) {
					// If not adjacent, there should be a corridor connecting them
					corridorExists := false
					for _, corridor := range corridors {
						if (corridor.FromRoom == room.Room.NodeID && corridor.ToRoom == parentRoom.Room.NodeID) ||
							(corridor.FromRoom == parentRoom.Room.NodeID && corridor.ToRoom == room.Room.NodeID) {
							corridorExists = true
							break
						}
					}
					if !corridorExists {
						t.Errorf("Room %d is not adjacent to its parent %d and no corridor exists",
							room.Room.NodeID, parentRoom.Room.NodeID)
					}
				}
			}
		}
	}

	// Check that parent room shapes were extended when needed
	// Room 0 (parent) should have been extended to connect to room 1 (far away)
	if len(rooms[0].Room.Shape) <= originalShapes[0] {
		// If parent wasn't extended, there should be a corridor to the distant child
		hasCorridorToDistantChild := false
		for _, corridor := range corridors {
			if (corridor.FromRoom == 0 && corridor.ToRoom == 1) ||
				(corridor.FromRoom == 1 && corridor.ToRoom == 0) {
				hasCorridorToDistantChild = true
				break
			}
		}
		if !hasCorridorToDistantChild && !roomGen.AreRoomsAdjacent(rooms[0].Room, rooms[1].Room) {
			t.Error("Parent room was not extended and no corridor exists to distant child")
		}
	}
}

func TestValidateConnections(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	testTree := createTestTree(3)
	rooms := createTestRooms()

	corridors, err := ce.ConnectRooms(testTree, rooms)
	if err != nil {
		t.Fatalf("ConnectRooms() returned error: %v", err)
	}

	validation := ce.ValidateConnections(testTree, rooms, corridors)

	// Check required validation metrics
	requiredMetrics := []string{"totalParentChildPairs", "connectedPairs", "connectionRate", "totalCorridors"}
	for _, metric := range requiredMetrics {
		if _, exists := validation[metric]; !exists {
			t.Errorf("ValidateConnections() missing metric: %s", metric)
		}
	}

	// Check values
	totalPairs := validation["totalParentChildPairs"].(int)
	connectedPairs := validation["connectedPairs"].(int)
	connectionRate := validation["connectionRate"].(float64)
	totalCorridors := validation["totalCorridors"].(int)

	if totalPairs != 2 { // 3 nodes - 1 root = 2 parent-child pairs
		t.Errorf("ValidateConnections() totalParentChildPairs = %d, want 2", totalPairs)
	}

	if connectedPairs < 0 || connectedPairs > totalPairs {
		t.Errorf("ValidateConnections() connectedPairs = %d, should be between 0 and %d",
			connectedPairs, totalPairs)
	}

	if connectionRate < 0 || connectionRate > 1 {
		t.Errorf("ValidateConnections() connectionRate = %f, should be between 0 and 1", connectionRate)
	}

	if totalCorridors != len(corridors) {
		t.Errorf("ValidateConnections() totalCorridors = %d, want %d", totalCorridors, len(corridors))
	}
}

func TestCreateLShapedPath(t *testing.T) {
	tests := []struct {
		name           string
		start          [2]int
		end            [2]int
		mockFloat      float64
		expectExtended bool // Whether parent room should be extended
		expectCorridor bool // Whether a corridor should be created as fallback
	}{
		{
			name:           "distant rooms - should extend parent",
			start:          [2]int{0, 0},
			end:            [2]int{10, 10}, // Far enough to require extension/corridor
			mockFloat:      0.3,
			expectExtended: true,
			expectCorridor: false, // Extension should make corridor unnecessary
		},
		{
			name:           "very distant rooms - extension should handle it",
			start:          [2]int{0, 0},
			end:            [2]int{20, 20}, // Very far - but extension should handle it
			mockFloat:      0.7,
			expectExtended: true,
			expectCorridor: false, // Extension should be sufficient
		},
		{
			name:           "same point - no connection needed",
			start:          [2]int{5, 5},
			end:            [2]int{5, 5},
			mockFloat:      0.5,
			expectExtended: false,
			expectCorridor: false,
		},
		{
			name:           "adjacent positions - no connection needed",
			start:          [2]int{0, 0},
			end:            [2]int{1, 0}, // Adjacent
			mockFloat:      0.3,
			expectExtended: false,
			expectCorridor: false,
		},
		{
			name:           "moderate distance - should extend parent",
			start:          [2]int{5, 0},
			end:            [2]int{5, 8},
			mockFloat:      0.7,
			expectExtended: true,
			expectCorridor: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rng := NewMockRandom(nil, []float64{tt.mockFloat})
			roomGen := roomgen.NewRoomGenerator(rng)
			ce := connection.NewConnectionEngine(roomGen, rng)

			testTree := createTestTree(2)
			testRooms := []*placement.PlacedRoom{
				{
					Room: &roomgen.Room{
						Shape:    roomgen.RoomShape{{0, 0}},
						Position: tt.start,
						NodeID:   0,
					},
					Node:   &tree.Node{Data: map[string]string{"type": "root"}, ParentId: -1},
					Placed: true,
				},
				{
					Room: &roomgen.Room{
						Shape:    roomgen.RoomShape{{0, 0}},
						Position: tt.end,
						NodeID:   1,
					},
					Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
					Placed: true,
				},
			}

			originalParentShapeLen := len(testRooms[0].Room.Shape)

			corridors, err := ce.ConnectRooms(testTree, testRooms)
			if err != nil {
				t.Fatalf("ConnectRooms() returned error: %v", err)
			}

			// Check if parent room was extended as expected
			parentExtended := len(testRooms[0].Room.Shape) > originalParentShapeLen
			if tt.expectExtended && !parentExtended {
				t.Errorf("Expected parent room to be extended, but it wasn't")
			}

			// Check corridor creation
			corridorCreated := len(corridors) > 0
			if tt.expectCorridor && !corridorCreated {
				t.Errorf("Expected corridor to be created, but none was")
			}

			// Most importantly: ensure rooms are connected somehow (unless same position)
			if tt.start != tt.end {
				if !roomGen.AreRoomsAdjacent(testRooms[0].Room, testRooms[1].Room) {
					// If rooms aren't adjacent, there must be a corridor
					if !corridorCreated {
						t.Error("Rooms are not adjacent and no corridor was created")
					}
				}
			}

			// Validate corridor if created
			if corridorCreated {
				corridor := corridors[0]
				// For same position, corridor might be created but empty
				if tt.start != tt.end && len(corridor.Tiles) == 0 {
					t.Error("Corridor was created but has no tiles")
				}
				if corridor.FromRoom != 1 || corridor.ToRoom != 0 {
					t.Errorf("Corridor connects %d->%d, want 1->0", corridor.FromRoom, corridor.ToRoom)
				}
			}
		})
	}
}

func TestExtendRoomForConnection(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	room := &placement.PlacedRoom{
		Room: &roomgen.Room{
			Shape:    roomgen.RoomShape{{0, 0}, {1, 0}},
			Position: [2]int{0, 0},
			NodeID:   0,
		},
		Node:   &tree.Node{Data: map[string]string{"type": "room"}},
		Placed: true,
	}

	originalShapeLen := len(room.Shape)
	targetTile := [2]int{5, 5}

	ce.ExtendRoomForConnection(room, targetTile)

	// Room shape should be extended
	if len(room.Shape) <= originalShapeLen {
		t.Errorf("ExtendRoomForConnection() did not extend room shape: %d -> %d",
			originalShapeLen, len(room.Shape))
	}
}

func TestExtendParentToConnectChild(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	parent := &placement.PlacedRoom{
		Room: &roomgen.Room{
			Shape:    roomgen.RoomShape{{0, 0}},
			Position: [2]int{0, 0},
			NodeID:   0,
		},
		Node:   &tree.Node{Data: map[string]string{"type": "root"}, ParentId: -1},
		Placed: true,
	}

	child := &placement.PlacedRoom{
		Room: &roomgen.Room{
			Shape:    roomgen.RoomShape{{0, 0}},
			Position: [2]int{3, 3},
			NodeID:   1,
		},
		Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
		Placed: true,
	}

	originalParentShapeLen := len(parent.Room.Shape)

	// Verify they're not initially adjacent
	if roomGen.AreRoomsAdjacent(parent.Room, child.Room) {
		t.Fatal("Rooms are initially adjacent, test setup is invalid")
	}

	ce.ExtendParentToConnectChild(parent, child)

	// Parent shape should be extended
	if len(parent.Room.Shape) <= originalParentShapeLen {
		t.Errorf("ExtendParentToConnectChild() did not extend parent shape: %d -> %d",
			originalParentShapeLen, len(parent.Room.Shape))
	}

	// After extension, rooms should be adjacent
	if !roomGen.AreRoomsAdjacent(parent.Room, child.Room) {
		t.Error("Rooms are not adjacent after parent extension")
	}

	// Child shape should remain unchanged
	if len(child.Room.Shape) != 1 {
		t.Errorf("Child room shape was modified: expected 1 tile, got %d", len(child.Room.Shape))
	}
}

// Edge case tests
func TestConnectRooms_EdgeCases(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	t.Run("orphaned nodes", func(t *testing.T) {
		// Tree with invalid parent references
		invalidTree := &tree.Tree{}
		invalidTree.Add(-1, map[string]string{"type": "root"})
		invalidTree.Add(99, map[string]string{"type": "orphan"}) // Invalid parent

		rooms := []*placement.PlacedRoom{
			{
				Room: &roomgen.Room{
					Shape:    roomgen.RoomShape{{0, 0}},
					Position: [2]int{0, 0},
					NodeID:   0,
				},
				Node:   &tree.Node{Data: map[string]string{"type": "root"}, ParentId: -1},
				Placed: true,
			},
			{
				Room: &roomgen.Room{
					Shape:    roomgen.RoomShape{{0, 0}},
					Position: [2]int{5, 5},
					NodeID:   1,
				},
				Node:   &tree.Node{Data: map[string]string{"type": "orphan"}, ParentId: 99},
				Placed: true,
			},
		}

		corridors, err := ce.ConnectRooms(invalidTree, rooms)
		if err != nil {
			t.Errorf("ConnectRooms() with orphaned nodes returned error: %v", err)
		}

		// Should not create corridors for orphaned nodes
		if len(corridors) != 0 {
			t.Errorf("ConnectRooms() with orphaned nodes returned %d corridors, want 0", len(corridors))
		}
	})

	t.Run("missing parent room", func(t *testing.T) {
		testTree := createTestTree(2)

		// Only provide child room, not parent
		rooms := []*placement.PlacedRoom{
			{
				Room: &roomgen.Room{
					Shape:    roomgen.RoomShape{{0, 0}},
					Position: [2]int{5, 5},
					NodeID:   1,
				},
				Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
				Placed: true,
			},
		}

		corridors, err := ce.ConnectRooms(testTree, rooms)
		if err != nil {
			t.Errorf("ConnectRooms() with missing parent returned error: %v", err)
		}

		// Should not create corridors when parent is missing
		if len(corridors) != 0 {
			t.Errorf("ConnectRooms() with missing parent returned %d corridors, want 0", len(corridors))
		}
	})
}

// Test tree structure preservation - new behavior tests
func TestTreeStructurePreservation(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	t.Run("parent extension prioritized over corridors", func(t *testing.T) {
		testTree := createTestTree(3)
		rooms := []*placement.PlacedRoom{
			{
				Room: &roomgen.Room{
					Shape:    roomgen.RoomShape{{0, 0}},
					Position: [2]int{0, 0},
					NodeID:   0,
				},
				Node:   &tree.Node{Data: map[string]string{"type": "root"}, ParentId: -1},
				Placed: true,
			},
			{
				Room: &roomgen.Room{
					Shape:    roomgen.RoomShape{{0, 0}},
					Position: [2]int{3, 0}, // Moderately far from parent
					NodeID:   1,
				},
				Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
				Placed: true,
			},
			{
				Room: &roomgen.Room{
					Shape:    roomgen.RoomShape{{0, 0}},
					Position: [2]int{0, 3}, // Moderately far from parent
					NodeID:   2,
				},
				Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
				Placed: true,
			},
		}

		originalParentShapeLen := len(rooms[0].Room.Shape)

		corridors, err := ce.ConnectRooms(testTree, rooms)
		if err != nil {
			t.Fatalf("ConnectRooms() returned error: %v", err)
		}

		// Parent room should be extended to connect to children
		if len(rooms[0].Room.Shape) <= originalParentShapeLen {
			t.Error("Parent room shape was not extended to connect to children")
		}

		// All children should be connected to their specific parent
		for i := 1; i < len(rooms); i++ {
			child := rooms[i]
			parent := rooms[0] // All children have parent 0

			if !roomGen.AreRoomsAdjacent(child.Room, parent.Room) {
				// If not adjacent, there should be a corridor
				corridorExists := false
				for _, corridor := range corridors {
					if (corridor.FromRoom == child.Room.NodeID && corridor.ToRoom == parent.Room.NodeID) ||
						(corridor.FromRoom == parent.Room.NodeID && corridor.ToRoom == child.Room.NodeID) {
						corridorExists = true
						break
					}
				}
				if !corridorExists {
					t.Errorf("Child room %d is not connected to parent %d", child.Room.NodeID, parent.Room.NodeID)
				}
			}
		}
	})

	t.Run("direct parent-child adjacency enforced", func(t *testing.T) {
		// Create a tree where child should connect to specific parent, not just any room
		testTree := &tree.Tree{}
		testTree.Add(-1, map[string]string{"type": "root"}) // Node 0
		testTree.Add(0, map[string]string{"type": "room"})  // Node 1, parent 0
		testTree.Add(1, map[string]string{"type": "room"})  // Node 2, parent 1

		rooms := []*placement.PlacedRoom{
			{
				Room: &roomgen.Room{
					Shape:    roomgen.RoomShape{{0, 0}},
					Position: [2]int{0, 0},
					NodeID:   0,
				},
				Node:   &tree.Node{Data: map[string]string{"type": "root"}, ParentId: -1},
				Placed: true,
			},
			{
				Room: &roomgen.Room{
					Shape:    roomgen.RoomShape{{0, 0}},
					Position: [2]int{1, 0}, // Adjacent to root
					NodeID:   1,
				},
				Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 0},
				Placed: true,
			},
			{
				Room: &roomgen.Room{
					Shape:    roomgen.RoomShape{{0, 0}},
					Position: [2]int{5, 5}, // Far from both, but should connect to parent 1
					NodeID:   2,
				},
				Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: 1},
				Placed: true,
			},
		}

		corridors, err := ce.ConnectRooms(testTree, rooms)
		if err != nil {
			t.Fatalf("ConnectRooms() returned error: %v", err)
		}

		// Node 2 should be connected to its parent (node 1), not the root (node 0)
		// even though root might be closer
		node2Connected := false
		for _, corridor := range corridors {
			if (corridor.FromRoom == 2 && corridor.ToRoom == 1) ||
				(corridor.FromRoom == 1 && corridor.ToRoom == 2) {
				node2Connected = true
				break
			}
		}

		// Check if rooms are adjacent or connected via corridor
		if !roomGen.AreRoomsAdjacent(rooms[2].Room, rooms[1].Room) && !node2Connected {
			t.Error("Node 2 is not connected to its specific parent (node 1)")
		}

		// Verify node 2 is NOT directly connected to root (node 0) via corridor
		node2ConnectedToRoot := false
		for _, corridor := range corridors {
			if (corridor.FromRoom == 2 && corridor.ToRoom == 0) ||
				(corridor.FromRoom == 0 && corridor.ToRoom == 2) {
				node2ConnectedToRoot = true
				break
			}
		}

		if node2ConnectedToRoot {
			t.Error("Node 2 should not be directly connected to root, only to its parent")
		}
	})
}

// Performance benchmarks
func BenchmarkConnectRooms_Small(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	testTree := createTestTree(10)

	// Create rooms that need connections
	rooms := make([]*placement.PlacedRoom, 10)
	for i := 0; i < 10; i++ {
		parentId := i - 1
		if i == 0 {
			parentId = -1
		}

		rooms[i] = &placement.PlacedRoom{
			Room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{i * 3, i * 3}, // Spread out to need corridors
				NodeID:   i,
			},
			Node:   &tree.Node{Data: map[string]string{"type": "room"}, ParentId: parentId},
			Placed: true,
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := ce.ConnectRooms(testTree, rooms)
		if err != nil {
			b.Fatalf("ConnectRooms() returned error: %v", err)
		}
	}
}

func BenchmarkValidateConnections(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	ce := connection.NewConnectionEngine(roomGen, rng)

	testTree := createTestTree(100)
	rooms := createTestRooms()
	corridors, err := ce.ConnectRooms(testTree, rooms)
	if err != nil {
		b.Fatalf("ConnectRooms() returned error: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ce.ValidateConnections(testTree, rooms, corridors)
	}
}
