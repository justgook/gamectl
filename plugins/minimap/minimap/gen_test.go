package minimap_test

import (
	"fmt"
	"math/bits"
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap"
	"github.com/justgook/gamectl/plugins/treegen/treegen"
)

func SingleTile(*tree.Node) minimap.RoomShape {
	return minimap.RoomShape{{0, 0}}
}

func TwoTile(*tree.Node) minimap.RoomShape {
	return minimap.RoomShape{{0, 0}, {1, 0}}
}

// Helper function to create manual tree for precise testing
func createManualTree(nodes []tree.Node) tree.Tree {
	tree := make(tree.Tree, len(nodes))
	for i, node := range nodes {
		tree[i] = &node
	}
	return tree
}

type CountResult struct {
	Rooms int
	Doors int
}

// Helper function to create expected tilemap for testing
func createExpectedTileMap(width, height int, roomData, doorData []uint32) *tilemap.TileMap {
	roomLayer := tilemap.NewTileLayer(width, height)
	doorLayer := tilemap.NewTileLayer(width, height)

	if roomData != nil {
		copy(roomLayer.Data, roomData)
	}
	if doorData != nil {
		copy(doorLayer.Data, doorData)
	}

	return &tilemap.TileMap{
		Layers: []tilemap.TileLayer{*roomLayer, *doorLayer},
	}
}

func TestGenerateMinimap(t *testing.T) {
	tests := []struct {
		name         string
		tree         tree.Tree
		rng          minimap.Random
		getRoomShape minimap.GetRoomShapeFunc
		want         CountResult
		wantMinimap  *tilemap.TileMap // Optional: if nil, skip minimap validation
	}{
		{
			name: "1 room",
			tree: treegen.GenerateTree(rand.New(rand.NewSource(42)),
				&treegen.GenerateTreeConfig{
					NodeCount:    1,
					MaxDepth:     100,
					MaxBranching: 1,
					MinBranching: 1,
					ShapeBias:    0.55,
					Density:      0.8,
					RootBranches: 0,
					LeafRatio:    0.2,
				},
			),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want:         CountResult{Rooms: 1, Doors: 0},
		},

		{
			name: "2 rooms",
			tree: treegen.GenerateTree(rand.New(rand.NewSource(42)),
				&treegen.GenerateTreeConfig{
					NodeCount:    2,
					MaxDepth:     100,
					MaxBranching: 1,
					MinBranching: 1,
					ShapeBias:    0.55,
					Density:      0.8,
					RootBranches: 1,
					LeafRatio:    0.2,
				},
			),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want:         CountResult{Rooms: 2, Doors: 2},
		},

		{
			name: "3 rooms",
			tree: treegen.GenerateTree(rand.New(rand.NewSource(42)),
				&treegen.GenerateTreeConfig{
					NodeCount:    3,
					MaxDepth:     100,
					MaxBranching: 1,
					MinBranching: 1,
					ShapeBias:    0.55,
					Density:      0.8,
					RootBranches: 0,
					LeafRatio:    0.2,
				},
			),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want:         CountResult{Rooms: 3, Doors: 4},
		},

		{
			name: "10 rooms",
			tree: treegen.GenerateTree(rand.New(rand.NewSource(42)),
				&treegen.GenerateTreeConfig{
					NodeCount:    10,
					MaxDepth:     100,
					MaxBranching: 1,
					MinBranching: 1,
					ShapeBias:    0.55,
					Density:      0.8,
					RootBranches: 0,
					LeafRatio:    0.2,
				},
			),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want:         CountResult{Rooms: 10, Doors: 18},
		},

		// TODO: Enable when full algorithm is implemented
		// {
		// 	name: "realTest",
		// 	tree: treegen.GenerateTree(rand.New(rand.NewSource(42)),
		// 		&treegen.GenerateTreeConfig{
		// 			NodeCount:    10,
		// 			MaxDepth:     6,
		// 			MaxBranching: 3,
		// 			MinBranching: 1,
		// 			ShapeBias:    0.55,
		// 			Density:      0.8,
		// 			RootBranches: 0,
		// 			LeafRatio:    0.2,
		// 		},
		// 	),
		// 	rng:          rand.New(rand.NewSource(42)),
		// 	getRoomShape: TwoTile,
		// 	want:         CountResult{Rooms: 1, Doors: 0},
		// },

		{
			name: "1 room with custom shape",
			tree: treegen.GenerateTree(rand.New(rand.NewSource(42)),
				&treegen.GenerateTreeConfig{
					NodeCount:    1,
					MaxDepth:     100,
					MaxBranching: 1,
					MinBranching: 1,
					ShapeBias:    0.55,
					Density:      0.8,
					RootBranches: 0,
					LeafRatio:    0.2,
				},
			),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: TwoTile,
			want:         CountResult{Rooms: 1, Doors: 0},
		},

		{
			name: "room with multiple branches",
			tree: treegen.GenerateTree(rand.New(rand.NewSource(42)),
				&treegen.GenerateTreeConfig{
					NodeCount:    3,
					MaxDepth:     1,
					MaxBranching: 3,
					MinBranching: 2,
					ShapeBias:    0.55,
					Density:      0.8,
					RootBranches: 2,
					LeafRatio:    1.0,
				},
			),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want:         CountResult{Rooms: 3, Doors: 4}, // Parent: 2 exits, 2 children: 1 entrance each
		},

		{
			name: "multiple branches + custom shape",
			tree: treegen.GenerateTree(rand.New(rand.NewSource(42)),
				&treegen.GenerateTreeConfig{
					NodeCount:    3,
					MaxDepth:     1,
					MaxBranching: 3,
					MinBranching: 2,
					ShapeBias:    0.55,
					Density:      0.8,
					RootBranches: 2,
					LeafRatio:    1.0,
				},
			),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: TwoTile,                         // Parent will be 2-tile shape with 2 children
			want:         CountResult{Rooms: 3, Doors: 4}, // Same door count, but rooms have multi-tile shapes
		},

		{
			name: "precise 2-room layout",
			tree: createManualTree([]tree.Node{
				{ParentId: -1, Data: map[string]string{}}, // Root node
				{ParentId: 0, Data: map[string]string{}},  // Child node
			}),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want:         CountResult{Rooms: 2, Doors: 2},
			wantMinimap: createExpectedTileMap(2, 1,
				[]uint32{1, 2}, // Room layer: Room 1 at [0,0], Room 2 at [1,0]
				[]uint32{2, 8}, // Door layer: Room 1: East door (2), Room 2: West door (8)
			),
		},

		{
			name: "precise L-shaped layout",
			tree: createManualTree([]tree.Node{
				{ParentId: -1, Data: map[string]string{}}, // Root node
				{ParentId: 0, Data: map[string]string{}},  // Child 1 (East)
				{ParentId: 0, Data: map[string]string{}},  // Child 2 (South)
			}),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want:         CountResult{Rooms: 3, Doors: 4},
			wantMinimap: createExpectedTileMap(2, 2,
				[]uint32{1, 2, 3, 0}, // Room layer: Row 0: [Room1, Room2], Row 1: [Room3, empty]
				[]uint32{6, 8, 1, 0}, // Door layer: Row 0: [East+South, West], Row 1: [North, empty]
			),
		},

		// Commented out - validation test (would fail intentionally)
		// {
		// 	name: "validation test (should fail)",
		// 	tree: createManualTree([]tree.Node{
		// 		{ParentId: -1, Data: map[string]string{}}, // Root node
		// 		{ParentId: 0, Data: map[string]string{}},  // Child node
		// 	}),
		// 	rng:          rand.New(rand.NewSource(42)),
		// 	getRoomShape: SingleTile,
		// 	want:         CountResult{Rooms: 2, Doors: 2},
		// 	wantMinimap: createExpectedTileMap(2, 1,
		// 		[]uint32{1, 2}, // Room layer: correct
		// 		[]uint32{1, 1}, // Door layer: WRONG - should be [2, 8]
		// 	),
		// },
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, gotErr := minimap.GenerateMinimap(tt.rng, tt.tree, tt.getRoomShape)
			if gotErr != nil {
				t.Errorf("GenerateMinimap() failed: %v", gotErr)
				return
			}

			gotResult := CountResult{
				Rooms: countRooms(got.Layers[0]),
				Doors: countDoors(got.Layers[1]),
			}
			if gotResult.Rooms != tt.want.Rooms || gotResult.Doors != tt.want.Doors {
				t.Errorf("GenerateMinimap(rooms: %d, doors: %d) / want rooms: %d; doors: %d;", gotResult.Rooms, gotResult.Doors, tt.want.Rooms, tt.want.Doors)
			}

			// Optional: validate exact minimap structure if specified
			if tt.wantMinimap != nil {
				if err := validateMinimap(got, tt.wantMinimap); err != nil {
					t.Errorf("Minimap validation failed: %v", err)
				}
			}
		})
	}
}

/*========================================UTIL========================================*/
func countRooms(roomLayer tilemap.TileLayer) int {
	m := make(map[uint32]struct{}, len(roomLayer.Data))
	for _, v := range roomLayer.Data {
		if v != 0 { // Ignore empty tiles
			m[v] = struct{}{}
		}
	}
	return len(m)
}

func countDoors(doorLayer tilemap.TileLayer) int {
	total := 0
	for _, m := range doorLayer.Data {
		total += bits.OnesCount32(m)
	}
	return total
}

var TheRandom = rand.New(rand.NewSource(125))

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

func getRoomShape(_node *tree.Node) minimap.RoomShape {
	rng := TheRandom
	idx := rng.Intn(len(roomShapesToChooseFrom))
	return roomShapesToChooseFrom[idx]
}

// validateMinimap compares two tilemap.TileMap structures
func validateMinimap(got, want *tilemap.TileMap) error {
	// Check layer count
	if len(got.Layers) != len(want.Layers) {
		return fmt.Errorf("layer count mismatch: got %d, want %d", len(got.Layers), len(want.Layers))
	}

	// Compare each layer
	for layerIdx, gotLayer := range got.Layers {
		wantLayer := want.Layers[layerIdx]

		// Check dimensions
		if gotLayer.Width != wantLayer.Width {
			return fmt.Errorf("layer %d width mismatch: got %d, want %d", layerIdx, gotLayer.Width, wantLayer.Width)
		}

		gotHeight := gotLayer.Height()
		wantHeight := wantLayer.Height()
		if gotHeight != wantHeight {
			return fmt.Errorf("layer %d height mismatch: got %d, want %d", layerIdx, gotHeight, wantHeight)
		}

		// Compare data
		if len(gotLayer.Data) != len(wantLayer.Data) {
			return fmt.Errorf("layer %d data size mismatch: got %d, want %d", layerIdx, len(gotLayer.Data), len(wantLayer.Data))
		}

		for i, gotValue := range gotLayer.Data {
			wantValue := wantLayer.Data[i]
			// Skip comparison for zero values in expected data (allows partial validation)
			if wantValue != 0 && gotValue != wantValue {
				return fmt.Errorf("layer %d data mismatch at index %d: got %d, want %d", layerIdx, i, gotValue, wantValue)
			}
		}
	}

	return nil
}
