package main

import (
	"encoding/json"
	"fmt"

	"github.com/justgook/gamectl/pkg/must"
	"github.com/justgook/gamectl/pkg/tilemap"
)

// Rule represents one pattern alternative (one input_index)
// Contains multiple InputLayers that define the matching conditions
type Rule struct {
	// All input layers for this rule (grouped by target selector)
	// Same target = OR across tile variants
	// Different targets = AND across layers
	InputLayers []*InputLayer

	// Outputs to apply when rule matches
	Outputs []*OutputLayer

	// Rule constraints (inherited from first input or global)
	ModX, ModY       int
	OffsetX, OffsetY int
	Probability      float64
}

func (r *Rule) Match(inputMap *tilemap.TileMap, index int) bool {
	logToConsole("[Automap][TODO] implement Rule::Match" + string(must.Must(json.Marshal(r.InputLayers))))

	return true
}

// InputLayer represents one input pattern layer
// Tiles are stored as coordinate+value pairs (no bounding box assumption)
type InputLayer struct {
	// Tile positions and values (0 = empty)
	Tiles []Tile

	// Which layer to match against in target map
	TargetSelector string

	// Matching flags
	IsNegated bool
}

// OutputLayer represents tiles to place when rule matches
type OutputLayer struct {
	// Tile positions and values to write
	Tiles []Tile

	// Which layer to write to
	TargetSelector string

	// For probability-based selection
	OutputIndex string
	Probability float64
}

// ExtractRules converts rules map into Rule objects using single-pass recursive extraction
func ExtractRules(rulesMap *tilemap.TileMap, config *GlobalConfig) ([]*Rule, error) {
	if len(rulesMap.Layers) == 0 {
		return nil, fmt.Errorf("no layers in rules map")
	}

	width := rulesMap.Layers[0].Width
	height := rulesMap.Layers[0].Height()

	// Global tracking: which positions are already in a rule
	used := make([]bool, width*height)
	var rules []*Rule

	// Scan all positions
	for idx := 0; idx < width*height; idx++ {
		if used[idx] {
			continue
		}

		// Check if any layer has a tile here
		if !hasAnyTile(rulesMap, idx) {
			continue
		}

		// Found a rule start - collect all tiles recursively
		// ruleTiles[layerIdx] = []Tile
		ruleTiles := make(map[int][]Tile)

		collectRuleTiles(rulesMap, idx, width, height, used, ruleTiles)

		// Now convert collected tiles into InputLayers and OutputLayers
		var inputLayers []*InputLayer
		var outputLayers []*OutputLayer

		for layerIdx, tiles := range ruleTiles {
			if len(tiles) == 0 {
				continue
			}

			layer := &rulesMap.Layers[layerIdx]
			role := layer.Props["rule_role"]
			targetLayer := layer.Props["rule_target_layer"]

			// Validate required properties
			if role == "" {
				return nil, fmt.Errorf("layer %d missing rule_role property", layerIdx)
			}
			if targetLayer == "" {
				return nil, fmt.Errorf("layer %d missing rule_target_layer property", layerIdx)
			}

			// Normalize tiles to (0,0)
			tiles = NormalizeTiles(tiles)

			if role == "input" {
				inputLayers = append(inputLayers, &InputLayer{
					Tiles:          tiles,
					TargetSelector: targetLayer,
					IsNegated:      parseBool(layer.Props["rule_input_not"], false),
				})
			} else if role == "output" {
				outputLayers = append(outputLayers, &OutputLayer{
					Tiles:          tiles,
					TargetSelector: targetLayer,
					OutputIndex:    layer.Props["rule_output_index"],
					Probability:    parseFloat(layer.Props["rule_output_Probability"], 1.0),
				})
			}
		}

		// Only create rule if has both inputs and outputs
		if len(inputLayers) > 0 && len(outputLayers) > 0 {
			rules = append(rules, &Rule{
				InputLayers: inputLayers,
				Outputs:     outputLayers,
				Probability: config.Probability,
			})
		} else {
			return nil, fmt.Errorf("rule at position %d has only inputs=%d or only outputs=%d (need both)",
				idx, len(inputLayers), len(outputLayers))
		}
	}

	return rules, nil
}

// collectRuleTiles recursively collects all tiles connected to idx (4-way)
// Marks positions as used and stores tiles by layer index
func collectRuleTiles(rulesMap *tilemap.TileMap, idx, width, height int,
	used []bool, ruleTiles map[int][]Tile) {
	// Already used? Stop recursion
	if used[idx] {
		return
	}

	// Mark as used immediately
	used[idx] = true

	// Calculate x,y for this position
	x := idx % width
	y := idx / width

	// Check all layers at this position and collect non-zero tiles
	hasAnyTileHere := false
	for layerIdx := range rulesMap.Layers {
		tileValue := rulesMap.Layers[layerIdx].Data[idx]

		if tileValue != 0 {
			hasAnyTileHere = true
			ruleTiles[layerIdx] = append(ruleTiles[layerIdx], Tile{
				Point: Point{X: x, Y: y},
				Value: tileValue,
			})
		}
	}

	// If no tiles here, don't recurse
	if !hasAnyTileHere {
		return
	}

	// Recurse to 4 neighbors
	// Up
	if y > 0 {
		collectRuleTiles(rulesMap, idx-width, width, height, used, ruleTiles)
	}
	// Down
	if y < height-1 {
		collectRuleTiles(rulesMap, idx+width, width, height, used, ruleTiles)
	}
	// Left
	if x > 0 {
		collectRuleTiles(rulesMap, idx-1, width, height, used, ruleTiles)
	}
	// Right
	if x < width-1 {
		collectRuleTiles(rulesMap, idx+1, width, height, used, ruleTiles)
	}
}

// hasAnyTile checks if any layer has a non-zero tile at index
func hasAnyTile(rulesMap *tilemap.TileMap, idx int) bool {
	for i := range rulesMap.Layers {
		if rulesMap.Layers[i].Data[idx] != 0 {
			return true
		}
	}
	return false
}
