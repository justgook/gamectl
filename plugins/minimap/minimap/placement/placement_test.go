package placement_test

import (
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
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

func createBinaryTree(depth int) *tree.Tree {
	t := &tree.Tree{}

	// Add root
	t.Add(-1, map[string]string{"type": "root"})

	// Add nodes level by level to create a binary tree
	for level := 1; level < depth; level++ {
		// For each existing node at the previous level, add up to 2 children
		currentLevelStart := (1 << (level - 1)) - 1
		currentLevelEnd := (1 << level) - 1

		for parentIdx := currentLevelStart; parentIdx < currentLevelEnd && parentIdx < len(*t); parentIdx++ {
			// Add left child
			t.Add(parentIdx, map[string]string{"type": "room"})
			// Add right child
			t.Add(parentIdx, map[string]string{"type": "room"})
		}
	}

	return t
}

func TestNewGrid(t *testing.T) {
	grid := placement.NewGrid()

	if grid == nil {
		t.Fatal("NewGrid() returned nil")
	}

	minX, minY, maxX, maxY := grid.GetBounds()
	if minX != 0 || minY != 0 || maxX != 0 || maxY != 0 {
		t.Errorf("NewGrid() bounds = (%d,%d,%d,%d), want (0,0,0,0)", minX, minY, maxX, maxY)
	}

	if len(grid.GetAllRooms()) != 0 {
		t.Errorf("NewGrid() room count = %d, want 0", len(grid.GetAllRooms()))
	}
}

func TestNewPlacementEngine(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	pe := placement.NewPlacementEngine(roomGen, rng)

	if pe == nil {
		t.Fatal("NewPlacementEngine() returned nil")
	}
}

func TestPlaceTree_EmptyTree(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	pe := placement.NewPlacementEngine(roomGen, rng)

	emptyTree := &tree.Tree{}
	rooms, err := pe.PlaceTree(emptyTree)

	if err != nil {
		t.Errorf("PlaceTree() with empty tree returned error: %v", err)
	}

	if rooms != nil {
		t.Errorf("PlaceTree() with empty tree returned rooms: %v, want nil", rooms)
	}
}

func TestPlaceTree_SingleNode(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	pe := placement.NewPlacementEngine(roomGen, rng)

	singleTree := createTestTree(1)
	rooms, err := pe.PlaceTree(singleTree)

	if err != nil {
		t.Fatalf("PlaceTree() with single node returned error: %v", err)
	}

	if len(rooms) != 1 {
		t.Errorf("PlaceTree() room count = %d, want 1", len(rooms))
	}

	if !rooms[0].Placed {
		t.Error("PlaceTree() root room not marked as placed")
	}

	// Root should be at origin
	if rooms[0].Position != [2]int{0, 0} {
		t.Errorf("PlaceTree() root position = %v, want [0, 0]", rooms[0].Position)
	}
}

func TestPlaceTree_LinearChain(t *testing.T) {
	tests := []struct {
		name      string
		nodeCount int
	}{
		{"2 nodes", 2},
		{"3 nodes", 3},
		{"5 nodes", 5},
		{"10 nodes", 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rng := rand.New(rand.NewSource(42))
			roomGen := roomgen.NewRoomGenerator(rng)
			pe := placement.NewPlacementEngine(roomGen, rng)

			chainTree := createTestTree(tt.nodeCount)
			rooms, err := pe.PlaceTree(chainTree)

			if err != nil {
				t.Fatalf("PlaceTree() returned error: %v", err)
			}

			if len(rooms) != tt.nodeCount {
				t.Errorf("PlaceTree() room count = %d, want %d", len(rooms), tt.nodeCount)
			}

			// All rooms should be placed
			for i, room := range rooms {
				if !room.Placed {
					t.Errorf("Room %d not marked as placed", i)
				}
			}

			// Validate no overlaps
			for i := 0; i < len(rooms); i++ {
				for j := i + 1; j < len(rooms); j++ {
					if roomGen.DoesRoomOverlap(rooms[i].Room, rooms[j].Room) {
						t.Errorf("Rooms %d and %d overlap", i, j)
					}
				}
			}
		})
	}
}

func TestPlaceTree_BinaryTree(t *testing.T) {
	tests := []struct {
		name  string
		depth int
	}{
		{"depth 2", 2},
		{"depth 3", 3},
		{"depth 4", 4},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rng := rand.New(rand.NewSource(42))
			roomGen := roomgen.NewRoomGenerator(rng)
			pe := placement.NewPlacementEngine(roomGen, rng)

			binaryTree := createBinaryTree(tt.depth)
			rooms, err := pe.PlaceTree(binaryTree)

			if err != nil {
				t.Fatalf("PlaceTree() returned error: %v", err)
			}

			expectedNodes := (1 << tt.depth) - 1 // 2^depth - 1
			if len(rooms) != expectedNodes {
				t.Errorf("PlaceTree() room count = %d, want %d", len(rooms), expectedNodes)
			}

			// All rooms should be placed
			for i, room := range rooms {
				if !room.Placed {
					t.Errorf("Room %d not marked as placed", i)
				}
			}

			// Validate no overlaps
			for i := 0; i < len(rooms); i++ {
				for j := i + 1; j < len(rooms); j++ {
					if roomGen.DoesRoomOverlap(rooms[i].Room, rooms[j].Room) {
						t.Errorf("Rooms %d and %d overlap", i, j)
					}
				}
			}
		})
	}
}

func TestGetPlacementStats(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	pe := placement.NewPlacementEngine(roomGen, rng)

	testTree := createTestTree(5)
	_, err := pe.PlaceTree(testTree)
	if err != nil {
		t.Fatalf("PlaceTree() returned error: %v", err)
	}

	stats := pe.GetPlacementStats()

	// Check that required stats are present
	requiredStats := []string{"gridWidth", "gridHeight", "totalRooms", "gridArea", "roomDensity"}
	for _, stat := range requiredStats {
		if _, exists := stats[stat]; !exists {
			t.Errorf("GetPlacementStats() missing stat: %s", stat)
		}
	}

	// Check that values are reasonable
	if stats["totalRooms"].(int) != 5 {
		t.Errorf("GetPlacementStats() totalRooms = %v, want 5", stats["totalRooms"])
	}

	if stats["gridWidth"].(int) <= 0 || stats["gridHeight"].(int) <= 0 {
		t.Errorf("GetPlacementStats() invalid grid dimensions: %dx%d",
			stats["gridWidth"], stats["gridHeight"])
	}

	density := stats["roomDensity"].(float64)
	if density <= 0 || density > 1 {
		t.Errorf("GetPlacementStats() invalid room density: %f", density)
	}
}

func TestValidatePlacement(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	pe := placement.NewPlacementEngine(roomGen, rng)

	testTree := createTestTree(5)
	_, err := pe.PlaceTree(testTree)
	if err != nil {
		t.Fatalf("PlaceTree() returned error: %v", err)
	}

	validation := pe.ValidatePlacement(testTree)

	// Check that required validation metrics are present
	requiredMetrics := []string{"totalParentChildPairs", "connectedPairs", "connectionRate"}
	for _, metric := range requiredMetrics {
		if _, exists := validation[metric]; !exists {
			t.Errorf("ValidatePlacement() missing metric: %s", metric)
		}
	}

	// Check that values are reasonable
	totalPairs := validation["totalParentChildPairs"].(int)
	connectedPairs := validation["connectedPairs"].(int)
	connectionRate := validation["connectionRate"].(float64)

	if totalPairs != 4 { // 5 nodes - 1 root = 4 parent-child pairs
		t.Errorf("ValidatePlacement() totalParentChildPairs = %d, want 4", totalPairs)
	}

	if connectedPairs < 0 || connectedPairs > totalPairs {
		t.Errorf("ValidatePlacement() connectedPairs = %d, should be between 0 and %d",
			connectedPairs, totalPairs)
	}

	if connectionRate < 0 || connectionRate > 1 {
		t.Errorf("ValidatePlacement() connectionRate = %f, should be between 0 and 1", connectionRate)
	}
}

func TestGrid_AddRoom(t *testing.T) {
	// Test through PlaceTree which calls addRoom internally
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	pe := placement.NewPlacementEngine(roomGen, rng)

	testTree := createTestTree(1)
	rooms, err := pe.PlaceTree(testTree)
	if err != nil {
		t.Fatalf("PlaceTree() returned error: %v", err)
	}

	if len(rooms) != 1 {
		t.Errorf("Expected 1 room, got %d", len(rooms))
	}
}

func TestGrid_GetRoomAt(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	pe := placement.NewPlacementEngine(roomGen, rng)

	testTree := createTestTree(1)
	_, err := pe.PlaceTree(testTree)
	if err != nil {
		t.Fatalf("PlaceTree() returned error: %v", err)
	}

	// Test through the placement engine's grid
	stats := pe.GetPlacementStats()
	if stats["totalRooms"].(int) != 1 {
		t.Errorf("Expected 1 room in grid, got %d", stats["totalRooms"])
	}
}

// Edge case tests
func TestPlaceTree_EdgeCases(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	pe := placement.NewPlacementEngine(roomGen, rng)

	t.Run("nil tree", func(t *testing.T) {
		// This would panic, so we skip it or handle it in the implementation
		// rooms, err := pe.PlaceTree(nil)
		// We expect this to be handled gracefully
	})

	t.Run("tree with orphaned nodes", func(t *testing.T) {
		// Create a tree with invalid parent references
		invalidTree := &tree.Tree{}
		invalidTree.Add(-1, map[string]string{"type": "root"})
		invalidTree.Add(99, map[string]string{"type": "orphan"}) // Invalid parent

		rooms, err := pe.PlaceTree(invalidTree)
		if err != nil {
			t.Errorf("PlaceTree() with orphaned nodes returned error: %v", err)
		}

		// Should still place the root
		if len(rooms) < 1 {
			t.Errorf("PlaceTree() should place at least the root node")
		}
	})
}

// Performance benchmarks
func BenchmarkPlaceTree_Small(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)

	testTree := createTestTree(10)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		pe := placement.NewPlacementEngine(roomGen, rng)
		_, err := pe.PlaceTree(testTree)
		if err != nil {
			b.Fatalf("PlaceTree() returned error: %v", err)
		}
	}
}

func BenchmarkPlaceTree_Medium(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)

	testTree := createTestTree(100)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		pe := placement.NewPlacementEngine(roomGen, rng)
		_, err := pe.PlaceTree(testTree)
		if err != nil {
			b.Fatalf("PlaceTree() returned error: %v", err)
		}
	}
}

func BenchmarkPlaceTree_Large(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)

	testTree := createTestTree(1000)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		pe := placement.NewPlacementEngine(roomGen, rng)
		_, err := pe.PlaceTree(testTree)
		if err != nil {
			b.Fatalf("PlaceTree() returned error: %v", err)
		}
	}
}

func BenchmarkValidatePlacement(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	roomGen := roomgen.NewRoomGenerator(rng)
	pe := placement.NewPlacementEngine(roomGen, rng)

	testTree := createTestTree(100)
	_, err := pe.PlaceTree(testTree)
	if err != nil {
		b.Fatalf("PlaceTree() returned error: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		pe.ValidatePlacement(testTree)
	}
}
