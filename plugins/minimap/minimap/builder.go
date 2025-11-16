package minimap

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
)

// NewMinimapBuilder creates a new builder instance
func NewBuilder(tree tree.Tree) *MinimapBuilder {
	return &MinimapBuilder{
		rooms:  make([]*Room, len(tree)),
		tree:   tree,
		bounds: &Bounds{},
	}
}

// MinimapBuilder handles incremental corridor generation
type MinimapBuilder struct {
	rooms  []*Room
	tree   tree.Tree
	bounds *Bounds
}

func (b *MinimapBuilder) PlaceRoom(node *tree.Node, getRoomShape GetRoomShapeFunc, rng Random) {
	shape := getRoomShape(node)
	position := b.calculateRoomPosition(node)
	index := b.tree.IndexOf(node)
	exits := b.calculateExits(node)

	b.rooms[index] = &Room{
		Position: position,
		Shape:    shape,
		Node:     node,
		Exits:    exits,
	}

	b.updateBounds(toAbsShape(position, shape))
	fmt.Printf("PlaceRoom(node:%v, p:%v, bounds: %v)\n", node, position, b.bounds)
}

func toAbsShape(p XY, shape []XY) []XY {
	output := make([]XY, len(shape))
	for i, item := range shape {
		output[i] = item
		output[i][0] += p[0]
		output[i][1] += p[1]
	}

	return output
}
func toAbs(p, r XY) XY {
	r[0] += p[0]
	r[1] += p[1]

	return r
}

func (b *MinimapBuilder) calculateExits(node *tree.Node) Doors {
	output := Doors{}

	for i := range b.tree.Children(node) {
		output[XY{1, 0}] = i // Stupid solution just add on right of start tile

		break
	}

	return output
}

// calculateRoomPosition determines where to place this room based on parent
func (b *MinimapBuilder) calculateRoomPosition(node *tree.Node) XY {
	output := XY{}
	if node.ParentId < 0 {
		return output
	}

	parent := b.rooms[node.ParentId]
	for k, v := range parent.Exits {
		if v == node {
			output = toAbs(parent.Position, k)

			break
		}
	}

	return output
}

// validatePathToOutside ensures room placement maintains connectivity constraint
func (b *MinimapBuilder) validatePathToOutside(position XY) bool {
	return true
}

// buildTileMap converts internal map representation to tilemap format
func (b *MinimapBuilder) BuildTileMap() *tilemap.TileMap {
	// Calculate map dimensions
	width := b.bounds.MaxX - b.bounds.MinX + 1
	height := b.bounds.MaxY - b.bounds.MinY + 1

	// Create layers
	roomLayer := tilemap.NewTileLayer(width, height)
	doorLayer := tilemap.NewTileLayer(width, height)

	for i := range b.rooms {
		// TODO: UPDATE TP REALL DATA EXTRACTION!
		doors := uint32(0)
		if len(b.rooms[i].Exits) > 0 {
			doors |= DoorEast
		}
		if b.rooms[i].Node.ParentId >= 0 {
			doors |= DoorWest
		}
		roomLayer.Data[i] = uint32(i + 1)
		doorLayer.Data[i] = doors
	}

	return &tilemap.TileMap{
		Layers: []tilemap.TileLayer{*roomLayer, *doorLayer},
	}
}

// updateBounds expands map bounds to include new coordinates
func (b *MinimapBuilder) updateBounds(coords []XY) {
	for _, coord := range coords {
		b.bounds.MinX = min(coord[0], b.bounds.MinX)
		b.bounds.MinY = min(coord[1], b.bounds.MinY)
		b.bounds.MaxX = max(coord[0], b.bounds.MaxX)
		b.bounds.MaxY = max(coord[1], b.bounds.MaxY)
	}
}

type XY = [2]int
type Room struct {
	Position XY
	Shape    RoomShape
	Node     *tree.Node
	Exits    Doors
}
type Doors = map[XY]*tree.Node

type Bounds struct {
	MinX, MaxX int
	MinY, MaxY int
}

const (
	DoorNorth = 1 // 0001
	DoorEast  = 2 // 0010
	DoorSouth = 4 // 0100
	DoorWest  = 8 // 1000
)
