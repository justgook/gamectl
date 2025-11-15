package minimap_test

import (
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
		wantErr      bool
	}{
		{
			name: "single tile",
			tree: treegen.GenerateTree(rand.New(rand.NewSource(42)), &treegen.GenerateTreeConfig{
				NodeCount:    1,
				MaxDepth:     6,
				MaxBranching: 3,
				MinBranching: 1,
				ShapeBias:    0.55,
				Density:      0.8,
				RootBranches: 2,
				LeafRatio:    0.2,
			}),
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want: CountResult{
				Rooms: 1,
				Doors: 0,
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, gotErr := minimap.GenerateMinimap(tt.rng, tt.tree, tt.getRoomShape)
			if gotErr != nil {
				if !tt.wantErr {
					t.Errorf("GenerateMinimap() failed: %v", gotErr)
				}
				return
			}
			if tt.wantErr {
				t.Fatal("GenerateMinimap() succeeded unexpectedly")
			}

			gotResult := CountResult{
				Rooms: countRooms(got.Layers[0]),
				Doors: countDoors(got.Layers[1]),
			}
			if gotResult.Rooms != tt.want.Rooms || gotResult.Doors != tt.want.Rooms {
				t.Errorf("GenerateMinimap(rooms: %d, doors: %d) / want rooms: %d; doors: %d;", gotResult.Rooms, gotResult.Doors, tt.want.Rooms, tt.want.Doors)
			}
		})
	}
}

/*========================================UTIL========================================*/
func countRooms(roomLayer tilemap.TileLayer) int {
	return 0
}

func countDoors(doorLayer tilemap.TileLayer) int {
	return 0
}
