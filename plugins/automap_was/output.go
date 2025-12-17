package main

import (
	"github.com/justgook/gamectl/pkg/tilemap"
)

// OutputApplicator writes matched outputs to target map
type OutputApplicator struct {
	Config   *GlobalConfig
	Occupied *OccupiedTracker
}

// Apply writes output pattern to output map at (x, y)
func (a *OutputApplicator) Apply(
	output *OutputLayer,
	outputMap *tilemap.TileMap,
	x, y int,
) error {
	// Find target layer
	targetLayer := tilemap.FindLayer(outputMap, output.TargetSelector)
	if targetLayer == nil {
		return nil // Target layer not found, skip
	}

	// Check overlap if NoOverlappingOutput enabled
	if a.Config.NoOverlappingOutput {
		if a.wouldOverlap(output, x, y) {
			return nil // Would overlap, skip
		}
	}

	// Write tiles
	for _, tile := range output.Tiles {
		targetX := x + tile.Point.X
		targetY := y + tile.Point.Y

		// Check bounds
		if targetX < 0 || targetX >= targetLayer.Width {
			continue
		}
		if targetY < 0 || targetY >= targetLayer.Height() {
			continue
		}

		tileValue := tile.Value

		// Handle special tiles in output
		// rule_Empty in output = erase tile (set to 0)
		if a.Config.SpecialTiles.Empty > 0 && tileValue == a.Config.SpecialTiles.Empty {
			tileValue = 0
		}

		// Write tile
		idx := targetY*targetLayer.Width + targetX
		targetLayer.Data[idx] = tileValue

		// Mark as occupied
		if a.Config.NoOverlappingOutput && tileValue != 0 {
			a.Occupied.MarkOccupied(output.TargetSelector, targetX, targetY)
		}
	}

	return nil
}

// wouldOverlap checks if output would overlap with previously written tiles
func (a *OutputApplicator) wouldOverlap(output *OutputLayer, x, y int) bool {
	for _, tile := range output.Tiles {
		// Skip empty tiles in pattern
		if tile.Value == 0 {
			continue
		}

		// Skip special empty tile
		if a.Config.SpecialTiles.Empty > 0 && tile.Value == a.Config.SpecialTiles.Empty {
			continue
		}

		targetX := x + tile.Point.X
		targetY := y + tile.Point.Y

		if a.Occupied.IsOccupied(output.TargetSelector, targetX, targetY) {
			return true
		}
	}

	return false
}
