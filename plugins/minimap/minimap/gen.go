package minimap

import (
	"errors"

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
// This is a complete rewrite using the two-phase breadth-first algorithm:
// Phase 1: Place all rooms at ideal positions (breadth-first)
// Phase 2: Connect all parent-child relationships with corridors
func GenerateMinimap(
	rng Random,
	tree tree.Tree,
	getRoomShape GetRoomShapeFunc,
) (*tilemap.TileMap, error) {
	if len(tree) == 0 {
		return nil, errors.New("empty tree")
	}

	builder := NewMinimapBuilder(tree)

	// Phase 1: Breadth-first room placement
	if err := builder.PlaceAllRooms(getRoomShape); err != nil {
		return nil, err
	}

	// Phase 2: Connect all parent-child relationships with corridors
	if err := builder.ConnectAllRooms(); err != nil {
		return nil, err
	}

	// Generate the final tilemap
	return builder.BuildTileMap(), nil
}
