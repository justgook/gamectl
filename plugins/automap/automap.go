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
) (*tilemap.TileMap, error) {
	logToConsole("[Automap] Starting automapping...")
	logToConsole(fmt.Sprintf("[Automap] Rules map layers: %d", len(rulesMap.Layers)))
	logToConsole(fmt.Sprintf("[Automap] Input map layers: %d", len(inputMap.Layers)))

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

	// logToConsole("[Automap]" + string(must.Must(json.Marshal(rules))))

	// TODO: normilize input map - make all layers same width / height

	width := inputMap.Layers[0].Width
	height := inputMap.Layers[0].Height()
	outputLayers := make(map[string]*tilemap.TileLayer)
	// 4. Scan and apply tile-by-tile, layer-by-layer
	for i := range width * height {
		for _, rule := range rules {
			if !rule.Match(inputMap, i) {
				continue
			}

			for _, outputLayer := range rule.Outputs {
				if _, ok := outputLayers[outputLayer.TargetSelector]; !ok {
					outputLayers[outputLayer.TargetSelector] = tilemap.NewTileLayer(width, height)
				}

				applyTilesToOutput(outputLayers[outputLayer.TargetSelector], i, outputLayer)
			}

			break
		}
	}

	if len(outputLayers) < 1 {
		return nil, fmt.Errorf("no rules match")
	}

	return createOutputTilemap(outputLayers), nil
}

func applyTilesToOutput(targetLayer *tilemap.TileLayer, index int, outputLayer *OutputLayer) {
	width := targetLayer.Width
	height := targetLayer.Height()

	// Apply tiles to the target layer
	for _, tile := range outputLayer.Tiles {
		absIndex := RelativeToAbsoluteIndex(index, width, height, tile.Point.X, tile.Point.Y)

		// Skip if out of bounds
		if absIndex < 0 {
			continue
		}

		// Overwrite (including zeros to erase)
		targetLayer.Data[absIndex] = tile.Value
		logToConsole(fmt.Sprintf("[Automap] setting %d to %d", absIndex, tile.Value))
	}

	// Copy non-rule properties from output layer to target layer
	for key, value := range outputLayer.Props {
		targetLayer.Props[key] = value
	}
}

func createOutputTilemap(outputLayers map[string]*tilemap.TileLayer) *tilemap.TileMap {
	result := tilemap.NewTileMap()

	// Convert map of layers to array
	// For now, just append all layers without specific ordering
	// TODO: respect layer ordering, copy layer properties from rules/input
	for targetSelector, layer := range outputLayers {
		// Set layer name from target selector
		layer.Props["name"] = targetSelector
		result.Layers = append(result.Layers, *layer)
	}

	return result
}
