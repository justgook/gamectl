package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// DebugMatch traces a specific pattern match in detail
func DebugMatch(
	ruleIdx int,
	rule *Rule,
	inputMap *tilemap.TileMap,
	x, y int,
	config *GlobalConfig,
) {
	fmt.Printf("\n=== DEBUG: Rule %d at position (%d,%d) ===\n", ruleIdx, x, y)

	// Show rule details
	fmt.Println("\nInput Pattern:")
	if len(rule.InputLayers) > 0 {
		input := rule.InputLayers[0]
		fmt.Printf("  Target: %s, Negated: %v\n", input.TargetSelector, input.IsNegated)
		fmt.Println("  Input tiles (normalized):")

		// Organize by position for visualization
		maxX, maxY := 0, 0
		for _, t := range input.Tiles {
			if t.Point.X > maxX {
				maxX = t.Point.X
			}
			if t.Point.Y > maxY {
				maxY = t.Point.Y
			}
		}

		grid := make([][]uint32, maxY+1)
		for i := range grid {
			grid[i] = make([]uint32, maxX+1)
		}
		for _, t := range input.Tiles {
			grid[t.Point.Y][t.Point.X] = t.Value
		}

		for y := 0; y <= maxY; y++ {
			row := fmt.Sprintf("    ")
			for x := 0; x <= maxX; x++ {
				val := grid[y][x]
				row += fmt.Sprintf("%2d ", val)
			}
			fmt.Println(row)
		}
	}

	// Show what we're matching against
	fmt.Println("\nInput Map at Match Position:")
	if len(inputMap.Layers) > 0 {
		layer := &inputMap.Layers[0]
		width := layer.Width
		height := layer.Height()

		// Show 3x3 region around match point
		for dy := 0; dy < 3; dy++ {
			row := fmt.Sprintf("    ")
			for dx := 0; dx < 3; dx++ {
				targetX := x + dx
				targetY := y + dy

				var val uint32
				if targetX >= 0 && targetX < width && targetY >= 0 && targetY < height {
					val = layer.Data[targetY*width+targetX]
				} else if config.OverflowBorder {
					// Clamp to edge
					cx, cy := targetX, targetY
					if cx < 0 {
						cx = 0
					} else if cx >= width {
						cx = width - 1
					}
					if cy < 0 {
						cy = 0
					} else if cy >= height {
						cy = height - 1
					}
					val = layer.Data[cy*width+cx]
					row += fmt.Sprintf("%2d*", val)
					continue
				} else {
					row += " . "
					continue
				}
				row += fmt.Sprintf("%2d ", val)
			}
			fmt.Println(row)
		}
		fmt.Println("    (* = clamped from out of bounds)")
	}

	// Now actually test the match
	fmt.Println("\nTile-by-Tile Matching:")
	if len(rule.InputLayers) > 0 {
		input := rule.InputLayers[0]
		targetLayer := tilemap.FindLayer(inputMap, input.TargetSelector)
		if targetLayer == nil {
			fmt.Println("  ERROR: Target layer not found")
			return
		}

		matcher := NewTileMatcher(config, input)

		allMatch := true
		for _, patternTile := range input.Tiles {
			targetX := x + patternTile.Point.X
			targetY := y + patternTile.Point.Y

			// Get tile value
			width := targetLayer.Width
			height := targetLayer.Height()

			var targetVal uint32
			if targetX >= 0 && targetX < width && targetY >= 0 && targetY < height {
				targetVal = targetLayer.Data[targetY*width+targetX]
			} else if config.OverflowBorder {
				cx, cy := targetX, targetY
				if cx < 0 {
					cx = 0
				} else if cx >= width {
					cx = width - 1
				}
				if cy < 0 {
					cy = 0
				} else if cy >= height {
					cy = height - 1
				}
				targetVal = targetLayer.Data[cy*width+cx]
			} else {
				targetVal = 0
			}

			matches := matcher.Matches(patternTile.Value, targetVal, input.IsNegated)

			symbol := "✓"
			if !matches {
				symbol = "✗"
				allMatch = false
			}

			fmt.Printf("  %s Pattern (%d,%d) tile %d vs Input (%d,%d) tile %d: %v\n",
				symbol, patternTile.Point.X, patternTile.Point.Y, patternTile.Value,
				targetX, targetY, targetVal, matches)
		}

		if allMatch {
			fmt.Println("\n✓ ALL TILES MATCH")
		} else {
			fmt.Println("\n✗ SOME TILES DON'T MATCH")
		}
	}

	// Show output pattern
	fmt.Println("\nOutput Pattern:")
	if len(rule.Outputs) > 0 {
		output := rule.Outputs[0]
		fmt.Printf("  Target: %s\n", output.TargetSelector)
		fmt.Println("  Output tiles (normalized):")

		for _, t := range output.Tiles {
			if t.Value != 0 {
				fmt.Printf("    (%d,%d): %d\n", t.Point.X, t.Point.Y, t.Value)
			}
		}

		fmt.Printf("\n  When matched at (%d,%d), output tiles will be placed at:\n", x, y)
		for _, t := range output.Tiles {
			if t.Value != 0 {
				fmt.Printf("    Map position (%d,%d): tile %d\n", x+t.Point.X, y+t.Point.Y, t.Value)
			}
		}
	}
}
