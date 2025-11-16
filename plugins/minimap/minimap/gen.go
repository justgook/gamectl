package minimap

import (
	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
)

type Random interface {
	Intn(n int) int
	Float64() float64
}

type RoomShape [][2]int

// GetRoomShapeFunc defines the function signature for room shape selection
type GetRoomShapeFunc func(*tree.Node) RoomShape

func GenerateMinimap(
	rng Random,
	tree tree.Tree,
	getRoomShape GetRoomShapeFunc,
) (*tilemap.TileMap, error) {
	return &tilemap.TileMap{
		Layers: []tilemap.TileLayer{
			{
				Width: 1,
				Data:  []uint32{1},
			}, {
				Width: 1,
				Data:  []uint32{1},
			},
		},
	}, nil
}

const (
	DoorNorth = 1 // 0001
	DoorEast  = 2 // 0010
	DoorSouth = 4 // 0100
	DoorWest  = 8 // 1000
)
