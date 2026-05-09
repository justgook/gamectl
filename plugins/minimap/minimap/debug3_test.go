package minimap

import (
	"fmt"
	"testing"

	"github.com/justgook/gams/sdk/go/tree"
)

func TestDebugPlacement(t *testing.T) {
	// Simplified: root + 5 children (should trigger corridor for 5th)
	tr := &tree.Tree{}
	tr.Add(-1, nil) // Root (idx 0, ID 1)
	tr.Add(0, nil)  // Child 1 (idx 1, ID 2)
	tr.Add(0, nil)  // Child 2 (idx 2, ID 3)
	tr.Add(0, nil)  // Child 3 (idx 3, ID 4)
	tr.Add(0, nil)  // Child 4 (idx 4, ID 5)
	tr.Add(0, nil)  // Child 5 (idx 5, ID 6) - should need corridor

	shapes := make([]PlacedShape, len(*tr))
	for i := range shapes {
		shapes[i] = PlacedShape{
			Points: []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
			Width:  2,
			Height: 2,
		}
	}

	// Manually trace what happens
	result := &Stage2Result{
		Grid:      make(Grid),
		Doors:     nil,
		RoomTiles: make(map[int][]Point),
	}

	// Place root
	placeShape(result, 1, shapes[0], Point{0, 0})
	fmt.Println("After placing root:")
	printGrid(result)

	// Place children 2-5 one by one
	for childIdx := 1; childIdx <= 4; childIdx++ {
		parentTiles := getParentTerritory(result, 1)
		parentEdges := getEdgeTiles(result, parentTiles)
		fmt.Printf("\nPlacing child %d. Parent edges: %d\n", childIdx+1, len(parentEdges))

		placed := tryPlaceChildAdjacent(result, 1, childIdx+1, shapes[childIdx], parentEdges)
		fmt.Printf("Direct placement succeeded: %v\n", placed)

		if !placed {
			fmt.Println("Calling extendAndPlaceChild...")
			extendAndPlaceChild(result, 1, childIdx+1, shapes[childIdx], parentTiles)
		}

		printGrid(result)
	}

	// Now place child 6
	parentTiles := getParentTerritory(result, 1)
	parentEdges := getEdgeTiles(result, parentTiles)
	fmt.Printf("\nPlacing child 6. Parent edges: %d, edges: %v\n", len(parentEdges), parentEdges)

	placed := tryPlaceChildAdjacent(result, 1, 6, shapes[5], parentEdges)
	fmt.Printf("Direct placement succeeded: %v\n", placed)

	if !placed {
		fmt.Println("Calling extendAndPlaceChild...")
		extendAndPlaceChild(result, 1, 6, shapes[5], parentTiles)
	}

	printGrid(result)
}

func printGrid(result *Stage2Result) {
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
