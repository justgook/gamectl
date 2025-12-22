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
	grid := &Grid{}

	// Stage 1: Initial hierarchical placement
	Stage1(rng, treeInput, getRoomShape, grid)

	// Stage 3: Initial pathfinding
	pathInfos, err := Stage3(treeInput, grid)
	if err != nil {
		return nil, err
	}

	// Stage 4: Path compression
	// _, err = Stage4(rng, treeInput, getRoomShape, grid)
	// if err != nil {
	// 	return nil, err
	// }
	//
	// // Final pathfinding to get door info
	// pathInfos, err = Stage3(rng, treeInput, getRoomShape, grid)
	// if err != nil {
	// 	return nil, err
	// }

	// Generate room layer (paths become parent tiles)
	roomData, width := Grid2Tilemap(grid)

	// Generate door layer
	doorData, doorWidth := GenerateDoorLayer(grid, GenerateDoorsFromPaths(pathInfos))

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
