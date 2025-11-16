package minimap

import (
	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
)

// NewMinimapBuilder creates a new builder instance
func NewBuilder(tree tree.Tree) *MinimapBuilder {
	return &MinimapBuilder{
		rooms:         make([]*Room, len(tree)),
		occupiedTiles: make(map[XY]int),
		tree:          tree,
		bounds:        &Bounds{},
	}
}

// MinimapBuilder handles incremental corridor generation
type MinimapBuilder struct {
	rooms         []*Room
	occupiedTiles map[XY]int // tile coordinate -> room index mapping
	tree          tree.Tree
	bounds        *Bounds
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

	// Track occupied tiles for this room
	absShape := toAbsShape(position, shape)
	for _, tileCoord := range absShape {
		b.occupiedTiles[tileCoord] = index
	}

	b.updateBounds(absShape)
	// fmt.Printf("PlaceRoom(node:%v, p:%v, shape:%v, bounds: %v)\n", node, position, shape, b.bounds)
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

	// Simple exit placement strategy: distribute children around the parent
	// For now, place them in cardinal directions: East, South, West, North, then repeat
	exitDirections := []XY{
		{1, 0},  // East
		{0, 1},  // South
		{-1, 0}, // West
		{0, -1}, // North
	}

	i := 0
	for child := range b.tree.Children(node) {
		exitDir := exitDirections[i%len(exitDirections)]
		output[exitDir] = child

		// fmt.Printf("  Exit[%d]: child %v at direction %v\n", i, child, exitDir)
		i++
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

	// Use occupiedTiles map to populate the tilemap by coordinates
	for coord, roomIndex := range b.occupiedTiles {
		// Convert absolute coordinates to tilemap array index
		x := coord[0] - b.bounds.MinX
		y := coord[1] - b.bounds.MinY
		tileIndex := y*width + x

		// Set room ID (1-based indexing for room layer)
		roomLayer.Data[tileIndex] = uint32(roomIndex + 1)

		// Calculate door mask for this tile
		doorLayer.Data[tileIndex] = b.calculateDoorMask(roomIndex, coord)
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

// calculateDoorMask determines which doors exist at a specific tile coordinate
func (b *MinimapBuilder) calculateDoorMask(roomIndex int, coord XY) uint32 {
	room := b.rooms[roomIndex]
	doors := uint32(0)

	// PART 1: Check exits from this room (doors leading to children)
	for exitCoord, childNode := range room.Exits {
		// Find which tile in parent shape should have the door
		// Door should be on the parent tile that's adjacent to the exit position
		doorTileCoord := b.findDoorTileForExit(room, exitCoord)

		if doorTileCoord == coord {
			// Determine door direction based on exit position relative to door tile
			relX := exitCoord[0]
			relY := exitCoord[1]

			if relX > 0 {
				doors |= DoorEast
			} else if relX < 0 {
				doors |= DoorWest
			}
			if relY > 0 {
				doors |= DoorSouth
			} else if relY < 0 {
				doors |= DoorNorth
			}
		}
		_ = childNode // Avoid unused variable
	}

	// PART 2: Check entrance from parent (door from parent)
	if room.Node.ParentId >= 0 {
		// Entrance is ALWAYS at {0,0} of child shape (first tile)
		childEntranceAbs := toAbs(room.Position, XY{0, 0})

		if coord == childEntranceAbs {
			// Find parent's exit that leads to this room to determine direction
			parent := b.rooms[room.Node.ParentId]
			for parentExitCoord, childNode := range parent.Exits {
				if childNode == room.Node {
					// Add opposite direction door from parent's exit direction
					relX := parentExitCoord[0]
					relY := parentExitCoord[1]

					if relX > 0 {
						doors |= DoorWest // Opposite of East
					} else if relX < 0 {
						doors |= DoorEast // Opposite of West
					}
					if relY > 0 {
						doors |= DoorNorth // Opposite of South
					} else if relY < 0 {
						doors |= DoorSouth // Opposite of North
					}
					break
				}
			}
		}
	}

	return doors
}

// findDoorTileForExit finds which tile in the parent shape should have the door for a given exit
func (b *MinimapBuilder) findDoorTileForExit(room *Room, exitCoord XY) XY {
	// For now, simple logic: find the parent shape tile that's adjacent to the exit
	// This works for simple shapes, later we can make it more sophisticated

	for _, shapeTile := range room.Shape {
		// Check if this shape tile is adjacent to the exit coordinate
		doorTileAbs := toAbs(room.Position, shapeTile)
		exitAbs := toAbs(room.Position, exitCoord)

		// Check if they are adjacent (Manhattan distance = 1)
		dx := abs(doorTileAbs[0] - exitAbs[0])
		dy := abs(doorTileAbs[1] - exitAbs[1])

		if (dx == 1 && dy == 0) || (dx == 0 && dy == 1) {
			return doorTileAbs
		}
	}

	// Fallback: use room position (first tile)
	return toAbs(room.Position, XY{0, 0})
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
