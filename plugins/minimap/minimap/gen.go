package minimap

import (
	"errors"
	"fmt"

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

// GenerateMinimap creates a minimap from a tree using incremental corridor generation
func GenerateMinimap(
	rng Random,
	tree tree.Tree,
	getRoomShape GetRoomShapeFunc,
) (*tilemap.TileMap, error) {
	if len(tree) == 0 {
		return nil, errors.New("empty tree")
	}

	builder := NewBuilder(tree)

	fmt.Printf("GenerateMinimap:%v\n", tree)
	// Clean main loop: traverse tree and place each room with required doors
	for node := range tree.Traverse(tree[0]) {
		fmt.Printf("GenerateMinimap:%v\n", node)
		builder.PlaceRoom(node, getRoomShape, rng)
	}

	return builder.BuildTileMap(), nil
}
