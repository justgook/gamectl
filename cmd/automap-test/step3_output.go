package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// Step3ValidateOutput tests output tile placement
func Step3ValidateOutput(
	outputMap *tilemap.TileMap,
	matches []MatchResult,
	config *GlobalConfig,
) error {
	fmt.Println("\n=== STEP 3: Validate Output Tile Placement ===")

	if len(outputMap.Layers) == 0 {
		return fmt.Errorf("output map has no layers")
	}

	// Create applicator
	applicator := &OutputApplicator{
		Config:   config,
		Occupied: NewOccupiedTracker(),
	}

	// Apply each match and track results
	tilesPlaced := 0
	skippedBounds := 0
	skippedZero := 0
	skippedOverlap := 0

	fmt.Printf("Applying %d matches...\n", len(matches))

	for i, match := range matches {
		beforeCount := countNonZero(outputMap.Layers[0].Data)

		// Check if would be skipped due to overlap
		if config.NoOverlappingOutput && applicator.wouldOverlap(match.Output, match.X, match.Y) {
			skippedOverlap++
			continue
		}

		// Count what will happen
		localBounds := 0
		localZero := 0
		localPlaced := 0

		for _, tile := range match.Output.Tiles {
			targetX := match.X + tile.Point.X
			targetY := match.Y + tile.Point.Y

			if targetX < 0 || targetX >= outputMap.Layers[0].Width ||
				targetY < 0 || targetY >= outputMap.Layers[0].Height() {
				localBounds++
				continue
			}

			tileValue := tile.Value
			if config.SpecialTiles.Empty > 0 && tileValue == config.SpecialTiles.Empty {
				tileValue = 0
			}

			if tileValue == 0 {
				localZero++
			} else {
				localPlaced++
			}
		}

		// Apply the match
		err := applicator.Apply(match.Output, outputMap, match.X, match.Y)
		if err != nil {
			return fmt.Errorf("apply match %d at (%d,%d): %w", i, match.X, match.Y, err)
		}

		afterCount := countNonZero(outputMap.Layers[0].Data)
		actualPlaced := afterCount - beforeCount

		tilesPlaced += actualPlaced
		skippedBounds += localBounds
		skippedZero += localZero

		// Debug first 5 placements
		if i < 5 {
			fmt.Printf("  Match %d at (%2d,%2d): placed=%d, skipped_bounds=%d, skipped_zero=%d\n",
				i, match.X, match.Y, actualPlaced, localBounds, localZero)
		}
	}

	fmt.Printf("\n✓ Placement Summary:\n")
	fmt.Printf("  Total matches: %d\n", len(matches))
	fmt.Printf("  Tiles placed: %d\n", tilesPlaced)
	fmt.Printf("  Skipped (bounds): %d\n", skippedBounds)
	fmt.Printf("  Skipped (zero): %d\n", skippedZero)
	fmt.Printf("  Skipped (overlap): %d\n", skippedOverlap)

	// Check output map
	totalNonZero := countNonZero(outputMap.Layers[0].Data)
	fmt.Printf("  Total non-zero tiles in output: %d\n", totalNonZero)

	if totalNonZero == 0 {
		return fmt.Errorf("no tiles placed in output map")
	}

	fmt.Println("\n✅ Step 3 PASSED: Output tiles placed")
	return nil
}
