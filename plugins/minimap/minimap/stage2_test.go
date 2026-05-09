package minimap

import (
	"testing"

	"github.com/justgook/gams/sdk/go/tree"
)

// Helper to check if two rooms share an edge (are orthogonally adjacent)
// Also considers corridors: room A shares edge with room B if A touches B's room tiles OR B's corridor tiles
func roomsShareEdge(result *Stage2Result, roomA, roomB int) bool {
	tilesA := result.RoomTiles[roomA]

	// Build set of all tiles belonging to room B (room + corridor)
	bSet := make(map[Point]bool)
	for _, pt := range result.RoomTiles[roomB] {
		bSet[pt] = true
	}
	// Also include corridor tiles (negative ID)
	corridorB := -roomB
	for pt, id := range result.Grid {
		if id == corridorB {
			bSet[pt] = true
		}
	}

	for _, pt := range tilesA {
		neighbors := []Point{
			{pt[0] + 1, pt[1]},
			{pt[0] - 1, pt[1]},
			{pt[0], pt[1] + 1},
			{pt[0], pt[1] - 1},
		}
		for _, n := range neighbors {
			if bSet[n] {
				return true
			}
		}
	}
	return false
}

// Helper to check if grid has any overlapping tiles
func hasOverlap(result *Stage2Result) bool {
	seen := make(map[Point]bool)
	for pt := range result.Grid {
		if seen[pt] {
			return true
		}
		seen[pt] = true
	}
	return false
}

func TestStage2_RootPlacedAtOrigin(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Root (room 1) should include origin
	hasOrigin := false
	for _, pt := range result.RoomTiles[1] {
		if pt[0] == 0 && pt[1] == 0 {
			hasOrigin = true
			break
		}
	}
	if !hasOrigin {
		t.Error("Root room should include origin (0,0)")
	}
}

func TestStage2_ChildSharesEdgeWithParent(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root (index 0)
	tr.Add(0, nil)  // Child (index 1)

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Child (room 2) should share edge with parent (room 1)
	if !roomsShareEdge(result, 1, 2) {
		t.Error("Child room should share edge with parent room")
	}
}

func TestStage2_MultipleChildrenShareEdgesWithParent(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root (index 0)
	tr.Add(0, nil)  // Child 1 (index 1)
	tr.Add(0, nil)  // Child 2 (index 2)
	tr.Add(0, nil)  // Child 3 (index 3)

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// All children should share edge with parent
	for childID := 2; childID <= 4; childID++ {
		if !roomsShareEdge(result, 1, childID) {
			t.Errorf("Child room %d should share edge with parent room 1", childID)
		}
	}

	// No overlapping tiles
	if hasOverlap(result) {
		t.Error("Grid should not have overlapping tiles")
	}
}

func TestStage2_DeepTree_AllConnected(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root (index 0)
	tr.Add(0, nil)  // Child (index 1)
	tr.Add(1, nil)  // Grandchild (index 2)

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Child (room 2) shares edge with root (room 1)
	if !roomsShareEdge(result, 1, 2) {
		t.Error("Child should share edge with root")
	}

	// Grandchild (room 3) shares edge with child (room 2)
	if !roomsShareEdge(result, 2, 3) {
		t.Error("Grandchild should share edge with child")
	}
}

func TestStage2_DoorsCreated(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root
	tr.Add(0, nil)  // Child

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2},
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Should have at least 2 doors (one for child, one for parent)
	if len(result.Doors) < 2 {
		t.Errorf("Expected at least 2 door connections, got %d", len(result.Doors))
	}

	// Check door directions are valid (non-zero)
	for _, door := range result.Doors {
		if door.Direction == 0 {
			t.Error("Door direction should not be 0")
		}
	}
}

func TestStage2_EmptyTree(t *testing.T) {
	tr := &tree.Tree{}
	shapes := []PlacedShape{}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	if len(result.Grid) != 0 {
		t.Errorf("Expected empty grid, got %d tiles", len(result.Grid))
	}
}

func TestStage2_SingleNode(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil)

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}}, Width: 1, Height: 1},
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	if len(result.Grid) != 1 {
		t.Errorf("Expected 1 tile, got %d", len(result.Grid))
	}

	if len(result.RoomTiles[1]) != 1 {
		t.Errorf("Expected room 1 to have 1 tile, got %d", len(result.RoomTiles[1]))
	}
}

func TestStage2_VariedShapes(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root
	tr.Add(0, nil)  // Child 1
	tr.Add(0, nil)  // Child 2

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Width: 2, Height: 2}, // 2x2
		{Points: []Point{{0, 0}, {0, 1}, {0, 2}}, Width: 1, Height: 3},         // 1x3 tall
		{Points: []Point{{0, 0}, {1, 0}, {2, 0}}, Width: 3, Height: 1},         // 3x1 wide
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Both children should share edge with parent
	if !roomsShareEdge(result, 1, 2) {
		t.Error("Child 1 should share edge with parent")
	}
	if !roomsShareEdge(result, 1, 3) {
		t.Error("Child 2 should share edge with parent")
	}

	// Correct number of tiles
	if len(result.RoomTiles[1]) != 4 {
		t.Errorf("Room 1 should have 4 tiles, got %d", len(result.RoomTiles[1]))
	}
	if len(result.RoomTiles[2]) != 3 {
		t.Errorf("Room 2 should have 3 tiles, got %d", len(result.RoomTiles[2]))
	}
	if len(result.RoomTiles[3]) != 3 {
		t.Errorf("Room 3 should have 3 tiles, got %d", len(result.RoomTiles[3]))
	}
}

func TestStage2_LargeTree(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root (0)

	// Level 1: 3 children
	for i := 0; i < 3; i++ {
		tr.Add(0, nil) // 1, 2, 3
	}

	// Level 2: 2 children each
	for parent := 1; parent <= 3; parent++ {
		for i := 0; i < 2; i++ {
			tr.Add(parent, nil) // 4-9
		}
	}

	// Create shapes
	shapes := make([]PlacedShape, len(*tr))
	for i := range shapes {
		shapes[i] = PlacedShape{
			Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Width:  2,
			Height: 2,
		}
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Verify all parent-child connections
	for nodeIdx := 1; nodeIdx < len(*tr); nodeIdx++ {
		parentIdx := (*tr)[nodeIdx].ParentId
		childID := nodeIdx + 1
		parentID := parentIdx + 1

		if !roomsShareEdge(result, parentID, childID) {
			t.Errorf("Room %d should share edge with parent room %d", childID, parentID)
		}
	}

	// No overlaps
	if hasOverlap(result) {
		t.Error("Grid should not have overlapping tiles")
	}
}

func TestStage2_ManyChildren(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root

	// Add 8 children to root
	for i := 0; i < 8; i++ {
		tr.Add(0, nil)
	}

	shapes := make([]PlacedShape, len(*tr))
	for i := range shapes {
		shapes[i] = PlacedShape{
			Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Width:  2,
			Height: 2,
		}
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// All children should share edge with parent
	for childID := 2; childID <= 9; childID++ {
		if !roomsShareEdge(result, 1, childID) {
			t.Errorf("Child room %d should share edge with parent room 1", childID)
		}
	}

	// No overlaps
	if hasOverlap(result) {
		t.Error("Grid should not have overlapping tiles")
	}
}

func TestStage2_VeryDeepTree(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root

	// Create chain of 10 nodes
	for i := 0; i < 10; i++ {
		tr.Add(i, nil)
	}

	shapes := make([]PlacedShape, len(*tr))
	for i := range shapes {
		shapes[i] = PlacedShape{
			Points: []Point{{0, 0}},
			Width:  1,
			Height: 1,
		}
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Each node should share edge with its parent
	for nodeIdx := 1; nodeIdx < len(*tr); nodeIdx++ {
		parentIdx := (*tr)[nodeIdx].ParentId
		childID := nodeIdx + 1
		parentID := parentIdx + 1

		if !roomsShareEdge(result, parentID, childID) {
			t.Errorf("Room %d should share edge with parent room %d", childID, parentID)
		}
	}
}

func TestStage2_CorridorExtension(t *testing.T) {
	// Test that corridors are created when direct placement isn't possible
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root
	tr.Add(0, nil)  // Child 1
	tr.Add(0, nil)  // Child 2
	tr.Add(0, nil)  // Child 3
	tr.Add(0, nil)  // Child 4
	tr.Add(0, nil)  // Child 5 - might need corridor

	// Use larger shapes that fill more space
	shapes := make([]PlacedShape, len(*tr))
	for i := range shapes {
		shapes[i] = PlacedShape{
			Points: []Point{{0, 0}, {1, 0}, {2, 0}, {0, 1}, {1, 1}, {2, 1}},
			Width:  3,
			Height: 2,
		}
	}

	result, err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// All children must share edge with parent (directly or via corridor)
	for childID := 2; childID <= 6; childID++ {
		if !roomsShareEdge(result, 1, childID) {
			t.Errorf("Child room %d should share edge with parent room 1", childID)
		}
	}
}

// Benchmark
func BenchmarkStage2_10Nodes(b *testing.B) {
	tr := &tree.Tree{}
	tr.Add(-1, nil)
	for i := 0; i < 9; i++ {
		tr.Add(i%3, nil)
	}

	shapes := make([]PlacedShape, len(*tr))
	for i := range shapes {
		shapes[i] = PlacedShape{
			Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Width:  2,
			Height: 2,
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Stage2(tr, shapes)
	}
}

func BenchmarkStage2_50Nodes(b *testing.B) {
	tr := &tree.Tree{}
	tr.Add(-1, nil)
	for i := 0; i < 49; i++ {
		tr.Add(i%10, nil)
	}

	shapes := make([]PlacedShape, len(*tr))
	for i := range shapes {
		shapes[i] = PlacedShape{
			Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Width:  2,
			Height: 2,
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Stage2(tr, shapes)
	}
}
