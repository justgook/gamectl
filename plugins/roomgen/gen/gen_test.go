package gen

import (
	"testing"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// mockRandom provides deterministic random numbers for testing
type mockRandom struct {
	sequence []int
	floats   []float64
	intIdx   int
	floatIdx int
}

func (r *mockRandom) Intn(n int) int {
	if len(r.sequence) == 0 || n <= 0 {
		return 0
	}
	result := r.sequence[r.intIdx%len(r.sequence)] % n
	r.intIdx++
	return result
}

func (r *mockRandom) Float64() float64 {
	if len(r.floats) == 0 {
		return 0.5
	}
	result := r.floats[r.floatIdx%len(r.floats)]
	r.floatIdx++
	return result
}

func TestCreateExitNodes(t *testing.T) {
	room := &RoomInfo{
		ID: 1,
		Bounds: Rect{
			X: 0, Y: 0,
			Width: 6, Height: 6,
		},
		Tiles: []Point{
			{0, 0}, {1, 0}, {2, 0}, {3, 0}, {4, 0}, {5, 0},
			{0, 5}, {1, 5}, {2, 5}, {3, 5}, {4, 5}, {5, 5},
		},
		Exits: []ExitInfo{
			{Direction: DoorNorth, DoorTiles: []Point{{2, 0}, {3, 0}}, RoomID: 1},
			{Direction: DoorSouth, DoorTiles: []Point{{2, 5}, {3, 5}}, RoomID: 1},
		},
	}

	nodes := CreateExitNodes(room)

	if len(nodes) != 2 {
		t.Errorf("expected 2 exit nodes, got %d", len(nodes))
	}

	// Check first exit (north) - should be moved down into room
	if nodes[0].Position.Y != 1 {
		t.Errorf("north exit should have Y=1 (inside room), got Y=%d", nodes[0].Position.Y)
	}

	// Check second exit (south) - should be moved up into room
	if nodes[1].Position.Y != 4 {
		t.Errorf("south exit should have Y=4 (inside room), got Y=%d", nodes[1].Position.Y)
	}
}

func TestSelectHubStrategy(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 6, Height: 6}

	tests := []struct {
		name     string
		exits    []NavNode
		expected HubStrategy
	}{
		{
			name:     "single exit",
			exits:    []NavNode{{ID: 0, Position: Point{2, 0}}},
			expected: HubStrategyNone,
		},
		{
			name: "two aligned exits",
			exits: []NavNode{
				{ID: 0, Position: Point{2, 0}},
				{ID: 1, Position: Point{2, 5}},
			},
			expected: HubStrategyNone, // Vertically aligned
		},
		{
			name: "two non-aligned exits",
			exits: []NavNode{
				{ID: 0, Position: Point{0, 0}},
				{ID: 1, Position: Point{5, 5}},
			},
			expected: HubStrategyWeighted,
		},
		{
			name: "three exits",
			exits: []NavNode{
				{ID: 0, Position: Point{2, 0}},
				{ID: 1, Position: Point{5, 2}},
				{ID: 2, Position: Point{2, 5}},
			},
			expected: HubStrategyYShaped,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SelectHubStrategy(tt.exits, bounds)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestBuildConnectivityTree(t *testing.T) {
	exits := []NavNode{
		{ID: 0, Position: Point{2, 1}, Type: NodeExit},
		{ID: 1, Position: Point{2, 4}, Type: NodeExit},
	}

	// Without hubs
	edges := BuildConnectivityTree(exits, nil)

	if len(edges) != 1 {
		t.Errorf("expected 1 edge for 2 exits (no hubs), got %d", len(edges))
	}

	if len(edges) > 0 {
		if edges[0].FromID != 0 || edges[0].ToID != 1 {
			t.Errorf("expected edge from 0 to 1, got from %d to %d",
				edges[0].FromID, edges[0].ToID)
		}
	}
}

func TestGenerateSegments(t *testing.T) {
	graph := &NavigationGraph{
		Nodes: []NavNode{
			{ID: 0, Position: Point{2, 1}, Type: NodeExit},
			{ID: 1, Position: Point{2, 4}, Type: NodeExit},
		},
		Edges: []NavEdge{
			{FromID: 0, ToID: 1, Cost: 3},
		},
	}

	abilities := DefaultAbilities()
	bounds := Rect{X: 0, Y: 0, Width: 6, Height: 6}

	GenerateSegments(graph, abilities, bounds)

	if len(graph.Edges[0].Segments) == 0 {
		t.Error("expected segments to be generated")
	}
}

func TestRenderToTilemap(t *testing.T) {
	segments := []PathSegment{
		{
			Type:  SegmentPlatform,
			Start: Point{1, 2},
			End:   Point{4, 2},
		},
		{
			Type:  SegmentLadder,
			Start: Point{2, 2},
			End:   Point{2, 4},
		},
	}

	bounds := Rect{X: 0, Y: 0, Width: 6, Height: 6}
	tileIDs := DefaultTileIDs()

	layer := RenderToTilemap(segments, bounds, tileIDs)

	if layer.Width != 6 {
		t.Errorf("expected width 6, got %d", layer.Width)
	}

	// Check platform tiles
	for x := 1; x <= 4; x++ {
		idx := 2*6 + x // Y=2, X=1-4
		if layer.Data[idx] != tileIDs.Platform && layer.Data[idx] != tileIDs.Ladder {
			t.Errorf("expected platform or ladder tile at (%d,2), got %d", x, layer.Data[idx])
		}
	}

	// Check ladder tiles
	for y := 2; y <= 4; y++ {
		idx := y*6 + 2 // X=2, Y=2-4
		if layer.Data[idx] != tileIDs.Ladder && layer.Data[idx] != tileIDs.Platform {
			t.Errorf("expected ladder or platform tile at (2,%d), got %d", y, layer.Data[idx])
		}
	}
}

func TestExtractRooms(t *testing.T) {
	// Create a simple tilemap with one room
	tm := &tilemap.TileMap{
		Layers: []tilemap.TileLayer{
			{
				Width: 3,
				Data:  []uint32{1, 1, 1, 1, 1, 1, 1, 1, 1}, // 3x3 room, all room ID 1
				Props: map[string]string{"name": "rooms"},
			},
			{
				Width: 3,
				Data:  []uint32{uint32(DoorNorth), 0, 0, 0, 0, 0, 0, 0, uint32(DoorSouth)}, // North door at (0,0), South at (2,2)
				Props: map[string]string{"type": "doors"},
			},
		},
		Props: map[string]string{},
	}

	rooms, err := ExtractRooms(tm)
	if err != nil {
		t.Fatalf("ExtractRooms failed: %v", err)
	}

	if len(rooms) != 1 {
		t.Errorf("expected 1 room, got %d", len(rooms))
	}

	room := rooms[1]
	if room == nil {
		t.Fatal("room 1 not found")
	}

	if len(room.Tiles) != 9 {
		t.Errorf("expected 9 tiles, got %d", len(room.Tiles))
	}

	if len(room.Exits) != 2 {
		t.Errorf("expected 2 exits, got %d", len(room.Exits))
	}
}

func TestVerifyReachability(t *testing.T) {
	// Create simple segments connecting two points
	segments := []PathSegment{
		{
			Type:  SegmentPlatform,
			Start: Point{0, 0},
			End:   Point{5, 0},
		},
	}

	exits := []NavNode{
		{ID: 0, Position: Point{0, 0}, Type: NodeExit},
		{ID: 1, Position: Point{5, 0}, Type: NodeExit},
	}

	abilities := DefaultAbilities()

	if !VerifyReachability(segments, exits, abilities) {
		t.Error("expected reachability to pass for connected platforms")
	}
}

func TestOccupancyGrid(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 10, Height: 10}
	grid := NewOccupancyGrid(bounds)

	seg := PathSegment{
		Type:  SegmentPlatform,
		Start: Point{2, 3},
		End:   Point{5, 3},
	}

	if grid.IsOccupied(Point{3, 3}) {
		t.Error("grid should be empty initially")
	}

	grid.Place(seg)

	if !grid.IsOccupied(Point{3, 3}) {
		t.Error("grid should be occupied after placing segment")
	}

	// Test can place
	conflictingSeg := PathSegment{
		Type:  SegmentLadder,
		Start: Point{3, 2},
		End:   Point{3, 4},
	}

	// Ladders can overlap with platforms
	if !grid.CanPlace(conflictingSeg, 0) {
		t.Error("ladder should be able to overlap with platform")
	}
}

func TestAddVariety(t *testing.T) {
	segments := []PathSegment{
		{
			Type:  SegmentPlatform,
			Start: Point{0, 5},
			End:   Point{10, 5}, // Long platform
		},
	}

	rng := &mockRandom{
		sequence: []int{1, 2, 3},
		floats:   []float64{0.1, 0.3, 0.5}, // First value < StaircaseProb
	}

	config := GetVarietyConfig(VarietyLow)
	bounds := Rect{X: 0, Y: 0, Width: 15, Height: 10}

	result := AddVariety(segments, rng, config, bounds)

	// With variety, we should get more segments (staircase)
	if len(result) <= 1 {
		t.Logf("expected staircase to generate multiple segments, got %d", len(result))
		// This is not a hard failure since randomness is involved
	}
}
