package minimap

import (
	"testing"

	"github.com/justgook/gams/sdk/go/tree"
)

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

// singleTileShape returns a 1x1 shape
func singleTileShape(node *tree.Node) RoomShape {
	return RoomShape{{0, 0}}
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

func TestStage1_CollectsShapes(t *testing.T) {
	tr := createSimpleTree()
	shapes := Stage1(tr, simpleRoomShape)

	if len(shapes) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(shapes))
	}

	// All shapes should be 2x2
	for i, shape := range shapes {
		if shape.Width != 2 || shape.Height != 2 {
			t.Errorf("shape %d: expected 2x2, got %dx%d", i, shape.Width, shape.Height)
		}
		if len(shape.Points) != 4 {
			t.Errorf("shape %d: expected 4 points, got %d", i, len(shape.Points))
		}
	}
}

func TestStage1_NormalizesShapes(t *testing.T) {
	// Create a shape with negative coordinates
	offsetShape := func(node *tree.Node) RoomShape {
		return RoomShape{{-2, -2}, {-1, -2}, {-2, -1}, {-1, -1}}
	}

	tr := &tree.Tree{}
	tr.Add(-1, nil)

	shapes := Stage1(tr, offsetShape)

	if len(shapes) != 1 {
		t.Fatalf("expected 1 shape, got %d", len(shapes))
	}

	// Shape should be normalized to start at (0,0)
	shape := shapes[0]
	hasOrigin := false
	for _, pt := range shape.Points {
		if pt[0] == 0 && pt[1] == 0 {
			hasOrigin = true
		}
		if pt[0] < 0 || pt[1] < 0 {
			t.Errorf("point (%d,%d) has negative coordinates after normalization", pt[0], pt[1])
		}
	}

	if !hasOrigin {
		t.Error("normalized shape should include point at origin")
	}
}

func TestStage1_EmptyTree(t *testing.T) {
	tr := &tree.Tree{}
	shapes := Stage1(tr, simpleRoomShape)

	if len(shapes) != 0 {
		t.Errorf("expected 0 shapes for empty tree, got %d", len(shapes))
	}
}

func TestStage1_VariedShapes(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // 0
	tr.Add(0, nil)  // 1
	tr.Add(0, nil)  // 2

	shapeIndex := 0
	variedShapes := func(node *tree.Node) RoomShape {
		shapes := []RoomShape{
			{{0, 0}, {1, 0}, {0, 1}, {1, 1}}, // 2x2
			{{0, 0}, {0, 1}, {0, 2}},         // 1x3 tall
			{{0, 0}, {1, 0}, {2, 0}},         // 3x1 wide
		}
		result := shapes[shapeIndex%len(shapes)]
		shapeIndex++
		return result
	}

	result := Stage1(tr, variedShapes)

	if len(result) != 3 {
		t.Fatalf("expected 3 shapes, got %d", len(result))
	}

	// Check each shape has correct dimensions
	expected := []struct{ w, h int }{{2, 2}, {1, 3}, {3, 1}}
	for i, shape := range result {
		if shape.Width != expected[i].w || shape.Height != expected[i].h {
			t.Errorf("shape %d: expected %dx%d, got %dx%d",
				i, expected[i].w, expected[i].h, shape.Width, shape.Height)
		}
	}
}

func TestStage1_LShapedRoom(t *testing.T) {
	lShape := func(node *tree.Node) RoomShape {
		return RoomShape{{0, 0}, {1, 0}, {0, 1}, {0, 2}}
	}

	tr := &tree.Tree{}
	tr.Add(-1, nil)

	shapes := Stage1(tr, lShape)

	if len(shapes) != 1 {
		t.Fatalf("expected 1 shape, got %d", len(shapes))
	}

	shape := shapes[0]
	if shape.Width != 2 {
		t.Errorf("L-shape width: expected 2, got %d", shape.Width)
	}
	if shape.Height != 3 {
		t.Errorf("L-shape height: expected 3, got %d", shape.Height)
	}
	if len(shape.Points) != 4 {
		t.Errorf("L-shape points: expected 4, got %d", len(shape.Points))
	}
}
