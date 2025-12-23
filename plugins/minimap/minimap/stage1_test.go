package minimap

import (
	"math"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

// mockRandom implements Random interface for deterministic testing
type mockRandom struct{}

func (r *mockRandom) Intn(n int) int   { return 0 }
func (r *mockRandom) Float64() float64 { return 0.5 }

// simpleRoomShape returns a 2x2 square shape for all nodes
func simpleRoomShape(node *tree.Node) RoomShape {
	return RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}}
}

// tallRoomShape returns a 1x3 tall shape
func tallRoomShape(node *tree.Node) RoomShape {
	return RoomShape{{0, 0}, {0, 1}, {0, 2}}
}

// wideRoomShape returns a 3x1 wide shape
func wideRoomShape(node *tree.Node) RoomShape {
	return RoomShape{{0, 0}, {1, 0}, {2, 0}}
}

// createSimpleTree creates a tree with root and 2 children
func createSimpleTree() *tree.Tree {
	t := &tree.Tree{}
	t.Add(-1, nil) // Root (index 0)
	t.Add(0, nil)  // Child 1 (index 1)
	t.Add(0, nil)  // Child 2 (index 2)
	return t
}

// createDeepTree creates a tree with 3 levels: root -> child -> grandchild
func createDeepTree() *tree.Tree {
	t := &tree.Tree{}
	t.Add(-1, nil) // Root (index 0)
	t.Add(0, nil)  // Child (index 1)
	t.Add(1, nil)  // Grandchild (index 2)
	return t
}

func TestStage1_TopDown_Simple(t *testing.T) {
	tree := createSimpleTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: TopDown}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	// Root should be at top (Y=0), centered at X=0
	root := shapes[0]
	if root.Position[1] != 0 {
		t.Errorf("root Y position: expected 0, got %d", root.Position[1])
	}

	// Children should be below root (Y > root.Y + root.Height)
	child1 := shapes[1]
	child2 := shapes[2]

	expectedChildY := root.Position[1] + root.Height + LevelSpacing
	if child1.Position[1] != expectedChildY {
		t.Errorf("child1 Y position: expected %d, got %d", expectedChildY, child1.Position[1])
	}
	if child2.Position[1] != expectedChildY {
		t.Errorf("child2 Y position: expected %d, got %d", expectedChildY, child2.Position[1])
	}

	// Children should be horizontally separated
	if child1.Position[0] >= child2.Position[0] {
		t.Errorf("children should be horizontally separated: child1.X=%d, child2.X=%d",
			child1.Position[0], child2.Position[0])
	}
}

func TestStage1_BottomUp_Simple(t *testing.T) {
	tree := createSimpleTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: BottomUp}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	root := shapes[0]
	child1 := shapes[1]
	child2 := shapes[2]

	// In BottomUp, children should be ABOVE root (smaller Y values)
	if child1.Position[1] >= root.Position[1] {
		t.Errorf("BottomUp: child1 should be above root: child1.Y=%d, root.Y=%d",
			child1.Position[1], root.Position[1])
	}
	if child2.Position[1] >= root.Position[1] {
		t.Errorf("BottomUp: child2 should be above root: child2.Y=%d, root.Y=%d",
			child2.Position[1], root.Position[1])
	}

	// Children should be at same Y level
	if child1.Position[1] != child2.Position[1] {
		t.Errorf("BottomUp: siblings should be at same Y: child1.Y=%d, child2.Y=%d",
			child1.Position[1], child2.Position[1])
	}

	// Children should be horizontally separated
	if child1.Position[0] >= child2.Position[0] {
		t.Errorf("children should be horizontally separated: child1.X=%d, child2.X=%d",
			child1.Position[0], child2.Position[0])
	}
}

func TestStage1_LeftToRight_Simple(t *testing.T) {
	tree := createSimpleTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: LeftToRight}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	root := shapes[0]
	child1 := shapes[1]
	child2 := shapes[2]

	// Root should be on the left (X=0)
	if root.Position[0] != 0 {
		t.Errorf("root X position: expected 0, got %d", root.Position[0])
	}

	// Children should be to the RIGHT of root (larger X values)
	expectedChildX := root.Position[0] + root.Width + LevelSpacing
	if child1.Position[0] != expectedChildX {
		t.Errorf("LeftToRight: child1.X expected %d, got %d", expectedChildX, child1.Position[0])
	}
	if child2.Position[0] != expectedChildX {
		t.Errorf("LeftToRight: child2.X expected %d, got %d", expectedChildX, child2.Position[0])
	}

	// Children should be at same X level
	if child1.Position[0] != child2.Position[0] {
		t.Errorf("LeftToRight: siblings should be at same X: child1.X=%d, child2.X=%d",
			child1.Position[0], child2.Position[0])
	}

	// Children should be vertically separated (Y axis)
	if child1.Position[1] >= child2.Position[1] {
		t.Errorf("LeftToRight: children should be vertically separated: child1.Y=%d, child2.Y=%d",
			child1.Position[1], child2.Position[1])
	}
}

func TestStage1_RightToLeft_Simple(t *testing.T) {
	tree := createSimpleTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: RightToLeft}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	root := shapes[0]
	child1 := shapes[1]
	child2 := shapes[2]

	// Children should be to the LEFT of root (smaller X values)
	rootRightEdge := root.Position[0] + root.Width - 1
	child1RightEdge := child1.Position[0] + child1.Width - 1
	child2RightEdge := child2.Position[0] + child2.Width - 1

	if child1RightEdge >= root.Position[0] {
		t.Errorf("RightToLeft: child1 should be left of root: child1.RightEdge=%d, root.X=%d",
			child1RightEdge, root.Position[0])
	}
	if child2RightEdge >= root.Position[0] {
		t.Errorf("RightToLeft: child2 should be left of root: child2.RightEdge=%d, root.X=%d",
			child2RightEdge, root.Position[0])
	}

	// Root right edge should be at X=0 (or close, accounting for width)
	if rootRightEdge > 0 {
		t.Errorf("RightToLeft: root right edge should be at 0 or less, got %d", rootRightEdge)
	}

	// Children should be vertically separated (Y axis)
	if child1.Position[1] >= child2.Position[1] {
		t.Errorf("RightToLeft: children should be vertically separated: child1.Y=%d, child2.Y=%d",
			child1.Position[1], child2.Position[1])
	}
}

func TestStage1_TopDown_DeepTree(t *testing.T) {
	tree := createDeepTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: TopDown}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	root := shapes[0]
	child := shapes[1]
	grandchild := shapes[2]

	// Y positions should increase: root < child < grandchild
	if root.Position[1] >= child.Position[1] {
		t.Errorf("TopDown deep: root.Y should be < child.Y: %d >= %d",
			root.Position[1], child.Position[1])
	}
	if child.Position[1] >= grandchild.Position[1] {
		t.Errorf("TopDown deep: child.Y should be < grandchild.Y: %d >= %d",
			child.Position[1], grandchild.Position[1])
	}
}

func TestStage1_LeftToRight_TallShapes(t *testing.T) {
	// With tall shapes (1x3), horizontal layout should use Height for sibling spread
	tree := createSimpleTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: LeftToRight}

	shapes := Stage1(rng, tree, tallRoomShape, config)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	child1 := shapes[1]
	child2 := shapes[2]

	// Children should have Height=3 (tall shapes)
	if child1.Height != 3 || child2.Height != 3 {
		t.Errorf("expected tall shapes with Height=3, got %d and %d",
			child1.Height, child2.Height)
	}

	// Gap between children's Y positions should account for Height
	gap := child2.Position[1] - (child1.Position[1] + child1.Height)
	expectedGap := NodeSpacing
	if gap != expectedGap {
		t.Errorf("LeftToRight tall shapes: gap between children expected %d, got %d",
			expectedGap, gap)
	}
}

func TestStage1_TopDown_WideShapes(t *testing.T) {
	// With wide shapes (3x1), vertical layout should use Width for sibling spread
	tree := createSimpleTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: TopDown}

	shapes := Stage1(rng, tree, wideRoomShape, config)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	child1 := shapes[1]
	child2 := shapes[2]

	// Children should have Width=3 (wide shapes)
	if child1.Width != 3 || child2.Width != 3 {
		t.Errorf("expected wide shapes with Width=3, got %d and %d",
			child1.Width, child2.Width)
	}

	// Gap between children's X positions should account for Width
	gap := child2.Position[0] - (child1.Position[0] + child1.Width)
	expectedGap := NodeSpacing
	if gap != expectedGap {
		t.Errorf("TopDown wide shapes: gap between children expected %d, got %d",
			expectedGap, gap)
	}
}

func TestStage1_EmptyTree(t *testing.T) {
	tree := &tree.Tree{}
	rng := &mockRandom{}
	config := LayoutConfig{Direction: TopDown}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 0 {
		t.Errorf("expected 0 shapes for empty tree, got %d", len(shapes))
	}
}

func TestDefaultLayoutConfig(t *testing.T) {
	config := DefaultLayoutConfig()
	if config.Direction != TopDown {
		t.Errorf("default direction should be TopDown, got %d", config.Direction)
	}
}

// Helper to calculate distance from origin
func distanceFromOrigin(x, y int) float64 {
	return math.Sqrt(float64(x*x + y*y))
}

func TestStage1_Radial_RootAtCenter(t *testing.T) {
	tree := createSimpleTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: Radial}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	root := shapes[0]

	// Root should be centered at origin (position is top-left, so adjust for shape size)
	rootCenterX := root.Position[0] + root.Width/2
	rootCenterY := root.Position[1] + root.Height/2

	// Allow small tolerance for rounding
	if math.Abs(float64(rootCenterX)) > 1 || math.Abs(float64(rootCenterY)) > 1 {
		t.Errorf("Radial: root should be centered near origin, got center (%d, %d)",
			rootCenterX, rootCenterY)
	}
}

func TestStage1_Radial_ChildrenInRing(t *testing.T) {
	tree := createSimpleTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: Radial}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	root := shapes[0]
	child1 := shapes[1]
	child2 := shapes[2]

	// Calculate centers
	rootCenterX := root.Position[0] + root.Width/2
	rootCenterY := root.Position[1] + root.Height/2

	child1CenterX := child1.Position[0] + child1.Width/2
	child1CenterY := child1.Position[1] + child1.Height/2

	child2CenterX := child2.Position[0] + child2.Width/2
	child2CenterY := child2.Position[1] + child2.Height/2

	// Children should be further from origin than root
	rootDist := distanceFromOrigin(rootCenterX, rootCenterY)
	child1Dist := distanceFromOrigin(child1CenterX, child1CenterY)
	child2Dist := distanceFromOrigin(child2CenterX, child2CenterY)

	if child1Dist <= rootDist {
		t.Errorf("Radial: child1 should be further from origin than root: child1Dist=%f, rootDist=%f",
			child1Dist, rootDist)
	}
	if child2Dist <= rootDist {
		t.Errorf("Radial: child2 should be further from origin than root: child2Dist=%f, rootDist=%f",
			child2Dist, rootDist)
	}

	// Children should be at approximately the same distance (same ring)
	tolerance := 2.0 // Allow some tolerance for shape centering
	if math.Abs(child1Dist-child2Dist) > tolerance {
		t.Errorf("Radial: children should be at similar distance: child1Dist=%f, child2Dist=%f",
			child1Dist, child2Dist)
	}
}

func TestStage1_Radial_DeepTree(t *testing.T) {
	tree := createDeepTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: Radial}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	// Calculate distances from origin
	distances := make([]float64, 3)
	for i, shape := range shapes {
		centerX := shape.Position[0] + shape.Width/2
		centerY := shape.Position[1] + shape.Height/2
		distances[i] = distanceFromOrigin(centerX, centerY)
	}

	// Distances should increase: root < child < grandchild
	if distances[0] >= distances[1] {
		t.Errorf("Radial deep: root dist should be < child dist: %f >= %f",
			distances[0], distances[1])
	}
	if distances[1] >= distances[2] {
		t.Errorf("Radial deep: child dist should be < grandchild dist: %f >= %f",
			distances[1], distances[2])
	}
}

func TestStage1_Directional_Simple(t *testing.T) {
	tree := createSimpleTree()
	rng := &mockRandom{}
	config := LayoutConfig{Direction: Directional}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	root := shapes[0]
	child1 := shapes[1]
	child2 := shapes[2]

	// Root should be at center
	rootCenterX := root.Position[0] + root.Width/2
	rootCenterY := root.Position[1] + root.Height/2

	if rootCenterX != 0 || rootCenterY != 0 {
		t.Errorf("Directional: root should be at (0,0), got (%d, %d)",
			rootCenterX, rootCenterY)
	}

	// Children should be in different directions from root
	child1CenterX := child1.Position[0] + child1.Width/2
	child1CenterY := child1.Position[1] + child1.Height/2

	child2CenterX := child2.Position[0] + child2.Width/2
	child2CenterY := child2.Position[1] + child2.Height/2

	// Children should not be at root position
	if child1CenterX == 0 && child1CenterY == 0 {
		t.Error("Directional: child1 should not be at origin")
	}
	if child2CenterX == 0 && child2CenterY == 0 {
		t.Error("Directional: child2 should not be at origin")
	}

	// With round-robin, first child goes TopDown, second goes RightToLeft
	// So child1 should be below root (positive Y) and child2 should be left of root (negative X)
	if child1CenterY <= 0 {
		t.Errorf("Directional: first child should be below root (TopDown): y=%d", child1CenterY)
	}
	if child2CenterX >= 0 {
		t.Errorf("Directional: second child should be left of root (RightToLeft): x=%d", child2CenterX)
	}
}

func TestStage1_Directional_WithOverrides(t *testing.T) {
	tree := createSimpleTree()
	rng := &mockRandom{}

	// Force all children to go LeftToRight
	config := LayoutConfig{
		Direction: Directional,
		NodeDirections: map[int]LayoutDirection{
			0: LeftToRight, // Parent 0's children go LeftToRight
		},
	}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	root := shapes[0]
	child1 := shapes[1]
	child2 := shapes[2]

	rootCenterX := root.Position[0] + root.Width/2
	child1CenterX := child1.Position[0] + child1.Width/2
	child2CenterX := child2.Position[0] + child2.Width/2

	// Both children should be to the right of root
	if child1CenterX <= rootCenterX {
		t.Errorf("Directional override: child1 should be right of root: child1.X=%d, root.X=%d",
			child1CenterX, rootCenterX)
	}
	if child2CenterX <= rootCenterX {
		t.Errorf("Directional override: child2 should be right of root: child2.X=%d, root.X=%d",
			child2CenterX, rootCenterX)
	}
}

func TestStage1_Directional_FourChildren(t *testing.T) {
	// Create tree with 4 children to test all directions
	tree := &tree.Tree{}
	tree.Add(-1, nil) // Root
	tree.Add(0, nil)  // Child 1
	tree.Add(0, nil)  // Child 2
	tree.Add(0, nil)  // Child 3
	tree.Add(0, nil)  // Child 4

	rng := &mockRandom{}
	config := LayoutConfig{Direction: Directional}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 5 {
		t.Fatalf("expected 5 shapes, got %d", len(shapes))
	}

	// With round-robin: child1=TopDown, child2=RightToLeft, child3=BottomUp, child4=LeftToRight
	// Check that children are spread in different directions

	childCenters := make([][2]int, 4)
	for i := 1; i <= 4; i++ {
		childCenters[i-1][0] = shapes[i].Position[0] + shapes[i].Width/2
		childCenters[i-1][1] = shapes[i].Position[1] + shapes[i].Height/2
	}

	// Child 1 (TopDown) should have positive Y
	if childCenters[0][1] <= 0 {
		t.Errorf("child1 (TopDown) should have positive Y, got %d", childCenters[0][1])
	}

	// Child 2 (RightToLeft) should have negative X
	if childCenters[1][0] >= 0 {
		t.Errorf("child2 (RightToLeft) should have negative X, got %d", childCenters[1][0])
	}

	// Child 3 (BottomUp) should have negative Y
	if childCenters[2][1] >= 0 {
		t.Errorf("child3 (BottomUp) should have negative Y, got %d", childCenters[2][1])
	}

	// Child 4 (LeftToRight) should have positive X
	if childCenters[3][0] <= 0 {
		t.Errorf("child4 (LeftToRight) should have positive X, got %d", childCenters[3][0])
	}
}

func TestStage1_Radial_Empty(t *testing.T) {
	tree := &tree.Tree{}
	rng := &mockRandom{}
	config := LayoutConfig{Direction: Radial}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 0 {
		t.Errorf("expected 0 shapes for empty tree, got %d", len(shapes))
	}
}

func TestStage1_Directional_Empty(t *testing.T) {
	tree := &tree.Tree{}
	rng := &mockRandom{}
	config := LayoutConfig{Direction: Directional}

	shapes := Stage1(rng, tree, simpleRoomShape, config)

	if len(shapes) != 0 {
		t.Errorf("expected 0 shapes for empty tree, got %d", len(shapes))
	}
}
