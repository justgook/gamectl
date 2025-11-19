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
type GetRoomShapeFunc func(*tree.Node) RoomShape

func GenerateMinimap(
	rng Random,
	treeInput *tree.Tree,
	getRoomShape GetRoomShapeFunc,
) (*tilemap.TileMap, error) {
	input := &Grid{}
	Stage1(rng, treeInput, getRoomShape, input)

	data, width := Grid2Tilemap(input)
	return &tilemap.TileMap{
		Layers: []tilemap.TileLayer{{
			Width: width,
			Data:  data,
		}},
	}, nil
}
