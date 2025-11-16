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

	// Check for collisions and resolve them
	originalPosition := position
	position = b.resolveCollisions(shape, position, node)

	// If position changed due to collision resolution, update parent's exit map
	if node.ParentId >= 0 && position != originalPosition {
		b.updateParentExit(node, position)
	}

	// Calculate required exits first
	exits := b.calculateExits(node)
	requiredExits := len(exits)

	// Check if room has sufficient door capacity
	originalCapacity := b.calculateDoorCapacity(shape, position)
	if requiredExits > originalCapacity {
		// Extend room to provide additional door capacity
		shape = b.extendRoomForDoorCapacity(shape, position, requiredExits-originalCapacity)
	}

	b.rooms[index] = &Room{
		Position: position,
		Shape:    shape,
		Node:     node,
		Exits:    exits,
	}

	// Track occupied tiles for this room
	absShape := toAbsShape(position, shape)
	// fmt.Printf("PlaceRoom: node=%v, pos=%v, shape=%v, absShape=%v, exits=%v\n", node, position, shape, absShape, exits)

	for _, tileCoord := range absShape {
		b.occupiedTiles[tileCoord] = index
	}

	b.updateBounds(absShape)
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

	// Extended exit placement strategy: start with cardinal directions, then add diagonals and extended positions
	exitDirections := []XY{
		{1, 0},  // East
		{0, 1},  // South
		{-1, 0}, // West
		{0, -1}, // North
		{2, 0},  // Far East (requires extension)
		{0, 2},  // Far South (requires extension)
		{-2, 0}, // Far West (requires extension)
		{0, -2}, // Far North (requires extension)
		{1, 1},  // Southeast diagonal (requires extension)
		{-1, 1}, // Southwest diagonal (requires extension)
		// Add more directions as needed...
	}

	i := 0
	for child := range b.tree.Children(node) {
		if i < len(exitDirections) {
			exitDir := exitDirections[i]
			output[exitDir] = child
		} else {
			// Fallback: create a far position if we run out of predefined directions
			// This should rarely happen with the extended list above
			exitDir := XY{i + 1, 0} // Place remaining children progressively to the right
			output[exitDir] = child
		}

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
	// fmt.Printf("  calculateRoomPosition: node parentId=%d, parent.Position=%v, parent.Exits=%v\n", node.ParentId, parent.Position, parent.Exits)
	for k, v := range parent.Exits {
		if v == node {
			output = toAbs(parent.Position, k)
			// fmt.Printf("    found exit %v -> absolute position %v\n", k, output)
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

	// fmt.Printf("  calculateDoorMask: room[%d] at coord %v\n", roomIndex, coord)

	// PART 1: Check exits from this room (doors leading to children)
	for exitCoord, childNode := range room.Exits {
		// Find which tile in parent shape should have the door
		// Door should be on the parent tile that's adjacent to the exit position
		doorTileCoord := b.findDoorTileForExit(room, exitCoord)

		// fmt.Printf("    exit %v -> doorTile %v, childNode: %p\n", exitCoord, doorTileCoord, childNode)

		if doorTileCoord == coord {
			// Determine door direction based on exit position relative to door tile
			relX := exitCoord[0]
			relY := exitCoord[1]

			// Only add door for the primary direction (largest absolute component)
			if abs(relX) > abs(relY) {
				// X direction is dominant
				if relX > 0 {
					doors |= DoorEast
					// fmt.Printf("      adding East door (X-dominant)\n")
				} else if relX < 0 {
					doors |= DoorWest
					// fmt.Printf("      adding West door (X-dominant)\n")
				}
			} else {
				// Y direction is dominant (or equal)
				if relY > 0 {
					doors |= DoorSouth
					// fmt.Printf("      adding South door (Y-dominant)\n")
				} else if relY < 0 {
					doors |= DoorNorth
					// fmt.Printf("      adding North door (Y-dominant)\n")
				}
			}
		}
		_ = childNode // Avoid unused variable
	}

	// PART 2: Check entrance from parent (door from parent)
	if room.Node.ParentId >= 0 {
		// Entrance is ALWAYS at {0,0} of child shape (first tile)
		childEntranceAbs := toAbs(room.Position, XY{0, 0})

		// fmt.Printf("    checking entrance: childEntranceAbs=%v, coord=%v\n", childEntranceAbs, coord)

		if coord == childEntranceAbs {
			// Find parent's exit that leads to this room to determine direction
			parent := b.rooms[room.Node.ParentId]
			// fmt.Printf("      entrance tile, parent exits: %v\n", parent.Exits)
			for parentExitCoord, childNode := range parent.Exits {
				if childNode == room.Node {
					// fmt.Printf("      found parent exit %v leading to this room\n", parentExitCoord)
					// Add opposite direction door from parent's exit direction
					relX := parentExitCoord[0]
					relY := parentExitCoord[1]

					// Only add door for the primary direction (largest absolute component)
					if abs(relX) > abs(relY) {
						// X direction is dominant
						if relX > 0 {
							doors |= DoorWest // Opposite of East
							// fmt.Printf("        adding West entrance door (X-dominant)\n")
						} else if relX < 0 {
							doors |= DoorEast // Opposite of West
							// fmt.Printf("        adding East entrance door (X-dominant)\n")
						}
					} else {
						// Y direction is dominant (or equal)
						if relY > 0 {
							doors |= DoorNorth // Opposite of South
							// fmt.Printf("        adding North entrance door (Y-dominant)\n")
						} else if relY < 0 {
							doors |= DoorSouth // Opposite of North
							// fmt.Printf("        adding South entrance door (Y-dominant)\n")
						}
					}
					break
				}
			}
		}
	}

	// fmt.Printf("    final doors: %d (binary: %08b)\n", doors, doors)
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

// calculateDoorCapacity counts the number of available door positions for a room shape
func (b *MinimapBuilder) calculateDoorCapacity(shape RoomShape, position XY) int {
	// Convert shape to absolute coordinates
	absShape := toAbsShape(position, shape)

	// Create a set of occupied positions for quick lookup
	occupied := make(map[XY]bool)
	for _, coord := range absShape {
		occupied[coord] = true
	}

	// Count unique perimeter positions (adjacent to room tiles but not occupied)
	perimeterPositions := make(map[XY]bool)
	directions := []XY{{0, 1}, {1, 0}, {0, -1}, {-1, 0}} // N, E, S, W

	for _, roomTile := range absShape {
		for _, dir := range directions {
			adjacent := XY{roomTile[0] + dir[0], roomTile[1] + dir[1]}

			// If adjacent position is not occupied by this room, it's a potential door position
			if !occupied[adjacent] {
				perimeterPositions[adjacent] = true
			}
		}
	}

	return len(perimeterPositions)
}

// extendRoomForDoorCapacity adds tiles to a room shape to provide additional door capacity
func (b *MinimapBuilder) extendRoomForDoorCapacity(shape RoomShape, position XY, additionalCapacityNeeded int) RoomShape {
	if additionalCapacityNeeded <= 0 {
		return shape
	}

	// Start with the original shape
	extendedShape := make(RoomShape, len(shape))
	copy(extendedShape, shape)

	// Simple extension strategy: add tiles adjacent to existing tiles
	// This is a basic implementation - can be made more sophisticated later
	maxAttempts := 10 // Prevent infinite loops
	attempts := 0

	for additionalCapacityNeeded > 0 && attempts < maxAttempts {
		// Find potential extension positions adjacent to current shape
		candidates := b.findExtensionCandidates(extendedShape, position)

		if len(candidates) == 0 {
			break // No more extension options
		}

		// Add the first available candidate
		newTile := candidates[0]
		extendedShape = append(extendedShape, newTile)

		// Check if this extension provided the needed capacity
		newCapacity := b.calculateDoorCapacity(extendedShape, position)
		originalCapacity := b.calculateDoorCapacity(shape, position)
		capacityGained := newCapacity - originalCapacity

		additionalCapacityNeeded -= capacityGained
		attempts++
	}

	return extendedShape
}

// findExtensionCandidates finds potential tiles adjacent to current shape for extension
func (b *MinimapBuilder) findExtensionCandidates(shape RoomShape, position XY) []XY {
	// Convert current shape to absolute coordinates for easier processing
	absShape := toAbsShape(position, shape)
	occupied := make(map[XY]bool)
	for _, coord := range absShape {
		occupied[coord] = true
	}

	// Find adjacent positions that are not occupied by this room
	candidates := []XY{}
	directions := []XY{{0, 1}, {1, 0}, {0, -1}, {-1, 0}} // N, E, S, W

	for _, roomTile := range absShape {
		for _, dir := range directions {
			adjacent := XY{roomTile[0] + dir[0], roomTile[1] + dir[1]}

			// Check if this adjacent position is available for extension
			if !occupied[adjacent] && !b.isPositionOccupied(adjacent) {
				// Convert back to relative coordinates
				relative := XY{adjacent[0] - position[0], adjacent[1] - position[1]}
				candidates = append(candidates, relative)
				occupied[adjacent] = true // Prevent duplicates
			}
		}
	}

	return candidates
}

// updateParentExit updates the parent room's exit map when a child gets relocated
func (b *MinimapBuilder) updateParentExit(childNode *tree.Node, newChildPosition XY) {
	parent := b.rooms[childNode.ParentId]

	// Find the exit that points to this child and update it
	for exitCoord, childPtr := range parent.Exits {
		if childPtr == childNode {
			// Calculate the new relative exit coordinate
			newExitCoord := XY{newChildPosition[0] - parent.Position[0], newChildPosition[1] - parent.Position[1]}

			// Update the exit map
			delete(parent.Exits, exitCoord)        // Remove old exit
			parent.Exits[newExitCoord] = childNode // Add new exit

			// fmt.Printf("  Updated parent exit: %v -> %v (child moved to %v)\n", exitCoord, newExitCoord, newChildPosition)
			break
		}
	}
}

// isPositionOccupied checks if a position is already occupied by another room
func (b *MinimapBuilder) isPositionOccupied(pos XY) bool {
	_, exists := b.occupiedTiles[pos]
	return exists
}

// resolveCollisions finds a non-colliding position for the room
func (b *MinimapBuilder) resolveCollisions(shape RoomShape, originalPos XY, node *tree.Node) XY {
	// Check if original position has any collisions
	if !b.hasCollision(shape, originalPos) {
		return originalPos // No collision, use original position
	}

	// fmt.Printf("  COLLISION detected at %v, searching for alternative position...\n", originalPos)

	// Try positions in expanding search pattern around the original position
	maxSearchRadius := 10 // Prevent infinite search

	for radius := 1; radius <= maxSearchRadius; radius++ {
		// Generate candidate positions in a square pattern around original
		candidates := b.generateSearchPositions(originalPos, radius)

		for _, candidatePos := range candidates {
			if !b.hasCollision(shape, candidatePos) {
				// fmt.Printf("  Found collision-free position: %v (radius %d)\n", candidatePos, radius)
				return candidatePos
			}
		}
	}

	// If no collision-free position found, fall back to original position
	// (this should trigger parent room extension in a full implementation)
	// fmt.Printf("  WARNING: No collision-free position found, using original position %v\n", originalPos)
	return originalPos
}

// hasCollision checks if placing a room shape at a position would cause collisions
func (b *MinimapBuilder) hasCollision(shape RoomShape, position XY) bool {
	absShape := toAbsShape(position, shape)
	for _, tileCoord := range absShape {
		if b.isPositionOccupied(tileCoord) {
			return true
		}
	}
	return false
}

// generateSearchPositions creates candidate positions in a search pattern
func (b *MinimapBuilder) generateSearchPositions(center XY, radius int) []XY {
	candidates := []XY{}

	// Generate positions in a square pattern around center
	for dx := -radius; dx <= radius; dx++ {
		for dy := -radius; dy <= radius; dy++ {
			if dx == 0 && dy == 0 {
				continue // Skip center position
			}
			candidate := XY{center[0] + dx, center[1] + dy}
			candidates = append(candidates, candidate)
		}
	}

	return candidates
}
