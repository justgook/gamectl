package roomgen_test

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
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

func TestNewRoomGenerator(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	rg := roomgen.NewRoomGenerator(rng)

	if rg == nil {
		t.Fatal("NewRoomGenerator() returned nil")
	}
}

func TestGetRoomShape(t *testing.T) {
	tests := []struct {
		name     string
		mockVals []int
		wantIdx  int
	}{
		{
			name:     "first shape",
			mockVals: []int{0},
			wantIdx:  0,
		},
		{
			name:     "second shape",
			mockVals: []int{1},
			wantIdx:  1,
		},
		{
			name:     "wrap around",
			mockVals: []int{len(roomgen.PredefinedShapes) + 5},
			wantIdx:  5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rng := NewMockRandom(tt.mockVals, nil)
			rg := roomgen.NewRoomGenerator(rng)

			node := &tree.Node{Data: map[string]string{"type": "room"}}
			shape := rg.GetRoomShape(node)

			expectedShape := roomgen.PredefinedShapes[tt.wantIdx]
			if len(shape) != len(expectedShape) {
				t.Errorf("GetRoomShape() shape length = %v, want %v", len(shape), len(expectedShape))
			}

			for i, tile := range shape {
				if tile != expectedShape[i] {
					t.Errorf("GetRoomShape() tile[%d] = %v, want %v", i, tile, expectedShape[i])
				}
			}
		})
	}
}

func TestGetRoomBounds(t *testing.T) {
	rg := roomgen.NewRoomGenerator(rand.New(rand.NewSource(42)))

	tests := []struct {
		name               string
		shape              roomgen.RoomShape
		wantMinX, wantMinY int
		wantMaxX, wantMaxY int
	}{
		{
			name:     "empty shape",
			shape:    roomgen.RoomShape{},
			wantMinX: 0, wantMinY: 0,
			wantMaxX: 0, wantMaxY: 0,
		},
		{
			name:     "single tile",
			shape:    roomgen.RoomShape{{0, 0}},
			wantMinX: 0, wantMinY: 0,
			wantMaxX: 0, wantMaxY: 0,
		},
		{
			name:     "2x2 square",
			shape:    roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			wantMinX: 0, wantMinY: 0,
			wantMaxX: 1, wantMaxY: 1,
		},
		{
			name:     "L-shape with negative coords",
			shape:    roomgen.RoomShape{{-1, -1}, {0, -1}, {0, 0}},
			wantMinX: -1, wantMinY: -1,
			wantMaxX: 0, wantMaxY: 0,
		},
		{
			name:     "scattered tiles",
			shape:    roomgen.RoomShape{{-5, 3}, {10, -2}, {0, 0}},
			wantMinX: -5, wantMinY: -2,
			wantMaxX: 10, wantMaxY: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			minX, minY, maxX, maxY := rg.GetRoomBounds(tt.shape)

			if minX != tt.wantMinX || minY != tt.wantMinY || maxX != tt.wantMaxX || maxY != tt.wantMaxY {
				t.Errorf("GetRoomBounds() = (%d,%d,%d,%d), want (%d,%d,%d,%d)",
					minX, minY, maxX, maxY, tt.wantMinX, tt.wantMinY, tt.wantMaxX, tt.wantMaxY)
			}
		})
	}
}

func TestGetRoomSize(t *testing.T) {
	rg := roomgen.NewRoomGenerator(rand.New(rand.NewSource(42)))

	tests := []struct {
		name       string
		shape      roomgen.RoomShape
		wantWidth  int
		wantHeight int
	}{
		{
			name:       "empty shape",
			shape:      roomgen.RoomShape{},
			wantWidth:  1,
			wantHeight: 1,
		},
		{
			name:       "single tile",
			shape:      roomgen.RoomShape{{0, 0}},
			wantWidth:  1,
			wantHeight: 1,
		},
		{
			name:       "2x2 square",
			shape:      roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			wantWidth:  2,
			wantHeight: 2,
		},
		{
			name:       "3x1 rectangle",
			shape:      roomgen.RoomShape{{0, 0}, {1, 0}, {2, 0}},
			wantWidth:  3,
			wantHeight: 1,
		},
		{
			name:       "L-shape",
			shape:      roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}},
			wantWidth:  2,
			wantHeight: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			width, height := rg.GetRoomSize(tt.shape)

			if width != tt.wantWidth || height != tt.wantHeight {
				t.Errorf("GetRoomSize() = (%d,%d), want (%d,%d)", width, height, tt.wantWidth, tt.wantHeight)
			}
		})
	}
}

func TestNormalizeShape(t *testing.T) {
	rg := roomgen.NewRoomGenerator(rand.New(rand.NewSource(42)))

	tests := []struct {
		name      string
		shape     roomgen.RoomShape
		wantShape roomgen.RoomShape
	}{
		{
			name:      "empty shape",
			shape:     roomgen.RoomShape{},
			wantShape: roomgen.RoomShape{},
		},
		{
			name:      "already normalized",
			shape:     roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}},
			wantShape: roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}},
		},
		{
			name:      "offset shape",
			shape:     roomgen.RoomShape{{5, 3}, {6, 3}, {5, 4}},
			wantShape: roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}},
		},
		{
			name:      "negative offset",
			shape:     roomgen.RoomShape{{-2, -1}, {-1, -1}, {-2, 0}},
			wantShape: roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			normalized := rg.NormalizeShape(tt.shape)

			if len(normalized) != len(tt.wantShape) {
				t.Errorf("NormalizeShape() length = %v, want %v", len(normalized), len(tt.wantShape))
				return
			}

			for i, tile := range normalized {
				if tile != tt.wantShape[i] {
					t.Errorf("NormalizeShape() tile[%d] = %v, want %v", i, tile, tt.wantShape[i])
				}
			}
		})
	}
}

func TestDoesRoomOverlap(t *testing.T) {
	rg := roomgen.NewRoomGenerator(rand.New(rand.NewSource(42)))

	tests := []struct {
		name        string
		room1       *roomgen.Room
		room2       *roomgen.Room
		wantOverlap bool
	}{
		{
			name: "no overlap - separate rooms",
			room1: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			room2: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{2, 2},
				NodeID:   1,
			},
			wantOverlap: false,
		},
		{
			name: "overlap - same position",
			room1: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			room2: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   1,
			},
			wantOverlap: true,
		},
		{
			name: "no overlap - adjacent rooms",
			room1: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			room2: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{1, 0},
				NodeID:   1,
			},
			wantOverlap: false,
		},
		{
			name: "partial overlap - L-shapes",
			room1: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			room2: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}},
				Position: [2]int{1, 0},
				NodeID:   1,
			},
			wantOverlap: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			overlap := rg.DoesRoomOverlap(tt.room1, tt.room2)

			if overlap != tt.wantOverlap {
				t.Errorf("DoesRoomOverlap() = %v, want %v", overlap, tt.wantOverlap)
			}
		})
	}
}

func TestGetRoomTiles(t *testing.T) {
	rg := roomgen.NewRoomGenerator(rand.New(rand.NewSource(42)))

	tests := []struct {
		name      string
		room      *roomgen.Room
		wantTiles [][2]int
	}{
		{
			name: "single tile room",
			room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{5, 3},
				NodeID:   0,
			},
			wantTiles: [][2]int{{5, 3}},
		},
		{
			name: "L-shaped room",
			room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}},
				Position: [2]int{2, 2},
				NodeID:   0,
			},
			wantTiles: [][2]int{{2, 2}, {3, 2}, {2, 3}},
		},
		{
			name: "room with negative offset",
			room: &roomgen.Room{
				Shape:    roomgen.RoomShape{{-1, -1}, {0, -1}, {-1, 0}},
				Position: [2]int{10, 10},
				NodeID:   0,
			},
			wantTiles: [][2]int{{9, 9}, {10, 9}, {9, 10}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tiles := rg.GetRoomTiles(tt.room)

			if len(tiles) != len(tt.wantTiles) {
				t.Errorf("GetRoomTiles() length = %v, want %v", len(tiles), len(tt.wantTiles))
				return
			}

			for i, tile := range tiles {
				if tile != tt.wantTiles[i] {
					t.Errorf("GetRoomTiles() tile[%d] = %v, want %v", i, tile, tt.wantTiles[i])
				}
			}
		})
	}
}

func TestAreRoomsAdjacent(t *testing.T) {
	rg := roomgen.NewRoomGenerator(rand.New(rand.NewSource(42)))

	tests := []struct {
		name         string
		room1        *roomgen.Room
		room2        *roomgen.Room
		wantAdjacent bool
	}{
		{
			name: "adjacent horizontally",
			room1: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			room2: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{1, 0},
				NodeID:   1,
			},
			wantAdjacent: true,
		},
		{
			name: "adjacent vertically",
			room1: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			room2: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 1},
				NodeID:   1,
			},
			wantAdjacent: true,
		},
		{
			name: "not adjacent - diagonal",
			room1: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			room2: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{1, 1},
				NodeID:   1,
			},
			wantAdjacent: false,
		},
		{
			name: "not adjacent - too far",
			room1: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			room2: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{3, 0},
				NodeID:   1,
			},
			wantAdjacent: false,
		},
		{
			name: "adjacent L-shapes",
			room1: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}},
				Position: [2]int{0, 0},
				NodeID:   0,
			},
			room2: &roomgen.Room{
				Shape:    roomgen.RoomShape{{0, 0}},
				Position: [2]int{2, 0},
				NodeID:   1,
			},
			wantAdjacent: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			adjacent := rg.AreRoomsAdjacent(tt.room1, tt.room2)

			if adjacent != tt.wantAdjacent {
				t.Errorf("AreRoomsAdjacent() = %v, want %v", adjacent, tt.wantAdjacent)
			}
		})
	}
}

func TestPredefinedShapes(t *testing.T) {
	// Test that all predefined shapes are valid
	for i, shape := range roomgen.PredefinedShapes {
		t.Run(fmt.Sprintf("shape_%d", i), func(t *testing.T) {
			if len(shape) == 0 {
				t.Errorf("PredefinedShapes[%d] is empty", i)
			}

			// Check that all tiles are valid coordinates
			for j, tile := range shape {
				if len(tile) != 2 {
					t.Errorf("PredefinedShapes[%d][%d] has invalid format: %v", i, j, tile)
				}
			}
		})
	}

	// Test that we have a reasonable number of shapes
	if len(roomgen.PredefinedShapes) < 5 {
		t.Errorf("Too few predefined shapes: %d", len(roomgen.PredefinedShapes))
	}
}

// Benchmark tests
func BenchmarkGetRoomShape(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	rg := roomgen.NewRoomGenerator(rng)
	node := &tree.Node{Data: map[string]string{"type": "room"}}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rg.GetRoomShape(node)
	}
}

func BenchmarkDoesRoomOverlap(b *testing.B) {
	rg := roomgen.NewRoomGenerator(rand.New(rand.NewSource(42)))

	room1 := &roomgen.Room{
		Shape:    roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
		Position: [2]int{0, 0},
		NodeID:   0,
	}
	room2 := &roomgen.Room{
		Shape:    roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
		Position: [2]int{1, 1},
		NodeID:   1,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rg.DoesRoomOverlap(room1, room2)
	}
}

func BenchmarkAreRoomsAdjacent(b *testing.B) {
	rg := roomgen.NewRoomGenerator(rand.New(rand.NewSource(42)))

	room1 := &roomgen.Room{
		Shape:    roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
		Position: [2]int{0, 0},
		NodeID:   0,
	}
	room2 := &roomgen.Room{
		Shape:    roomgen.RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
		Position: [2]int{2, 0},
		NodeID:   1,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rg.AreRoomsAdjacent(room1, room2)
	}
}
