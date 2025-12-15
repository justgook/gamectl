package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/wpm/pdk"
)

// Region represents a connected group of tiles across layers
type Region struct {
	MinX, MinY int
	MaxX, MaxY int
	Tiles      map[int][]Tile // layerIndex -> tiles in this region
}

// DetectRegions finds all connected tile regions in the rules map
// Returns regions that span across all layers at the same positions
func DetectRegions(rulesMap *tilemap.TileMap, config *GlobalConfig) ([]*Region, error) {
	if len(rulesMap.Layers) == 0 {
		return nil, fmt.Errorf("no layers in rules map")
	}

	width := rulesMap.Layers[0].Width
	height := rulesMap.Layers[0].Height()

	logToConsole(fmt.Sprintf("[Regions] Detecting regions in %dx%d grid across %d layers", width, height, len(rulesMap.Layers)))

	// Create a combined occupancy map across all layers
	// A cell is occupied if ANY layer has a non-zero tile there
	occupied := make([]bool, width*height)

	for layerIdx := range rulesMap.Layers {
		layer := &rulesMap.Layers[layerIdx]
		for i, tile := range layer.Data {
			if tile != 0 {
				occupied[i] = true
			}
		}
	}

	// Find connected regions using flood fill
	visited := make([]bool, width*height)
	var regions []*Region

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			idx := y*width + x

			if !occupied[idx] || visited[idx] {
				continue
			}

			// Found a new region - flood fill to find all connected tiles
			region := &Region{
				MinX:  x,
				MinY:  y,
				MaxX:  x,
				MaxY:  y,
				Tiles: make(map[int][]Tile),
			}

			floodFill(x, y, width, height, occupied, visited, region, rulesMap)
			regions = append(regions, region)
		}
	}

	logToConsole(fmt.Sprintf("[Regions] Detected %d regions", len(regions)))
	for i, region := range regions {
		logToConsole(fmt.Sprintf("[Regions] Region %d: bounds=(%d,%d)-(%d,%d), size=%dx%d",
			i, region.MinX, region.MinY, region.MaxX, region.MaxY,
			region.MaxX-region.MinX+1, region.MaxY-region.MinY+1))
	}

	return regions, nil
}

// floodFill performs 4-directional flood fill to find connected tiles
func floodFill(x, y, width, height int, occupied, visited []bool, region *Region, rulesMap *tilemap.TileMap) {
	idx := y*width + x

	if x < 0 || x >= width || y < 0 || y >= height {
		return
	}
	if visited[idx] || !occupied[idx] {
		return
	}

	visited[idx] = true

	// Update region bounds
	if x < region.MinX {
		region.MinX = x
	}
	if x > region.MaxX {
		region.MaxX = x
	}
	if y < region.MinY {
		region.MinY = y
	}
	if y > region.MaxY {
		region.MaxY = y
	}

	// Extract tiles from all layers at this position
	for layerIdx := range rulesMap.Layers {
		layer := &rulesMap.Layers[layerIdx]
		tileValue := layer.Data[idx]

		// Store tile (even if 0, as it's part of the pattern)
		region.Tiles[layerIdx] = append(region.Tiles[layerIdx], Tile{
			Point: Point{X: x, Y: y},
			Value: tileValue,
		})
	}

	// Recursively fill in 4 directions
	floodFill(x+1, y, width, height, occupied, visited, region, rulesMap)
	floodFill(x-1, y, width, height, occupied, visited, region, rulesMap)
	floodFill(x, y+1, width, height, occupied, visited, region, rulesMap)
	floodFill(x, y-1, width, height, occupied, visited, region, rulesMap)
}

// ExtractRulesFromRegions converts detected regions into Rule objects
func ExtractRulesFromRegions(regions []*Region, rulesMap *tilemap.TileMap, config *GlobalConfig) ([]*Rule, error) {
	var rules []*Rule

	logToConsole(fmt.Sprintf("[Regions] Extracting rules from %d regions", len(regions)))

	for regionIdx, region := range regions {
		// Separate input and output layers
		var inputLayers []*InputLayer
		var outputLayers []*OutputLayer

		for layerIdx := range rulesMap.Layers {
			layer := &rulesMap.Layers[layerIdx]
			role := layer.Props["rule_role"]

			tiles, ok := region.Tiles[layerIdx]
			if !ok || len(tiles) == 0 {
				continue
			}

			// Normalize tiles to be relative to (0, 0)
			tiles = NormalizeTiles(tiles)

			if role == "input" {
				input := &InputLayer{
					Tiles:          tiles,
					TargetSelector: layer.Props["rule_target_layer"],
					IsNegated:      parseBool(layer.Props["rule_input_not"], false),
					AutoEmpty:      parseBool(layer.Props["rule_layer_AutoEmpty"], false),
				}
				inputLayers = append(inputLayers, input)

				logToConsole(fmt.Sprintf("[Regions] Region %d: input layer %d has %d tiles (normalized), target=%s",
					regionIdx, layerIdx, len(tiles), input.TargetSelector))

			} else if role == "output" {
				output := &OutputLayer{
					Tiles:          tiles,
					TargetSelector: layer.Props["rule_target_layer"],
					OutputIndex:    layer.Props["rule_output_index"],
					Probability:    parseFloat(layer.Props["rule_output_Probability"], 1.0),
				}
				outputLayers = append(outputLayers, output)

				logToConsole(fmt.Sprintf("[Regions] Region %d: output layer %d has %d tiles (normalized), target=%s",
					regionIdx, layerIdx, len(tiles), output.TargetSelector))
			}
		}

		// Create rule if we have both input and output
		if len(inputLayers) > 0 && len(outputLayers) > 0 {
			rule := &Rule{
				InputLayers: inputLayers,
				Outputs:     outputLayers,
				Probability: config.Probability,
			}
			rules = append(rules, rule)

			logToConsole(fmt.Sprintf("[Regions] Region %d -> Rule %d: %d inputs, %d outputs",
				regionIdx, len(rules)-1, len(inputLayers), len(outputLayers)))
		} else {
			logToConsole(fmt.Sprintf("[Regions] Region %d skipped: inputs=%d, outputs=%d",
				regionIdx, len(inputLayers), len(outputLayers)))
		}
	}

	logToConsole(fmt.Sprintf("[Regions] Created %d rules from %d regions", len(rules), len(regions)))
	return rules, nil
}
