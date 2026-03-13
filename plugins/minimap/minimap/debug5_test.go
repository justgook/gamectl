package minimap

import (
	"fmt"
	"testing"

	"github.com/justgook/gams/pkg/tree"
)

func TestDebugCorridorCheck(t *testing.T) {
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root
	tr.Add(0, nil)  // 2
	tr.Add(0, nil)  // 3
	tr.Add(0, nil)  // 4
	tr.Add(0, nil)  // 5
	tr.Add(0, nil)  // 6

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

	// Check each room
	for id := 2; id <= 6; id++ {
		tiles := result.RoomTiles[id]
		if len(tiles) == 0 {
			fmt.Printf("Room %d: NO TILES\n", id)
			continue
		}
		fmt.Printf("Room %d at %v: ", id, tiles[0])
		
		if roomsShareEdge(result, 1, id) {
			fmt.Println("shares edge with parent 1")
		} else {
			fmt.Println("DOES NOT share edge with parent 1")
		}
	}
	
	// Show grid
	fmt.Println("\nGrid:")
	printGrid3(result)
}

func printGrid3(result *Stage2Result) {
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
