package minimap

import (
	"fmt"
	"testing"

	"github.com/justgook/gams/sdk/go/tree"
)

func TestDebugExtend(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root
	tr.Add(0, nil)  // Child 1
	tr.Add(0, nil)  // Child 2
	tr.Add(0, nil)  // Child 3
	tr.Add(0, nil)  // Child 4
	tr.Add(0, nil)  // Child 5 - should need corridor

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

	// Print the grid including negative IDs
	minX, minY, maxX, maxY := 0, 0, 0, 0
	for pt := range result.Grid {
		if pt[0] < minX {
			minX = pt[0]
		}
		if pt[0] > maxX {
			maxX = pt[0]
		}
		if pt[1] < minY {
			minY = pt[1]
		}
		if pt[1] > maxY {
			maxY = pt[1]
		}
	}

	fmt.Println("Grid (negative = corridor):")
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

	// Check room 6
	fmt.Printf("\nRoom 6 tiles: %v\n", result.RoomTiles[6])

	// Check what room 6 is adjacent to
	for _, pt := range result.RoomTiles[6] {
		neighbors := []Point{
			{pt[0] + 1, pt[1]},
			{pt[0] - 1, pt[1]},
			{pt[0], pt[1] + 1},
			{pt[0], pt[1] - 1},
		}
		for _, n := range neighbors {
			if id, exists := result.Grid[n]; exists && id != 6 {
				fmt.Printf("  Tile %v is adjacent to tile %v with ID %d\n", pt, n, id)
			}
		}
	}
}
