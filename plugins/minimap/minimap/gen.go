package minimap

import (
	"github.com/justgook/gams/sdk/go/tilemap"
	"github.com/justgook/gams/sdk/go/tree"
)

type RoomShape [][2]int
type GetRoomShapeFunc func(*tree.Node) RoomShape

func GenerateMinimap(
	treeInput *tree.Tree,
	getRoomShape GetRoomShapeFunc,
) (*tilemap.TileMap, error) {
	// Stage 1: Collect and normalize shapes for each node
	shapes := Stage1(treeInput, getRoomShape)

	// Stage 2: Grow map from parent - places all shapes ensuring connectivity
	result, err := Stage2(treeInput, shapes)
	if err != nil {
		return nil, err
	}

	// Convert grid to tilemap
	roomData, width, offset := gridToTilemapData(&result.Grid)

	// Generate door layer
	doorData := generateDoorLayerFromOffset(result.Doors, width, len(roomData)/width, offset)

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

// gridToTilemapData converts a Grid to tilemap data array
func gridToTilemapData(grid *Grid) ([]uint32, int, Point) {
	if grid == nil || len(*grid) == 0 {
		return []uint32{}, 0, Point{0, 0}
	}

	// Find bounds
	var minX, minY, maxX, maxY int
	first := true
	for pt := range *grid {
		if first {
			minX, maxX = pt[0], pt[0]
			minY, maxY = pt[1], pt[1]
			first = false
		} else {
			if pt[0] < minX {
				minX = pt[0]
			}
			if pt[0] > maxX {
				maxX = pt[0]
			}
			if pt[1] < minY {
				minY = pt[1]
			}
			if pt[1] > maxY {
				maxY = pt[1]
			}
		}
	}

	width := maxX - minX + 1
	height := maxY - minY + 1
	data := make([]uint32, width*height)

	for pt, id := range *grid {
		x := pt[0] - minX
		y := pt[1] - minY
		idx := y*width + x
		// Convert any negative IDs to positive (corridors use parent's ID)
		if id < 0 {
			data[idx] = uint32(-id)
		} else {
			data[idx] = uint32(id)
		}
	}

	return data, width, Point{minX, minY}
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
