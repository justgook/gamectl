package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// Step1ValidateRegions tests region extraction
func Step1ValidateRegions(rulesMap *tilemap.TileMap, config *GlobalConfig) ([]*Region, error) {
	fmt.Println("\n=== STEP 1: Extract and Validate Regions ===")

	// Detect regions
	regions, err := DetectRegions(rulesMap, config)
	if err != nil {
		return nil, fmt.Errorf("detect regions: %w", err)
	}

	fmt.Printf("✓ Detected %d regions\n", len(regions))

	// Validate each region
	fmt.Println("\nRegion Details:")
	for i, region := range regions {
		width := region.MaxX - region.MinX + 1
		height := region.MaxY - region.MinY + 1

		// Count non-zero tiles per layer
		inputNonZero := 0
		outputNonZero := 0

		if tiles, ok := region.Tiles[0]; ok {
			for _, t := range tiles {
				if t.Value != 0 {
					inputNonZero++
				}
			}
		}

		if tiles, ok := region.Tiles[1]; ok {
			for _, t := range tiles {
				if t.Value != 0 {
					outputNonZero++
				}
			}
		}

		fmt.Printf("  Region %2d: bounds=(%2d,%2d)-(%2d,%2d) size=%dx%d, input_nonzero=%d, output_nonzero=%d\n",
			i, region.MinX, region.MinY, region.MaxX, region.MaxY,
			width, height, inputNonZero, outputNonZero)
	}

	// Validate expected count
	expectedRegions := 47
	if len(regions) != expectedRegions {
		return regions, fmt.Errorf("expected %d regions, got %d", expectedRegions, len(regions))
	}

	// Show first region in detail
	if len(regions) > 0 {
		fmt.Println("\nFirst Region Detail:")
		r := regions[0]

		// Show input layer
		fmt.Println("  Input layer tiles:")
		if tiles, ok := r.Tiles[0]; ok {
			normalized := NormalizeTiles(tiles)
			for _, t := range normalized {
				fmt.Printf("    (%d,%d): %d\n", t.Point.X, t.Point.Y, t.Value)
			}
		}

		// Show output layer
		fmt.Println("  Output layer tiles:")
		if tiles, ok := r.Tiles[1]; ok {
			normalized := NormalizeTiles(tiles)
			for _, t := range normalized {
				if t.Value != 0 {
					fmt.Printf("    (%d,%d): %d\n", t.Point.X, t.Point.Y, t.Value)
				}
			}
		}
	}

	fmt.Println("\n✅ Step 1 PASSED: All regions extracted correctly")
	return regions, nil
}
