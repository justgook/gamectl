package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/wpm/pdk"
)

// logToConsole sends a log message to the browser console
func logToConsole(msg string) {
	pdk.Call("host", "log", []byte(msg))
}

// Apply executes automapping: parse rules → scan & apply tile-by-tile
func AutomapApply(
	rulesMap *tilemap.TileMap,
	inputMap *tilemap.TileMap,
	// outputMap *tilemap.TileMap,
) (*tilemap.TileMap, error) {
	logToConsole("[Automap] Starting automapping...")
	logToConsole(fmt.Sprintf("[Automap] Rules map layers: %d", len(rulesMap.Layers)))
	logToConsole(fmt.Sprintf("[Automap] Input map layers: %d", len(inputMap.Layers)))
	// logToConsole(fmt.Sprintf("[Automap] Output map layers: %d", len(outputMap.Layers)))

	// 1. Parse global config
	config, err := ParseGlobalConfig(rulesMap.Props)
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	logToConsole(fmt.Sprintf("[Automap] Config parsed - Special tiles: Empty=%d, NonEmpty=%d, Ignore=%d, Other=%d, Negate=%d",
		config.SpecialTiles.Empty, config.SpecialTiles.NonEmpty, config.SpecialTiles.Ignore,
		config.SpecialTiles.Other, config.SpecialTiles.Negate))

	// 2. Detect regions and extract rules
	logToConsole("[Automap] Detecting regions in rules map...")

	rules, err := ExtractRules(rulesMap, config)
	if err != nil {
		return nil, fmt.Errorf("extract rules: %w", err)
	}

	if len(rules) == 0 {
		return nil, fmt.Errorf("no rules found in rules map")
	}

	// logToConsole(fmt.Sprintf("[Automap] Parsed %d rules", len(rules)))
	// for i, rule := range rules {
	// 	logToConsole(fmt.Sprintf("[Automap] Rule %d: %d input layers, %d output variants",
	// 		i, len(rule.InputLayers), len(rule.Outputs)))
	// 	for j, input := range rule.InputLayers {
	// 		logToConsole(fmt.Sprintf("[Automap]   Input %d: %d tiles, target=%s, negated=%v",
	// 			j, len(input.Tiles), input.TargetSelector, input.IsNegated))
	// 	}
	// 	for j, output := range rule.Outputs {
	// 		logToConsole(fmt.Sprintf("[Automap]   Output %d: %d tiles, target=%s, prob=%.2f",
	// 			j, len(output.Tiles), output.TargetSelector, output.Probability))
	// 	}
	// }
	//
	// // 3. Initialize components
	// matcher := &PatternMatcher{Config: config}
	// applicator := &OutputApplicator{
	// 	Config:   config,
	// 	Occupied: NewOccupiedTracker(),
	// }
	//
	// // 4. Scan and apply tile-by-tile, layer-by-layer
	// if len(inputMap.Layers) == 0 {
	// 	return nil
	// }
	//
	// width := inputMap.Layers[0].Width
	// height := inputMap.Layers[0].Height()
	//
	// logToConsole(fmt.Sprintf("[Automap] Scanning input map: %dx%d tiles", width, height))
	//
	// matchCount := 0
	// // Scan left-to-right, top-to-bottom
	// for y := 0; y < height; y++ {
	// 	for x := 0; x < width; x++ {
	// 		// Try each rule at this position (in order)
	// 		for ruleIdx, rule := range rules {
	// 			output := matcher.TryMatch(rule, inputMap, x, y)
	// 			if output != nil {
	// 				matchCount++
	// 				if matchCount <= 10 { // Log first 10 matches
	// 					logToConsole(fmt.Sprintf("[Automap] Match at (%d,%d) with rule %d", x, y, ruleIdx))
	// 				}
	// 				// Apply immediately
	// 				err := applicator.Apply(output, outputMap, x, y)
	// 				if err != nil {
	// 					return fmt.Errorf("apply at (%d,%d): %w", x, y, err)
	// 				}
	// 				break // First match wins
	// 			}
	// 		}
	// 	}
	// }

	// logToConsole(fmt.Sprintf("[Automap] Total matches: %d", matchCount))
	return nil, nil
}
