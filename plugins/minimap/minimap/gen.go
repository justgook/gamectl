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

	// Collect door connections from Stage3
	doors, err := Stage3(rng, treeInput, getRoomShape, input)
	if err != nil {
		return nil, err
	}

	// Generate room layer (paths become parent tiles)
	roomData, width := Grid2Tilemap(input)

	// Generate door layer
	doorData, doorWidth := GenerateDoorLayer(input, doors)

	return &tilemap.TileMap{
		Layers: []tilemap.TileLayer{
			{
				Width: width,
				Data:  roomData,
				Props: map[string]string{
					"name": "rooms",
				},
			},
			{
				Width: doorWidth,
				Data:  doorData,
				Props: map[string]string{
					"type": "doors",
				},
			},
		},
	}, nil
}
