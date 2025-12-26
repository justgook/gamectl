package minimap

import (
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

func TestStage2_SimpleTree_Compacts(t *testing.T) {
	// Create a simple tree: root with one child
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root (index 0)
	tr.Add(0, nil)  // Child (index 1)

	// Place root at origin, child far away
	shapes := []PlacedShape{
		{
			Points:   []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, // 2x2
			Position: Point{0, 0},
			Width:    2,
			Height:   2,
		},
		{
			Points:   []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, // 2x2
			Position: Point{0, 10},                            // far below root
			Width:    2,
			Height:   2,
		},
	}

	initialGap := shapes[1].Position[1] - (shapes[0].Position[1] + shapes[0].Height)
	t.Logf("Initial gap: %d", initialGap)

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Child should have moved closer to parent
	finalGap := shapes[1].Position[1] - (shapes[0].Position[1] + shapes[0].Height)
	t.Logf("Final gap: %d", finalGap)

	if finalGap >= initialGap {
		t.Errorf("Expected gap to decrease, got initial=%d, final=%d", initialGap, finalGap)
	}

	// Gap should be minimal (1 tile for path)
	// Actually could be 0 if rooms can touch directly
	if finalGap > 1 {
		t.Errorf("Expected gap <= 1, got %d", finalGap)
	}
}

func TestStage2_NoOverlapAfterCompaction(t *testing.T) {
	// Tree with 3 children that need to not overlap after compaction
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root (index 0)
	tr.Add(0, nil)  // Child 1 (index 1)
	tr.Add(0, nil)  // Child 2 (index 2)
	tr.Add(0, nil)  // Child 3 (index 3)

	// Spread children below root
	shapes := []PlacedShape{
		{
			Points:   []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Position: Point{0, 0},
			Width:    2,
			Height:   2,
		},
		{
			Points:   []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Position: Point{-5, 10},
			Width:    2,
			Height:   2,
		},
		{
			Points:   []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Position: Point{0, 10},
			Width:    2,
			Height:   2,
		},
		{
			Points:   []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Position: Point{5, 10},
			Width:    2,
			Height:   2,
		},
	}

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Check no overlaps
	if hasAnyOverlap(shapes) {
		t.Error("Shapes overlap after compaction")
		for i, s := range shapes {
			t.Logf("Shape %d: pos=(%d,%d)", i, s.Position[0], s.Position[1])
		}
	}
}

func TestStage2_DeepTree_Compacts(t *testing.T) {
	// Create a 3-level tree
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root (index 0)
	tr.Add(0, nil)  // Child (index 1)
	tr.Add(1, nil)  // Grandchild (index 2)

	shapes := []PlacedShape{
		{
			Points:   []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Position: Point{0, 0},
			Width:    2,
			Height:   2,
		},
		{
			Points:   []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Position: Point{0, 10},
			Width:    2,
			Height:   2,
		},
		{
			Points:   []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Position: Point{0, 20},
			Width:    2,
			Height:   2,
		},
	}

	// Calculate initial total path length
	initialTotalGap := 0
	initialTotalGap += shapes[1].Position[1] - (shapes[0].Position[1] + shapes[0].Height)
	initialTotalGap += shapes[2].Position[1] - (shapes[1].Position[1] + shapes[1].Height)

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Calculate final total path length
	finalTotalGap := 0
	finalTotalGap += shapes[1].Position[1] - (shapes[0].Position[1] + shapes[0].Height)
	finalTotalGap += shapes[2].Position[1] - (shapes[1].Position[1] + shapes[1].Height)

	t.Logf("Total gap: initial=%d, final=%d", initialTotalGap, finalTotalGap)

	if finalTotalGap >= initialTotalGap {
		t.Errorf("Expected total gap to decrease")
	}
}

func TestStage2_SubtreesGetCompacted(t *testing.T) {
	// Parent with 2 children, each with a grandchild
	// After Stage2, grandchildren should be closer to their parents (compacted)
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root (index 0)
	tr.Add(0, nil)  // Child 1 (index 1)
	tr.Add(0, nil)  // Child 2 (index 2)
	tr.Add(1, nil)  // Grandchild of 1 (index 3)
	tr.Add(2, nil)  // Grandchild of 2 (index 4)

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{0, 0}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{-10, 10}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{10, 10}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{-10, 20}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{10, 20}, Width: 2, Height: 2},
	}

	// Record initial gaps
	initialGapChild1ToGrandchild1 := shapes[3].Position[1] - (shapes[1].Position[1] + shapes[1].Height)
	initialGapChild2ToGrandchild2 := shapes[4].Position[1] - (shapes[2].Position[1] + shapes[2].Height)

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Check that gaps decreased (subtrees got compacted)
	finalGapChild1ToGrandchild1 := shapes[3].Position[1] - (shapes[1].Position[1] + shapes[1].Height)
	finalGapChild2ToGrandchild2 := shapes[4].Position[1] - (shapes[2].Position[1] + shapes[2].Height)

	if finalGapChild1ToGrandchild1 >= initialGapChild1ToGrandchild1 {
		t.Errorf("Subtree 1 should have compacted: initial gap %d, final gap %d",
			initialGapChild1ToGrandchild1, finalGapChild1ToGrandchild1)
	}
	if finalGapChild2ToGrandchild2 >= initialGapChild2ToGrandchild2 {
		t.Errorf("Subtree 2 should have compacted: initial gap %d, final gap %d",
			initialGapChild2ToGrandchild2, finalGapChild2ToGrandchild2)
	}

	// No overlaps
	if hasAnyOverlap(shapes) {
		t.Error("Shapes overlap after compaction")
	}
}

func TestStage2_PathsStillExist(t *testing.T) {
	// After compaction, Stage3 should still be able to find paths
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root
	tr.Add(0, nil)  // Child 1
	tr.Add(0, nil)  // Child 2
	tr.Add(1, nil)  // Grandchild

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{0, 0}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{-5, 10}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{5, 10}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{-5, 20}, Width: 2, Height: 2},
	}

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Try Stage3 - it should succeed
	pathInfos, err := Stage3(tr, shapes)
	if err != nil {
		t.Fatalf("Stage3 failed after Stage2: %v", err)
	}

	// Should have paths for all non-root nodes
	expectedPaths := len(*tr) - 1
	if len(pathInfos) != expectedPaths {
		t.Errorf("Expected %d paths, got %d", expectedPaths, len(pathInfos))
	}
}

func TestStage2_EmptyTree(t *testing.T) {
	tr := &tree.Tree{}
	shapes := []PlacedShape{}

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed on empty tree: %v", err)
	}
}

func TestStage2_SingleNode(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil)

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}}, Position: Point{0, 0}, Width: 1, Height: 1},
	}

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed on single node: %v", err)
	}
}

func TestStage2_AlreadyCompact(t *testing.T) {
	// If shapes are already touching, nothing should change
	tr := &tree.Tree{}
	tr.Add(-1, nil)
	tr.Add(0, nil)

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{0, 0}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{0, 2}, Width: 2, Height: 2}, // directly touching
	}

	originalPos := shapes[1].Position

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Position should not change (or only minimal)
	if shapes[1].Position[1] < originalPos[1] {
		// It moved closer which shouldn't happen if already touching
		gap := shapes[1].Position[1] - (shapes[0].Position[1] + shapes[0].Height)
		if gap < 0 {
			t.Errorf("Shapes are overlapping after Stage2")
		}
	}
}

func TestStage2_TouchingRooms_Stage3Works(t *testing.T) {
	// Verify that Stage3 can find paths when rooms are touching (gap=0)
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root
	tr.Add(0, nil)  // Child

	// Two rooms directly touching (gap = 0)
	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{0, 0}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{0, 2}, Width: 2, Height: 2}, // touching
	}

	// Stage3 should succeed with touching rooms
	pathInfos, err := Stage3(tr, shapes)
	if err != nil {
		t.Fatalf("Stage3 failed with touching rooms: %v", err)
	}

	// Should have 1 path (child to parent)
	if len(pathInfos) != 1 {
		t.Errorf("Expected 1 path, got %d", len(pathInfos))
	}

	// Path should be empty (no tiles needed when rooms touch)
	if len(pathInfos[0].PathTiles) != 0 {
		t.Errorf("Expected 0 path tiles for touching rooms, got %d", len(pathInfos[0].PathTiles))
	}

	// Doors should still be detected
	if len(pathInfos[0].Doors) == 0 {
		t.Errorf("Expected doors to be detected for touching rooms")
	}
}

func TestStage2_HorizontalLayout(t *testing.T) {
	// Test with horizontal layout (LeftToRight style)
	tr := &tree.Tree{}
	tr.Add(-1, nil)
	tr.Add(0, nil)

	shapes := []PlacedShape{
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{0, 0}, Width: 2, Height: 2},
		{Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, Position: Point{10, 0}, Width: 2, Height: 2}, // far to the right
	}

	initialGap := shapes[1].Position[0] - (shapes[0].Position[0] + shapes[0].Width)

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	finalGap := shapes[1].Position[0] - (shapes[0].Position[0] + shapes[0].Width)

	if finalGap >= initialGap {
		t.Errorf("Expected horizontal gap to decrease, got initial=%d, final=%d", initialGap, finalGap)
	}
}

func TestStage2_LargeTree(t *testing.T) {
	// Test with a moderate tree using Stage1 for initial placement
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root

	// Level 1: 3 children
	for i := 0; i < 3; i++ {
		tr.Add(0, nil)
	}

	// Level 2: 2 children each
	for parent := 1; parent <= 3; parent++ {
		for i := 0; i < 2; i++ {
			tr.Add(parent, nil)
		}
	}

	rng := &mockRandom{}
	config := LayoutConfig{Direction: TopDown}

	// Use Stage1 to create initial layout
	shapes := Stage1(rng, tr, simpleRoomShape, config)

	// Record initial total gap
	initialTotalGap := 0
	for nodeIndex := 1; nodeIndex < len(*tr); nodeIndex++ {
		parentIndex := (*tr)[nodeIndex].ParentId
		gap := shapes[nodeIndex].Position[1] - (shapes[parentIndex].Position[1] + shapes[parentIndex].Height)
		if gap > 0 {
			initialTotalGap += gap
		}
	}

	err := Stage2(tr, shapes)
	if err != nil {
		t.Fatalf("Stage2 failed: %v", err)
	}

	// Record final total gap
	finalTotalGap := 0
	for nodeIndex := 1; nodeIndex < len(*tr); nodeIndex++ {
		parentIndex := (*tr)[nodeIndex].ParentId
		gap := shapes[nodeIndex].Position[1] - (shapes[parentIndex].Position[1] + shapes[parentIndex].Height)
		if gap > 0 {
			finalTotalGap += gap
		}
	}

	t.Logf("Total gap: initial=%d, final=%d", initialTotalGap, finalTotalGap)

	// Verify no overlaps
	if hasAnyOverlap(shapes) {
		t.Error("Overlaps detected in large tree after compaction")
	}

	// Verify paths still work
	_, err = Stage3(tr, shapes)
	if err != nil {
		t.Fatalf("Stage3 failed after Stage2 on large tree: %v", err)
	}

	// Verify gap decreased
	if finalTotalGap >= initialTotalGap {
		t.Errorf("Expected total gap to decrease, got initial=%d, final=%d", initialTotalGap, finalTotalGap)
	}
}

// Benchmark tests
func BenchmarkStage2_SmallTree(b *testing.B) {
	tr := &tree.Tree{}
	tr.Add(-1, nil)
	tr.Add(0, nil)
	tr.Add(0, nil)
	tr.Add(1, nil)
	tr.Add(2, nil)

	rng := &mockRandom{}
	config := LayoutConfig{Direction: TopDown}
	baseShapes := Stage1(rng, tr, simpleRoomShape, config)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		testShapes := cloneShapes(baseShapes)
		Stage2(tr, testShapes)
	}
}
