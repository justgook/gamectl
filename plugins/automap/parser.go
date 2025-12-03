package main

import (
	"github.com/justgook/gamectl/pkg/tilemap"
)

// ParseRules extracts rules from rules tilemap
// Each unique input_index = one Rule (pattern alternative)
func ParseRules(rulesMap *tilemap.TileMap, config *GlobalConfig) ([]*Rule, error) {
	// 1. Parse outputs grouped by output_index
	outputsByIndex := make(map[string][]*OutputLayer)

	for i := range rulesMap.Layers {
		layer := &rulesMap.Layers[i]

		if layer.Meta["rule_role"] != "output" {
			continue
		}
		if parseBool(layer.Meta["rule_Disabled"], false) {
			continue
		}

		// Extract all non-empty tiles from this layer
		tiles := extractTilesFromLayer(layer)
		if len(tiles) == 0 {
			continue
		}

		// Normalize tiles to be relative to (0, 0)
		tiles = NormalizeTiles(tiles)

		output := &OutputLayer{
			Tiles:          tiles,
			TargetSelector: layer.Meta["rule_target_layer"],
			OutputIndex:    layer.Meta["rule_output_index"],
			Probability:    parseFloat(layer.Meta["rule_output_Probability"], 1.0),
		}

		idx := output.OutputIndex
		if idx == "" {
			idx = "default"
		}
		outputsByIndex[idx] = append(outputsByIndex[idx], output)
	}

	// 2. Parse inputs grouped by input_index
	inputsByIndex := make(map[string][]*InputLayer)
	ruleConstraints := make(map[string]*Rule) // Track constraints per input_index

	for i := range rulesMap.Layers {
		layer := &rulesMap.Layers[i]

		if layer.Meta["rule_role"] != "input" {
			continue
		}
		if parseBool(layer.Meta["rule_Disabled"], false) {
			continue
		}

		inputIndex := layer.Meta["rule_input_index"]
		if inputIndex == "" {
			inputIndex = "default"
		}

		// Extract all non-empty tiles from this layer
		tiles := extractTilesFromLayer(layer)
		if len(tiles) == 0 {
			continue
		}

		// Normalize tiles to be relative to (0, 0)
		tiles = NormalizeTiles(tiles)

		input := &InputLayer{
			Tiles:          tiles,
			TargetSelector: layer.Meta["rule_target_layer"],
			IsNegated:      parseBool(layer.Meta["rule_input_not"], false),
			AutoEmpty:      parseBool(layer.Meta["rule_layer_AutoEmpty"], false),
		}

		inputsByIndex[inputIndex] = append(inputsByIndex[inputIndex], input)

		// Store rule constraints (from first input layer per index)
		if ruleConstraints[inputIndex] == nil {
			ruleConstraints[inputIndex] = &Rule{
				ModX:        parseInt(layer.Meta["rule_ModX"], config.ModX),
				ModY:        parseInt(layer.Meta["rule_ModY"], config.ModY),
				OffsetX:     parseInt(layer.Meta["rule_OffsetX"], config.OffsetX),
				OffsetY:     parseInt(layer.Meta["rule_OffsetY"], config.OffsetY),
				Probability: parseFloat(layer.Meta["rule_Probability"], config.Probability),
			}
		}
	}

	// 3. Create rules: combine inputs + outputs by index
	var rules []*Rule

	for inputIndex, inputs := range inputsByIndex {
		if len(inputs) == 0 {
			continue
		}

		// Find matching outputs
		outputs := outputsByIndex[inputIndex]
		if outputs == nil {
			outputs = outputsByIndex["default"]
		}

		// Get constraints
		constraints := ruleConstraints[inputIndex]
		if constraints == nil {
			constraints = &Rule{
				Probability: config.Probability,
			}
		}

		rule := &Rule{
			InputLayers: inputs,
			Outputs:     outputs,
			ModX:        constraints.ModX,
			ModY:        constraints.ModY,
			OffsetX:     constraints.OffsetX,
			OffsetY:     constraints.OffsetY,
			Probability: constraints.Probability,
		}

		rules = append(rules, rule)
	}

	return rules, nil
}

// extractTilesFromLayer extracts all non-empty tiles from a layer
// Returns tiles with their absolute positions and values
func extractTilesFromLayer(layer *tilemap.TileLayer) []Tile {
	var tiles []Tile

	width := layer.Width
	height := layer.Height()

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			idx := y*width + x
			value := layer.Data[idx]

			// Include tile (0 = empty is valid in patterns)
			tiles = append(tiles, Tile{
				Point: Point{X: x, Y: y},
				Value: value,
			})
		}
	}

	return tiles
}
