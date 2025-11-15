package minimap

import (
	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
)

const (
	MaxExtensionDepth = 20  // Maximum corridor extension search depth
	MaxDoorsPerRoom   = 100 // Sanity check for extreme branching scenarios
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
	panic("implement me")
}
