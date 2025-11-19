package converter_test

import (
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap/connection"
	"github.com/justgook/gamectl/plugins/minimap/minimap/converter"
	"github.com/justgook/gamectl/plugins/minimap/minimap/placement"
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

func createBranchedTree() *tree.Tree {
	t := &tree.Tree{}

	// Root
	t.Add(-1, map[string]string{"type": "root"})

	// Multiple children from root
	for i := 0; i < 5; i++ {
		t.Add(0, map[string]string{"type": "room"})
	}

	// Some grandchildren
	t.Add(1, map[string]string{"type": "room"})
	t.Add(2, map[string]string{"type": "room"})
	t.Add(3, map[string]string{"type": "room"})

	return t
}

func TestNewTreeToTilemapConverter(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	converter := converter.NewTreeToTilemapConverter(rng)

	if converter == nil {
		t.Fatal("NewTreeToTilemapConverter() returned nil")
	}
}

func TestConvert_EmptyTree(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	conv := converter.NewTreeToTilemapConverter(rng)

	emptyTree := &tree.Tree{}
	result, err := conv.Convert(emptyTree)

	if err == nil {
		t.Error("Convert() with empty tree should return error")
	}

	if result != nil {
		t.Error("Convert() with empty tree should return nil result")
	}
}

func TestConvert_SingleNode(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	conv := converter.NewTreeToTilemapConverter(rng)

	singleTree := createTestTree(1)
	result, err := conv.Convert(singleTree)

	if err != nil {
		t.Fatalf("Convert() with single node returned error: %v", err)
	}

	if result == nil {
		t.Fatal("Convert() returned nil result")
	}

	// Check basic structure
	if len(result.Rooms) != 1 {
		t.Errorf("Convert() room count = %d, want 1", len(result.Rooms))
	}

	if len(result.Corridors) != 0 {
		t.Errorf("Convert() corridor count = %d, want 0", len(result.Corridors))
	}

	if result.Tilemap == nil {
		t.Error("Convert() tilemap is nil")
	}

	if result.Stats == nil {
		t.Error("Convert() stats is nil")
	}

	if result.Validation == nil {
		t.Error("Convert() validation is nil")
	}
}

func TestConvert_LinearChain(t *testing.T) {
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
			conv := converter.NewTreeToTilemapConverter(rng)

			chainTree := createTestTree(tt.nodeCount)
			result, err := conv.Convert(chainTree)

			if err != nil {
				t.Fatalf("Convert() returned error: %v", err)
			}

			// Check room count
			if len(result.Rooms) != tt.nodeCount {
				t.Errorf("Convert() room count = %d, want %d", len(result.Rooms), tt.nodeCount)
			}

			// Check tilemap structure
			if len(result.Tilemap.Layers) == 0 {
				t.Error("Convert() tilemap has no layers")
			}

			layer := result.Tilemap.Layers[0]
			if layer.Width <= 0 || layer.Height() <= 0 {
				t.Errorf("Convert() invalid tilemap dimensions: %dx%d", layer.Width, layer.Height())
			}

			// Check that tilemap contains room tiles
			nonEmptyTiles := 0
			for _, tileID := range layer.Data {
				if tileID != 0 {
					nonEmptyTiles++
				}
			}

			if nonEmptyTiles == 0 {
				t.Error("Convert() tilemap has no room tiles")
			}

			// Check metadata
			if result.Tilemap.Meta["generator"] != "tree-to-tilemap" {
				t.Errorf("Convert() missing or incorrect generator metadata")
			}
		})
	}
}

func TestConvert_BinaryTree(t *testing.T) {
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
			conv := converter.NewTreeToTilemapConverter(rng)

			binaryTree := createBinaryTree(tt.depth)
			result, err := conv.Convert(binaryTree)

			if err != nil {
				t.Fatalf("Convert() returned error: %v", err)
			}

			expectedNodes := (1 << tt.depth) - 1 // 2^depth - 1
			if len(result.Rooms) != expectedNodes {
				t.Errorf("Convert() room count = %d, want %d", len(result.Rooms), expectedNodes)
			}

			// Check that all rooms are placed
			for i, room := range result.Rooms {
				if !room.Placed {
					t.Errorf("Room %d not marked as placed", i)
				}
			}
		})
	}
}

func TestConvert_BranchedTree(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	conv := converter.NewTreeToTilemapConverter(rng)

	branchedTree := createBranchedTree()
	result, err := conv.Convert(branchedTree)

	if err != nil {
		t.Fatalf("Convert() returned error: %v", err)
	}

	// Should have root + 5 children + 3 grandchildren = 9 rooms
	expectedRooms := 9
	if len(result.Rooms) != expectedRooms {
		t.Errorf("Convert() room count = %d, want %d", len(result.Rooms), expectedRooms)
	}

	// Check validation metrics
	if result.Validation["totalParentChildPairs"].(int) != 8 { // 9 nodes - 1 root
		t.Errorf("Convert() wrong parent-child pair count: %v", result.Validation["totalParentChildPairs"])
	}
}

func TestConvert_ValidationMetrics(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	conv := converter.NewTreeToTilemapConverter(rng)

	testTree := createTestTree(5)
	result, err := conv.Convert(testTree)

	if err != nil {
		t.Fatalf("Convert() returned error: %v", err)
	}

	// Check validation metrics
	validation := result.Validation
	requiredMetrics := []string{"totalParentChildPairs", "connectedPairs", "connectionRate", "totalCorridors"}

	for _, metric := range requiredMetrics {
		if _, exists := validation[metric]; !exists {
			t.Errorf("Convert() validation missing metric: %s", metric)
		}
	}

	// Check stats
	stats := result.Stats
	requiredStats := []string{"gridWidth", "gridHeight", "totalRooms", "gridArea", "roomDensity"}

	for _, stat := range requiredStats {
		if _, exists := stats[stat]; !exists {
			t.Errorf("Convert() stats missing metric: %s", stat)
		}
	}
}

func TestConvert_TilemapStructure(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	conv := converter.NewTreeToTilemapConverter(rng)

	testTree := createTestTree(3)
	result, err := conv.Convert(testTree)

	if err != nil {
		t.Fatalf("Convert() returned error: %v", err)
	}

	tilemap := result.Tilemap

	// Check tilemap structure
	if len(tilemap.Layers) != 1 {
		t.Errorf("Convert() tilemap layer count = %d, want 1", len(tilemap.Layers))
	}

	layer := tilemap.Layers[0]

	// Check layer metadata
	if layer.Meta["name"] != "rooms" {
		t.Errorf("Convert() layer name = %s, want 'rooms'", layer.Meta["name"])
	}

	if layer.Meta["type"] != "room_layer" {
		t.Errorf("Convert() layer type = %s, want 'room_layer'", layer.Meta["type"])
	}

	// Check that data array size matches width * height
	expectedSize := layer.Width * layer.Height()
	if len(layer.Data) != expectedSize {
		t.Errorf("Convert() layer data size = %d, want %d", len(layer.Data), expectedSize)
	}

	// Check that room tiles are properly placed
	roomTileCount := 0
	corridorTileCount := 0
	emptyTileCount := 0

	for _, tileID := range layer.Data {
		if tileID == 0 {
			emptyTileCount++
		} else if int(tileID) <= len(result.Rooms) {
			roomTileCount++
		} else {
			corridorTileCount++
		}
	}

	if roomTileCount == 0 {
		t.Error("Convert() tilemap has no room tiles")
	}

	// Should have at least as many room tiles as rooms (each room has at least 1 tile)
	if roomTileCount < len(result.Rooms) {
		t.Errorf("Convert() room tile count %d < room count %d", roomTileCount, len(result.Rooms))
	}
}

func TestConvert_NoOverlaps(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	conv := converter.NewTreeToTilemapConverter(rng)

	testTree := createTestTree(10)
	result, err := conv.Convert(testTree)

	if err != nil {
		t.Fatalf("Convert() returned error: %v", err)
	}

	// Check that no rooms overlap
	for i := 0; i < len(result.Rooms); i++ {
		for j := i + 1; j < len(result.Rooms); j++ {
			room1 := result.Rooms[i]
			room2 := result.Rooms[j]

			// Get room tiles
			tiles1 := make(map[[2]int]bool)
			for _, tile := range room1.Shape {
				pos := [2]int{room1.Position[0] + tile[0], room1.Position[1] + tile[1]}
				tiles1[pos] = true
			}

			overlap := false
			for _, tile := range room2.Shape {
				pos := [2]int{room2.Position[0] + tile[0], room2.Position[1] + tile[1]}
				if tiles1[pos] {
					overlap = true
					break
				}
			}

			if overlap {
				t.Errorf("Convert() rooms %d and %d overlap", i, j)
			}
		}
	}
}

func TestPrintTilemap(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	conv := converter.NewTreeToTilemapConverter(rng)

	testTree := createTestTree(3)
	result, err := conv.Convert(testTree)

	if err != nil {
		t.Fatalf("Convert() returned error: %v", err)
	}

	// Test that PrintTilemap doesn't panic
	conv.PrintTilemap(result)

	// Test with empty tilemap
	emptyTilemap := tilemap.NewTileMap()
	emptyResult := &converter.ConvertResult{
		Tilemap:   emptyTilemap,
		Rooms:     []*placement.PlacedRoom{},
		Corridors: []*connection.Corridor{},
	}

	// This should not panic
	conv.PrintTilemap(emptyResult)
}

func TestPrintStats(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	conv := converter.NewTreeToTilemapConverter(rng)

	testTree := createTestTree(3)
	result, err := conv.Convert(testTree)

	if err != nil {
		t.Fatalf("Convert() returned error: %v", err)
	}

	// Test that PrintStats doesn't panic
	conv.PrintStats(result)
}

// Edge case tests
func TestConvert_EdgeCases(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	conv := converter.NewTreeToTilemapConverter(rng)

	t.Run("tree with orphaned nodes", func(t *testing.T) {
		// Create a tree with invalid parent references
		invalidTree := &tree.Tree{}
		invalidTree.Add(-1, map[string]string{"type": "root"})
		invalidTree.Add(99, map[string]string{"type": "orphan"}) // Invalid parent

		result, err := conv.Convert(invalidTree)
		if err != nil {
			t.Errorf("Convert() with orphaned nodes returned error: %v", err)
		}

		// Should still place the root
		if len(result.Rooms) < 1 {
			t.Errorf("Convert() should place at least the root node")
		}
	})

	t.Run("very deep tree", func(t *testing.T) {
		deepTree := createTestTree(50)
		result, err := conv.Convert(deepTree)

		if err != nil {
			t.Errorf("Convert() with deep tree returned error: %v", err)
		}

		if len(result.Rooms) != 50 {
			t.Errorf("Convert() deep tree room count = %d, want 50", len(result.Rooms))
		}
	})
}

// Performance benchmarks
func BenchmarkConvert_Small(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	testTree := createTestTree(10)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conv := converter.NewTreeToTilemapConverter(rng)
		_, err := conv.Convert(testTree)
		if err != nil {
			b.Fatalf("Convert() returned error: %v", err)
		}
	}
}

func BenchmarkConvert_Medium(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	testTree := createTestTree(100)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conv := converter.NewTreeToTilemapConverter(rng)
		_, err := conv.Convert(testTree)
		if err != nil {
			b.Fatalf("Convert() returned error: %v", err)
		}
	}
}

func BenchmarkConvert_Large(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	testTree := createTestTree(1000)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conv := converter.NewTreeToTilemapConverter(rng)
		_, err := conv.Convert(testTree)
		if err != nil {
			b.Fatalf("Convert() returned error: %v", err)
		}
	}
}

func BenchmarkConvert_BinaryTree(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	testTree := createBinaryTree(8) // 255 nodes

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conv := converter.NewTreeToTilemapConverter(rng)
		_, err := conv.Convert(testTree)
		if err != nil {
			b.Fatalf("Convert() returned error: %v", err)
		}
	}
}
