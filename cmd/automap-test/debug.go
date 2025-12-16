package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// PrintMap prints a visual representation of a map
func PrintMap(tm *tilemap.TileMap, name string, rows, cols int) {
	if len(tm.Layers) == 0 {
		fmt.Printf("%s: no layers\n", name)
		return
	}

	layer := &tm.Layers[0]
	width := layer.Width
	height := layer.Height()

	if rows > height {
		rows = height
	}
	if cols > width {
		cols = width
	}

	fmt.Printf("\n%s (first %dx%d):\n", name, cols, rows)
	for y := 0; y < rows; y++ {
		fmt.Printf("%2d: ", y)
		for x := 0; x < cols; x++ {
			idx := y*width + x
			val := layer.Data[idx]
			if val == 0 {
				fmt.Printf(" .")
			} else {
				fmt.Printf("%2d", val)
			}
		}
		fmt.Println()
	}
}

// SaveMapToJSON saves a tilemap to JSON file for debugging
func SaveMapToJSON(tm *tilemap.TileMap, path string) error {
	data, err := json.MarshalIndent(tm, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
