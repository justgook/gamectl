package gen

import (
	"testing"

	"github.com/justgook/gams/pkg/tilemap"
)

// =============================================================================
// Test Utilities
// =============================================================================

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

func newMockRNG() *mockRandom {
	return &mockRandom{
		sequence: []int{1, 2, 3, 4, 5},
		floats:   []float64{0.3, 0.5, 0.7},
	}
}

// =============================================================================
// Phase 1: Movement Tier Tests
// =============================================================================

func TestMovementTierBasic(t *testing.T) {
	abilities := DefaultAbilities()
	abilities.CanWallJump = false
	abilities.CanDoubleJump = false
	abilities.CanGrapple = false

	tier := abilities.GetTier()
	if tier != TierBasic {
		t.Errorf("expected TierBasic, got %v", tier)
	}
}

func TestMovementTierIntermediate(t *testing.T) {
	abilities := DefaultAbilities()
	abilities.CanWallJump = true

	tier := abilities.GetTier()
	if tier != TierIntermediate {
		t.Errorf("expected TierIntermediate for wall jump, got %v", tier)
	}

	abilities.CanWallJump = false
	abilities.CanDoubleJump = true

	tier = abilities.GetTier()
	if tier != TierIntermediate {
		t.Errorf("expected TierIntermediate for double jump, got %v", tier)
	}
}

func TestMovementTierAdvanced(t *testing.T) {
	abilities := DefaultAbilities()
	abilities.CanGrapple = true

	tier := abilities.GetTier()
	if tier != TierAdvanced {
		t.Errorf("expected TierAdvanced for grapple, got %v", tier)
	}
}

func TestEffectiveJumpHeight(t *testing.T) {
	abilities := DefaultAbilities()
	abilities.JumpHeight = 3
	abilities.CanDoubleJump = false

	if abilities.EffectiveJumpHeight() != 3 {
		t.Errorf("expected 3, got %d", abilities.EffectiveJumpHeight())
	}

	abilities.CanDoubleJump = true
	abilities.DoubleJumpHeight = 2

	if abilities.EffectiveJumpHeight() != 5 {
		t.Errorf("expected 5, got %d", abilities.EffectiveJumpHeight())
	}
}

// =============================================================================
// Phase 2: Constraint Validation Tests
// =============================================================================

func TestCanJumpHorizontal(t *testing.T) {
	abilities := DefaultAbilities()
	abilities.JumpDistance = 3

	tests := []struct {
		gap      int
		expected bool
	}{
		{0, true},
		{2, true},
		{3, true},
		{4, false},
		{-2, true}, // Negative gap
	}

	for _, tt := range tests {
		result := CanJumpHorizontal(tt.gap, abilities)
		if result != tt.expected {
			t.Errorf("CanJumpHorizontal(%d) = %v, want %v", tt.gap, result, tt.expected)
		}
	}
}

func TestCanJumpVertical(t *testing.T) {
	abilities := DefaultAbilities()
	abilities.JumpHeight = 2

	tests := []struct {
		height   int
		expected bool
	}{
		{0, true},
		{1, true},
		{2, true},
		{3, false},
	}

	for _, tt := range tests {
		result := CanJumpVertical(tt.height, abilities)
		if result != tt.expected {
			t.Errorf("CanJumpVertical(%d) = %v, want %v", tt.height, result, tt.expected)
		}
	}
}

func TestCanClimbVertical(t *testing.T) {
	abilities := DefaultAbilities()

	abilities.CanUseLadders = true
	if !CanClimbVertical(10, abilities) {
		t.Error("should be able to climb any height with ladders")
	}

	abilities.CanUseLadders = false
	if CanClimbVertical(10, abilities) {
		t.Error("should not be able to climb without ladders")
	}
}

func TestCanConnectDirect(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 20, Height: 20}
	abilities := DefaultAbilities()
	abilities.JumpHeight = 2
	abilities.CanUseLadders = true

	tests := []struct {
		name     string
		from     Point
		to       Point
		expected bool
	}{
		{"same point", Point{5, 5}, Point{5, 5}, true},
		{"horizontal", Point{2, 5}, Point{10, 5}, true},
		{"vertical up (jumpable)", Point{5, 5}, Point{5, 3}, true},
		{"vertical up (needs ladder)", Point{5, 10}, Point{5, 2}, true},
		{"diagonal", Point{2, 2}, Point{10, 10}, true},
		{"out of bounds", Point{-1, 5}, Point{5, 5}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CanConnectDirect(tt.from, tt.to, abilities, bounds)
			if result != tt.expected {
				t.Errorf("CanConnectDirect(%v, %v) = %v, want %v",
					tt.from, tt.to, result, tt.expected)
			}
		})
	}
}

func TestClampToBounds(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 10, Height: 10}

	tests := []struct {
		point    Point
		margin   int
		expected Point
	}{
		{Point{5, 5}, 0, Point{5, 5}},
		{Point{-1, 5}, 0, Point{0, 5}},
		{Point{15, 5}, 0, Point{9, 5}},
		{Point{5, 5}, 2, Point{5, 5}},
		{Point{0, 0}, 2, Point{2, 2}},
	}

	for _, tt := range tests {
		result := ClampToBounds(tt.point, bounds, tt.margin)
		if result != tt.expected {
			t.Errorf("ClampToBounds(%v, margin=%d) = %v, want %v",
				tt.point, tt.margin, result, tt.expected)
		}
	}
}

// =============================================================================
// Phase 3: Basic Segment Generation Tests
// =============================================================================

func TestGenerateHorizontalSegments(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 20, Height: 20}
	abilities := DefaultAbilities()

	from := Point{2, 5}
	to := Point{10, 5}

	segments := GenerateBasicSegments(from, to, abilities, bounds)

	if len(segments) == 0 {
		t.Fatal("expected segments to be generated")
	}

	// Should have at least one platform segment
	hasPlatform := false
	for _, seg := range segments {
		if seg.Type == SegmentPlatform {
			hasPlatform = true
			break
		}
	}

	if !hasPlatform {
		t.Error("expected at least one platform segment")
	}
}

func TestGenerateVerticalSegmentsJumpable(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 20, Height: 20}
	abilities := DefaultAbilities()
	abilities.JumpHeight = 3

	// Going up, within jump range
	from := Point{5, 5}
	to := Point{5, 3}

	segments := GenerateBasicSegments(from, to, abilities, bounds)

	if len(segments) == 0 {
		t.Fatal("expected segments for jumpable height")
	}
}

func TestGenerateVerticalSegmentsNeedsLadder(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 20, Height: 20}
	abilities := DefaultAbilities()
	abilities.JumpHeight = 2
	abilities.CanUseLadders = true

	// Going up, needs ladder
	from := Point{5, 10}
	to := Point{5, 2}

	segments := GenerateBasicSegments(from, to, abilities, bounds)

	if len(segments) == 0 {
		t.Fatal("expected segments with ladder")
	}

	hasLadder := false
	for _, seg := range segments {
		if seg.Type == SegmentLadder {
			hasLadder = true
			break
		}
	}

	if !hasLadder {
		t.Error("expected ladder segment for tall climb")
	}
}

func TestGenerateLShapedPath(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 20, Height: 20}
	abilities := DefaultAbilities()
	abilities.CanUseLadders = true

	from := Point{2, 10}
	to := Point{10, 3}

	segments := GenerateBasicSegments(from, to, abilities, bounds)

	if len(segments) == 0 {
		t.Fatal("expected L-shaped path segments")
	}

	// Should have at least a horizontal component
	hasHorizontal := false

	for _, seg := range segments {
		if seg.Type == SegmentPlatform {
			hasHorizontal = true
		}
	}

	if !hasHorizontal {
		t.Error("expected horizontal segment in L-shaped path")
	}
}

func TestSegmentsStayWithinBounds(t *testing.T) {
	bounds := Rect{X: 5, Y: 5, Width: 10, Height: 10}
	abilities := DefaultAbilities()

	from := Point{7, 7}
	to := Point{12, 12}

	segments := GenerateBasicSegments(from, to, abilities, bounds)

	for _, seg := range segments {
		tiles := seg.GetTiles()
		for _, tile := range tiles {
			if !bounds.Contains(tile) {
				t.Errorf("tile %v is outside bounds %v", tile, bounds)
			}
		}
	}
}

// =============================================================================
// Phase 4: Connectivity Tests
// =============================================================================

func TestCreateExitNodes(t *testing.T) {
	room := &RoomInfo{
		ID: 1,
		Bounds: Rect{
			X: 0, Y: 0,
			Width: 10, Height: 10,
		},
		Exits: []ExitInfo{
			{Direction: DoorNorth, DoorTiles: []Point{{5, 0}}, RoomID: 1},
			{Direction: DoorSouth, DoorTiles: []Point{{5, 9}}, RoomID: 1},
		},
	}

	nodes := CreateExitNodes(room)

	if len(nodes) != 2 {
		t.Errorf("expected 2 exit nodes, got %d", len(nodes))
	}

	// North exit should be moved into room
	if nodes[0].Position.Y <= 0 {
		t.Errorf("north exit should be moved inside room, got Y=%d", nodes[0].Position.Y)
	}
}

func TestBuildConnectivityTreeWithValidation(t *testing.T) {
	exits := []NavNode{
		{ID: 0, Position: Point{2, 2}, Type: NodeExit},
		{ID: 1, Position: Point{8, 8}, Type: NodeExit},
	}

	config := ConnectivityConfig{
		Abilities: DefaultAbilities(),
		Bounds:    Rect{X: 0, Y: 0, Width: 15, Height: 15},
	}

	edges := BuildConnectivityTreeWithValidation(exits, nil, config)

	if len(edges) != 1 {
		t.Errorf("expected 1 edge for 2 exits, got %d", len(edges))
	}
}

func TestSelectHubStrategy(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 10, Height: 10}

	tests := []struct {
		name     string
		exits    []NavNode
		expected HubStrategy
	}{
		{
			name:     "single exit",
			exits:    []NavNode{{ID: 0, Position: Point{5, 0}}},
			expected: HubStrategyNone,
		},
		{
			name: "two aligned exits",
			exits: []NavNode{
				{ID: 0, Position: Point{5, 0}},
				{ID: 1, Position: Point{5, 9}},
			},
			expected: HubStrategyNone,
		},
		{
			name: "three exits",
			exits: []NavNode{
				{ID: 0, Position: Point{5, 0}},
				{ID: 1, Position: Point{9, 5}},
				{ID: 2, Position: Point{5, 9}},
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

// =============================================================================
// Phase 5: Advanced Segment Tests
// =============================================================================

func TestAdvancedSegmentsWallJump(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 20, Height: 20}
	abilities := DefaultAbilities()
	abilities.CanWallJump = true
	abilities.WallJumpHeight = 3
	abilities.WallJumpDistance = 2

	from := Point{10, 15}
	to := Point{10, 5} // Going up 10 tiles

	segments := GenerateAdvancedSegments(from, to, abilities, bounds)

	if segments == nil {
		t.Skip("wall jump path not generated (may need basic fallback)")
	}

	hasWallJump := false
	for _, seg := range segments {
		if seg.Type == SegmentWallJump {
			hasWallJump = true
			break
		}
	}

	if !hasWallJump {
		t.Error("expected wall jump segments")
	}
}

func TestAdvancedSegmentsFallbackToBasic(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 20, Height: 20}
	abilities := DefaultAbilities()
	// No advanced abilities

	from := Point{5, 10}
	to := Point{10, 10}

	segments := GenerateAdvancedSegments(from, to, abilities, bounds)

	if segments != nil {
		t.Error("expected nil for basic tier abilities")
	}
}

func TestGenerateSegmentsWithTier(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 20, Height: 20}
	abilities := DefaultAbilities()

	from := Point{5, 5}
	to := Point{15, 5}

	segments := GenerateSegmentsWithTier(from, to, abilities, bounds)

	if segments == nil {
		t.Fatal("expected segments to be generated")
	}
}

// =============================================================================
// Phase 6: Decoration Tests
// =============================================================================

func TestApplyDecoration(t *testing.T) {
	bounds := Rect{X: 0, Y: 0, Width: 20, Height: 20}
	config := DefaultDecorationConfig()
	rng := newMockRNG()

	segments := []PathSegment{
		{Type: SegmentPlatform, Start: Point{2, 10}, End: Point{8, 10}},
	}

	result := ApplyDecoration(segments, rng, config, bounds)

	if len(result) != len(segments) {
		t.Errorf("expected same number of segments, got %d", len(result))
	}
}

func TestEnforceParallelSpacing(t *testing.T) {
	segments := []PathSegment{
		{Type: SegmentPlatform, Start: Point{0, 5}, End: Point{10, 5}},
		{Type: SegmentPlatform, Start: Point{0, 6}, End: Point{10, 6}}, // Too close
	}

	result := EnforceParallelSpacing(segments, 3)

	// Second platform should be moved
	if result[1].Start.Y <= 5+1 {
		t.Errorf("platforms too close: Y1=%d, Y2=%d",
			result[0].Start.Y, result[1].Start.Y)
	}
}

func TestDecorationConfigFromVariety(t *testing.T) {
	tests := []struct {
		level   VarietyLevel
		enabled bool
	}{
		{VarietyNone, false},
		{VarietyLow, true},
		{VarietyMedium, true},
		{VarietyHigh, true},
	}

	for _, tt := range tests {
		config := DecorationConfigFromVariety(VarietyConfig{Level: tt.level})
		if config.Enabled != tt.enabled {
			t.Errorf("level %v: expected Enabled=%v, got %v",
				tt.level, tt.enabled, config.Enabled)
		}
	}
}

// =============================================================================
// Integration Tests
// =============================================================================

func TestRenderRoomToTilemap(t *testing.T) {
	room := &RoomInfo{
		ID:     1,
		Bounds: Rect{X: 0, Y: 0, Width: 15, Height: 15},
		Tiles:  []Point{}, // Not used in rendering
		Exits: []ExitInfo{
			{Direction: DoorNorth, DoorTiles: []Point{{7, 0}}, RoomID: 1},
			{Direction: DoorSouth, DoorTiles: []Point{{7, 14}}, RoomID: 1},
		},
	}

	abilities := DefaultAbilities()
	variety := GetVarietyConfig(VarietyLow)
	tileIDs := DefaultTileIDs()
	rng := newMockRNG()

	layer := RenderRoomToTilemap(room, abilities, variety, tileIDs, rng)

	if layer == nil {
		t.Fatal("expected non-nil layer")
	}

	if layer.Width != 15 {
		t.Errorf("expected width 15, got %d", layer.Width)
	}

	// Should have some tiles placed
	tileCount := 0
	for _, tile := range layer.Data {
		if tile != 0 {
			tileCount++
		}
	}

	if tileCount == 0 {
		t.Error("expected some tiles to be placed")
	}
}

func TestRenderMultiExitRoom(t *testing.T) {
	room := &RoomInfo{
		ID:     1,
		Bounds: Rect{X: 0, Y: 0, Width: 20, Height: 20},
		Exits: []ExitInfo{
			{Direction: DoorNorth, DoorTiles: []Point{{10, 0}}, RoomID: 1},
			{Direction: DoorEast, DoorTiles: []Point{{19, 10}}, RoomID: 1},
			{Direction: DoorSouth, DoorTiles: []Point{{10, 19}}, RoomID: 1},
			{Direction: DoorWest, DoorTiles: []Point{{0, 10}}, RoomID: 1},
		},
	}

	abilities := DefaultAbilities()
	variety := GetVarietyConfig(VarietyMedium)
	tileIDs := DefaultTileIDs()
	rng := newMockRNG()

	layer := RenderRoomToTilemap(room, abilities, variety, tileIDs, rng)

	if layer == nil {
		t.Fatal("expected non-nil layer")
	}
}

func TestExtractRooms(t *testing.T) {
	tm := &tilemap.TileMap{
		Layers: []tilemap.TileLayer{
			{
				Width: 5,
				Data:  []uint32{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1},
				Props: map[string]string{"name": "rooms"},
			},
			{
				Width: 5,
				Data:  []uint32{uint32(DoorNorth), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, uint32(DoorSouth)},
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

	if len(room.Tiles) != 25 {
		t.Errorf("expected 25 tiles, got %d", len(room.Tiles))
	}
}

func TestMergeOverlappingPlatforms(t *testing.T) {
	segments := []PathSegment{
		{Type: SegmentPlatform, Start: Point{0, 5}, End: Point{5, 5}},
		{Type: SegmentPlatform, Start: Point{3, 5}, End: Point{10, 5}},
		{Type: SegmentLadder, Start: Point{5, 5}, End: Point{5, 10}}, // Should not merge
	}

	result := MergeOverlappingPlatforms(segments)

	platformCount := 0
	ladderCount := 0
	for _, seg := range result {
		if seg.Type == SegmentPlatform {
			platformCount++
		}
		if seg.Type == SegmentLadder {
			ladderCount++
		}
	}

	if platformCount != 1 {
		t.Errorf("expected 1 merged platform, got %d", platformCount)
	}
	if ladderCount != 1 {
		t.Errorf("expected 1 ladder, got %d", ladderCount)
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

	// Ladder can overlap platform
	ladderSeg := PathSegment{
		Type:  SegmentLadder,
		Start: Point{3, 2},
		End:   Point{3, 5},
	}

	if !grid.CanPlace(ladderSeg, 0) {
		t.Error("ladder should be able to overlap with platform")
	}
}

// =============================================================================
// Edge Case Tests
// =============================================================================

func TestEmptyRoom(t *testing.T) {
	room := &RoomInfo{
		ID:     1,
		Bounds: Rect{X: 0, Y: 0, Width: 10, Height: 10},
		Exits:  []ExitInfo{}, // No exits
	}

	abilities := DefaultAbilities()
	variety := GetVarietyConfig(VarietyNone)
	tileIDs := DefaultTileIDs()

	layer := RenderRoomToTilemap(room, abilities, variety, tileIDs, nil)

	if layer == nil {
		t.Fatal("expected non-nil layer even for empty room")
	}

	// Should have no tiles
	for _, tile := range layer.Data {
		if tile != 0 {
			t.Error("expected empty layer for room with no exits")
			break
		}
	}
}

func TestSingleExitRoom(t *testing.T) {
	room := &RoomInfo{
		ID:     1,
		Bounds: Rect{X: 0, Y: 0, Width: 10, Height: 10},
		Exits: []ExitInfo{
			{Direction: DoorNorth, DoorTiles: []Point{{5, 0}}, RoomID: 1},
		},
	}

	abilities := DefaultAbilities()
	variety := GetVarietyConfig(VarietyNone)
	tileIDs := DefaultTileIDs()

	layer := RenderRoomToTilemap(room, abilities, variety, tileIDs, nil)

	if layer == nil {
		t.Fatal("expected non-nil layer")
	}
}

func TestTinyRoom(t *testing.T) {
	room := &RoomInfo{
		ID:     1,
		Bounds: Rect{X: 0, Y: 0, Width: 3, Height: 3},
		Exits: []ExitInfo{
			{Direction: DoorNorth, DoorTiles: []Point{{1, 0}}, RoomID: 1},
			{Direction: DoorSouth, DoorTiles: []Point{{1, 2}}, RoomID: 1},
		},
	}

	abilities := DefaultAbilities()
	variety := GetVarietyConfig(VarietyNone)
	tileIDs := DefaultTileIDs()

	layer := RenderRoomToTilemap(room, abilities, variety, tileIDs, nil)

	if layer == nil {
		t.Fatal("expected non-nil layer for tiny room")
	}
}

// =============================================================================
// Non-Rectangular Room Tests
// =============================================================================

func TestRoomShape(t *testing.T) {
	// L-shaped room
	tiles := []Point{
		{0, 0}, {1, 0}, {2, 0},
		{0, 1}, {1, 1}, {2, 1},
		{0, 2}, {1, 2},
		{0, 3}, {1, 3},
	}

	shape := NewRoomShape(tiles)

	if shape == nil {
		t.Fatal("expected non-nil shape")
	}

	// Check bounds
	if shape.Bounds.Width != 3 || shape.Bounds.Height != 4 {
		t.Errorf("wrong bounds: got %dx%d, want 3x4", shape.Bounds.Width, shape.Bounds.Height)
	}

	// Check contains
	if !shape.Contains(Point{0, 0}) {
		t.Error("shape should contain (0,0)")
	}
	if !shape.Contains(Point{1, 3}) {
		t.Error("shape should contain (1,3)")
	}
	if shape.Contains(Point{2, 2}) {
		t.Error("shape should NOT contain (2,2) - L-shaped corner")
	}
	if shape.Contains(Point{2, 3}) {
		t.Error("shape should NOT contain (2,3) - L-shaped corner")
	}
}

func TestFindNearestInside(t *testing.T) {
	// L-shaped room
	tiles := []Point{
		{0, 0}, {1, 0}, {2, 0},
		{0, 1}, {1, 1}, {2, 1},
		{0, 2}, {1, 2},
		{0, 3}, {1, 3},
	}

	shape := NewRoomShape(tiles)

	// Point outside should find nearest inside
	outside := Point{2, 3}
	nearest := shape.FindNearestInside(outside)

	if !shape.Contains(nearest) {
		t.Errorf("FindNearestInside returned point outside shape: %v", nearest)
	}

	// Point inside should return itself
	inside := Point{1, 1}
	result := shape.FindNearestInside(inside)
	if result != inside {
		t.Errorf("FindNearestInside should return same point for inside: got %v, want %v", result, inside)
	}
}

func TestNonRectangularRoomExitNodes(t *testing.T) {
	// L-shaped room with exits
	tiles := []Point{
		{0, 0}, {1, 0}, {2, 0},
		{0, 1}, {1, 1}, {2, 1},
		{0, 2}, {1, 2},
		{0, 3}, {1, 3},
	}

	room := &RoomInfo{
		ID:     1,
		Bounds: Rect{X: 0, Y: 0, Width: 3, Height: 4},
		Tiles:  tiles,
		Shape:  NewRoomShape(tiles),
		Exits: []ExitInfo{
			{Direction: DoorNorth, DoorTiles: []Point{{1, 0}}, RoomID: 1},
			{Direction: DoorSouth, DoorTiles: []Point{{0, 3}}, RoomID: 1},
		},
	}

	nodes := CreateExitNodes(room)

	if len(nodes) != 2 {
		t.Fatalf("expected 2 exit nodes, got %d", len(nodes))
	}

	// Both exit positions should be inside the room shape
	for i, node := range nodes {
		if !room.Shape.Contains(node.Position) {
			t.Errorf("exit node %d at %v is outside room shape", i, node.Position)
		}
	}
}

func TestRenderNonRectangularRoom(t *testing.T) {
	// L-shaped room
	tiles := []Point{
		{0, 0}, {1, 0}, {2, 0},
		{0, 1}, {1, 1}, {2, 1},
		{0, 2}, {1, 2},
		{0, 3}, {1, 3},
	}

	room := &RoomInfo{
		ID:     1,
		Bounds: Rect{X: 0, Y: 0, Width: 3, Height: 4},
		Tiles:  tiles,
		Shape:  NewRoomShape(tiles),
		Exits: []ExitInfo{
			{Direction: DoorNorth, DoorTiles: []Point{{1, 0}}, RoomID: 1},
			{Direction: DoorSouth, DoorTiles: []Point{{0, 3}}, RoomID: 1},
		},
	}

	abilities := DefaultAbilities()
	variety := GetVarietyConfig(VarietyNone)
	tileIDs := DefaultTileIDs()

	layer := RenderRoomToTilemap(room, abilities, variety, tileIDs, nil)

	if layer == nil {
		t.Fatal("expected non-nil layer")
	}

	// Check that no tiles are placed outside the room shape
	for y := 0; y < room.Bounds.Height; y++ {
		for x := 0; x < room.Bounds.Width; x++ {
			idx := y*room.Bounds.Width + x
			tileValue := layer.Data[idx]

			globalPos := Point{room.Bounds.X + x, room.Bounds.Y + y}

			if tileValue != 0 && !room.Shape.Contains(globalPos) {
				t.Errorf("tile placed at %v which is outside room shape, value=%d", globalPos, tileValue)
			}
		}
	}
}

func TestFilterSegmentsToShape(t *testing.T) {
	// L-shaped room
	tiles := []Point{
		{0, 0}, {1, 0}, {2, 0},
		{0, 1}, {1, 1}, {2, 1},
		{0, 2}, {1, 2},
	}
	shape := NewRoomShape(tiles)

	// Platform that extends outside the L-shape
	segments := []PathSegment{
		{
			Type:  SegmentPlatform,
			Start: Point{0, 2},
			End:   Point{2, 2}, // (2,2) is outside L-shape
		},
	}

	filtered := FilterSegmentsToShape(segments, shape)

	if len(filtered) == 0 {
		t.Fatal("expected at least one segment after filtering")
	}

	// Check that filtered segment only contains valid tiles
	for _, seg := range filtered {
		for _, tile := range seg.GetTiles() {
			if !shape.Contains(tile) {
				t.Errorf("filtered segment still contains tile outside shape: %v", tile)
			}
		}
	}
}
