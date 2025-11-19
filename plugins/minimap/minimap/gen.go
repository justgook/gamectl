package minimap

import (
	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap/converter"
)

type Random interface {
	Intn(n int) int
	Float64() float64
}

type RoomShape [][2]int
type GetRoomShapeFunc func(*tree.Node) RoomShape // Adjusted to take ID for simplicity in this snippet

// --- Generator Logic ---

// GenerateMinimap creates a minimap from a tree using incremental corridor generation
func GenerateMinimap(
	rng Random,
	_treeInput *tree.Tree,
	getRoomShape GetRoomShapeFunc,
) (*tilemap.TileMap, error) {
	converter := converter.NewTreeToTilemapConverter(rng)
	result, err := converter.Convert(_treeInput)
	if err != nil {
		return nil, err
	}
	return result.Tilemap, nil

	// return &tilemap.TileMap{
	// 	Layers: []tilemap.TileLayer{},
	// }, nil
}
