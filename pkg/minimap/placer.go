package minimap

import (
	"fmt"
)

// MinimapGenerator handles minimap generation from a world tree
type MinimapGenerator struct {
	rooms        map[string][]Coordinate          // Tracks placed room tiles
	grid         map[string]bool                  // Track occupied positions
	doorGrid     *TileGrid                        // Track door placements
	tileOrigins  map[string]map[string]TileOrigin // roomID -> ("x_y" -> TileOrigin)
	roomToTileID map[string]int                   // Maps roomID → even tile number (2, 4, 6...)
	nextRoomTile int                              // Counter for assigning room tiles (starts at 2)
}

// NewMinimapGenerator creates a new generator
func NewMinimapGenerator() *MinimapGenerator {
	return &MinimapGenerator{
		rooms:        make(map[string][]Coordinate),
		grid:         make(map[string]bool),
		doorGrid:     NewTileGrid(),
		tileOrigins:  make(map[string]map[string]TileOrigin),
		roomToTileID: make(map[string]int),
		nextRoomTile: 2, // Start at 2 (even numbers for room tiles)
	}
}

// PlaceRoom attempts to place a room at the given position
// Returns the translated room coordinates if successful, or nil if placement failed
func (mg *MinimapGenerator) PlaceRoom(roomID string, shape []Coordinate, pos Coordinate) ([]Coordinate, error) {
	// Translate shape to position
	translated := TranslateShape(shape, pos)

	// Check if all tiles are available
	for _, coord := range translated {
		key := fmt.Sprintf("%d_%d", coord[0], coord[1])
		if mg.grid[key] {
			return nil, fmt.Errorf("cannot place room %s: position %v is occupied", roomID, coord)
		}
	}

	// Mark tiles as occupied
	for _, coord := range translated {
		key := fmt.Sprintf("%d_%d", coord[0], coord[1])
		mg.grid[key] = true
	}

	// Store room
	mg.rooms[roomID] = translated

	// Assign room tile ID if not already assigned
	if _, exists := mg.roomToTileID[roomID]; !exists {
		mg.roomToTileID[roomID] = mg.nextRoomTile
		mg.nextRoomTile += 2 // Increment by 2 to keep even numbers
	}

	// Initialize tile origins for this room - all original tiles from shape
	if mg.tileOrigins[roomID] == nil {
		mg.tileOrigins[roomID] = make(map[string]TileOrigin)
	}
	for _, coord := range translated {
		key := fmt.Sprintf("%d_%d", coord[0], coord[1])
		mg.tileOrigins[roomID][key] = TileOriginShape
	}

	return translated, nil
}

// RemoveRoom removes a room from the minimap (for backtracking)
func (mg *MinimapGenerator) RemoveRoom(roomID string) {
	tiles, exists := mg.rooms[roomID]
	if !exists {
		return
	}

	// Free grid tiles
	for _, coord := range tiles {
		key := fmt.Sprintf("%d_%d", coord[0], coord[1])
		delete(mg.grid, key)

		// Remove doors on this tile
		mg.doorGrid.RemoveTile(coord[0], coord[1])
	}

	// Remove room
	delete(mg.rooms, roomID)
	delete(mg.tileOrigins, roomID)
}

// ExpandRoomForDoors attempts to add tiles to a room to increase its door capacity
// Returns true if expansion was successful
func (mg *MinimapGenerator) ExpandRoomForDoors(roomID string, requiredDoors int, openDoors map[string]int) bool {
	tiles, exists := mg.rooms[roomID]
	if !exists || len(tiles) == 0 {
		return false
	}

	currentCapacity := mg.CountAvailableDoorPositions(tiles)
	if currentCapacity >= requiredDoors {
		return true // Already has enough
	}

	// Try to add tiles to expand the room
	directions := [][2]int{{0, -1}, {1, 0}, {0, 1}, {-1, 0}}
	maxExpansions := requiredDoors - currentCapacity + 2 // Add a bit extra for safety

	for attempt := 0; attempt < maxExpansions; attempt++ {
		// Find all possible expansion positions
		candidates := make([]Coordinate, 0)
		for _, tile := range tiles {
			for _, dir := range directions {
				candidate := Coordinate{tile[0] + dir[0], tile[1] + dir[1]}
				key := fmt.Sprintf("%d_%d", candidate[0], candidate[1])

				// Check if this position is free
				if !mg.grid[key] {
					// Check if not already in candidates
					alreadyAdded := false
					for _, existing := range candidates {
						if existing[0] == candidate[0] && existing[1] == candidate[1] {
							alreadyAdded = true
							break
						}
					}
					if !alreadyAdded {
						candidates = append(candidates, candidate)
					}
				}
			}
		}

		if len(candidates) == 0 {
			break // No more room to expand
		}

		// Try each candidate
		for _, candidate := range candidates {
			// Test if adding this tile helps and doesn't break constraints
			testTiles := append([]Coordinate{}, tiles...)
			testTiles = append(testTiles, candidate)

			// Check if this maintains freedom constraint
			if !mg.HasFreePathFrom([]Coordinate{candidate}) {
				continue
			}

			// Temporarily add the tile
			key := fmt.Sprintf("%d_%d", candidate[0], candidate[1])
			mg.grid[key] = true

			// Check that it doesn't block other open doors (excluding the room we're expanding)
			testOpenDoors := make(map[string]int)
			for k, v := range openDoors {
				if k != roomID { // Don't check the room we're expanding
					testOpenDoors[k] = v
				}
			}

			valid := mg.ValidateAllOpenDoorsHavePath(testOpenDoors)

			if valid {
				// Keep the expansion
				tiles = append(tiles, candidate)
				mg.rooms[roomID] = tiles

				// Update tile origins
				if mg.tileOrigins[roomID] == nil {
					mg.tileOrigins[roomID] = make(map[string]TileOrigin)
				}
				mg.tileOrigins[roomID][key] = TileOriginConnection

				// Check if we have enough capacity now
				currentCapacity = mg.CountAvailableDoorPositions(tiles)
				if currentCapacity >= requiredDoors {
					return true
				}
			} else {
				// Revert the temporary addition
				delete(mg.grid, key)
			}
		}
	}

	// Check final capacity
	return mg.CountAvailableDoorPositions(tiles) >= requiredDoors
}

// CanPlaceRoom checks if a room can be placed at the given position
func (mg *MinimapGenerator) CanPlaceRoom(shape []Coordinate, pos Coordinate) bool {
	translated := TranslateShape(shape, pos)

	for _, coord := range translated {
		key := fmt.Sprintf("%d_%d", coord[0], coord[1])
		if mg.grid[key] {
			return false
		}
	}

	return true
}

// GetUnblockedNeighbors returns neighbors around a room that are not occupied
func (mg *MinimapGenerator) GetUnblockedNeighbors(roomTiles []Coordinate) []Coordinate {
	neighbors := make(map[Coordinate]bool)
	directions := [][2]int{{0, -1}, {1, 0}, {0, 1}, {-1, 0}}

	for _, tile := range roomTiles {
		for _, dir := range directions {
			neighbor := Coordinate{tile[0] + dir[0], tile[1] + dir[1]}
			key := fmt.Sprintf("%d_%d", neighbor[0], neighbor[1])

			if !mg.grid[key] {
				neighbors[neighbor] = true
			}
		}
	}

	result := make([]Coordinate, 0, len(neighbors))
	for coord := range neighbors {
		result = append(result, coord)
	}
	return result
}

// GetRoomTiles returns the tiles occupied by a room
func (mg *MinimapGenerator) GetRoomTiles(roomID string) ([]Coordinate, bool) {
	tiles, exists := mg.rooms[roomID]
	return tiles, exists
}

// GetAllRoomIDs returns a map of all placed room IDs
func (mg *MinimapGenerator) GetAllRoomIDs() map[string]bool {
	result := make(map[string]bool, len(mg.rooms))
	for roomID := range mg.rooms {
		result[roomID] = true
	}
	return result
}

// ValidateAllOpenDoorsHavePath checks if all unconnected room edges can still reach free space
// This ensures we don't block future room placements
// openDoors: map of roomID -> number of children that still need to be placed
func (mg *MinimapGenerator) ValidateAllOpenDoorsHavePath(openDoors map[string]int) bool {
	for roomID, openCount := range openDoors {
		if openCount <= 0 {
			continue
		}

		roomTiles, exists := mg.GetRoomTiles(roomID)
		if !exists || len(roomTiles) == 0 {
			continue
		}

		// Check if this room has enough free neighbors for the open doors
		neighbors := mg.GetUnblockedNeighbors(roomTiles)
		if len(neighbors) < openCount {
			return false
		}

		// For each required open door, verify at least one neighbor has path to freedom
		// We need at least 'openCount' neighbors with paths to free space
		neighborsWithPath := 0
		for _, neighbor := range neighbors {
			// Check if a single tile at this neighbor position has path to freedom
			if mg.HasFreePathFrom([]Coordinate{neighbor}) {
				neighborsWithPath++
				if neighborsWithPath >= openCount {
					break
				}
			}
		}

		if neighborsWithPath < openCount {
			return false
		}
	}

	return true
}

// CountAvailableDoorPositions returns how many door positions are available for a room
func (mg *MinimapGenerator) CountAvailableDoorPositions(roomTiles []Coordinate) int {
	if len(roomTiles) == 0 {
		return 0
	}

	// Count unique unblocked neighbors
	neighborMap := make(map[Coordinate]bool)
	directions := [][2]int{{0, -1}, {1, 0}, {0, 1}, {-1, 0}}

	for _, tile := range roomTiles {
		for _, dir := range directions {
			neighbor := Coordinate{tile[0] + dir[0], tile[1] + dir[1]}
			key := fmt.Sprintf("%d_%d", neighbor[0], neighbor[1])

			// Check if this neighbor is free (not occupied by another room)
			if !mg.grid[key] {
				neighborMap[neighbor] = true
			}
		}
	}

	return len(neighborMap)
}

// GetBounds calculates the spatial bounds of all placed rooms
func (mg *MinimapGenerator) GetBounds() (minX, maxX, minY, maxY int, hasRooms bool) {
	if len(mg.rooms) == 0 {
		return 0, 0, 0, 0, false
	}

	minX, maxX = 1<<31-1, -(1 << 31)
	minY, maxY = 1<<31-1, -(1 << 31)

	for _, tiles := range mg.rooms {
		for _, coord := range tiles {
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

	return minX, maxX, minY, maxY, true
}

// ConvertToOutput converts the generated minimap to output format
func (mg *MinimapGenerator) ConvertToOutput() *Output {
	output := &Output{
		Rooms: make(map[string]RoomOutput),
	}

	// Convert rooms
	for roomID, tiles := range mg.rooms {
		roomOut := RoomOutput{
			Tiles:       make([][]int, len(tiles)),
			Doors:       make(map[string]int),
			TileOrigins: make(map[string]int),
		}

		for i, coord := range tiles {
			roomOut.Tiles[i] = []int{coord[0], coord[1]}
		}

		// Get doors for this room's tiles
		for _, coord := range tiles {
			doorKey := fmt.Sprintf("%d_%d", coord[0], coord[1])
			if doorMask := mg.doorGrid.GetTile(coord[0], coord[1]); doorMask > 0 {
				roomOut.Doors[doorKey] = doorMask
			}
		}

		// Get tile origins for this room
		if origins, exists := mg.tileOrigins[roomID]; exists {
			for tileKey, origin := range origins {
				roomOut.TileOrigins[tileKey] = int(origin)
			}
		}

		output.Rooms[roomID] = roomOut
	}

	// Set bounds
	if minX, maxX, minY, maxY, hasRooms := mg.GetBounds(); hasRooms {
		output.Bounds = BoundsData{minX, maxX, minY, maxY}
	}

	return output
}

// AddDoor adds a door between two tiles
func (mg *MinimapGenerator) AddDoor(x, y, door int) {
	mg.doorGrid.AddDoor(x, y, door)
}

// HasFreePathFrom validates the freedom constraint:
// All unfinished doors (doors that point to not-yet-placed neighboring rooms)
// must be able to reach the map boundary (free space outside the generated area)
// Returns true if all unfinished doors have a path to free space
func (mg *MinimapGenerator) HasFreePathFrom(roomTiles []Coordinate) bool {
	if len(roomTiles) == 0 {
		return true
	}

	// Get bounds of currently placed rooms
	minX, maxX, minY, maxY, hasBounds := mg.GetBounds()

	// If no bounds yet, we're placing the first room - always valid
	if !hasBounds {
		return true
	}

	// Expand bounds by 1 to define "outside"
	// Anything beyond these bounds is considered free space
	expandedMinX := minX - 1
	expandedMaxX := maxX + 1
	expandedMinY := minY - 1
	expandedMaxY := maxY + 1

	// BFS from each tile to check if it can reach free space
	visited := make(map[Coordinate]bool)
	queue := make([]Coordinate, 0)

	// Start BFS from all tiles in the new room
	for _, tile := range roomTiles {
		queue = append(queue, tile)
		visited[tile] = true
	}

	directions := [][2]int{{0, -1}, {1, 0}, {0, 1}, {-1, 0}}

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		// Check if we've reached free space (outside bounds)
		if current[0] < expandedMinX || current[0] > expandedMaxX ||
			current[1] < expandedMinY || current[1] > expandedMaxY {
			return true
		}

		// Explore neighbors
		for _, dir := range directions {
			next := Coordinate{current[0] + dir[0], current[1] + dir[1]}
			key := fmt.Sprintf("%d_%d", next[0], next[1])

			// Skip if already visited or if it's occupied by an existing room
			if visited[next] || mg.grid[key] {
				continue
			}

			visited[next] = true
			queue = append(queue, next)
		}
	}

	// If we couldn't reach free space, the path is blocked
	return false
}

// ConvertToTileMap converts the minimap to a two-layer tilemap format
// Layer 0: Doors (4-bit mask: NESW)
// Layer 1: Rooms (even numbers for room tiles, odd for connection tiles)
func (mg *MinimapGenerator) ConvertToTileMap() TileMap {
	// Calculate bounds
	minX, maxX, minY, maxY, hasBounds := mg.GetBounds()
	if !hasBounds {
		// Return empty tilemap if no rooms placed
		return TileMap{
			Layers: []TileLayer{
				{Width: 0, Data: []uint32{}, Meta: map[string]string{"name": "doors"}},
				{Width: 0, Data: []uint32{}, Meta: map[string]string{"name": "rooms"}},
			},
			Meta: map[string]string{"type": "minimap"},
		}
	}

	width := maxX - minX + 1
	height := maxY - minY + 1

	// Create two layers
	doorsLayer := TileLayer{
		Width: width,
		Data:  make([]uint32, width*height),
		Meta:  map[string]string{"name": "doors", "description": "Door connections (NESW bit mask)"},
	}

	roomsLayer := TileLayer{
		Width: width,
		Data:  make([]uint32, width*height),
		Meta:  map[string]string{"name": "rooms", "description": "Room tiles (even) and connections (odd)"},
	}

	// Create reverse map: coordinate -> roomID
	coordToRoom := make(map[string]string)
	for roomID, tiles := range mg.rooms {
		for _, coord := range tiles {
			key := fmt.Sprintf("%d_%d", coord[0], coord[1])
			coordToRoom[key] = roomID
		}
	}

	// Fill layers by iterating through all coordinates in bounds
	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			key := fmt.Sprintf("%d_%d", x, y)
			localX := x - minX
			localY := y - minY
			idx := localY*width + localX
			localKey := fmt.Sprintf("%d_%d", localX, localY)

			// Layer 0: Doors
			doorMask := mg.doorGrid.GetTile(x, y)
			doorsLayer.Data[idx] = uint32(doorMask)

			// Layer 1: Rooms
			if roomID, exists := coordToRoom[key]; exists {
				roomTileID := mg.roomToTileID[roomID]

				// Check tile origin
				origin := TileOriginShape // Default
				if origins, hasOrigins := mg.tileOrigins[roomID]; hasOrigins {
					if tileOrigin, hasOrigin := origins[key]; hasOrigin {
						origin = tileOrigin
						if origin == TileOriginConnection {
							// Connection tiles are odd (roomTileID - 1)
							roomsLayer.Data[idx] = uint32(roomTileID - 1)
						} else {
							// Room tiles are even
							roomsLayer.Data[idx] = uint32(roomTileID)
						}
					} else {
						// Room tiles are even
						roomsLayer.Data[idx] = uint32(roomTileID)
					}
				} else {
					// Default to room tile (even)
					roomsLayer.Data[idx] = uint32(roomTileID)
				}

				// Add per-tile metadata to roomsLayer.Meta
				// Store room name and origin (doors are in separate layer)
				roomsLayer.Meta[localKey] = fmt.Sprintf(`{"room":"%s","origin":%d}`, roomID, origin)
			}
			// else: tile is empty (0)
		}
	}

	// Create tilemap
	return TileMap{
		Layers: []TileLayer{doorsLayer, roomsLayer},
		Meta: map[string]string{
			"type": "minimap",
			"minX": fmt.Sprintf("%d", minX),
			"maxX": fmt.Sprintf("%d", maxX),
			"minY": fmt.Sprintf("%d", minY),
			"maxY": fmt.Sprintf("%d", maxY),
		},
	}
}
