package placement

import (
	"fmt"
	"strings"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

// MockRandom provides deterministic random for testing
type MockRandom struct {
	values []int
	idx    int
}

func (m *MockRandom) Intn(n int) int {
	if len(m.values) == 0 {
		return 0
	}
	v := m.values[m.idx%len(m.values)]
	m.idx++
	return v % n
}

// Simple room shape helper
func singleTile() RoomShape {
	return RoomShape{{0, 0}}
}

func twoTileHorizontal() RoomShape {
	return RoomShape{{0, 0}, {1, 0}}
}

func twoTileVertical() RoomShape {
	return RoomShape{{0, 0}, {0, 1}}
}

func lShape() RoomShape {
	return RoomShape{{0, 0}, {1, 0}, {0, 1}}
}

func squareShape() RoomShape {
	return RoomShape{{0, 0}, {1, 0}, {0, 1}, {1, 1}}
}

// visualizePlacement creates ASCII art of the placement for debugging
func visualizePlacement(p *Placement) string {
	if len(p.Grid) == 0 {
		return "(empty)"
	}

	minX, minY, maxX, maxY := p.GetBoundingBox()
	width := maxX - minX + 1
	height := maxY - minY + 1

	// Create grid
	grid := make([][]string, height)
	for y := range grid {
		grid[y] = make([]string, width)
		for x := range grid[y] {
			grid[y][x] = "."
		}
	}

	// Fill with room IDs
	for pos, roomID := range p.Grid {
		x := pos.X - minX
		y := pos.Y - minY
		grid[y][x] = fmt.Sprintf("%d", roomID)
	}

	// Build string
	var sb strings.Builder
	for _, row := range grid {
		sb.WriteString(strings.Join(row, " "))
		sb.WriteString("\n")
	}

	return sb.String()
}

func TestPlaceRootOnly(t *testing.T) {
	// Tree with just root
	tr := tree.Tree{}
	tr.Add(0, nil) // Root points to itself

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 1 {
		t.Errorf("Expected 1 room, got %d", len(placement.Rooms))
	}

	if len(placement.Grid) != 1 {
		t.Errorf("Expected 1 tile, got %d", len(placement.Grid))
	}

	t.Logf("Placement:\n%s", visualizePlacement(placement))
}

func TestPlaceRootWithOneChild(t *testing.T) {
	// Tree: root -> child
	tr := tree.Tree{}
	tr.Add(0, nil) // Root (idx 0)
	tr.Add(0, nil) // Child of root (idx 1)

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 2 {
		t.Errorf("Expected 2 rooms, got %d", len(placement.Rooms))
	}

	// Rooms should be adjacent (share edge)
	room1 := placement.Rooms[1]
	room2 := placement.Rooms[2]

	adjacent := false
	for _, t1 := range room1.CurrentShape {
		for _, n := range t1.Neighbors() {
			for _, t2 := range room2.CurrentShape {
				if n.X == t2.X && n.Y == t2.Y {
					adjacent = true
				}
			}
		}
	}

	if !adjacent {
		t.Error("Rooms should be adjacent")
	}

	t.Logf("Placement:\n%s", visualizePlacement(placement))
}

func TestPlaceRootWithMultipleChildren(t *testing.T) {
	// Tree: root -> 3 children
	tr := tree.Tree{}
	tr.Add(0, nil) // Root (idx 0)
	tr.Add(0, nil) // Child 1 (idx 1)
	tr.Add(0, nil) // Child 2 (idx 2)
	tr.Add(0, nil) // Child 3 (idx 3)

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 4 {
		t.Errorf("Expected 4 rooms, got %d", len(placement.Rooms))
	}

	// Each child should be adjacent to root
	root := placement.Rooms[1]
	for i := 2; i <= 4; i++ {
		child := placement.Rooms[RoomID(i)]
		adjacent := false
		for _, t1 := range root.CurrentShape {
			for _, n := range t1.Neighbors() {
				for _, t2 := range child.CurrentShape {
					if n.X == t2.X && n.Y == t2.Y {
						adjacent = true
					}
				}
			}
		}
		if !adjacent {
			t.Errorf("Child %d should be adjacent to root", i)
		}
	}

	t.Logf("Placement:\n%s", visualizePlacement(placement))
}

func TestPlaceManyChildrenRequiresExtension(t *testing.T) {
	// Tree: 1x1 root -> 5 children (needs extension since only 4 edges)
	tr := tree.Tree{}
	tr.Add(0, nil) // Root (idx 0)
	tr.Add(0, nil) // Child 1
	tr.Add(0, nil) // Child 2
	tr.Add(0, nil) // Child 3
	tr.Add(0, nil) // Child 4
	tr.Add(0, nil) // Child 5 - requires extension

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 6 {
		t.Errorf("Expected 6 rooms, got %d", len(placement.Rooms))
	}

	// Root should have been extended (more than 1 tile)
	root := placement.Rooms[1]
	if len(root.CurrentShape) <= 1 {
		t.Errorf("Root should have been extended, has %d tiles", len(root.CurrentShape))
	}

	t.Logf("Root extended to %d tiles", len(root.CurrentShape))
	t.Logf("Placement:\n%s", visualizePlacement(placement))
}

func TestDeepTree(t *testing.T) {
	// Tree: A -> B -> C -> D (chain)
	tr := tree.Tree{}
	tr.Add(0, nil) // A (idx 0)
	tr.Add(0, nil) // B (idx 1)
	tr.Add(1, nil) // C (idx 2)
	tr.Add(2, nil) // D (idx 3)

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 4 {
		t.Errorf("Expected 4 rooms, got %d", len(placement.Rooms))
	}

	// Each room should be adjacent to its parent
	// B(2) adjacent to A(1), C(3) adjacent to B(2), D(4) adjacent to C(3)
	pairs := [][2]RoomID{{1, 2}, {2, 3}, {3, 4}}
	for _, pair := range pairs {
		parent := placement.Rooms[pair[0]]
		child := placement.Rooms[pair[1]]

		adjacent := false
		for _, t1 := range parent.CurrentShape {
			for _, n := range t1.Neighbors() {
				for _, t2 := range child.CurrentShape {
					if n.X == t2.X && n.Y == t2.Y {
						adjacent = true
					}
				}
			}
		}
		if !adjacent {
			t.Errorf("Room %d should be adjacent to room %d", pair[1], pair[0])
		}
	}

	t.Logf("Placement:\n%s", visualizePlacement(placement))
}

func TestLargerRoomShapes(t *testing.T) {
	// Tree: root (L-shape) -> child (square)
	tr := tree.Tree{}
	tr.Add(0, nil) // Root
	tr.Add(0, nil) // Child

	shapes := []RoomShape{lShape(), squareShape()}
	shapeIdx := 0

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		s := shapes[shapeIdx]
		shapeIdx++
		return s
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	// Root should have 3 tiles (L-shape)
	root := placement.Rooms[1]
	if len(root.OriginalShape) != 3 {
		t.Errorf("Root should have 3 tiles, has %d", len(root.OriginalShape))
	}

	// Child should have 4 tiles (square)
	child := placement.Rooms[2]
	if len(child.OriginalShape) != 4 {
		t.Errorf("Child should have 4 tiles, has %d", len(child.OriginalShape))
	}

	t.Logf("Placement:\n%s", visualizePlacement(placement))
}

func TestToTileMap(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(0, nil) // Root
	tr.Add(0, nil) // Child

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	tm := placement.ToTileMap()

	if len(tm.Layers) != 1 {
		t.Errorf("Expected 1 layer, got %d", len(tm.Layers))
	}

	layer := tm.Layers[0]

	// Count non-zero tiles
	nonZero := 0
	for _, v := range layer.Data {
		if v != 0 {
			nonZero++
		}
	}

	if nonZero != 2 {
		t.Errorf("Expected 2 non-zero tiles, got %d", nonZero)
	}

	t.Logf("TileMap: %dx%d", layer.Width, layer.Height())
}

func TestBranchingTree(t *testing.T) {
	// Tree:
	//       A(0)
	//      / \
	//    B(1) C(2)
	//    |
	//   D(3)
	tr := tree.Tree{}
	tr.Add(0, nil) // A
	tr.Add(0, nil) // B
	tr.Add(0, nil) // C
	tr.Add(1, nil) // D

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 4 {
		t.Errorf("Expected 4 rooms, got %d", len(placement.Rooms))
	}

	// A adjacent to B and C
	// B adjacent to D
	a := placement.Rooms[1]
	b := placement.Rooms[2]
	c := placement.Rooms[3]
	d := placement.Rooms[4]

	checkAdjacent := func(r1, r2 *PlacedRoom, name1, name2 string) {
		adjacent := false
		for _, t1 := range r1.CurrentShape {
			for _, n := range t1.Neighbors() {
				for _, t2 := range r2.CurrentShape {
					if n.X == t2.X && n.Y == t2.Y {
						adjacent = true
					}
				}
			}
		}
		if !adjacent {
			t.Errorf("%s should be adjacent to %s", name1, name2)
		}
	}

	checkAdjacent(a, b, "A", "B")
	checkAdjacent(a, c, "A", "C")
	checkAdjacent(b, d, "B", "D")

	t.Logf("Placement:\n%s", visualizePlacement(placement))
}

func TestStressManyChildren(t *testing.T) {
	// Test: 1x1 root with 10 children (requires significant extension)
	tr := tree.Tree{}
	tr.Add(0, nil) // Root
	for i := 0; i < 10; i++ {
		tr.Add(0, nil) // Children
	}

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 11 {
		t.Errorf("Expected 11 rooms, got %d", len(placement.Rooms))
	}

	// All children should be adjacent to root (which has been extended)
	root := placement.Rooms[1]
	for i := 2; i <= 11; i++ {
		child := placement.Rooms[RoomID(i)]
		adjacent := false
		for _, t1 := range root.CurrentShape {
			for _, n := range t1.Neighbors() {
				for _, t2 := range child.CurrentShape {
					if n.X == t2.X && n.Y == t2.Y {
						adjacent = true
					}
				}
			}
		}
		if !adjacent {
			t.Errorf("Child %d should be adjacent to root", i)
		}
	}

	t.Logf("Root extended to %d tiles for 10 children", len(root.CurrentShape))
	t.Logf("Placement:\n%s", visualizePlacement(placement))
}

func TestEmptyTree(t *testing.T) {
	tr := tree.Tree{}

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 0 {
		t.Errorf("Expected 0 rooms, got %d", len(placement.Rooms))
	}
}

func TestComplexNestedTree(t *testing.T) {
	// Tree:
	//          A(0)
	//         /|\
	//       B C D
	//       |   |
	//       E   F
	//       |
	//       G
	tr := tree.Tree{}
	tr.Add(0, nil) // A (0)
	tr.Add(0, nil) // B (1)
	tr.Add(0, nil) // C (2)
	tr.Add(0, nil) // D (3)
	tr.Add(1, nil) // E (4)
	tr.Add(3, nil) // F (5)
	tr.Add(4, nil) // G (6)

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		return singleTile()
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 7 {
		t.Errorf("Expected 7 rooms, got %d", len(placement.Rooms))
	}

	// Verify parent-child relationships
	checkAdjacent := func(parentID, childID RoomID, parentName, childName string) {
		parent := placement.Rooms[parentID]
		child := placement.Rooms[childID]
		adjacent := false
		for _, t1 := range parent.CurrentShape {
			for _, n := range t1.Neighbors() {
				for _, t2 := range child.CurrentShape {
					if n.X == t2.X && n.Y == t2.Y {
						adjacent = true
					}
				}
			}
		}
		if !adjacent {
			t.Errorf("%s should be adjacent to %s", childName, parentName)
		}
	}

	checkAdjacent(1, 2, "A", "B")
	checkAdjacent(1, 3, "A", "C")
	checkAdjacent(1, 4, "A", "D")
	checkAdjacent(2, 5, "B", "E")
	checkAdjacent(4, 6, "D", "F")
	checkAdjacent(5, 7, "E", "G")

	t.Logf("Placement:\n%s", visualizePlacement(placement))
}

func TestVariedRoomShapes(t *testing.T) {
	// Each room has a different shape
	tr := tree.Tree{}
	tr.Add(0, nil) // Root - L-shape
	tr.Add(0, nil) // Child 1 - square
	tr.Add(0, nil) // Child 2 - vertical 2-tile
	tr.Add(1, nil) // Grandchild - single tile

	shapes := []RoomShape{
		lShape(),
		squareShape(),
		twoTileVertical(),
		singleTile(),
	}
	shapeIdx := 0

	rng := &MockRandom{}
	gen := NewGenerator(&tr, func(node *tree.Node) RoomShape {
		s := shapes[shapeIdx]
		shapeIdx++
		return s
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(placement.Rooms) != 4 {
		t.Errorf("Expected 4 rooms, got %d", len(placement.Rooms))
	}

	// Verify tile counts match shapes
	room1 := placement.Rooms[1]
	if len(room1.OriginalShape) != 3 {
		t.Errorf("Room 1 should have 3 original tiles, has %d", len(room1.OriginalShape))
	}

	room2 := placement.Rooms[2]
	if len(room2.OriginalShape) != 4 {
		t.Errorf("Room 2 should have 4 tiles, has %d", len(room2.OriginalShape))
	}

	room3 := placement.Rooms[3]
	if len(room3.OriginalShape) != 2 {
		t.Errorf("Room 3 should have 2 tiles, has %d", len(room3.OriginalShape))
	}

	room4 := placement.Rooms[4]
	if len(room4.OriginalShape) != 1 {
		t.Errorf("Room 4 should have 1 tile, has %d", len(room4.OriginalShape))
	}

	t.Logf("Placement:\n%s", visualizePlacement(placement))
}
