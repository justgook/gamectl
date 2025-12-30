package placement

import (
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

func TestDebugSeed3(t *testing.T) {
	seed := int64(2) // Failing seed from stress test
	rng := NewRealRandom(seed)

	// Generate random tree with 50 nodes (same rng used for both tree and shapes)
	tr := generateRandomTree(50, rng)

	// Print tree structure
	t.Log("Tree structure:")
	for i, node := range *tr {
		t.Logf("  Node %d: parent=%d", i, node.ParentId)
	}

	// Find children of node 9 (the problematic parent)
	t.Log("Children of node 9:")
	for i, node := range *tr {
		if node.ParentId == 9 {
			t.Logf("  Node %d is child of 9", i)
		}
	}

	// Use SAME rng for shapes (matching stress test)
	gen := NewGenerator(tr, func(node *tree.Node) RoomShape {
		shape := testRoomShapes[rng.Intn(len(testRoomShapes))]
		idx := tr.IndexOf(node)
		t.Logf("Node %d shape: %v", idx, shape)
		return shape
	}, rng)

	defer func() {
		if r := recover(); r != nil {
			t.Logf("Panic: %v", r)
			t.Logf("Final placement:\n%s", visualizePlacement(gen.Placement))
			t.Logf("Unfinished rooms: %v", gen.Placement.Unfinished)

			// Show which rooms are unfinished and their paths to outside
			for roomID := range gen.Placement.Unfinished {
				room := gen.Placement.Rooms[roomID]
				if room != nil {
					hasPath := gen.Placement.HasPathToOutside(room)
					freeEdges := gen.Placement.GetFreeEdges(room)
					t.Logf("Room %d (node %d): hasPathToOutside=%v, freeEdges=%d, shape=%v",
						roomID, room.NodeIndex, hasPath, len(freeEdges), room.CurrentShape)
				}
			}
			t.Fail()
		}
	}()

	placement, err := gen.Generate()
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	t.Logf("Successfully placed %d rooms", len(placement.Rooms))
	t.Logf("Final placement:\n%s", visualizePlacement(placement))
}
