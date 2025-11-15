package minimap_test

import (
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap"
)

func SingleTile(*tree.Node) minimap.RoomShape {
	return minimap.RoomShape{{0, 0}}
}

type GenResult struct {
	Rooms int
	Doors int
}

func TestGenerateMinimap(t *testing.T) {
	tests := []struct {
		name string // description of this test case
		// Named input parameters for target function.
		tree         tree.Tree
		rng          minimap.Random
		getRoomShape minimap.GetRoomShapeFunc
		// want         *minimap.TileMap
		want    GenResult
		wantErr bool
	}{
		{
			name:         "single tile",
			tree:         []*tree.Node{},
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want:         GenResult{},
			wantErr:      false,
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
			// TODO: update the condition below to compare got with tt.want.
			if true {
				t.Errorf("GenerateMinimap() = %v, want %v", got, tt.want)
			}
		})
	}
}
