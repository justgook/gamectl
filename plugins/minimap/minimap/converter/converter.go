package converter

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap/connection"
	"github.com/justgook/gamectl/plugins/minimap/minimap/placement"
	"github.com/justgook/gamectl/plugins/minimap/minimap/roomgen"
)

// TreeToTilemapConverter converts tree structures to tilemaps
type TreeToTilemapConverter struct {
	roomGen       *roomgen.RoomGenerator
	placementEng  *placement.PlacementEngine
	connectionEng *connection.ConnectionEngine
	rng           roomgen.Random
}

// NewTreeToTilemapConverter creates a new converter
func NewTreeToTilemapConverter(rng roomgen.Random) *TreeToTilemapConverter {
	roomGen := roomgen.NewRoomGenerator(rng)
	placementEng := placement.NewPlacementEngine(roomGen, rng)
	connectionEng := connection.NewConnectionEngine(roomGen, rng)

	return &TreeToTilemapConverter{
		roomGen:       roomGen,
		placementEng:  placementEng,
		connectionEng: connectionEng,
		rng:           rng,
	}
}

// ConvertResult contains the result of a tree-to-tilemap conversion
type ConvertResult struct {
	Tilemap    *tilemap.TileMap
	Rooms      []*placement.PlacedRoom
	Corridors  []*connection.Corridor
	Stats      map[string]interface{}
	Validation map[string]interface{}
}

// Convert converts a tree to a tilemap
func (c *TreeToTilemapConverter) Convert(t *tree.Tree) (*ConvertResult, error) {
	if len(*t) == 0 {
		return nil, fmt.Errorf("empty tree")
	}

	// Step 1: Place all rooms using the placement algorithm
	rooms, err := c.placementEng.PlaceTree(t)
	if err != nil {
		return nil, fmt.Errorf("failed to place rooms: %w", err)
	}

	// Step 2: Create corridors for disconnected parent-child pairs
	corridors, err := c.connectionEng.ConnectRooms(t, rooms)
	if err != nil {
		return nil, fmt.Errorf("failed to connect rooms: %w", err)
	}

	// Step 3: Convert to tilemap
	tileMap := c.createTilemap(rooms, corridors)

	// Step 4: Generate statistics and validation
	stats := c.placementEng.GetPlacementStats()
	validation := c.connectionEng.ValidateConnections(t, rooms, corridors)

	return &ConvertResult{
		Tilemap:    tileMap,
		Rooms:      rooms,
		Corridors:  corridors,
		Stats:      stats,
		Validation: validation,
	}, nil
}

// createTilemap converts placed rooms and corridors to a tilemap
func (c *TreeToTilemapConverter) createTilemap(rooms []*placement.PlacedRoom, corridors []*connection.Corridor) *tilemap.TileMap {
	// Calculate bounds
	minX, minY, maxX, maxY := c.calculateBounds(rooms, corridors)

	width := maxX - minX + 1
	height := maxY - minY + 1

	// Create tilemap
	tileMap := tilemap.NewTileMap()
	layer := tilemap.NewTileLayer(width, height)

	// Set metadata
	tileMap.Meta["generator"] = "tree-to-tilemap"
	tileMap.Meta["rooms"] = fmt.Sprintf("%d", len(rooms))
	tileMap.Meta["corridors"] = fmt.Sprintf("%d", len(corridors))

	layer.Meta["name"] = "rooms"
	layer.Meta["type"] = "room_layer"

	// Fill in room tiles
	for i, room := range rooms {
		roomTiles := c.roomGen.GetRoomTiles(room.Room)
		tileID := uint32(i + 1) // Room IDs start from 1 (0 is empty)

		for _, tile := range roomTiles {
			x := tile[0] - minX
			y := tile[1] - minY
			if x >= 0 && x < width && y >= 0 && y < height {
				index := y*width + x
				layer.Data[index] = tileID
			}
		}
	}

	// Fill in corridor tiles
	corridorTileID := uint32(len(rooms) + 1) // Corridors get a special tile ID
	for _, corridor := range corridors {
		for _, tile := range corridor.Tiles {
			x := tile[0] - minX
			y := tile[1] - minY
			if x >= 0 && x < width && y >= 0 && y < height {
				index := y*width + x
				// Only place corridor tile if the space is empty
				if layer.Data[index] == 0 {
					layer.Data[index] = corridorTileID
				}
			}
		}
	}

	tileMap.Layers = append(tileMap.Layers, *layer)
	return tileMap
}

// calculateBounds calculates the bounding box for all rooms and corridors
func (c *TreeToTilemapConverter) calculateBounds(rooms []*placement.PlacedRoom, corridors []*connection.Corridor) (minX, minY, maxX, maxY int) {
	if len(rooms) == 0 {
		return 0, 0, 0, 0
	}

	// Initialize with first room
	firstRoomTiles := c.roomGen.GetRoomTiles(rooms[0].Room)
	if len(firstRoomTiles) == 0 {
		return 0, 0, 0, 0
	}

	minX, minY = firstRoomTiles[0][0], firstRoomTiles[0][1]
	maxX, maxY = firstRoomTiles[0][0], firstRoomTiles[0][1]

	// Check all room tiles
	for _, room := range rooms {
		roomTiles := c.roomGen.GetRoomTiles(room.Room)
		for _, tile := range roomTiles {
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
	}

	// Check all corridor tiles
	for _, corridor := range corridors {
		for _, tile := range corridor.Tiles {
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
	}

	return minX, minY, maxX, maxY
}

// PrintTilemap prints a visual representation of the tilemap to console
func (c *TreeToTilemapConverter) PrintTilemap(result *ConvertResult) {
	if len(result.Tilemap.Layers) == 0 {
		fmt.Println("Empty tilemap")
		return
	}

	layer := result.Tilemap.Layers[0]
	width := layer.Width
	height := layer.Height()

	fmt.Printf("Tilemap (%dx%d):\n", width, height)
	fmt.Printf("Rooms: %d, Corridors: %d\n", len(result.Rooms), len(result.Corridors))
	fmt.Println()

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			index := y*width + x
			tileID := layer.Data[index]

			if tileID == 0 {
				fmt.Print(".")
			} else if int(tileID) <= len(result.Rooms) {
				// Room tile - use room number
				fmt.Printf("%d", tileID%10)
			} else {
				// Corridor tile
				fmt.Print("#")
			}
		}
		fmt.Println()
	}
	fmt.Println()
}

// PrintStats prints conversion statistics
func (c *TreeToTilemapConverter) PrintStats(result *ConvertResult) {
	fmt.Println("=== Conversion Statistics ===")
	for key, value := range result.Stats {
		fmt.Printf("%s: %v\n", key, value)
	}

	fmt.Println("\n=== Validation Results ===")
	for key, value := range result.Validation {
		fmt.Printf("%s: %v\n", key, value)
	}
	fmt.Println()
}
