package gen

// Point represents a 2D coordinate
type Point struct {
	X, Y int
}

// Add returns a new Point offset by the given delta
func (p Point) Add(dx, dy int) Point {
	return Point{X: p.X + dx, Y: p.Y + dy}
}

// Neighbors returns the 4 cardinal neighbors of this point
func (p Point) Neighbors() [4]Point {
	return [4]Point{
		{p.X, p.Y - 1}, // North
		{p.X + 1, p.Y}, // East
		{p.X, p.Y + 1}, // South
		{p.X - 1, p.Y}, // West
	}
}

// ManhattanDistance returns the Manhattan distance to another point
func (p Point) ManhattanDistance(other Point) int {
	dx := p.X - other.X
	dy := p.Y - other.Y
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}
	return dx + dy
}

// Rect represents a rectangle in tile coordinates
type Rect struct {
	X, Y          int // Top-left corner
	Width, Height int
}

// Contains checks if a point is within the rectangle
func (r Rect) Contains(p Point) bool {
	return p.X >= r.X && p.X < r.X+r.Width &&
		p.Y >= r.Y && p.Y < r.Y+r.Height
}

// Center returns the center point of the rectangle
func (r Rect) Center() Point {
	return Point{
		X: r.X + r.Width/2,
		Y: r.Y + r.Height/2,
	}
}

// Direction constants
const (
	DirNorth = 0
	DirEast  = 1
	DirSouth = 2
	DirWest  = 3
)

// Door direction bit masks (matching scaler encoding)
const (
	DoorNorth uint8 = 1
	DoorEast  uint8 = 2
	DoorSouth uint8 = 4
	DoorWest  uint8 = 8
)

// NodeType identifies the type of navigation node
type NodeType int

const (
	NodeExit     NodeType = iota // Room exit (door)
	NodeHub                      // Connection hub (shared traversal point)
	NodeJunction                 // Path junction/bend
)

// NavNode represents a point in the navigation graph
type NavNode struct {
	ID       int
	Position Point    // Tile coordinates within room
	Type     NodeType // Exit, Hub, Junction
	Exit     *ExitInfo
}

// ExitInfo contains information about a door/exit
type ExitInfo struct {
	Direction uint8   // North, South, East, West bitmask
	DoorTiles []Point // Actual door tile positions
	RoomID    int     // Which room this exit belongs to
}

// NavEdge represents a connection between navigation nodes
type NavEdge struct {
	FromID, ToID int           // Node IDs
	Segments     []PathSegment // Movement segments composing this edge
	Cost         int           // Traversal cost/difficulty
}

// SegmentType identifies the type of movement segment
type SegmentType int

const (
	SegmentPlatform       SegmentType = iota // Solid platform (walkable)
	SegmentOnewayPlatform                    // One-way platform (drop-through)
	SegmentLadder                            // Vertical ladder
	SegmentJump                              // Jump arc (no tiles, movement only)
	SegmentDrop                              // Drop/fall (no tiles, movement only)
	SegmentWallJump                          // Wall jump surface
	SegmentGrapple                           // Grapple point
	SegmentDoubleJump                        // Double jump marker (air position)
)

// PathSegment represents a single movement segment
type PathSegment struct {
	Type      SegmentType
	Start     Point
	End       Point
	Tiles     []Point // Tiles this segment occupies (empty for jumps/drops)
	Direction int     // For wall jumps: which wall (DirEast/DirWest)
}

// Length returns the segment length
func (s PathSegment) Length() int {
	dx := s.End.X - s.Start.X
	dy := s.End.Y - s.Start.Y
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}
	if dx > dy {
		return dx
	}
	return dy
}

// GetTiles returns all tiles occupied by this segment
func (s PathSegment) GetTiles() []Point {
	if len(s.Tiles) > 0 {
		return s.Tiles
	}

	// Calculate tiles for segments that generate them
	switch s.Type {
	case SegmentPlatform, SegmentOnewayPlatform:
		return horizontalTiles(s.Start, s.End)
	case SegmentLadder:
		return verticalTiles(s.Start, s.End)
	case SegmentWallJump:
		return verticalTiles(s.Start, s.End)
	case SegmentGrapple:
		return []Point{s.End} // Just the grapple point
	default:
		return nil // Jumps and drops don't occupy tiles
	}
}

// horizontalTiles generates tiles for a horizontal segment
func horizontalTiles(start, end Point) []Point {
	tiles := []Point{}
	minX, maxX := start.X, end.X
	if minX > maxX {
		minX, maxX = maxX, minX
	}
	y := start.Y
	for x := minX; x <= maxX; x++ {
		tiles = append(tiles, Point{x, y})
	}
	return tiles
}

// verticalTiles generates tiles for a vertical segment
func verticalTiles(start, end Point) []Point {
	tiles := []Point{}
	minY, maxY := start.Y, end.Y
	if minY > maxY {
		minY, maxY = maxY, minY
	}
	x := start.X
	for y := minY; y <= maxY; y++ {
		tiles = append(tiles, Point{x, y})
	}
	return tiles
}

// PlayerAbilities defines what movement abilities are available
type PlayerAbilities struct {
	// Basic abilities
	JumpHeight   int // Max tiles player can jump up
	JumpDistance int // Max horizontal jump distance

	// Special abilities (configurable)
	CanUseLadders    bool // Can climb ladders
	CanDropThrough   bool // Can drop through one-way platforms
	CanWallJump      bool // Can wall jump
	CanGrapple       bool // Can use grapple points
	CanDoubleJump    bool // Can double jump
	DoubleJumpHeight int  // Additional height from double jump
	WallJumpHeight   int  // Height gained from wall jump
	WallJumpDistance int  // Horizontal distance from wall jump
	GrappleRange     int  // Max grapple distance
}

// DefaultAbilities returns standard platformer abilities
func DefaultAbilities() PlayerAbilities {
	return PlayerAbilities{
		JumpHeight:       2,
		JumpDistance:     3,
		CanUseLadders:    true,
		CanDropThrough:   true,
		CanWallJump:      false,
		CanGrapple:       false,
		CanDoubleJump:    false,
		DoubleJumpHeight: 2,
		WallJumpHeight:   2,
		WallJumpDistance: 2,
		GrappleRange:     5,
	}
}

// VarietyConfig controls randomness in path generation
type VarietyConfig struct {
	Level          VarietyLevel // Overall variety level
	StaircaseProb  float64      // Probability of converting platforms to staircases
	LadderJogProb  float64      // Probability of adding jogs to ladders
	HubOffsetRange int          // Max random offset for hub placement
}

// VarietyLevel defines how much randomness to apply
type VarietyLevel int

const (
	VarietyNone   VarietyLevel = iota // No randomness
	VarietyLow                        // Subtle variations
	VarietyMedium                     // Moderate variations
	VarietyHigh                       // Significant variations
)

// DefaultVariety returns low variety configuration
func DefaultVariety() VarietyConfig {
	return VarietyConfig{
		Level:          VarietyLow,
		StaircaseProb:  0.2,
		LadderJogProb:  0.1,
		HubOffsetRange: 1,
	}
}

// GetVarietyConfig returns a config for the specified level
func GetVarietyConfig(level VarietyLevel) VarietyConfig {
	switch level {
	case VarietyNone:
		return VarietyConfig{
			Level:          VarietyNone,
			StaircaseProb:  0.0,
			LadderJogProb:  0.0,
			HubOffsetRange: 0,
		}
	case VarietyLow:
		return VarietyConfig{
			Level:          VarietyLow,
			StaircaseProb:  0.2,
			LadderJogProb:  0.1,
			HubOffsetRange: 1,
		}
	case VarietyMedium:
		return VarietyConfig{
			Level:          VarietyMedium,
			StaircaseProb:  0.4,
			LadderJogProb:  0.25,
			HubOffsetRange: 2,
		}
	case VarietyHigh:
		return VarietyConfig{
			Level:          VarietyHigh,
			StaircaseProb:  0.6,
			LadderJogProb:  0.4,
			HubOffsetRange: 3,
		}
	default:
		return DefaultVariety()
	}
}

// TileIDConfig maps segment types to tile IDs in the output geometry layer.
//
// TILE ID MEANINGS (for geometry layer):
//
//	1 = Platform       - Solid walkable surface
//	2 = OnewayPlatform - Can stand on top, can drop through from above
//	3 = Ladder         - Vertical climbable surface
//	4 = WallJumpLeft   - Left wall surface for wall jumping
//	5 = WallJumpRight  - Right wall surface for wall jumping
//	6 = GrapplePoint   - Grapple hook attachment point
//	0 = Empty          - No geometry (air)
type TileIDConfig struct {
	Platform       uint32 // Solid platform (default: 1)
	OnewayPlatform uint32 // One-way platform (default: 2)
	Ladder         uint32 // Ladder (default: 3)
	WallJumpLeft   uint32 // Left wall jump surface (default: 4)
	WallJumpRight  uint32 // Right wall jump surface (default: 5)
	GrapplePoint   uint32 // Grapple hook point (default: 6)
}

// DefaultTileIDs returns default tile ID mappings
func DefaultTileIDs() TileIDConfig {
	return TileIDConfig{
		Platform:       1,
		OnewayPlatform: 2,
		Ladder:         3,
		WallJumpLeft:   4,
		WallJumpRight:  5,
		GrapplePoint:   6,
	}
}

// RoomShape represents the actual shape of a room (not just bounding box)
// This is used for non-rectangular rooms to ensure geometry stays within valid tiles
type RoomShape struct {
	Tiles  map[Point]bool // Set of tiles that belong to this room
	Bounds Rect           // Bounding box (for quick rejection)
}

// NewRoomShape creates a RoomShape from a list of tiles
func NewRoomShape(tiles []Point) *RoomShape {
	shape := &RoomShape{
		Tiles: make(map[Point]bool, len(tiles)),
	}

	if len(tiles) == 0 {
		return shape
	}

	// Build tile set and calculate bounds
	minX, minY := tiles[0].X, tiles[0].Y
	maxX, maxY := tiles[0].X, tiles[0].Y

	for _, t := range tiles {
		shape.Tiles[t] = true
		if t.X < minX {
			minX = t.X
		}
		if t.Y < minY {
			minY = t.Y
		}
		if t.X > maxX {
			maxX = t.X
		}
		if t.Y > maxY {
			maxY = t.Y
		}
	}

	shape.Bounds = Rect{
		X:      minX,
		Y:      minY,
		Width:  maxX - minX + 1,
		Height: maxY - minY + 1,
	}

	return shape
}

// Contains checks if a point is within the room shape
func (s *RoomShape) Contains(p Point) bool {
	if s == nil || s.Tiles == nil {
		return false
	}
	return s.Tiles[p]
}

// ContainsAll checks if all points are within the room shape
func (s *RoomShape) ContainsAll(points []Point) bool {
	for _, p := range points {
		if !s.Contains(p) {
			return false
		}
	}
	return true
}

// FindNearestInside finds the nearest point inside the room from a given point
func (s *RoomShape) FindNearestInside(p Point) Point {
	if s.Contains(p) {
		return p
	}

	// Search in expanding rings
	for radius := 1; radius < 20; radius++ {
		for dy := -radius; dy <= radius; dy++ {
			for dx := -radius; dx <= radius; dx++ {
				if dx*dx+dy*dy > radius*radius {
					continue
				}
				candidate := Point{p.X + dx, p.Y + dy}
				if s.Contains(candidate) {
					return candidate
				}
			}
		}
	}

	// Fallback: return center of bounds
	return s.Bounds.Center()
}

// NavigationGraph represents the complete navigation structure
type NavigationGraph struct {
	Nodes []NavNode
	Edges []NavEdge
}

// Random interface for pluggable random number generation
type Random interface {
	Intn(n int) int
	Float64() float64
}

// MovementTier classifies player abilities into tiers
type MovementTier int

const (
	// TierBasic includes walk, jump, ladder - guaranteed reachable paths
	TierBasic MovementTier = iota
	// TierIntermediate adds wall jump, double jump
	TierIntermediate
	// TierAdvanced adds grapple and other special abilities
	TierAdvanced
)

// GetTier returns the movement tier based on player abilities
func (a PlayerAbilities) GetTier() MovementTier {
	if a.CanGrapple {
		return TierAdvanced
	}
	if a.CanWallJump || a.CanDoubleJump {
		return TierIntermediate
	}
	return TierBasic
}

// EffectiveJumpHeight returns the maximum height achievable with current abilities
func (a PlayerAbilities) EffectiveJumpHeight() int {
	height := a.JumpHeight
	if a.CanDoubleJump {
		height += a.DoubleJumpHeight
	}
	return height
}

// EffectiveVerticalReach returns max vertical reach considering all abilities
func (a PlayerAbilities) EffectiveVerticalReach() int {
	if a.CanUseLadders {
		return 100 // Ladders can reach any height within room
	}
	reach := a.EffectiveJumpHeight()
	if a.CanWallJump {
		// Wall jumps can extend reach significantly
		reach += a.WallJumpHeight * 3
	}
	if a.CanGrapple {
		reach += a.GrappleRange
	}
	return reach
}
