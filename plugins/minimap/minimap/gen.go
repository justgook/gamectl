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
	layoutConfig ...LayoutConfig,
) (*tilemap.TileMap, error) {
	// Use default config if not provided
	config := DefaultLayoutConfig()
	if len(layoutConfig) > 0 {
		config = layoutConfig[0]
	}

	// Stage 1: Initial hierarchical placement (returns shapes with positions)
	shapes := Stage1(rng, treeInput, getRoomShape, config)

	// Stage 2: Compact layout (moves children toward parents to minimize path tiles)
	err := Stage2(treeInput, shapes)
	if err != nil {
		return nil, err
	}

	// Stage 3: Pathfinding (builds internal grid, returns PathInfo only)
	pathInfos, err := Stage3(treeInput, shapes)
	if err != nil {
		return nil, err
	}

	// Generate room layer from shapes
	roomData, width, offset := ApplyShapesToTilemap(shapes, pathInfos)

	// Apply paths to tilemap (paths become parent tiles)
	ApplyPathsToTilemap(pathInfos, roomData, width, offset)

	// Generate door layer
	doors := GenerateDoorsFromPaths(pathInfos)
	doorData := generateDoorLayerFromOffset(doors, width, len(roomData)/width, offset)

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
				Width: width,
				Data:  doorData,
				Props: map[string]string{
					"type": "doors",
				},
			},
		},
	}, nil
}

// generateDoorLayerFromOffset creates door layer data using pre-calculated bounds
func generateDoorLayerFromOffset(doors []DoorConnection, width, height int, offset Point) []uint32 {
	data := make([]uint32, width*height)

	for _, door := range doors {
		x := door.Point[0] - offset[0]
		y := door.Point[1] - offset[1]
		idx := y*width + x
		if idx >= 0 && idx < len(data) {
			data[idx] |= uint32(door.Direction)
		}
	}

	return data
}
