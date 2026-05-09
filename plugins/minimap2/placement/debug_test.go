package placement

import (
	"testing"

	"github.com/justgook/gams/sdk/go/tree"
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
	gen := NewGenerator(tr, func(node *tree.Node) (RoomShape, error) {
		shape := testRoomShapes[rng.Intn(len(testRoomShapes))]
		idx := tr.IndexOf(node)
		t.Logf("Node %d shape: %v", idx, shape)
		return shape, nil
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

func TestDebugSingleTileSeed3(t *testing.T) {
	seed := int64(3) // Failing seed from single-tile stress test
	rng := NewRealRandom(seed)

	// Generate random tree with 50 nodes
	tr := generateRandomTree(50, rng)

	// Print tree structure for relevant nodes
	t.Log("Tree structure (first 20 nodes):")
	for i := 0; i < 20 && i < len(*tr); i++ {
		node := (*tr)[i]
		t.Logf("  Node %d: parent=%d", i, node.ParentId)
	}

	// Find children of node 7 (the problematic parent)
	t.Log("Children of node 7:")
	for i, node := range *tr {
		if node.ParentId == 7 {
			t.Logf("  Node %d is child of 7", i)
		}
	}

	// All single tiles
	singleTile := RoomShape{{X: 0, Y: 0}}
	gen := NewGenerator(tr, func(node *tree.Node) (RoomShape, error) {
		return singleTile, nil
	}, rng)

	placement, err := gen.Generate()
	if err != nil {
		t.Logf("Generate failed: %v", err)
		t.Logf("Final placement:\n%s", visualizePlacement(gen.Placement))
		t.Logf("Unfinished rooms: %v", gen.Placement.Unfinished)

		// Show constraint info
		t.Log("Forced tiles:")
		for tile, rooms := range gen.Constraints.ForcedTiles {
			roomList := make([]RoomID, 0)
			for r := range rooms {
				roomList = append(roomList, r)
			}
			t.Logf("  %v: forced by rooms %v", tile, roomList)
		}

		// Show which rooms are unfinished and their escape paths
		for roomID := range gen.Placement.Unfinished {
			room := gen.Placement.Rooms[roomID]
			if room != nil {
				paths := gen.Placement.EnumerateEscapePaths(room, 5)
				hasPath := gen.Placement.HasPathToOutside(room)
				freeEdges := gen.Placement.GetFreeEdges(room)
				t.Logf("Room %d (node %d): hasPathToOutside=%v, freeEdges=%d, paths=%d, shape=%v",
					roomID, room.NodeIndex, hasPath, len(freeEdges), len(paths), room.CurrentShape)
				for i, path := range paths {
					t.Logf("  Path %d: %v", i, path.Tiles)
				}
			}
		}
		t.Fail()
		return
	}

	t.Logf("Successfully placed %d rooms", len(placement.Rooms))
	t.Logf("Final placement:\n%s", visualizePlacement(placement))
}
