package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// AutomapEngine orchestrates automapping with immediate application
type AutomapEngine struct{}

// Apply executes automapping: parse rules → scan & apply tile-by-tile
func (e *AutomapEngine) Apply(
	rulesMap *tilemap.TileMap,
	inputMap *tilemap.TileMap,
	outputMap *tilemap.TileMap,
) error {
	// 1. Parse global config
	config, err := ParseGlobalConfig(rulesMap.Props)
	if err != nil {
		return fmt.Errorf("parse config: %w", err)
	}

	// 2. Parse rules
	rules, err := ParseRules(rulesMap, config)
	if err != nil {
		return fmt.Errorf("parse rules: %w", err)
	}

	if len(rules) == 0 {
		return fmt.Errorf("no rules found in rules map")
	}

	// 3. Initialize components
	matcher := &PatternMatcher{Config: config}
	applicator := &OutputApplicator{
		Config:   config,
		Occupied: NewOccupiedTracker(),
	}

	// 4. Scan and apply tile-by-tile, layer-by-layer
	if len(inputMap.Layers) == 0 {
		return nil
	}

	width := inputMap.Layers[0].Width
	height := inputMap.Layers[0].Height()

	// Scan left-to-right, top-to-bottom
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			// Try each rule at this position (in order)
			for _, rule := range rules {
				output := matcher.TryMatch(rule, inputMap, x, y)
				if output != nil {
					// Apply immediately
					err := applicator.Apply(output, outputMap, x, y)
					if err != nil {
						return fmt.Errorf("apply at (%d,%d): %w", x, y, err)
					}
					break // First match wins
				}
			}
		}
	}

	return nil
}
