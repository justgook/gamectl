package minimap

import "fmt"

// TileGrid manages tiles and their door connections in a coordinate system
type TileGrid struct {
	// grid stores tiles by "x_y" coordinate key
	grid map[string]int
}

// NewTileGrid creates a new empty TileGrid
func NewTileGrid() *TileGrid {
	return &TileGrid{
		grid: make(map[string]int),
	}
}

// getKey creates a coordinate key from x, y values
func (tg *TileGrid) getKey(x, y int) string {
	return fmt.Sprintf("%d_%d", x, y)
}

// GetTile returns the doors at the specified coordinates (0 if tile doesn't exist)
func (tg *TileGrid) GetTile(x, y int) int {
	key := tg.getKey(x, y)
	if doors, exists := tg.grid[key]; exists {
		return doors
	}
	return 0
}

// AddDoor adds a door (or multiple doors via bitmask) to an existing tile
func (tg *TileGrid) AddDoor(x, y, door int) *TileGrid {
	key := tg.getKey(x, y)
	currentDoors := tg.GetTile(x, y)
	tg.grid[key] = currentDoors | door
	return tg
}

// RemoveTile removes a tile and all its doors
func (tg *TileGrid) RemoveTile(x, y int) {
	key := tg.getKey(x, y)
	delete(tg.grid, key)
}
