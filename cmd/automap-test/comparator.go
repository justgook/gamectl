package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// TileDiff represents a difference between expected and actual output
type TileDiff struct {
	X        int
	Y        int
	Expected uint32
	Got      uint32
}

// CompareLayerData compares two tile layers and returns statistics
func CompareLayerData(output, expected *tilemap.TileLayer) (matches, total int, diffs []TileDiff) {
	width := expected.Width
	height := expected.Height()
	total = width * height

	if output.Width != width || output.Height() != height {
		// Size mismatch - create diffs for all tiles
		for y := 0; y < height; y++ {
			for x := 0; x < width; x++ {
				idx := y*width + x
				expectedVal := expected.Data[idx]
				gotVal := uint32(0)
				if x < output.Width && y < output.Height() {
					gotVal = output.Data[y*output.Width+x]
				}
				if expectedVal != gotVal {
					diffs = append(diffs, TileDiff{
						X:        x,
						Y:        y,
						Expected: expectedVal,
						Got:      gotVal,
					})
				}
			}
		}
		return total - len(diffs), total, diffs
	}

	// Same size - direct comparison
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			idx := y*width + x
			if output.Data[idx] == expected.Data[idx] {
				matches++
			} else {
				diffs = append(diffs, TileDiff{
					X:        x,
					Y:        y,
					Expected: expected.Data[idx],
					Got:      output.Data[idx],
				})
			}
		}
	}

	return matches, total, diffs
}

// PrintDiffHeatmap prints a visual representation of tile differences
func PrintDiffHeatmap(diffs []TileDiff, width, height int) {
	// Create grid
	grid := make([][]rune, height)
	for y := 0; y < height; y++ {
		grid[y] = make([]rune, width)
		for x := 0; x < width; x++ {
			grid[y][x] = '·'
		}
	}

	// Mark differences
	for _, diff := range diffs {
		if diff.Y >= 0 && diff.Y < height && diff.X >= 0 && diff.X < width {
			if diff.Expected == 0 && diff.Got != 0 {
				grid[diff.Y][diff.X] = '+' // Extra tile
			} else if diff.Expected != 0 && diff.Got == 0 {
				grid[diff.Y][diff.X] = '-' // Missing tile
			} else {
				grid[diff.Y][diff.X] = '?' // Wrong tile
			}
		}
	}

	// Print grid
	fmt.Println("\nDifference heatmap:")
	fmt.Println("  · = match, + = extra tile, - = missing tile, ? = wrong tile")
	for y := 0; y < height; y++ {
		fmt.Printf("%3d: ", y)
		for x := 0; x < width; x++ {
			fmt.Printf("%c", grid[y][x])
		}
		fmt.Println()
	}
}

// PrintDiffDetails prints detailed information about differences
func PrintDiffDetails(diffs []TileDiff, maxPrint int) {
	if len(diffs) == 0 {
		return
	}

	fmt.Printf("\nFirst %d differences:\n", min(maxPrint, len(diffs)))
	for i := 0; i < min(maxPrint, len(diffs)); i++ {
		diff := diffs[i]
		fmt.Printf("  [%3d] (%2d,%2d): expected %3d, got %3d",
			i+1, diff.X, diff.Y, diff.Expected, diff.Got)

		// Add context
		if diff.Expected == 0 {
			fmt.Printf(" (unexpected tile)")
		} else if diff.Got == 0 {
			fmt.Printf(" (missing tile)")
		} else {
			fmt.Printf(" (wrong tile)")
		}
		fmt.Println()
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
