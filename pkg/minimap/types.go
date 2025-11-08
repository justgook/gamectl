package minimap

// Door bit masks for NESW (North, East, South, West)
const (
	DoorNorth = 1 // 0001
	DoorEast  = 2 // 0010
	DoorSouth = 4 // 0100
	DoorWest  = 8 // 1000
)

// Coordinate represents a 2D position
type Coordinate [2]int

// TileOrigin indicates how a tile was created
type TileOrigin int

const (
	TileOriginShape      TileOrigin = 0 // Original tile from getRoomShape
	TileOriginConnection TileOrigin = 1 // Generated tile for room connections
)

// Output represents the generated minimap layout
type Output struct {
	Rooms  map[string]RoomOutput `json:"rooms"`
	Bounds BoundsData            `json:"bounds"`
}

// RoomOutput represents a room in the output format
type RoomOutput struct {
	Tiles       [][]int        `json:"tiles"`
	Doors       map[string]int `json:"doors"`
	TileOrigins map[string]int `json:"tileOrigins"` // "x_y" -> TileOrigin (0=shape, 1=connection)
}

// BoundsData represents the spatial bounds of the minimap
type BoundsData struct {
	MinX int `json:"minX"`
	MaxX int `json:"maxX"`
	MinY int `json:"minY"`
	MaxY int `json:"maxY"`
}

// TileMap represents a two-layer tilemap for storage
type TileMap struct {
	Layers []TileLayer       `json:"layers"`
	Meta   map[string]string `json:"meta"`
}

// TileLayer represents a single layer in the tilemap
type TileLayer struct {
	Width int               `json:"width"`
	Data  []uint32          `json:"data"`
	Meta  map[string]string `json:"meta"`
}
