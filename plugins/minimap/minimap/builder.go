package minimap

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
)

// Coordinate represents a 2D position
type Coordinate [2]int

// Room represents a room with its position and shape
type Room struct {
	ID       int        // Index in tree
	Position Coordinate // Top-left position of room origin
	Shape    RoomShape  // Original room shape (relative coordinates)
	Node     *tree.Node // Reference to tree node
}

// TileInfo contains information about each tile in the map
type TileInfo struct {
	RoomID   int    // Which room this tile belongs to
	TileType string // "shape" (original room) or "connection" (corridor)
}

// MinimapBuilder handles the two-phase generation
type MinimapBuilder struct {
	rooms map[int]*Room           // nodeIndex -> Room
	tiles map[Coordinate]TileInfo // coordinate -> tile info
	tree  tree.Tree
}

// NewMinimapBuilder creates a new builder
func NewMinimapBuilder(tree tree.Tree) *MinimapBuilder {
	return &MinimapBuilder{
		rooms: make(map[int]*Room),
		tiles: make(map[Coordinate]TileInfo),
		tree:  tree,
	}
}

// PlaceAllRooms implements Phase 1: breadth-first room placement
func (b *MinimapBuilder) PlaceAllRooms(getRoomShape GetRoomShapeFunc) error {
	// Build level-by-level structure for breadth-first processing
	levels := b.buildLevels()

	// Place rooms level by level (breadth-first)
	for level, nodes := range levels {
		fmt.Printf("Placing level %d with %d rooms\n", level, len(nodes))
		for _, node := range nodes {
			if err := b.placeRoom(node, getRoomShape); err != nil {
				return fmt.Errorf("failed to place room for node %d: %v", b.tree.IndexOf(node), err)
			}
		}
	}

	return nil
}

// buildLevels organizes tree nodes by depth for breadth-first processing
func (b *MinimapBuilder) buildLevels() []([]*tree.Node) {
	levels := []([]*tree.Node){}

	// Find root node (ParentId == -1)
	var root *tree.Node
	for _, node := range b.tree {
		if node.ParentId == -1 {
			root = node
			break
		}
	}

	if root == nil {
		return levels
	}

	// Build levels using BFS
	currentLevel := []*tree.Node{root}

	for len(currentLevel) > 0 {
		levels = append(levels, currentLevel)

		// Build next level from current level's children
		var nextLevel []*tree.Node
		for _, node := range currentLevel {
			for child := range b.tree.Children(node) {
				nextLevel = append(nextLevel, child)
			}
		}
		currentLevel = nextLevel
	}

	return levels
}

// placeRoom places a single room at its ideal position
func (b *MinimapBuilder) placeRoom(node *tree.Node, getRoomShape GetRoomShapeFunc) error {
	nodeIndex := b.tree.IndexOf(node)
	shape := getRoomShape(node)
	position := b.calculateIdealPosition(node, shape)

	// Create room
	room := &Room{
		ID:       nodeIndex,
		Position: position,
		Shape:    shape,
		Node:     node,
	}

	b.rooms[nodeIndex] = room

	// Place all tiles for this room
	b.placeRoomTiles(room)

	fmt.Printf("Placed room %d at %v with shape %v\n", nodeIndex, position, shape)
	return nil
}

// calculateIdealPosition determines where to place a room
func (b *MinimapBuilder) calculateIdealPosition(node *tree.Node, shape RoomShape) Coordinate {
	// Root node at origin
	if node.ParentId == -1 {
		return Coordinate{0, 0}
	}

	// For child nodes, place them in a spiral around parent
	parent := b.rooms[node.ParentId]
	if parent == nil {
		// Parent should have been placed already due to breadth-first order
		return Coordinate{0, 0} // Fallback
	}

	// Calculate child index among siblings
	siblingIndex := 0
	for child := range b.tree.Children(parent.Node) {
		if child == node {
			break
		}
		siblingIndex++
	}

	// Place children in cardinal directions around parent
	directions := []Coordinate{
		{1, 0},   // East
		{0, 1},   // South
		{-1, 0},  // West
		{0, -1},  // North
		{1, 1},   // SE
		{-1, 1},  // SW
		{-1, -1}, // NW
		{1, -1},  // NE
	}

	direction := directions[siblingIndex%len(directions)]

	// Calculate distance based on shape size
	shapeSize := b.getShapeSize(shape)
	distance := shapeSize + 1 // Leave gap for corridors

	// Additional spacing for multiple children
	ringIndex := siblingIndex / len(directions)
	distance += ringIndex * 3

	return Coordinate{
		parent.Position[0] + direction[0]*distance,
		parent.Position[1] + direction[1]*distance,
	}
}

// getShapeSize returns the maximum dimension of a shape
func (b *MinimapBuilder) getShapeSize(shape RoomShape) int {
	if len(shape) == 0 {
		return 1
	}

	minX, maxX := shape[0][0], shape[0][0]
	minY, maxY := shape[0][1], shape[0][1]

	for _, tile := range shape {
		if tile[0] < minX {
			minX = tile[0]
		}
		if tile[0] > maxX {
			maxX = tile[0]
		}
		if tile[1] < minY {
			minY = tile[1]
		}
		if tile[1] > maxY {
			maxY = tile[1]
		}
	}

	width := maxX - minX + 1
	height := maxY - minY + 1

	if width > height {
		return width
	}
	return height
}

// placeRoomTiles places all tiles for a room
func (b *MinimapBuilder) placeRoomTiles(room *Room) {
	for _, relativeTile := range room.Shape {
		absoluteCoord := Coordinate{
			room.Position[0] + relativeTile[0],
			room.Position[1] + relativeTile[1],
		}

		b.tiles[absoluteCoord] = TileInfo{
			RoomID:   room.ID,
			TileType: "shape",
		}
	}
}

// ConnectAllRooms implements Phase 2: corridor generation
func (b *MinimapBuilder) ConnectAllRooms() error {
	fmt.Printf("Connecting all rooms with corridors\n")

	// Connect each child to its parent
	for _, room := range b.rooms {
		if room.Node.ParentId >= 0 {
			if err := b.connectRoomToParent(room); err != nil {
				return fmt.Errorf("failed to connect room %d to parent: %v", room.ID, err)
			}
		}
	}

	return nil
}

// connectRoomToParent creates a corridor from child room to parent room
func (b *MinimapBuilder) connectRoomToParent(childRoom *Room) error {
	parentRoom := b.rooms[childRoom.Node.ParentId]
	if parentRoom == nil {
		return fmt.Errorf("parent room not found")
	}

	// Find closest points between child and parent
	childTile := b.getClosestRoomTile(childRoom, parentRoom)
	parentTile := b.getClosestRoomTile(parentRoom, childRoom)

	// Generate corridor path
	path := b.generateCorridorPath(parentTile, childTile)

	// Add corridor tiles to parent room (parent extends to reach children)
	for _, tile := range path {
		// Skip tiles that are already occupied by rooms
		if existingTile, exists := b.tiles[tile]; exists {
			// If it's already a shape tile, don't overwrite
			if existingTile.TileType == "shape" {
				continue
			}
		}

		b.tiles[tile] = TileInfo{
			RoomID:   parentRoom.ID, // Corridor belongs to parent
			TileType: "connection",
		}
	}

	fmt.Printf("Connected room %d to parent %d with %d corridor tiles (assigned to parent)\n",
		childRoom.ID, parentRoom.ID, len(path))

	return nil
}

// getClosestRoomTile finds the tile in roomA that's closest to roomB
func (b *MinimapBuilder) getClosestRoomTile(roomA, roomB *Room) Coordinate {
	minDistance := int(^uint(0) >> 1) // Max int
	var closestTile Coordinate

	// Check all tiles in roomA
	for _, relativeTile := range roomA.Shape {
		tileA := Coordinate{
			roomA.Position[0] + relativeTile[0],
			roomA.Position[1] + relativeTile[1],
		}

		// Find distance to closest tile in roomB
		for _, relativeTarget := range roomB.Shape {
			tileB := Coordinate{
				roomB.Position[0] + relativeTarget[0],
				roomB.Position[1] + relativeTarget[1],
			}

			distance := b.manhattanDistance(tileA, tileB)
			if distance < minDistance {
				minDistance = distance
				closestTile = tileA
			}
		}
	}

	return closestTile
}

// manhattanDistance calculates Manhattan distance between two coordinates
func (b *MinimapBuilder) manhattanDistance(a, coord2 Coordinate) int {
	dx := a[0] - coord2[0]
	dy := a[1] - coord2[1]
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}
	return dx + dy
}

// generateCorridorPath creates a simple L-shaped path between two points
func (b *MinimapBuilder) generateCorridorPath(start, end Coordinate) []Coordinate {
	var path []Coordinate

	// Simple L-shaped path: horizontal first, then vertical
	current := start

	// Horizontal movement
	for current[0] != end[0] {
		if current[0] < end[0] {
			current[0]++
		} else {
			current[0]--
		}
		path = append(path, current)
	}

	// Vertical movement
	for current[1] != end[1] {
		if current[1] < end[1] {
			current[1]++
		} else {
			current[1]--
		}
		path = append(path, current)
	}

	return path
}

// BuildTileMap converts internal representation to tilemap format
func (b *MinimapBuilder) BuildTileMap() *tilemap.TileMap {
	// Calculate bounds
	minX, maxX, minY, maxY := b.calculateBounds()

	width := maxX - minX + 1
	height := maxY - minY + 1

	// Create room and door layers
	roomLayer := tilemap.NewTileLayer(width, height)
	doorLayer := tilemap.NewTileLayer(width, height)

	// Fill layers
	for coord, tileInfo := range b.tiles {
		// Convert to array index
		x := coord[0] - minX
		y := coord[1] - minY
		index := y*width + x

		// Room layer: room ID (1-based)
		roomLayer.Data[index] = uint32(tileInfo.RoomID + 1)

		// Door layer: calculate door directions
		doorLayer.Data[index] = b.calculateDoorMask(coord, tileInfo)
	}

	return &tilemap.TileMap{
		Layers: []tilemap.TileLayer{*roomLayer, *doorLayer},
	}
}

// calculateBounds finds the bounding rectangle of all tiles
func (b *MinimapBuilder) calculateBounds() (minX, maxX, minY, maxY int) {
	first := true
	for coord := range b.tiles {
		if first {
			minX, maxX = coord[0], coord[0]
			minY, maxY = coord[1], coord[1]
			first = false
		} else {
			if coord[0] < minX {
				minX = coord[0]
			}
			if coord[0] > maxX {
				maxX = coord[0]
			}
			if coord[1] < minY {
				minY = coord[1]
			}
			if coord[1] > maxY {
				maxY = coord[1]
			}
		}
	}
	return
}

// Door bit flags
const (
	DoorNorth = 1 // 0001
	DoorEast  = 2 // 0010
	DoorSouth = 4 // 0100
	DoorWest  = 8 // 1000
)

// calculateDoorMask determines which doors exist at a coordinate
func (b *MinimapBuilder) calculateDoorMask(coord Coordinate, tileInfo TileInfo) uint32 {
	doors := uint32(0)

	// Check adjacent tiles in each direction
	directions := []struct {
		offset Coordinate
		flag   uint32
	}{
		{Coordinate{0, -1}, DoorNorth},
		{Coordinate{1, 0}, DoorEast},
		{Coordinate{0, 1}, DoorSouth},
		{Coordinate{-1, 0}, DoorWest},
	}

	for _, dir := range directions {
		adjacent := Coordinate{
			coord[0] + dir.offset[0],
			coord[1] + dir.offset[1],
		}

		// Check if adjacent tile exists and belongs to a different room
		if adjTileInfo, exists := b.tiles[adjacent]; exists {
			if adjTileInfo.RoomID != tileInfo.RoomID {
				// Only add door if this coordinate is the designated door location for this room pair
				if b.isDesignatedDoorPair(coord, adjacent, tileInfo.RoomID, adjTileInfo.RoomID) {
					doors |= dir.flag
				}
			}
		}
	}

	return doors
}


// isDesignatedDoorPair checks if the pair (coordA, coordB) is the single designated door location
func (b *MinimapBuilder) isDesignatedDoorPair(coordA, coordB Coordinate, roomA, roomB int) bool {
	// Ensure consistent ordering for getDesignatedDoorPair call
	r1, r2 := roomA, roomB
	c1, c2 := coordA, coordB

	// Canonicalize the room IDs for the lookup key
	if roomA > roomB {
		r1, r2 = roomB, roomA
		c1, c2 = coordB, coordA // Swap coordinates to match the canonical room order
	}

	room1Obj := b.rooms[r1]
	room2Obj := b.rooms[r2]

	if room1Obj == nil || room2Obj == nil {
		return false
	}

	// CRITICAL: Only allow doors between rooms that have a direct parent-child relationship
	isParentChild := (room1Obj.Node.ParentId == r2) || (room2Obj.Node.ParentId == r1)
	if !isParentChild {
		return false // No doors between non-parent-child rooms
	}

	// Find the designated door pair for this room connection.
	// This call will return a pair (TileA, TileB) where TileA is in r1 and TileB is in r2.
	designatedPair := b.getDesignatedDoorPair(r1, r2)
	if designatedPair == nil {
		return false
	}

	// Check if the canonicalized input pair (c1, c2) matches the designated pair (TileA, TileB).
	return designatedPair.TileA == c1 && designatedPair.TileB == c2
}
// getDesignatedDoorPair finds the single adjacent pair where doors should be placed for a room connection
func (b *MinimapBuilder) getDesignatedDoorPair(roomA, roomB int) *AdjacentPair {
	// Find all adjacent tiles between these two rooms
	adjacentPairs := b.findAdjacentTilesBetweenRooms(roomA, roomB)

	// If there are no adjacent pairs, no door
	if len(adjacentPairs) == 0 {
		return nil
	}

	// Find the lexicographically smallest coordinate pair
	var designatedPair *AdjacentPair

	for i, pair := range adjacentPairs {
		if designatedPair == nil {
			designatedPair = &adjacentPairs[i]
		} else {
			// Prefer pairs involving shape tiles over corridor tiles
			currentHasShape := b.pairHasShapeTile(pair)
			designatedHasShape := b.pairHasShapeTile(*designatedPair)

			if currentHasShape && !designatedHasShape {
				// Current pair has shape tile, designated doesn't - prefer current
				designatedPair = &adjacentPairs[i]
			} else if currentHasShape == designatedHasShape {
				// Both have same shape preference, use lexicographic ordering
				if b.isAdjacentPairSmaller(pair, *designatedPair) {
					designatedPair = &adjacentPairs[i]
				}
			}
			// If designated has shape and current doesn't, keep designated
		}
	}

	return designatedPair
}

// isAdjacentPairSmaller compares two adjacent pairs lexicographically
func (b *MinimapBuilder) isAdjacentPairSmaller(pair1, pair2 AdjacentPair) bool {
	// Compare based on the lexicographically smallest coordinate in each pair
	min1 := pair1.TileA
	if b.isCoordinateSmaller(pair1.TileB, pair1.TileA) {
		min1 = pair1.TileB
	}

	min2 := pair2.TileA
	if b.isCoordinateSmaller(pair2.TileB, pair2.TileA) {
		min2 = pair2.TileB
	}

	return b.isCoordinateSmaller(min1, min2)
}

type AdjacentPair struct {
	TileA, TileB Coordinate
	RoomA, RoomB int
}

// findAdjacentTilesBetweenRooms finds all adjacent tile pairs between two specific rooms
func (b *MinimapBuilder) findAdjacentTilesBetweenRooms(roomA, roomB int) []AdjacentPair {
	var pairs []AdjacentPair

	directions := []Coordinate{
		{0, -1}, {1, 0}, {0, 1}, {-1, 0}, // N, E, S, W
	}

	// Check all tiles in roomA
	for coord, tileInfo := range b.tiles {
		if tileInfo.RoomID != roomA {
			continue
		}

		// Check if any adjacent tile belongs to roomB
		for _, dir := range directions {
			adjacent := Coordinate{
				coord[0] + dir[0],
				coord[1] + dir[1],
			}

			if adjTileInfo, exists := b.tiles[adjacent]; exists && adjTileInfo.RoomID == roomB {
				pairs = append(pairs, AdjacentPair{
					TileA: coord,
					TileB: adjacent,
					RoomA: roomA,
					RoomB: roomB,
				})
			}
		}
	}

	return pairs
}

// isCoordinateSmaller compares two coordinates lexicographically
func (b *MinimapBuilder) isCoordinateSmaller(coord1, coord2 Coordinate) bool {
	if coord1[0] != coord2[0] {
		return coord1[0] < coord2[0]
	}
	return coord1[1] < coord2[1]
}

// pairHasShapeTile returns true if either tile in the pair is a shape tile
func (b *MinimapBuilder) pairHasShapeTile(pair AdjacentPair) bool {
	tileA, existsA := b.tiles[pair.TileA]
	tileB, existsB := b.tiles[pair.TileB]

	if !existsA || !existsB {
		return false
	}

	return tileA.TileType == "shape" || tileB.TileType == "shape"
}
