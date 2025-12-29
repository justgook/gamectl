package minimap

import (
	"fmt"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

func TestDebugCorridorCreation(t *testing.T) {
	// Simple case: root surrounded, need 1 corridor to reach child
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root
	tr.Add(0, nil)  // Child 1
	tr.Add(0, nil)  // Child 2
	tr.Add(0, nil)  // Child 3
	tr.Add(0, nil)  // Child 4
	tr.Add(0, nil)  // Child 5 - needs corridor

	// Use 1x1 shapes for simplicity
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

	fmt.Println("Grid with 1x1 shapes:")
	printGrid2(result)
	
	// Show corridors
	fmt.Println("\nCorridors (negative IDs):")
	for pt, id := range result.Grid {
		if id < 0 {
			fmt.Printf("  %v: %d\n", pt, id)
		}
	}
}

func printGrid2(result *Stage2Result) {
	minX, minY, maxX, maxY := 0, 0, 0, 0
	for pt := range result.Grid {
		if pt[0] < minX { minX = pt[0] }
		if pt[0] > maxX { maxX = pt[0] }
		if pt[1] < minY { minY = pt[1] }
		if pt[1] > maxY { maxY = pt[1] }
	}
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
}
