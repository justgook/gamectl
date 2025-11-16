package minimap_test

import (
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

type CountResult struct {
	Rooms int
	Doors int
}

func TestGenerateMinimap(t *testing.T) {
	tests := []struct {
		name         string
		tree         tree.Tree
		rng          minimap.Random
		getRoomShape minimap.GetRoomShapeFunc
		want         CountResult
	}{
		{
			name: "1 room",
			tree: treegen.GenerateTree(rand.New(rand.NewSource(42)),
				&treegen.GenerateTreeConfig{
					NodeCount:    1,
					MaxDepth:     10,
					MaxBranching: 10,
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
					MaxDepth:     10,
					MaxBranching: 10,
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
					MaxDepth:     10,
					MaxBranching: 10,
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
					MaxDepth:     10,
					MaxBranching: 10,
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
