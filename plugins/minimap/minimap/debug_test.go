package minimap

import (
	"fmt"
	"testing"

	"github.com/justgook/gams/pkg/tree"
)

func TestDebugManyChildren(t *testing.T) {
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

	// Print the grid
	minX, minY, maxX, maxY := 0, 0, 0, 0
	for pt := range result.Grid {
		if pt[0] < minX { minX = pt[0] }
		if pt[0] > maxX { maxX = pt[0] }
		if pt[1] < minY { minY = pt[1] }
		if pt[1] > maxY { maxY = pt[1] }
	}

	fmt.Println("Grid:")
	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			id := result.Grid[Point{x, y}]
			if id == 0 {
				fmt.Print("  .")
			} else {
				fmt.Printf("%3d", id)
			}
		}
		fmt.Println()
	}

	// Check each child
	for childID := 2; childID <= 9; childID++ {
		if roomsShareEdge(result, 1, childID) {
			fmt.Printf("Room %d shares edge with parent 1: OK\n", childID)
		} else {
			fmt.Printf("Room %d does NOT share edge with parent 1: FAIL\n", childID)
			// Show what tiles room childID has
			fmt.Printf("  Room %d tiles: %v\n", childID, result.RoomTiles[childID])
		}
	}
}
