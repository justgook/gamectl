package minimap2_test

import (
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree3"
	"github.com/justgook/gamectl/plugins/minimap2/minimap2"
)

func SingleTile(*tree3.Node) minimap2.RoomShape {
	return minimap2.RoomShape{{0, 0}}
}

type GenResult struct {
	Rooms int
	Doors int
}

func TestGenerateMinimap(t *testing.T) {
	tests := []struct {
		name string // description of this test case
		// Named input parameters for target function.
		tree         tree3.Tree
		rng          minimap2.Random
		getRoomShape minimap2.GetRoomShapeFunc
		// want         *minimap.TileMap
		want    GenResult
		wantErr bool
	}{
		{
			name:         "single tile",
			tree:         []*tree3.Node{},
			rng:          rand.New(rand.NewSource(42)),
			getRoomShape: SingleTile,
			want:         GenResult{},
			wantErr:      false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, gotErr := minimap2.GenerateMinimap(tt.rng, tt.tree, tt.getRoomShape)
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
