package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// Region represents a connected group of tiles
type Region struct {
	MinX, MinY int
	MaxX, MaxY int
	Tiles      map[int][]Tile
}

// DetectRegions finds all connected tile regions in the rules map
func DetectRegions(rulesMap *tilemap.TileMap, config *GlobalConfig) ([]*Region, error) {
	if len(rulesMap.Layers) == 0 {
		return nil, fmt.Errorf("no layers in rules map")
	}

	width := rulesMap.Layers[0].Width
	height := rulesMap.Layers[0].Height()

	// Create combined occupancy map
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

	return regions, nil
}

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

	for _, region := range regions {
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

			} else if role == "output" {
				output := &OutputLayer{
					Tiles:          tiles,
					TargetSelector: layer.Props["rule_target_layer"],
					OutputIndex:    layer.Props["rule_output_index"],
					Probability:    parseFloat(layer.Props["rule_output_Probability"], 1.0),
				}
				outputLayers = append(outputLayers, output)
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
		}
	}

	// Sort rules by specificity (more tiles = higher priority)
	// This ensures more specific patterns match before less specific ones
	sortRulesBySpecificity(rules)

	return rules, nil
}

// sortRulesBySpecificity sorts rules so that patterns with more tiles come first
func sortRulesBySpecificity(rules []*Rule) {
	// Use bubble sort for simplicity (small number of rules)
	n := len(rules)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			tilesJ := countInputTiles(rules[j])
			tilesJ1 := countInputTiles(rules[j+1])

			// Sort descending (more tiles first)
			if tilesJ < tilesJ1 {
				rules[j], rules[j+1] = rules[j+1], rules[j]
			}
		}
	}
}

func countInputTiles(rule *Rule) int {
	total := 0
	for _, input := range rule.InputLayers {
		total += len(input.Tiles)
	}
	return total
}

// NormalizeTiles adjusts tile positions relative to (0, 0)
func NormalizeTiles(tiles []Tile) []Tile {
	if len(tiles) == 0 {
		return tiles
	}

	// Find minimum coordinates
	minX, minY := tiles[0].Point.X, tiles[0].Point.Y
	for _, t := range tiles[1:] {
		if t.Point.X < minX {
			minX = t.Point.X
		}
		if t.Point.Y < minY {
			minY = t.Point.Y
		}
	}

	// Normalize
	normalized := make([]Tile, len(tiles))
	for i, t := range tiles {
		normalized[i] = Tile{
			Point: Point{X: t.Point.X - minX, Y: t.Point.Y - minY},
			Value: t.Value,
		}
	}

	return normalized
}
